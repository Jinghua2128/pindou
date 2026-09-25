"use client";
import { newId } from "@/lib/id";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, Users, Radio, LogOut } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { useEditor } from "@/stores/editor";
import { usePlay } from "@/stores/play";
import { saveProject } from "@/lib/storage";

export function CoopControls({ roomId }: { roomId?: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false),
    [name, setName] = useState(""),
    [busy, setBusy] = useState(false),
    [invite, setInvite] = useState(""),
    [copied, setCopied] = useState(false),
    [error, setError] = useState("");
  const peers = usePlay((s) => s.peers),
    status = usePlay((s) => s.status),
    connected = usePlay((s) => s.connected);
  function show() {
    setError("");
    setCopied(false);
    try {
      setName(
        roomId
          ? usePlay.getState().playerName
          : sessionStorage.getItem("pindou.player") || "",
      );
      setInvite(
        sessionStorage.getItem(`pindou.invite.${roomId}`) ||
          window.location.href,
      );
    } catch {
      setInvite(window.location.href);
    }
    setOpen(true);
  }
  async function create() {
    setBusy(true);
    setError("");
    try {
      useEditor.getState().end();
      try {
        sessionStorage.setItem("pindou.player", name.trim() || "Little maker");
      } catch {}
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
      const room: { id: string; invite: string } = await response.json();
      try {
        sessionStorage.setItem(`pindou.invite.${room.id}`, room.invite);
      } catch {}
      setInvite(room.invite);
      router.push(`/room/${room.id}`);
      setOpen(false);
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
      setError("Select the invitation link below and copy it.");
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
                ? status
                : "Invite a friend. Make something, or make a mess."}
            </span>
          </div>
        </div>
        {roomId && (
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
        <button className="secondary" onClick={show}>
          <Users size={16} />
          {roomId ? "Invite friend" : "Create co-op room"}
        </button>
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
      {open && (
        <Modal
          title={
            roomId ? "Pull up a chair." : "A little table for two. Or more."
          }
          onClose={() => setOpen(false)}
        >
          <div className="coop-dialog">
            <div className="coop-illustration">
              <span />
              <Users size={36} />
              <span />
            </div>
            <p>
              Build together in real time. Move each other’s beads, shuffle the
              boxes, and spill a little color.
            </p>
            {!roomId ? (
              <>
                <label>
                  Your name
                  <input
                    autoFocus
                    maxLength={24}
                    placeholder="Little maker"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </label>
                <button className="primary" disabled={busy} onClick={create}>
                  <Radio size={17} />
                  {busy ? "Setting the table…" : "Open shared table"}
                </button>
              </>
            ) : (
              <>
                <label>
                  Your name at the table
                  <input
                    maxLength={24}
                    value={name}
                    onChange={(e) => {
                      setName(e.target.value);
                      const value = e.target.value.trim() || "Little maker";
                      usePlay.setState({ playerName: value });
                      try {
                        sessionStorage.setItem("pindou.player", value);
                      } catch {}
                    }}
                  />
                </label>
                <label>
                  Invitation link
                  <input
                    aria-label="Invitation link"
                    readOnly
                    value={invite}
                    onFocus={(e) => e.currentTarget.select()}
                  />
                </label>
                <button className="primary" onClick={copy}>
                  {copied ? <Check size={17} /> : <Copy size={17} />}{" "}
                  {copied ? "Link copied" : "Copy invitation"}
                </button>
              </>
            )}
            <small>
              Anyone with the link can edit. On a local server, friends need the
              same Wi-Fi and this computer must stay running. Internet play
              needs a publicly hosted server. Rooms last until a server restart
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
