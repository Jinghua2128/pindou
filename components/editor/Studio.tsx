"use client";
import { newId } from "@/lib/id";
import dynamic from "next/dynamic";
import Link from "next/link";
import { Component, useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import gsap from "gsap";
import {
  ArrowDownToLine,
  ArrowRight,
  Box,
  Check,
  CheckCheck,
  Cloud,
  Grid2X2,
  HelpCircle,
  Maximize,
  Minus,
  Pencil,
  Plus,
  Redo2,
  Sparkles,
  Undo2,
  WifiOff,
  X,
} from "lucide-react";
import { Header } from "@/components/ui/Header";
import { Modal } from "@/components/ui/Modal";
import { Toolbar } from "./Toolbar";
import { CoopControls } from "./CoopControls";
import { PlayTable } from "./PlayTable";
import { useCoop } from "@/hooks/useCoop";
import { usePlay } from "@/stores/play";
import { Palette } from "./Palette";
import { TemplateRail } from "./TemplateRail";
import { NewProject } from "./NewProject";
import { ImageImport } from "./ImageImport";
import { OrderPreview } from "./OrderPreview";
import { useEditorLifecycle } from "@/hooks/useEditorLifecycle";
import { useEditor } from "@/stores/editor";
import { createProject, type Preset } from "@/lib/presets";
import { saveProject } from "@/lib/storage";
import { exportBOM, exportPNG, exportProject } from "@/lib/export";
import { reducedMotion } from "@/lib/motion";
import {
  projectSchema,
  type CameraMode,
  type MotionMode,
} from "@/types/project";

const BeadScene = dynamic(() => import("@/components/three/BeadScene"), {
  ssr: false,
  loading: () => (
    <div className="scene-loading">
      <span />
      <span />
      <span />
      <p>Setting out your little beads…</p>
    </div>
  ),
});
class SceneBoundary extends Component<
  { children: ReactNode },
  { error: boolean }
> {
  state = { error: false };
  static getDerivedStateFromError() {
    return { error: true };
  }
  render() {
    return this.state.error ? (
      <div className="canvas-fallback">
        <h3>The 3D table couldn’t open.</h3>
        <p>
          Try enabling hardware acceleration or reloading. You can still export
          your project.
        </p>
        <button className="secondary" onClick={() => location.reload()}>
          Reload studio
        </button>
      </div>
    ) : (
      this.props.children
    );
  }
}
type Dialog =
  "new" | "image" | "export" | "settings" | "help" | "clear" | "order" | null;
export function Studio({
  projectId,
  roomId,
  create = false,
}: {
  projectId?: string;
  roomId?: string;
  create?: boolean;
}) {
  const router = useRouter(),
    { ready, saveState, offline, missing } = useEditorLifecycle(
      projectId,
      !!roomId,
    );
  useCoop(roomId, ready);
  const roomReady = usePlay((s) => s.hydrated);
  const roomStatus = usePlay((s) => s.status);
  const [dialog, setDialog] = useState<Dialog>(create ? "new" : null),
    [rename, setRename] = useState(false),
    [name, setName] = useState(""),
    [toast, setToast] = useState(""),
    [fuseStage, setFuseStage] = useState("");
  const root = useRef<HTMLDivElement>(null),
    fuseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const project = useEditor((s) => s.project),
    camera = useEditor((s) => s.camera),
    zoom = useEditor((s) => s.zoom),
    past = useEditor((s) => s.past),
    future = useEditor((s) => s.future),
    fusing = useEditor((s) => s.fusing),
    fused = useEditor((s) => s.fused),
    motion = useEditor((s) => s.motion),
    sound = useEditor((s) => s.sound),
    grid = useEditor((s) => s.grid),
    selection = useEditor((s) => s.selection);
  const count = project.cells.filter(Boolean).length,
    colors = new Set(project.cells.filter(Boolean)).size;
  useEffect(() => {
    if (!ready || reducedMotion()) return;
    const ctx = gsap.context(() => {
      gsap.from(".studio-intro", { y: 10, opacity: 0, duration: 0.5 });
      gsap.from(".workspace", {
        y: 18,
        opacity: 0,
        duration: 0.65,
        delay: 0.1,
      });
      gsap.from(".template-rail", {
        y: 12,
        opacity: 0,
        duration: 0.5,
        delay: 0.25,
      });
    }, root);
    return () => ctx.revert();
  }, [ready]);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 3500);
    return () => clearTimeout(t);
  }, [toast]);
  useEffect(
    () => () => {
      if (fuseTimer.current) clearTimeout(fuseTimer.current);
      useEditor.setState({ fusing: false });
    },
    [],
  );
  function choose(preset: Preset) {
    try {
      saveProject(useEditor.getState().project);
    } catch {}
    const p = createProject(preset.size, preset);
    useEditor.getState().load(p);
    try {
      saveProject(p);
    } catch {}
    router.push(`/create/${p.id}`);
  }
  function fuse() {
    useEditor.getState().end();
    useEditor.getState().setCamera("top");
    useEditor.setState({ fusing: true });
    setFuseStage("A little warmth. A little magic.");
    fuseTimer.current = setTimeout(
      () => {
        useEditor.setState({ fusing: false, fused: true, tool: "hand" });
        useEditor.getState().setCamera("iso");
        setFuseStage("");
        setToast("Made by you. Every single little bead.");
      },
      reducedMotion() ? 250 : 2500,
    );
  }
  async function importProject(file?: File) {
    if (!file) return;
    try {
      if (file.size > 1024 * 1024) throw new Error("Too large");
      const parsed = projectSchema.parse(JSON.parse(await file.text()));
      const p = {
        ...parsed,
        id: newId(),
        name: `${parsed.name.slice(0, 69)} (imported)`,
      };
      useEditor.getState().load(p);
      saveProject(p);
      setDialog(null);
      router.push(`/create/${p.id}`);
    } catch {
      setToast(
        "That project file could not be opened. Use a PinDou JSON export.",
      );
    }
  }
  if (missing)
    return (
      <>
        <Header />
        <main className="empty-page">
          <h1>This little creation isn’t on this device.</h1>
          <p>Guest projects are saved in the browser where you made them.</p>
          <Link className="primary" href="/account/projects">
            Open my creations <ArrowRight size={17} />
          </Link>
        </main>
      </>
    );
  return (
    <div ref={root}>
      <Header onSettings={() => setDialog("settings")} />
      <main className="studio-main">
        <div className="studio-intro">
          <div>
            <h1>Little things, made by you.</h1>
            <p>A little color. A little patience. Something entirely yours.</p>
          </div>
          <button
            className="primary new-button"
            aria-label="New creation"
            onClick={() => setDialog("new")}
          >
            <Plus size={21} />
            <span>New creation</span>
          </button>
        </div>
        {offline ? (
          <div className="offline-notice">
            <WifiOff size={16} />
            You’re offline. Your work is saved on this device.
          </div>
        ) : null}
        <CoopControls roomId={roomId} />
        <div className="workspace">
          <section
            className={`craft-table ${fusing ? "is-fusing" : ""} ${fused ? "is-fused" : ""}`}
            aria-label="Bead creation workspace"
          >
            <div className="canvas-header">
              <div className="project-title">
                {rename ? (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      useEditor.getState().rename(name);
                      setRename(false);
                    }}
                  >
                    <input
                      aria-label="Project name"
                      autoFocus
                      value={name}
                      maxLength={80}
                      onChange={(e) => setName(e.target.value)}
                      onBlur={() => {
                        useEditor.getState().rename(name);
                        setRename(false);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Escape") setRename(false);
                      }}
                    />
                  </form>
                ) : (
                  <button
                    onClick={() => {
                      setName(project.name);
                      setRename(true);
                    }}
                    title="Rename project"
                  >
                    <strong>{project.name}</strong>
                    <Pencil size={15} />
                  </button>
                )}
                <span
                  className={`save-state ${saveState.includes("failed") ? "error-copy" : ""}`}
                  aria-live="polite"
                >
                  <Cloud size={18} />
                  <span>{saveState}</span>
                </span>
              </div>
              <div className="canvas-actions">
                <button
                  className="icon-button"
                  aria-label="Undo"
                  title="Undo (⌘ / Ctrl Z)"
                  disabled={!past.length || fusing}
                  onClick={() => useEditor.getState().undo()}
                >
                  <Undo2 size={20} />
                </button>
                <button
                  className="icon-button"
                  aria-label="Redo"
                  title="Redo (⌘ / Ctrl Shift Z)"
                  disabled={!future.length || fusing}
                  onClick={() => useEditor.getState().redo()}
                >
                  <Redo2 size={20} />
                </button>
                <span className="action-divider" />
                <button
                  className="secondary export-button"
                  aria-label="Export"
                  onClick={() => setDialog("export")}
                >
                  <ArrowDownToLine size={17} />
                  <span>Export</span>
                </button>
              </div>
            </div>
            <div
              className="scene-container"
              onContextMenu={(e) => e.preventDefault()}
            >
              {ready ? (
                <SceneBoundary>
                  <BeadScene />
                </SceneBoundary>
              ) : (
                <div className="scene-loading">
                  <span />
                  <span />
                  <span />
                  <p>Setting out your little beads…</p>
                </div>
              )}
            </div>
            {roomId && !roomReady && (
              <div className="room-loading" role="status">
                <strong>{roomStatus}</strong>
                <p>Your shared board will appear here.</p>
              </div>
            )}
            <Toolbar onClear={() => setDialog("clear")} />
            <div className="desk-note note-top">
              Good things
              <br />
              take shape. <span>♡</span>
            </div>
            <div className="desk-note note-bottom">
              Beads today,
              <br />
              happy little
              <br />
              things tomorrow.<span> ↗</span>
            </div>
            {fusing ? (
              <div className="fuse-overlay">
                <div className="heat-sweep" />
                <span>
                  <Sparkles size={21} />
                  {fuseStage}
                </span>
              </div>
            ) : null}
            {fused ? (
              <div className="finished-badge">
                <CheckCheck size={17} />
                Freshly fused{" "}
                <button
                  onClick={() => {
                    useEditor.setState({ fused: false, tool: "pencil" });
                  }}
                >
                  Keep creating <Pencil size={13} />
                </button>
              </div>
            ) : null}
            {selection ? (
              <div className="selection-hint">
                Use arrow keys to move your selection{" "}
                <button
                  onClick={() => useEditor.setState({ selection: null })}
                  aria-label="Clear selection"
                >
                  <X size={14} />
                </button>
              </div>
            ) : null}
            <div className="canvas-bottom">
              <span className="grid-caption">
                {project.width} × {project.height} pegboard
              </span>
              <div className="view-controls" aria-label="Camera view">
                {(
                  [
                    { id: "top", label: "Top", Icon: Grid2X2 },
                    { id: "iso", label: "Isometric", Icon: Box },
                    { id: "3d", label: "3D", Icon: Maximize },
                  ] as const
                ).map(({ id, label, Icon }) => (
                  <button
                    key={id}
                    aria-pressed={camera === id}
                    className={camera === id ? "selected" : ""}
                    onClick={() =>
                      useEditor.getState().setCamera(id as CameraMode)
                    }
                  >
                    <Icon size={17} />
                    <span>{label}</span>
                  </button>
                ))}
              </div>
              <div className="zoom-controls">
                <button
                  aria-label="Zoom out"
                  onClick={() => useEditor.getState().setZoom(zoom - 15)}
                >
                  <Minus size={16} />
                </button>
                <button
                  className="zoom-value"
                  title="Reset camera and zoom"
                  onClick={() => {
                    useEditor.getState().setZoom(100);
                    useEditor.getState().setCamera("iso");
                  }}
                >
                  {zoom}%
                </button>
                <button
                  aria-label="Zoom in"
                  onClick={() => useEditor.getState().setZoom(zoom + 15)}
                >
                  <Plus size={16} />
                </button>
              </div>
            </div>
          </section>
          <Palette onFuse={fuse} onReal={() => setDialog("order")} />
        </div>
        <PlayTable />
        <div className="workspace-status">
          <span>
            <i />
            {count} beads <span className="status-dot">·</span> {colors} colors{" "}
            <span className="status-dot">·</span> A little joy in progress
          </span>
          <button onClick={() => setDialog("help")}>
            <HelpCircle size={14} />
            Shortcuts & tips
          </button>
        </div>
        <TemplateRail onChoose={choose} />
        <footer className="studio-footer">
          <span>Made of little things. Made by you.</span>
          <span>
            pindou studio <span>✳</span>
          </span>
        </footer>
      </main>
      {dialog === "new" ? (
        <NewProject
          onClose={() => setDialog(null)}
          onImage={() => setDialog("image")}
        />
      ) : null}
      {dialog === "image" ? (
        <ImageImport onClose={() => setDialog(null)} />
      ) : null}
      {dialog === "order" ? (
        <OrderPreview onClose={() => setDialog(null)} />
      ) : null}
      {dialog === "export" ? (
        <Modal
          title="Keep a little piece of this."
          onClose={() => setDialog(null)}
        >
          <p className="modal-description">
            Take your creation with you. Project files can be opened here again.
          </p>
          <div className="export-options">
            <button
              onClick={() => {
                exportPNG(project);
                setToast("Your share card is ready.");
              }}
            >
              <ArrowDownToLine />
              <span>
                <strong>Export PNG</strong>
                <small>A shareable picture of your creation</small>
              </span>
              <ArrowRight size={17} />
            </button>
            <button onClick={() => exportProject(project)}>
              <Box />
              <span>
                <strong>Save project file</strong>
                <small>Editable grid, colors, and project details</small>
              </span>
              <ArrowRight size={17} />
            </button>
            <button onClick={() => exportBOM(project)}>
              <Grid2X2 />
              <span>
                <strong>Material list</strong>
                <small>Color names, SKUs, and bead quantities</small>
              </span>
              <ArrowRight size={17} />
            </button>
          </div>
          <label className="import-file">
            Open a project file
            <input
              type="file"
              accept=".json"
              onChange={(e) => void importProject(e.target.files?.[0])}
            />
          </label>
        </Modal>
      ) : null}
      {dialog === "settings" ? (
        <Modal title="Make yourself at home." onClose={() => setDialog(null)}>
          <div className="settings-row">
            <div>
              <strong>Motion effects</strong>
              <p>A little movement, at your pace.</p>
            </div>
            <select
              aria-label="Motion effects"
              value={motion}
              onChange={(e) =>
                useEditor.getState().setMotion(e.target.value as MotionMode)
              }
            >
              <option value="full">Full</option>
              <option value="reduced">Reduced</option>
              <option value="minimal">Minimal</option>
            </select>
          </div>
          <div className="settings-row">
            <div>
              <strong>Soft sounds</strong>
              <p>A tiny click for each finished stroke.</p>
            </div>
            <button
              className={`toggle ${sound ? "on" : ""}`}
              role="switch"
              aria-label="Soft sounds"
              aria-checked={sound}
              onClick={() => useEditor.setState({ sound: !sound })}
            >
              <span />
            </button>
          </div>
          <div className="settings-row">
            <div>
              <strong>Show pegs</strong>
              <p>Your little guide to the grid.</p>
            </div>
            <button
              className={`toggle ${grid ? "on" : ""}`}
              role="switch"
              aria-label="Show pegs"
              aria-checked={grid}
              onClick={() => useEditor.setState({ grid: !grid })}
            >
              <span />
            </button>
          </div>
          <div className="local-notice">
            <Cloud size={19} />
            <p>
              You’re creating as a guest. Your projects stay in this browser.
              Export a project file for a backup.
            </p>
          </div>
        </Modal>
      ) : null}
      {dialog === "help" ? (
        <Modal title="A few little pointers." onClose={() => setDialog(null)}>
          <div className="shortcut-list">
            {[
              ["B", "Pencil"],
              ["G", "Grab, move or swap a bead"],
              ["Escape", "Put held bead back"],
              ["E", "Eraser"],
              ["I", "Pick a color"],
              ["F", "Fill an area"],
              ["L / R", "Line / rectangle"],
              ["M", "Mirror drawing"],
              ["V + arrows", "Select and move beads"],
              ["H / Space", "Pan · orbit in 3D view"],
              ["⌘ / Ctrl Z", "Undo a whole stroke"],
              ["⌘ / Ctrl Shift Z", "Redo"],
              ["1 / 2 / 3", "Top / isometric / 3D"],
            ].map(([key, label]) => (
              <div key={key}>
                <span>{label}</span>
                <kbd>{key}</kbd>
              </div>
            ))}
          </div>
          <p className="muted small-copy">
            Click or drag to paint. Right-click to erase. Scroll to zoom. On
            touch screens, use two fingers to zoom and pan. The Move tool
            rotates your work in 3D view.
          </p>
          <p className="muted small-copy">
            For keyboard placement, use the accessible grid below.
          </p>
          <KeyboardGrid />
        </Modal>
      ) : null}
      {dialog === "clear" ? (
        <Modal title="A fresh little start?" onClose={() => setDialog(null)}>
          <p className="modal-description">
            Clear every bead from this board. You can always undo it.
          </p>
          <div className="dialog-actions">
            <button className="secondary" onClick={() => setDialog(null)}>
              Keep creating
            </button>
            <button
              className="primary"
              onClick={() => {
                useEditor.getState().clear();
                setDialog(null);
              }}
            >
              Clear board
            </button>
          </div>
        </Modal>
      ) : null}
      {toast ? (
        <div className="toast" role="status">
          <Check size={17} />
          {toast}
        </div>
      ) : null}
    </div>
  );
}
function KeyboardGrid() {
  const [x, setX] = useState(1),
    [y, setY] = useState(1);
  const width = useEditor((s) => s.project.width),
    height = useEditor((s) => s.project.height);
  return (
    <div className="keyboard-placement">
      <label>
        Column
        <input
          type="number"
          min={1}
          max={width}
          value={x}
          onChange={(e) =>
            setX(Math.max(1, Math.min(width, Number(e.target.value))))
          }
        />
      </label>
      <label>
        Row
        <input
          type="number"
          min={1}
          max={height}
          value={y}
          onChange={(e) =>
            setY(Math.max(1, Math.min(height, Number(e.target.value))))
          }
        />
      </label>
      <button
        className="secondary"
        onClick={() => {
          const index = (y - 1) * width + x - 1;
          const play = usePlay.getState(),
            editor = useEditor.getState();
          if (play.held) {
            play.place(index);
            return;
          }
          if (editor.tool === "grab") {
            const color = editor.project.cells[index];
            if (color) play.pick({ color, source: index });
            return;
          }
          editor.begin(index);
          useEditor.getState().end();
        }}
      >
        Use selected tool
      </button>
    </div>
  );
}
