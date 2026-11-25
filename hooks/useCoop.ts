"use client";
import { newId } from "@/lib/id";
import { useEffect } from "react";
import { useEditor } from "@/stores/editor";
import { beadAvailable, usePlay } from "@/stores/play";
import { diff } from "@/lib/grid";
import {
  applyOperation,
  toyDiff,
  type Operation,
  type RoomSyncResponse,
} from "@/lib/co-op";

export function useCoop(roomId: string | undefined, ready: boolean) {
  useEffect(() => {
    if (!roomId || !ready) {
      usePlay.setState({ peers: [], connected: false, hydrated: false });
      return;
    }
    const peerId = newId();
    let name = `Maker ${peerId.slice(0, 3)}`;
    try {
      name = sessionStorage.getItem("pindou.player") || name;
    } catch {}
    let alive = true,
      initialized = false,
      seq = 0;
    let baseProject = useEditor.getState().project,
      baseToys = usePlay.getState().toys;
    let pending: Operation[] = [];
    let version: number | undefined;
    let authoritative = { project: baseProject, toys: baseToys };
    let timer: ReturnType<typeof setTimeout> | undefined;
    let lastRequest = 0;
    const controller = new AbortController();
    usePlay.setState({
      status: "Connecting…",
      hydrated: false,
      connected: false,
      held: null,
      position: null,
      draggingTray: null,
      playerName: name,
      peers: [],
    });
    function collect() {
      if (!initialized || pending.length >= 64) return;
      const project = useEditor.getState().project,
        toys = usePlay.getState().toys;
      if (project.id !== baseProject.id) return;
      const cells = diff(baseProject.cells, project.cells),
        changes = toyDiff(baseToys, toys);
      if (cells.length || changes.length || project.name !== baseProject.name)
        pending.push({
          seq: ++seq,
          cells,
          toys: changes,
          ...(project.name !== baseProject.name
            ? { name: { before: baseProject.name, after: project.name } }
            : {}),
        });
      baseProject = project;
      baseToys = toys;
    }
    const editing = () => !!useEditor.getState().strokeBefore;
    async function sync() {
      timer = undefined;
      if (
        !alive ||
        (initialized && useEditor.getState().project.id !== baseProject.id)
      )
        return;
      if (initialized && editing()) {
        timer = setTimeout(sync, 100);
        return;
      }
      collect();
      lastRequest = performance.now();
      const sent = pending.slice(0, 1),
        play = usePlay.getState();
      try {
        const response = await fetch(`/api/rooms/${roomId}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: AbortSignal.any([
            controller.signal,
            AbortSignal.timeout(8000),
          ]),
          body: JSON.stringify({
            peer: {
              id: peerId,
              name: usePlay.getState().playerName,
              cell: play.hover,
              position: play.position,
              tray: play.draggingTray,
              looseId: play.held?.looseId,
              source: play.held?.source,
              holding: play.held?.color ?? null,
            },
            operations: sent,
            since: version,
          }),
        });
        if (!alive) return;
        if (!response.ok) {
          const error = await response.json();
          usePlay.setState({
            connected: false,
            status: error.error || "Room unavailable",
          });
          if ([400, 404, 410].includes(response.status)) return;
          throw new Error("Connection interrupted");
        }
        const snapshot: RoomSyncResponse = await response.json();
        // Never replace a half-finished brush stroke. Tray drags can stream live.
        while (alive && editing())
          await new Promise((resolve) => setTimeout(resolve, 50));
        if (!alive) return;
        if (initialized && useEditor.getState().project.id !== baseProject.id)
          return;
        pending = pending.filter((op) => !sent.some((s) => s.seq === op.seq));
        collect();
        version = snapshot.version;
        if ("project" in snapshot)
          authoritative = { project: snapshot.project, toys: snapshot.toys };
        let merged = authoritative;
        for (const op of pending)
          merged =
            applyOperation(merged.project, merged.toys, op, false) ?? merged;
        if (!initialized) {
          useEditor.getState().load(merged.project);
          initialized = true;
        } else if (
          JSON.stringify(merged.project) !==
          JSON.stringify(useEditor.getState().project)
        ) {
          useEditor.setState((s) => ({
            project: merged.project,
            revision: s.revision + 1,
          }));
        }
        baseProject = merged.project;
        baseToys = merged.toys;
        const held = usePlay.getState().held;
        const unavailable =
          held && !beadAvailable(held, merged.project.cells, merged.toys);
        const conflict = sent.some((op) => snapshot.rejected.includes(op.seq));
        usePlay.setState({
          toys: merged.toys,
          peers: snapshot.peers.filter((p) => p.id !== peerId),
          connected: true,
          hydrated: true,
          status: pending.length
            ? "Sharing your changes…"
            : "Live · everyone is in sync",
          ...(unavailable
            ? {
                held: null,
                notice: "That bead was moved. Pick another from the table.",
              }
            : {}),
          ...(conflict
            ? {
                notice:
                  "Your friend changed that spot first. Their edit stayed; try your move again.",
              }
            : {}),
        });
        const latest = usePlay.getState();
        const active =
          pending.length ||
          latest.position ||
          latest.held ||
          latest.draggingTray ||
          latest.peers.some((p) => p.position);
        const changedGrip =
          play.held?.color !== latest.held?.color ||
          play.draggingTray !== latest.draggingTray;
        timer = setTimeout(sync, changedGrip ? 125 : active ? 250 : 1000);
      } catch {
        if (!alive) return;
        usePlay.setState({
          connected: false,
          status: "Reconnecting… your changes are queued on this page",
        });
        timer = setTimeout(sync, 1500);
      }
    }
    // Wake an idle poll on pickup or table entry. Pointer motion itself never sends a request.
    const unsubscribe = usePlay.subscribe((s, prev) => {
      if (!timer || !s.connected) return;
      if (
        s.held?.color === prev.held?.color &&
        s.draggingTray === prev.draggingTray &&
        Boolean(s.position) === Boolean(prev.position)
      )
        return;
      clearTimeout(timer);
      timer = setTimeout(
        sync,
        Math.max(0, 125 - (performance.now() - lastRequest)),
      );
    });
    void sync();
    return () => {
      alive = false;
      unsubscribe();
      clearTimeout(timer);
      controller.abort();
      usePlay.setState({
        held: null,
        position: null,
        draggingTray: null,
        peers: [],
        connected: false,
        hydrated: false,
      });
    };
  }, [roomId, ready]);
}
