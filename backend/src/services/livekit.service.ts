import "server-only";
import { TrackSource } from "@livekit/protocol";
import { AccessToken } from "livekit-server-sdk";
import { unavailable } from "../lib/discovery/errors";

const tokenLifetime = "5m";

function liveKitServerUrl() {
  const configured = process.env.LIVEKIT_URL;
  if (!configured) throw unavailable();
  try {
    const url = new URL(configured);
    if (url.protocol !== "wss:" || !url.hostname || url.username || url.password || url.pathname !== "/" || url.search || url.hash) {
      throw unavailable();
    }
    return url.toString().replace(/\/$/, "");
  } catch {
    throw unavailable();
  }
}

export async function createSessionCallCredentials(sessionId: string, participantId: string) {
  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;
  const serverUrl = liveKitServerUrl();
  if (!apiKey || !apiSecret) throw unavailable();

  // UUIDs are opaque, unique per scheduled session, and contain no user data.
  const room = `skillswap-session-${sessionId}`;
  const token = new AccessToken(apiKey, apiSecret, { identity: participantId, ttl: tokenLifetime });
  token.addGrant({
    room,
    roomJoin: true,
    canPublish: true,
    canPublishSources: [TrackSource.CAMERA, TrackSource.MICROPHONE],
    canPublishData: false,
    canSubscribe: true,
  });

  return { serverUrl, participantToken: await token.toJwt() };
}
