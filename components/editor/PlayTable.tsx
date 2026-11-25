"use client";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { PackagePlus, RotateCcw, X } from "lucide-react";
import { usePlay } from "@/stores/play";
import { useEditor } from "@/stores/editor";
import { Modal } from "@/components/ui/Modal";
import { MAX_BOXES } from "@/lib/co-op";
import { COLORS, COLOR_MAP } from "@/lib/colors";

export function PlayTable({ shared }: { shared: boolean }) {
  const held = usePlay((s) => s.held),
    notice = usePlay((s) => s.notice),
    placement = useEditor((s) => s.placement);
  const [boxesOpen, setBoxesOpen] = useState(false),
    [boxError, setBoxError] = useState("");
  const toys = usePlay((s) => s.toys),
    boxes = toys.filter((t) => t.kind === "tray");
  const fused = useEditor((s) => s.fused || s.fusing);
  const cursor = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const move = (e: PointerEvent) => {
      if (cursor.current)
        cursor.current.style.transform = `translate3d(${e.clientX + 8}px,${e.clientY - 20}px,0)`;
    };
    const cancel = () =>
      usePlay.setState({
        held: null,
        hover: null,
        draggingTray: null,
        position: null,
      });
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") cancel();
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerdown", move);
    window.addEventListener("keydown", key);
    window.addEventListener("blur", cancel);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerdown", move);
      window.removeEventListener("keydown", key);
      window.removeEventListener("blur", cancel);
      cancel();
    };
  }, []);
  return (
    <div className="table-controls" aria-label="Craft table controls">
      {!shared && (
        <div
          className="placement-switch"
          role="group"
          aria-label="Bead placement"
        >
          {(["classic", "interactive"] as const).map((method) => (
            <button
              key={method}
              aria-pressed={placement === method}
              onClick={() => {
                if (method === placement) return;
                usePlay.setState({ held: null, hover: null, notice: "" });
                useEditor.getState().setPlacement(method);
                try {
                  localStorage.setItem("pindou.placement", method);
                } catch {}
              }}
            >
              {method === "classic" ? "Classic" : "Interactive"}
            </button>
          ))}
        </div>
      )}
      <div className="pickup-status" role="status">
        {held ? (
          <>
            <i
              className="physical-bead"
              style={{ "--bead": COLOR_MAP[held.color].hex } as CSSProperties}
            />
            Holding {COLOR_MAP[held.color].name}
            <button
              aria-label="Put bead back"
              title="Put bead back"
              onClick={() => usePlay.setState({ held: null })}
            >
              <X size={15} />
            </button>
          </>
        ) : (
          notice ||
          (placement === "interactive"
            ? "Take a bead from a box, then tap a peg."
            : "Click or drag to paint.")
        )}
      </div>
      <div className="box-actions">
        <button
          className="add-box"
          aria-haspopup="dialog"
          disabled={fused}
          onClick={() => {
            setBoxError("");
            setBoxesOpen(true);
          }}
        >
          <PackagePlus size={16} />
          <span>Add box</span>
        </button>
        <button
          className="tidy-table"
          title="Tidy table"
          aria-label="Tidy table"
          onClick={() => usePlay.getState().tidy()}
        >
          <RotateCcw size={15} />
          <span>Tidy</span>
        </button>
      </div>
      {boxesOpen && (
        <Modal title="Bead boxes" onClose={() => setBoxesOpen(false)}>
          <div className="box-inventory">
            <div className="box-inventory-heading">
              <h3>On the table</h3>
              <span>
                {boxes.length} / {MAX_BOXES}
              </span>
            </div>
            <p>
              Drag a box by its rim or grip. Swing it quickly to spill beads.
            </p>
            <div className="box-chips">
              {boxes.map((t) => (
                <span key={t.id} className="box-chip">
                  <i style={{ background: COLOR_MAP[t.color].hex }} />
                  {COLOR_MAP[t.color].name}
                  {t.side && (
                    <button
                      aria-label={`Put away ${COLOR_MAP[t.color].name} box`}
                      onClick={() => {
                        usePlay.getState().putAway(t.id);
                        setBoxError("");
                      }}
                    >
                      <X size={13} />
                    </button>
                  )}
                </span>
              ))}
            </div>
            {boxes.length < MAX_BOXES ? (
              <>
                <h3>Add a color</h3>
                <div className="box-colors">
                  {COLORS.map((c) => (
                    <button
                      key={c.id}
                      aria-label={`Add ${c.name} box`}
                      title={c.name}
                      onClick={() => {
                        if (usePlay.getState().addBox(c.id))
                          setBoxesOpen(false);
                        else
                          setBoxError(
                            "Tidy the table to make room for a new box.",
                          );
                      }}
                    >
                      <i
                        className="bead-swatch"
                        style={{ "--bead-color": c.hex } as CSSProperties}
                      />
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <p>Put away an extra box to add another color.</p>
            )}
            {boxError && <p role="alert">{boxError}</p>}
          </div>
        </Modal>
      )}
      <div
        ref={cursor}
        className="held-bead-cursor"
        aria-hidden="true"
        hidden={!held}
      >
        {held && (
          <i
            className="physical-bead"
            style={{ "--bead": COLOR_MAP[held.color].hex } as CSSProperties}
          />
        )}
      </div>
    </div>
  );
}
