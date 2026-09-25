"use client";
import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent,
} from "react";
import { GripHorizontal, RotateCcw, Sparkles, X } from "lucide-react";
import { usePlay } from "@/stores/play";
import { useEditor } from "@/stores/editor";
import { COLOR_MAP } from "@/lib/colors";
import type { Toy } from "@/lib/co-op";

export function PlayTable() {
  const toys = usePlay((s) => s.toys),
    held = usePlay((s) => s.held),
    notice = usePlay((s) => s.notice);
  const fused = useEditor((s) => s.fused || s.fusing);
  const area = useRef<HTMLDivElement>(null),
    cursor = useRef<HTMLDivElement>(null);
  const drag = useRef<{
    id: string;
    startX: number;
    startY: number;
    x: number;
    y: number;
  } | null>(null);
  const [announcement, setAnnouncement] = useState("");
  useEffect(() => {
    const move = (e: globalThis.PointerEvent) => {
      if (cursor.current) {
        cursor.current.style.transform = `translate3d(${e.clientX + 13}px,${e.clientY - 14}px,0)`;
        cursor.current.style.opacity = "1";
      }
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") usePlay.setState({ held: null });
    };
    const cancel = () => {
      drag.current = null;
      usePlay.setState({ draggingTray: false });
      usePlay.setState({ held: null, hover: null });
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("keydown", key);
    window.addEventListener("blur", cancel);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("keydown", key);
      window.removeEventListener("blur", cancel);
      usePlay.setState({ draggingTray: false });
    };
  }, []);
  useEffect(() => {
    const timer = setTimeout(() => setAnnouncement(notice), 0);
    const clear = setTimeout(() => setAnnouncement(""), 4000);
    return () => {
      clearTimeout(timer);
      clearTimeout(clear);
    };
  }, [notice]);
  function start(e: PointerEvent, toy: Toy) {
    if (e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = {
      id: toy.id,
      startX: e.clientX,
      startY: e.clientY,
      x: toy.x,
      y: toy.y,
    };
    usePlay.setState({ draggingTray: true });
  }
  function move(e: PointerEvent) {
    if (!drag.current || !area.current) return;
    const rect = area.current.getBoundingClientRect(),
      d = drag.current;
    usePlay
      .getState()
      .moveToy(
        d.id,
        d.x + ((e.clientX - d.startX) / rect.width) * 100,
        d.y + ((e.clientY - d.startY) / rect.height) * 100,
      );
  }
  function end() {
    drag.current = null;
    usePlay.setState({ draggingTray: false });
  }
  function take(e: PointerEvent, color: string, looseId?: string) {
    if (e.button !== 0) return;
    usePlay
      .getState()
      .pick({ color, looseId, start: { x: e.clientX, y: e.clientY } });
  }
  return (
    <section className="play-table" aria-label="Playful bead table">
      <div className="play-table-heading">
        <div>
          <span className="eyebrow">A LITTLE ROOM TO PLAY</span>
          <h2>Good company. Happy accidents.</h2>
          <p>Drag a box. Spill some beads. Take one to the board.</p>
        </div>
        <button className="secondary" onClick={() => usePlay.getState().tidy()}>
          <RotateCcw size={15} />
          Tidy table
        </button>
      </div>
      <div className="toy-surface" ref={area}>
        <span className="table-scribble">
          a little mess
          <br />
          is part of the making ↗
        </span>
        {toys.map((toy) =>
          toy.kind === "tray" ? (
            <div
              key={toy.id}
              className="bead-tray"
              data-tray={toy.id}
              style={
                {
                  left: `${toy.x}%`,
                  top: `${toy.y}%`,
                  "--tilt": `${toy.angle}deg`,
                  "--bead": COLOR_MAP[toy.color].hex,
                } as CSSProperties
              }
            >
              <button
                className="tray-handle"
                aria-label={`Move ${COLOR_MAP[toy.color].name} box`}
                onPointerDown={(e) => start(e, toy)}
                onPointerMove={move}
                onPointerUp={end}
                onPointerCancel={end}
                onLostPointerCapture={end}
                onKeyDown={(e) => {
                  if (
                    [
                      "ArrowLeft",
                      "ArrowRight",
                      "ArrowUp",
                      "ArrowDown",
                    ].includes(e.key)
                  ) {
                    e.preventDefault();
                    usePlay
                      .getState()
                      .moveToy(
                        toy.id,
                        toy.x +
                          (e.key === "ArrowLeft"
                            ? -3
                            : e.key === "ArrowRight"
                              ? 3
                              : 0),
                        toy.y +
                          (e.key === "ArrowUp"
                            ? -5
                            : e.key === "ArrowDown"
                              ? 5
                              : 0),
                      );
                  }
                }}
              >
                <GripHorizontal size={18} />
                <span>{COLOR_MAP[toy.color].name}</span>
              </button>
              <button
                className="tray-beads"
                aria-label={`Take ${COLOR_MAP[toy.color].name} bead`}
                disabled={fused}
                onPointerDown={(e) => take(e, toy.color)}
                onClick={(e) => {
                  if (e.detail === 0)
                    usePlay.getState().pick({ color: toy.color });
                }}
              >
                {Array.from({ length: 12 }, (_, i) => (
                  <i
                    className="physical-bead"
                    key={i}
                    style={{ rotate: `${i * 17}deg` }}
                  />
                ))}
              </button>
              <button
                className="spill-button"
                aria-label={`Spill ${COLOR_MAP[toy.color].name} box`}
                onClick={() => usePlay.getState().spill(toy.id)}
              >
                <Sparkles size={12} /> Oops, spill!
              </button>
            </div>
          ) : (
            <button
              key={toy.id}
              className={`loose-bead physical-bead ${held?.looseId === toy.id ? "is-held" : ""}`}
              aria-label={`Pick up spilled ${COLOR_MAP[toy.color].name} bead`}
              disabled={fused}
              style={
                {
                  left: `${toy.x}%`,
                  top: `${toy.y}%`,
                  rotate: `${toy.angle}deg`,
                  "--bead": COLOR_MAP[toy.color].hex,
                } as CSSProperties
              }
              onPointerDown={(e) => take(e, toy.color, toy.id)}
              onClick={(e) => {
                if (e.detail === 0)
                  usePlay
                    .getState()
                    .pick({ color: toy.color, looseId: toy.id });
              }}
            />
          ),
        )}
      </div>
      <div className={`pickup-status ${held ? "has-bead" : ""}`} role="status">
        {held ? (
          <>
            <i
              className="physical-bead"
              style={{ "--bead": COLOR_MAP[held.color].hex } as CSSProperties}
            />
            <span>
              Holding {COLOR_MAP[held.color].name}. Drop or tap a peg to place
              it.
            </span>
            <button
              aria-label="Put bead back"
              onClick={() => usePlay.setState({ held: null })}
            >
              <X size={16} />
            </button>
          </>
        ) : (
          <span>
            {announcement ||
              "Tip: use Grab bead (G) to move a bead. Drop onto another bead to swap them."}
          </span>
        )}
      </div>
      {held && (
        <div ref={cursor} className="held-bead-cursor" aria-hidden="true">
          <i
            className="physical-bead"
            style={{ "--bead": COLOR_MAP[held.color].hex } as CSSProperties}
          />
          <span>drop me</span>
        </div>
      )}
    </section>
  );
}
