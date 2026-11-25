"use client";
import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  type PointerEvent,
} from "react";
import { Html, RoundedBox } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { GripHorizontal } from "lucide-react";
import { usePlay } from "@/stores/play";
import { useEditor } from "@/stores/editor";
import { COLOR_MAP } from "@/lib/colors";
import {
  swingDirection,
  tableLayout,
  toyPosition,
  type Toy,
  type TraySample,
} from "@/lib/co-op";

type ToyProps = {
  toy: Toy;
  width: number;
  height: number;
  geometry: THREE.BufferGeometry;
};
function take(
  toy: Toy,
  e?: Pick<PointerEvent, "button" | "clientX" | "clientY" | "pointerId">,
) {
  if (e && e.button !== 0) return;
  const play = usePlay.getState();
  if (
    toy.kind === "tray" &&
    play.held?.trayId === toy.id &&
    play.held.color === toy.color
  ) {
    usePlay.setState({ held: null, notice: "Bead returned." });
    return;
  }
  play.pick({
    color: toy.color,
    ...(toy.kind === "bead" ? { looseId: toy.id } : { trayId: toy.id }),
    start: e && { x: e.clientX, y: e.clientY, pointerId: e.pointerId },
  });
}
function Tray({ toy, geometry, width, height }: ToyProps) {
  const at = toyPosition(toy, width, height),
    { span, depth, back } = tableLayout(width, height);
  const w = span * 0.235,
    d = depth * 0.42;
  const beads = useRef<THREE.InstancedMesh>(null);
  const { gl, camera, invalidate } = useThree();
  const moving = usePlay(
    (s) => s.draggingTray === toy.id || s.peers.some((p) => p.tray === toy.id),
  );
  const lift = useRef<THREE.Group>(null),
    lean = useRef(0);
  const lastSpill = useRef(-Infinity);
  const release = useRef<(() => void) | null>(null);
  const ray = useMemo(() => new THREE.Raycaster(), []);
  const plane = useMemo(
    () => new THREE.Plane(new THREE.Vector3(0, 1, 0), -1.05),
    [],
  );
  const uv = useMemo(() => new THREE.Vector2(), []),
    point = useMemo(() => new THREE.Vector3(), []);
  useEffect(() => () => release.current?.(), []);
  useFrame((_, dt) => {
    if (!lift.current) return;
    const full = useEditor.getState().motion === "full";
    const height = moving ? 0.45 : 0,
      tilt = moving && full ? lean.current : 0;
    lift.current.position.y = THREE.MathUtils.damp(
      lift.current.position.y,
      height,
      20,
      full ? Math.min(dt, 0.1) : 1,
    );
    lift.current.rotation.z = THREE.MathUtils.damp(
      lift.current.rotation.z,
      tilt,
      16,
      full ? Math.min(dt, 0.1) : 1,
    );
    if (
      Math.abs(lift.current.position.y - height) +
        Math.abs(lift.current.rotation.z - tilt) >
      0.001
    )
      invalidate();
  });
  const fused = useEditor((s) => s.fused || s.fusing);
  const name = COLOR_MAP[toy.color].name;
  useLayoutEffect(() => {
    if (!beads.current) return;
    const obj = new THREE.Object3D();
    for (let i = 0; i < 12; i++) {
      obj.position.set(
        ((i % 4) - 1.5) * w * 0.21,
        0.28,
        (Math.floor(i / 4) - 1) * d * 0.29,
      );
      obj.rotation.set(Math.sin(i * 3) * 0.23, i, Math.cos(i) * 0.17);
      obj.scale.setScalar(Math.min(w / 4.8, d / 3.1));
      obj.updateMatrix();
      beads.current.setMatrixAt(i, obj.matrix);
    }
    beads.current.instanceMatrix.needsUpdate = true;
    beads.current.computeBoundingSphere();
  }, [w, d]);
  function hit(e: globalThis.PointerEvent) {
    const r = gl.domElement.getBoundingClientRect();
    uv.set(
      (2 * (e.clientX - r.left)) / r.width - 1,
      1 - (2 * (e.clientY - r.top)) / r.height,
    );
    ray.setFromCamera(uv, camera);
    return ray.ray.intersectPlane(plane, point);
  }
  function start(e: globalThis.PointerEvent) {
    if (
      fused ||
      e.button !== 0 ||
      !e.isPrimary ||
      usePlay.getState().draggingTray
    )
      return;
    const origin = hit(e);
    if (!origin || !(e.target instanceof Element)) return;
    const handle = e.target;
    const dx = at.x - origin.x,
      dz = at.z - origin.z,
      side = toy.side ? -1 : 1;
    const samples: TraySample[] = [
      { x: at.x / span, z: at.z / span, time: e.timeStamp },
    ];
    let spilled = false;
    handle.setPointerCapture(e.pointerId);
    usePlay.setState({
      draggingTray: toy.id,
      held: null,
      position: { x: origin.x, z: origin.z },
    });
    function move(event: globalThis.PointerEvent) {
      if (event.pointerId !== e.pointerId) return;
      if (usePlay.getState().draggingTray !== toy.id) {
        end();
        return;
      }
      const location = hit(event);
      if (!location) return;
      const play = usePlay.getState();
      play.moveToy(
        toy.id,
        100 * ((location.x + dx) / span + 0.5),
        (100 * (side * (location.z + dz) - back)) / depth,
      );
      const moved = usePlay.getState().toys.find((t) => t.id === toy.id);
      if (!moved) return;
      const pos = toyPosition(moved, width, height);
      const next = { x: pos.x / span, z: pos.z / span, time: event.timeStamp };
      const last = samples[samples.length - 1];
      lean.current = THREE.MathUtils.clamp(
        (-(next.x - last.x) * 650) / Math.max(10, next.time - last.time),
        -0.18,
        0.18,
      );
      const direction = swingDirection(samples, next);
      if (
        direction &&
        !spilled &&
        event.timeStamp - lastSpill.current >= 2000
      ) {
        usePlay.getState().spill(toy.id, direction);
        lastSpill.current = event.timeStamp;
        spilled = true;
      }
      invalidate();
    }
    function end(event?: Event) {
      if (
        event instanceof window.PointerEvent &&
        event.pointerId !== e.pointerId
      )
        return;
      release.current = null;
      handle.removeEventListener("lostpointercapture", end);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", end);
      window.removeEventListener("blur", end);
      if (handle.hasPointerCapture(e.pointerId))
        handle.releasePointerCapture(e.pointerId);
      if (usePlay.getState().draggingTray === toy.id)
        usePlay.setState({ draggingTray: null });
      invalidate();
    }
    release.current = end;
    handle.addEventListener("lostpointercapture", end);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", end);
    window.addEventListener("pointercancel", end);
    window.addEventListener("blur", end);
    invalidate();
  }
  return (
    <group position={[at.x, 0, at.z]}>
      <group ref={lift}>
        <group
          rotation={[0, (-toy.angle * Math.PI) / 180, 0]}
          onPointerDown={(e) => {
            if (!fused && e.nativeEvent.target instanceof HTMLCanvasElement) {
              e.stopPropagation();
              start(e.nativeEvent);
            }
          }}
        >
          <RoundedBox
            args={[w, 0.45, d]}
            radius={0.19}
            smoothness={2}
            receiveShadow
            castShadow
          >
            <meshStandardMaterial color="#ede5cb" />
          </RoundedBox>
          {[-1, 1].map((side) => (
            <group key={side}>
              <RoundedBox
                args={[w, 0.64, 0.33]}
                position={[0, 0.32, (side * (d - 0.33)) / 2]}
                radius={0.13}
                smoothness={2}
                castShadow
              >
                <meshStandardMaterial color="#fff4d7" />
              </RoundedBox>
              <RoundedBox
                args={[0.33, 0.64, d]}
                position={[(side * (w - 0.33)) / 2, 0.32, 0]}
                radius={0.13}
                smoothness={2}
                castShadow
              >
                <meshStandardMaterial color="#fff4d7" />
              </RoundedBox>
            </group>
          ))}
          <instancedMesh
            ref={beads}
            args={[geometry, undefined, 12]}
            castShadow
            onPointerDown={(e) => {
              if (!fused && e.nativeEvent.target instanceof HTMLCanvasElement) {
                e.stopPropagation();
                take(toy, e.nativeEvent);
              }
            }}
          >
            <meshStandardMaterial
              color={COLOR_MAP[toy.color].hex}
              roughness={0.32}
            />
          </instancedMesh>
        </group>
      </group>
      <Html
        center
        position={[0, 0.8, 0]}
        zIndexRange={[2, 1]}
        style={{ pointerEvents: "none" }}
      >
        <div
          className={
            toy.side === "back" ? "scene-tray back-tray" : "scene-tray"
          }
          data-tray={toy.id}
          data-position={`${toy.x},${toy.y}`}
        >
          <button
            className="tray-take"
            title={`Take ${name} bead`}
            aria-label={`Take ${name} bead`}
            disabled={fused}
            onPointerDown={(e) => take(toy, e)}
            onClick={(e) => {
              if (!e.detail) take(toy);
            }}
          />
          <div className="tray-tools">
            <button
              aria-label={`Move ${name} box`}
              title={`Drag ${name} box. A fast swing spills beads.`}
              onPointerDown={(e) => start(e.nativeEvent)}
              onKeyDown={(e) => {
                const dx =
                  e.key === "ArrowLeft" ? -3 : e.key === "ArrowRight" ? 3 : 0;
                const dy =
                  e.key === "ArrowUp" ? -5 : e.key === "ArrowDown" ? 5 : 0;
                if (dx || dy) {
                  e.preventDefault();
                  usePlay.getState().moveToy(toy.id, toy.x + dx, toy.y + dy);
                }
              }}
            >
              <GripHorizontal size={14} />
            </button>
          </div>
        </div>
      </Html>
    </group>
  );
}
function LooseBead({
  toy,
  width,
  height,
  geometry,
  tray,
}: ToyProps & { tray?: Toy }) {
  const dest = toyPosition(toy, width, height),
    origin = toy.origin
      ? toyPosition({ ...toy, ...toy.origin }, width, height)
      : tray
        ? toyPosition(tray, width, height)
        : dest;
  const group = useRef<THREE.Group>(null);
  const elapsed = useRef(0);
  const invalidate = useThree((s) => s.invalidate);
  const held = usePlay(
    (s) =>
      s.held?.looseId === toy.id || s.peers.some((p) => p.looseId === toy.id),
  );
  const fused = useEditor((s) => s.fusing || s.fused);
  const name = COLOR_MAP[toy.color].name;
  useFrame((_, delta) => {
    if (!group.current) return;
    elapsed.current += Math.min(0.05, delta);
    const t =
      useEditor.getState().motion === "full"
        ? Math.min(1, elapsed.current / 0.38)
        : 1;
    const ease = 1 - (1 - t) ** 2;
    group.current.position.set(
      THREE.MathUtils.lerp(origin.x, dest.x, ease),
      -0.18 + Math.sin(t * Math.PI) * 1.6,
      THREE.MathUtils.lerp(origin.z, dest.z, ease),
    );
    if (t < 1) invalidate();
  });
  return (
    <group ref={group} visible={!held}>
      <mesh
        geometry={geometry}
        rotation={[0, (toy.angle * Math.PI) / 180, 0]}
        castShadow
      >
        <meshStandardMaterial
          color={COLOR_MAP[toy.color].hex}
          roughness={0.32}
        />
      </mesh>
      <Html center position={[0, 0.6, 0]} zIndexRange={[3, 2]}>
        <button
          className="loose-bead"
          hidden={held}
          title={`Pick up spilled ${name} bead`}
          aria-label={`Pick up spilled ${name} bead`}
          disabled={held || fused}
          onPointerDown={(e) => take(toy, e)}
          onClick={(e) => {
            if (!e.detail) take(toy);
          }}
        />
      </Html>
    </group>
  );
}
export function TableToys({ geometry }: { geometry: THREE.BufferGeometry }) {
  const toys = usePlay((s) => s.toys),
    width = useEditor((s) => s.project.width),
    height = useEditor((s) => s.project.height);
  const fused = useEditor((s) => s.fused || s.fusing);
  if (fused) return null;
  return toys.map((toy) =>
    toy.kind === "tray" ? (
      <Tray key={toy.id} {...{ toy, width, height, geometry }} />
    ) : (
      <LooseBead
        key={toy.id}
        {...{ toy, width, height, geometry }}
        tray={toys.find(
          (t) =>
            t.kind === "tray" && t.side === toy.side && t.color === toy.color,
        )}
      />
    ),
  );
}
