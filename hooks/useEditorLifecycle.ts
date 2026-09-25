"use client";
/* Browser storage and connectivity are external systems hydrated after the SSR pass. */
/* eslint-disable react-hooks/set-state-in-effect */
import { useEffect, useState } from "react";
import { useEditor } from "@/stores/editor";
import { readProjects, saveProject } from "@/lib/storage";
import { playClick } from "@/lib/motion";
import type { Tool } from "@/types/project";
export function useEditorLifecycle(projectId?: string, shared = false) {
  const [ready, setReady] = useState(false),
    [saveState, setSaveState] = useState("Saved on this device"),
    [offline, setOffline] = useState(false),
    [missing, setMissing] = useState(false);
  useEffect(() => {
    try {
      const projects = readProjects(),
        id = projectId || localStorage.getItem("pindou.active");
      const project = projects.find((p) => p.id === id);
      if (project) {
        useEditor.getState().load(project);
        setMissing(false);
      } else {
        // A newly created project remains usable when browser storage is full.
        setMissing(
          !shared &&
            !!projectId &&
            useEditor.getState().project.id !== projectId,
        );
      }
      const prefs = JSON.parse(localStorage.getItem("pindou.settings") || "{}");
      useEditor.setState({
        motion: window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "reduced"
          : ["full", "reduced", "minimal"].includes(prefs.motion)
            ? prefs.motion
            : "full",
        sound: prefs.sound === true,
      });
      document.documentElement.dataset.motion = useEditor.getState().motion;
    } catch {
      setSaveState("Storage unavailable — export to keep your work");
      setMissing(
        !shared && !!projectId && useEditor.getState().project.id !== projectId,
      );
    }
    setReady(true);
    setOffline(!navigator.onLine);
    const online = () => setOffline(!navigator.onLine);
    window.addEventListener("online", online);
    window.addEventListener("offline", online);
    return () => {
      window.removeEventListener("online", online);
      window.removeEventListener("offline", online);
    };
  }, [projectId, shared]);
  useEffect(() => {
    if (!ready || missing) return;
    let timer: ReturnType<typeof setTimeout>;
    const save = () => {
      try {
        saveProject(useEditor.getState().project);
        setSaveState("Saved on this device");
      } catch {
        setSaveState("Save failed — export to keep your work");
      }
    };
    save();
    const unsub = useEditor.subscribe((s, prev) => {
      if (s.revision !== prev.revision) {
        setSaveState("Saving…");
        clearTimeout(timer);
        timer = setTimeout(save, 700);
        if (s.past.length > prev.past.length) playClick();
      }
      if (s.motion !== prev.motion || s.sound !== prev.sound) {
        document.documentElement.dataset.motion = s.motion;
        try {
          localStorage.setItem(
            "pindou.settings",
            JSON.stringify({ motion: s.motion, sound: s.sound }),
          );
        } catch {}
      }
    });
    const flush = () => {
      useEditor.getState().end();
      save();
    };
    window.addEventListener("pagehide", flush);
    return () => {
      clearTimeout(timer);
      unsub();
      window.removeEventListener("pagehide", flush);
      save();
    };
  }, [ready, missing]);
  useEffect(() => {
    const keys: Record<string, Tool> = {
      b: "pencil",
      g: "grab",
      e: "eraser",
      i: "eyedropper",
      f: "fill",
      l: "line",
      r: "rectangle",
      v: "select",
      h: "hand",
    };
    let previous: Tool | null = null;
    const down = (e: KeyboardEvent) => {
      if (
        (e.target as HTMLElement)?.closest(
          "input,textarea,select,[contenteditable],dialog",
        )
      )
        return;
      const s = useEditor.getState();
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) s.redo();
        else s.undo();
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const key = e.key.toLowerCase();
      if (keys[key]) s.setTool(keys[key]);
      if (key === "m") useEditor.setState({ mirror: !s.mirror });
      if (["1", "2", "3"].includes(key))
        s.setCamera(key === "1" ? "top" : key === "2" ? "iso" : "3d");
      if (key === " " && !e.repeat) {
        e.preventDefault();
        previous = s.tool;
        s.setTool("hand");
      }
      if (
        s.selection &&
        ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)
      ) {
        e.preventDefault();
        s.moveSelection(
          e.key === "ArrowLeft" ? -1 : e.key === "ArrowRight" ? 1 : 0,
          e.key === "ArrowUp" ? -1 : e.key === "ArrowDown" ? 1 : 0,
        );
      }
    };
    const up = (e: KeyboardEvent) => {
      if (e.key === " " && previous) {
        useEditor.getState().setTool(previous);
        previous = null;
      }
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, []);
  return { ready, saveState, offline, missing };
}
