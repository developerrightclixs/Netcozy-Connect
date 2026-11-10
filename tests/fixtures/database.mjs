import fs from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
export const phase2Migrations = [
  "202611100001_shared_core.sql",
  "202611100002_demo_directory.sql",
  "202611100003_real_estate.sql",
  "202611100004_property_workflows.sql",
  "202611100005_property_evidence.sql",
];
export const phase3Migrations = [
  ...phase2Migrations,
  "202611110006_marketplace.sql",
  "202611110007_module_workflows.sql",
  "202611110008_event_ticketing.sql",
];
export async function database() {
  const db = new PGlite();
  try {
    await db.exec(`create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;
  create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text references storage.buckets(id),name text,owner_id text,metadata jsonb,unique(bucket_id,name));alter table storage.objects enable row level security;grant usage on schema storage to authenticated;grant select,insert on storage.objects to authenticated;`);
    for (const file of phase3Migrations)
      await db.exec(
        (
          await fs.readFile(
            new URL("../../supabase/migrations/" + file, import.meta.url),
            "utf8",
          )
        ).replace(/^\uFEFF/, ""),
      );
    return db;
  } catch (error) {
    await db.close();
    throw error;
  }
}
