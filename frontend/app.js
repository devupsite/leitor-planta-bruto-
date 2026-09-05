/**
 * Fase 0 + Fase 3.5 — viewer com layout aproximado a partir da leitura
 * da planta via Claude Vision (proxy PHP na Hostinger).
 *
 * A sala procedural da Fase 0 continua sendo o estado inicial (antes de
 * qualquer upload). Quando o lead sobe uma imagem de planta, o resultado
 * do endpoint (lista de ambientes com nome/área/piso indicado) substitui
 * a sala pela representação aproximada: um piso por ambiente, com área
 * proporcional à área real, disposto em grade. NÃO é a geometria real da
 * planta (isso exigiria as Fases 1/2 com CAD/BIM vetorial) — é uma base
 * visual honesta pra mostrar o revestimento aplicado, não uma reconstrução
 * exata dos ambientes.
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const VISION_ENDPOINT = 'https://brutoceramica.com.br/api/planta-vision-proxy.php';
const MAX_UPLOAD_DIMENSION = 1600; // redimensiona antes de enviar, economiza tokens/latência

// ── Revestimentos placeholder ────────────────────────────────────────────
// Ainda não temos fotos reais do catálogo da Bruto (ver dataset/README.md).
const REVESTIMENTOS = [
  { id: 'placeholder-claro', nome: 'Placeholder — claro', color: 0xcfc6b8, roughness: 0.85 },
  { id: 'placeholder-escuro', nome: 'Placeholder — escuro', color: 0x4a3f35, roughness: 0.6 },
  { id: 'placeholder-cinza', nome: 'Placeholder — concreto', color: 0x8a8a86, roughness: 0.9 },
];

const ROOM_WIDTH = 6;
const ROOM_DEPTH = 5;
const WALL_HEIGHT = 2.8;
const WALL_THICKNESS = 0.12;
const GAP = 0.4;

let scene, camera, controls;
let roomGroup = null; // agrupa tudo que representa o ambiente atual, pra remover fácil ao trocar
let currentFloors = []; // meshes de piso ativos — trocar revestimento afeta todos
let revestimentoAtual = REVESTIMENTOS[0];

function init() {
  const container = document.getElementById('viewer-container');

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x14171a);

  camera = new THREE.PerspectiveCamera(50, container.clientWidth / container.clientHeight, 0.1, 100);
  camera.position.set(5, 4.5, 6);

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.setPixelRatio(window.devicePixelRatio);
  container.appendChild(renderer.domElement);

  controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 1, 0);
  controls.enableDamping = true;

  setupLights(scene);
  buildDefaultRoom();

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

/** Remove o grupo de ambiente atual da cena e libera memória (geometria/material/textura). */
function clearCurrentRoom() {
  if (!roomGroup) return;
  roomGroup.traverse((obj) => {
    if (obj.geometry) obj.geometry.dispose();
    if (obj.material) {
      if (obj.material.map) obj.material.map.dispose();
      obj.material.dispose();
    }
  });
  scene.remove(roomGroup);
  roomGroup = null;
  currentFloors = [];
}

/** Estado inicial (Fase 0): uma sala fixa, só pra validar o motor 3D. */
function buildDefaultRoom() {
  clearCurrentRoom();
  roomGroup = new THREE.Group();

  const floorGeo = new THREE.PlaneGeometry(ROOM_WIDTH, ROOM_DEPTH);
  const floorMat = new THREE.MeshStandardMaterial({
    color: revestimentoAtual.color,
    roughness: revestimentoAtual.roughness,
  });
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.rotation.x = -Math.PI / 2;
  roomGroup.add(floor);
  currentFloors.push(floor);

  const wallMat = new THREE.MeshStandardMaterial({ color: 0xd8d5cc, roughness: 0.95 });
  const wallDefs = [
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
    roomGroup.add(wall);
  }

  scene.add(roomGroup);
  controls.target.set(0, 1, 0);
  camera.position.set(5, 4.5, 6);

  updateStatus('Ambiente:', 'sala de exemplo (procedural)');
}

/** Cria um sprite de texto simples (canvas → textura) pra rotular cada ambiente. */
function createLabel(text) {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  const fontSize = 48;
  canvas.width = 512;
  canvas.height = 128;
  ctx.font = `600 ${fontSize}px -apple-system, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(20, 23, 26, 0.75)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#e8e6e0';
  ctx.fillText(text, canvas.width / 2, canvas.height / 2);

  const texture = new THREE.CanvasTexture(canvas);
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(1.6, 0.4, 1);
  return sprite;
}

/**
 * Constrói o layout aproximado a partir do resultado do proxy de Vision.
 * Cada ambiente vira um piso quadrado, com lado = sqrt(área), disposto em
 * grade. É uma aproximação deliberada — não a planta real.
 */
function buildLayoutFromAmbientes(ambientes) {
  clearCurrentRoom();
  roomGroup = new THREE.Group();

  const cols = Math.max(1, Math.ceil(Math.sqrt(ambientes.length)));
  const placements = [];
  let x = 0, z = 0, col = 0, rowHeight = 0;

  for (const amb of ambientes) {
    const area = typeof amb.area_m2 === 'number' && amb.area_m2 > 0 ? amb.area_m2 : 4;
    const side = Math.sqrt(area);
    placements.push({ ambiente: amb, side, cx: x + side / 2, cz: z + side / 2 });

    x += side + GAP;
    rowHeight = Math.max(rowHeight, side);
    col++;
    if (col >= cols) {
      col = 0;
      x = 0;
      z += rowHeight + GAP;
      rowHeight = 0;
    }
  }

  // Centraliza o layout na origem
  const minX = Math.min(...placements.map((p) => p.cx - p.side / 2));
  const maxX = Math.max(...placements.map((p) => p.cx + p.side / 2));
  const minZ = Math.min(...placements.map((p) => p.cz - p.side / 2));
  const maxZ = Math.max(...placements.map((p) => p.cz + p.side / 2));
  const offsetX = (minX + maxX) / 2;
  const offsetZ = (minZ + maxZ) / 2;
  const totalWidth = maxX - minX;
  const totalDepth = maxZ - minZ;

  for (const p of placements) {
    const geo = new THREE.PlaneGeometry(p.side * 0.96, p.side * 0.96); // pequena folga visual entre ambientes
    const mat = new THREE.MeshStandardMaterial({
      color: revestimentoAtual.color,
      roughness: revestimentoAtual.roughness,
    });
    const floor = new THREE.Mesh(geo, mat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(p.cx - offsetX, 0, p.cz - offsetZ);
    roomGroup.add(floor);
    currentFloors.push(floor);

    const label = createLabel(p.ambiente.nome || '?');
    label.position.set(p.cx - offsetX, 0.4, p.cz - offsetZ);
    roomGroup.add(label);
  }

  scene.add(roomGroup);

  const maxDim = Math.max(totalWidth, totalDepth, 3);
  controls.target.set(0, 0, 0);
  camera.position.set(maxDim * 0.9, maxDim * 1.1, maxDim * 1.0);

  const nomesResumo = ambientes.map((a) => a.nome).join(', ');
  updateStatus('Ambientes detectados:', `${ambientes.length} — ${nomesResumo}`);
}

function updateStatus(label, value) {
  document.getElementById('status-label').textContent = label;
  document.getElementById('status-text').textContent = value;
}

/**
 * Ponto de integração: aplica um revestimento em todos os pisos ativos
 * (seja a sala procedural da Fase 0, seja o layout gerado da planta real).
 */
function applyRevestimento(revestimento) {
  revestimentoAtual = revestimento;
  for (const mesh of currentFloors) {
    mesh.material.color.setHex(revestimento.color);
    mesh.material.roughness = revestimento.roughness;
    mesh.material.needsUpdate = true;
  }
}

/** Redimensiona a imagem no navegador antes de enviar — payload menor, resposta mais rápida. */
function resizeImageToBase64(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const reader = new FileReader();
    reader.onload = () => { img.src = reader.result; };
    reader.onerror = reject;
    img.onload = () => {
      const scale = Math.min(1, MAX_UPLOAD_DIMENSION / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
      resolve(dataUrl.split(',')[1]);
    };
    img.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function handleUpload(file) {
  updateStatus('Status:', 'Enviando e analisando planta...');
  try {
    const base64 = await resizeImageToBase64(file);
    const res = await fetch(VISION_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image_base64: base64, media_type: 'image/jpeg' }),
    });
    const data = await res.json();

    if (!res.ok || data.error) {
      updateStatus('Erro:', data.error || `HTTP ${res.status}`);
      return;
    }
    if (!Array.isArray(data.ambientes) || data.ambientes.length === 0) {
      updateStatus('Erro:', 'Nenhum ambiente foi identificado nesta imagem.');
      return;
    }

    buildLayoutFromAmbientes(data.ambientes);
  } catch (err) {
    updateStatus('Erro:', 'Falha de rede ao contatar o servidor. ' + err.message);
  }
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
    if (chosen) applyRevestimento(chosen);
  });

  const uploadInput = document.getElementById('upload-planta');
  uploadInput.addEventListener('change', () => {
    if (uploadInput.files[0]) handleUpload(uploadInput.files[0]);
  });
}

init();
setupUI();
