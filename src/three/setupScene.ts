import * as THREE from "three";
import { STANCES, STANCE_COLOR } from "../game/types";
import { vertexPos, radius } from "./geometry";

export interface SceneData {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  triGroup: THREE.Group;
  vertexMeshes: THREE.Mesh[];
  ringMeshes: THREE.Mesh[];
  enemyMarker: THREE.Mesh;
  axisLine: THREE.Line | null;
  camDir: THREE.Vector3;
  camDist: number;
  animating: boolean;
  animStartQuat: THREE.Quaternion;
  animTargetQuat: THREE.Quaternion;
  animT: number;
  officialQuat: THREE.Quaternion;
}

export function setupScene(container: HTMLDivElement): SceneData {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x050805);

  const camera = new THREE.PerspectiveCamera(
    45,
    container.clientWidth / container.clientHeight,
    0.1,
    100,
  );
  camera.position.set(2.6, 3.4, 6.0);
  camera.lookAt(0, 0, 0);

  const camDir = camera.position.clone().normalize();
  const camDist = camera.position.length();

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  container.appendChild(renderer.domElement);

  scene.add(new THREE.AmbientLight(0x445544, 1.1));
  const keyLight = new THREE.PointLight(0x50e850, 1.2, 20);
  keyLight.position.set(3, 5, 4);
  scene.add(keyLight);
  const rimLight = new THREE.PointLight(0xe05050, 0.5, 20);
  rimLight.position.set(-4, 2, -3);
  scene.add(rimLight);

  const grid = new THREE.GridHelper(14, 14, 0x1c2620, 0x121a15);
  grid.position.y = -1.5;
  scene.add(grid);

  const triGroup = new THREE.Group();
  scene.add(triGroup);

  const edgePoints: THREE.Vector3[] = [];
  for (let i = 0; i <= 3; i++) edgePoints.push(vertexPos(i % 3));
  const edgeGeo = new THREE.BufferGeometry().setFromPoints(edgePoints);
  triGroup.add(
    new THREE.Line(edgeGeo, new THREE.LineBasicMaterial({ color: 0x2a3a2e })),
  );

  const vertexMeshes: THREE.Mesh[] = [];
  const ringMeshes: THREE.Mesh[] = [];

  STANCES.forEach((name, i) => {
    const pos = vertexPos(i);
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.3, 32, 32),
      new THREE.MeshStandardMaterial({
        color: STANCE_COLOR[name],
        emissive: STANCE_COLOR[name],
        emissiveIntensity: 0.25,
        roughness: 0.4,
        metalness: 0.2,
      }),
    );
    mesh.position.copy(pos);
    triGroup.add(mesh);
    vertexMeshes.push(mesh);

    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.44, 0.03, 8, 40),
      new THREE.MeshBasicMaterial({
        color: 0x50e850,
        transparent: true,
        opacity: 0,
      }),
    );
    ring.position.copy(pos);
    ring.rotation.x = Math.PI / 2;
    triGroup.add(ring);
    ringMeshes.push(ring);
  });

  const enemyMarker = new THREE.Mesh(
    new THREE.ConeGeometry(0.16, 0.42, 4),
    new THREE.MeshBasicMaterial({ color: 0xe05050 }),
  );
  enemyMarker.position.set(0, 0, radius + 1.0);
  enemyMarker.rotation.x = Math.PI / 2;
  scene.add(enemyMarker);

  const axisLine: THREE.Line | null = null;

  return {
    scene,
    camera,
    renderer,
    triGroup,
    vertexMeshes,
    ringMeshes,
    enemyMarker,
    axisLine,
    camDir,
    camDist,
    animating: false,
    animStartQuat: new THREE.Quaternion(),
    animTargetQuat: new THREE.Quaternion(),
    animT: 0,
    officialQuat: new THREE.Quaternion(),
  };
}
