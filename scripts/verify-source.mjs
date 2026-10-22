import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
const root = new URL("../", import.meta.url),
  m = JSON.parse(readFileSync(new URL("source-integrity.json", root), "utf8"));
const actual = createHash("sha256")
  .update(readFileSync(new URL(m.contract_file, root)))
  .digest("hex");
if (actual !== m.sha256) throw Error("Bundled source integrity mismatch");
console.log("Bundled contract SHA-256 verified:", actual);
