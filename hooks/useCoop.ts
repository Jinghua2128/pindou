"use client";
import { newId } from "@/lib/id";
import { useEffect } from "react";
import { useEditor } from "@/stores/editor";
import { usePlay } from "@/stores/play";
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
    let timer: ReturnType<typeof setTimeout>;
    const controller = new AbortController();
    usePlay.setState({
      status: "Connecting…",
      hydrated: false,
      connected: false,
      held: null,
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
        const conflict = sent.some((op) => snapshot.rejected.includes(op.seq));
        usePlay.setState({
          toys: merged.toys,
          peers: snapshot.peers.filter((p) => p.id !== peerId),
          connected: true,
          hydrated: true,
          status: pending.length
            ? "Sharing your changes…"
            : "Live · everyone is in sync",
          ...(conflict
            ? {
                notice:
                  "Your friend changed that spot first. Their edit stayed; try your move again.",
              }
            : {}),
        });
        timer = setTimeout(
          sync,
          pending.length ||
            play.held ||
            play.hover !== null ||
            play.draggingTray
            ? 250
            : 1000,
        );
      } catch {
        if (!alive) return;
        usePlay.setState({
          connected: false,
          status: "Reconnecting… your changes are queued on this page",
        });
        timer = setTimeout(sync, 1500);
      }
    }
    void sync();
    return () => {
      alive = false;
      clearTimeout(timer);
      controller.abort();
      usePlay.setState({
        held: null,
        peers: [],
        connected: false,
        hydrated: false,
      });
    };
  }, [roomId, ready]);
}
