import { abi, createClient } from "genlayer-js";
import { studionet } from "genlayer-js/chains";
import source from "../contracts/stepspan.py?raw";
import { sha, addressOK } from "./protocol.js";
export { source };
export const reader = createClient({ chain: studionet });
export const explorer = "https://explorer-studio.genlayer.com";
export async function verify(address) {
  if (!addressOK(address)) throw Error("Enter a contract address");
  if (
    (await sha(await reader.getContractCode(address))) !== (await sha(source))
  )
    throw Error("Contract source does not match this app");
  if (
    (await reader.readContract({
      address,
      functionName: "get_protocol",
      args: [],
      transactionHashVariant: "latest-final",
    })) !== "stepspan-1"
  )
    throw Error("Wrong protocol");
  return address.toLowerCase();
}
export async function connect() {
  const provider =
    window.ethereum || window.okxwallet?.ethereum || window.okxwallet;
  if (!provider?.request) throw Error("Install a browser wallet");
  const accounts = await provider.request({ method: "eth_requestAccounts" });
  if (!accounts?.length) throw Error("No wallet selected");
  const wallet = {
    owner: accounts[0].toLowerCase(),
    provider,
    client: createClient({ chain: studionet, account: accounts[0], provider }),
  };
  await check(wallet);
  return wallet;
}
export async function check(w) {
  if (!w) throw Error("Connect wallet first");
  const [a, c] = await Promise.all([
    w.provider.request({ method: "eth_accounts" }),
    w.provider.request({ method: "eth_chainId" }),
  ]);
  if (a[0]?.toLowerCase() !== w.owner || Number(c) !== 61999)
    throw Error("Reconnect wallet on Stable Studionet (61999)");
}
export async function read(address, owner, id, revision) {
  if (!addressOK(address) || !addressOK(owner) || !id)
    throw Error("Contract, owner and plan ID required");
  const opts = { address, transactionHashVariant: "latest-final" };
  const raw = await reader.readContract({
    ...opts,
    functionName: "get_plan",
    args: [owner, id],
  });
  if (!raw) throw Error("Plan not found");
  const plan = JSON.parse(raw),
    latest = Number(
      await reader.readContract({
        ...opts,
        functionName: "get_revision",
        args: [owner, id],
      }),
    );
  const n = revision ?? latest;
  const review = n
    ? JSON.parse(
        await reader.readContract({
          ...opts,
          functionName: "get_review",
          args: [owner, id, n],
        }),
      )
    : null;
  return { plan, review, revision: latest };
}
export async function transaction(hash) {
  if (!/^0x[0-9a-fA-F]{64}$/.test(hash))
    throw Error("Invalid transaction hash");
  return reader.request({ method: "eth_getTransactionByHash", params: [hash] });
}
export function receiptCall(t) {
  const raw = t.data?.calldata;
  if (typeof raw !== "string") throw Error("Receipt calldata unavailable");
  const c = abi.calldata.decode(
    Uint8Array.from(atob(raw), (x) => x.charCodeAt(0)),
  );
  if (!(c instanceof Map)) throw Error("Invalid calldata");
  return {
    method: c.get("method"),
    args: (c.get("args") || []).map((x) =>
      typeof x === "bigint" ? Number(x) : x,
    ),
  };
}
