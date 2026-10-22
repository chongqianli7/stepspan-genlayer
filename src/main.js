import "./style.css";
import deployment from "../deployment.json";
import * as chain from "./chain.js";
import {
  example,
  source as exampleSource,
  findings as exampleFindings,
  official,
} from "./example.js";
import {
  canonical,
  sha,
  validate,
  route,
  addressOK,
  statusOf,
  finalSuccess,
  bindReceipt,
  validateState,
  executionFailed,
} from "./protocol.js";
const $ = (s) => document.querySelector(s),
  esc = (x) =>
    String(x ?? "").replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
const key = "stepspan:v1";
let stored;
try {
  stored = JSON.parse(localStorage.getItem(key)) || {};
} catch {
  stored = {};
}
let mode = "example",
  draft = stored.draft || structuredClone(official),
  draftText = stored.draft_text ?? null,
  address = stored.address || deployment.contract_address || "",
  owner = stored.owner || deployment.owner || "",
  id = stored.id || deployment.plan_id || "museum-route",
  pending = stored.pending || null,
  wallet = null,
  verified = "",
  loaded = null,
  receipt = null,
  busy = false,
  scenario = "gap";
function save() {
  localStorage.setItem(
    key,
    JSON.stringify({
      draft,
      draft_text: draftText,
      address,
      owner,
      id,
      pending,
    }),
  );
}
function message(s) {
  $("#message").textContent = s;
}
async function task(fn) {
  if (busy) return;
  busy = true;
  buttons();
  try {
    await fn();
  } catch (e) {
    message(e.shortMessage || e.message || String(e));
  } finally {
    busy = false;
    buttons();
  }
}
function values() {
  address = $("#address").value.trim();
  owner = $("#owner").value.trim().toLowerCase();
  id = $("#plan-id").value.trim();
  if (!/^[A-Za-z0-9_-]{1,40}$/.test(id))
    throw Error("Plan ID: 1–40 letters, digits, hyphens or underscores");
  if (mode === "live") {
    draft = validate(JSON.parse($("#draft").value));
    draftText = JSON.stringify(draft, null, 2);
    save();
  }
}
function resultData() {
  if (mode === "example") {
    const f = structuredClone(exampleFindings);
    if (scenario === "connected")
      f.edges[2] = {
        id: "E3",
        state: "PASS",
        quote: "A level exit connects the North lift directly to Gallery 2.",
      };
    if (scenario === "blocked")
      f.edges[2] = {
        id: "E3",
        state: "BLOCKED",
        quote: "The North lift route to Gallery 2 is closed.",
      };
    return {
      d: example,
      f,
      source:
        exampleSource +
        (scenario === "connected"
          ? " A level exit connects the North lift directly to Gallery 2."
          : scenario === "blocked"
            ? " The North lift route to Gallery 2 is closed."
            : ""),
      route: route(example, f),
    };
  }
  if (loaded?.review)
    return {
      d: loaded.plan.input,
      f: loaded.review.findings,
      source: loaded.review.source,
      route: loaded.review.route,
    };
  return null;
}
function render() {
  $("#app").innerHTML =
    `<div class="shell"><header><a class="brand" href="#"><span class="mark">S↗</span>StepSpan</a><nav><a href="#workspace">Route desk</a><a href="#method">How it works</a><span class="network">● Stable Studionet</span></nav></header><main><section class="hero"><div><p class="eyebrow">VENUE ACCESS / EVIDENCE THAT CONNECTS</p><h1>An accessible entrance.<br><em>But a complete route?</em></h1><p class="intro">A lift is one connection. A visit needs all of them. Check what a venue’s published information actually supports, one segment at a time.</p><a class="primary" href="#workspace">Trace a route <span>↗</span></a> <button id="read-finalized" ${deployment.verified_records.length ? "" : "disabled"}>Read a finalized route ↗</button><p class="small">Source excerpts · Directed routes · GenLayer consensus</p></div><div class="hero-map"><div class="map-grid"></div><div class="map-label">ROUTE STUDY <span>01 / 04</span></div><svg viewBox="0 0 400 270" role="img" aria-label="A route with one missing connection"><path d="M55 210 L55 75 L205 75" class="route-line"/><path d="M205 75 L345 75 L345 210" class="route-gap"/><circle cx="55" cy="210" r="12"/><circle cx="55" cy="75" r="12"/><circle cx="205" cy="75" r="12"/><circle cx="345" cy="210" r="12" class="end"/><text x="78" y="215">Entrance</text><text x="78" y="55">Foyer</text><text x="180" y="48">Lift</text><text x="250" y="245">Gallery</text><text x="270" y="117" class="question">?</text></svg><div class="map-caption"><span class="pill">2 SUPPORTED</span><span class="pill amber">1 CONNECTION UNKNOWN</span></div></div></section><section class="principles"><div><b>01</b><span>Describe the connections<br><small>A directed graph, not a venue rating.</small></span></div><div><b>02</b><span>Inspect the published evidence<br><small>Every positive finding needs a quote.</small></span></div><div><b>03</b><span>Find the missing link<br><small>Unknown stays unknown.</small></span></div></section><section id="workspace"><div class="section-head"><div><p class="eyebrow">THE ROUTE DESK</p><h2>Every connection matters.</h2></div><div class="tabs"><button id="example" class="${mode === "example" ? "active" : ""}">Worked example</button><button id="live" class="${mode === "live" ? "active" : ""}">Your on-chain route</button></div></div><div id="message" role="status" aria-live="polite"></div><div class="workspace"><aside><h3>${mode === "example" ? "Northlight Museum" : "Plan a route"}</h3><p class="small">${mode === "example" ? "Fictional source and findings. No wallet, no chain transaction." : "Use the venue’s official accessibility page. All signed inputs and retrieved text become public."}</p>${mode === "example" ? `<label>Explore a different connection<select id="scenario"><option value="gap">Missing lift → gallery evidence</option><option value="connected">All route segments supported</option><option value="blocked">Lift route explicitly closed</option></select></label><p>Change the evidence and watch the complete route change. The direct stair route stays blocked.</p>` : `<label>Plan ID<input id="plan-id" value="${esc(id)}" maxlength="40"></label><label>Route specification · JSON<textarea id="draft" spellcheck="false" rows="18">${esc(draftText ?? JSON.stringify(draft, null, 2))}</textarea></label><div class="buttons"><button id="validate">Validate draft</button><button id="seal" class="primary">1 · Seal plan</button><button id="assess" class="primary">2 · Assess source</button></div>`}</aside><article><div id="route-result"></div><div id="graph"></div><h3>Segment evidence</h3><div id="edges"></div><details><summary>Inspect the source snapshot</summary><pre id="source"></pre></details><div class="buttons"><button id="export">Export evidence JSON ↓</button></div></article></div></section><section class="settings"><div><p class="eyebrow">PUBLIC RECORDS</p><h2>Read it back.<br>Keep the evidence.</h2><p>Use a deployed StepSpan contract to seal a plan and assess a source. Wallet signatures stay in your wallet.</p><p class="small">Published contract on Stable Studionet · <a href="${chain.explorer}/tx/${esc(deployment.deployment_transaction)}" target="_blank" rel="noopener noreferrer">Inspect deployment ↗</a></p></div><div><label>Contract address<input id="address" value="${esc(address)}" placeholder="0x…"></label><label>Record owner<input id="owner" value="${esc(owner)}" placeholder="0x…"></label>${mode === "example" ? `<label>Plan ID<input id="plan-id" value="${esc(id)}"></label>` : ""}<div class="buttons"><button id="connect">Connect wallet</button><button id="verify">Verify source</button><button id="read">Read latest</button></div><label>Historical revision · blank for latest<input id="revision" type="number" min="1" placeholder="Latest"></label><div class="buttons"><button id="history">Read revision</button></div><p id="wallet-status" class="small">${wallet ? esc(wallet.owner) : "Wallet disconnected"}</p><details><summary>Deploy bundled contract</summary><p>Requests one deployment on Stable Studionet (61999). The app verifies the deployed source before any plan write.</p><button id="deploy">Deploy once</button></details><div id="pending"></div><details><summary>Transaction receipt</summary><pre id="receipt">${esc(receipt ? JSON.stringify(receipt, null, 2) : "No receipt loaded.")}</pre></details></div></section><section id="method"><p class="eyebrow">THE METHOD</p><h2>Evidence first. Connections second.</h2><div class="method-grid"><div><h3>A statement needs context.</h3><p>Independent validators retrieve the source and classify each directed connection. Their edge decisions must agree; an exact quote supports every PASS or BLOCKED finding.</p></div><div><h3>A route needs continuity.</h3><p>The contract searches only PASS edges for a supported path. It reports UNRESOLVED when a possible path contains unknowns. BLOCKED refers only to the submitted graph.</p></div><div><h3>A snapshot has limits.</h3><p>Step-free evidence does not certify wheelchair dimensions, gradients, assistance, or current lift operation. Check current arrangements with the venue before a visit.</p></div></div></section></main><footer><span class="brand">StepSpan <small>THE CONNECTION IS THE POINT.</small></span><span>Built on GenLayer · Source snapshots, not live navigation</span></footer></div>`;
  if ($("#draft"))
    $("#draft").oninput = () => {
      draftText = $("#draft").value;
      save();
    };
  $("#plan-id").oninput = () => {
    id = $("#plan-id").value;
    save();
  };
  for (const selector of ["#address", "#owner"])
    $(selector).oninput = () => {
      address = $("#address").value.trim();
      owner = $("#owner").value.trim().toLowerCase();
      save();
    };
  $("#example").onclick = () => {
    mode = "example";
    render();
  };
  $("#live").onclick = () => {
    mode = "live";
    render();
  };
  if ($("#scenario")) {
    $("#scenario").value = scenario;
    $("#scenario").onchange = (e) => {
      scenario = e.target.value;
      results();
    };
  }
  if ($("#validate"))
    $("#validate").onclick = () =>
      task(async () => {
        values();
        message("Route schema valid. Seal it to fix these inputs on chain.");
      });
  if ($("#seal")) $("#seal").onclick = () => task(() => send("seal"));
  if ($("#assess")) $("#assess").onclick = () => task(() => send("assess"));
  $("#connect").onclick = () =>
    task(async () => {
      wallet = await chain.connect();
      owner = wallet.owner;
      save();
      $("#owner").value = owner;
      $("#wallet-status").textContent = owner;
      message("Wallet connected on Stable Studionet.");
    });
  $("#verify").onclick = () =>
    task(async () => {
      values();
      verified = await chain.verify(address);
      message("Deployed source matches the complete bundled contract.");
    });
  $("#read").onclick = () => task(() => readState());
  $("#read-finalized").onclick = () => task(async () => {
    address = deployment.contract_address;
    owner = deployment.owner;
    id = deployment.plan_id;
    mode = "live";
    render();
    await readState(deployment.verified_records[0].revision);
    document.querySelector("#workspace").scrollIntoView({behavior:"smooth"});
  });
  $("#history").onclick = () =>
    task(() => readState(Number($("#revision").value)));
  $("#deploy").onclick = () => task(deploy);
  $("#export").onclick = exportJSON;
  results();
  pendingUI();
  buttons();
}
function results() {
  const r = resultData();
  if (!r) {
    $("#route-result").innerHTML =
      '<p class="empty">No chain record loaded. Connect a contract to read a sealed plan, then assess its source.</p>';
    $("#graph").innerHTML = "";
    $("#edges").innerHTML = "";
    $("#source").textContent = "";
    return;
  }
  const names = Object.fromEntries(r.d.nodes.map((n) => [n.id, n.label]));
  $("#route-result").innerHTML =
    `<div class="result ${r.route.status.toLowerCase()}"><p class="eyebrow">${mode === "example" ? "ILLUSTRATIVE EXAMPLE" : "ON-CHAIN SNAPSHOT · REVISION " + loaded.review.revision}</p><div class="small">${esc(r.d.venue)}${mode === "live" ? " · " + esc(loaded.context?.plan_id || "") : ""}</div><h2>${{ SUPPORTED: "A connected route is supported.", UNRESOLVED: "One missing link is enough.", BLOCKED: "The proposed routes are blocked." }[r.route.status]}</h2><p>${r.route.path.length ? "Supported path: " + esc(r.route.path.join(" → ")) : r.route.candidate_path.length ? "Candidate path needs more evidence: " + esc(r.route.candidate_path.join(" → ")) : "No supported path in the submitted graph."}</p></div>`;
  $("#graph").innerHTML =
    '<div class="nodes">' +
    r.d.nodes
      .map(
        (n, i) =>
          `<div><span>${String(i + 1).padStart(2, "0")}</span><b>${esc(n.label)}</b></div>`,
      )
      .join("") +
    "</div>";
  $("#edges").innerHTML = r.d.edges
    .map((e) => {
      const f = r.f.edges.find((x) => x.id === e.id);
      return `<div class="edge"><div><b>${esc(e.id)} · ${esc(names[e.from])} → ${esc(names[e.to])}</b><span class="pill ${f.state === "UNKNOWN" ? "amber" : f.state === "BLOCKED" ? "blocked" : ""}">${esc(f.state)}</span></div><blockquote>${f.quote ? "“" + esc(f.quote) + "”" : "No explicit evidence for this connection. Ask the venue."}</blockquote></div>`;
    })
    .join("");
  $("#source").textContent = r.source;
}
function buttons() {
  for (const s of [
    "#connect",
    "#verify",
    "#read",
    "#read-finalized",
    "#history",
    "#deploy",
    "#seal",
    "#assess",
    "#validate",
  ])
    if ($(s))
      $(s).disabled =
        busy || (s === "#read-finalized" && !deployment.verified_records.length) || (["#deploy", "#seal", "#assess"].includes(s) && !!pending);
}
async function readState(revision) {
  values();
  await chain.verify(address);
  if (
    revision !== undefined &&
    (!Number.isSafeInteger(revision) || revision < 1)
  )
    throw Error("Choose a positive revision");
  const context = { address, owner, plan_id: id };
  const state = await chain.read(address, owner, id, revision);
  const valid = await validateState(state, context, revision ?? state.revision);
  loaded = valid;
  receipt = null;
  draft = loaded.plan.input;
  draftText = null;
  mode = "live";
  save();
  render();
  message("Read finalized contract state. Latest revision: " + loaded.revision);
}
async function deploy() {
  if (pending) throw Error("Resolve the pending transaction first");
  await chain.check(wallet);
  pending = {
    type: "deploy",
    owner: wallet.owner,
    created: new Date().toISOString(),
  };
  save();
  try {
    pending.hash = await wallet.client.deployContract({
      code: chain.source,
      args: [],
      leaderOnly: false,
    });
    save();
  } catch (e) {
    if (e.code === 4001 || e.cause?.code === 4001) pending = null;
    save();
    throw e;
  } finally {
    pendingUI();
  }
  message("Deployment submitted. Recheck finality before any further write.");
}
async function send(type) {
  if (mode !== "live") throw Error("Open your on-chain route");
  if (pending) throw Error("Resolve pending transaction first");
  values();
  await chain.check(wallet);
  verified = await chain.verify(address);
  await chain.check(wallet);
  const state =
    type === "assess" ? await chain.read(address, wallet.owner, id) : null;
  if (state)
    await validateState(
      state,
      { address, owner: wallet.owner, plan_id: id },
      state.revision,
    );
  await chain.check(wallet);
  const input = state ? state.plan.input : draft;
  const args = type === "seal" ? [id, canonical(input)] : [id, state.revision];
  pending = {
    type,
    address,
    owner: wallet.owner,
    id,
    args,
    input_sha256: await sha(canonical(input)),
    revision: state?.revision || 0,
    created: new Date().toISOString(),
  };
  save();
  try {
    pending.hash = await wallet.client.writeContract({
      address,
      functionName: type,
      args,
      value: 0n,
      leaderOnly: false,
    });
    save();
  } catch (e) {
    if (e.code === 4001 || e.cause?.code === 4001) pending = null;
    save();
    throw e;
  } finally {
    pendingUI();
  }
  message(
    "Submitted once. Use Recheck to inspect finality and read the signed record.",
  );
}
function pendingUI() {
  if (!pending) {
    $("#pending").innerHTML = "";
    return;
  }
  $("#pending").innerHTML =
    `<div class="pending"><b>${esc(pending.type)} · awaiting verification</b><p class="hash">${esc(pending.hash || "No hash returned. Inspect wallet activity before another write.")}</p>${pending.hash ? '<button id="recheck">Recheck · read only</button>' : '<button id="attach">Attach wallet transaction hash</button>'}${pending.hash ? ` <a href="${chain.explorer}/tx/${esc(pending.hash)}" target="_blank" rel="noopener noreferrer">Explorer ↗</a>` : ""}</div>`;
  if ($("#recheck")) $("#recheck").onclick = () => task(recheck);
  if ($("#attach"))
    $("#attach").onclick = () => {
      const h = prompt(
        "Exact hash from wallet activity; no transaction will be sent.",
      );
      if (/^0x[0-9a-fA-F]{64}$/.test(h || "")) {
        pending.hash = h;
        save();
        pendingUI();
      } else message("A 32-byte transaction hash is required.");
    };
}
async function recheck() {
  const p = structuredClone(pending);
  receipt = await chain.transaction(p.hash);
  $("#receipt").textContent = JSON.stringify(receipt, null, 2);
  if (!receipt) throw Error("Receipt not available yet. Recheck later.");
  const status = statusOf(receipt);
  if (
    [
      "CANCELED",
      "UNDETERMINED",
      "LEADER_TIMEOUT",
      "VALIDATORS_TIMEOUT",
    ].includes(status)
  ) {
    bindReceipt(
      p,
      receipt,
      p.type === "deploy" ? null : chain.receiptCall(receipt),
    );
    pending = null;
    save();
    pendingUI();
    throw Error(
      "Transaction ended: " +
        status +
        ". Inspect receipt before another write.",
    );
  }
  if (status !== "FINALIZED")
    throw Error("Current status: " + status + ". No write resent.");
  bindReceipt(
    p,
    receipt,
    p.type === "deploy" ? null : chain.receiptCall(receipt),
  );
  if (executionFailed(receipt)) {
    pending = null;
    save();
    pendingUI();
    throw Error(
      "Transaction finalized with failed execution. Receipt retained; inspect it before signing again.",
    );
  }
  if (!finalSuccess(receipt, p.type === "assess"))
    throw Error(
      "Finalized receipt does not establish successful execution" +
        (p.type === "assess" ? " and majority agreement" : "") +
        ". Pending retained for inspection.",
    );
  if (p.type === "deploy") {
    const a = receipt.contract_address || receipt.data?.contract_address;
    await chain.verify(a);
    address = a;
    pending = null;
    save();
    render();
    message("Deployment finalized; bundled source verified.");
    return;
  }
  await chain.verify(p.address);
  const state = await chain.read(
    p.address,
    p.owner,
    p.id,
    p.type === "assess" ? p.revision + 1 : undefined,
  );
  if (state.plan.input_sha256 !== p.input_sha256)
    throw Error("Signed plan readback mismatch");
  loaded = await validateState(
    state,
    { address: p.address, owner: p.owner, plan_id: p.id },
    p.type === "assess" ? p.revision + 1 : state.revision,
  );
  address = p.address;
  owner = p.owner;
  id = p.id;
  draft = state.plan.input;
  draftText = null;
  mode = "live";
  pending = null;
  save();
  render();
  message("Finalized transaction and matching state readback verified.");
}
function exportJSON() {
  const r = resultData();
  if (!r) {
    message("Load a review first.");
    return;
  }
  const output =
    mode === "example"
      ? {
          illustrative: true,
          plan: r.d,
          source: r.source,
          findings: r.f,
          route: r.route,
        }
      : { illustrative: false, ...loaded.context, ...loaded, receipt };
  const blob = new Blob([JSON.stringify(output, null, 2)], {
      type: "application/json",
    }),
    u = URL.createObjectURL(blob),
    a = document.createElement("a");
  a.href = u;
  a.download =
    mode === "example" ? "stepspan-illustrative.json" : "stepspan-record.json";
  a.click();
  setTimeout(() => URL.revokeObjectURL(u), 5000);
}
window.ethereum?.on?.("accountsChanged", () => {
  wallet = null;
  verified = "";
  message("Wallet account changed. Reconnect before signing.");
});
window.ethereum?.on?.("chainChanged", () => {
  wallet = null;
  verified = "";
  message("Network changed. Reconnect on Stable Studionet.");
});
render();
