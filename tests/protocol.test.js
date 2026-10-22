import test from "node:test";
import assert from "node:assert/strict";
import {
  canonical,
  validate,
  route,
  finalSuccess,
  bindReceipt,
} from "../src/protocol.js";
import { example, findings } from "../src/example.js";
test("worked example remains unresolved", () =>
  assert.equal(route(example, findings).status, "UNRESOLVED"));
test("one changed connection creates continuous path", () => {
  const f = structuredClone(findings);
  f.edges[2].state = "PASS";
  assert.deepEqual(route(example, f).path, ["E1", "E2", "E3"]);
});
test("blocked is scoped to proposed paths", () => {
  const f = structuredClone(findings);
  f.edges[2].state = "BLOCKED";
  assert.equal(route(example, f).status, "BLOCKED");
});
test("direction cannot be reversed", () => {
  const d = structuredClone(example);
  [d.start, d.end] = [d.end, d.start];
  assert.equal(route(d, findings).status, "UNRESOLVED");
});
test("draft schema valid", () => assert.equal(validate(example), example));
test("duplicates rejected", () => {
  const d = structuredClone(example);
  d.nodes[1].id = d.nodes[0].id;
  assert.throws(() => validate(d));
});
test("duplicate edges rejected", () => {
  const d = structuredClone(example);
  d.edges[1] = { ...d.edges[0], id: "E2" };
  assert.throws(() => validate(d));
});
test("untrusted URLs rejected", () => {
  for (const url of [
    "http://example.org",
    "https://127.0.0.1/a",
    "https://a:b@example.org",
    "javascript:alert(1)",
  ]) {
    assert.throws(() => validate({ ...example, url }));
  }
});
test("canonical keys recursively stable", () =>
  assert.equal(
    canonical({ b: { z: 0, a: 1 }, a: 2 }),
    '{"a":2,"b":{"a":1,"z":0}}',
  ));
const tx = {
  status_name: "FINALIZED",
  consensus_data: {
    leader_receipt: [{ execution_result: "SUCCESS" }],
    votes: { v1: "AGREE", v2: "AGREE", v3: "DISAGREE" },
  },
};
test("final majority success accepted", () =>
  assert.equal(finalSuccess(tx, true), true));
test("pending never counts as success", () =>
  assert.equal(finalSuccess({ ...tx, status_name: "ACCEPTED" }, true), false));
test("missing votes rejected for assessment", () =>
  assert.equal(
    finalSuccess(
      {
        ...tx,
        consensus_data: { leader_receipt: [{ execution_result: "SUCCESS" }] },
      },
      true,
    ),
    false,
  ));
test("tie rejected", () =>
  assert.equal(
    finalSuccess(
      {
        ...tx,
        consensus_data: {
          ...tx.consensus_data,
          votes: { a: "AGREE", b: "DISAGREE" },
        },
      },
      true,
    ),
    false,
  ));
test("failed leader rejected", () =>
  assert.equal(
    finalSuccess(
      {
        ...tx,
        consensus_data: {
          ...tx.consensus_data,
          leader_receipt: [{ execution_result: "ERROR" }],
        },
      },
      true,
    ),
    false,
  ));
test("intent mismatches rejected", () => {
  const p = {
    type: "assess",
    owner: "0x111",
    address: "0x222",
    args: ["route", 0],
  };
  assert.doesNotThrow(() =>
    bindReceipt(
      p,
      { from: "0x111", to: "0x222" },
      { method: "assess", args: ["route", 0] },
    ),
  );
  for (const c of [
    { method: "seal", args: ["route", 0] },
    { method: "assess", args: ["route", 1] },
  ])
    assert.throws(() => bindReceipt(p, { from: "0x111", to: "0x222" }, c));
  assert.throws(() =>
    bindReceipt(
      p,
      { from: "0x333", to: "0x222" },
      { method: "assess", args: ["route", 0] },
    ),
  );
});
test("whitespace normalization matches sealed contract inputs", () => {
  const d = structuredClone(example);
  d.venue = "  Museum  ";
  d.nodes[0].label = "  Street  ";
  validate(d);
  assert.equal(d.venue, "Museum");
  assert.equal(d.nodes[0].label, "Street");
});
test("mixed successful and failed leader rounds cannot report success", () =>
  assert.equal(
    finalSuccess(
      {
        ...tx,
        consensus_data: {
          ...tx.consensus_data,
          leader_receipt: [
            { execution_result: "SUCCESS" },
            { execution_result: "ERROR" },
          ],
        },
      },
      true,
    ),
    false,
  ));
test("malformed base64 execution payload fails closed", () =>
  assert.equal(
    finalSuccess(
      {
        ...tx,
        consensus_data: {
          ...tx.consensus_data,
          leader_receipt: [{ execution_result: "SUCCESS", result: "%%%" }],
        },
      },
      true,
    ),
    false,
  ));
