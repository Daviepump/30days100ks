# Running From Responsibilities

Work in `F:\Running_From_Responsibilities`. Preserve the Stage 1 commit and the dark sports design, Sydney-time countdown, automatic launch, responsive layout, keyboard controls, accessible contrast, and reduced-motion support. Dave uses #B9F94B and Kate uses #D59BFF. Both have individual 100 km goals from 1–31 December 2026 inclusive in Australia/Sydney. Use the shared dashboard renderer.

## Data and security

Supabase is the sole production authority. Use `supabase/setup.sql` for schema, RLS, and explicit API grants. Keep both accounts mapped privately. Only a mapped authenticated user may insert, edit, or delete that participant’s runs. Public data is limited to the approved summaries. Logging explicitly publishes the run date, distance, and optional duration and elevation. Keep email, account IDs, GPS, locations, heart rate, screenshots, and credentials out of public data and Git.

Use only the project URL and publishable key in `supabase-config.js`. Disable public signup and anonymous Auth users in Supabase. Do not introduce production JSON mirrors. Preserve every existing run unless the owner requests a specific edit or deletion. Use the row ID and last updated timestamp when editing or deleting. Preserve same-day runs and protect submissions with stable request UUIDs.

## Verification and deployment

Run the local browser checks and distinguish mock results from live Supabase tests. Use the rolled-back SQL permission checks and the live Auth checklist in `supabase/README.md` after setup. Keep assets relative for GitHub Pages and preserve `.nojekyll`. Publish only with owner approval. Use `main` at `/(root)`. Avoid unrelated repositories and changes.
