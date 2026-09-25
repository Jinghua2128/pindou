"use client";
import { useMemo, useState } from "react";
import {
  Flame,
  Sprout,
  Check,
  ArrowRight,
  Palette as PaletteIcon,
  X,
} from "lucide-react";
import Link from "next/link";
import { useEditor } from "@/stores/editor";
import { COLORS, COLOR_MAP } from "@/lib/colors";
import { billOfMaterials, structuralCheck } from "@/lib/grid";
import { animatePress } from "@/lib/motion";
import { PRESETS } from "@/lib/presets";
import { exportBOM } from "@/lib/export";
import { useBeadDrag } from "@/hooks/useBeadDrag";
export function Palette({
  onFuse,
  onReal,
}: {
  onFuse: () => void;
  onReal: () => void;
}) {
  const dragBead = useBeadDrag();
  const [tab, setTab] = useState("Colors"),
    [expanded, setExpanded] = useState(false),
    [all, setAll] = useState(false);
  const color = useEditor((s) => s.color),
    setColor = useEditor((s) => s.setColor),
    project = useEditor((s) => s.project),
    fused = useEditor((s) => s.fused),
    fusing = useEditor((s) => s.fusing),
    recent = useEditor((s) => s.recent);
  const bom = useMemo(() => billOfMaterials(project.cells), [project.cells]);
  const selected = COLOR_MAP[color],
    count = bom.reduce((n, r) => n + r.quantity, 0),
    preset = PRESETS.find((p) => p.id === project.presetId);
  const guide = project.guide,
    goal = guide?.filter(Boolean).length || 0,
    done = guide?.filter((c, i) => c && c === project.cells[i]).length || 0;
  const swatch = (id: string, small = false) => (
    <button
      key={id}
      title={`${COLOR_MAP[id].name} · ${COLOR_MAP[id].sku}`}
      aria-label={`Select ${COLOR_MAP[id].name}`}
      aria-pressed={color === id}
      className={`swatch ${small ? "small" : ""} ${color === id ? "selected" : ""}`}
      onPointerDown={(e) => dragBead(e, id)}
      onClick={(e) => {
        setColor(id);
        animatePress(e.currentTarget.querySelector("span")!);
      }}
    >
      <span
        className="bead-swatch"
        style={{ "--bead-color": COLOR_MAP[id].hex } as React.CSSProperties}
      />
    </button>
  );
  return (
    <aside className={`palette-panel ${expanded ? "expanded" : ""}`}>
      <button
        className="mobile-palette-toggle"
        onClick={() => setExpanded(!expanded)}
      >
        <PaletteIcon size={19} />
        <span>Colors & details</span>
        <span
          className="mobile-selected"
          style={{ background: selected.hex }}
        />
        {expanded ? <X size={18} /> : <span>{selected.name}</span>}
      </button>
      <div className="palette-content">
        <div
          className="panel-tabs"
          role="tablist"
          aria-label="Project inspector"
        >
          {["Colors", "Template", "Stats"].map((t) => (
            <button
              key={t}
              role="tab"
              aria-selected={t === tab}
              className={tab === t ? "active" : ""}
              onClick={() => setTab(t)}
            >
              {t}
            </button>
          ))}
        </div>
        <div className="inspector-body">
          {tab === "Colors" ? (
            <>
              <div className="selected-color">
                <span
                  className="bead-swatch large"
                  style={
                    { "--bead-color": selected.hex } as React.CSSProperties
                  }
                />
                <div>
                  <strong>{selected.name}</strong>
                  <span>
                    {selected.hex.toUpperCase()} <small>· {selected.sku}</small>
                  </span>
                  <p>Pick a color, or drag a bead to the board.</p>
                </div>
              </div>
              <div className="swatch-grid">
                {(all ? COLORS : COLORS.slice(0, 24)).map((c) => swatch(c.id))}
              </div>
              <button
                className="text-button more-colors"
                onClick={() => setAll(!all)}
              >
                {all ? "Show fewer colors" : "All 36 colors"}{" "}
                <ArrowRight size={14} />
              </button>
              <div className="project-colors">
                <div className="section-label">
                  Project colors <span>({bom.length})</span>
                </div>
                <div className="color-row">
                  {bom.length ? (
                    bom.slice(0, 7).map((row) => swatch(row.colorId, true))
                  ) : (
                    <span className="muted small-copy">
                      Your palette starts with your first bead.
                    </span>
                  )}
                </div>
              </div>
              <div className="recent-colors">
                <div className="section-label">Recently used</div>
                <div className="color-row">
                  {recent.slice(0, 6).map((id) => swatch(id, true))}
                </div>
              </div>
            </>
          ) : tab === "Stats" ? (
            <>
              <div className="stats-heading">
                <strong>{count.toLocaleString()}</strong>
                <span>little beads. One big idea.</span>
              </div>
              <div className="stat-row">
                <span>Board size</span>
                <strong>
                  {project.width} × {project.height}
                </strong>
              </div>
              <div className="stat-row">
                <span>Colors used</span>
                <strong>{bom.length}</strong>
              </div>
              <div className="bom-list">
                {bom.map((row) => (
                  <div className="bom-row" key={row.colorId}>
                    <i style={{ background: COLOR_MAP[row.colorId].hex }} />
                    <span>
                      {COLOR_MAP[row.colorId].name}
                      <small>{COLOR_MAP[row.colorId].sku}</small>
                    </span>
                    <strong>{row.quantity}</strong>
                  </div>
                ))}
              </div>
              {count > 0 ? (
                <>
                  <p className="muted small-copy">
                    {
                      structuralCheck(
                        project.cells,
                        project.width,
                        project.height,
                      ).groups.length
                    }{" "}
                    connected section(s). Each separate section would be made
                    individually.
                  </p>
                  <button
                    className="secondary full"
                    onClick={() => exportBOM(project)}
                  >
                    Export material list
                  </button>
                </>
              ) : null}
            </>
          ) : (
            <div className="template-info">
              <Sprout size={30} />
              <h3>{preset?.name || "Room for your imagination."}</h3>
              <p>
                {guide
                  ? "Follow the faint beads. Match the color to bring your design to life."
                  : preset
                    ? "This template is yours to remix. Try a different color, add a detail, or make it completely your own."
                    : "Every great idea starts with one little bead. Or find a pattern to get you going."}
              </p>
              {guide ? (
                <>
                  <div className="progress-track">
                    <span
                      style={{ width: `${goal ? (done / goal) * 100 : 0}%` }}
                    />
                  </div>
                  <strong>
                    {done} / {goal} beads matched
                  </strong>
                  <p>
                    {goal && done === goal
                      ? "You did it! Ready for the finishing touch?"
                      : `${Math.round(goal ? (done / goal) * 100 : 0)}% complete`}
                  </p>
                </>
              ) : null}
              <Link className="secondary full" href="/presets">
                Explore templates <ArrowRight size={16} />
              </Link>
            </div>
          )}
        </div>
        <div className="fuse-card">
          <div>
            <Sprout size={21} />
            <strong>
              {fused
                ? "Ready for the real world."
                : "Made to leave the screen."}
            </strong>
          </div>
          <p>
            {fused
              ? "Your tiny masterpiece, finished."
              : "Turn your design into something real with fuse beads."}
          </p>
          <button
            className="primary full"
            disabled={!count || fusing}
            onClick={fused ? onReal : onFuse}
          >
            {fused ? <Check size={17} /> : <Flame size={17} />}{" "}
            {fusing
              ? "A little warmth…"
              : fused
                ? "Make it real"
                : "Fuse creation"}
            {fused ? <ArrowRight size={16} /> : null}
          </button>
        </div>
      </div>
    </aside>
  );
}
