"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Camera, CameraOff, Mic, MicOff, PhoneOff, Signal } from "lucide-react";
import {
  GridLayout,
  LiveKitRoom,
  ParticipantTile,
  PreJoin,
  RoomAudioRenderer,
  useConnectionState,
  useParticipants,
  useTracks,
  useTrackToggle,
} from "@livekit/components-react";
import { ConnectionState, Track } from "livekit-client";

type DeviceChoices = {
  audioEnabled: boolean;
  videoEnabled: boolean;
  audioDeviceId: string;
  videoDeviceId: string;
};

type CallCredentials = { serverUrl: string; participantToken: string };

function explainDeviceError(error: unknown) {
  if (error instanceof DOMException) {
    if (error.name === "NotAllowedError" || error.name === "PermissionDeniedError") return "Camera or microphone access was denied. Allow access in your browser settings, then try again.";
    if (error.name === "NotFoundError" || error.name === "DevicesNotFoundError") return "No camera or microphone was found. Connect a device or choose to continue with the available device.";
    if (error.name === "NotReadableError" || error.name === "TrackStartError") return "Your camera or microphone is busy in another app. Close that app and try again.";
    if (error.name === "SecurityError") return "Your browser blocked media access. Open SkillSwap over HTTPS and check your browser permissions.";
  }
  return error instanceof Error ? error.message : "A camera or microphone could not be started.";
}

export function SessionCall({ sessionId }: { sessionId: string }) {
  const [credentials, setCredentials] = useState<CallCredentials | null>(null);
  const [choices, setChoices] = useState<DeviceChoices | null>(null);
  const [error, setError] = useState("");
  const [capability, setCapability] = useState<"checking" | "available" | "unsupported">("checking");
  const [starting, setStarting] = useState(false);
  const leaving = useRef(false);
  const router = useRouter();

  useEffect(() => {
    setCapability(typeof window !== "undefined" && window.isSecureContext && !!navigator.mediaDevices?.getUserMedia ? "available" : "unsupported");
  }, []);

  const startCall = useCallback(async (deviceChoices: DeviceChoices) => {
    if (starting) return;
    setStarting(true);
    setError("");
    try {
      const response = await fetch(`/api/sessions/${sessionId}/call-token`, {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        if (body?.error?.code === "MFA_REQUIRED") throw new Error("Complete second-factor verification before joining this session.");
        if (response.status === 401) throw new Error("Your sign-in expired. Sign in again to join this session.");
        if (body?.error?.code === "SESSION_NOT_CONFIRMED") throw new Error("This session is no longer confirmed, so it cannot be joined.");
        if (response.status === 404) throw new Error("This session is unavailable or you are not a member of its match.");
        throw new Error(body?.error?.message || "The video session could not be started. Try again.");
      }
      const data = body?.data as CallCredentials | undefined;
      if (!data?.serverUrl || !data.participantToken) throw new Error("The video service returned an invalid connection response.");
      setChoices(deviceChoices);
      setCredentials(data);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The video session could not be started. Try again.");
    } finally {
      setStarting(false);
    }
  }, [sessionId, starting]);

  function leaveCall() {
    leaving.current = true;
    setCredentials(null);
    setChoices(null);
    router.push("/sessions");
  }

  return <section className="session-call-page">
    <div className="session-call-heading">
      <div><p className="eyebrow">SKILLSWAP VIDEO SESSION</p><h1>Meet your learning partner</h1><p className="subtitle">Your scheduled session is private to the two people in this match.</p></div>
      <Link className="button secondary" href={`/sessions/${sessionId}`}>Session details</Link>
    </div>

    {error && <div className="call-error" role="alert"><strong>Could not join</strong><p>{error}</p><button className="text-button" onClick={() => setError("")}>Dismiss</button></div>}
    {capability === "checking" && <div className="card call-state" role="status">Checking camera and microphone support…</div>}
    {capability === "unsupported" && <div className="card call-state" role="alert"><h2>Camera and microphone unavailable</h2><p>Use a modern browser on a secure HTTPS connection, then allow camera and microphone access.</p><Link className="button secondary" href={`/sessions/${sessionId}`}>Back to session details</Link></div>}
    {capability === "available" && !credentials && <div className="call-prejoin card">
      <div className="call-prejoin-copy"><p className="eyebrow">BEFORE YOU JOIN</p><h2>Check your setup</h2><p className="muted">Choose your camera and microphone. You can turn either one off before joining.</p></div>
      <PreJoin
        persistUserChoices={false}
        joinLabel={starting ? "Connecting…" : "Join video session"}
        onError={(reason) => setError(explainDeviceError(reason))}
        onSubmit={(values) => { void startCall(values); }}
        className="skillswap-prejoin"
      />
      {starting && <p className="call-inline-status" role="status">Securely connecting to your session…</p>}
      <p className="call-privacy-note">Your preview stays on this device until you join. Leaving ends your connection and releases your devices.</p>
    </div>}
    {credentials && choices && <LiveKitRoom
      key={credentials.participantToken}
      serverUrl={credentials.serverUrl}
      token={credentials.participantToken}
      connect
      audio={choices.audioEnabled ? { deviceId: choices.audioDeviceId || undefined } : false}
      video={choices.videoEnabled ? { deviceId: choices.videoDeviceId || undefined } : false}
      options={{ adaptiveStream: true, dynacast: true }}
      onError={(reason) => setError(explainDeviceError(reason))}
      onMediaDeviceFailure={(failure, kind) => setError(`${kind === "audioinput" ? "Microphone" : "Camera"} problem: ${failure ? String(failure).toLowerCase().replaceAll("_", " ") : "device unavailable"}. Check permissions and device settings.`)}
      onDisconnected={() => {
        if (!leaving.current) {
          setError("Your video connection ended. You can check your devices and rejoin this session.");
          setCredentials(null);
          setChoices(null);
        }
      }}
      className="skillswap-livekit-room"
    >
      <ActiveCall onLeave={leaveCall} onDeviceError={(reason) => setError(explainDeviceError(reason))} />
    </LiveKitRoom>}
  </section>;
}

function ActiveCall({ onLeave, onDeviceError }: { onLeave: () => void; onDeviceError: (error: Error) => void }) {
  const state = useConnectionState();
  const participants = useParticipants();
  const tracks = useTracks([{ source: Track.Source.Camera, withPlaceholder: true }]);
  const connecting = state === ConnectionState.Connecting || state === ConnectionState.Reconnecting;

  return <div className="active-call">
    <div className="active-call-topline">
      <div><p className="eyebrow">LIVE SESSION</p><h2>Learning together</h2></div>
      <div className={`call-connection-status ${state === ConnectionState.Connected ? "is-connected" : ""}`} role="status"><Signal size={16} aria-hidden="true" />{state === ConnectionState.Reconnecting ? "Reconnecting…" : state === ConnectionState.Connecting ? "Connecting…" : state === ConnectionState.Connected ? "Connected" : "Disconnected"}</div>
    </div>
    {connecting && <p className="call-reconnect-message" role="status">Your connection is being restored. Keep this page open.</p>}
    <div className="call-participant-count">{participants.length} {participants.length === 1 ? "person" : "people"} in this session</div>
    <GridLayout tracks={tracks} className="skillswap-call-grid"><ParticipantTile /></GridLayout>
    <RoomAudioRenderer />
    <CallControls onLeave={onLeave} onDeviceError={onDeviceError} />
  </div>;
}

function CallControls({ onLeave, onDeviceError }: { onLeave: () => void; onDeviceError: (error: Error) => void }) {
  const microphone = useTrackToggle({ source: Track.Source.Microphone, onDeviceError });
  const camera = useTrackToggle({ source: Track.Source.Camera, onDeviceError });
  return <div className="call-controls" aria-label="Call controls">
    <button {...microphone.buttonProps} className={`call-control ${microphone.enabled ? "" : "is-off"}`} aria-label={microphone.enabled ? "Mute microphone" : "Unmute microphone"} title={microphone.enabled ? "Mute microphone" : "Unmute microphone"}>
      {microphone.enabled ? <Mic size={21} aria-hidden="true" /> : <MicOff size={21} aria-hidden="true" />}<span>{microphone.enabled ? "Mute" : "Unmute"}</span>
    </button>
    <button {...camera.buttonProps} className={`call-control ${camera.enabled ? "" : "is-off"}`} aria-label={camera.enabled ? "Turn camera off" : "Turn camera on"} title={camera.enabled ? "Turn camera off" : "Turn camera on"}>
      {camera.enabled ? <Camera size={21} aria-hidden="true" /> : <CameraOff size={21} aria-hidden="true" />}<span>{camera.enabled ? "Camera on" : "Camera off"}</span>
    </button>
    <button type="button" className="call-control call-leave" onClick={onLeave}><PhoneOff size={21} aria-hidden="true" /><span>Leave</span></button>
  </div>;
}
