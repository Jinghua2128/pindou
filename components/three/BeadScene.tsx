"use client";
/* Three.js objects are intentionally mutated in the render loop, outside React state. */
/* eslint-disable react-hooks/immutability */
import { memo, useEffect, useLayoutEffect, useMemo, useRef } from "react";
import {
  Canvas,
  useFrame,
  useThree,
  type ThreeEvent,
} from "@react-three/fiber";
import { OrbitControls, RoundedBox, Html } from "@react-three/drei";
import * as THREE from "three";
import type { ComponentRef } from "react";
type OrbitControlsImpl = ComponentRef<typeof OrbitControls>;
import { useEditor } from "@/stores/editor";
import { usePlay } from "@/stores/play";
import { TableToys } from "./TableToys";
import { tableLayout, type Presence } from "@/lib/co-op";
import { COLOR_MAP } from "@/lib/colors";

function beadGeometry() {
  return new THREE.LatheGeometry(
    [
      new THREE.Vector2(0.19, 0),
      new THREE.Vector2(0.39, 0),
      new THREE.Vector2(0.435, 0.045),
      new THREE.Vector2(0.445, 0.1),
      new THREE.Vector2(0.445, 0.66),
      new THREE.Vector2(0.42, 0.72),
      new THREE.Vector2(0.39, 0.75),
      new THREE.Vector2(0.23, 0.75),
      new THREE.Vector2(0.19, 0.71),
      new THREE.Vector2(0.18, 0.66),
      new THREE.Vector2(0.18, 0.05),
      new THREE.Vector2(0.19, 0),
    ],
    24,
  );
}
const temp = new THREE.Object3D();
const tempColor = new THREE.Color();
function Beads() {
  const width = useEditor((s) => s.project.width),
    height = useEditor((s) => s.project.height),
    id = useEditor((s) => s.project.id);
  const mesh = useRef<THREE.InstancedMesh>(null),
    guideMesh = useRef<THREE.InstancedMesh>(null);
  const geometry = useMemo(() => beadGeometry(), []);
  const last = useRef<(string | null)[]>([]);
  const animating = useRef(new Map<number, number>());
  const fuseScale = useRef(1);
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => () => geometry.dispose(), [geometry]);
  useLayoutEffect(() => {
    const update = () => {
      const s = useEditor.getState(),
        cells = s.project.cells;
      if (
        !mesh.current ||
        s.project.width !== width ||
        s.project.height !== height
      )
        return;
      const initial = last.current.length !== cells.length;
      for (let i = 0; i < cells.length; i++) {
        if (!initial && last.current[i] === cells[i]) continue;
        const c = cells[i];
        const dropping =
          !!c && !initial && s.motion === "full" && animating.current.size < 24;
        if (dropping) animating.current.set(i, performance.now());
        else animating.current.delete(i);
        temp.position.set(
          (i % width) - (width - 1) / 2,
          0.25 + (dropping ? 1.4 : 0),
          Math.floor(i / width) - (height - 1) / 2,
        );
        temp.scale.setScalar(c ? 1 : 0);
        temp.updateMatrix();
        mesh.current.setMatrixAt(i, temp.matrix);
        mesh.current.setColorAt(
          i,
          tempColor.set(c ? COLOR_MAP[c]?.hex || "#ffffff" : "#ffffff"),
        );
      }
      mesh.current.instanceMatrix.needsUpdate = true;
      if (mesh.current.instanceColor)
        mesh.current.instanceColor.needsUpdate = true;
      mesh.current.computeBoundingSphere();
      last.current = [...cells];
      invalidate();
    };
    last.current = [];
    update();
    const unsub = useEditor.subscribe((state, prev) => {
      if (state.project.cells !== prev.project.cells) update();
      if (state.fusing !== prev.fusing || state.fused !== prev.fused)
        invalidate();
    });
    return unsub;
  }, [width, height, id, invalidate]);
  useLayoutEffect(() => {
    const guide = useEditor.getState().project.guide;
    if (!guideMesh.current) return;
    for (let i = 0; i < width * height; i++) {
      const c = guide?.[i];
      temp.position.set(
        (i % width) - (width - 1) / 2,
        0.26,
        Math.floor(i / width) - (height - 1) / 2,
      );
      temp.scale.setScalar(c ? 1 : 0);
      temp.updateMatrix();
      guideMesh.current.setMatrixAt(i, temp.matrix);
      guideMesh.current.setColorAt(
        i,
        tempColor.set(c ? COLOR_MAP[c].hex : "#ffffff"),
      );
    }
    guideMesh.current.instanceMatrix.needsUpdate = true;
    if (guideMesh.current.instanceColor)
      guideMesh.current.instanceColor.needsUpdate = true;
  }, [width, height, id]);
  useFrame(() => {
    if (!mesh.current) return;
    const state = useEditor.getState();
    const target = state.fusing || state.fused ? 0.62 : 1;
    fuseScale.current = THREE.MathUtils.lerp(fuseScale.current, target, 0.085);
    mesh.current.scale.y = fuseScale.current;
    guideMesh.current!.visible = !state.fused && !state.fusing;
    for (const [i, start] of animating.current) {
      const t = Math.min(1, (performance.now() - start) / 170),
        drop = (1 - t) ** 3 * 1.4;
      temp.position.set(
        (i % width) - (width - 1) / 2,
        0.25 + drop,
        Math.floor(i / width) - (height - 1) / 2,
      );
      const squash =
        t > 0.65 ? Math.sin(((t - 0.65) / 0.35) * Math.PI) * 0.08 : 0;
      temp.scale.set(1 + squash * 0.5, 1 - squash, 1 + squash * 0.5);
      temp.updateMatrix();
      mesh.current.setMatrixAt(i, temp.matrix);
      if (t >= 1) animating.current.delete(i);
    }
    if (animating.current.size) {
      mesh.current.instanceMatrix.needsUpdate = true;
      invalidate();
    } else mesh.current.instanceMatrix.needsUpdate = true;
    if (Math.abs(fuseScale.current - target) > 0.001) invalidate();
  });
  return (
    <>
      <instancedMesh
        ref={guideMesh}
        args={[geometry, undefined, width * height]}
        frustumCulled={false}
      >
        <meshStandardMaterial
          transparent
          opacity={0.18}
          roughness={0.5}
          depthWrite={false}
        />
      </instancedMesh>
      <instancedMesh
        ref={mesh}
        args={[geometry, undefined, width * height]}
        castShadow
        receiveShadow
        frustumCulled={false}
      >
        <meshPhysicalMaterial
          roughness={0.32}
          metalness={0}
          clearcoat={0.3}
          clearcoatRoughness={0.35}
        />
      </instancedMesh>
    </>
  );
}
const Pegboard = memo(function Pegboard() {
  const width = useEditor((s) => s.project.width),
    height = useEditor((s) => s.project.height),
    grid = useEditor((s) => s.grid),
    fused = useEditor((s) => s.fused);
  const pegs = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    if (!pegs.current) return;
    for (let i = 0; i < width * height; i++) {
      temp.position.set(
        (i % width) - (width - 1) / 2,
        0.4,
        Math.floor(i / width) - (height - 1) / 2,
      );
      temp.scale.setScalar(1);
      temp.updateMatrix();
      pegs.current.setMatrixAt(i, temp.matrix);
    }
    pegs.current.instanceMatrix.needsUpdate = true;
  }, [width, height]);
  return (
    <group visible={!fused}>
      <RoundedBox
        args={[width + 1.6, 0.45, height + 1.6]}
        radius={0.5}
        smoothness={3}
        position={[0, 0, 0]}
        receiveShadow
      >
        <meshPhysicalMaterial
          color="#f1f3ed"
          transparent
          opacity={0.34}
          roughness={0.22}
          metalness={0}
          clearcoat={1}
        />
      </RoundedBox>
      <RoundedBox
        args={[width + 1.1, 0.12, height + 1.1]}
        radius={0.3}
        smoothness={2}
        position={[0, 0.23, 0]}
      >
        <meshPhysicalMaterial
          color="#ffffff"
          transparent
          opacity={0.26}
          roughness={0.1}
        />
      </RoundedBox>
      <instancedMesh
        ref={pegs}
        args={[undefined, undefined, width * height]}
        visible={grid}
        receiveShadow
      >
        <cylinderGeometry args={[0.095, 0.13, 0.35, 8]} />
        <meshPhysicalMaterial
          color="#d6dcd0"
          roughness={0.28}
          clearcoat={0.4}
        />
      </instancedMesh>
      {[-1, 1].map((x) =>
        [-1, 1].map((z) => (
          <mesh
            key={`${x}-${z}`}
            position={[x * (width / 2 + 0.35), 0.29, z * (height / 2 + 0.35)]}
            rotation={[-Math.PI / 2, 0, 0]}
          >
            <ringGeometry args={[0.1, 0.19, 16]} />
            <meshStandardMaterial color="#bcc2b9" />
          </mesh>
        )),
      )}
    </group>
  );
});
function CameraRig() {
  const controls = useRef<OrbitControlsImpl>(null);
  const camera = useThree((s) => s.camera) as THREE.OrthographicCamera;
  const size = useThree((s) => s.size),
    invalidate = useThree((s) => s.invalidate);
  const mode = useEditor((s) => s.camera),
    revision = useEditor((s) => s.cameraRevision),
    zoom = useEditor((s) => s.zoom),
    tool = useEditor((s) => s.tool);
  const width = useEditor((s) => s.project.width),
    height = useEditor((s) => s.project.height),
    motion = useEditor((s) => s.motion);
  const moving = useRef(false),
    zooming = useRef(false),
    initialized = useRef(false);
  const goalZoom = useRef(1);
  const fused = useEditor((s) => s.fused || s.fusing);
  const movingBox = usePlay((s) => s.draggingTray !== null);
  const hasBack = usePlay((s) => s.toys.some((t) => t.side === "back"));
  const view = useMemo(() => {
    const rack = tableLayout(width, height);
    const front = fused ? 0 : rack.depth + 1.6;
    const rear = hasBack ? front : 0;
    const target = new THREE.Vector3(0, 0, (front - rear) / 2);
    const distance = Math.max(width, height) * 1.9;
    const position = new THREE.Vector3(
      ...((mode === "top"
        ? [0, distance, 0.001]
        : mode === "iso"
          ? [-distance * 0.18, distance, distance * 0.64]
          : [distance * 0.7, distance * 0.65, distance * 0.85]) as [
        number,
        number,
        number,
      ]),
    );
    const direction = position.clone().normalize();
    const right = new THREE.Vector3()
      .crossVectors(new THREE.Vector3(0, 1, 0), direction)
      .normalize();
    const up = new THREE.Vector3().crossVectors(direction, right).normalize();
    const projectedWidth =
      Math.abs(right.x) * Math.max(width + 2, rack.span) +
      Math.abs(right.z) * (height + 2 + front + rear);
    const projectedHeight =
      Math.abs(up.x) * Math.max(width + 2, rack.span) +
      Math.abs(up.z) * (height + 2 + front + rear) +
      2;
    // Fit all four corners, including on narrow touch screens.
    const baseZoom = Math.min(
      size.width / (projectedWidth + 4),
      size.height / (projectedHeight + 3),
    );
    return { position: position.add(target), baseZoom, target };
  }, [mode, width, height, size.width, size.height, fused, hasBack]);
  useLayoutEffect(() => {
    goalZoom.current = (view.baseZoom * useEditor.getState().zoom) / 100;
    if (!initialized.current) {
      camera.position.copy(view.position);
      camera.zoom = goalZoom.current;
      camera.lookAt(view.target);
      controls.current?.target.copy(view.target);
      camera.updateProjectionMatrix();
      initialized.current = true;
    }
    moving.current = true;
    zooming.current = true;
    invalidate();
  }, [view, revision, camera, invalidate]);
  useEffect(() => {
    goalZoom.current = (view.baseZoom * zoom) / 100;
    zooming.current = true;
    invalidate();
  }, [zoom, view, invalidate]);
  useFrame(() => {
    const factor = motion === "full" ? 0.14 : 1;
    if (moving.current) {
      camera.position.lerp(view.position, factor);
      controls.current?.target.lerp(view.target, factor);
      if (camera.position.distanceTo(view.position) < 0.01)
        moving.current = false;
    }
    if (zooming.current) {
      camera.zoom = THREE.MathUtils.lerp(camera.zoom, goalZoom.current, factor);
      camera.updateProjectionMatrix();
      if (Math.abs(camera.zoom - goalZoom.current) < 0.001)
        zooming.current = false;
    }
    if (moving.current || zooming.current) {
      controls.current?.update();
      invalidate();
    }
  });
  return (
    <OrbitControls
      enabled={!movingBox}
      ref={controls}
      makeDefault
      enableDamping
      dampingFactor={0.12}
      enableRotate={mode === "3d" && tool === "hand"}
      minZoom={view.baseZoom * 0.5}
      maxZoom={view.baseZoom * 1.8}
      maxPolarAngle={Math.PI / 2.15}
      onStart={() => {
        moving.current = false;
        zooming.current = false;
      }}
      onEnd={() => {
        useEditor
          .getState()
          .setZoom(Math.round((camera.zoom / view.baseZoom) * 100));
      }}
      mouseButtons={{
        LEFT:
          tool === "hand"
            ? mode === "3d"
              ? THREE.MOUSE.ROTATE
              : THREE.MOUSE.PAN
            : undefined,
        MIDDLE: THREE.MOUSE.PAN,
        RIGHT: undefined,
      }}
      touches={{
        ONE: tool === "hand" ? THREE.TOUCH.PAN : undefined,
        TWO: THREE.TOUCH.DOLLY_PAN,
      }}
    />
  );
}
function Interaction() {
  const width = useEditor((s) => s.project.width),
    height = useEditor((s) => s.project.height),
    color = useEditor((s) => s.color),
    fused = useEditor((s) => s.fused),
    tool = useEditor((s) => s.tool),
    selection = useEditor((s) => s.selection);
  const ghost = useRef<THREE.Mesh>(null),
    painting = useRef(false),
    erasing = useRef(false),
    pointers = useRef(new Set<number>()),
    geometry = useMemo(() => beadGeometry(), []);
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => () => geometry.dispose(), [geometry]);
  useEffect(() => {
    const up = () => {
      painting.current = false;
      useEditor.getState().end();
      pointers.current.clear();
    };
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    window.addEventListener("blur", up);
    return () => {
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
      window.removeEventListener("blur", up);
    };
  }, []);
  const index = (e: ThreeEvent<PointerEvent>) => {
    const x = Math.floor(e.point.x + width / 2),
      y = Math.floor(e.point.z + height / 2);
    return x < 0 || x >= width || y < 0 || y >= height ? -1 : y * width + x;
  };
  const move = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    const i = index(e);
    if (ghost.current) {
      ghost.current.visible =
        i >= 0 &&
        !fused &&
        useEditor.getState().placement === "classic" &&
        tool !== "hand" &&
        tool !== "grab" &&
        !usePlay.getState().held;
      if (i >= 0)
        ghost.current.position.set(
          (i % width) - (width - 1) / 2,
          0.29,
          Math.floor(i / width) - (height - 1) / 2,
        );
    }
    if (painting.current && i >= 0 && pointers.current.size < 2)
      useEditor.getState().draw(i, erasing.current);
    invalidate();
  };
  return (
    <>
      <mesh ref={ghost} geometry={geometry} visible={false}>
        <meshStandardMaterial
          color={tool === "eraser" ? "#f27474" : COLOR_MAP[color].hex}
          transparent
          opacity={0.48}
          depthWrite={false}
        />
      </mesh>
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 1.05, 0]}
        visible={!fused}
        onPointerDown={(e) => {
          if (
            !(e.nativeEvent.target instanceof HTMLCanvasElement) ||
            e.button === 1 ||
            tool === "hand"
          )
            return;
          e.stopPropagation();
          pointers.current.add(e.pointerId);
          if (pointers.current.size > 1 || !e.nativeEvent.isPrimary) {
            painting.current = false;
            useEditor.getState().cancelStroke();
            return;
          }
          const i = index(e);
          if (i < 0) return;
          const play = usePlay.getState();
          if (play.held) {
            if (e.button === 2) usePlay.setState({ held: null });
            else if (e.pointerType === "touch") {
              // Commit on lift so a second finger can turn the gesture into a pinch.
              usePlay.setState({
                held: {
                  ...play.held,
                  start: {
                    x: e.clientX,
                    y: e.clientY,
                    pointerId: e.pointerId,
                    dropOnTap: true,
                  },
                },
              });
            } else if (e.button === 0) play.place(i);
            return;
          }
          if (tool === "grab" && e.button !== 2) {
            const bead = useEditor.getState().project.cells[i];
            if (bead)
              play.pick({
                color: bead,
                source: i,
                start: { x: e.clientX, y: e.clientY, pointerId: e.pointerId },
              });
            return;
          }
          painting.current = true;
          erasing.current = e.button === 2;
          (
            e.target as unknown as { setPointerCapture: (id: number) => void }
          ).setPointerCapture(e.pointerId);
          useEditor.getState().begin(i, erasing.current);
          move(e);
        }}
        onPointerMove={move}
        onPointerUp={(e) => {
          painting.current = false;
          pointers.current.delete(e.pointerId);
          useEditor.getState().end();
          (
            e.target as unknown as {
              releasePointerCapture: (id: number) => void;
            }
          ).releasePointerCapture(e.pointerId);
        }}
        onPointerOut={() => {
          if (ghost.current) ghost.current.visible = false;
          invalidate();
        }}
      >
        <planeGeometry args={[width, height]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
      {selection ? (
        <mesh
          rotation={[-Math.PI / 2, 0, 0]}
          position={[
            (selection.x1 + selection.x2) / 2 - (width - 1) / 2,
            1.08,
            (selection.y1 + selection.y2) / 2 - (height - 1) / 2,
          ]}
        >
          <planeGeometry
            args={[
              Math.abs(selection.x2 - selection.x1) + 1,
              Math.abs(selection.y2 - selection.y1) + 1,
            ]}
          />
          <meshBasicMaterial
            color="#dbef91"
            transparent
            opacity={0.3}
            depthWrite={false}
          />
        </mesh>
      ) : null}
    </>
  );
}

function SharedPlayInteraction() {
  const held = usePlay((s) => s.held),
    peers = usePlay((s) => s.peers);
  const width = useEditor((s) => s.project.width),
    height = useEditor((s) => s.project.height);
  const { camera, gl, invalidate } = useThree();
  const preview = useRef<THREE.Group>(null);
  const geometry = useMemo(() => beadGeometry(), []);
  useEffect(() => () => geometry.dispose(), [geometry]);
  useEffect(() => {
    const ray = new THREE.Raycaster(),
      pointer = new THREE.Vector2(),
      hit = new THREE.Vector3();
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -1.05);
    const sample = (e: PointerEvent) => {
      const target = document.elementFromPoint(e.clientX, e.clientY);
      if (
        !target?.closest(".scene-container") ||
        !gl.domElement.parentElement?.parentElement?.contains(target)
      )
        return null;
      const rect = gl.domElement.getBoundingClientRect();
      pointer.set(
        (2 * (e.clientX - rect.left)) / rect.width - 1,
        1 - (2 * (e.clientY - rect.top)) / rect.height,
      );
      ray.setFromCamera(pointer, camera);
      if (
        !ray.ray.intersectPlane(plane, hit) ||
        Math.abs(hit.x) > 150 ||
        Math.abs(hit.z) > 150
      )
        return null;
      const x = Math.floor(hit.x + width / 2),
        y = Math.floor(hit.z + height / 2);
      const cell =
        target === gl.domElement && x >= 0 && x < width && y >= 0 && y < height
          ? y * width + x
          : null;
      return { position: { x: +hit.x.toFixed(2), z: +hit.z.toFixed(2) }, cell };
    };
    const move = (e: PointerEvent) => {
      if (!e.isPrimary) return;
      const point = sample(e),
        i = point?.cell ?? null;
      const play = usePlay.getState();
      if (point || play.position)
        usePlay.setState({ position: point?.position ?? null, hover: i });
      if (preview.current) {
        preview.current.visible = i !== null && !!play.held;
        if (i !== null)
          preview.current.position.set(
            (i % width) - (width - 1) / 2,
            0.85,
            Math.floor(i / width) - (height - 1) / 2,
          );
        invalidate();
      }
    };
    const up = (e: PointerEvent) => {
      const h = usePlay.getState().held;
      if (
        !h?.start ||
        (h.start.pointerId !== undefined && e.pointerId !== h.start.pointerId)
      )
        return;
      const i = sample(e)?.cell;
      const moved =
        Math.hypot(e.clientX - h.start.x, e.clientY - h.start.y) > 6;
      const overTray = document
        .elementFromPoint(e.clientX, e.clientY)
        ?.closest("[data-tray]")
        ?.getAttribute("data-tray");
      if (i != null && (moved || h.start.dropOnTap))
        usePlay.getState().place(i);
      else if (moved && h.trayId && overTray === h.trayId)
        usePlay.setState({ held: null, notice: "Bead returned." });
      else usePlay.setState({ held: { ...h, start: undefined } });
      invalidate();
    };
    const cancel = () => {
      usePlay.setState({ held: null, hover: null, position: null });
      invalidate();
    };
    const down = (e: PointerEvent) => {
      if (!e.isPrimary && e.pointerType === "touch") {
        const { held } = usePlay.getState();
        if (held?.start)
          usePlay.setState({ held: { ...held, start: undefined } });
        useEditor.getState().cancelStroke();
      } else move(e);
    };
    const leave = (e: PointerEvent) => {
      if (!e.relatedTarget) {
        usePlay.setState({ hover: null, position: null });
        if (preview.current) preview.current.visible = false;
        invalidate();
      }
    };
    window.addEventListener("pointerout", leave);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerdown", down);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", cancel);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerdown", down);
      window.removeEventListener("pointerout", leave);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", cancel);
    };
  }, [camera, gl, width, height, invalidate]);
  return (
    <>
      {held && (
        <group ref={preview} visible={false}>
          <mesh geometry={geometry}>
            <meshPhysicalMaterial
              color={COLOR_MAP[held.color].hex}
              transparent
              opacity={0.8}
              roughness={0.25}
              clearcoat={0.5}
            />
          </mesh>
          <mesh position={[0, 0.23, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.49, 0.63, 24]} />
            <meshBasicMaterial color="#c6e878" depthTest={false} />
          </mesh>
        </group>
      )}
      {held?.source !== undefined && (
        <mesh
          rotation={[-Math.PI / 2, 0, 0]}
          position={[
            (held.source % width) - (width - 1) / 2,
            1.1,
            Math.floor(held.source / width) - (height - 1) / 2,
          ]}
        >
          <ringGeometry args={[0.48, 0.62, 32]} />
          <meshBasicMaterial color="#d1f477" />
        </mesh>
      )}
      <TableToys geometry={geometry} />
      {peers.map((peer) => (
        <PeerCursor
          key={peer.id}
          peer={peer}
          width={width}
          height={height}
          geometry={geometry}
        />
      ))}
    </>
  );
}

function PeerCursor({
  peer,
  width,
  height,
  geometry,
}: {
  peer: Presence;
  width: number;
  height: number;
  geometry: THREE.BufferGeometry;
}) {
  const group = useRef<THREE.Group>(null);
  const goal = useMemo(() => {
    const point =
      peer.position ??
      (peer.cell != null
        ? {
            x: (peer.cell % width) - (width - 1) / 2,
            z: Math.floor(peer.cell / width) - (height - 1) / 2,
          }
        : null);
    return point ? new THREE.Vector3(point.x, 1.22, point.z) : null;
  }, [peer.position, peer.cell, width, height]);
  const initialized = useRef(false);
  const invalidate = useThree((s) => s.invalidate);
  const motion = useEditor((s) => s.motion);
  useLayoutEffect(() => {
    if (!goal) {
      initialized.current = false;
      return;
    }
    if (!initialized.current) group.current?.position.copy(goal);
    initialized.current = true;
    invalidate();
  }, [goal, invalidate]);
  useFrame((_, delta) => {
    if (!group.current || !goal) return;
    group.current.position.lerp(
      goal,
      motion === "full" ? 1 - Math.exp(-18 * Math.min(delta, 0.12)) : 1,
    );
    if (group.current.position.distanceToSquared(goal) > 0.001) invalidate();
  });
  const tint = `hsl(${parseInt(peer.id.slice(0, 6), 16) % 360}, 57%, 67%)`;
  if (!goal) return null;
  return (
    <group ref={group}>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.52, 0.68, 24]} />
        <meshBasicMaterial color={tint} depthTest={false} />
      </mesh>
      {peer.holding && (
        <mesh geometry={geometry} position={[0, 0.12, 0]}>
          <meshStandardMaterial color={COLOR_MAP[peer.holding].hex} />
        </mesh>
      )}
      <Html
        center
        position={[0, 1.5, 0]}
        zIndexRange={[4, 3]}
        style={{ pointerEvents: "none" }}
      >
        <span className="peer-cursor" style={{ borderColor: tint }}>
          {peer.name}
          {peer.tray
            ? " · moving box"
            : peer.holding
              ? ` · ${COLOR_MAP[peer.holding].name}`
              : ""}
        </span>
      </Html>
    </group>
  );
}

const BeadScene = memo(function BeadScene() {
  return (
    <Canvas
      orthographic
      camera={{ position: [11, 55, 38], zoom: 15, near: 0.1, far: 300 }}
      shadows
      dpr={[1, 1.6]}
      frameloop="demand"
      gl={{ antialias: true, alpha: true, preserveDrawingBuffer: true }}
      fallback={
        <div className="canvas-fallback">
          Your browser doesn’t support 3D. Try a browser with WebGL enabled.
          Your saved projects are safe.
        </div>
      }
      onCreated={({ gl }) => {
        gl.domElement.setAttribute(
          "aria-label",
          "Interactive 3D bead pegboard",
        );
        gl.domElement.setAttribute("role", "img");
      }}
    >
      <ambientLight intensity={0.65} />
      <hemisphereLight args={["#ffffff", "#c0b9a1", 0.7]} />
      <directionalLight
        position={[-18, 38, -12]}
        intensity={2.1}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-38}
        shadow-camera-right={38}
        shadow-camera-top={38}
        shadow-camera-bottom={-38}
        shadow-bias={-0.0005}
        shadow-normalBias={0.04}
      />
      <directionalLight position={[20, 15, 25]} intensity={0.7} />
      <Beads />
      <Pegboard />
      <Interaction />
      <SharedPlayInteraction />
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, -0.32, 0]}
        receiveShadow
      >
        <planeGeometry args={[200, 200]} />
        <shadowMaterial transparent opacity={0.14} />
      </mesh>
      <CameraRig />
    </Canvas>
  );
});
export default BeadScene;
