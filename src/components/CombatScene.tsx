import { useEffect, useRef } from "react";
import * as THREE from "three";
import type { SceneCallbacks } from "../game/useGameStore";
import { useGameState, store } from "../game/useGameStore";
import { STEP, worldY, vertexPos, edgeMidpoint, getInPlaneAxis } from "../three/geometry";
import { setupScene } from "../three/setupScene";
import type { SceneData } from "../three/setupScene";

export default function CombatScene() {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneDataRef = useRef<SceneData | null>(null);
  const state = useGameState();
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const data = setupScene(container);
    sceneDataRef.current = data;

    const callbacks: SceneCallbacks = {
      animateRotation: (fromOfficial) => {
        const signedAngle = -STEP;
        const base = fromOfficial
          ? data.officialQuat
          : data.triGroup.quaternion;
        const targetQuat = new THREE.Quaternion()
          .setFromAxisAngle(worldY, signedAngle)
          .multiply(base);

        data.animStartQuat.copy(data.triGroup.quaternion);
        data.animTargetQuat.copy(targetQuat);
        data.animT = 0;
        data.animating = true;
      },
      animateReflect: (fromOfficial) => {
        const inPlaneAxis = getInPlaneAxis(0);
        const base = fromOfficial
          ? data.officialQuat
          : data.triGroup.quaternion;
        const targetQuat = new THREE.Quaternion()
          .setFromAxisAngle(inPlaneAxis, Math.PI)
          .multiply(base);

        data.animStartQuat.copy(data.triGroup.quaternion);
        data.animTargetQuat.copy(targetQuat);
        data.animT = 0;
        data.animating = true;
      },
      animateUndo: () => {
        data.animStartQuat.copy(data.triGroup.quaternion);
        data.animTargetQuat.copy(data.officialQuat);
        data.animT = 0;
        data.animating = true;
      },
      commitOfficial: () => {
        data.officialQuat.copy(data.animTargetQuat);
      },
      isAnimating: () => data.animating,
    };
    store.sceneCallbacks = callbacks;

    const onWheel = (e: WheelEvent) => {
      data.camDist = Math.min(11, Math.max(3, data.camDist + e.deltaY * 0.005));
      data.camera.position.copy(data.camDir).multiplyScalar(data.camDist);
      e.preventDefault();
    };
    data.renderer.domElement.addEventListener("wheel", onWheel, {
      passive: false,
    });

    const onResize = () => {
      if (!container) return;
      data.camera.aspect = container.clientWidth / container.clientHeight;
      data.camera.updateProjectionMatrix();
      data.renderer.setSize(container.clientWidth, container.clientHeight);
    };
    window.addEventListener("resize", onResize);
    requestAnimationFrame(onResize);

    let frameId: number;
    const animate = () => {
      frameId = requestAnimationFrame(animate);

      if (data.animating) {
        data.animT += 0.06;
        const t = Math.min(1, data.animT);
        data.triGroup.quaternion.slerpQuaternions(
          data.animStartQuat,
          data.animTargetQuat,
          t,
        );
        if (t >= 1) {
          data.triGroup.quaternion.copy(data.animTargetQuat);
          data.animating = false;
        }
      }

      const s = stateRef.current;
      const t2 = performance.now() * 0.002;
      const heroR = s.hero.element.r;
      const enemyR = s.enemy.element.r;

      data.vertexMeshes.forEach((mesh, i) => {
        const isHero = i === heroR;
        mesh.position.y = isHero ? Math.sin(t2 * 2) * 0.05 : 0;
        mesh.scale.setScalar(isHero ? 1.2 : 1.0);
        (mesh.material as THREE.MeshStandardMaterial).emissiveIntensity =
          isHero ? 0.7 : 0.2;
      });

      data.ringMeshes.forEach((ring, i) => {
        let color: number | null = null;
        let opacity = 0;
        if (i === heroR) {
          color = 0x50e850;
          opacity = 0.95;
        }
        if (i === enemyR) {
          color = 0xe05050;
          opacity = Math.max(opacity, 0.85);
        }
        (ring.material as THREE.MeshBasicMaterial).opacity = opacity;
        if (color !== null)
          (ring.material as THREE.MeshBasicMaterial).color.setHex(color);
      });

      const enemyVtx = vertexPos(enemyR);
      const dir = enemyVtx.clone().normalize();
      data.enemyMarker.position.copy(enemyVtx).addScaledVector(dir, 0.7);
      data.enemyMarker.lookAt(enemyVtx);

      if (data.axisLine) {
        (data.axisLine.material as THREE.LineBasicMaterial).opacity =
          0.6 + Math.sin(performance.now() * 0.004) * 0.25;
      }

      data.renderer.render(data.scene, data.camera);
    };
    animate();

    return () => {
      cancelAnimationFrame(frameId);
      data.renderer.domElement.removeEventListener("wheel", onWheel);
      window.removeEventListener("resize", onResize);
      data.renderer.dispose();
      container.removeChild(data.renderer.domElement);
      store.sceneCallbacks = null;
    };
  }, []);

  // reflection axis line — fixed at vertex 0 (Hyle axis)
  useEffect(() => {
    const data = sceneDataRef.current;
    if (!data) return;
    if (data.axisLine) data.triGroup.remove(data.axisLine);

    const v = vertexPos(0);
    const m = edgeMidpoint(0);
    const mat = new THREE.LineBasicMaterial({
      color: 0xa050f0,
      transparent: true,
      opacity: 0.85,
    });
    const geo = new THREE.BufferGeometry().setFromPoints([
      v.clone().multiplyScalar(1.5),
      m.clone().multiplyScalar(1.5),
    ]);
    data.axisLine = new THREE.Line(geo, mat);
    data.triGroup.add(data.axisLine);
  }, []);

  return (
    <div className="panel canvas-panel">
      <div className="label">
        D3 Element Triangle — use buttons to rotate [E] or reflect [X]
      </div>
      <div id="canvasWrap" ref={containerRef}>
        <div className="legend">
          <div>
            hero vertex{" "}
            <span className="dot" style={{ background: "#50e850" }} />
          </div>
          <div>
            enemy element{" "}
            <span className="dot" style={{ background: "#e05050" }} />
          </div>
          <div>
            reflection axis{" "}
            <span className="dot" style={{ background: "#a050f0" }} />
          </div>
        </div>
      </div>
    </div>
  );
}
