import { AccessToken } from "livekit-server-sdk";
import { env } from "../env.js";

export interface MintedSession {
  roomName: string;
  identity: string;
  token: string;
  url: string;
}

/**
 * Mints short-lived LiveKit room-join tokens. This is the only place the
 * LiveKit API secret is used — the browser only ever receives the signed
 * JWT, never the secret itself (CLAUDE.md §26).
 */
export class LiveKitTokenService {
  async createSession(params: { roomName: string; identity: string; participantName?: string }): Promise<MintedSession> {
    const at = new AccessToken(env.LIVEKIT_API_KEY, env.LIVEKIT_API_SECRET, {
      identity: params.identity,
      name: params.participantName ?? params.identity,
      ttl: "15m",
    });
    at.addGrant({
      room: params.roomName,
      roomJoin: true,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
    });
    const token = await at.toJwt();
    return { roomName: params.roomName, identity: params.identity, token, url: env.LIVEKIT_URL };
  }
}
