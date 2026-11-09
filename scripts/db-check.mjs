import { checkSupabase } from "../src/lib/supabase-check.mjs";
try {
  await checkSupabase();
  console.log(
    "Supabase API reachable. No rows queried, tables created or authentication flows implemented. Database/schema verification remains pending.",
  );
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
