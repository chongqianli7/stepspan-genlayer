/* Browser integration tests. Chain responses and wallet signatures are simulated. */
const { chromium } = require("playwright");
const { createServer } = require("vite");
const path = require("node:path");
const fs = require("node:fs/promises");
const assert = require("node:assert/strict");
const root = path.resolve(__dirname, "..");
const owner = "0x" + "1".repeat(40),
  address = "0x" + "2".repeat(40),
  hash = "0x" + "a".repeat(64);
const mock = `
import {official} from '/src/example.js';
import {canonical,sha,route} from '/src/protocol.js';
export const explorer='https://explorer-studio.genlayer.com',source='simulated browser fixture';
const owner='${owner}',address='${address}',hash='${hash}';
const q=()=>window.__qa;
export async function verify(a){if(!/^0x[0-9a-fA-F]{40}$/.test(a))throw Error('Enter a contract address');return a.toLowerCase();}
export async function check(w){if(!w)throw Error('Connect wallet first');if(q().network!==61999)throw Error('Reconnect wallet on Stable Studionet (61999)');}
export async function connect(){const w={owner,client:{writeContract:write,deployContract:async()=>{q().writes++;return hash;}}};await check(w);return w;}
async function write(intent){q().writes++;localStorage.setItem('qa:writes',String(Number(localStorage.getItem('qa:writes')||0)+1));if(q().writeError==='reject')throw Object.assign(Error('Wallet signature rejected'),{code:4001});if(q().writeError==='uncertain')throw Error('Wallet transport interrupted');return hash;}
export async function read(a,o,id,revision){const d=structuredClone(official),input_sha256=await sha(canonical(d));const latest=q().latest;const n=revision??latest;const source='The Riverside Drive sidewalk north of the overlook pavilion connects to the visitor center entrance via a step-free ramp. Published venue access information.';const findings={edges:[{id:'E1',state:'PASS',quote:'The Riverside Drive sidewalk north of the overlook pavilion connects to the visitor center entrance via a step-free ramp.'}]};const review=n?{protocol:'stepspan-1',owner:o,plan_id:id,revision:n,input_sha256,source,source_sha256:await sha(source),findings,route:route(d,findings)}:null;if(q().corrupt&&review)review.owner='0x'+'3'.repeat(40);return {plan:{protocol:'stepspan-1',input:d,input_sha256},review,revision:latest};}
export async function transaction(h){const p=JSON.parse(localStorage.getItem('stepspan:v1')).pending;return {status_name:q().status,from:q().wrongSender?'0x'+'3'.repeat(40):p.owner,to:p.address,contract_address:address,call:{method:p.type,args:p.args},consensus_data:{leader_receipt:[{execution_result:q().failed?'ERROR':'SUCCESS'}],votes:q().noVotes?{}:{a:'AGREE',b:'AGREE',c:'DISAGREE'}}};}
export function receiptCall(t){return t.call;}
`;
(async () => {
  const server = await createServer({
    root,
    server: { host: "127.0.0.1", port: 0 },
  });
  await server.listen();
  const url = "http://127.0.0.1:" + server.httpServer.address().port;
  const custom = process.env.STEPSPAN_CHROMIUM_PATH;
  const launchOptions = {
    headless: true,
    ...(custom
      ? {
          executablePath: custom,
          args: [
            "--no-sandbox",
            "--disable-dev-shm-usage",
            "--disable-gpu",
            "--no-zygote",
            "--single-process",
          ],
        }
      : {}),
  };
  let passed = 0;
  async function check(name, fn, { mocked = false, width = 1440 } = {}) {
    const browser = await chromium.launch(launchOptions);
    const context = await browser.newContext({
      viewport: { width, height: 1000 },
      acceptDownloads: true,
    });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    if (mocked) {
      await page.addInitScript(() => {
        window.__qa = {
          writes: 0,
          writeError: "",
          network: 61999,
          status: "ACCEPTED",
          latest: 0,
        };
      });
      await page.route("**/src/chain.js", (r) =>
        r.fulfill({ contentType: "application/javascript", body: mock }),
      );
    }
    try {
      await page.goto(url);
      await page.locator("#scenario").waitFor();
      await fn(page);
      assert.deepEqual(errors, []);
      console.log("PASS", name);
      passed++;
    } finally {
      await browser.close();
    }
  }
  async function live(p) {
    await p.click("#live");
    await p.fill("#address", address);
    await p.click("#connect");
    await p.waitForFunction(() =>
      document.querySelector("#wallet-status").textContent.startsWith("0x"),
    );
  }
  try {
    await check("all three example outcomes", async (p) => {
      for (const [value, text] of [
        ["connected", "A connected route is supported."],
        ["blocked", "The proposed routes are blocked."],
        ["gap", "One missing link is enough."],
      ]) {
        await p.selectOption("#scenario", value);
        await p.getByText(text).waitFor();
      }
    });
    await check(
      "example JSON download is explicitly illustrative",
      async (p) => {
        const event = p.waitForEvent("download");
        await p.click("#export");
        const download = await event;
        const data = JSON.parse(
          await fs.readFile(await download.path(), "utf8"),
        );
        assert.equal(data.illustrative, true);
        assert.equal(data.route.status, "UNRESOLVED");
      },
    );
    for (const width of [320, 390, 768, 1440])
      await check(
        "no horizontal overflow at " + width,
        async (p) => {
          assert.equal(
            await p.evaluate(
              () => document.documentElement.scrollWidth > innerWidth,
            ),
            false,
          );
          await p.click("#live");
          assert.equal(
            await p.evaluate(
              () => document.documentElement.scrollWidth > innerWidth,
            ),
            false,
          );
        },
        { width },
      );
    await check("no-wallet state gives actionable message", async (p) => {
      await p.click("#connect");
      await p.getByText("Install a browser wallet", { exact: true }).waitFor();
    });
    await check(
      "draft validation handles invalid JSON and saves valid draft",
      async (p) => {
        await p.click("#live");
        const draft = await p.inputValue("#draft");
        await p.fill("#draft", "{");
        await p.click("#validate");
        await p.waitForFunction(
          () => document.querySelector("#message").textContent.length > 0,
        );
        await p.fill("#draft", draft);
        await p.click("#validate");
        await p.getByText("Route schema valid.", { exact: false }).waitFor();
        assert.ok(
          await p.evaluate(
            () => JSON.parse(localStorage.getItem("stepspan:v1")).draft,
          ),
        );
      },
    );
    await check(
      "unfinished JSON draft survives tab switch and reload",
      async (p) => {
        await p.click("#live");
        await p.fill("#draft", "{ unfinished");
        await p.fill("#plan-id", "my-route");
        await p.click("#example");
        await p.click("#live");
        assert.equal(await p.inputValue("#draft"), "{ unfinished");
        await p.reload();
        await p.click("#live");
        assert.equal(await p.inputValue("#draft"), "{ unfinished");
        assert.equal(await p.inputValue("#plan-id"), "my-route");
      },
    );
    await check(
      "wallet rejection releases pending guard",
      async (p) => {
        await live(p);
        await p.evaluate(() => (window.__qa.writeError = "reject"));
        await p.click("#seal");
        await p
          .getByText("Wallet signature rejected", { exact: true })
          .waitFor();
        assert.equal(await p.isDisabled("#seal"), false);
        assert.equal(
          await p.evaluate(
            () => JSON.parse(localStorage.getItem("stepspan:v1")).pending,
          ),
          null,
        );
      },
      { mocked: true },
    );
    await check(
      "network mismatch prevents signing",
      async (p) => {
        await live(p);
        await p.evaluate(() => (window.__qa.network = 1));
        await p.click("#seal");
        await p
          .getByText("Reconnect wallet on Stable Studionet (61999)", {
            exact: true,
          })
          .waitFor();
        assert.equal(await p.evaluate(() => window.__qa.writes), 0);
      },
      { mocked: true },
    );
    await check(
      "uncertain signature stays blocked across reload",
      async (p) => {
        await live(p);
        await p.evaluate(() => (window.__qa.writeError = "uncertain"));
        await p.click("#seal");
        await p
          .getByText("Wallet transport interrupted", { exact: true })
          .waitFor();
        assert.equal(await p.isDisabled("#seal"), true);
        await p.reload();
        await p.click("#live");
        assert.equal(await p.isDisabled("#seal"), true);
        assert.equal(
          await p.evaluate(
            () => JSON.parse(localStorage.getItem("stepspan:v1")).pending.hash,
          ),
          undefined,
        );
      },
      { mocked: true },
    );
    await check(
      "seal recheck survives reload without resend",
      async (p) => {
        await live(p);
        await p.click("#seal");
        await p.locator("#recheck").waitFor();
        await p.reload();
        await p.click("#recheck");
        await p
          .getByText("Current status: ACCEPTED. No write resent.", {
            exact: true,
          })
          .waitFor();
        await p.evaluate(() => (window.__qa.status = "FINALIZED"));
        await p.click("#recheck");
        await p
          .getByText(
            "Finalized transaction and matching state readback verified.",
            { exact: true },
          )
          .waitFor();
        assert.equal(
          await p.evaluate(() => localStorage.getItem("qa:writes")),
          "1",
        );
        assert.equal(await p.isDisabled("#seal"), false);
      },
      { mocked: true },
    );
    await check(
      "assessment requires votes and verifies readback",
      async (p) => {
        await live(p);
        await p.click("#assess");
        await p.locator("#recheck").waitFor();
        await p.evaluate(() => {
          window.__qa.status = "FINALIZED";
          window.__qa.latest = 1;
          window.__qa.noVotes = true;
        });
        await p.click("#recheck");
        await p
          .getByText("Finalized receipt does not establish", { exact: false })
          .waitFor();
        assert.equal(await p.isDisabled("#assess"), true);
        await p.evaluate(() => (window.__qa.noVotes = false));
        await p.click("#recheck");
        await p.getByText("A connected route is supported.").waitFor();
        assert.equal(
          await p.evaluate(
            () => JSON.parse(localStorage.getItem("stepspan:v1")).pending,
          ),
          null,
        );
        const event = p.waitForEvent("download");
        await p.click("#export");
        const data = JSON.parse(
          await fs.readFile(await (await event).path(), "utf8"),
        );
        assert.equal(data.illustrative, false);
        assert.equal(data.review.revision, 1);
      },
      { mocked: true },
    );
    await check(
      "wrong terminal receipt cannot release pending intent",
      async (p) => {
        await live(p);
        await p.click("#seal");
        await p.locator("#recheck").waitFor();
        await p.evaluate(() => {
          window.__qa.status = "CANCELED";
          window.__qa.wrongSender = true;
        });
        await p.click("#recheck");
        await p.getByText("Receipt sender mismatch", { exact: true }).waitFor();
        assert.equal(await p.isDisabled("#seal"), true);
      },
      { mocked: true },
    );
    await check(
      "finalized execution failure is reported without success",
      async (p) => {
        await live(p);
        await p.click("#seal");
        await p.locator("#recheck").waitFor();
        await p.evaluate(() => {
          window.__qa.status = "FINALIZED";
          window.__qa.failed = true;
        });
        await p.click("#recheck");
        await p
          .getByText("Transaction finalized with failed execution.", {
            exact: false,
          })
          .waitFor();
        assert.equal(await p.isDisabled("#seal"), false);
      },
      { mocked: true },
    );
    await check(
      "historical read and corruption rejection",
      async (p) => {
        await live(p);
        await p.evaluate(() => (window.__qa.latest = 2));
        await p.fill("#revision", "1");
        await p.click("#history");
        await p
          .getByText("ON-CHAIN SNAPSHOT · REVISION 1", { exact: true })
          .waitFor();
        await p.evaluate(() => (window.__qa.corrupt = true));
        await p.click("#read");
        await p.getByText("Review binding mismatch", { exact: true }).waitFor();
        await p.click("#example");
        await p.click("#live");
        await p
          .getByText("ON-CHAIN SNAPSHOT · REVISION 1", { exact: true })
          .waitFor();
      },
      { mocked: true },
    );
    await check("published example reads without a wallet", async p=>{
      await p.evaluate(()=>window.__qa.latest=1);
      await p.click("#read-finalized");
      await p.getByText("A connected route is supported.").waitFor();
      assert.equal(await p.evaluate(()=>window.__qa.writes),0);
    }, {mocked:true});
    console.log("Browser checks:", passed, "passed");
  } finally {
    await server.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
