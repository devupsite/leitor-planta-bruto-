/**
 * Fase 0 — Fundação do viewer.
 *
 * Objetivo desta fase: validar o motor 3D (Three.js) e a lógica de troca de
 * revestimento numa superfície, ANTES de plugar qualquer parser real
 * (IFC/DXF/PDF). Por isso a sala aqui é gerada por código (procedural),
 * não vem de upload nenhum ainda.
 *
 * Quando os parsers da Fase 1/2 estiverem prontos, eles devem produzir uma
 * cena com pelo menos uma malha (mesh) marcada como "piso" — a função
 * `applyRevestimento()` abaixo é o ponto de integração: ela só precisa
 * receber a mesh certa, não importa de onde a geometria veio.
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// ── Revestimentos placeholder ────────────────────────────────────────────
// Ainda não temos fotos reais do catálogo da Bruto (ver dataset/README.md).
// Estes são só cor + rugosidade para validar a troca de material.
// Quando houver texturas reais, trocar `color` por um TextureLoader aqui.
const REVESTIMENTOS = [
  { id: 'placeholder-claro', nome: 'Placeholder — claro', color: 0xcfc6b8, roughness: 0.85 },
  { id: 'placeholder-escuro', nome: 'Placeholder — escuro', color: 0x4a3f35, roughness: 0.6 },
  { id: 'placeholder-cinza', nome: 'Placeholder — concreto', color: 0x8a8a86, roughness: 0.9 },
];

const ROOM_WIDTH = 6;
const ROOM_DEPTH = 5;
const WALL_HEIGHT = 2.8;
const WALL_THICKNESS = 0.12;

let floorMesh;

function init() {
  const container = document.getElementById('viewer-container');

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x14171a);

  const camera = new THREE.PerspectiveCamera(
    50,
    container.clientWidth / container.clientHeight,
    0.1,
    100
  );
  camera.position.set(5, 4.5, 6);

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.setPixelRatio(window.devicePixelRatio);
  container.appendChild(renderer.domElement);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 1, 0);
  controls.enableDamping = true;

  setupLights(scene);
  floorMesh = buildRoom(scene);

  window.addEventListener('resize', () => {
    camera.aspect = container.clientWidth / container.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(container.clientWidth, container.clientHeight);
  });

  function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
  }
  animate();
}

function setupLights(scene) {
  const hemi = new THREE.HemisphereLight(0xffffff, 0x2a2f34, 0.9);
  scene.add(hemi);

  const dir = new THREE.DirectionalLight(0xffffff, 1.1);
  dir.position.set(4, 6, 3);
  scene.add(dir);
}

/** Constrói uma sala simples: piso + 4 paredes. Retorna a mesh do piso. */
function buildRoom(scene) {
  const floorGeo = new THREE.PlaneGeometry(ROOM_WIDTH, ROOM_DEPTH);
  const floorMat = new THREE.MeshStandardMaterial({
    color: REVESTIMENTOS[0].color,
    roughness: REVESTIMENTOS[0].roughness,
  });
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.rotation.x = -Math.PI / 2;
  scene.add(floor);

  const wallMat = new THREE.MeshStandardMaterial({ color: 0xd8d5cc, roughness: 0.95 });

  const wallDefs = [
    // [comprimento, posição x, posição z, rotação y]
    [ROOM_WIDTH, 0, -ROOM_DEPTH / 2, 0],
    [ROOM_WIDTH, 0, ROOM_DEPTH / 2, 0],
    [ROOM_DEPTH, -ROOM_WIDTH / 2, 0, Math.PI / 2],
    [ROOM_DEPTH, ROOM_WIDTH / 2, 0, Math.PI / 2],
  ];

  for (const [length, x, z, rotY] of wallDefs) {
    const geo = new THREE.BoxGeometry(length, WALL_HEIGHT, WALL_THICKNESS);
    const wall = new THREE.Mesh(geo, wallMat);
    wall.position.set(x, WALL_HEIGHT / 2, z);
    wall.rotation.y = rotY;
    scene.add(wall);
  }

  return floor;
}

/**
 * Ponto de integração para as fases futuras: aplica um revestimento numa
 * mesh qualquer (hoje só o piso procedural; depois, a superfície que o
 * parser de IFC/DXF identificar como piso real do projeto do lead).
 */
function applyRevestimento(mesh, revestimento) {
  mesh.material.color.setHex(revestimento.color);
  mesh.material.roughness = revestimento.roughness;
  mesh.material.needsUpdate = true;
}

function setupUI() {
  const select = document.getElementById('revestimento-select');
  for (const rev of REVESTIMENTOS) {
    const opt = document.createElement('option');
    opt.value = rev.id;
    opt.textContent = rev.nome;
    select.appendChild(opt);
  }

  select.addEventListener('change', () => {
    const chosen = REVESTIMENTOS.find((r) => r.id === select.value);
    if (chosen) applyRevestimento(floorMesh, chosen);
  });
}

init();
setupUI();
