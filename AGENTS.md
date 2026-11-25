# Running From Responsibilities

This repository serves the public 150 km December 2026 running challenge from `F:\Running_From_Responsibilities`. The challenge runs 1–31 December 2026 inclusive in Australia/Sydney. Keep the work in this project and avoid unrelated repository changes.

Keep the design responsive and accessible. Use the dark sport palette (#10151C background, #1B2530 cards, #B9F94B accent, #FFFFFF text, #A6B4C4 secondary text, #F4BC68 warning), keyboard controls, visible focus, accessible contrast, and reduced motion support. Keep static website paths relative and runtime assets self-contained.

## Run updates

Use `runs.json` as the sole source of activity. Preserve the existing challenge metadata and every existing run except the exact record the owner requests to correct or remove. Change only `runs.json` for routine running updates.

- Require a unique nonempty, trimmed string ID, a real ISO calendar date (`YYYY-MM-DD`) and a finite positive numeric `distanceKm`.
- Allow multiple runs per day. Exclude records outside the challenge period from statistics and only add December 2026 runs through the update workflow.
- Optional `durationSeconds` must be finite and positive. Optional `elevationGainM` must be finite and nonnegative. Omit unavailable fields.
- Check the latest branch head before writing, and re-read and revalidate after any concurrent update. Set `lastUpdated` to the UTC ISO timestamp at the time of a successful edit.
- Publish only approved activity summaries. Keep credentials, GPS, exact locations, heart rate, raw screenshots and other private data out of the repository and its Git history.

## Deployment

Read [UPDATE_RUNS.md](UPDATE_RUNS.md) before a data edit. Run the validation checks in [README.md](README.md). After owner approval, use the public `running-from-responsibilities` GitHub repository and GitHub Pages configured to publish from `main` at `/(root)`. Keep `.nojekyll`, verify the Pages deployment for the committed SHA, and verify the served file. Report any pending deployment or permissions.
