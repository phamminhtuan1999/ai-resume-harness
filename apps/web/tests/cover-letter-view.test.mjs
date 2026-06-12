import assert from "node:assert/strict";
import test from "node:test";

import { letterSourceStatus } from "../src/lib/cover-letter-view.mjs";

test("no letter -> null", () => {
  assert.equal(letterSourceStatus(null, { id: "d2", version: 2 }), null);
});

test("legacy letter without linkage makes no staleness claim", () => {
  const status = letterSourceStatus(
    { source_draft_cv_id: null, source_draft_cv_version: null },
    { id: "d2", version: 2 }
  );
  assert.deepEqual(status, {
    legacy: true,
    sourceVersion: null,
    isStale: false,
    latestVersion: null,
  });
});

test("fresh letter: source matches the latest draft", () => {
  const status = letterSourceStatus(
    { source_draft_cv_id: "d2", source_draft_cv_version: 2 },
    { id: "d2", version: 2 }
  );
  assert.equal(status.isStale, false);
  assert.equal(status.sourceVersion, 2);
});

test("stale letter: a newer CV version exists", () => {
  const status = letterSourceStatus(
    { source_draft_cv_id: "d1", source_draft_cv_version: 1 },
    { id: "d2", version: 2 }
  );
  assert.equal(status.isStale, true);
  assert.equal(status.sourceVersion, 1);
  assert.equal(status.latestVersion, 2);
});

test("linked letter with no remaining draft is not stale", () => {
  const status = letterSourceStatus(
    { source_draft_cv_id: "d1", source_draft_cv_version: 1 },
    null
  );
  assert.equal(status.isStale, false);
});
