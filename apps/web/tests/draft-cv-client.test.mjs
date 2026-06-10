import assert from "node:assert/strict";
import test from "node:test";

import { patchDraftCvBullet } from "../src/lib/ai-workflow-client.mjs";

const BASE = "http://api.test";

function fakeFetch(status, body) {
  return async () => ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  });
}

test("patchDraftCvBullet returns the updated draft on success", async () => {
  const result = await patchDraftCvBullet({
    apiBaseUrl: BASE,
    draftCvId: "d1",
    bulletId: "b1",
    sessionToken: "tok",
    userAction: "approved",
    fetchImpl: fakeFetch(200, { draft_cv: { id: "d1", status: "ready_to_export" } }),
  });
  assert.equal(result.ok, true);
  assert.equal(result.draftCv.status, "ready_to_export");
});

test("patchDraftCvBullet surfaces the error envelope message", async () => {
  const result = await patchDraftCvBullet({
    apiBaseUrl: BASE,
    draftCvId: "d1",
    bulletId: "missing",
    sessionToken: "tok",
    userAction: "approved",
    fetchImpl: fakeFetch(404, { detail: "Bullet not found." }),
  });
  assert.equal(result.ok, false);
  assert.equal(result.message, "Bullet not found.");
});

test("patchDraftCvBullet guards missing inputs", async () => {
  const noAuth = await patchDraftCvBullet({
    apiBaseUrl: BASE,
    draftCvId: "d1",
    bulletId: "b1",
    sessionToken: "",
    userAction: "approved",
  });
  assert.equal(noAuth.ok, false);

  const noIds = await patchDraftCvBullet({
    apiBaseUrl: BASE,
    draftCvId: "",
    bulletId: "",
    sessionToken: "tok",
    userAction: "approved",
  });
  assert.equal(noIds.ok, false);
});
