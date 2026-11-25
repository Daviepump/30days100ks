# Log runs from a phone

Dave and Kate can bookmark their own `dave/log/` or `kate/log/` page under the site URL. Sign in once on a trusted device. Enter the Sydney date, distance, optional duration and elevation, and select **Save Run**. Use **Edit** or **Delete** beside a record to correct it. Log out on shared devices.

A saved run’s date, distance, and optional duration and elevation are public on the dashboard. Keep Garmin screenshots, exact running locations, routes, heart rate, and account details out of posted records.

## Future Garmin screenshots in ChatGPT

The standard ChatGPT GitHub connection provides repository read access. Run records live in Supabase and GitHub commits do not update them. [OpenAI GitHub connection guidance](https://help.openai.com/en/articles/11145903-connecting-github-to-chatgpt)

A future integration could use a user-authorized action or tool that passes a short-lived, verified Dave identity to a small server-side endpoint. The endpoint would derive the participant from the authenticated identity, require Dave’s explicit confirmation of the extracted date and measurements, accept a stable request ID, and call the existing run API with Dave’s user authorization so database RLS still applies. It should return the run ID and avoid retaining the screenshot. The action should have no ability to write as Kate. Keep any server credentials out of chat, the browser, and Git.

This integration requires separate authorization, implementation and live tests. Both account holders can add runs directly through the website once Supabase is configured.
