import * as THREE from "three";

export const STEP = (Math.PI * 2) / 3;
export const worldY = new THREE.Vector3(0, 1, 0);
export const radius = 1.5;

export function vertexPos(i: number): THREE.Vector3 {
  const angle = (Math.PI * 2 * i) / 3 + (5 * Math.PI) / 6;
  return new THREE.Vector3(
    Math.cos(angle) * radius,
    0,
    -Math.sin(angle) * radius,
  );
}

export function edgeMidpoint(i: number): THREE.Vector3 {
  const a = vertexPos((i + 1) % 3);
  const b = vertexPos((i + 2) % 3);
  return a.clone().add(b).multiplyScalar(0.5);
}

export function getInPlaneAxis(axisIdx: number): THREE.Vector3 {
  const v = vertexPos(axisIdx);
  const m = edgeMidpoint(axisIdx);
  return new THREE.Vector3(v.x - m.x, 0, v.z - m.z).normalize();
}
