import { OpenRouter } from "@openrouter/sdk";
import { z } from "zod";
import { createLogger, intakeFieldsSchema, type IntakeFields } from "@repo/shared";
import { env } from "../env.js";

const logger = createLogger("agent:openrouter");

const intakeJsonSchema = toStrictJsonSchema(z.toJSONSchema(intakeFieldsSchema) as JsonSchemaObject);

type JsonSchemaObject = Record<string, unknown>;

/**
 * OpenAI-compatible `strict: true` structured output has two requirements zod does not
 * emit for a schema of optional fields: every object must set `additionalProperties:
 * false`, and every property must be listed in `required`. Sending the raw zod output is
 * rejected outright with a 400 ("'additionalProperties' is required to be supplied and to
 * be false"), which silently disabled all extraction. "Unknown" is therefore expressed as
 * an explicit null value (each field is already nullable) rather than an absent key.
 */
function toStrictJsonSchema(schema: JsonSchemaObject): JsonSchemaObject {
  if (schema.type !== "object" || typeof schema.properties !== "object" || schema.properties === null) {
    return schema;
  }
  const properties = schema.properties as Record<string, JsonSchemaObject>;
  const strictProperties: Record<string, JsonSchemaObject> = {};
  for (const [key, value] of Object.entries(properties)) {
    strictProperties[key] = toStrictJsonSchema(value);
  }
  return {
    ...schema,
    properties: strictProperties,
    required: Object.keys(strictProperties),
    additionalProperties: false,
  };
}

export interface ExtractIntakeInput {
  /** Recent conversation, rendered as plain "role: text" lines. */
  conversationExcerpt: string;
  alreadyKnown: IntakeFields;
}

export interface ExtractIntakeResult {
  fields: IntakeFields;
  durationMs: number;
}

/**
 * Thin wrapper around `@openrouter/sdk` (CLAUDE.md §7 `OpenRouterService`).
 * This is the ONLY place in the codebase that talks to OpenRouter directly
 * for non-realtime calls (structured extraction, summarization) — the
 * realtime conversational LLM is a separate client configured on
 * `AgentSession` (see agents/*.ts), since that one needs LiveKit's streaming
 * adapter, not a request/response SDK call.
 */
export class OpenRouterService {
  private readonly client: OpenRouter;

  constructor() {
    this.client = new OpenRouter({ apiKey: env.OPENROUTER_API_KEY });
  }

  /**
   * Structured extraction (CLAUDE.md §15). The model is constrained to the
   * IntakeFields JSON schema and instructed to only report what the caller
   * actually said — the result is still re-validated with zod before
   * anything is persisted (CaseService/ToolRegistry do that step).
   */
  async extractIntakeFields(input: ExtractIntakeInput): Promise<ExtractIntakeResult> {
    const start = Date.now();
    let text = "";
    try {
      const result = await this.client.chat.send({
        chatRequest: {
          model: env.OPENROUTER_EXTRACTION_MODEL,
          temperature: 0,
          messages: [
            {
              role: "system",
              content:
                "You extract structured intake facts for a plaintiff law firm's intake system. " +
                "Report ONLY facts the caller explicitly stated in the conversation excerpt. " +
                "Never invent, assume, or infer a value that was not said. " +
                "Omit (leave null) any field that is still unknown. " +
                "Preserve previously-known field values unless the caller corrected them.",
            },
            {
              role: "user",
              content: `Already known fields:\n${JSON.stringify(input.alreadyKnown)}\n\nConversation excerpt:\n${input.conversationExcerpt}`,
            },
          ],
          responseFormat: {
            type: "json_schema",
            jsonSchema: { name: "intake_fields", strict: true, schema: intakeJsonSchema },
          },
        },
      });

      if (!("choices" in result)) throw new Error("unexpected streaming response");
      text = extractText(result.choices[0]?.message?.content);
    } catch (err) {
      // Rethrow rather than returning {}. Swallowing this is what made a hard provider
      // 400 look indistinguishable from "the caller didn't mention anything extractable"
      // — the caller turns it into a visible ERROR call event instead (CLAUDE.md §27).
      throw new Error(`extraction request failed: ${describeError(err)}`);
    }

    const durationMs = Date.now() - start;
    if (!text.trim()) throw new Error("extraction returned an empty response");

    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch (err) {
      throw new Error(`extraction returned invalid JSON: ${describeError(err)}`);
    }

    const validated = intakeFieldsSchema.safeParse(parsed);
    if (!validated.success) {
      throw new Error(`extraction failed schema validation: ${validated.error.issues.length} issue(s)`);
    }
    return { fields: validated.data, durationMs };
  }

  /** Short human-readable case summary for the call-ended confirmation + Call.finalSummary. */
  async summarizeCall(input: { transcriptExcerpt: string; fields: IntakeFields }): Promise<string> {
    try {
      const result = await this.client.chat.send({
        chatRequest: {
          model: env.OPENROUTER_EXTRACTION_MODEL,
          temperature: 0.2,
          messages: [
            {
              role: "system",
              content:
                "Write a concise (2-4 sentence) internal case summary for a law firm intake record. " +
                "Factual only, no legal conclusions or advice, no promises of representation.",
            },
            {
              role: "user",
              content: `Known fields:\n${JSON.stringify(input.fields)}\n\nTranscript excerpt:\n${input.transcriptExcerpt}`,
            },
          ],
        },
      });
      if (!("choices" in result)) return "";
      return extractText(result.choices[0]?.message?.content).trim();
    } catch (err) {
      logger.error("summarize.request_failed", { message: String(err) });
      return "";
    }
  }
}

/** SDK errors stringify to a bare class name ("Provider returned error"); the actionable
 * detail lives in a nested body/metadata field, so surface that too when present. */
function describeError(err: unknown): string {
  if (!(err instanceof Error)) return String(err);
  const detail = (err as Error & { body?: unknown; responseBody?: unknown }).body ?? (err as Error & { responseBody?: unknown }).responseBody;
  return detail ? `${err.message} — ${JSON.stringify(detail).slice(0, 400)}` : err.message;
}

function extractText(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((part) => (part && typeof part === "object" && "text" in part ? String((part as { text: unknown }).text) : ""))
      .join("");
  }
  return "";
}
