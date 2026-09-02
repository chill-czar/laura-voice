import { Redis } from "ioredis";
import { env } from "./env.js";

/** Single publisher connection — EventService fans events out over this (CLAUDE.md §12). */
export const redis = new Redis(env.REDIS_URL);
