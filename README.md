# Running From Responsibilities

**150 km. 31 days. Zero valid excuses.**

A buildless running challenge site for 1–31 December 2026 in Australia/Sydney. The same URL shows the countdown before launch, live results during December, and final results from 1 January. The changeover uses the visitor's device clock for the current instant and Sydney time for challenge dates.

## Local preview

From this workspace, start the Windows preview server:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\preview.ps1
```

Open [the site](http://localhost:8765/). Any static HTTP server that serves the repository root also works. Open the site over HTTP so it can load the JSON.

| State | Link |
| --- | --- |
| Prelaunch | [Prelaunch](http://localhost:8765/?preview=pre) |
| Automatic launch | [Launch after 10 seconds](http://localhost:8765/?preview=launch) |
| Active with zero runs | [Zero](http://localhost:8765/?preview=zero) |
| Example data | [Example](http://localhost:8765/?preview=example) |
| Ahead of target | [Ahead](http://localhost:8765/?preview=ahead) |
| Behind target | [Behind](http://localhost:8765/?preview=behind) |
| Milestones | [Milestones](http://localhost:8765/?preview=milestones) |
| Over 150 km | [Complete](http://localhost:8765/?preview=complete) |
| Final results | [Final](http://localhost:8765/?preview=final) |

The preview bar identifies simulated data and links to each scenario. The public share link omits the preview parameter.

## Statistics

Remaining days include today while December is active. Expected pace measures the distance due at the beginning of the current Sydney day. The cumulative graph shows the target at the end of each day. A streak stays active through today if yesterday had a run. At the end of December the dashboard reports the streak through 31 December. Average pace weights all timed runs by their distance. Total running time sums recorded durations.

The only activity file is [runs.json](runs.json). The dashboard requests fresh data on entry and retries on demand if loading fails. See [UPDATE_RUNS.md](UPDATE_RUNS.md) for phone updates.

## Tests

With Node.js 20+, run `node --test tests/model.test.cjs`. With the PowerShell preview server running, open [browser checks](http://localhost:8765/tests/browser.html) for model and interface tests, including desktop and mobile layouts. The browser checks run locally without packages.

## GitHub Pages

After the site owner approves publication:

1. Create an empty public GitHub repository named `running-from-responsibilities`.
2. Push this project's local `main` to that repository.
3. In **Settings → Pages**, set **Source** to **Deploy from a branch**, select **main** and **/(root)**, then save.
4. In **Actions**, wait for the Pages deployment to succeed. Open the URL from **Settings → Pages** in a signed-out browser. It normally follows `https://<owner>.github.io/running-from-responsibilities/`.
5. Authorize a repository-capable Codex session for phone updates. Test a reviewed update separately using [UPDATE_RUNS.md](UPDATE_RUNS.md).

The site uses relative paths and includes `.nojekyll`. Updates to `runs.json` on the publishing branch trigger Pages deployment. [GitHub Pages publishing source documentation](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)
