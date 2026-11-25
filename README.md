# 30 Days. 100 Ks.

**Running From Responsibilities**

100 km. Zero valid excuses. One Christmas break.

The challenge runs from 1–31 December 2026 in Australia/Sydney. The countdown becomes individual dashboards at midnight on 1 December in Sydney. Christmas Day is a scheduled rest day. It does not break a streak, and optional Christmas runs still count. The initial pace for a 100 km target is 3.33 km per scheduled running day.

## Preview and deployment

Run `powershell -NoProfile -ExecutionPolicy Bypass -File .\preview.ps1` from the project root. Open the [three-runner preview](http://localhost:8765/?preview=example), [countdown](http://localhost:8765/?preview=pre), [ten-second launch preview](http://localhost:8765/?preview=launch), or [local test suite](http://localhost:8765/tests/browser.html). Preview data is simulated. The [administrator portal](http://localhost:8765/admin/) and private logging need Supabase configuration.

After owner approval, push `main` to `https://github.com/Daviepump/30days100ks.git`. In **Settings → Pages**, configure **Deploy from a branch**, `main`, and `/(root)`. The expected URL is `https://daviepump.github.io/30days100ks/`. Use that deployed site when generating production links. [GitHub Pages publishing documentation](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)

## Management

[Supabase setup and testing](supabase/README.md) · [Run logging](UPDATE_RUNS.md) · [Codex Cloud API](supabase/CODEX_CLOUD.md)

Supabase is the production authority. The public dashboard fetches active runners in configured order and refreshes every 15 seconds while visible. Participants open a private link to record runs. Administrators use a separate Supabase Auth account and private allowlist.
