# StepSpan

**An accessible entrance. But a complete route?**

StepSpan is a route evidence desk for venue visitors and organizers. Draw a small directed graph, provide the venue's published access page, and inspect the evidence for every connection. A deterministic search distinguishes a supported continuous path from a missing link or blocked proposed route.

## Start locally

Requires Node.js 20.19+ or 22.12+.

```sh
npm ci
npm run dev
```

Open the local URL printed by Vite. Build a portable static site with `npm run build`; publish the contents of `dist/`. Relative asset paths support GitHub Pages repository subpaths. No backend, paid API key or server-held wallet key is needed. The repository includes an optional GitHub Pages Actions workflow.

## Explore the worked example

The landing page opens a fictional Northlight Museum example. Change the scenario to compare an unknown lift exit, a complete route and an explicitly closed route. Findings and quotes in this mode are illustrative and never claimed to be on chain. Exported example files carry `illustrative: true`.

## Use a real contract

1. Open **Your on-chain route**. A National Park Service source URL and a small visitor-center route are prefilled as editable input; no finding is assumed.
2. Enter a deployed StepSpan contract address and choose **Verify source**. The app checks exact source bytes and the protocol identifier. Alternatively connect a browser wallet on Stable Studionet (61999) and use **Deploy bundled contract** once.
3. Connect your wallet. Review the plan JSON and choose a new plan ID. **Validate draft** checks the graph shape.
4. **Seal plan** fixes the input. Use **Recheck** until successful finalization and matching state readback are verified.
5. **Assess source** reads the sealed input and current revision, then requests a full-consensus assessment. It uses the sealed graph even if the draft editor has subsequently changed.
6. Recheck the assessment receipt. The app requires finalized execution, majority agreement, the matching sender/target/call arguments, and matching historical state readback before showing completion.
7. Inspect the segment quotes, full source snapshot and supported/candidate path. Export JSON. Enter any record owner and plan ID to read public state without signing. Enter a historical revision to inspect earlier evidence.

A pending intent and returned transaction hash survive page reload. Recheck performs reads only. If the wallet request fails without a hash, the intent remains blocked until the exact hash is supplied from wallet activity. A rejected wallet signature releases the intent. There is no automatic write retry, redeployment or appeal. Some terminal failures release the pending guard, with the receipt retained for inspection; other incomplete or ambiguous evidence keeps it blocked.

No network deployment or finalized transaction is configured in this package. The protocol and browser tests use simulated network responses. Additional SDK tests exercise real SDK storage and calldata serialization with mocked web/LLM responses. None substitutes for a live network run.

## Source and tests

- `contracts/stepspan.py`: complete canonical contract source bundled into the frontend for deployment and byte verification.
- `src/chain.js`: wallet and GenLayer SDK integration.
- `src/protocol.js`: graph checks, canonical serialization, path computation and receipt guards.
- `contract-tests/`: mocked-host contract protocol tests.
- `tests/`: frontend protocol tests.
- `CONTRACT.md`: consensus, graph semantics, interface and trust boundaries.

```sh
npm test
python3 -m unittest discover -s contract-tests -v
npm run build
```

Browser draft, contract address, owner, plan ID and pending intent are stored locally. Signed inputs and retrieved source become public chain data. Use official published pages and avoid personal information. This tool inspects step-free evidence; check current lift operation and individual access arrangements with the venue before visiting.

MIT licensed.

## Browser and SDK checks

```sh
npx playwright install chromium
npm run test:browser
pip install -r requirements-dev.txt
python sdk-tests/test_sdk.py
genvm-lint check contracts/stepspan.py
```

Browser checks cover example outcomes, JSON downloads, layouts at 320/390/768/1440 pixels, draft persistence, rejected signatures, network mismatch, interrupted wallet requests, reload recovery, majority-agreement guards, failed execution, terminal receipt binding and historical reads. Signed transactions and chain state are simulated in these browser tests. To use an existing Chromium executable, set `STEPSPAN_CHROMIUM_PATH`.

`public/mark.svg` is the native vector project mark. `schema.json` contains the six-method contract ABI. The app preserves incomplete JSON drafts across tab changes and reloads. A failed read cannot replace the last validated record.
