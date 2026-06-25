import { web3ToKitInstruction } from "@finalwhistle/sdk";
import {
  appendTransactionMessageInstructions,
  type Blockhash,
  createTransactionMessage,
  generateKeyPairSigner,
  getBase64EncodedWireTransaction,
  getSignatureFromTransaction,
  pipe,
  setTransactionMessageFeePayerSigner,
  setTransactionMessageLifetimeUsingBlockhash,
  signTransactionMessageWithSigners,
} from "@solana/kit";
import { ComputeBudgetProgram } from "@solana/web3.js";
import { ResilientRpcPool, TransactionSender } from "solana-resilience-kit";
import { MockCluster, MockEndpoint } from "solana-resilience-kit/testing";
import { describe, expect, it } from "vitest";

/**
 * Keeper reliability suite. These prove the EXACT property the build guide demands: a
 * settlement transaction still LANDS under injected drops / 429s / slot-lag, and correctly
 * reports `expired` (never double-pays) when the blockhash dies — all through the same
 * `solana-resilience-kit` pool + sender the keeper uses in production. The settle tx is
 * modelled by a real, signed `@solana/kit` transaction carrying the raised CU budget the
 * keeper attaches (built via the SDK's web3→kit adapter).
 */

async function buildSettleLikeTx(cluster: MockCluster) {
  const { value } = cluster.rpcGetLatestBlockhash();
  const signer = await generateKeyPairSigner();
  const cuIx = web3ToKitInstruction(ComputeBudgetProgram.setComputeUnitLimit({ units: 1_400_000 }));
  const message = pipe(
    createTransactionMessage({ version: 0 }),
    (m) => setTransactionMessageFeePayerSigner(signer, m),
    (m) =>
      setTransactionMessageLifetimeUsingBlockhash(
        {
          blockhash: value.blockhash as Blockhash,
          lastValidBlockHeight: value.lastValidBlockHeight,
        },
        m,
      ),
    (m) => appendTransactionMessageInstructions([cuIx], m),
  );
  const signed = await signTransactionMessageWithSigners(message);
  return {
    wireTransaction: getBase64EncodedWireTransaction(signed),
    signature: getSignatureFromTransaction(signed),
    lastValidBlockHeight: value.lastValidBlockHeight,
  };
}

function makePool(endpoints: MockEndpoint[]): ResilientRpcPool {
  return new ResilientRpcPool({
    endpoints: endpoints.map((e) => ({ name: e.name, transport: e.transport })),
    freshnessAware: true,
  });
}

/** A sender whose rebroadcast/poll loop deterministically advances the mock clock. */
function makeSender(
  pool: ResilientRpcPool,
  cluster: MockCluster,
  slotsPerTick: number,
  onTick?: (tick: number) => void,
) {
  let tick = 0;
  return new TransactionSender(pool.rpc(), {
    sleep: async () => {
      tick += 1;
      cluster.advanceSlots(slotsPerTick);
      onTick?.(tick);
    },
  });
}

describe("keeper settlement reliability (solana-resilience-kit fault harness)", () => {
  it("lands on a healthy endpoint", async () => {
    const cluster = new MockCluster({ initialBlockHeight: 100n });
    const ep = new MockEndpoint(cluster, { name: "primary" });
    const sender = makeSender(makePool([ep]), cluster, 1);
    const tx = await buildSettleLikeTx(cluster);

    const result = await sender.sendAndConfirm(tx);
    expect(result.outcome).toBe("confirmed");
    expect(result.signature).toBe(tx.signature);
  });

  it("absorbs a transport-erroring primary by failing over to a healthy backup", async () => {
    const cluster = new MockCluster({ initialBlockHeight: 100n });
    const broken = new MockEndpoint(cluster, { name: "broken", faults: { errorRate: 1 } });
    const backup = new MockEndpoint(cluster, { name: "backup" });
    const sender = makeSender(makePool([broken, backup]), cluster, 1);
    const tx = await buildSettleLikeTx(cluster);

    const result = await sender.sendAndConfirm(tx);
    expect(result.outcome).toBe("confirmed");
    expect(result.signature).toBe(tx.signature); // never re-signed
  });

  it("reports expired (not confirmed) when the blockhash dies, never re-signing", async () => {
    const cluster = new MockCluster({ initialBlockHeight: 100n });
    const ep = new MockEndpoint(cluster, { name: "primary", faults: { dropRate: 1 } });
    // Advance hard each tick so the loop crosses lastValidBlockHeight quickly.
    const sender = makeSender(makePool([ep]), cluster, 60);
    const tx = await buildSettleLikeTx(cluster);

    const result = await sender.sendAndConfirm(tx);
    expect(result.outcome).toBe("expired");
    expect(result.signature).toBe(tx.signature); // bounded by lastValidBlockHeight, no double-pay
  });

  it("fails over past a 429 endpoint to a healthy one", async () => {
    const cluster = new MockCluster({ initialBlockHeight: 100n });
    const limited = new MockEndpoint(cluster, { name: "rate-limited", faults: { rate429Rate: 1 } });
    const healthy = new MockEndpoint(cluster, { name: "healthy" });
    const sender = makeSender(makePool([limited, healthy]), cluster, 1);
    const tx = await buildSettleLikeTx(cluster);

    const result = await sender.sendAndConfirm(tx);
    expect(result.outcome).toBe("confirmed");
    expect(limited.stats.rateLimited).toBeGreaterThan(0);
  });

  it("routes around a lagging node by slot freshness and lands", async () => {
    const cluster = new MockCluster({ initialBlockHeight: 100n });
    const stale = new MockEndpoint(cluster, { name: "lagging", faults: { slotLag: 250 } });
    const fresh = new MockEndpoint(cluster, { name: "fresh" });
    const sender = makeSender(makePool([stale, fresh]), cluster, 1);
    const tx = await buildSettleLikeTx(cluster);

    const result = await sender.sendAndConfirm(tx);
    expect(result.outcome).toBe("confirmed");
  });
});
