"use client";
import { useEffect, useRef, type PointerEvent } from "react";
import { usePlay } from "@/stores/play";

/** Keep palette clicks as color selection; a deliberate drag picks up a bead. */
export function useBeadDrag() {
  const gesture = useRef<{
    color: string;
    x: number;
    y: number;
    pointer: number;
  } | null>(null);
  useEffect(() => {
    const move = (e: globalThis.PointerEvent) => {
      const start = gesture.current;
      if (
        !start ||
        e.pointerId !== start.pointer ||
        Math.hypot(e.clientX - start.x, e.clientY - start.y) < 6
      )
        return;
      usePlay
        .getState()
        .pick({ color: start.color, start: { x: start.x, y: start.y } });
      gesture.current = null;
    };
    const end = () => {
      gesture.current = null;
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", end);
    window.addEventListener("pointercancel", end);
    window.addEventListener("blur", end);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", end);
      window.removeEventListener("blur", end);
    };
  }, []);
  return (e: PointerEvent, color: string) => {
    if (e.button === 0)
      gesture.current = {
        color,
        x: e.clientX,
        y: e.clientY,
        pointer: e.pointerId,
      };
  };
}
