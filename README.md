# Running From Responsibilities

**31 days. 100 km each. Zero valid excuses.**

Dave and Kate each have a 100 km challenge from 1–31 December 2026 in Australia/Sydney. The public site switches from countdown to dashboards at the start of 1 December and keeps the final results after December. Open tabs update on their next runnable tick, including when a suspended tab becomes visible.

## Local preview

From this workspace, start the Windows preview server:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\preview.ps1
```

Open [the site](http://localhost:8765/). Any static HTTP server serving the repository root also works. Preview scenarios use local simulated runs and require no Supabase configuration.

- [Countdown](http://localhost:8765/?preview=pre) and [launch after ten seconds](http://localhost:8765/?preview=launch)
- [Zero runs](http://localhost:8765/?preview=zero) and [example dashboards](http://localhost:8765/?preview=example)
- [Ahead](http://localhost:8765/?preview=ahead), [behind](http://localhost:8765/?preview=behind), and [milestones](http://localhost:8765/?preview=milestones)
- [Completion](http://localhost:8765/?preview=complete) and [final results](http://localhost:8765/?preview=final)

The private run logs are at [Dave’s run log](http://localhost:8765/dave/log/) and [Kate’s run log](http://localhost:8765/kate/log/). Follow [the Supabase setup guide](supabase/README.md) to connect them. Log submissions, edits, and deletions take effect in open dashboards within 15 seconds in visible tabs and sooner in other tabs of the same browser. The site also checks when a visitor returns to their tab.

Remaining days include today while December is active. Expected progress measures distance due at the start of each Sydney day. Each cumulative chart shows the goal pace at the end of each day. A streak carries from yesterday until today closes. Average pace is weighted by distance across timed runs.

## Testing

Open [the local browser suite](http://localhost:8765/tests/browser.html) to verify countdown, layout, calculation, CRUD, duplicate retries, failure recovery, and login flows with a simulated Supabase client. With Node.js 20+, the model checks can also run with `node --test tests/model.test.cjs`.

Live Supabase Auth and real database authorization must be verified separately. See the [Supabase verification checklist](supabase/README.md#verify-the-live-integration).

## GitHub Pages

After the owner approves publication, push the existing `main` branch to the public `running-from-responsibilities` repository. In **Settings → Pages**, set the source to **Deploy from a branch**, select **main** and **/(root)**, then save. Verify the Pages deployment and open the dashboard plus both `log/` routes signed out. The expected project URL is `https://<owner>.github.io/running-from-responsibilities/`. The site uses relative links and `.nojekyll`. [GitHub Pages publishing documentation](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)

Once the site is deployed, run data changes through Supabase. See [UPDATE_RUNS.md](UPDATE_RUNS.md) for the current phone workflow and the future Garmin screenshot integration.
