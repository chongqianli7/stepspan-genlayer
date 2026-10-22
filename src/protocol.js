export const canonical = (v) =>
  v === null || typeof v !== "object"
    ? JSON.stringify(v)
    : Array.isArray(v)
      ? "[" + v.map(canonical).join(",") + "]"
      : "{" +
        Object.keys(v)
          .sort()
          .map((k) => JSON.stringify(k) + ":" + canonical(v[k]))
          .join(",") +
        "}";
export async function sha(s) {
  return [
    ...new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)),
    ),
  ]
    .map((x) => x.toString(16).padStart(2, "0"))
    .join("");
}
export const addressOK = (s) => /^0x[0-9a-fA-F]{40}$/.test(s);
export function validate(d) {
  if (
    !d ||
    Object.keys(d).sort().join(",") !== "edges,end,nodes,start,url,venue"
  )
    throw Error("Use venue, url, nodes, edges, start and end");
  if (
    typeof d.venue !== "string" ||
    !d.venue.trim() ||
    d.venue.trim().length > 120
  )
    throw Error("Venue name required");
  if (
    typeof d.url !== "string" ||
    d.url.length > 500 ||
    !/^https:\/\/[A-Za-z][A-Za-z0-9-]*(?:\.[A-Za-z][A-Za-z0-9-]*)+(?::443)?(?:\/[A-Za-z0-9_~:/?&=%+.,!-]*)?$/.test(
      d.url,
    )
  )
    throw Error("Use a public HTTPS source URL");
  if (!Array.isArray(d.nodes) || d.nodes.length < 2 || d.nodes.length > 8)
    throw Error("Use 2–8 nodes");
  d.venue = d.venue.trim();
  const ids = d.nodes.map((n) => {
    if (
      !n ||
      Object.keys(n).sort().join(",") !== "id,label" ||
      !/^[A-Za-z0-9_-]{1,40}$/.test(n.id) ||
      typeof n.label !== "string" ||
      !n.label.trim() ||
      n.label.trim().length > 120
    )
      throw Error("Invalid node");
    n.label = n.label.trim();
    return n.id;
  });
  if (
    new Set(ids).size !== ids.length ||
    !ids.includes(d.start) ||
    !ids.includes(d.end) ||
    d.start === d.end
  )
    throw Error("Invalid start or destination");
  if (!Array.isArray(d.edges) || !d.edges.length || d.edges.length > 12)
    throw Error("Use 1–12 directed edges");
  const pairs = d.edges.map((e, i) => {
    if (
      !e ||
      Object.keys(e).sort().join(",") !== "from,id,to" ||
      e.id !== "E" + (i + 1) ||
      !ids.includes(e.from) ||
      !ids.includes(e.to) ||
      e.from === e.to
    )
      throw Error("Invalid directed edge");
    return e.from + "::" + e.to;
  });
  if (new Set(pairs).size !== pairs.length) throw Error("Duplicate edge");
  if (canonical(d).length > 9000) throw Error("Input too large");
  return d;
}
export function route(d, f) {
  const states = Object.fromEntries(f.edges.map((x) => [x.id, x.state]));
  function path(allowed) {
    const q = [[d.start, []]],
      seen = new Set([d.start]);
    while (q.length) {
      const [n, p] = q.shift();
      if (n === d.end) return p;
      for (const e of d.edges)
        if (e.from === n && !seen.has(e.to) && allowed.includes(states[e.id])) {
          seen.add(e.to);
          q.push([e.to, [...p, e.id]]);
        }
    }
    return [];
  }
  const supported = path(["PASS"]),
    possible = path(["PASS", "UNKNOWN"]),
    structural = path(["PASS", "UNKNOWN", "BLOCKED"]);
  return {
    status: supported.length
      ? "SUPPORTED"
      : possible.length || !structural.length
        ? "UNRESOLVED"
        : "BLOCKED",
    path: supported,
    candidate_path: possible,
    unknown_edges: f.edges
      .filter((x) => x.state === "UNKNOWN")
      .map((x) => x.id),
  };
}
export function statusOf(t) {
  return String(
    t.status_name ||
      t.statusName ||
      { 7: "FINALIZED" }[t.status] ||
      t.status ||
      "UNKNOWN",
  ).toUpperCase();
}
export function finalSuccess(t, consensus = false) {
  try {
    const raw = t.consensus_data?.leader_receipt;
    const rows = (Array.isArray(raw) ? raw : raw ? [raw] : []).filter(
      (x) => String(x.mode || "leader").toLowerCase() === "leader",
    );
    const votes = Object.values(t.consensus_data?.votes || {});
    const success =
      rows.length > 0 &&
      rows.every(
        (x) =>
          String(x.execution_result).toUpperCase() === "SUCCESS" &&
          !x.error &&
          (!x.result ||
            (typeof x.result === "string" &&
              atob(x.result).charCodeAt(0) === 0)),
      );
    return (
      statusOf(t) === "FINALIZED" &&
      success &&
      (!consensus ||
        (votes.length >= 2 &&
          votes.filter((x) => String(x).toUpperCase() === "AGREE").length >
            votes.length / 2))
    );
  } catch {
    return false;
  }
}
export function bindReceipt(p, t, call) {
  if (String(t.from_address || t.from).toLowerCase() !== p.owner.toLowerCase())
    throw Error("Receipt sender mismatch");
  if (
    p.type !== "deploy" &&
    (String(t.to_address || t.to).toLowerCase() !== p.address.toLowerCase() ||
      call.method !== p.type ||
      canonical(call.args) !== canonical(p.args))
  )
    throw Error("Receipt intent mismatch");
}
export function executionFailed(t) {
  const raw = t.consensus_data?.leader_receipt,
    rows = (Array.isArray(raw) ? raw : raw ? [raw] : []).filter(
      (x) => String(x.mode || "leader").toLowerCase() === "leader",
    );
  return (
    rows.length > 0 &&
    rows.every(
      (x) =>
        ["ERROR", "FAILED", "REVERTED"].includes(
          String(x.execution_result).toUpperCase(),
        ) || Boolean(x.error),
    )
  );
}
export async function validateState(state, context, expectedRevision) {
  if (
    !state ||
    !Number.isSafeInteger(state.revision) ||
    state.revision < 0 ||
    state.plan?.protocol !== "stepspan-1"
  )
    throw Error("Invalid plan state");
  const input = validate(structuredClone(state.plan.input));
  if (
    canonical(input) !== canonical(state.plan.input) ||
    (await sha(canonical(input))) !== state.plan.input_sha256
  )
    throw Error("Plan digest mismatch");
  const r = state.review;
  if (expectedRevision !== undefined && expectedRevision > 0 && !r)
    throw Error("Requested review missing");
  if (r) {
    if (
      r.protocol !== "stepspan-1" ||
      r.owner?.toLowerCase() !== context.owner.toLowerCase() ||
      r.plan_id !== context.plan_id ||
      !Number.isSafeInteger(r.revision) ||
      r.revision < 1 ||
      r.revision > state.revision ||
      (expectedRevision !== undefined && r.revision !== expectedRevision) ||
      r.input_sha256 !== state.plan.input_sha256 ||
      typeof r.source !== "string" ||
      (await sha(r.source)) !== r.source_sha256
    )
      throw Error("Review binding mismatch");
    const rows = r.findings?.edges;
    if (!Array.isArray(rows) || rows.length !== input.edges.length)
      throw Error("Incomplete edge evidence");
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      if (
        row.id !== input.edges[i].id ||
        !["PASS", "BLOCKED", "UNKNOWN"].includes(row.state) ||
        typeof row.quote !== "string" ||
        row.quote.length > 300 ||
        (row.quote && !r.source.includes(row.quote)) ||
        (row.state !== "UNKNOWN" && row.quote.trim().length < 8)
      )
        throw Error("Invalid edge evidence");
    }
    if (canonical(route(input, r.findings)) !== canonical(r.route))
      throw Error("Route computation mismatch");
  } else if (state.revision > 0) throw Error("Latest review missing");
  return { ...state, context: { ...context } };
}
