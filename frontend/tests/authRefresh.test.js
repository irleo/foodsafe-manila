import test from "node:test";
import assert from "node:assert/strict";
import { mergeRefreshedAuth } from "../src/modules/user-management/utils/authRefresh.js";

test("refresh preserves and updates the full permission-bearing auth state", () => {
  const refreshed = mergeRefreshedAuth(
    { accessToken: "old", localPreference: "keep" },
    {
      accessToken: "new",
      user: {
        id: "user-id",
        username: "analyst",
        role: "cesu",
        canAccessPatientIdentity: true,
        status: "approved",
      },
    },
  );

  assert.equal(refreshed.accessToken, "new");
  assert.equal(refreshed.canAccessPatientIdentity, true);
  assert.equal(refreshed.status, "approved");
  assert.equal(refreshed.localPreference, "keep");
});
