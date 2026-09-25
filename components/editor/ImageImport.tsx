"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Upload, ArrowRight } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { BeadArt } from "@/components/ui/BeadArt";
import { createProject } from "@/lib/presets";
import { convertPixels } from "@/lib/image-conversion";
import { saveProject } from "@/lib/storage";
import { useEditor } from "@/stores/editor";
import type { Cell } from "@/types/project";
export function ImageImport({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [source, setSource] = useState<HTMLImageElement | null>(null),
    [size, setSize] = useState(29),
    [limit, setLimit] = useState(12),
    [remove, setRemove] = useState(false),
    [contrast, setContrast] = useState(false),
    [cells, setCells] = useState<Cell[]>([]),
    [error, setError] = useState(""),
    [name, setName] = useState("My picture");
  function convert(
    img: HTMLImageElement,
    s: number,
    l: number,
    r: boolean,
    c: boolean,
  ) {
    const canvas = document.createElement("canvas");
    canvas.width = s;
    canvas.height = s;
    const ctx = canvas.getContext("2d")!;
    const side = Math.min(img.naturalWidth, img.naturalHeight);
    ctx.drawImage(
      img,
      (img.naturalWidth - side) / 2,
      (img.naturalHeight - side) / 2,
      side,
      side,
      0,
      0,
      s,
      s,
    );
    setCells(
      convertPixels(ctx.getImageData(0, 0, s, s).data, l, r, c ? 1.3 : 1),
    );
  }
  async function upload(file?: File) {
    if (!file) return;
    if (
      !["image/png", "image/jpeg", "image/webp"].includes(file.type) ||
      file.size > 10 * 1024 * 1024
    ) {
      setError("Choose a PNG, JPEG or WEBP smaller than 10 MB.");
      return;
    }
    setError("");
    const url = URL.createObjectURL(file),
      img = new Image();
    img.onload = () => {
      setSource(img);
      setName(file.name.replace(/\.[^.]+$/, "").slice(0, 80) || "My picture");
      convert(img, size, limit, remove, contrast);
      URL.revokeObjectURL(url);
    };
    img.onerror = () => {
      setError("That image could not be opened. Try another file.");
      URL.revokeObjectURL(url);
    };
    img.src = url;
  }
  return (
    <Modal title="Your picture, in little beads." onClose={onClose} wide>
      <p className="modal-description">
        Your image stays on this device. We use a centered square crop and match
        it to the bead palette.
      </p>
      <label className="upload-zone">
        <Upload size={28} />
        <strong>
          {source
            ? "Choose a different picture"
            : "Drop a little inspiration here"}
        </strong>
        <span>PNG, JPEG or WEBP · up to 10 MB</span>
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp"
          onChange={(e) => void upload(e.target.files?.[0])}
        />
      </label>
      {error ? (
        <p role="alert" className="error-copy">
          {error}
        </p>
      ) : null}
      <div className="import-controls">
        <label>
          Board size
          <select
            value={size}
            onChange={(e) => {
              const v = Number(e.target.value);
              setSize(v);
              if (source) convert(source, v, limit, remove, contrast);
            }}
          >
            {[16, 24, 29, 32, 48].map((s) => (
              <option key={s} value={s}>
                {s} × {s}
              </option>
            ))}
          </select>
        </label>
        <label>
          Palette
          <select
            value={limit}
            onChange={(e) => {
              const v = Number(e.target.value);
              setLimit(v);
              if (source) convert(source, size, v, remove, contrast);
            }}
          >
            {[8, 12, 16, 24, 36].map((v) => (
              <option key={v} value={v}>
                {v === 36 ? "Full palette" : `${v} colors`}
              </option>
            ))}
          </select>
        </label>
        <label className="checkbox">
          <input
            type="checkbox"
            checked={remove}
            onChange={(e) => {
              setRemove(e.target.checked);
              if (source)
                convert(source, size, limit, e.target.checked, contrast);
            }}
          />
          Remove white
        </label>
        <label className="checkbox">
          <input
            type="checkbox"
            checked={contrast}
            onChange={(e) => {
              setContrast(e.target.checked);
              if (source)
                convert(source, size, limit, remove, e.target.checked);
            }}
          />
          More contrast
        </label>
      </div>
      {cells.length ? (
        <>
          <div className="import-preview">
            <BeadArt cells={cells} width={size} name="Converted bead pattern" />
          </div>
          <button
            className="primary full"
            disabled={!cells.some(Boolean)}
            onClick={() => {
              const p = { ...createProject(size), name, cells };
              useEditor.getState().load(p);
              try {
                saveProject(p);
              } catch {}
              onClose();
              router.push(`/create/${p.id}`);
            }}
          >
            Bring it to the studio <ArrowRight size={17} />
          </button>
        </>
      ) : null}
    </Modal>
  );
}
