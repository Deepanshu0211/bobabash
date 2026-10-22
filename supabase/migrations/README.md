The Supabase CLI was unavailable and npm registry DNS resolution failed during implementation. No timestamped migration filename has been invented.

Run `node scripts/create-migration.mjs` after restoring npm access. It calls `supabase migration new bobabash` and copies `supabase/schema.sql` into the single CLI-created file. Review/apply/test that migration on a disposable local database before deploying to a fresh remote project.
