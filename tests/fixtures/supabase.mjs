// Test-only Supabase HTTP contract adapter. Auth responses are simulated; SQL and RLS are real PGlite PostgreSQL.
import http from "node:http";
import { randomUUID } from "node:crypto";
import { database } from "./database.mjs";
export async function fixture(port = 4874) {
  const db = await database();
  const stored = new Map(),
    signedTokens = new Map();
  const rateLimits = new Map();
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
      const send = (status, value, headers = {}) => {
        res.writeHead(status, {
          "Content-Type": "application/json",
          ...headers,
        });
        res.end(JSON.stringify(value));
      };
      try {
        const url = new URL(req.url, "http://localhost");
        const chunks = [];
        for await (const chunk of req) chunks.push(chunk);
        const bytes = Buffer.concat(chunks);
        const bucket = url.pathname.includes("/netcozy-studio-assets/")
          ? "netcozy-studio-assets"
          : "netcozy-property-evidence";
        const binaryUpload = url.pathname.startsWith(
          "/storage/v1/object/" + bucket + "/",
        );
        const data =
          bytes.length && !binaryUpload ? JSON.parse(bytes.toString()) : {};
        if (
          req.method === "GET" &&
          url.pathname.startsWith("/storage/v1/object/sign/")
        ) {
          const key = signedTokens.get(url.searchParams.get("token"));
          const item = stored.get(key);
          if (!item) return send(404, {});
          res.writeHead(200, { "Content-Type": item.mime });
          res.end(item.bytes);
          return;
        }
        if (req.headers.apikey !== "sb_publishable_test_fixture")
          return send(401, { error: "Invalid fixture key" });
        const limited = rateLimits.get(url.pathname);
        if (limited) {
          rateLimits.delete(url.pathname);
          return send(
            429,
            { code: limited.code, message: "private provider error detail" },
            { "Retry-After": String(limited.seconds) },
          );
        }
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
          if (!pending || data.type !== "email" || data.token !== "123456")
            return send(400, { code: "otp_expired" });
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
        if (binaryUpload && req.method === "POST") {
          const key = decodeURIComponent(
            url.pathname.slice(("/storage/v1/object/" + bucket + "/").length),
          );
          await db.query(
            "insert into storage.objects(bucket_id,name,owner_id,metadata) values($1,$2,$3,$4)",
            [
              bucket,
              key,
              user.id,
              JSON.stringify({
                mimetype: req.headers["content-type"],
                size: bytes.length,
              }),
            ],
          );
          stored.set(key, { bytes, mime: req.headers["content-type"] });
          return send(200, { Key: key });
        }
        if (
          url.pathname.startsWith("/storage/v1/object/sign/" + bucket + "/") &&
          req.method === "POST"
        ) {
          const key = decodeURIComponent(
            url.pathname.slice(
              ("/storage/v1/object/sign/" + bucket + "/").length,
            ),
          );
          const rows = await db.query(
            "select id from storage.objects where bucket_id=$1 and name=$2",
            [bucket, key],
          );
          if (!rows.rows.length) return send(403, {});
          const token = randomUUID();
          signedTokens.set(token, key);
          return send(200, {
            signedURL: "/object/sign/" + bucket + "/" + key + "?token=" + token,
          });
        }
        if (url.pathname.startsWith("/rest/v1/rpc/")) {
          const name = url.pathname.split("/").at(-1);
          const functions = {
            nc_studio_mutate: ["input"],
            nc_studio_asset: ["input"],
            nc_demo_identity: [],
            nc_complete_onboarding: ["input"],
            nc_assign_role: ["subject", "wanted_role", "remove_role"],
            nc_import_properties: ["meta", "records"],
            nc_save_property_contact: ["input"],
            nc_record_property_permission: ["input"],
            nc_log_property_outreach: ["input"],
            nc_demo_developers: [],
            nc_create_partner_form: ["input"],
            nc_edit_partner_form: ["input"],
            nc_submit_partner_form: ["input"],
            nc_review_partner_form: ["input"],
            nc_simulate_partner_delivery: ["input"],
            nc_demo_property_evidence: ["input"],
            nc_register_property_evidence: ["input"],
            nc_complete_property_evidence: ["input"],
            nc_request_claim_review: ["input"],
            nc_review_property_claim: ["input"],
            nc_save_market_listing: ["input"],
            nc_save_market_agent: ["input"],
            nc_market_listing_action: ["input"],
            nc_save_talent_candidate: ["input"],
            nc_apply_talent: ["input"],
            nc_talent_application_action: ["input"],
            nc_market_inquiry: ["input"],
            nc_market_inquiry_action: ["input"],
            nc_register_event: ["input"],
            nc_cancel_event_order: ["input"],
            nc_checkin_event_ticket: ["input"],
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
          if (value.startsWith("in.(") && value.endsWith(")")) {
            const items = value.slice(4, -1).split(",");
            where.push(
              '"' +
                key +
                '" in (' +
                items
                  .map((item) => {
                    params.push(item);
                    return "$" + params.length;
                  })
                  .join(",") +
                ")",
            );
            continue;
          }
          if (value === "is.null") {
            where.push('"' + key + '" is null');
            continue;
          }
          if (value.startsWith("ilike.")) {
            params.push(value.slice(6));
            where.push('"' + key + '" ilike $' + params.length);
            continue;
          }
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
          const offset = url.searchParams.get("offset");
          if (offset) {
            if (!/^\d+$/.test(offset)) throw new Error("Invalid offset");
            sql += " offset " + offset;
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
    limitNext(path, code, seconds = 2) {
      rateLimits.set(path, { code, seconds });
    },
    async promote(email) {
      await queued(async () => {
        await db.exec("reset role");
        await db.query(
          "insert into nc_roles(user_id,role) values($1,'SUPER_ADMIN')",
          [users.get(email).id],
        );
      });
    },
    async grantRole(email, role) {
      if (
        !["RECRUITER", "SELLER", "AGENT", "ORGANIZER", "ADMIN"].includes(role)
      )
        throw new Error("Unsupported test role");
      await queued(async () => {
        await db.exec("reset role");
        await db.query(
          "insert into nc_roles(user_id,role) values($1,$2) on conflict do nothing",
          [users.get(email).id, role],
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
