import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import {
  ScanEye,
  RotateCcw,
  PlusCircle,
  Eye,
  Compass,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { SensorNode, SpecimenConfig } from '../types/shm';
import {
  ALLOY_SPECS,
  SEVERITY_META,
  generateJaggedCrackBranches,
  clamp,
} from '../utils/shmEngine';

interface DigitalTwin3DProps {
  specimen: SpecimenConfig;
  sensors: SensorNode[];
  selectedSensorId: string;
  onSelectSensor: (id: string) => void;
  onAddSensorAt: (nx: number, ny: number) => void;
}

type CameraPreset = 'iso' | 'top' | 'side' | 'closeup';

// Module-scope reusable math objects (zero GC inside render loop)
const _targetCamPos = new THREE.Vector3();
const _targetControlsLook = new THREE.Vector3();
const _raycaster = new THREE.Raycaster();
const _pointer = new THREE.Vector2();

function detectSoftwareWebGL(): boolean {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param));
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return true;
  }
}

/**
 * Generates a procedural brushed aerospace metal CanvasTexture (zero external files).
 */
function createBrushedMetalTexture(baseHex: number, maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const c = new THREE.Color(baseHex);
    const r = Math.round(c.r * 255);
    const g = Math.round(c.g * 255);
    const b = Math.round(c.b * 255);
    ctx.fillStyle = `rgb(${r},${g},${b})`;
    ctx.fillRect(0, 0, 512, 512);

    // Fine directional machined grain
    for (let i = 0; i < 1600; i++) {
      const y = Math.random() * 512;
      const alpha = 0.03 + Math.random() * 0.07;
      const light = Math.random() > 0.5 ? 255 : 15;
      ctx.fillStyle = `rgba(${light},${light},${light},${alpha})`;
      ctx.fillRect(0, y, 512, 1);
    }

    // Subtle calibration micro-grid etched on specimen
    ctx.strokeStyle = 'rgba(6, 182, 212, 0.14)';
    ctx.lineWidth = 1;
    for (let x = 0; x <= 512; x += 64) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, 512);
      ctx.stroke();
    }
    for (let y = 0; y <= 512; y += 64) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(512, y);
      ctx.stroke();
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

/**
 * Computes 3D world position and surface normal for a sensor at normalized (nx, ny)
 * matching the scaled composite specimen geometry.
 */
function mapNormalizedToSpecimenSurface(
  nx: number,
  ny: number,
  specimen: SpecimenConfig,
  scaleL: number,
  scaleW: number,
  scaleT: number
): { pos: THREE.Vector3; normal: THREE.Vector3 } {
  const u = (nx - 0.5) * scaleL;
  const v = (ny - 0.5) * scaleW;

  if (specimen.shape === 'pipe') {
    const radius = scaleW * 0.48;
    // Map ny across top half arc of cylinder (-65deg to +65deg)
    const theta = (ny - 0.5) * Math.PI * 0.72;
    const x = u;
    const y = radius * Math.cos(theta) + radius;
    const z = radius * Math.sin(theta);
    const normal = new THREE.Vector3(0, Math.cos(theta), Math.sin(theta)).normalize();
    return { pos: new THREE.Vector3(x, y, z), normal };
  }

  if (specimen.shape === 'blade') {
    // Tapered & slightly cambered airfoil surface
    const spanT = clamp(nx, 0, 1);
    const twistAngle = spanT * 0.24;
    const chordFactor = 1 - spanT * 0.26;
    const localZ = v * chordFactor;
    const camberY = Math.cos((ny - 0.5) * Math.PI) * scaleT * 0.9;
    const baseY = scaleT + camberY + Math.sin(twistAngle) * localZ * 0.35;
    return {
      pos: new THREE.Vector3(u, baseY, localZ),
      normal: new THREE.Vector3(0, 1, Math.sin(twistAngle) * 0.2).normalize(),
    };
  }

  if (specimen.shape === 'beam') {
    // Top flange of I-Beam
    const totalH = Math.max(0.95, scaleT * 2.8);
    return {
      pos: new THREE.Vector3(u, totalH, v),
      normal: new THREE.Vector3(0, 1, 0),
    };
  }

  // Default: rectangular metal plate
  return {
    pos: new THREE.Vector3(u, scaleT, v),
    normal: new THREE.Vector3(0, 1, 0),
  };
}

function disposeObject3D(root: THREE.Object3D): void {
  root.traverse((obj) => {
    if (obj instanceof THREE.Mesh || obj instanceof THREE.Line || obj instanceof THREE.LineSegments) {
      obj.geometry?.dispose();
      const mat = obj.material;
      if (Array.isArray(mat)) {
        mat.forEach((m) => m.dispose());
      } else if (mat) {
        mat.dispose();
      }
    }
  });
}

export const DigitalTwin3D: React.FC<DigitalTwin3DProps> = ({
  specimen,
  sensors,
  selectedSensorId,
  onSelectSensor,
  onAddSensorAt,
}) => {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const [xRayMode, setXRayMode] = useState(false);
  const [addMode, setAddMode] = useState(false);
  const [autoRotate, setAutoRotate] = useState(false);
  const [dockCollapsed, setDockCollapsed] = useState(false);

  // Refs synced for Three.js scene without tearing down WebGL context
  const specimenRef = useRef(specimen);
  const sensorsRef = useRef(sensors);
  const selectedIdRef = useRef(selectedSensorId);
  const xRayRef = useRef(xRayMode);
  const addModeRef = useRef(addMode);
  const autoRotateRef = useRef(autoRotate);
  const onSelectRef = useRef(onSelectSensor);
  const onAddRef = useRef(onAddSensorAt);

  const rebuildSpecimenRef = useRef<(() => void) | null>(null);
  const rebuildSensorsRef = useRef<(() => void) | null>(null);
  const applyCameraPresetRef = useRef<((preset: CameraPreset) => void) | null>(null);

  specimenRef.current = specimen;
  sensorsRef.current = sensors;
  selectedIdRef.current = selectedSensorId;
  xRayRef.current = xRayMode;
  addModeRef.current = addMode;
  autoRotateRef.current = autoRotate;
  onSelectRef.current = onSelectSensor;
  onAddRef.current = onAddSensorAt;

  // Initialize Three.js WebGL scene ONCE
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const isSoftwareGl = detectSoftwareWebGL();
    const width = Math.max(300, container.clientWidth);
    const height = Math.max(300, container.clientHeight);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x060a13);
    scene.fog = new THREE.FogExp2(0x060a13, 0.042);

    const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 120);
    camera.position.set(5.4, 4.1, 6.2);

    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      powerPreference: 'high-performance',
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    // Studio Environment Reflection (RoomEnvironment)
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const envTex = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = envTex;
    pmremGenerator.dispose();

    // OrbitControls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = !isSoftwareGl;
    controls.dampingFactor = 0.06;
    controls.minDistance = 2.2;
    controls.maxDistance = 18;
    controls.maxPolarAngle = Math.PI * 0.49;
    controls.target.set(0, 0.45, 0);

    // 3-Point Warm/Cool Aerospace Studio Lighting
    const hemiLight = new THREE.HemisphereLight(0x93c5fd, 0x0f172a, 0.75);
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(0xfff3e0, 2.2);
    keyLight.position.set(6.5, 9.5, 5.5);
    keyLight.castShadow = !isSoftwareGl;
    keyLight.shadow.mapSize.set(1024, 1024);
    keyLight.shadow.camera.left = -6;
    keyLight.shadow.camera.right = 6;
    keyLight.shadow.camera.top = 6;
    keyLight.shadow.camera.bottom = -6;
    keyLight.shadow.bias = -0.0005;
    keyLight.shadow.normalBias = 0.02;
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0x38bdf8, 1.15);
    rimLight.position.set(-7, 4.5, -6);
    scene.add(rimLight);

    // Grounded engineering workbench & subtle grid
    const gridHelper = new THREE.GridHelper(18, 36, 0x164e63, 0x0f1c31);
    gridHelper.position.y = -0.02;
    scene.add(gridHelper);

    const shadowPlaneGeo = new THREE.PlaneGeometry(14, 14);
    const shadowPlaneMat = new THREE.MeshStandardMaterial({
      color: 0x070c17,
      roughness: 0.92,
      metalness: 0.05,
    });
    const shadowPlane = new THREE.Mesh(shadowPlaneGeo, shadowPlaneMat);
    shadowPlane.rotation.x = -Math.PI / 2;
    shadowPlane.position.y = -0.04;
    shadowPlane.receiveShadow = !isSoftwareGl;
    scene.add(shadowPlane);

    // Groups for Specimen, Sensors & Animated Acoustic Ripples
    const specimenGroup = new THREE.Group();
    const sensorGroup = new THREE.Group();
    scene.add(specimenGroup);
    scene.add(sensorGroup);

    const raycastSurfaceMeshes: THREE.Object3D[] = [];
    const sensorPickMeshes: THREE.Object3D[] = [];
    const animatedRipples: Array<{
      mesh: THREE.Mesh;
      phase: number;
      maxScale: number;
      speed: number;
    }> = [];

    let metalTex: THREE.CanvasTexture | null = null;
    let uploadedTex: THREE.Texture | null = null;
    const textureLoader = new THREE.TextureLoader();

    // Camera transition state
    let camTransitionActive = false;
    controls.addEventListener('start', () => {
      camTransitionActive = false;
    });

    const getNormalizedScales = (cfg: SpecimenConfig) => {
      const maxSpan = Math.max(cfg.dimensions.length, cfg.dimensions.width, 120);
      const scaleL = clamp((cfg.dimensions.length / maxSpan) * 5.6, 2.2, 6.2);
      const scaleW = clamp((cfg.dimensions.width / maxSpan) * 5.6, 1.4, 4.6);
      const scaleT = clamp((cfg.dimensions.thickness / 14) * 0.44, 0.22, 0.9);
      return { scaleL, scaleW, scaleT };
    };

    const buildSpecimen = () => {
      disposeObject3D(specimenGroup);
      specimenGroup.clear();
      raycastSurfaceMeshes.length = 0;

      const cfg = specimenRef.current;
      const alloy = ALLOY_SPECS[cfg.alloy];
      const isXRay = xRayRef.current;
      const { scaleL, scaleW, scaleT } = getNormalizedScales(cfg);

      if (metalTex) metalTex.dispose();
      metalTex = createBrushedMetalTexture(
        alloy.baseHex,
        renderer.capabilities.getMaxAnisotropy()
      );

      const primaryMat = isXRay
        ? new THREE.MeshPhysicalMaterial({
            color: 0x0ea5e9,
            metalness: 0.15,
            roughness: 0.25,
            transparent: true,
            opacity: 0.18,
            depthWrite: false,
            side: THREE.DoubleSide,
          })
        : new THREE.MeshPhysicalMaterial({
            color: 0xffffff,
            map: metalTex,
            metalness: alloy.metalness,
            roughness: alloy.roughness,
            clearcoat: 0.15,
            clearcoatRoughness: 0.35,
          });

      const accentClampMat = new THREE.MeshStandardMaterial({
        color: isXRay ? 0x0284c7 : 0x1e293b,
        metalness: 0.72,
        roughness: 0.48,
        transparent: isXRay,
        opacity: isXRay ? 0.35 : 1,
      });

      const boltMat = new THREE.MeshStandardMaterial({
        color: isXRay ? 0x38bdf8 : 0xcbd5e1,
        metalness: 0.94,
        roughness: 0.18,
      });

      const wireMat = new THREE.LineBasicMaterial({
        color: isXRay ? 0x22d3ee : 0x334155,
        transparent: true,
        opacity: isXRay ? 0.58 : 0.22,
      });

      const addEdges = (geo: THREE.BufferGeometry, parent: THREE.Object3D) => {
        const edges = new THREE.EdgesGeometry(geo, 18);
        const line = new THREE.LineSegments(edges, wireMat);
        parent.add(line);
      };

      if (cfg.shape === 'plate') {
        // 1. Primary beveled aerospace plate
        const plateShape = new THREE.Shape();
        const hw = scaleL / 2;
        const hd = scaleW / 2;
        const r = 0.12;
        plateShape.moveTo(-hw + r, -hd);
        plateShape.lineTo(hw - r, -hd);
        plateShape.quadraticCurveTo(hw, -hd, hw, -hd + r);
        plateShape.lineTo(hw, hd - r);
        plateShape.quadraticCurveTo(hw, hd, hw - r, hd);
        plateShape.lineTo(-hw + r, hd);
        plateShape.quadraticCurveTo(-hw, hd, -hw, hd - r);
        plateShape.lineTo(-hw, -hd + r);
        plateShape.quadraticCurveTo(-hw, -hd, -hw + r, -hd);

        const plateGeo = new THREE.ExtrudeGeometry(plateShape, {
          depth: scaleT,
          bevelEnabled: true,
          bevelSegments: 2,
          steps: 1,
          bevelSize: 0.03,
          bevelThickness: 0.03,
        });
        plateGeo.rotateX(-Math.PI / 2);
        const plateMesh = new THREE.Mesh(plateGeo, primaryMat);
        plateMesh.position.y = 0.03;
        plateMesh.castShadow = !isSoftwareGl && !isXRay;
        plateMesh.receiveShadow = !isSoftwareGl;
        plateMesh.userData = { isSpecimenSurface: true };
        specimenGroup.add(plateMesh);
        raycastSurfaceMeshes.push(plateMesh);
        addEdges(plateGeo, plateMesh);

        // 2. End clamping fixtures (secondary read)
        const clampGeo = new THREE.BoxGeometry(0.28, scaleT + 0.14, scaleW + 0.2);
        [-hw + 0.1, hw - 0.1].forEach((cx) => {
          const clampMesh = new THREE.Mesh(clampGeo, accentClampMat);
          clampMesh.position.set(cx, (scaleT + 0.14) / 2, 0);
          clampMesh.castShadow = !isSoftwareGl && !isXRay;
          specimenGroup.add(clampMesh);
        });

        // 3. Corner titanium mounting bolts (accent detail)
        const boltGeo = new THREE.CylinderGeometry(0.06, 0.06, 0.12, 6);
        [-hw + 0.1, hw - 0.1].forEach((bx) => {
          [-hd + 0.25, 0, hd - 0.25].forEach((bz) => {
            const bolt = new THREE.Mesh(boltGeo, boltMat);
            bolt.position.set(bx, scaleT + 0.18, bz);
            specimenGroup.add(bolt);
          });
        });

        // Optional uploaded specimen blueprint/photo decal on top face
        if (cfg.customImageUrl && !isXRay) {
          if (uploadedTex) uploadedTex.dispose();
          uploadedTex = textureLoader.load(cfg.customImageUrl);
          uploadedTex.colorSpace = THREE.SRGBColorSpace;
          const decalGeo = new THREE.PlaneGeometry(scaleL - 0.4, scaleW - 0.16);
          const decalMat = new THREE.MeshStandardMaterial({
            map: uploadedTex,
            transparent: true,
            opacity: cfg.customImageOpacity,
            roughness: 0.5,
            metalness: 0.1,
            polygonOffset: true,
            polygonOffsetFactor: -1,
            polygonOffsetUnits: -1,
          });
          const decal = new THREE.Mesh(decalGeo, decalMat);
          decal.rotation.x = -Math.PI / 2;
          decal.position.y = scaleT + 0.065;
          specimenGroup.add(decal);
        }
      } else if (cfg.shape === 'pipe') {
        const radius = scaleW * 0.48;
        const innerRadius = Math.max(0.2, radius - scaleT * 0.35);

        // 1. Hollow cylindrical pipe via ExtrudeGeometry ring
        const ringShape = new THREE.Shape();
        ringShape.absarc(0, 0, radius, 0, Math.PI * 2, false);
        const holePath = new THREE.Path();
        holePath.absarc(0, 0, innerRadius, 0, Math.PI * 2, true);
        ringShape.holes.push(holePath);

        const pipeGeo = new THREE.ExtrudeGeometry(ringShape, {
          depth: scaleL,
          bevelEnabled: true,
          bevelSize: 0.02,
          bevelThickness: 0.02,
          curveSegments: 36,
        });
        pipeGeo.rotateY(Math.PI / 2);
        pipeGeo.translate(-scaleL / 2, radius, 0);

        const pipeMesh = new THREE.Mesh(pipeGeo, primaryMat);
        pipeMesh.castShadow = !isSoftwareGl && !isXRay;
        pipeMesh.receiveShadow = !isSoftwareGl;
        pipeMesh.userData = { isSpecimenSurface: true };
        specimenGroup.add(pipeMesh);
        raycastSurfaceMeshes.push(pipeMesh);
        addEdges(pipeGeo, pipeMesh);

        // 2. Machined end pressure flanges + bolt circle
        const flangeGeo = new THREE.CylinderGeometry(radius * 1.24, radius * 1.24, 0.18, 32);
        flangeGeo.rotateZ(Math.PI / 2);
        const boltGeo = new THREE.CylinderGeometry(0.045, 0.045, 0.24, 6);
        boltGeo.rotateZ(Math.PI / 2);

        [-scaleL / 2 + 0.06, scaleL / 2 - 0.06].forEach((fx) => {
          const flange = new THREE.Mesh(flangeGeo, accentClampMat);
          flange.position.set(fx, radius, 0);
          specimenGroup.add(flange);

          for (let b = 0; b < 8; b++) {
            const ang = (b / 8) * Math.PI * 2;
            const bolt = new THREE.Mesh(boltGeo, boltMat);
            bolt.position.set(
              fx,
              radius + Math.cos(ang) * radius * 1.1,
              Math.sin(ang) * radius * 1.1
            );
            specimenGroup.add(bolt);
          }
        });

        // 3. Support saddle cradles
        const saddleGeo = new THREE.BoxGeometry(0.32, 0.22, radius * 1.6);
        [-scaleL * 0.34, scaleL * 0.34].forEach((sx) => {
          const saddle = new THREE.Mesh(saddleGeo, accentClampMat);
          saddle.position.set(sx, 0.11, 0);
          specimenGroup.add(saddle);
        });
      } else if (cfg.shape === 'blade') {
        // 1. Airfoil cross-section extruded along span with gentle aerodynamic twist
        const foil = new THREE.Shape();
        const chord = scaleW;
        const thick = Math.max(0.2, scaleT * 0.72);
        foil.moveTo(-chord * 0.5, 0);
        foil.bezierCurveTo(-chord * 0.35, thick * 0.95, chord * 0.15, thick * 0.85, chord * 0.5, 0);
        foil.bezierCurveTo(chord * 0.15, -thick * 0.28, -chord * 0.35, -thick * 0.32, -chord * 0.5, 0);

        const bladeGeo = new THREE.ExtrudeGeometry(foil, {
          depth: scaleL,
          steps: 24,
          bevelEnabled: true,
          bevelSize: 0.015,
          bevelThickness: 0.02,
          curveSegments: 24,
        });
        // Rotate so span lies along X axis and chord along Z
        bladeGeo.rotateY(Math.PI / 2);
        bladeGeo.translate(-scaleL / 2, scaleT, 0);

        // Apply progressive aerodynamic twist & taper along span
        const posAttr = bladeGeo.attributes.position;
        for (let i = 0; i < posAttr.count; i++) {
          const x = posAttr.getX(i);
          const y = posAttr.getY(i);
          const z = posAttr.getZ(i);
          const t = clamp((x + scaleL / 2) / scaleL, 0, 1);
          const taper = 1 - t * 0.26;
          const twist = t * 0.24;
          const tz = z * taper;
          const ty = (y - scaleT) * taper;
          const rotY = ty * Math.cos(twist) - tz * Math.sin(twist);
          const rotZ = ty * Math.sin(twist) + tz * Math.cos(twist);
          posAttr.setXYZ(i, x, rotY + scaleT, rotZ);
        }
        bladeGeo.computeVertexNormals();

        const bladeMesh = new THREE.Mesh(bladeGeo, primaryMat);
        bladeMesh.castShadow = !isSoftwareGl && !isXRay;
        bladeMesh.receiveShadow = !isSoftwareGl;
        bladeMesh.userData = { isSpecimenSurface: true };
        specimenGroup.add(bladeMesh);
        raycastSurfaceMeshes.push(bladeMesh);
        addEdges(bladeGeo, bladeMesh);

        // 2. Dovetail turbine root block (secondary read)
        const rootGeo = new THREE.BoxGeometry(0.55, scaleT * 1.45, scaleW * 0.86);
        const rootMesh = new THREE.Mesh(rootGeo, accentClampMat);
        rootMesh.position.set(-scaleL / 2 - 0.18, scaleT * 0.72, 0);
        specimenGroup.add(rootMesh);

        // 3. Leading-edge erosion strip (accent detail)
        const stripGeo = new THREE.BoxGeometry(scaleL * 0.96, 0.06, 0.08);
        const strip = new THREE.Mesh(stripGeo, boltMat);
        strip.position.set(0, scaleT, -scaleW * 0.42);
        specimenGroup.add(strip);
      } else {
        // Structural I-Beam
        const totalH = Math.max(0.95, scaleT * 2.8);
        const flangeT = totalH * 0.16;
        const webT = Math.max(0.14, scaleW * 0.13);
        const halfW = scaleW / 2;

        const ibeam = new THREE.Shape();
        ibeam.moveTo(-halfW, 0);
        ibeam.lineTo(halfW, 0);
        ibeam.lineTo(halfW, flangeT);
        ibeam.lineTo(webT / 2, flangeT);
        ibeam.lineTo(webT / 2, totalH - flangeT);
        ibeam.lineTo(halfW, totalH - flangeT);
        ibeam.lineTo(halfW, totalH);
        ibeam.lineTo(-halfW, totalH);
        ibeam.lineTo(-halfW, totalH - flangeT);
        ibeam.lineTo(-webT / 2, totalH - flangeT);
        ibeam.lineTo(-webT / 2, flangeT);
        ibeam.lineTo(-halfW, flangeT);
        ibeam.closePath();

        const beamGeo = new THREE.ExtrudeGeometry(ibeam, {
          depth: scaleL,
          bevelEnabled: true,
          bevelSize: 0.015,
          bevelThickness: 0.015,
        });
        beamGeo.rotateY(Math.PI / 2);
        beamGeo.translate(-scaleL / 2, 0, 0);

        const beamMesh = new THREE.Mesh(beamGeo, primaryMat);
        beamMesh.castShadow = !isSoftwareGl && !isXRay;
        beamMesh.receiveShadow = !isSoftwareGl;
        beamMesh.userData = { isSpecimenSurface: true };
        specimenGroup.add(beamMesh);
        raycastSurfaceMeshes.push(beamMesh);
        addEdges(beamGeo, beamMesh);

        // Vertical web stiffener ribs
        const ribGeo = new THREE.BoxGeometry(0.08, totalH - flangeT * 2, scaleW * 0.88);
        [-scaleL * 0.32, 0, scaleL * 0.32].forEach((rx) => {
          const rib = new THREE.Mesh(ribGeo, accentClampMat);
          rib.position.set(rx, totalH / 2, 0);
          specimenGroup.add(rib);
        });

        // Base anchor plates
        const baseGeo = new THREE.BoxGeometry(0.42, 0.08, scaleW * 1.15);
        [-scaleL / 2 + 0.16, scaleL / 2 - 0.16].forEach((bx) => {
          const base = new THREE.Mesh(baseGeo, boltMat);
          base.position.set(bx, 0.04, 0);
          specimenGroup.add(base);
        });
      }
    };

    const buildSensorsAndCracks = () => {
      disposeObject3D(sensorGroup);
      sensorGroup.clear();
      sensorPickMeshes.length = 0;
      animatedRipples.length = 0;

      const cfg = specimenRef.current;
      const list = sensorsRef.current;
      const selId = selectedIdRef.current;
      const isXRay = xRayRef.current;
      const { scaleL, scaleW, scaleT } = getNormalizedScales(cfg);

      list.forEach((sensor) => {
        const { pos, normal } = mapNormalizedToSpecimenSurface(
          sensor.nx,
          sensor.ny,
          cfg,
          scaleL,
          scaleW,
          scaleT
        );
        const sevMeta = SEVERITY_META[sensor.lastSeverity];
        const sevColor = new THREE.Color(sevMeta.color);
        const isSelected = sensor.id === selId;

        const nodeGroup = new THREE.Group();
        nodeGroup.position.copy(pos);
        // Align local +Y with surface normal
        const up = new THREE.Vector3(0, 1, 0);
        const q = new THREE.Quaternion().setFromUnitVectors(up, normal);
        nodeGroup.quaternion.copy(q);

        // 1. Ceramic piezoelectric disc base
        const baseGeo = new THREE.CylinderGeometry(0.17, 0.19, 0.07, 20);
        const baseMat = new THREE.MeshStandardMaterial({
          color: 0x1e293b,
          metalness: 0.7,
          roughness: 0.3,
        });
        const baseMesh = new THREE.Mesh(baseGeo, baseMat);
        baseMesh.position.y = 0.035;
        baseMesh.userData = { sensorId: sensor.id };
        nodeGroup.add(baseMesh);
        sensorPickMeshes.push(baseMesh);

        // 2. Machined brass acoustic transducer cap
        const capGeo = new THREE.CylinderGeometry(0.12, 0.14, 0.14, 16);
        const capMat = new THREE.MeshStandardMaterial({
          color: isSelected ? 0x22d3ee : 0xd4af37,
          metalness: 0.9,
          roughness: 0.22,
          emissive: isSelected ? new THREE.Color(0x06b6d4) : sevColor,
          emissiveIntensity: isSelected ? 0.35 : sensor.lastSeverity === 'normal' ? 0.1 : 0.45,
        });
        const capMesh = new THREE.Mesh(capGeo, capMat);
        capMesh.position.y = 0.13;
        capMesh.userData = { sensorId: sensor.id };
        nodeGroup.add(capMesh);
        sensorPickMeshes.push(capMesh);

        // 3. Coaxial BNC connector pin
        const pinGeo = new THREE.CylinderGeometry(0.035, 0.035, 0.14, 12);
        const pinMat = new THREE.MeshStandardMaterial({
          color: 0xe2e8f0,
          metalness: 0.95,
          roughness: 0.15,
        });
        const pinMesh = new THREE.Mesh(pinGeo, pinMat);
        pinMesh.position.y = 0.26;
        nodeGroup.add(pinMesh);

        // 4. Status perimeter collar ring
        const collarGeo = new THREE.TorusGeometry(0.22, 0.022, 10, 28);
        collarGeo.rotateX(Math.PI / 2);
        const collarMat = new THREE.MeshBasicMaterial({
          color: isSelected ? 0x06b6d4 : sevColor,
        });
        const collar = new THREE.Mesh(collarGeo, collarMat);
        collar.position.y = 0.02;
        nodeGroup.add(collar);

        // 5. Real-time Jagged Micro-Crack & Internal Penetrating Depth Plane
        if (sensor.lastSeverity !== 'normal') {
          const crackRadius = sensor.lastSeverity === 'alarm' ? 0.78 : 0.48;
          const branches = generateJaggedCrackBranches(
            sensor.crackSeed,
            crackRadius,
            sensor.lastSeverity
          );

          // Penetration depth scaled visually (clearly visible inside X-Ray wall!)
          const visualDepth = clamp(
            (sensor.estimatedDepthUm / 180) * scaleT * (isXRay ? 0.92 : 0.78),
            0.08,
            scaleT * 0.95
          );

          branches.forEach((branch) => {
            const pts3D = branch.points.map((p) => new THREE.Vector3(p.x, 0.028, p.y));
            const lineGeo = new THREE.BufferGeometry().setFromPoints(pts3D);
            const lineMat = new THREE.LineBasicMaterial({
              color: sevColor,
              linewidth: 2,
            });
            const crackLine = new THREE.Line(lineGeo, lineMat);
            nodeGroup.add(crackLine);

            // Extruded glowing fracture ribbon descending INTO the specimen thickness
            if (branch.isPrimary && branch.points.length >= 2) {
              const positions: number[] = [];
              const len = branch.points.length;
              for (let i = 0; i < len - 1; i++) {
                const p0 = branch.points[i];
                const p1 = branch.points[i + 1];
                // Taper crack depth toward outer tips (elliptical fracture front)
                const d0 = visualDepth * Math.sin((i / (len - 1)) * Math.PI);
                const d1 = visualDepth * Math.sin(((i + 1) / (len - 1)) * Math.PI);

                // Two triangles per quad descending into -Y (inside specimen wall)
                positions.push(
                  p0.x, 0.015, p0.y,
                  p1.x, 0.015, p1.y,
                  p0.x, -d0, p0.y,

                  p1.x, 0.015, p1.y,
                  p1.x, -d1, p1.y,
                  p0.x, -d0, p0.y
                );
              }
              const bladeGeo = new THREE.BufferGeometry();
              bladeGeo.setAttribute(
                'position',
                new THREE.Float32BufferAttribute(positions, 3)
              );
              bladeGeo.computeVertexNormals();
              const bladeMat = new THREE.MeshBasicMaterial({
                color: sevColor,
                transparent: true,
                opacity: isXRay ? 0.78 : 0.45,
                side: THREE.DoubleSide,
                depthWrite: false,
              });
              const crackDepthMesh = new THREE.Mesh(bladeGeo, bladeMat);
              nodeGroup.add(crackDepthMesh);
            }
          });

          // 6. Expanding Acoustic Emission Wavefront Ripple Rings
          [0, 0.5].forEach((phaseOffset) => {
            const ringGeo = new THREE.RingGeometry(0.18, 0.24, 32);
            ringGeo.rotateX(-Math.PI / 2);
            const ringMat = new THREE.MeshBasicMaterial({
              color: sevColor,
              transparent: true,
              opacity: 0.75,
              side: THREE.DoubleSide,
              depthWrite: false,
            });
            const ringMesh = new THREE.Mesh(ringGeo, ringMat);
            ringMesh.position.y = 0.032;
            nodeGroup.add(ringMesh);
            animatedRipples.push({
              mesh: ringMesh,
              phase: phaseOffset,
              maxScale: sensor.lastSeverity === 'alarm' ? 4.4 : 3.0,
              speed: sensor.lastSeverity === 'alarm' ? 0.75 : 0.45,
            });
          });
        }

        sensorGroup.add(nodeGroup);
      });
    };

    const applyCameraPreset = (preset: CameraPreset) => {
      if (preset === 'iso') {
        _targetCamPos.set(5.4, 4.1, 6.2);
        _targetControlsLook.set(0, 0.45, 0);
      } else if (preset === 'top') {
        _targetCamPos.set(0.01, 7.8, 0.01);
        _targetControlsLook.set(0, 0.25, 0);
      } else if (preset === 'side') {
        _targetCamPos.set(0, 1.3, 7.6);
        _targetControlsLook.set(0, 0.4, 0);
      } else {
        // Closeup on selected sensor
        const active = sensorsRef.current.find((s) => s.id === selectedIdRef.current);
        if (active) {
          const { scaleL, scaleW, scaleT } = getNormalizedScales(specimenRef.current);
          const { pos } = mapNormalizedToSpecimenSurface(
            active.nx,
            active.ny,
            specimenRef.current,
            scaleL,
            scaleW,
            scaleT
          );
          _targetControlsLook.copy(pos);
          _targetCamPos.set(pos.x + 1.8, pos.y + 1.7, pos.z + 2.1);
        } else {
          _targetCamPos.set(3.2, 2.4, 3.6);
          _targetControlsLook.set(0, 0.4, 0);
        }
      }
      camTransitionActive = true;
    };

    rebuildSpecimenRef.current = buildSpecimen;
    rebuildSensorsRef.current = buildSensorsAndCracks;
    applyCameraPresetRef.current = applyCameraPreset;

    buildSpecimen();
    buildSensorsAndCracks();
    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    // Pointer click handler for Sensor selection & 3D Placement
    let pointerDownPos = { x: 0, y: 0 };
    const onPointerDown = (e: PointerEvent) => {
      pointerDownPos = { x: e.clientX, y: e.clientY };
    };
    const onPointerUp = (e: PointerEvent) => {
      const dist = Math.hypot(e.clientX - pointerDownPos.x, e.clientY - pointerDownPos.y);
      if (dist > 6) return; // Ignore orbit drags

      const rect = renderer.domElement.getBoundingClientRect();
      _pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      _pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      _raycaster.setFromCamera(_pointer, camera);

      // 1. Check existing sensor pick
      const sensorHits = _raycaster.intersectObjects(sensorPickMeshes, false);
      if (sensorHits.length > 0) {
        const hitId = sensorHits[0].object.userData.sensorId as string | undefined;
        if (hitId) {
          onSelectRef.current(hitId);
          return;
        }
      }

      // 2. If Add Sensor mode is active, raycast onto specimen surface
      if (addModeRef.current) {
        const surfaceHits = _raycaster.intersectObjects(raycastSurfaceMeshes, false);
        if (surfaceHits.length > 0) {
          const hitPt = surfaceHits[0].point;
          const { scaleL, scaleW } = getNormalizedScales(specimenRef.current);
          const nx = clamp(hitPt.x / scaleL + 0.5, 0.06, 0.94);
          const ny = clamp(hitPt.z / scaleW + 0.5, 0.08, 0.92);
          onAddRef.current(nx, ny);
        }
      }
    };

    renderer.domElement.addEventListener('pointerdown', onPointerDown);
    renderer.domElement.addEventListener('pointerup', onPointerUp);

    // ResizeObserver for crisp container responsiveness
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const w = Math.max(260, Math.floor(entry.contentRect.width));
        const h = Math.max(260, Math.floor(entry.contentRect.height));
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
      }
    });
    ro.observe(container);

    // Paced Animation Loop (using afterDraw fenceSync on software WebGL per Three.js skill)
    const clock = new THREE.Clock();
    let frameId = 0;
    let disposed = false;

    const afterDraw = (cb: () => void) => {
      if (disposed) return;
      const gl = renderer.getContext() as WebGL2RenderingContext;
      const sync = gl.fenceSync ? gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0) : null;
      if (sync) {
        gl.flush();
        const poll = () => {
          if (disposed) return;
          const status = gl.getSyncParameter(sync, gl.SYNC_STATUS);
          if (status === gl.UNSIGNALED) {
            frameId = window.setTimeout(poll, 5);
          } else {
            gl.deleteSync(sync);
            frameId = window.setTimeout(cb, 80);
          }
        };
        frameId = window.setTimeout(poll, 5);
      } else {
        frameId = window.setTimeout(cb, 80);
      }
    };

    const tick = () => {
      if (disposed) return;
      const delta = Math.min(clock.getDelta(), 0.1);

      controls.autoRotate = !isSoftwareGl && autoRotateRef.current;
      controls.autoRotateSpeed = 1.2;

      if (camTransitionActive) {
        camera.position.x = THREE.MathUtils.damp(camera.position.x, _targetCamPos.x, 6, delta);
        camera.position.y = THREE.MathUtils.damp(camera.position.y, _targetCamPos.y, 6, delta);
        camera.position.z = THREE.MathUtils.damp(camera.position.z, _targetCamPos.z, 6, delta);
        controls.target.x = THREE.MathUtils.damp(controls.target.x, _targetControlsLook.x, 6, delta);
        controls.target.y = THREE.MathUtils.damp(controls.target.y, _targetControlsLook.y, 6, delta);
        controls.target.z = THREE.MathUtils.damp(controls.target.z, _targetControlsLook.z, 6, delta);
        if (camera.position.distanceTo(_targetCamPos) < 0.03) {
          camTransitionActive = false;
        }
      }

      // Advance acoustic emission ripple rings
      for (let i = 0; i < animatedRipples.length; i++) {
        const r = animatedRipples[i];
        r.phase = (r.phase + delta * r.speed) % 1;
        const sc = 0.6 + r.phase * r.maxScale;
        r.mesh.scale.set(sc, sc, sc);
        const mat = r.mesh.material as THREE.MeshBasicMaterial;
        mat.opacity = (1 - r.phase) * 0.78;
      }

      controls.update();
      renderer.render(scene, camera);

      if (isSoftwareGl) {
        afterDraw(tick);
      } else {
        frameId = requestAnimationFrame(tick);
      }
    };

    tick();

    return () => {
      disposed = true;
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      ro.disconnect();
      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      renderer.domElement.removeEventListener('pointerup', onPointerUp);
      controls.dispose();
      disposeObject3D(specimenGroup);
      disposeObject3D(sensorGroup);
      shadowPlaneGeo.dispose();
      shadowPlaneMat.dispose();
      if (metalTex) metalTex.dispose();
      if (uploadedTex) uploadedTex.dispose();
      envTex.dispose();
      renderer.dispose();
    };
  }, []);

  // Rebuild specimen geometry when specimen config or X-Ray mode changes
  useEffect(() => {
    rebuildSpecimenRef.current?.();
    rebuildSensorsRef.current?.();
  }, [
    specimen.shape,
    specimen.alloy,
    specimen.dimensions.length,
    specimen.dimensions.width,
    specimen.dimensions.thickness,
    specimen.customImageUrl,
    specimen.customImageOpacity,
    xRayMode,
  ]);

  // Rebuild sensors & crack meshes when sensors or selection changes
  useEffect(() => {
    rebuildSensorsRef.current?.();
  }, [sensors, selectedSensorId, xRayMode]);

  const handleCameraPreset = useCallback((preset: CameraPreset) => {
    applyCameraPresetRef.current?.(preset);
  }, []);

  return (
    <div className="relative h-[470px] w-full overflow-hidden rounded-xl border border-slate-800/90 bg-[#060A13] sm:h-[520px]">
      {/* Dedicated isolated WebGL canvas mount */}
      <div
        ref={mountRef}
        className={`h-full w-full ${addMode ? 'cursor-crosshair' : 'cursor-grab active:cursor-grabbing'}`}
      />

      {/* Minimal Top-Right Spec Watermark-Free Indicator */}
      <div className="pointer-events-none absolute top-3 right-3 flex items-center gap-2 rounded-md border border-slate-700/80 bg-[#070B14]/90 px-3 py-1.5 text-[11px] text-slate-300">
        <span className="font-mono-num text-cyan-400" dir="ltr">
          3D WebGL
        </span>
        <span className="text-slate-600" aria-hidden="true">·</span>
        <span className="font-mono-num" dir="ltr">
          {specimen.dimensions.length}×{specimen.dimensions.width}×{specimen.dimensions.thickness} mm
        </span>
        {addMode && (
          <>
            <span className="text-slate-600" aria-hidden="true">·</span>
            <span className="font-semibold text-cyan-300">انقر على المجسم لإضافة حساس</span>
          </>
        )}
      </div>

      {/* Unified Collapsible Bottom Control Dock (Solid dark surface, no backdrop-filter over WebGL) */}
      <div className="absolute bottom-3 left-1/2 z-10 flex w-[94%] max-w-[680px] -translate-x-1/2 flex-col items-center">
        <button
          type="button"
          onClick={() => setDockCollapsed((v) => !v)}
          className="mb-1 inline-flex items-center gap-1 rounded-md border border-slate-700/80 bg-[#0B1221] px-2.5 py-0.5 text-[10px] font-medium text-slate-300 hover:border-cyan-500/50 hover:text-white cursor-pointer"
        >
          {dockCollapsed ? (
            <>
              <ChevronUp className="h-3 w-3" />
              <span>إظهار أدوات التحكم ثلاثية الأبعاد</span>
            </>
          ) : (
            <>
              <ChevronDown className="h-3 w-3" />
              <span>إخفاء الشريط</span>
            </>
          )}
        </button>

        {!dockCollapsed && (
          <div className="flex w-full flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-700/80 bg-[#0B1221]/95 px-3 py-2">
            {/* Camera Presets */}
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => handleCameraPreset('iso')}
                className="rounded px-2.5 py-1 text-[11px] font-medium text-slate-200 hover:bg-slate-800 whitespace-nowrap cursor-pointer"
              >
                منظور
              </button>
              <button
                type="button"
                onClick={() => handleCameraPreset('top')}
                className="rounded px-2.5 py-1 text-[11px] font-medium text-slate-200 hover:bg-slate-800 whitespace-nowrap cursor-pointer"
              >
                علوي
              </button>
              <button
                type="button"
                onClick={() => handleCameraPreset('side')}
                className="rounded px-2.5 py-1 text-[11px] font-medium text-slate-200 hover:bg-slate-800 whitespace-nowrap cursor-pointer"
              >
                جانبي
              </button>
              <button
                type="button"
                onClick={() => handleCameraPreset('closeup')}
                className="inline-flex items-center gap-1 rounded px-2.5 py-1 text-[11px] font-medium text-cyan-300 hover:bg-slate-800 whitespace-nowrap cursor-pointer"
              >
                <Eye className="h-3 w-3" />
                <span>تقريب للحساس</span>
              </button>
            </div>

            {/* Interactive Mode Toggles */}
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setXRayMode((v) => !v)}
                className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-[11px] font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                  xRayMode
                    ? 'border-cyan-400/70 bg-cyan-500/20 text-cyan-200'
                    : 'border-slate-700 bg-slate-900 text-slate-300 hover:border-slate-600'
                }`}
              >
                <ScanEye className="h-3.5 w-3.5" />
                <span>أشعة X-Ray</span>
              </button>

              <button
                type="button"
                onClick={() => setAddMode((v) => !v)}
                className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-[11px] font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                  addMode
                    ? 'border-emerald-400/70 bg-emerald-500/20 text-emerald-200'
                    : 'border-slate-700 bg-slate-900 text-slate-300 hover:border-slate-600'
                }`}
              >
                <PlusCircle className="h-3.5 w-3.5" />
                <span>وضع حساس</span>
              </button>

              <button
                type="button"
                onClick={() => setAutoRotate((v) => !v)}
                title="تدوير تلقائي"
                className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-medium transition-colors whitespace-nowrap cursor-pointer ${
                  autoRotate
                    ? 'border-cyan-400/60 bg-cyan-500/15 text-cyan-300'
                    : 'border-slate-700 bg-slate-900 text-slate-400 hover:text-slate-200'
                }`}
              >
                <Compass className="h-3.5 w-3.5" />
              </button>

              <button
                type="button"
                onClick={() => handleCameraPreset('iso')}
                title="إعادة ضبط الكاميرا"
                className="inline-flex items-center rounded-md border border-slate-700 bg-slate-900 p-1 text-slate-400 hover:border-slate-600 hover:text-slate-200 cursor-pointer"
              >
                <RotateCcw className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
