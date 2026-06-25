import { createDefaultRpcTransport } from "@solana/kit";
import {
  CreditRateLimiter,
  HealthMonitor,
  InMemoryMetrics,
  LifecycleEmitter,
  type Metrics,
  ResilientRpcPool,
} from "solana-resilience-kit";

export interface RpcPoolConfig {
  /** RPC endpoint URLs, primary first. At least one; two or more enables failover. */
  endpoints: string[];
  /** Optional metrics sink (defaults to in-memory). */
  metrics?: Metrics;
  /** Optional shared lifecycle emitter for `connection:*` events. */
  events?: LifecycleEmitter;
  maxSlotLag?: bigint;
}

/**
 * The project's ONLY RPC: a `solana-resilience-kit` ResilientRpcPool with freshness-aware
 * routing, health monitoring and credit rate-limiting. `pool.rpc()` returns a normal
 * `@solana/kit` RPC, so callers use it like any kit RPC while failover happens underneath.
 * No FinalWhistle code constructs a raw kit RPC directly.
 */
export function createRpcPool(config: RpcPoolConfig): ResilientRpcPool {
  const names = config.endpoints.map((_, i) => (i === 0 ? "primary" : `backup-${i}`));
  return new ResilientRpcPool({
    endpoints: config.endpoints.map((url, i) => ({
      name: names[i] as string,
      transport: createDefaultRpcTransport({ url }),
    })),
    freshnessAware: true,
    healthMonitor: new HealthMonitor({
      endpointNames: names,
      maxSlotLag: config.maxSlotLag ?? 150n,
    }),
    rateLimiter: new CreditRateLimiter({ creditsPerWindow: 100, windowMs: 1_000 }),
    metrics: config.metrics ?? new InMemoryMetrics(),
    events: config.events ?? new LifecycleEmitter(),
  });
}
