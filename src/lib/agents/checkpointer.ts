/**
 * Checkpointer singleton for the prospecting graph (P0-2).
 * Uses PostgresSaver on DATABASE_URL and runs setup() once per process.
 * Without DATABASE_URL, development falls back to MemorySaver (state is lost on
 * restart); production fails closed because runs could not resume.
 */

import { MemorySaver, type BaseCheckpointSaver } from "@langchain/langgraph";
import { PostgresSaver } from "@langchain/langgraph-checkpoint-postgres";
import { logger } from "../security/logger";

const globalKey = Symbol.for("revgeniq.agents.checkpointer");
type GlobalWithSaver = typeof globalThis & { [globalKey]?: Promise<BaseCheckpointSaver> };

async function createCheckpointer(): Promise<BaseCheckpointSaver> {
  const url = (process.env.DATABASE_URL || "").trim();
  if (!url) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("DATABASE_URL is required in production: LangGraph checkpoints must be durable.");
    }
    logger.warn("DATABASE_URL is not set: using in-memory LangGraph checkpoints (development only; runs cannot resume after a restart).");
    return new MemorySaver();
  }
  // A dedicated schema keeps checkpoints (which hold run state and contact data)
  // out of `public`, the schema Supabase's REST API exposes to the anon key.
  const saver = PostgresSaver.fromConnString(url, {
    schema: (process.env.AGENT_CHECKPOINT_SCHEMA || "langgraph").trim(),
  });
  await saver.setup();
  return saver;
}

/** Returns the shared checkpointer; a failed setup is retried on the next call. */
export function getCheckpointer(): Promise<BaseCheckpointSaver> {
  // Cached on globalThis so dev hot reloads keep one connection pool and one MemorySaver.
  const g = globalThis as GlobalWithSaver;
  if (!g[globalKey]) {
    g[globalKey] = createCheckpointer().catch((e) => {
      delete g[globalKey];
      throw e;
    });
  }
  return g[globalKey] as Promise<BaseCheckpointSaver>;
}
