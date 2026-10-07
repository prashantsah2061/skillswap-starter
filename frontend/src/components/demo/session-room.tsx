"use client";
import { useState, useEffect, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { partners } from "@/lib/frontend-data";
import { useDemo } from "./demo-provider";
import { Photo, Badge, Dialog } from "./ui";
export function SessionRoom({ id }: { id: string }) {
  const { data } = useDemo();
  const router = useRouter();
  const session = data.sessions.find((s) => s.id === id);
  const [remaining, setRemaining] = useState(18 * 60 + 42);
  const [phase, setPhase] = useState(1);
  const [mic, setMic] = useState(true);
  const [camera, setCamera] = useState(true);
  const [share, setShare] = useState(false);
  const [chat, setChat] = useState(false);
  const [leave, setLeave] = useState(false);
  const [text, setText] = useState("");
  const [messages, setMessages] = useState<string[]>([]);
  useEffect(() => {
    const interval = setInterval(
      () => setRemaining((r) => Math.max(0, r - 1)),
      1000,
    );
    return () => clearInterval(interval);
  }, []);
  useEffect(() => {
    if (remaining === 0 && phase === 1) {
      const timeout = setTimeout(() => {
        setPhase(2);
        setRemaining(1800);
      }, 0);
      return () => clearTimeout(timeout);
    }
  }, [remaining, phase]);
  if (!session)
    return (
      <div className="empty card">
        <h1>Session not found</h1>
        <Link href="/sessions" className="button">
          Back to Sessions
        </Link>
      </div>
    );
  const partner = partners.find((p) => p.id === session.partner) || partners[0];
  const swap = () => {
    setPhase((p) => (p === 1 ? 2 : 1));
    setRemaining(1800);
  };
  function send(e: FormEvent) {
    e.preventDefault();
    if (text.trim()) {
      setMessages((m) => [...m, text.trim()]);
      setText("");
    }
  }
  return (
    <div className="room">
      <Link className="breadcrumb" href="/sessions">
        ← Back to Sessions
      </Link>
      <div className="room-heading">
        <div>
          <Badge tone="mint">Demo session</Badge>
          <h1>
            {session.learn} × {session.teach} skill swap
          </h1>
          <div className="room-details">
            <Photo photo={partner.photo} alt="" />
            <span>
              {partner.name.split(" ")[0]} ↔ {data.profile.name.split(" ")[0]}
            </span>
            <span>▣ {session.date}</span>
            <span>◷ {session.time} · 60 min</span>
          </div>
        </div>
        <div className="phase-indicators">
          <div className={phase === 1 ? "selected" : ""}>
            <b>1</b>
            <span>
              <strong>First 30 min</strong>
              {partner.name.split(" ")[0]} teaches {session.learn}
            </span>
          </div>
          <span>›</span>
          <div className={phase === 2 ? "selected" : ""}>
            <b>2</b>
            <span>
              <strong>Next 30 min</strong>You teach {session.teach}
            </span>
          </div>
        </div>
        <div className="countdown card">
          <span>◷</span>
          <div>
            <strong>
              {Math.floor(remaining / 60)
                .toString()
                .padStart(2, "0")}
              :{(remaining % 60).toString().padStart(2, "0")}
            </strong>
            <b>remaining</b>
            <small>
              {remaining === 0
                ? "Demo session complete"
                : phase === 1
                  ? "Learning time"
                  : "Teaching time"}
            </small>
          </div>
        </div>
      </div>
      <div className="room-grid">
        <section className="shared-area">
          <div className="main-participant">
            <Photo
              photo={partner.photo === "maya" ? "maya-room" : partner.photo}
              alt="Placeholder participant portrait"
            />
            <span className="tile-label">
              ● {partner.name.split(" ")[0]} ·{" "}
              {phase === 1 ? "Teaching" : "Learning"}
            </span>
            <span className="sample-label">Placeholder image</span>
          </div>
          <div className="code-preview">
            <div className="editor-toolbar">
              <span>🔴 🟡 🟢</span>
              <span>
                {share ? "Your demo screen preview" : "Sample shared content"}
              </span>
            </div>
            {share ? (
              <div className="share-preview">
                <span aria-hidden="true">▣</span>
                <h2>You’re sharing a demo screen</h2>
                <p>
                  This is a local preview. No device access or real screen
                  sharing is active.
                </p>
                <div className="mock-design">
                  <div />
                  <div />
                  <div />
                </div>
                <button className="button lime" onClick={() => setShare(false)}>
                  Stop demo sharing
                </button>
              </div>
            ) : (
              <>
                <div className="editor-tabs">
                  ▤ &nbsp; learn_python.py &nbsp; ×
                </div>
                <div className="code-content">
                  <aside>
                    1<br />2<br />3<br />4<br />5<br />6<br />7<br />8<br />9
                    <br />
                    10
                    <br />
                    11
                  </aside>
                  <pre>
                    <span className="code-comment">
                      # A simple example: track skills in a list
                    </span>
                    {"\n\n"}skills ={" "}
                    <span className="code-string">
                      [&quot;Python&quot;, &quot;Figma&quot;,
                      &quot;Design&quot;, &quot;Data&quot;]
                    </span>
                    {"\n\n"}
                    <span className="code-comment"># Add a new skill</span>
                    {"\n"}skills.append(
                    <span className="code-string">
                      &quot;Video Editing&quot;
                    </span>
                    ){"\n\n"}
                    <span className="code-comment">
                      # Loop through the list and print each skill
                    </span>
                    {"\n"}
                    <span className="code-keyword">print</span>(
                    <span className="code-string">&quot;My skills:&quot;</span>)
                    {"\n"}
                    <span className="code-keyword">for</span> skill{" "}
                    <span className="code-keyword">in</span> skills:{"\n"}{" "}
                    print(f
                    <span className="code-string">
                      &quot;- {"{skill}"}&quot;
                    </span>
                    )
                  </pre>
                </div>
                <div className="terminal">
                  <span>
                    PROBLEMS &nbsp; OUTPUT &nbsp; <b>TERMINAL</b> &nbsp; PORTS
                  </span>
                  <pre>
                    {
                      "$ python learn_python.py\nMy skills:\n- Python\n- Figma\n- Design\n- Data\n- Video Editing\n\n$"
                    }
                  </pre>
                </div>
              </>
            )}
          </div>
        </section>
        <aside className="room-sidebar">
          <div className="participant-tile">
            {camera ? (
              <Photo
                photo={data.profile.photo}
                alt="Your placeholder portrait"
              />
            ) : (
              <div className="camera-off">
                <span>{data.profile.name[0]}</span>Camera off · demo
              </div>
            )}
            <span className="tile-label">
              ● You · {phase === 1 ? "Learning" : "Teaching"}{" "}
              {!mic && "· Muted"}
            </span>
          </div>
          <div className="participant-tile">
            <Photo photo="jordan" alt="Jordan, fictional participant" />
            <span className="tile-label">● Jordan · Learning</span>
          </div>
          <div className="swap-plan card">
            <h3>▣ &nbsp; Swap plan</h3>
            <p>
              30 min learning + 30 min teaching
              <br />
              Roles switch automatically at halftime
            </p>
            <div className={phase === 1 ? "current" : ""}>
              <b>1</b>
              <span>
                {partner.name.split(" ")[0]} teaches {session.learn}
              </span>
              <small>0:00 – 30:00</small>
            </div>
            <div className={phase === 2 ? "current" : ""}>
              <b>2</b>
              <span>You teach {session.teach}</span>
              <small>30:00 – 60:00</small>
            </div>
          </div>
        </aside>
      </div>
      <div className="room-controls card">
        <button aria-pressed={!mic} onClick={() => setMic(!mic)}>
          <span aria-hidden="true">{mic ? "♩" : "♩̸"}</span>
          {mic ? "Mute" : "Unmute"}
        </button>
        <button aria-pressed={!camera} onClick={() => setCamera(!camera)}>
          <span aria-hidden="true">▣</span>
          {camera ? "Stop video" : "Start video"}
        </button>
        <button aria-pressed={share} onClick={() => setShare(!share)}>
          <span aria-hidden="true">▱</span>
          {share ? "Stop sharing" : "Share screen"}
        </button>
        <button aria-pressed={chat} onClick={() => setChat(!chat)}>
          <span aria-hidden="true">▢</span>Chat
        </button>
        <span className="control-divider" />
        <button className="button danger" onClick={() => setLeave(true)}>
          ⌒ &nbsp; Leave
        </button>
        <button className="button lime" onClick={swap}>
          ⇄ &nbsp; Switch roles
        </button>
      </div>
      <p className="demo-caption">
        All participants and controls are simulated. No camera, microphone, or
        screen permissions are used.
      </p>
      {chat && (
        <Dialog title="Session chat" onClose={() => setChat(false)}>
          <p className="muted">Local demo chat · No messages are delivered.</p>
          <div className="room-chat-history">
            <p className="message">
              Welcome! Use this space to keep notes during your swap.
            </p>
            {messages.map((m, i) => (
              <p className="message mine" key={i}>
                {m}
              </p>
            ))}
          </div>
          <form className="message-compose" onSubmit={send}>
            <input
              aria-label="Session chat message"
              value={text}
              maxLength={2000}
              onChange={(e) => setText(e.target.value)}
              placeholder="Write a demo message…"
            />
            <button className="button" disabled={!text.trim()}>
              Send
            </button>
          </form>
        </Dialog>
      )}
      {leave && (
        <Dialog title="Leave demo session?" onClose={() => setLeave(false)}>
          <p>
            Your scheduled session will stay in your list. The timer stops when
            you leave.
          </p>
          <button
            className="button danger"
            onClick={() => router.push("/sessions")}
          >
            Leave session
          </button>
          <button className="button secondary" onClick={() => setLeave(false)}>
            Stay here
          </button>
        </Dialog>
      )}
    </div>
  );
}
