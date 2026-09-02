import { prisma, type CallStatus, type Speaker } from "@repo/db";

/**
 * Call/transcript persistence (CLAUDE.md §7 `CallLogService`). apps/api
 * creates the initial Call row when it mints the LiveKit token; this service
 * owns every update to it from inside the agent process.
 */
export class CallLogService {
  async getOrAttachCall(callId: string) {
    return prisma.call.findUniqueOrThrow({ where: { id: callId } });
  }

  /**
   * apps/api normally creates the Call row when it mints the LiveKit token,
   * before the agent ever joins — this is a defensive fallback (e.g. running
   * the agent against a room created outside that flow, `lk` CLI testing)
   * so the worker never crashes just because the row doesn't exist yet.
   */
  async findOrCreateByRoomName(roomName: string) {
    const existing = await prisma.call.findUnique({ where: { roomName } });
    if (existing) return existing;
    return prisma.call.create({ data: { roomName, status: "ACTIVE" } });
  }

  async attachCallerAndMatter(callId: string, input: { callerId?: string | null; matterId?: string | null }) {
    return prisma.call.update({
      where: { id: callId },
      data: {
        ...(input.callerId !== undefined ? { callerId: input.callerId } : {}),
        ...(input.matterId !== undefined ? { matterId: input.matterId } : {}),
      },
    });
  }

  async addTranscriptTurn(callId: string, speaker: Speaker, text: string) {
    if (!text.trim()) return null;
    return prisma.transcriptTurn.create({ data: { callId, speaker, text } });
  }

  /** Plain "speaker: text" excerpt, most recent last — used for post-call summarization. */
  async getRecentTranscript(callId: string, limit = 40): Promise<string> {
    const turns = await prisma.transcriptTurn.findMany({
      where: { callId },
      orderBy: { timestamp: "desc" },
      take: limit,
    });
    return turns
      .reverse()
      .map((t) => `${t.speaker}: ${t.text}`)
      .join("\n");
  }

  async endCall(callId: string, input: { status: CallStatus; finalSummary?: string | null }) {
    return prisma.call.update({
      where: { id: callId },
      data: { status: input.status, finalSummary: input.finalSummary ?? undefined, endedAt: new Date() },
    });
  }
}
