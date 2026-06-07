# Validation Playbook

This playbook captures repeated validation friction found in Harness traces. Use
it when proving browser workflows, file inputs, local dev servers, and story
metadata maintenance.

## Browser E2E Fallbacks

Prefer direct in-app Browser verification for user-visible flows. If the Browser
surface cannot perform the exact action, use the narrowest fallback that still
proves the product contract.

| Friction | Preferred fallback | Acceptable evidence |
| --- | --- | --- |
| Bulk typing or paste is unavailable | Use small DOM/coordinate interactions only for essential clicks; seed large text through deterministic fixtures or database records. | Browser reads the resulting page state plus unit/integration proof for the form parser. |
| File input cannot be set | Extract upload orchestration into a pure module and test it with real `File`/`FormData`; test API MIME and auth behavior directly. | Unit proof for browser upload orchestration plus API tests for upload boundary. |
| Playwright locator click times out | Use a fresh DOM snapshot; if the target is visible and unique, use DOM node click from `get_visible_dom`. | Browser shows the post-click state and server logs or DB rows confirm mutation. |
| Screenshot capture times out | Use DOM snapshot and targeted page text checks. | Snapshot/text evidence for critical UI plus no framework error overlay. |
| Browser cannot verify authenticated credential entry | Combine route-policy tests, signed-in session page access, and user confirmation if already authenticated. | Protected route behavior plus signed-in page proof. |

Do not mark E2E proof as complete from unit tests alone. If browser-level proof
is unavailable, the story evidence must say what was unavailable and which lower
level proofs replaced it.

## Browser Verification Checklist

For local web routes:

1. Confirm the route loads and body content is non-empty.
2. Check no framework error overlay exists:
   `[data-nextjs-dialog], .vite-error-overlay, #webpack-dev-server-client-overlay`.
3. Verify the primary action or visible state from the actual page.
4. For mutations, confirm one durable signal: success UI, server log, or DB row.
5. Record any Browser capability limitation in trace friction.

## Dev Server Lifecycle

Before starting a local dev server:

1. Check whether the target port is already listening:
   `lsof -iTCP:3000 -sTCP:LISTEN -n -P`.
2. If an existing server is usable, reuse it and say so in trace notes.
3. If starting a new server, record the command, port, and PID/session id.
4. After verification, stop the server you started.
5. If sandbox policy blocks cleanup, report the PID and port in the final
   response and trace notes.

Do not silently leave new dev servers running.

## Story Metadata Updates

The installed Harness CLI can update story status, evidence, proof flags, and
verify command through `story update`. It cannot currently update story title or
risk lane through first-class flags.

Until the prebuilt CLI gains metadata flags, use this supported maintenance
path when durable story metadata must change:

```bash
scripts/bin/harness-cli query sql \
  "update story set title = 'New title', risk_lane = 'high_risk' where id = 'US-000';"
```

Rules:

- Use only valid `risk_lane` values stored by the database:
  `tiny`, `normal`, or `high_risk`.
- Keep the matching markdown story packet and `docs/stories/backlog.md`
  synchronized in the same change.
- Record the reason in the trace or a decision when the metadata change affects
  product scope or validation expectations.
- Prefer first-class `story update` flags when the binary eventually supports
  them.
