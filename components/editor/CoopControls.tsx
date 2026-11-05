"use client";
/* eslint-disable react-hooks/set-state-in-effect -- Hydrate room entry from this tab's session storage. */
import { newId } from "@/lib/id";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, Users, Radio, LogOut } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { useEditor } from "@/stores/editor";
import { usePlay } from "@/stores/play";
import { saveProject } from "@/lib/storage";
import { invitationPath } from "@/lib/invitations";
import { CallPanel } from "./CallPanel";
function remember(key: string, value: string) {
  try {
    sessionStorage.setItem(key, value);
  } catch {}
}
function recall(key: string) {
  try {
    return sessionStorage.getItem(key) || "";
  } catch {
    return "";
  }
}
export function CoopControls({ roomId }: { roomId?: string }) {
  const router = useRouter();
  const [dialog, setDialog] = useState<
    "create" | "invite" | "join" | "enter" | null
  >(null);
  const [name, setName] = useState(""),
    [busy, setBusy] = useState(false),
    [invite, setInvite] = useState(""),
    [copied, setCopied] = useState(false),
    [error, setError] = useState(""),
    [roomName, setRoomName] = useState(""),
    [checking, setChecking] = useState(false);
  const peers = usePlay((s) => s.peers),
    status = usePlay((s) => s.status),
    connected = usePlay((s) => s.connected),
    entryRoom = usePlay((s) => s.entryRoom);
  useEffect(() => {
    setName(recall("pindou.player"));
    setError("");
    if (!roomId) return;
    setInvite(recall(`pindou.invite.${roomId}`) || window.location.href);
    if (
      recall(`pindou.joined.${roomId}`) ||
      usePlay.getState().entryRoom === roomId
    ) {
      usePlay.setState({ entryRoom: roomId });
      if (recall(`pindou.invite-open.${roomId}`)) {
        remember(`pindou.invite-open.${roomId}`, "");
        setDialog("invite");
      }
      return;
    }
    setDialog("enter");
    setRoomName("");
    setChecking(true);
    const controller = new AbortController();
    fetch(`/api/rooms/${roomId}`, { signal: controller.signal })
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error);
        setRoomName(data.name);
      })
      .catch((e) => {
        if (!controller.signal.aborted) {
          setError(e.message);
          usePlay.setState({ status: e.message });
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setChecking(false);
      });
    return () => controller.abort();
  }, [roomId]);
  function enter(id: string) {
    const player = name.trim() || "Little maker";
    remember("pindou.player", player);
    remember(`pindou.joined.${id}`, "yes");
    usePlay.setState({ entryRoom: id, playerName: player });
    setDialog(null);
  }
  function show(kind: typeof dialog) {
    setError("");
    setCopied(false);
    if (kind === "join") setInvite("");
    setDialog(kind);
  }
  async function create() {
    setBusy(true);
    setError("");
    try {
      useEditor.getState().end();
      const response = await fetch("/api/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          project: useEditor.getState().project,
          toys: usePlay.getState().toys,
        }),
      });
      if (!response.ok)
        throw new Error("The room couldn’t open. Please try again.");
      const room = await response.json();
      remember(`pindou.invite.${room.id}`, room.invite);
      remember(`pindou.invite-open.${room.id}`, "yes");
      enter(room.id);
      router.push(`/room/${room.id}`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function copy() {
    try {
      await navigator.clipboard.writeText(invite);
      setCopied(true);
    } catch {
      setError("Select the invitation link and copy it.");
    }
  }
  function leave() {
    const project = {
      ...useEditor.getState().project,
      id: newId(),
      name: `${useEditor.getState().project.name.slice(0, 65)} (my copy)`,
    };
    try {
      saveProject(project);
    } catch {}
    useEditor.getState().load(project);
    router.push(`/create/${project.id}`);
  }
  const joined = roomId && entryRoom === roomId;
  return (
    <>
      <div className="coop-bar">
        <div className="coop-description">
          <Users size={19} />
          <div>
            <strong>
              {roomId ? "Our little table" : "Better with a little company"}
            </strong>
            <span>
              {roomId
                ? joined
                  ? status
                  : "Choose your name to join"
                : "Invite a friend. Make something, or make a mess."}
            </span>
          </div>
        </div>
        {joined && (
          <div className="room-presence" aria-label="People at the table">
            <i className={connected ? "online" : ""} />
            <span>{peers.length + 1} at the table</span>
            {peers.slice(0, 3).map((p) => (
              <span className="peer-avatar" key={p.id} title={p.name}>
                {p.name.slice(0, 1).toUpperCase()}
              </span>
            ))}
          </div>
        )}
        <button
          className="secondary"
          onClick={() =>
            show(roomId ? (joined ? "invite" : "enter") : "create")
          }
        >
          <Users size={16} />
          {roomId
            ? joined
              ? "Invite friend"
              : "Join table"
            : "Create co-op room"}
        </button>
        {!roomId && (
          <button className="secondary" onClick={() => show("join")}>
            Join a friend
          </button>
        )}
        {joined && <CallPanel roomId={roomId} connected={connected} />}
        {roomId && (
          <button
            className="icon-button"
            title="Leave with your own copy"
            aria-label="Leave with your own copy"
            onClick={leave}
          >
            <LogOut size={17} />
          </button>
        )}
      </div>
      {dialog && (
        <Modal
          title={
            dialog === "create"
              ? "A little table for two. Or more."
              : dialog === "join"
                ? "Join your friend’s table."
                : dialog === "enter"
                  ? "Your chair is waiting."
                  : "Pull up a chair."
          }
          onClose={() => setDialog(null)}
        >
          <div className="coop-dialog">
            <div className="coop-illustration">
              <span />
              <Users size={36} />
              <span />
            </div>
            <p>
              {dialog === "enter"
                ? checking
                  ? "Finding your friend’s table…"
                  : roomName
                    ? `You’re joining ${roomName}. Pick a name and start making together.`
                    : "This invitation is unavailable."
                : dialog === "invite"
                  ? "Send this link to a friend. They choose a name and join—no account needed."
                  : "Build together in real time. Move each other’s beads, shuffle the boxes, and spill a little color."}
            </p>
            {dialog !== "join" && (
              <label>
                {dialog === "invite" ? "Your name at the table" : "Your name"}
                <input
                  autoFocus
                  maxLength={24}
                  placeholder="Little maker"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    if (dialog === "invite") {
                      const value = e.target.value.trim() || "Little maker";
                      remember("pindou.player", value);
                      usePlay.setState({ playerName: value });
                    }
                  }}
                />
              </label>
            )}
            {dialog === "create" && (
              <button className="primary" disabled={busy} onClick={create}>
                <Radio size={17} />
                {busy ? "Setting the table…" : "Open shared table"}
              </button>
            )}
            {dialog === "enter" && (
              <button
                className="primary"
                disabled={checking || !roomName || !!error}
                onClick={() => enter(roomId!)}
              >
                Join table
              </button>
            )}
            {(dialog === "invite" || dialog === "join") && (
              <label>
                Invitation link
                <input
                  aria-label="Invitation link"
                  readOnly={dialog === "invite"}
                  value={invite}
                  placeholder="Paste your friend’s invitation here"
                  onChange={(e) => setInvite(e.target.value)}
                  onFocus={(e) => {
                    if (dialog === "invite") e.currentTarget.select();
                  }}
                />
              </label>
            )}
            {dialog === "invite" && (
              <button className="primary" onClick={copy}>
                {copied ? <Check size={17} /> : <Copy size={17} />}{" "}
                {copied ? "Link copied" : "Copy invitation"}
              </button>
            )}
            {dialog === "join" && (
              <button
                className="primary"
                onClick={() => {
                  const path = invitationPath(invite);
                  if (!path) {
                    setError(
                      "Paste a complete PinDou invitation ending in /room/ followed by its room code.",
                    );
                    return;
                  }
                  setDialog(null);
                  router.push(path);
                }}
              >
                Find table
              </button>
            )}
            <small>
              Anyone with the link can edit. On a local server, friends need the
              same Wi-Fi and this computer must stay running. Internet play
              needs a publicly hosted server. Rooms close after a server restart
              or 12 hours of inactivity; a copy also saves on each device.
            </small>
            {error && (
              <p role="alert" className="error-copy">
                {error}
              </p>
            )}
          </div>
        </Modal>
      )}
    </>
  );
}
