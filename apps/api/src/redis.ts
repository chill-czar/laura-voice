import { Redis } from "ioredis";
import { env } from "./env.js";

/**
 * One shared connection for normal commands (backlog reads) and a factory
 * for dedicated subscriber connections — ioredis requires a connection to
 * be exclusively in subscribe mode once SUBSCRIBE is called, so every SSE
 * client gets its own duplicate() connection (closed when it disconnects).
 */
export const redis = new Redis(env.REDIS_URL);

export function createSubscriberConnection(): Redis {
  return redis.duplicate();
}
