"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Phone, Video, X } from "lucide-react";
import type { DailyCall } from "@daily-co/daily-js";
import { usePlay } from "@/stores/play";
import { authHeaders } from "@/lib/auth-client";
import { Modal } from "@/components/ui/Modal";
type CallInfo = { mode: "voice" | "video"; expiresAt: string };
type Ticket = CallInfo & { url: string; token: string };
export function CallPanel({
  roomId,
  connected,
}: {
  roomId: string;
  connected: boolean;
}) {
  const [info, setInfo] = useState<{
      configured: boolean;
      call: CallInfo | null;
    } | null>(null),
    [open, setOpen] = useState(false),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [ticket, setTicket] = useState<Ticket | null>(null);
  const container = useRef<HTMLDivElement>(null),
    frame = useRef<DailyCall | null>(null);
  useEffect(() => {
    if (!connected) return;
    let alive = true;
    const controller = new AbortController();
    async function refresh() {
      try {
        const r = await fetch(`/api/rooms/${roomId}/call`, {
          signal: controller.signal,
        });
        if (r.ok && alive) setInfo(await r.json());
      } catch {}
    }
    void refresh();
    const timer = setInterval(refresh, 10000);
    return () => {
      alive = false;
      controller.abort();
      clearInterval(timer);
    };
  }, [roomId, connected]);
  useEffect(() => {
    if (!ticket || !container.current) return;
    let alive = true;
    let instance: DailyCall | undefined;
    async function join() {
      try {
        const { default: Daily } = await import("@daily-co/daily-js");
        if (!alive || !container.current) return;
        instance = Daily.createFrame(container.current, {
          iframeStyle: {
            width: "100%",
            height: "100%",
            border: "0",
            borderRadius: "16px",
          },
          showLeaveButton: true,
        });
        frame.current = instance;
        instance.on("left-meeting", () => {
          if (alive) setTicket(null);
        });
        instance.on("error", (e) => {
          if (alive)
            setError(
              e?.errorMsg || "The call disconnected. Close it and try again.",
            );
        });
        await instance.join({ url: ticket!.url, token: ticket!.token });
      } catch (e) {
        if (alive) {
          setError((e as Error).message);
          setTicket(null);
          setOpen(true);
        }
      }
    }
    void join();
    return () => {
      alive = false;
      frame.current = null;
      void instance?.destroy();
    };
  }, [ticket]);
  async function start(mode: "voice" | "video") {
    if (!window.isSecureContext) {
      setError(
        "Microphone and camera need an HTTPS invitation. Localhost also works on this computer.",
      );
      return;
    }
    setBusy(true);
    setError("");
    try {
      let headers: Record<string, string> = {};
      if (!info?.call) headers = await authHeaders();
      const r = await fetch(`/api/rooms/${roomId}/call`, {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({
          action: info?.call ? "join" : "start",
          mode,
          name: usePlay.getState().playerName,
        }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "Could not open the call.");
      setTicket(data);
      setOpen(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <button
        className="secondary"
        disabled={!connected || !!ticket}
        onClick={() => {
          setError("");
          setOpen(true);
        }}
      >
        <Phone size={15} />
        {ticket ? "In call" : info?.call ? "Join call · free" : "Voice / video"}
      </button>
      {open && (
        <Modal
          title={
            info?.call
              ? "Your friends are calling."
              : "A little closer, with Plus."
          }
          onClose={() => setOpen(false)}
        >
          <div className="coop-dialog">
            <p>
              {info?.call
                ? "Join free and keep creating while you chat."
                : "One Plus member hosts. Up to three friends join free, without an account."}
            </p>
            <p>
              Each call lasts up to 30 minutes. Your microphone and camera start
              off; you choose when to turn them on.
            </p>
            {!info ? (
              <p>Checking call availability…</p>
            ) : info.configured ? (
              info.call ? (
                <button
                  className="primary"
                  disabled={busy}
                  onClick={() => start(info.call!.mode)}
                >
                  {busy ? "Opening…" : "Join call free"}
                </button>
              ) : (
                <div className="call-actions">
                  <button
                    className="primary"
                    disabled={busy}
                    onClick={() => start("voice")}
                  >
                    <Phone size={16} />
                    Start voice
                  </button>
                  <button
                    className="secondary"
                    disabled={busy}
                    onClick={() => start("video")}
                  >
                    <Video size={16} />
                    Start video
                  </button>
                </div>
              )
            ) : (
              <p className="call-note">
                Calls aren’t enabled on this studio yet. Free co-op is ready to
                play.
              </p>
            )}
            <Link
              className="secondary"
              href="/account/plus"
              onClick={() => {
                try {
                  sessionStorage.setItem(
                    "pindou.returnRoom",
                    `/room/${roomId}`,
                  );
                } catch {}
              }}
            >
              View Plus / manage subscription
            </Link>
            {error && (
              <p role="alert" className="error-copy">
                {error}
              </p>
            )}
          </div>
        </Modal>
      )}
      {ticket && (
        <section className="call-dock" aria-label="Co-op call">
          <header>
            <strong>
              {ticket.mode === "voice" ? "Voice" : "Video"} with friends
            </strong>
            <small>
              Ends{" "}
              {new Date(ticket.expiresAt).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </small>
            <button
              className="icon-button"
              aria-label="Leave call"
              onClick={() => setTicket(null)}
            >
              <X size={18} />
            </button>
          </header>
          <div className="call-frame" ref={container} />
          {error && <p role="alert">{error}</p>}
        </section>
      )}
    </>
  );
}
