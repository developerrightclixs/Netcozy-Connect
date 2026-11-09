// Test-only Supabase HTTP contract adapter. Auth responses are simulated; SQL and RLS are real PGlite PostgreSQL.
import http from "node:http";
import fs from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
export async function fixture(port = 4874) {
  const db = new PGlite();
  await db.exec(
    `create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;`,
  );
  for (const file of [
    "202611100001_shared_core.sql",
    "202611100002_demo_directory.sql",
  ])
    await db.exec(
      (
        await fs.readFile(
          new URL("../../supabase/migrations/" + file, import.meta.url),
          "utf8",
        )
      ).replace(/^\uFEFF/, ""),
    );
  const users = new Map(),
    access = new Map(),
    refresh = new Map();
  let chain = Promise.resolve();
  const queued = (task) => {
    const next = chain.then(task);
    chain = next.catch(() => {});
    return next;
  };
  const tokens = (user) => {
    const a = randomUUID(),
      r = randomUUID();
    access.set(a, user);
    refresh.set(r, user);
    return { access_token: a, refresh_token: r, expires_in: 3600, user };
  };
  const server = http.createServer((req, res) => {
    void queued(async () => {
      const send = (status, value) => {
        res.writeHead(status, { "Content-Type": "application/json" });
        res.end(JSON.stringify(value));
      };
      try {
        const url = new URL(req.url, "http://localhost");
        let raw = "";
        for await (const chunk of req) raw += chunk;
        const data = raw ? JSON.parse(raw) : {};
        if (req.headers.apikey !== "sb_publishable_test_fixture")
          return send(401, { error: "Invalid fixture key" });
        const user = access.get(
          req.headers.authorization?.replace("Bearer ", ""),
        );
        if (url.pathname === "/auth/v1/settings")
          return send(200, { mailer_autoconfirm: false });
        if (url.pathname === "/auth/v1/signup") {
          if (users.has(data.email)) return send(200, {});
          const id = randomUUID();
          await db.exec("reset role");
          await db.query("insert into auth.users(id) values($1)", [id]);
          users.set(data.email, {
            id,
            email: data.email,
            password: data.password,
          });
          return send(200, { id });
        }
        if (url.pathname === "/auth/v1/verify") {
          const pending = users.get(data.email);
          if (!pending || data.token !== "123456") return send(400, {});
          pending.email_confirmed_at = new Date().toISOString();
          const { password: discard, ...safe } = pending;
          void discard;
          return send(200, tokens(safe));
        }
        if (url.pathname === "/auth/v1/resend") return send(200, {});
        if (url.pathname === "/auth/v1/token") {
          if (url.searchParams.get("grant_type") === "refresh_token") {
            const u = refresh.get(data.refresh_token);
            if (!u) return send(401, {});
            refresh.delete(data.refresh_token);
            return send(200, tokens(u));
          }
          const u = users.get(data.email);
          if (!u || u.password !== data.password || !u.email_confirmed_at)
            return send(400, {});
          const { password: discard, ...safe } = u;
          void discard;
          return send(200, tokens(safe));
        }
        if (url.pathname === "/auth/v1/user")
          return send(user ? 200 : 401, user ?? {});
        if (url.pathname === "/auth/v1/logout") {
          access.delete(req.headers.authorization?.replace("Bearer ", ""));
          for (const [key, u] of refresh)
            if (u.id === user?.id) refresh.delete(key);
          return send(200, {});
        }
        if (!user) return send(401, {});
        await db.exec("reset role");
        await db.query("select set_config('request.jwt.claim.sub',$1,false)", [
          user.id,
        ]);
        await db.exec("set role authenticated");
        if (url.pathname.startsWith("/rest/v1/rpc/")) {
          const name = url.pathname.split("/").at(-1);
          const functions = {
            nc_demo_identity: [],
            nc_complete_onboarding: ["input"],
            nc_assign_role: ["subject", "wanted_role", "remove_role"],
          };
          if (!Object.hasOwn(functions, name)) return send(404, {});
          const keys = functions[name];
          const args = keys.map((k) =>
            typeof data[k] === "object" ? JSON.stringify(data[k]) : data[k],
          );
          const result = await db.query(
            "select public." +
              name +
              "(" +
              args.map((_, i) => "$" + (i + 1)).join(",") +
              ")",
            args,
          );
          return send(200, result.rows[0]?.[name] ?? null);
        }
        const table = url.pathname.split("/").at(-1);
        if (!/^nc_[a-z_]+$/.test(table)) return send(404, {});
        const info = (
          await db.query(
            "select column_name,data_type from information_schema.columns where table_schema=$1 and table_name=$2",
            ["public", table],
          )
        ).rows;
        const columns = info.map((r) => r.column_name);
        if (!columns.length) return send(404, {});
        let params = [],
          where = [];
        for (const [key, value] of url.searchParams) {
          if (!columns.includes(key)) continue;
          if (!value.startsWith("eq."))
            throw new Error("Unsupported fixture operator");
          const type = info.find((c) => c.column_name === key).data_type;
          params.push(
            type === "boolean"
              ? value.slice(3) === "true"
              : type === "integer"
                ? Number(value.slice(3))
                : value.slice(3),
          );
          where.push('"' + key + '"=$' + params.length);
        }
        const clause = where.length ? " where " + where.join(" and ") : "";
        let sql = "";
        if (req.method === "GET") {
          sql = "select * from public." + table + clause;
          const order = url.searchParams.get("order");
          if (order) {
            sql +=
              " order by " +
              order
                .split(",")
                .map((s) => {
                  const [key, direction] = s.split(".");
                  if (
                    !columns.includes(key) ||
                    !["asc", "desc"].includes(direction)
                  )
                    throw new Error("Invalid order");
                  return '"' + key + '" ' + direction;
                })
                .join(",");
          }
          const limit = url.searchParams.get("limit");
          if (limit) {
            if (!/^\d+$/.test(limit)) throw new Error("Invalid limit");
            sql += " limit " + limit;
          }
        } else if (req.method === "POST") {
          const keys = Object.keys(data);
          if (keys.some((k) => !columns.includes(k)))
            throw new Error("Unknown field");
          params = keys.map((k) => data[k]);
          sql =
            "insert into public." +
            table +
            "(" +
            keys.map((k) => '"' + k + '"').join(",") +
            ") values(" +
            params.map((_, i) => "$" + (i + 1)).join(",") +
            ") returning *";
        } else if (req.method === "PATCH") {
          const keys = Object.keys(data);
          if (keys.some((k) => !columns.includes(k)))
            throw new Error("Unknown field");
          const assignments = keys.map((k) => {
            params.push(data[k]);
            return '"' + k + '"=$' + params.length;
          });
          sql =
            "update public." +
            table +
            " set " +
            assignments.join(",") +
            clause +
            " returning *";
        } else return send(405, {});
        const result = await db.query(sql, params);
        return send(200, result.rows);
      } catch (error) {
        console.error("Local test fixture:", error.message);
        return send(403, {
          error: "Fixture database rejected request",
          code: error.code ?? "TEST",
        });
      }
    });
  });
  await new Promise((resolve) => server.listen(port, "127.0.0.1", resolve));
  return {
    db,
    server,
    async promote(email) {
      await queued(async () => {
        await db.exec("reset role");
        await db.query(
          "insert into nc_roles(user_id,role) values($1,'SUPER_ADMIN')",
          [users.get(email).id],
        );
      });
    },
    async close() {
      server.closeAllConnections();
      await new Promise((resolve) => server.close(resolve));
      await db.close();
    },
  };
}
