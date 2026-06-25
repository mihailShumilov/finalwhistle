import type { ScoresStatValidation } from "@finalwhistle/shared";
import nacl from "tweetnacl";

/**
 * Minimal TxLINE off-chain API client for the spike: guest auth, subscription activation,
 * and the three-stage stat-validation proof fetch. Uses `fetch` (Node 24 global) only.
 */

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Fetch with bounded retry on transient 5xx / 429 (the devnet edge 503s intermittently). */
async function fetchRetry(
  url: string | URL,
  init: RequestInit,
  label: string,
  attempts = 6,
): Promise<Response> {
  let lastStatus = 0;
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(url, init);
      if (res.ok) return res;
      lastStatus = res.status;
      if (res.status < 500 && res.status !== 429) {
        throw new Error(`${label} failed: ${res.status} ${await res.text()}`);
      }
    } catch (err) {
      if (i === attempts - 1) throw err;
    }
    await sleep(Math.min(1000 * 2 ** i, 8000));
  }
  throw new Error(`${label} failed after ${attempts} attempts (last status ${lastStatus})`);
}

export async function guestAuth(oracleBase: string): Promise<string> {
  const res = await fetchRetry(`${oracleBase}/auth/guest/start`, { method: "POST" }, "guest auth");
  const body = (await res.json()) as { token: string };
  return body.token;
}

/**
 * Activate the subscription: bind the confirmed `txSig`, the selected leagues and the JWT
 * into a message, sign it with the wallet secret key, and exchange it for an API token.
 */
export async function activate(
  oracleBase: string,
  txSig: string,
  leagues: number[],
  jwt: string,
  secretKey: Uint8Array,
): Promise<string> {
  const message = new TextEncoder().encode(`${txSig}:${leagues.join(",")}:${jwt}`);
  const signature = nacl.sign.detached(message, secretKey);
  const walletSignature = Buffer.from(signature).toString("base64");

  const res = await fetchRetry(
    `${oracleBase}/api/token/activate`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${jwt}` },
      body: JSON.stringify({ txSig, walletSignature, leagues }),
    },
    "activate",
  );
  const body = (await res.json()) as { token?: string } | string;
  return typeof body === "string" ? body : (body.token ?? JSON.stringify(body));
}

export interface StatValidationQuery {
  fixtureId: number;
  seq: number;
  statKey: number;
  statKey2?: number;
}

export async function fetchStatValidation(
  apiBase: string,
  jwt: string,
  apiToken: string,
  q: StatValidationQuery,
): Promise<ScoresStatValidation> {
  const url = new URL("/api/scores/stat-validation", apiBase);
  url.searchParams.set("fixtureId", String(q.fixtureId));
  url.searchParams.set("seq", String(q.seq));
  url.searchParams.set("statKey", String(q.statKey));
  if (q.statKey2 !== undefined) url.searchParams.set("statKey2", String(q.statKey2));

  const res = await fetchRetry(
    url,
    { headers: { Authorization: `Bearer ${jwt}`, "X-Api-Token": apiToken } },
    "stat-validation",
  );
  return (await res.json()) as ScoresStatValidation;
}

/** Fetch the historical score-update sequence for a fixture (to discover a valid seq). */
export async function fetchHistorical(
  apiBase: string,
  jwt: string,
  apiToken: string,
  fixtureId: number,
): Promise<unknown[]> {
  const res = await fetch(`${apiBase}/api/scores/historical/${fixtureId}`, {
    headers: { Authorization: `Bearer ${jwt}`, "X-Api-Token": apiToken },
  });
  if (!res.ok) throw new Error(`historical failed: ${res.status} ${await res.text()}`);
  return (await res.json()) as unknown[];
}
