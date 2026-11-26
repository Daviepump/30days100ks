# Supabase setup · 30 Days. 100 Ks.

1. In your Sydney project, keep the Data API enabled for `public`. Keep `rfr_private` out of the exposed schemas. If your project exposes individual entities explicitly, expose `rfr_dashboard`, `rfr_rate` and `rfr_manage` with the migration’s grants in place. The latter two can only be called by the server role. Disable public signups and anonymous Auth. Create one administrator with email/password in **Authentication → Users**. Keep those credentials private.
2. In the SQL Editor, run [setup.sql](setup.sql) **only if the Stage 2 tables do not already exist**. Then run [stage3.sql](stage3.sql) once. Existing run rows and participant IDs are preserved. Old participant Auth associations are retired. Existing Auth accounts gain no management rights. Do not apply Stage 2 grants again.
3. Allowlist your administrator by running this in the SQL Editor with the administrator’s Auth User UID. Keep the UID out of this repository.

   ```sql
   insert into rfr_private.admins (user_id) values ('YOUR_ADMIN_USER_UUID');
   ```

4. From the repository root, authenticate the Supabase CLI on your trusted machine, then link and deploy:

   ```powershell
   supabase login
   supabase link --project-ref YOUR_PROJECT_REF
   supabase functions deploy challenge --no-verify-jwt
   ```

   The function checks participant sessions, administrator JWTs and the optional create-only credential itself. Keep server secrets in Supabase. The Edge Function runtime provides `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` to the server. Do not copy the service role key into the website, Git, or chat. [Supabase Edge Function authentication](https://supabase.com/docs/guides/functions/auth) · [Deploy Edge Functions](https://supabase.com/docs/guides/functions/deploy)
5. Enter only the standard project URL and publishable key in [supabase-config.js](../supabase-config.js). Open the local `admin/` route, sign in, and generate links for Dave and Kate. Generate fresh production links from the deployed portal after GitHub Pages approval. Regenerating or revoking a link invalidates its old sessions. Deactivating a participant also revokes their link.
6. Run [check-permissions.sql](check-permissions.sql) in the live project. It rolls its changes back. In separate browser tabs or profiles, test unauthenticated and non-admin rejection, create a disposable third participant, verify the listed styling and ordering, exchange its private link, and add, edit, and delete a disposable run. Confirm the link fragment disappears and revocation invalidates new exchanges and an existing session. Verify the public API omits inactive runners and account details. Deactivate the disposable participant when finished.

Local verification uses simulated browser data and an isolated PostgreSQL instance. Hosted Edge routing, Auth, rate limiting under live ingress and cross-device behavior require the configured project.

## Participant visibility

Run [visibility.sql](visibility.sql) once in the SQL Editor after Stage 3. If your Data API exposes entities individually, expose `rfr_set_visibility` with its SQL grants intact. The administrator portal then shows **Visible / Hidden**. Hiding a runner excludes their profile and runs from public reads and leaves their records and access links in place. Existing participants start visible.

## Challenge launch

Run [launch-window.sql](launch-window.sql) once in the SQL Editor after Stage 3. It excludes runs saved before midnight on 1 December 2026 Sydney time from the public dashboard and rejects new entries and date changes before launch or for future Sydney dates. The private run log also hides rehearsal entries. Administrators can still view and delete those entries. The existing Edge Function, runner links and sessions require no changes.
