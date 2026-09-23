import test from "node:test";
import assert from "node:assert/strict";
import { updateReviewObject } from "../scripts/lib/review-state.mjs";

test("editing one annotation invalidates only that object and parent capture", () => {
  const state = {
    mode: "all",
    captures: [{
      id: "CAP-1",
      status: "approved",
      revision: 1,
      annotations: [
        { id: "ANN-1", revision: 1, status: "approved", target: { x: 1, y: 1, width: 10, height: 10 } },
        { id: "ANN-2", revision: 1, status: "approved", target: { x: 20, y: 20, width: 10, height: 10 } }
      ],
      redactions: [{ id: "RED-1", revision: 1, status: "approved", geometry: { x: 5, y: 5, width: 5, height: 5 } }]
    }]
  };
  updateReviewObject(state, { captureId: "CAP-1", objectType: "annotation", objectId: "ANN-2", patch: { target: { x: 22, y: 22, width: 10, height: 10 } } });
  assert.equal(state.captures[0].status, "pending");
  assert.equal(state.captures[0].revision, 2);
  assert.equal(state.captures[0].annotations[0].status, "approved");
  assert.equal(state.captures[0].annotations[1].status, "pending");
  assert.equal(state.captures[0].annotations[1].revision, 2);
  assert.equal(state.captures[0].redactions[0].status, "approved");
});
