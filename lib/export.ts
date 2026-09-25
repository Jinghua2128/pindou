import type { BeadProject } from "@/types/project";
import { COLOR_MAP } from "./colors";
import { billOfMaterials } from "./grid";
import { downloadFile } from "./storage";
export function exportProject(project: BeadProject) {
  downloadFile(
    new Blob([JSON.stringify(project, null, 2)], { type: "application/json" }),
    `${project.name}.pindou.json`,
  );
}
export function exportBOM(project: BeadProject) {
  const lines = [
    "SKU,Color,Quantity",
    ...billOfMaterials(project.cells).map(
      (row) =>
        `${COLOR_MAP[row.colorId].sku},${COLOR_MAP[row.colorId].name},${row.quantity}`,
    ),
  ];
  downloadFile(
    new Blob([lines.join("\n")], { type: "text/csv" }),
    `${project.name}-materials.csv`,
  );
}
export function exportPNG(project: BeadProject) {
  const canvas = document.createElement("canvas"),
    cellSize = 28,
    padding = 60;
  canvas.width = project.width * cellSize + padding * 2;
  canvas.height = project.height * cellSize + padding * 2 + 90;
  const c = canvas.getContext("2d")!;
  c.fillStyle = "#f6f5f0";
  c.fillRect(0, 0, canvas.width, canvas.height);
  project.cells.forEach((id, i) => {
    if (!id) return;
    const x = ((i % project.width) + 0.5) * cellSize + padding,
      y = (Math.floor(i / project.width) + 0.5) * cellSize + padding;
    c.beginPath();
    c.arc(x, y, cellSize * 0.45, 0, Math.PI * 2);
    c.fillStyle = COLOR_MAP[id].hex;
    c.fill();
    c.beginPath();
    c.arc(x, y, cellSize * 0.16, 0, Math.PI * 2);
    c.fillStyle = "#f6f5f0";
    c.fill();
  });
  c.fillStyle = "#243d32";
  c.font = "bold 30px sans-serif";
  c.fillText(project.name, padding, canvas.height - 65);
  c.font = "18px sans-serif";
  c.fillText(
    `${project.cells.filter(Boolean).length} beads · Made with pindou`,
    padding,
    canvas.height - 32,
  );
  canvas.toBlob((blob) => {
    if (blob) downloadFile(blob, `${project.name}.png`);
  });
}
