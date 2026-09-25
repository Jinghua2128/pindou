import { animate } from "animejs";
import { useEditor } from "@/stores/editor";
export const motion = { fast: 120, normal: 220, slow: 500, page: 700 };
export function reducedMotion() {
  return (
    useEditor.getState().motion !== "full" ||
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}
export function animatePress(element: HTMLElement) {
  if (reducedMotion()) return;
  return animate(element, {
    scale: [1, 1.14, 0.97, 1],
    duration: 330,
    ease: "out(3)",
  });
}
let context: AudioContext | undefined;
export function playClick() {
  if (!useEditor.getState().sound) return;
  try {
    context ??= new AudioContext();
    if (context.state === "suspended") void context.resume();
    const oscillator = context.createOscillator(),
      gain = context.createGain();
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.frequency.setValueAtTime(650, context.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(
      220,
      context.currentTime + 0.035,
    );
    gain.gain.setValueAtTime(0.022, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.04);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.045);
  } catch {
    /* Audio is optional. */
  }
}
