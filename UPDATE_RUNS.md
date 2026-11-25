# Update running data from your phone

Send the run date and distance, or attach a Garmin activity screenshot, to a Codex session that can write to `<owner>/running-from-responsibilities` remotely. The standard ChatGPT GitHub connection provides repository read access. Use an authorized Codex repository workflow for writing, including PR creation or promotion to the publishing branch according to repository rules. [OpenAI GitHub connection guidance](https://help.openai.com/en/articles/11145903-connecting-github-to-chatgpt)

## Append a run

1. Read the latest `runs.json` on the GitHub publishing branch. Record its revision so a concurrent edit cannot be overwritten.
2. Extract the Sydney activity date, kilometres, and, if available, duration in seconds and elevation gain in metres. Clarify ambiguous dates or distances. Omit unknown optional values and keep the original screenshot, GPS, exact location, heart rate and other private data outside the repository.
3. Check that the date is a real date from 1 to 31 December 2026, the distance is a finite positive number, duration (when present) is finite and positive, and elevation (when present) is finite and nonnegative. Check all existing IDs. Prefer a stable source ID when one is safe to publish. Otherwise create a new unique ID. Compare same-day distances and durations for likely duplicates, and ask if a close match is a distinct run before adding it.
4. Append the record while preserving the existing records and challenge metadata. Set `lastUpdated` to the current UTC ISO timestamp. Parse and validate the entire document against `validate` in `model.js` before submission.

The following is a format example. Production starts empty.

```json
{
  "id": "run-20261201-01",
  "date": "2026-12-01",
  "distanceKm": 5.2,
  "durationSeconds": 1560,
  "elevationGainM": 35
}
```

5. Commit only `runs.json` with a clear message such as `Log 1 December run`. Use an expected revision or a regular, non-force push. If the head changed, retrieve the latest file and repeat the validation and duplicate check. If a PR is required, confirm its merge before claiming publication.
6. Open the repository's **Actions** tab and verify the Pages deployment associated with the publishing commit. Open `https://<owner>.github.io/running-from-responsibilities/runs.json?verify=<commit-sha>` and check the run ID and `lastUpdated`. During or after the challenge, reload the public site and check the displayed total, recent runs and timestamp. Before launch, the countdown remains visible and the served JSON verifies the data.

## Correct or remove a run

Read the current file and identify the run by ID. For a correction, retain its ID and update only the intended fields. For a removal, confirm the exact record and remove only that entry. Update the timestamp, repeat validation, and follow the same commit and Pages verification steps.

Example phone prompt:

> In my authorized running-from-responsibilities repository, use UPDATE_RUNS.md to log this Garmin run. Read the current runs.json, verify the Sydney date and units, check for duplicates, and update only that file. Report the commit or PR and verify whether the Pages deployment has served the new data.
