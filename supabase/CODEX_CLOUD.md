# Codex Cloud participant creation · 30 Days. 100 Ks.

Connect `Daviepump/30days100ks` to the Codex Cloud environment and select `main`. The public site is static HTML, CSS and JavaScript. Repository work needs no production credentials or build step. Use the [project test guide](../README.md) for local browser verification. [Codex Cloud environments](https://developers.openai.com/codex/cloud/environments)

For separately authorized participant creation, the cloud agent needs HTTPS access to `ejcgeqdlyfnmbwkuessd.supabase.co` during the **agent** phase. Allow only that domain and POST requests if environment controls permit. [Codex Cloud internet access](https://developers.openai.com/codex/cloud/internet-access)

Cloud participant creation is disabled until separately provisioned. The optional credential can only create a participant and issue that participant’s first private link. It cannot list, edit, revoke, or modify runs. Use a cryptographically random 32-byte base64url token without padding. Set `RFR_CLOUD_TOKEN_SHA256` in Supabase Edge Function secrets to the lowercase hex SHA-256 digest of the exact token string. Put the raw token in an approved secret-bearing runtime or credential broker as `RFR_CLOUD_TOKEN`. Never commit it or put it in prompts. Rotate by replacing the stored digest and the runtime token together. Delete the digest to disable cloud access.

Codex Cloud setup-phase secrets may be removed before the agent phase. If the environment cannot make a credential available at agent runtime without exposing it, keep direct cloud writes disabled and use an approved authenticated broker or the administrator portal. [Codex Cloud environments](https://developers.openai.com/codex/cloud/environments)

Request `POST https://<project-ref>.supabase.co/functions/v1/challenge` with `apikey: <publishable-key>`, `Authorization: Bearer <cloud-token>`, and `Content-Type: application/json`.

```json
{"action":"cloud.create","display_name":"Steve","accent":"#60A5FA","goal_km":100,"display_order":30}
```

A successful response contains the participant under `data` and a one-time-rendered private token under `secret`. Form the recipient’s URL by appending `log/#token=<secret>` to the production site URL. Route that response to a trusted private delivery channel without printing the secret in shell output, transcripts, analytics, or external logs. Only send a real link to its intended participant with authorization. If response delivery fails after creation, check the administrator portal and regenerate the link there. Avoid blindly retrying creation.
