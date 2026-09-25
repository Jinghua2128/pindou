import { projectSchema, type BeadProject } from "@/types/project";
const KEY = "pindou.projects.v1";
export function readProjects(): BeadProject[] {
  const data = JSON.parse(localStorage.getItem(KEY) || "[]");
  if (!Array.isArray(data)) throw new Error("Invalid project library");
  return data.flatMap((p) => {
    const result = projectSchema.safeParse(p);
    return result.success ? [result.data] : [];
  });
}
export function saveProject(project: BeadProject) {
  projectSchema.parse(project);
  const projects = readProjects().filter((p) => p.id !== project.id);
  localStorage.setItem(KEY, JSON.stringify([project, ...projects]));
  localStorage.setItem("pindou.active", project.id);
}
export function deleteProject(id: string) {
  localStorage.setItem(
    KEY,
    JSON.stringify(readProjects().filter((p) => p.id !== id)),
  );
  if (localStorage.getItem("pindou.active") === id) {
    localStorage.removeItem("pindou.active");
  }
}
export function downloadFile(content: Blob, name: string) {
  const url = URL.createObjectURL(content);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
