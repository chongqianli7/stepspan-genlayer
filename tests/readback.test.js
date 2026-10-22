import test from "node:test";
import assert from "node:assert/strict";
import {
  canonical,
  sha,
  validateState,
  route,
  executionFailed,
} from "../src/protocol.js";
import { example, source, findings } from "../src/example.js";
const context = {
  address: "0x" + "2".repeat(40),
  owner: "0x" + "1".repeat(40),
  plan_id: "museum",
};
async function state() {
  const input_sha256 = await sha(canonical(example));
  return {
    revision: 1,
    plan: {
      protocol: "stepspan-1",
      input: structuredClone(example),
      input_sha256,
    },
    review: {
      protocol: "stepspan-1",
      owner: context.owner,
      plan_id: "museum",
      revision: 1,
      input_sha256,
      source,
      source_sha256: await sha(source),
      findings: structuredClone(findings),
      route: route(example, findings),
    },
  };
}
test("bound state validates", async () => {
  assert.equal(
    (await validateState(await state(), context, 1)).context.plan_id,
    "museum",
  );
});
test("wrong owner, ID, revision, digest and route rejected", async () => {
  for (const [field, value] of [
    ["owner", "0x" + "3".repeat(40)],
    ["plan_id", "other"],
    ["revision", 2],
    ["input_sha256", "bad"],
    ["source_sha256", "bad"],
    ["route", { status: "SUPPORTED" }],
  ]) {
    const s = await state();
    s.review[field] = value;
    await assert.rejects(() => validateState(s, context, 1));
  }
});
test("missing review rejected", async () => {
  const s = await state();
  s.review = null;
  await assert.rejects(() => validateState(s, context, 1));
});
test("fabricated quote rejected", async () => {
  const s = await state();
  s.review.findings.edges[0].quote = "invented evidence";
  await assert.rejects(() => validateState(s, context, 1));
});
test("sealed draft without assessment validates", async () => {
  const s = await state();
  s.review = null;
  s.revision = 0;
  await validateState(s, context, 0);
});
test("malformed latest revision rejected", async () => {
  const s = await state();
  s.revision = "1";
  await assert.rejects(() => validateState(s, context, 1));
});
test("definite failure separated from ambiguous receipt", () => {
  assert.equal(executionFailed({}), false);
  assert.equal(
    executionFailed({
      consensus_data: { leader_receipt: { execution_result: "ERROR" } },
    }),
    true,
  );
  assert.equal(
    executionFailed({
      consensus_data: {
        leader_receipt: [
          { execution_result: "ERROR" },
          { execution_result: "SUCCESS" },
        ],
      },
    }),
    false,
  );
});
