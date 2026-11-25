# Supabase setup

Use the existing Sydney project. In **Authentication**, enable email/password sign-in and disable **Allow new users to sign up** and **Allow anonymous sign-ins**. Use the Dashboard’s **Authentication → Users → Add user** control to create Dave and Kate with separate email addresses and strong, unique passwords. Confirm their email addresses through your chosen provisioning process and share credentials privately. [Supabase Auth configuration](https://supabase.com/docs/guides/auth/general-configuration)

1. In the **SQL Editor**, run [setup.sql](setup.sql) once. It creates both 100 km profiles, the private account mapping, validated records, required grants and RLS. Keep the private schema out of the Data API’s exposed schemas.
2. Copy the two users’ **User UID** values from the Authentication dashboard and run the commented mapping statement at the end of the setup script separately with their actual UUIDs. Keep those UUIDs and email addresses out of this repository.
3. In the Data API settings, ensure the API and `public` schema are enabled. The SQL script grants access to the required database objects. If your project exposes selected entities individually, enable `rfr_runs`, `rfr_participants`, `rfr_dashboard`, and `rfr_my_participant` while keeping the SQL grants in place. [Supabase Data API security](https://supabase.com/docs/guides/api/securing-your-api)
4. Set `url` and `publishableKey` in [supabase-config.js](../supabase-config.js). Use the project’s standard `https://<ref>.supabase.co` URL and the `sb_publishable_` key. These two values can be public. Keep secret keys, service-role credentials and database passwords out of all frontend files. [Supabase API keys](https://supabase.com/docs/guides/getting-started/api-keys)

The two profile goals are configurable through the SQL Editor, for example `update public.rfr_participants set goal_km = 100 where participant = 'dave';`. The December achievement thresholds remain 25, 50, 75 and 100 km. The launch copy reflects the original 100 km goals.

## Verify the live integration

- Run [check-permissions.sql](check-permissions.sql) in the SQL Editor after mapping both accounts. It checks public reads, anonymous write denial, owner permissions, cross-account write denial, duplicate IDs and record constraints. It rolls its test inserts back.
- Open each log in a separate browser profile. Verify correct and incorrect credentials, reload with a remembered session, try the other person’s page, then log out.
- Use disposable runs dated within December in each log. Check add, edit, cancelled deletion and confirmed deletion. Verify that each change affects only that participant. If testing a live challenge with real records, remove only the disposable test runs.
- Open the dashboard signed out during December, or use the SQL Editor’s public-role check before launch. Confirm the data endpoint exposes only agreed activity summaries. During December, confirm that another device sees public updates without a deployment.
- Verify that public sign-up and anonymous Auth are disabled. A publishable key identifies the application. The authenticated user and RLS determine write access.

The local browser harness uses a mock client. It does not verify hosted Auth settings, Data API exposure, or RLS against your project.
