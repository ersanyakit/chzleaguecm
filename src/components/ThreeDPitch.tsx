import React, { useRef, useEffect, useState } from 'react';
import * as THREE from 'three';
import { Camera, RefreshCw, Maximize2, Compass, Eye, VolumeX, Volume2 } from 'lucide-react';
import { soundEngine } from '../utils/soundEngine';
import BroadcastBanner from './BroadcastBanner';

interface PitchPlayer {
  id: string;
  name: string;
  position: string;
  team: 'home' | 'away';
  x: number; // percentage (0 - 100)
  y: number; // percentage (0 - 100)
  rating: number;
  number: number;
  restartAction?: RestartAction;
}

type RestartAction = 'THROW_IN' | 'CORNER' | 'FREE_KICK' | 'PENALTY' | 'GOAL_KICK';

interface MiniPass {
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  time: number;
}

const getFormattedShortName = (fullName: string): string => {
  if (!fullName) return '';
  const parts = fullName.trim().replace(/\s+/g, ' ').split(' ');
  if (parts.length === 1) return parts[0];
  if (parts.length === 2) {
    return `${parts[0][0].toUpperCase()}. ${parts[1].toUpperCase()}`;
  }
  const initials = parts.slice(0, -1).map(p => p[0].toUpperCase() + '.').join(' ');
  return `${initials} ${parts[parts.length - 1].toUpperCase()}`;
};

interface ThreeDPitchProps {
  pitchPlayers: PitchPlayer[];
  ball: { x: number; y: number };
  referee: { x: number; y: number };
  passingLines: MiniPass[];
  homeClub: { name: string; badge: string; shortName: string };
  awayClub: { name: string; badge: string; shortName: string };
  possession: number; // home possession percentage
  fxState: { type: 'GOAL' | 'SAVE' | 'MISS' | 'CARD' | 'RED_CARD' | 'FOUL' | 'INJURY' | 'NONE'; text?: string; team?: string; x?: number; y?: number; shotFromX?: number; shotFromY?: number; goalHeight?: number; eventKey?: number } | null;
  ballPossessorId?: string | null;
}

type CameraPreset = 'BROADCAST' | 'TACTICAL_3D' | 'BEHIND_GOAL' | 'TACTICAL';

export default function ThreeDPitch({
  pitchPlayers,
  ball,
  referee,
  passingLines,
  homeClub,
  awayClub,
  possession,
  fxState,
  ballPossessorId
}: ThreeDPitchProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [cameraPreset, setCameraPreset] = useState<CameraPreset>('BROADCAST');
  const [isRotating, setIsRotating] = useState<boolean>(true);
  const [isSupported, setIsSupported] = useState<boolean>(true);
  const homePossessionDisplay = possession.toFixed(2);
  const awayPossessionDisplay = (100 - possession).toFixed(2);

  // Scene state refs for live animation coupling
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const playersGroupRef = useRef<THREE.Group | null>(null);
  const ballMeshRef = useRef<THREE.Mesh | null>(null);
  const refereeMeshRef = useRef<THREE.Group | null>(null);

  // Ball physics integration refs
  const ballPhysicsRef = useRef({
    x: 0,
    y: 0.22,
    z: 0,
    vx: 0,
    vy: 0,
    vz: 0
  });
  const ballTargetPosRef = useRef({ x: 0, z: 0 });
  const prevPropsBall = useRef({ x: 50, y: 50 });
  const lastBallImpulseAtRef = useRef(0);
  const activeGoalShotKeyRef = useRef<string | null>(null);
  const goalShotStartedAtRef = useRef(0);

  const fxStateRef = useRef(fxState);
  useEffect(() => {
    fxStateRef.current = fxState;
    if (fxState) {
      if (fxState.type === 'GOAL') {
        soundEngine.playWhistle(true);
        // Play epic crowd cheer with a tiny natural lag
        setTimeout(() => {
          soundEngine.playGoalRoar();
        }, 120);
      } else if (fxState.type === 'SAVE') {
        soundEngine.playSwoosh();
      } else if (fxState.type === 'MISS') {
        if (fxState.text && (fxState.text.toLowerCase().includes('direk') || fxState.text.toLowerCase().includes('post') || fxState.text.toLowerCase().includes('çarp'))) {
          soundEngine.playMetalPostClank();
        } else {
          soundEngine.playSwoosh();
        }
      } else if (fxState.type === 'CARD' || fxState.type === 'RED_CARD' || fxState.type === 'FOUL') {
        soundEngine.playWhistle(false);
      }
    }
  }, [fxState]);

  const ballPossessorIdRef = useRef(ballPossessorId);
  useEffect(() => {
    ballPossessorIdRef.current = ballPossessorId;
  }, [ballPossessorId]);

  const cameraLookAtRef = useRef(new THREE.Vector3(0, 0.45, 0));

  // Camera Orbit parameters
  const orbitAngleRef = useRef<number>(Math.PI / 2.1); // horizontal angle
  const orbitHeightRef = useRef<number>(28);          // distance height
  const targetOrbitAngleRef = useRef<number>(Math.PI / 2.1);
  const targetOrbitHeightRef = useRef<number>(28);
  const targetYAngleRef = useRef<number>(0.55); // vertical lookup angle

  // Convert percentages to 3D dimensions
  // MatchEngine's longitudinal X (0 to 100) maps to Three.js's longitudinal Z depth [-18.5, 18.5]
  // MatchEngine's latitudinal Y (0 to 100) maps to Three.js's latitudinal X width [-13.5, 13.5]
  const mapCoords = (percX: number, percY: number) => {
    const zDepth = (percX / 100.0) * 37.0 - 18.5;
    const xWidth = (percY / 100.0) * 27.0 - 13.5;
    return { x: xWidth, z: zDepth };
  };

  // Listen for ball ticks from simulation loop to apply gorgeous real kick impulses!
  useEffect(() => {
    let c = mapCoords(ball.x, ball.y);
    const hasControlledBall = Boolean(ballPossessorIdRef.current && fxState?.type !== 'GOAL');

    // Intercept goals as a two-stage shot: first launch from the shooter, then settle in the net.
    if (fxState && fxState.type === 'GOAL') {
      const isHomeScoring = fxState.team === 'home';
      // Home team scores on awayGoal (Z = 19.5, net back wall at 20.4)
      // Away team scores on homeGoal (Z = -19.5, net back wall at -20.4)
      const goalZ = isHomeScoring ? 20.12 : -20.12;

      // Map ball.y (0..100) to the goal width [-2.5, 2.5] (inside posts which are at [-3.25, 3.25])
      const goalWidthX = (ball.y / 100.0) * 6.0 - 3.0;
      c = { x: goalWidthX, z: goalZ };
    }

    const prevC = mapCoords(prevPropsBall.current.x, prevPropsBall.current.y);
    const dist = Math.hypot(c.x - prevC.x, c.z - prevC.z);

    ballTargetPosRef.current = { x: c.x, z: c.z };
    const now = performance.now();

    if (hasControlledBall) {
      prevPropsBall.current = { ...ball };
      return;
    }

    if (fxState && fxState.type === 'GOAL') {
      const goalKey = `${fxState.eventKey ?? ''}-${fxState.team}-${fxState.text || ''}-${fxState.x?.toFixed(2) || 'x'}-${fxState.y?.toFixed(2) || 'y'}`;
      if (activeGoalShotKeyRef.current !== goalKey) {
        activeGoalShotKeyRef.current = goalKey;
        goalShotStartedAtRef.current = now;
        lastBallImpulseAtRef.current = now;

        const shotStart = mapCoords(
          typeof fxState.shotFromX === 'number' ? fxState.shotFromX : prevPropsBall.current.x,
          typeof fxState.shotFromY === 'number' ? fxState.shotFromY : prevPropsBall.current.y
        );
        const travelTime = 0.82 + Math.min(0.34, Math.hypot(c.x - shotStart.x, c.z - shotStart.z) * 0.018);
        const targetGoalHeight = typeof fxState.goalHeight === 'number' ? fxState.goalHeight : 1.2;

        ballPhysicsRef.current.x = shotStart.x;
        ballPhysicsRef.current.y = 0.28;
        ballPhysicsRef.current.z = shotStart.z;
        ballPhysicsRef.current.vx = (c.x - shotStart.x) / travelTime;
        ballPhysicsRef.current.vz = (c.z - shotStart.z) / travelTime;
        ballPhysicsRef.current.vy = (targetGoalHeight - ballPhysicsRef.current.y) / travelTime - 0.5 * (-18.5) * travelTime;
      }

      return;
    }

    prevPropsBall.current = { ...ball };

    // When the coordinate changes significantly, trigger a realistic ball-kick projection!
    if (dist > 1.2 && now - lastBallImpulseAtRef.current > 550) {
      lastBallImpulseAtRef.current = now;
      // Calculate realistic flight loft duration based on distance
      const travelTime = Math.min(1.2, 0.45 + dist * 0.04);

      // Interpolate horizontal velocity to land perfectly on target
      ballPhysicsRef.current.vx = (c.x - ballPhysicsRef.current.x) / travelTime;
      ballPhysicsRef.current.vz = (c.z - ballPhysicsRef.current.z) / travelTime;

      // Vertical impulse loft height proportional to pass/shot type
      if (fxState && (fxState.type === 'GOAL' || fxState.type === 'SAVE' || fxState.type === 'MISS')) {
        // It's a shot! Elevate the trajectory beautifully to the target height!
        const shotHeight = fxState.type === 'GOAL'
          ? 1.35
          : fxState.type === 'SAVE'
            ? 1.05
            : 3.35;

        // Perfect ballistic trajectory physics formula
        ballPhysicsRef.current.vy = (shotHeight - ballPhysicsRef.current.y) / travelTime - 0.5 * (-18.5) * travelTime;
      } else if (dist > 4.5) {
        // Regular long pass high loft arc
        ballPhysicsRef.current.vy = dist * 0.52; 
      } else {
        // Short pass grassroots slider
        ballPhysicsRef.current.vy = 1.5;
      }
    }
  }, [ball, fxState]);

  // Adjust camera preset settings
  useEffect(() => {
    switch (cameraPreset) {
      case 'BROADCAST':
        targetOrbitAngleRef.current = Math.PI / 2.1; // classical wide angle
        targetOrbitHeightRef.current = 28;
        targetYAngleRef.current = 0.55;
        break;
      case 'TACTICAL_3D':
        targetOrbitAngleRef.current = Math.PI / 4.5; // beautiful angled 3D view
        targetOrbitHeightRef.current = 30;
        targetYAngleRef.current = 0.68;
        break;
      case 'BEHIND_GOAL':
        targetOrbitAngleRef.current = -Math.PI / 2; // behind the net view
        targetOrbitHeightRef.current = 24;
        targetYAngleRef.current = 0.42;
        break;
      case 'TACTICAL':
        targetOrbitAngleRef.current = Math.PI / 2.05; // overhead bird's eye view
        targetOrbitHeightRef.current = 36;
        targetYAngleRef.current = 1.35;
        break;
    }
  }, [cameraPreset]);

  // Field chalk patterns directly into high quality texture
  const createFieldTexture = () => {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 1365;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    // Elegant dense alternating turf grass stripes background
    const stripesCount = 15;
    const stripeHeight = canvas.height / stripesCount;
    for (let i = 0; i < stripesCount; i++) {
      ctx.fillStyle = i % 2 === 0 ? '#166534' : '#15803d'; // alternating dark/light emerald greens
      ctx.fillRect(0, i * stripeHeight, canvas.width, stripeHeight);
    }

    // Outer margin turf glow border
    ctx.strokeStyle = '#052c16';
    ctx.lineWidth = 15;
    ctx.strokeRect(0, 0, canvas.width, canvas.height);

    // Realistic white match markings lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.76)';
    ctx.lineWidth = 6;

    // Field outer box constraints
    const pad = 45;
    const w = canvas.width - pad * 2;
    const h = canvas.height - pad * 2;
    ctx.strokeRect(pad, pad, w, h);

    // Center divider
    ctx.beginPath();
    ctx.moveTo(pad, canvas.height / 2);
    ctx.lineTo(canvas.width - pad, canvas.height / 2);
    ctx.stroke();

    // Center Radius
    ctx.beginPath();
    ctx.arc(canvas.width / 2, canvas.height / 2, 95, 0, Math.PI * 2);
    ctx.stroke();

    // Center kick dot
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(canvas.width / 2, canvas.height / 2, 8, 0, Math.PI * 2);
    ctx.fill();

    // Bottom penalty box
    ctx.strokeRect(canvas.width / 2 - 210, pad, 420, 160);
    ctx.strokeRect(canvas.width / 2 - 90, pad, 180, 55);
    // Spot kick point
    ctx.beginPath();
    ctx.arc(canvas.width / 2, pad + 110, 5, 0, Math.PI * 2);
    ctx.fill();
    // Arc edge
    ctx.beginPath();
    ctx.arc(canvas.width / 2, pad + 110, 75, 0.16 * Math.PI, 0.84 * Math.PI);
    ctx.stroke();

    // Top penalty box
    ctx.strokeRect(canvas.width / 2 - 210, canvas.height - pad - 160, 420, 160);
    ctx.strokeRect(canvas.width / 2 - 90, canvas.height - pad - 55, 180, 55);
    // Spot kick point
    ctx.beginPath();
    ctx.arc(canvas.width / 2, canvas.height - pad - 110, 5, 0, Math.PI * 2);
    ctx.fill();
    // Arc edge
    ctx.beginPath();
    ctx.arc(canvas.width / 2, canvas.height - pad - 110, 75, 1.16 * Math.PI, 1.84 * Math.PI);
    ctx.stroke();

    // Corner arcs
    const arc = 25;
    ctx.beginPath(); ctx.arc(pad, pad, arc, 0, Math.PI / 2); ctx.stroke();
    ctx.beginPath(); ctx.arc(canvas.width - pad, pad, arc, Math.PI / 2, Math.PI); ctx.stroke();
    ctx.beginPath(); ctx.arc(pad, canvas.height - pad, arc, 1.5 * Math.PI, 2 * Math.PI); ctx.stroke();
    ctx.beginPath(); ctx.arc(canvas.width - pad, canvas.height - pad, arc, Math.PI, 1.5 * Math.PI); ctx.stroke();

    const tex = new THREE.CanvasTexture(canvas);
    return tex;
  };

  // Create FRONT of Player Torso (Sponsor Brand logo and small badge)
  const createFrontJerseyTexture = (player: PitchPlayer, isHome: boolean) => {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    const isGK = player.position === 'GK';
    const primaryColor = isGK ? '#f59e0b' : (isHome ? '#da020e' : '#0284c7');
    const accentColor = isGK ? '#111827' : (isHome ? '#ffffff' : '#fef08a');

    // Solid base paint
    ctx.fillStyle = primaryColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Double stripes patterns
    ctx.fillStyle = isGK ? 'rgba(0,0,0,0.18)' : (isHome ? 'rgba(0,0,0,0.14)' : 'rgba(255,255,255,0.08)');
    ctx.fillRect(16, 0, 24, 128);
    ctx.fillRect(88, 0, 24, 128);

    // Collar V shape details
    ctx.strokeStyle = accentColor;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(35, 0);
    ctx.lineTo(64, 25);
    ctx.lineTo(93, 0);
    ctx.stroke();

    // Match Sponsor logo in middle
    ctx.fillStyle = accentColor;
    ctx.font = 'bold 20px "JetBrains Mono", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('STUDIO', canvas.width / 2, 70);

    // Golden team crest star
    ctx.fillStyle = '#facc15';
    ctx.beginPath();
    ctx.arc(36, 36, 6, 0, Math.PI * 2);
    ctx.fill();

    const txt = new THREE.CanvasTexture(canvas);
    txt.needsUpdate = true;
    return txt;
  };

  // Create BACK of Player Torso with Name & number
  const createBackJerseyTexture = (player: PitchPlayer, isHome: boolean) => {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    const isGK = player.position === 'GK';
    const primaryColor = isGK ? '#f59e0b' : (isHome ? '#da020e' : '#0284c7');
    const accentColor = isGK ? '#111827' : (isHome ? '#ffffff' : '#fef08a');

    // Base paint
    ctx.fillStyle = primaryColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Subtle stripes
    ctx.fillStyle = isGK ? 'rgba(0,0,0,0.18)' : (isHome ? 'rgba(0,0,0,0.14)' : 'rgba(255,255,255,0.08)');
    ctx.fillRect(16, 0, 24, 128);
    ctx.fillRect(88, 0, 24, 128);

    // Jersey player name at top
    ctx.fillStyle = accentColor;
    ctx.font = '900 15px "Inter", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const shortName = getFormattedShortName(player.name);
    ctx.fillText(shortName, canvas.width / 2, 30);

    // Massive prominent high contrast Number
    ctx.font = 'black 52px "JetBrains Mono", monospace';
    ctx.shadowColor = 'rgba(0,0,0,0.45)';
    ctx.shadowBlur = 4;
    ctx.fillText(String(player.number), canvas.width / 2, 75);

    const txt = new THREE.CanvasTexture(canvas);
    txt.needsUpdate = true;
    return txt;
  };

  // Compile Three.js environment
  useEffect(() => {
    if (!containerRef.current) return;

    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight;

    // 1. Scene setup
    const scene = new THREE.Scene();
    scene.background = null;
    sceneRef.current = scene;

    // 2. Camera setup
    const camera = new THREE.PerspectiveCamera(38, width / height, 0.1, 1000);
    cameraRef.current = camera;

    // 3. WebGL High Performance Renderer
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.setSize(width, height);
      renderer.shadowMap.enabled = false;

      // Clean out container children to avoid re-renders overlaps
      while (containerRef.current.firstChild) {
        containerRef.current.removeChild(containerRef.current.firstChild);
      }
      containerRef.current.appendChild(renderer.domElement);
      rendererRef.current = renderer;
    } catch (e) {
      console.error(e);
      setIsSupported(false);
      return;
    }

    // 4. Lights Setup
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.88);
    scene.add(ambientLight);

    // Soft overhead floodlight simulation
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.58);
    dirLight.position.set(12, 35, 12);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 1024;
    dirLight.shadow.mapSize.height = 1024;
    dirLight.shadow.camera.near = 0.5;
    dirLight.shadow.camera.far = 85;
    const ortho = 25;
    dirLight.shadow.camera.left = -ortho;
    dirLight.shadow.camera.right = ortho;
    dirLight.shadow.camera.top = ortho;
    dirLight.shadow.camera.bottom = -ortho;
    scene.add(dirLight);

    // Warm, stadium spotlight corona lamps glowing from the corners
    const spotColors = [0xdbeafe, 0xfef08a, 0xffffff, 0xfbcfe8];
    const spotPoints = [
      { x: -16, z: -24 },
      { x: 16, z: -24 },
      { x: -16, z: 24 },
      { x: 16, z: 24 }
    ];
    spotPoints.forEach((pt, idx) => {
      const spot = new THREE.SpotLight(spotColors[idx % spotColors.length], 0.42);
      spot.position.set(pt.x, 22, pt.z);
      spot.angle = Math.PI / 4.5;
      spot.distance = 55;
      spot.penumbra = 0.75;
      scene.add(spot);
    });

    // 5. 3D Stadium Field Plane Mesh
    const grassMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(30, 42),
      new THREE.MeshStandardMaterial({
        map: createFieldTexture() || undefined,
        roughness: 0.9,
        metalness: 0.05
      })
    );
    grassMesh.rotation.x = -Math.PI / 2;
    grassMesh.receiveShadow = false;
    scene.add(grassMesh);

    // 6. Subdivided Nylon Goal Nets Mesh
    const goalLineMaterial = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.3,
      metalness: 0.7
    });

    const buildGoal3D = (z: number, rotationY: number) => {
      const goalGroup = new THREE.Group();

      // Side Posts
      const postRadius = 0.12;
      const verticalPostGeo = new THREE.CylinderGeometry(postRadius, postRadius, 2.7, 12);
      
      const leftPost = new THREE.Mesh(verticalPostGeo, goalLineMaterial);
      leftPost.position.set(-3.25, 1.35, 0);
      leftPost.castShadow = true;
      goalGroup.add(leftPost);

      const rightPost = new THREE.Mesh(verticalPostGeo, goalLineMaterial);
      rightPost.position.set(3.25, 1.35, 0);
      rightPost.castShadow = true;
      goalGroup.add(rightPost);

      // Top Crossbar
      const crossbarGeo = new THREE.CylinderGeometry(postRadius, postRadius, 6.5, 12);
      const crossbar = new THREE.Mesh(crossbarGeo, goalLineMaterial);
      crossbar.rotation.z = Math.PI / 2;
      crossbar.position.set(0, 2.7, 0);
      crossbar.castShadow = true;
      goalGroup.add(crossbar);

      // HIGH-DENSITY Nylon netting wiremesh - Subdivides the box geometry to build a rich visual grid
      const netGeo = new THREE.BoxGeometry(6.5, 2.7, 1.8, 16, 12, 6);
      const netMat = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        wireframe: true,
        transparent: true,
        opacity: 0.52,
        side: THREE.DoubleSide
      });
      const netMesh = new THREE.Mesh(netGeo, netMat);
      netMesh.position.set(0, 1.35, -0.9);
      goalGroup.add(netMesh);

      // Dark supporting metal poles for the nets
      const metalPoleMat = new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.9, roughness: 0.2 });
      const supportPoleLeft = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 3, 6), metalPoleMat);
      supportPoleLeft.position.set(-3.25, 1.5, -1.8);
      supportPoleLeft.rotation.x = Math.PI / 6;
      goalGroup.add(supportPoleLeft);

      const supportPoleRight = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 3, 6), metalPoleMat);
      supportPoleRight.position.set(3.25, 1.5, -1.8);
      supportPoleRight.rotation.x = Math.PI / 6;
      goalGroup.add(supportPoleRight);

      goalGroup.position.set(0, 0, z);
      goalGroup.rotation.y = rotationY;
      return goalGroup;
    };

    const homeGoal = buildGoal3D(-19.5, 0);
    const awayGoal = buildGoal3D(19.5, Math.PI);
    scene.add(homeGoal);
    scene.add(awayGoal);

    // Dynamic 3D Advertising Boards Sponsor Panels (Reklam Tabelaları)
    const animatedBoardTextures: THREE.Texture[] = [];

    const createAdTexture = (brand: string) => {
      const canvas = document.createElement('canvas');
      canvas.width = 1024;
      canvas.height = 256;
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;

      const isNoAd = brand === 'NO_AD' || brand === 'DEFAULT_BOARD' || !['KEWL', 'DIVISWAP', 'KAYEN', 'FANX', 'CHILIZ', 'PEPPER', 'CHZINU', 'TBT'].includes(brand);

      let gradient = ctx.createLinearGradient(0, 0, canvas.width, 0);
      let textColor = '#ffffff';
      let accentColor = '#ff003e';
      let tag = 'OFFICIAL SPONSOR';

      if (isNoAd) {
        brand = 'CHILIZ'; // Write RED CHILIZ for unassigned/non-advertising spots!
        gradient.addColorStop(0, '#110203'); // Extra dark sleek background
        gradient.addColorStop(0.5, '#220406'); 
        gradient.addColorStop(1, '#110203');
        textColor = '#ff003c'; // Vivid fluorescent NEON Red
        accentColor = '#ff1a40'; // Flashing Red neon borders
        tag = 'CHILIZ CHAIN • OFFICIAL COMMUNITY';
      } else {
        switch (brand) {
          case 'KEWL':
            gradient.addColorStop(0, '#581c87');
            gradient.addColorStop(0.5, '#db2777');
            gradient.addColorStop(1, '#ff007a');
            textColor = '#ffffff';
            accentColor = '#facc15';
            tag = 'KEWL COIN • GLOBAL ARENA';
            break;
          case 'DIVISWAP':
            gradient.addColorStop(0, '#090d16');
            gradient.addColorStop(0.5, '#1e1b4b');
            gradient.addColorStop(1, '#090d16');
            textColor = '#38bdf8';
            accentColor = '#06b6d4';
            tag = 'DIVISWAP DEX • LIVE LIQUIDITY';
            break;
          case 'KAYEN':
            gradient.addColorStop(0, '#111827');
            gradient.addColorStop(1, '#1f2937');
            textColor = '#fbbf24';
            accentColor = '#eab308';
            tag = 'KAYEN CAPITAL • POWERING DEFI';
            break;
          case 'FANX':
            gradient.addColorStop(0, '#7f1d1d');
            gradient.addColorStop(1, '#111827');
            textColor = '#f3f4f6';
            accentColor = '#ef4444';
            tag = 'FANX SPORTS • INTERACTIVE FANZONE';
            break;
          case 'CHILIZ':
            gradient.addColorStop(0, '#7f1c1d');
            gradient.addColorStop(0.5, '#ef4444');
            gradient.addColorStop(1, '#7f1c1d');
            textColor = '#ffffff';
            accentColor = '#facc15';
            tag = 'CHILIZ • CHZ FAN TOKENS';
            break;
          case 'PEPPER':
            gradient.addColorStop(0, '#022c22');
            gradient.addColorStop(0.5, '#065f46');
            gradient.addColorStop(1, '#022c22');
            textColor = '#34d399';
            accentColor = '#fb923c';
            tag = 'PEPPER DEX • SWAP & REWARD';
            break;
          case 'CHZINU':
            gradient.addColorStop(0, '#78350f');
            gradient.addColorStop(1, '#451a03');
            textColor = '#fef08a';
            accentColor = '#ca8a04';
            tag = 'CHZINU • REWARDS PORTAL';
            break;
          case 'TBT':
            gradient.addColorStop(0, '#1e3a8a');
            gradient.addColorStop(0.5, '#0369a1');
            gradient.addColorStop(1, '#1e3a8a');
            textColor = '#38bdf8';
            accentColor = '#a5f3fc';
            tag = 'TBT FOUNDATION • PORTAL';
            break;
          default:
            gradient.addColorStop(0, '#99020e');
            gradient.addColorStop(1, '#dc2626');
            textColor = '#ffffff';
            accentColor = '#facc15';
            tag = 'CHILIZ CHAIN';
            brand = 'CHILIZ';
        }
      }

      // Fill background gradient (high-contrast background panel)
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Neon outer trim borders
      ctx.strokeStyle = accentColor;
      ctx.lineWidth = 14;
      ctx.strokeRect(0, 0, canvas.width, canvas.height);

      // Double Inner neon tube
      ctx.strokeStyle = 'rgba(255,255,255,0.25)';
      ctx.lineWidth = 3;
      ctx.strokeRect(10, 10, canvas.width - 20, canvas.height - 20);

      // Subtle scanline grid overlays to simulate dynamic stadium LED screens
      ctx.fillStyle = 'rgba(0,0,0,0.20)';
      for (let y = 0; y < canvas.height; y += 4) {
        ctx.fillRect(0, y, canvas.width, 1.8);
      }

      // Vertical LED guide tubes
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
      ctx.lineWidth = 4;
      for (let i = 0; i < canvas.width; i += 64) {
        ctx.beginPath();
        ctx.moveTo(i, 0);
        ctx.lineTo(i, canvas.height);
        ctx.stroke();
      }

      // Gorgeous glowing lightning bolts on left & right margins representing live screen motion!
      ctx.fillStyle = accentColor;
      ctx.font = 'bold 36px "JetBrains Mono", Courier, monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.shadowColor = accentColor;
      ctx.shadowBlur = 12;
      ctx.fillText('⚡ ⚡ ⚡', 150, canvas.height / 2 + 15);
      ctx.fillText('⚡ ⚡ ⚡', canvas.width - 150, canvas.height / 2 + 15);
      ctx.shadowBlur = 0;

      // Header Tag label
      ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
      ctx.font = '900 24px "JetBrains Mono", Courier, monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(tag, canvas.width / 2, 28);

      // MAIN BRAND TEXT (Massive, high visibility and crystal clear)
      ctx.fillStyle = textColor;
      ctx.font = '900 108px "Space Grotesk", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      
      // Intensive shadow glow drop!
      ctx.shadowColor = accentColor;
      ctx.shadowBlur = 28;
      ctx.fillText(brand, canvas.width / 2, canvas.height / 2 + 30);
      ctx.shadowBlur = 0;

      // Dark solid outline for maximum readability
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 5;
      ctx.strokeText(brand, canvas.width / 2, canvas.height / 2 + 30);

      const tex = new THREE.CanvasTexture(canvas);
      return tex;
    };

    const brands = ['KEWL', 'DIVISWAP', 'KAYEN', 'FANX', 'CHILIZ', 'PEPPER', 'CHZINU', 'TBT', 'NO_AD'];
    const boardMaterialCache: { [key: string]: THREE.MeshStandardMaterial } = {};
    brands.forEach(b => {
      const tex = createAdTexture(b);
      if (tex) {
        tex.wrapS = THREE.RepeatWrapping;
        animatedBoardTextures.push(tex);
      }
      boardMaterialCache[b] = new THREE.MeshStandardMaterial({
        map: tex || undefined,
        emissiveMap: tex || undefined,
        emissive: new THREE.Color(0xffffff), // Highly self-illuminated emissive material mapping!
        emissiveIntensity: 1.85, // Super-boost brightness to look extremely hot/bright as requested
        roughness: 0.05,
        metalness: 0.1,
      });
    });

    const createSingleBoard3D = (x: number, z: number, rotationY: number, brandName: string) => {
      const boardGroup = new THREE.Group();
      boardGroup.position.set(x, 0.45, z);
      boardGroup.rotation.y = rotationY;

      const mat = boardMaterialCache[brandName] || boardMaterialCache['NO_AD'];
      const bannerGeo = new THREE.BoxGeometry(4.5, 0.9, 0.1);
      
      const darkBackMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.7, metalness: 0.8 });
      const boxMaterials = [
        darkBackMat, // +x
        darkBackMat, // -x
        darkBackMat, // +y
        darkBackMat, // -y
        mat,         // +z
        darkBackMat, // -z
      ];

      const boardMesh = new THREE.Mesh(bannerGeo, boxMaterials);
      boardMesh.castShadow = true;
      boardMesh.receiveShadow = true;
      boardGroup.add(boardMesh);

      const legGeo = new THREE.CylinderGeometry(0.06, 0.06, 1.0, 6);
      const legMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.6, metalness: 0.9 });
      
      const leftLeg = new THREE.Mesh(legGeo, legMat);
      leftLeg.position.set(-1.8, -0.45, -0.2);
      leftLeg.rotation.x = Math.PI / 10;
      boardGroup.add(leftLeg);

      const rightLeg = new THREE.Mesh(legGeo, legMat);
      rightLeg.position.set(1.8, -0.45, -0.2);
      rightLeg.rotation.x = Math.PI / 10;
      boardGroup.add(rightLeg);

      const beamGeo = new THREE.BoxGeometry(4.2, 0.1, 0.1);
      const beam = new THREE.Mesh(beamGeo, legMat);
      beam.position.set(0, -0.45, -0.1);
      boardGroup.add(beam);

      scene.add(boardGroup);
    };

    // 1. Left Line (pointing rightward towards play field, rotationY = Math.PI / 2)
    createSingleBoard3D(-15.4, -14, Math.PI / 2, 'KEWL');
    createSingleBoard3D(-15.4, -7, Math.PI / 2, 'NO_AD');   // Not an ad -> Blazing RED CHILIZ
    createSingleBoard3D(-15.4, 0, Math.PI / 2, 'KAYEN');
    createSingleBoard3D(-15.4, 7, Math.PI / 2, 'NO_AD');    // Not an ad -> Blazing RED CHILIZ
    createSingleBoard3D(-15.4, 14, Math.PI / 2, 'CHILIZ');

    // 2. Right Line (pointing leftward towards play field, rotationY = -Math.PI / 2)
    createSingleBoard3D(15.4, -14, -Math.PI / 2, 'PEPPER');
    createSingleBoard3D(15.4, -7, -Math.PI / 2, 'NO_AD');    // Not an ad -> Blazing RED CHILIZ
    createSingleBoard3D(15.4, 0, -Math.PI / 2, 'TBT');
    createSingleBoard3D(15.4, 7, -Math.PI / 2, 'NO_AD');     // Not an ad -> Blazing RED CHILIZ
    createSingleBoard3D(15.4, 14, -Math.PI / 2, 'DIVISWAP');

    // 3. Top Line (facing forward towards play field, rotationY = 0)
    createSingleBoard3D(-11, -21.4, 0, 'CHILIZ');
    createSingleBoard3D(-6, -21.4, 0, 'CHILIZ');
    createSingleBoard3D(6, -21.4, 0, 'CHILIZ');
    createSingleBoard3D(11, -21.4, 0, 'CHILIZ');

    // 4. Bottom Line (facing backward towards play field, rotationY = Math.PI)
    createSingleBoard3D(-11, 21.4, Math.PI, 'CHILIZ');
    createSingleBoard3D(-6, 21.4, Math.PI, 'CHILIZ');
    createSingleBoard3D(6, 21.4, Math.PI, 'CHILIZ');
    createSingleBoard3D(11, 21.4, Math.PI, 'CHILIZ');

    // 7. Initialize 3D Soccer Ball
    const soccerBallGeo = new THREE.SphereGeometry(0.25, 16, 16);
    const ballCanvas = document.createElement('canvas');
    ballCanvas.width = 128;
    ballCanvas.height = 64;
    const bCtx = ballCanvas.getContext('2d');
    if (bCtx) {
      bCtx.fillStyle = '#ffffff';
      bCtx.fillRect(0, 0, 128, 64);
      bCtx.fillStyle = '#1e293b';
      // High contrast pentagon hexagons patches
      bCtx.fillRect(16, 10, 15, 15);
      bCtx.fillRect(48, 40, 18, 15);
      bCtx.fillRect(80, 12, 16, 16);
      bCtx.fillRect(100, 44, 12, 12);
    }
    const ballTex = new THREE.CanvasTexture(ballCanvas);
    ballTex.needsUpdate = true;
    const soccerBallMat = new THREE.MeshStandardMaterial({
      map: ballTex,
      roughness: 0.2,
      metalness: 0.15
    });
    const soccerBall = new THREE.Mesh(soccerBallGeo, soccerBallMat);
    soccerBall.position.set(0, 0.25, 0);
    soccerBall.castShadow = true;
    scene.add(soccerBall);
    ballMeshRef.current = soccerBall;

    // 8. Players Group Setup
    const playersGroup = new THREE.Group();
    scene.add(playersGroup);
    playersGroupRef.current = playersGroup;

    // 9. Interactive Drag Camera controls
    let isDragging = false;
    let oldMouseX = 0;

    const onMouseDown = (e: MouseEvent) => {
      isDragging = true;
      oldMouseX = e.clientX;
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      const dX = e.clientX - oldMouseX;
      oldMouseX = e.clientX;
      targetOrbitAngleRef.current -= dX * 0.007;
      setIsRotating(false);
    };

    const onMouseUp = () => { isDragging = false; };

    // Mobile touch
    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length > 0) {
        isDragging = true;
        oldMouseX = e.touches[0].clientX;
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!isDragging || e.touches.length === 0) return;
      const dX = e.touches[0].clientX - oldMouseX;
      oldMouseX = e.touches[0].clientX;
      targetOrbitAngleRef.current -= dX * 0.01;
      setIsRotating(false);
    };

    const element = renderer.domElement;
    element.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    element.addEventListener('touchstart', onTouchStart);
    element.addEventListener('touchmove', onTouchMove);
    element.addEventListener('touchend', onMouseUp);

    // 10. Frame render and physics integrations
    let frameId: number | null = null;
    let disposed = false;
    let lastTime = performance.now();

    const renderLoop = () => {
      if (disposed) return;
      frameId = requestAnimationFrame(renderLoop);
      const now = performance.now();
      const delta = Math.min(0.03, (now - lastTime) / 1000); // Clamp physics delta
      lastTime = now;

      // Smooth camera interpolation
      if (isRotating && cameraPreset !== 'TACTICAL') {
        targetOrbitAngleRef.current += delta * 0.045; // Slow ambient orbit rotation
      }

      // Marquee marquee horizontally sliding dynamic text scrolling effect!
      animatedBoardTextures.forEach(tex => {
        tex.offset.x -= delta * 0.18; // Slow elegant billboard text motion
      });

      // LED screen glowing surge wave pulsing intensity animation!
      const elapsed = Date.now() * 0.0035;
      const waveGlow = 1.05 + 0.3 * Math.sin(elapsed);
      Object.keys(boardMaterialCache).forEach(k => {
        const mat = boardMaterialCache[k];
        if (mat) {
          mat.emissiveIntensity = waveGlow;
        }
      });

      const b = ballPhysicsRef.current;
      const targetVec = ballTargetPosRef.current;

      orbitAngleRef.current += (targetOrbitAngleRef.current - orbitAngleRef.current) * 0.1;
      orbitHeightRef.current += (targetOrbitHeightRef.current - orbitHeightRef.current) * 0.1;

      const fxStateVal = fxStateRef.current;
      let targetLookX = 0;
      let targetLookY = 0.45;
      let targetLookZ = 0;
      
      let finalOrbitHeight = orbitHeightRef.current;

      const goalShotAge = fxStateVal?.type === 'GOAL' ? performance.now() - goalShotStartedAtRef.current : 0;

      if (fxStateVal && fxStateVal.type === 'GOAL') {
        // Follow the shot first, then switch to the net close-up.
        targetLookX = b.x;
        targetLookY = b.y;
        targetLookZ = b.z;
        finalOrbitHeight = goalShotAge < 850 ? orbitHeightRef.current * 0.55 : 5.8;
      } else if (fxStateVal && (fxStateVal.type === 'SAVE' || fxStateVal.type === 'MISS')) {
        targetLookX = b.x;
        targetLookY = b.y + 0.12;
        targetLookZ = b.z;
        finalOrbitHeight = orbitHeightRef.current * 0.48; // Cinematic tracking zoomcloser
      } else {
        // Sleek progressive tracking panning that gently centres the ball Action
        targetLookX = b.x * 0.75;
        targetLookY = b.y * 0.15 + 0.45;
        targetLookZ = b.z * 0.75;
      }

      // Smooth interpolation limits to avoid raw jarring jumps
      cameraLookAtRef.current.x += (targetLookX - cameraLookAtRef.current.x) * (fxStateVal ? 0.18 : 0.08);
      cameraLookAtRef.current.y += (targetLookY - cameraLookAtRef.current.y) * (fxStateVal ? 0.18 : 0.08);
      cameraLookAtRef.current.z += (targetLookZ - cameraLookAtRef.current.z) * (fxStateVal ? 0.18 : 0.08);

       // Panning camera position offset to mimic a crane tracking run
      let cX = Math.cos(orbitAngleRef.current) * finalOrbitHeight + cameraLookAtRef.current.x * 0.45;
      let cZ = Math.sin(orbitAngleRef.current) * finalOrbitHeight + cameraLookAtRef.current.z * 0.45;
      let cY = Math.sin(targetYAngleRef.current) * finalOrbitHeight * 0.85;

      if (fxStateVal && fxStateVal.type === 'GOAL' && goalShotAge >= 1050) {
        const isAwayNet = fxStateVal.team === 'home'; // scored on awayGoal (Z = 19.5, ball = 20.25)
        // Position camera dynamically at a flawless low-angle post view (e.g. 1.15 meters off the turf, 16.5m along Z)
        cX = isAwayNet ? -4.5 : 4.5;
        cY = 1.15;
        cZ = isAwayNet ? 15.5 : -15.5; // close up, looking into net mouth
      }

      camera.position.set(cX, cY, cZ);
      camera.lookAt(cameraLookAtRef.current);

      // Check if possessed to keep locked to player feet
      const carryId = ballPossessorIdRef.current;
      let isHandledByPossessor = false;
      if (carryId && fxStateVal?.type !== 'GOAL') {
        const pGroup = playersGroupRef.current?.getObjectByName(carryId);
        if (pGroup) {
          const isHome = pGroup.userData.team === 'home';
          const targetX = pGroup.userData.targetX !== undefined ? pGroup.userData.targetX : pGroup.position.x;
          const targetZ = pGroup.userData.targetZ !== undefined ? pGroup.userData.targetZ : pGroup.position.z;
          let dirX = targetX - pGroup.position.x;
          let dirZ = targetZ - pGroup.position.z;
          const dirLen = Math.hypot(dirX, dirZ);

          if (dirLen > 0.015) {
            dirX /= dirLen;
            dirZ /= dirLen;
            pGroup.userData.lastDirX = dirX;
            pGroup.userData.lastDirZ = dirZ;
          } else {
            dirX = pGroup.userData.lastDirX ?? 0;
            dirZ = pGroup.userData.lastDirZ ?? (isHome ? 1 : -1);
          }

          const dribbleT = (pGroup.userData.animTime || 0) * 2.6;
          const footSide = Math.sin(dribbleT) >= 0 ? 1 : -1;
          const touchPulse = Math.pow(Math.max(0, Math.sin(dribbleT * 1.65)), 1.5);
          const lateralX = dirZ;
          const lateralZ = -dirX;
          const forwardTouch = 0.38 + touchPulse * 0.12 + Math.min(0.1, dirLen * 0.28);
          const sideTouch = footSide * (0.07 + touchPulse * 0.025);
          const desiredX = pGroup.position.x + dirX * forwardTouch + lateralX * sideTouch;
          const desiredZ = pGroup.position.z + dirZ * forwardTouch + lateralZ * sideTouch;
          const ballGap = Math.hypot(desiredX - b.x, desiredZ - b.z);
          const carryBlend = ballGap > 2.2 ? 0.72 : 0.18;
          const nextX = b.x + (desiredX - b.x) * carryBlend;
          const nextZ = b.z + (desiredZ - b.z) * carryBlend;

          b.vx = (nextX - b.x) / Math.max(delta, 0.016);
          b.vy = 0;
          b.vz = (nextZ - b.z) / Math.max(delta, 0.016);
          b.x = nextX;
          b.y += (0.235 + touchPulse * 0.012 - b.y) * 0.35;
          b.z = nextZ;
          isHandledByPossessor = true;
        }
      }

      if (!isHandledByPossessor) {
        const restartPlayer = playersGroupRef.current?.children.find((child: any) =>
          child instanceof THREE.Group && child.userData.restartAction
        ) as THREE.Group | undefined;
        const restartAction = restartPlayer?.userData.restartAction as RestartAction | undefined;
        const isRestartSetup = fxStateVal?.type === 'NONE' && restartPlayer && restartAction;

        if (isRestartSetup && restartPlayer) {
          const isThrowIn = restartAction === 'THROW_IN';
          const setPieceForward = restartPlayer.userData.team === 'home' ? 1 : -1;
          const setupX = isThrowIn ? restartPlayer.position.x : targetVec.x;
          const setupZ = isThrowIn ? restartPlayer.position.z + setPieceForward * 0.12 : targetVec.z;
          const setupY = isThrowIn ? 1.66 : 0.245;
          b.x += (setupX - b.x) * 0.3;
          b.z += (setupZ - b.z) * 0.3;
          b.y += (setupY - b.y) * 0.32;
          b.vx = 0;
          b.vy = 0;
          b.vz = 0;
        } else {
          // Gravity acceleration dragging down
          const ballGravity = -18.5;
          b.vy += ballGravity * delta;

          // Damped harmonic tracking spring force pulling ball horizontally to its logic target
          const ballSpring = 14.8;
          const ballDamp = 5.5;
          const forceX = (targetVec.x - b.x) * ballSpring - b.vx * ballDamp;
          const forceZ = (targetVec.z - b.z) * ballSpring - b.vz * ballDamp;

          b.vx += forceX * delta;
          b.vz += forceZ * delta;

          b.x += b.vx * delta;
          b.y += b.vy * delta;
          b.z += b.vz * delta;

          // Grass turf boundary limits colliders (ball radius 0.25)
          if (b.y <= 0.25) {
            b.y = 0.25;
            b.vy = -b.vy * 0.62; // elastic bounce restitution

            // Roll friction damping
            b.vx *= 0.94;
            b.vz *= 0.94;
            if (Math.abs(b.vy) < 0.22) b.vy = 0;
          }
        }
      }

      // Nylon Net Boundaries & Collisions (Goal width limits [-3.25, 3.25], height 2.7, depth 1.8)
      // Home goal center is at Z = -19.5 (net back wall at -20.4). Away goal is at Z = 19.5 (net back wall at 20.4)
      if (Math.abs(b.x) < 3.25 && b.y < 2.7) {
        // Away Goal Net Check (scoring on awayGoal)
        if (b.z >= 19.4) {
          if (b.z >= 20.25) {
            b.z = 20.25;
            b.vz = -Math.abs(b.vz) * 0.22; // net absorbs, then pushes ball slightly back
            b.vx *= 0.46;
            b.vy = Math.min(b.vy * 0.38, -0.18); // lose lift and fall inside net
          }
          if (b.x > 3.05) { b.x = 3.05; b.vx = -Math.abs(b.vx) * 0.18; }
          if (b.x < -3.05) { b.x = -3.05; b.vx = Math.abs(b.vx) * 0.18; }
        }
        // Home Goal Net Check (scoring on homeGoal)
        if (b.z <= -19.4) {
          if (b.z <= -20.25) {
            b.z = -20.25;
            b.vz = Math.abs(b.vz) * 0.22;
            b.vx *= 0.46;
            b.vy = Math.min(b.vy * 0.38, -0.18);
          }
          if (b.x > 3.05) { b.x = 3.05; b.vx = -Math.abs(b.vx) * 0.18; }
          if (b.x < -3.05) { b.x = -3.05; b.vx = Math.abs(b.vx) * 0.18; }
        }
      }

      // Roll mesh rotation with realistic speed
      const ballMesh = ballMeshRef.current;
      if (ballMesh) {
        ballMesh.position.set(b.x, b.y, b.z);
        const spinVel = Math.hypot(b.vx, b.vz);
        ballMesh.rotation.x += b.vx * delta * 2;
        ballMesh.rotation.z -= b.vz * delta * 2;
      }

      // Orient all players towards the ball targets and jog their running limbs
      if (playersGroupRef.current) {
        playersGroupRef.current.children.forEach((pGroup: any) => {
          if (pGroup instanceof THREE.Group) {
            // Retrieve target coordinates set by ticks and smoothly interpolate coordinate drift!
            const targetX = pGroup.userData.targetX !== undefined ? pGroup.userData.targetX : pGroup.position.x;
            const targetZ = pGroup.userData.targetZ !== undefined ? pGroup.userData.targetZ : pGroup.position.z;

            const distToTarget = Math.hypot(targetX - pGroup.position.x, targetZ - pGroup.position.z);

            const maxVisualStep = (pGroup.userData.restartAction ? 5.2 : 7.4) * delta;
            if (distToTarget > 0.001) {
              const visualStep = Math.min(distToTarget, maxVisualStep);
              pGroup.position.x += ((targetX - pGroup.position.x) / distToTarget) * visualStep;
              pGroup.position.z += ((targetZ - pGroup.position.z) / distToTarget) * visualStep;
            }

            // Smooth yaw lookAt towards the ball Action
            const lookTarget = new THREE.Vector3(b.x, pGroup.position.y, b.z);
            const initialRotation = pGroup.rotation.clone();
            pGroup.lookAt(lookTarget);
            const targetRotY = pGroup.rotation.y;
            pGroup.rotation.copy(initialRotation);

            // Slerp rotation yaw splay
            pGroup.rotation.y += (targetRotY - pGroup.rotation.y) * 0.12;

            // Swinging active running legs and arms proportional to movement velocity!
            const leftLeg = pGroup.getObjectByName('leftLeg');
            const rightLeg = pGroup.getObjectByName('rightLeg');
            const leftArm = pGroup.getObjectByName('leftArm');
            const rightArm = pGroup.getObjectByName('rightArm');

            const isMoving = distToTarget > 0.035;
            const stepSpeed = isMoving ? Math.min(1.2, maxVisualStep / Math.max(delta, 0.016)) : 0;
            const strideAmp = isMoving ? Math.min(0.62, 0.18 + stepSpeed * 0.055) : 0.04;
            const animSpeed = isMoving ? (0.018 + Math.min(0.026, stepSpeed * 0.0026)) : 0.003;

            pGroup.userData.animTime = (pGroup.userData.animTime || 0) + delta * 60 * animSpeed * 10;
            const t = pGroup.userData.animTime;

            // Reset base kinematic transforms
            pGroup.position.y = 0;
            pGroup.rotation.x = 0;
            const head = pGroup.getObjectByName('head');
            if (head) head.rotation.x = 0;

            if (fxStateVal && fxStateVal.type === 'GOAL') {
              const pTeam = pGroup.userData.team;
              if (pTeam === fxStateVal.team) {
                // Scoring Team Celebration: Jump high with elevated waving victory arms
                const jumpHeight = 0.65;
                const jumpFreq = 5.8;
                pGroup.position.y = Math.max(0, Math.sin(t * jumpFreq)) * jumpHeight;

                if (leftArm) {
                  leftArm.rotation.x = -Math.PI * 0.45;
                  leftArm.rotation.z = -Math.PI * 0.78 + Math.sin(t * 8) * 0.18;
                }
                if (rightArm) {
                  rightArm.rotation.x = -Math.PI * 0.45;
                  rightArm.rotation.z = Math.PI * 0.78 - Math.cos(t * 8) * 0.18;
                }
                if (leftLeg) leftLeg.rotation.x = Math.sin(t * jumpFreq) * 0.28;
                if (rightLeg) rightLeg.rotation.x = -Math.sin(t * jumpFreq) * 0.28;
              } else {
                // Defending Team Disappointment: Slouch down, drop arms limply, hang heads
                if (head) head.rotation.x = 0.52;
                pGroup.rotation.x = 0.18;

                if (leftArm) {
                  leftArm.rotation.x = 0.25;
                  leftArm.rotation.z = -0.05;
                }
                if (rightArm) {
                  rightArm.rotation.x = 0.25;
                  rightArm.rotation.z = 0.05;
                }

                const pNum = pGroup.userData.pNumber || 0;
                // Every third player drops completely to their knees in despair representing physical animation
                if (pNum % 3 === 0) {
                  pGroup.position.y = -0.32;
                } else {
                  if (leftLeg) leftLeg.rotation.x = 0.08;
                  if (rightLeg) rightLeg.rotation.x = -0.08;
                }
              }
            } else {
              if (pGroup.userData.restartAction === 'THROW_IN') {
                if (leftLeg) {
                  leftLeg.rotation.x = 0.04;
                  leftLeg.position.y = 0.42;
                }
                if (rightLeg) {
                  rightLeg.rotation.x = -0.04;
                  rightLeg.position.y = 0.42;
                }
                if (leftArm) {
                  leftArm.rotation.x = -Math.PI * 0.88;
                  leftArm.rotation.z = -0.42;
                }
                if (rightArm) {
                  rightArm.rotation.x = -Math.PI * 0.88;
                  rightArm.rotation.z = 0.42;
                }
                if (head) head.rotation.x = -0.18;
                return;
              }

              if (pGroup.userData.restartAction) {
                const windup = 0.55 + Math.sin(t * 3.2) * 0.18;
                if (leftLeg) {
                  leftLeg.rotation.x = pGroup.userData.team === 'home' ? -0.2 : 0.2;
                  leftLeg.position.y = 0.42;
                }
                if (rightLeg) {
                  rightLeg.rotation.x = pGroup.userData.team === 'home' ? windup : -windup;
                  rightLeg.position.y = 0.43;
                }
                if (leftArm) {
                  leftArm.rotation.x = -0.18;
                  leftArm.rotation.z = -0.34;
                }
                if (rightArm) {
                  rightArm.rotation.x = 0.18;
                  rightArm.rotation.z = 0.34;
                }
                if (head) head.rotation.x = -0.08;
                return;
              }

              const isCarrier = ballPossessorIdRef.current === pGroup.name;
              const dribbleKick = isCarrier ? Math.max(0, Math.sin(t * 2.6)) * 0.18 : 0;

              if (leftLeg) {
                leftLeg.rotation.x = Math.sin(t) * strideAmp + dribbleKick;
                leftLeg.position.y = 0.42 + Math.max(0, Math.sin(t)) * 0.05 * (isMoving ? 1 : 0.2);
              }
              if (rightLeg) {
                rightLeg.rotation.x = -Math.sin(t) * strideAmp + (isCarrier ? Math.max(0, -Math.sin(t * 2.6)) * 0.18 : 0);
                rightLeg.position.y = 0.42 + Math.max(0, -Math.sin(t)) * 0.05 * (isMoving ? 1 : 0.2);
              }
              if (leftArm) {
                leftArm.rotation.x = -Math.sin(t) * strideAmp * 0.72;
                leftArm.rotation.z = -0.15 + Math.sin(t * 0.5) * 0.05;
              }
              if (rightArm) {
                rightArm.rotation.x = Math.sin(t) * strideAmp * 0.72;
                rightArm.rotation.z = 0.15 - Math.sin(t * 0.5) * 0.05;
              }
            }
          }
        });
      }

      // Orient and smoothly slide referee towards position
      if (refereeMeshRef.current) {
        const rc = mapCoords(referee.x, referee.y);
        const refMesh = refereeMeshRef.current;
        
        const distToTarget = Math.hypot(rc.x - refMesh.position.x, rc.z - refMesh.position.z);
        
        // Slide referee
        refMesh.position.x += (rc.x - refMesh.position.x) * 0.12;
        refMesh.position.z += (rc.z - refMesh.position.z) * 0.12;

        const rLook = new THREE.Vector3(b.x, refMesh.position.y, b.z);
        refMesh.lookAt(rLook);

        // Jog limbs of referee (ALWAYS running - surekli kosmali!)
        const leftLeg = refMesh.getObjectByName('leftLeg');
        const rightLeg = refMesh.getObjectByName('rightLeg');
        const leftArm = refMesh.getObjectByName('leftArm');
        const rightArm = refMesh.getObjectByName('rightArm');
        
        const strideAmp = 0.52; // High energy constant sprint jog
        const speedFactor = 0.016; // Quick stride pace
        
        refMesh.userData.animTime = (refMesh.userData.animTime || 0) + delta * 60 * speedFactor * 10;
        const t = refMesh.userData.animTime;
        
        if (leftLeg) leftLeg.rotation.x = Math.sin(t) * strideAmp;
        if (rightLeg) rightLeg.rotation.x = -Math.sin(t) * strideAmp;
        if (leftArm) {
          leftArm.rotation.x = -Math.sin(t) * strideAmp * 0.72;
          leftArm.rotation.z = -0.15 + Math.sin(t * 0.5) * 0.05;
        }
        if (rightArm) {
          rightArm.rotation.x = Math.sin(t) * strideAmp * 0.72;
          rightArm.rotation.z = 0.15 - Math.sin(t * 0.5) * 0.05;
        }
      }

      renderer.render(scene, camera);
    };

    renderLoop();

    const onWindowResize = () => {
      if (!containerRef.current || !rendererRef.current || !cameraRef.current) return;
      const w = containerRef.current.clientWidth;
      const h = containerRef.current.clientHeight;
      cameraRef.current.aspect = w / h;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(w, h);
    };
    window.addEventListener('resize', onWindowResize);

    return () => {
      disposed = true;
      if (frameId !== null) {
        cancelAnimationFrame(frameId);
      }
      window.removeEventListener('resize', onWindowResize);
      element.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      element.removeEventListener('touchstart', onTouchStart);
      element.removeEventListener('touchmove', onTouchMove);
      element.removeEventListener('touchend', onMouseUp);

      if (rendererRef.current) {
        rendererRef.current.dispose();
      }
      sceneRef.current = null;
      cameraRef.current = null;
      rendererRef.current = null;
      playersGroupRef.current = null;
      ballMeshRef.current = null;
      refereeMeshRef.current = null;
    };
  }, [isSupported]);


  // Sync dynamic players updates loop
  useEffect(() => {
    const scene = sceneRef.current;
    const playersGroup = playersGroupRef.current;
    if (!scene || !playersGroup) return;

    // Prune stale substitute players
    const currentActiveIds = new Set(pitchPlayers.map(p => p.id));

    pitchPlayers.forEach(player => {
      const isHome = player.team === 'home';
      const isGK = player.position === 'GK';
      const c = mapCoords(player.x, player.y);

      let pGroup = playersGroup.getObjectByName(player.id) as THREE.Group | undefined;

      // Build pristine 3D soccer characters if first time loading
      if (!pGroup) {
        pGroup = new THREE.Group();
        pGroup.name = player.id;
        pGroup.position.set(c.x, 0, c.z);

        // A. Real player body without arcade base rings.
        const skinColors = [0xf2c9a0, 0xd6a06f, 0x8d5524, 0xffdbac];
        const randomSkin = skinColors[player.name.charCodeAt(0) % skinColors.length];
        const headGeo = new THREE.SphereGeometry(0.18, 16, 16);
        const headMat = new THREE.MeshStandardMaterial({
          color: randomSkin,
          roughness: 0.62,
          metalness: 0.05
        });
        const headMesh = new THREE.Mesh(headGeo, headMat);
        headMesh.position.set(0, 1.32, 0);
        headMesh.name = 'head';
        headMesh.castShadow = true;
        pGroup.add(headMesh);

        const hairColors = [0x111827, 0x3f2a1d, 0x78350f, 0xd6d3d1];
        const randomHair = hairColors[player.name.charCodeAt(1) % hairColors.length];
        const hairMesh = new THREE.Mesh(
          new THREE.SphereGeometry(0.183, 16, 8, 0, Math.PI * 2, 0, Math.PI * 0.48),
          new THREE.MeshStandardMaterial({ color: randomHair, roughness: 0.82 })
        );
        hairMesh.position.set(0, 0.035, 0);
        headMesh.add(hairMesh);

        // Subtle facial details for close camera angles.
        const eyeGeo = new THREE.SphereGeometry(0.025, 6, 6);
        const eyeMat = new THREE.MeshBasicMaterial({ color: 0x111827 });
        const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
        leftEye.position.set(-0.07, 0.03, 0.17); // looking forward (+z is forward)
        const rightEye = new THREE.Mesh(eyeGeo, eyeMat);
        rightEye.position.set(0.07, 0.03, 0.17);
        headMesh.add(leftEye);
        headMesh.add(rightEye);

        // Small mouth mark for front-facing closeups.
        const mouthGeo = new THREE.BoxGeometry(0.06, 0.012, 0.02);
        const mouthMat = new THREE.MeshBasicMaterial({ color: 0xba1d1d });
        const faceMouth = new THREE.Mesh(mouthGeo, mouthMat);
        faceMouth.position.set(0, -0.08, 0.17);
        headMesh.add(faceMouth);

        // B. Tapered jersey body, closer to a football-game player silhouette than a block.
        const jerseyColorHex = isGK ? 0xf59e0b : (isHome ? 0xda020e : 0x0284c7);
        const jerseyMat = new THREE.MeshStandardMaterial({ color: jerseyColorHex, roughness: 0.46, metalness: 0.03 });
        const torsoMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.18, 0.68, 14), jerseyMat);
        torsoMesh.scale.z = 0.72;
        torsoMesh.position.set(0, 0.86, 0);
        torsoMesh.name = 'torso';
        torsoMesh.castShadow = true;
        torsoMesh.receiveShadow = true;
        pGroup.add(torsoMesh);

        const numberCanvas = document.createElement('canvas');
        numberCanvas.width = 96;
        numberCanvas.height = 96;
        const numberCtx = numberCanvas.getContext('2d');
        if (numberCtx) {
          numberCtx.fillStyle = '#ffffff';
          numberCtx.textAlign = 'center';
          numberCtx.textBaseline = 'middle';
          numberCtx.font = '900 56px Arial';
          numberCtx.fillText(String(player.number), 48, 52);
        }
        const numberTex = new THREE.CanvasTexture(numberCanvas);
        const numberMat = new THREE.MeshBasicMaterial({ map: numberTex, transparent: true, depthWrite: false });
        const chestNumber = new THREE.Mesh(new THREE.PlaneGeometry(0.26, 0.26), numberMat);
        chestNumber.name = 'chestNumber';
        chestNumber.position.set(0, 0.88, 0.2);
        torsoMesh.add(chestNumber);

        const shoulderMat = new THREE.MeshStandardMaterial({ color: isGK ? 0xfbbf24 : (isHome ? 0xffffff : 0xe0f2fe), roughness: 0.42 });
        const shoulders = new THREE.Mesh(new THREE.CapsuleGeometry(0.055, 0.5, 4, 8), shoulderMat);
        shoulders.name = 'shoulders';
        shoulders.rotation.z = Math.PI / 2;
        shoulders.position.set(0, 1.18, 0);
        shoulders.castShadow = true;
        pGroup.add(shoulders);

        // Shorts mesh: rectangular football shorts, not a circular stand.
        const shortsColor = isHome ? 0xffffff : 0x1e293b;
        const shortsBar = new THREE.Mesh(
          new THREE.CylinderGeometry(0.19, 0.22, 0.22, 12),
          new THREE.MeshStandardMaterial({ color: shortsColor, roughness: 0.6 })
        );
        shortsBar.scale.z = 0.72;
        shortsBar.position.set(0, 0.46, 0);
        shortsBar.castShadow = true;
        pGroup.add(shortsBar);

        // C. Limb cylinders with real boots planted on the pitch.
        const thighGeo = new THREE.CylinderGeometry(0.062, 0.054, 0.42, 10);
        const skinMat = new THREE.MeshStandardMaterial({ color: randomSkin, roughness: 0.62 });
        const bootMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.54 });

        const leftLeg = new THREE.Group();
        leftLeg.name = 'leftLeg';
        leftLeg.position.set(-0.115, 0.43, 0);
        
        const leftThigh = new THREE.Mesh(thighGeo, skinMat);
        leftThigh.position.y = -0.16;
        leftThigh.castShadow = true;
        leftLeg.add(leftThigh);

        // Socks boots
        const sockColor = isHome ? 0xda020e : 0xffffff;
        const leftSock = new THREE.Mesh(
          new THREE.CylinderGeometry(0.064, 0.058, 0.2, 10),
          new THREE.MeshStandardMaterial({ color: sockColor, roughness: 0.7 })
        );
        leftSock.position.set(0, -0.24, 0);
        leftSock.castShadow = true;
        leftLeg.add(leftSock);

        const leftBoot = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.055, 0.32), bootMat);
        leftBoot.name = 'leftBoot';
        leftBoot.position.set(0, -0.36, 0.08);
        leftBoot.castShadow = true;
        leftLeg.add(leftBoot);

        pGroup.add(leftLeg);

        // Leg Right group
        const rightLeg = new THREE.Group();
        rightLeg.name = 'rightLeg';
        rightLeg.position.set(0.115, 0.43, 0);
        
        const rightThigh = new THREE.Mesh(thighGeo, skinMat);
        rightThigh.position.y = -0.16;
        rightThigh.castShadow = true;
        rightLeg.add(rightThigh);

        const rightSock = new THREE.Mesh(
          new THREE.CylinderGeometry(0.064, 0.058, 0.2, 10),
          new THREE.MeshStandardMaterial({ color: sockColor, roughness: 0.7 })
        );
        rightSock.position.set(0, -0.24, 0);
        rightSock.castShadow = true;
        rightLeg.add(rightSock);

        const rightBoot = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.055, 0.32), bootMat);
        rightBoot.name = 'rightBoot';
        rightBoot.position.set(0, -0.36, 0.08);
        rightBoot.castShadow = true;
        rightLeg.add(rightBoot);

        pGroup.add(rightLeg);

        // Sleeve arms
        const armGeo = new THREE.CylinderGeometry(0.04, 0.034, 0.42, 10);
        const sleeveMat = new THREE.MeshStandardMaterial({ color: jerseyColorHex, roughness: 0.5 });

        // Left Arm
        const leftArm = new THREE.Group();
        leftArm.name = 'leftArm';
        leftArm.position.set(-0.29, 1.05, 0);

        const sleeveL = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.044, 0.16, 10), sleeveMat);
        sleeveL.position.y = -0.06;
        leftArm.add(sleeveL);

        const handL = new THREE.Mesh(armGeo, skinMat);
        handL.position.y = -0.21;
        leftArm.add(handL);
        pGroup.add(leftArm);

        // Right Arm
        const rightArm = new THREE.Group();
        rightArm.name = 'rightArm';
        rightArm.position.set(0.29, 1.05, 0);

        const sleeveR = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.044, 0.16, 10), sleeveMat);
        sleeveR.position.y = -0.06;
        rightArm.add(sleeveR);

        const handR = new THREE.Mesh(armGeo, skinMat);
        handR.position.y = -0.21;
        rightArm.add(handR);
        pGroup.add(rightArm);

        pGroup.position.set(c.x, 0, c.z);
        pGroup.userData.targetX = c.x;
        pGroup.userData.targetZ = c.z;
        pGroup.userData.team = player.team;
        pGroup.userData.position = player.position;
        pGroup.userData.pNumber = player.number;
        pGroup.userData.name = player.name;
        pGroup.userData.restartAction = player.restartAction;
        playersGroup.add(pGroup);
      } else {
        // Set targets to slide smoothly inside the requestAnimationFrame loop
        pGroup.userData.targetX = c.x;
        pGroup.userData.targetZ = c.z;
        pGroup.userData.team = player.team;
        pGroup.userData.position = player.position;
        pGroup.userData.pNumber = player.number;
        pGroup.userData.name = player.name;
        pGroup.userData.restartAction = player.restartAction;
      }
    });

    // Remove stale players representing substitutions
    for (let i = playersGroup.children.length - 1; i >= 0; i--) {
      const child = playersGroup.children[i];
      if (!currentActiveIds.has(child.name)) {
        playersGroup.remove(child);
      }
    }

  }, [pitchPlayers]);

  // Handle referee build
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;

    if (!refereeMeshRef.current) {
      const refGroup = new THREE.Group();
      refGroup.name = 'referee';
      refGroup.scale.setScalar(1.12);
      refGroup.renderOrder = 8;

      // 1. Ref head skin
      const refHead = new THREE.Mesh(
        new THREE.SphereGeometry(0.18, 10, 10),
        new THREE.MeshStandardMaterial({ color: 0xfed7aa, roughness: 0.6 })
      );
      refHead.position.set(0, 1.25, 0);
      refGroup.add(refHead);

      // 2. Torso Outfit (Bright neon yellow card-referee jersey)
      const refTorso = new THREE.Mesh(
        new THREE.BoxGeometry(0.48, 0.6, 0.26),
        new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.5 }) // Distinct neon yellow kit
      );
      refTorso.position.set(0, 0.82, 0);
      refGroup.add(refTorso);

      // Ref black Shorts
      const refShorts = new THREE.Mesh(
        new THREE.CylinderGeometry(0.22, 0.24, 0.2, 10),
        new THREE.MeshStandardMaterial({ color: 0x111827 })
      );
      refShorts.position.set(0, 0.46, 0);
      refGroup.add(refShorts);

      // 3. Legs and black cleats
      const thighGeo = new THREE.CylinderGeometry(0.075, 0.065, 0.36, 8);
      const skinMat = new THREE.MeshStandardMaterial({ color: 0xfed7aa, roughness: 0.62 });
      const sockMat = new THREE.MeshStandardMaterial({ color: 0x111827 }); // black matching socks

      const leftLeg = new THREE.Group();
      leftLeg.name = 'leftLeg';
      leftLeg.position.set(-0.12, 0.42, 0);
      
      const thighL = new THREE.Mesh(thighGeo, skinMat);
      thighL.position.y = -0.15;
      leftLeg.add(thighL);

      const sockL = new THREE.Mesh(new THREE.CylinderGeometry(0.078, 0.072, 0.16, 8), sockMat);
      sockL.position.set(0, -0.22, 0);
      leftLeg.add(sockL);

      const bootL = new THREE.Mesh(new THREE.BoxGeometry(0.085, 0.06, 0.16), sockMat);
      bootL.position.set(0, -0.32, 0.03);
      leftLeg.add(bootL);
      refGroup.add(leftLeg);

      const rightLeg = new THREE.Group();
      rightLeg.name = 'rightLeg';
      rightLeg.position.set(0.12, 0.42, 0);

      const thighR = new THREE.Mesh(thighGeo, skinMat);
      thighR.position.y = -0.15;
      rightLeg.add(thighR);

      const sockR = new THREE.Mesh(new THREE.CylinderGeometry(0.078, 0.072, 0.16, 8), sockMat);
      sockR.position.set(0, -0.22, 0);
      rightLeg.add(sockR);

      const bootR = new THREE.Mesh(new THREE.BoxGeometry(0.085, 0.06, 0.16), sockMat);
      bootR.position.set(0, -0.32, 0.03);
      rightLeg.add(bootR);
      refGroup.add(rightLeg);

      // 4. Arms for Referee (neon yellow jersey sleeves)
      const refArmGeo = new THREE.CylinderGeometry(0.045, 0.04, 0.38, 8);
      const refSleeveMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.5 });

      const refLeftArm = new THREE.Group();
      refLeftArm.name = 'leftArm';
      refLeftArm.position.set(-0.35, 1.0, 0);
      const refSleeveL = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.05, 0.14, 8), refSleeveMat);
      refSleeveL.position.y = -0.06;
      refLeftArm.add(refSleeveL);
      const refHandL = new THREE.Mesh(refArmGeo, skinMat);
      refHandL.position.y = -0.21;
      refLeftArm.add(refHandL);
      refGroup.add(refLeftArm);

      const refRightArm = new THREE.Group();
      refRightArm.name = 'rightArm';
      refRightArm.position.set(0.35, 1.0, 0);
      const refSleeveR = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.05, 0.14, 8), refSleeveMat);
      refSleeveR.position.y = -0.06;
      refRightArm.add(refSleeveR);
      const refHandR = new THREE.Mesh(refArmGeo, skinMat);
      refHandR.position.y = -0.21;
      refRightArm.add(refHandR);
      refGroup.add(refRightArm);

      // Ref whistle indicator nameplate overhead
      const rCanvas = document.createElement('canvas');
      rCanvas.width = 180;
      rCanvas.height = 40;
      const rCtx = rCanvas.getContext('2d');
      if (rCtx) {
        rCtx.fillStyle = '#eab308';
        rCtx.beginPath();
        rCtx.roundRect(10, 4, 160, 32, 8);
        rCtx.fill();

        rCtx.fillStyle = '#111827';
        rCtx.textAlign = 'center';
        rCtx.textBaseline = 'middle';
        rCtx.font = 'bold 14px "Inter", sans-serif';
        rCtx.fillText('ERSAN EFENDİ', 90, 20);
      }
      const rTex = new THREE.CanvasTexture(rCanvas);
      const rSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: rTex, depthTest: false }));
      rSprite.scale.set(1.5, 0.36, 1);
      rSprite.position.set(0, 1.62, 0);
      refGroup.add(rSprite);

      refereeMeshRef.current = refGroup;
    }

    if (refereeMeshRef.current.parent !== scene) {
      const rc = mapCoords(referee.x, referee.y);
      refereeMeshRef.current.position.set(rc.x, 0.02, rc.z);
      scene.add(refereeMeshRef.current);
    }
  }, [isSupported, pitchPlayers.length, referee.x, referee.y]);

  if (!isSupported) {
    return (
      <div className="w-full aspect-[4/3] bg-zinc-900 border border-zinc-800 rounded-3xl flex flex-col items-center justify-center p-6 text-center text-zinc-400">
        <RefreshCw className="w-8 h-8 text-[#FF007A]/80 animate-spin mb-4" />
        <h3 className="font-bold text-zinc-200">3D Pitch loader issue or WebGL disabled</h3>
        <p className="text-xs max-w-xs mt-2">
          Tarayıcınız veya sisteminiz WebGL grafiklerini yüklerken bir sorun yaşadı. Lütfen üstteki mod değiştiriciden 2D moduna geçiş yapın!
        </p>
      </div>
    );
  }


  return (
    <div className="flex flex-col gap-1.5 sm:gap-3 h-full animate-fade-in" id="threejs-3d-stadium-view">
      {/* 3D Stadium Header Stats Indicator */}
      <div className="flex justify-between items-center bg-zinc-900 border border-zinc-800 rounded-xl sm:rounded-2xl px-3 sm:px-4 py-1.5 sm:py-2 text-[10px] sm:text-xs font-mono shadow-md">
        <span className="text-zinc-400 font-bold flex items-center gap-2">
          <Maximize2 className="w-3.5 h-3.5 text-[#FF007A]" /> 3D Canlı Yayın Stadyumu
        </span>
        <div className="flex gap-2 items-center">
          <span className="text-[8px] sm:text-[10px] bg-indigo-500/15 text-indigo-400 px-2 py-0.5 rounded font-bold uppercase">
            3D FİZİK OKOK
          </span>
          <span className="hidden sm:inline text-zinc-500">• Fare ile döndürebilir ve kamerayı kaydırabilirsiniz</span>
        </div>
      </div>

      {/* Main Container viewport */}
      <div className="relative w-full h-[58svh] min-h-[390px] max-h-[680px] sm:h-[520px] md:h-[620px] bg-gradient-to-b from-zinc-950 to-zinc-900 rounded-2xl sm:rounded-[32px] border border-zinc-800 overflow-hidden shadow-2xl">
        
        {/* Sky Stadium atmospheric starry dark atmosphere */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_var(--tw-gradient-stops))] from-indigo-950/25 via-zinc-950 to-zinc-950 pointer-events-none z-0" />

        {/* Dynamic bright stadium floodlight coronas */}
        <div className="absolute top-0 left-12 w-32 h-24 bg-indigo-500/10 blur-3xl pointer-events-none" />
        <div className="absolute top-0 right-12 w-32 h-24 bg-emerald-500/10 blur-3xl pointer-events-none" />

        {/* Canvas Render viewport Target */}
        <div ref={containerRef} className="w-full h-full z-10 relative cursor-grab active:cursor-grabbing" />

        {/* Interactive Overlay Float controls */}
        <div className="absolute bottom-2 sm:bottom-4 left-2 sm:left-4 right-2 sm:right-4 flex flex-wrap gap-1.5 sm:gap-2 justify-between items-center pointer-events-none z-30">
          
          {/* Camera Presets Selector */}
          <div className="flex gap-1 p-1 bg-zinc-950/85 backdrop-blur-md rounded-xl border border-zinc-800 pointer-events-auto shadow-lg overflow-x-auto max-w-full">
            {(['BROADCAST', 'TACTICAL_3D', 'BEHIND_GOAL', 'TACTICAL'] as CameraPreset[]).map((preset) => (
              <button
                key={preset}
                onClick={() => setCameraPreset(preset)}
                className={`px-2 sm:px-2.5 py-1 text-[8px] sm:text-[9px] font-mono font-bold rounded-lg transition-all flex items-center gap-1 sm:gap-1.5 cursor-pointer whitespace-nowrap ${
                  cameraPreset === preset
                    ? 'bg-[#FF007A] text-white shadow font-black'
                    : 'text-zinc-400 hover:text-white hover:bg-zinc-900'
                }`}
              >
                <Compass className="w-3 h-3" />
                {preset === 'BROADCAST' ? 'TV YAYINI' : preset === 'TACTICAL_3D' ? 'TÜRBİN' : preset === 'BEHIND_GOAL' ? 'KALE ARKASI' : 'TEPE 2D'}
              </button>
            ))}
          </div>

          {/* Idle Auto Rotation toggle */}
          <button
            onClick={() => setIsRotating(!isRotating)}
            className={`pointer-events-auto px-2.5 sm:px-3 py-1 text-[8px] sm:text-[9px] font-mono font-bold rounded-xl border backdrop-blur-md flex items-center gap-1.5 shadow-lg transition-all cursor-pointer ${
              isRotating
                ? 'bg-emerald-950/85 border-emerald-800 text-emerald-400'
                : 'bg-zinc-900/85 border-zinc-800 text-zinc-400 hover:text-white'
            }`}
          >
            <RefreshCw className={`w-3 h-3 ${isRotating ? 'animate-spin' : ''}`} style={{ animationDuration: '6s' }} />
            {isRotating ? 'DÖNÜŞ: AÇIK' : 'DÖNÜŞ: DURDURULDU'}
          </button>
        </div>

        {/* Real-time possession bar visual floating inside 3D pitch */}
        <div className="absolute top-2 sm:top-4 left-2 sm:left-4 right-2 sm:right-4 pointer-events-none flex justify-between items-center z-30">
          <div className="bg-zinc-950/80 backdrop-blur-md border border-zinc-800 rounded-xl px-2.5 sm:px-3 py-1 sm:py-1.5 text-[9px] sm:text-xs text-white shadow-lg flex items-center gap-1.5 sm:gap-2">
            <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-red-500 animate-ping" />
            <span className="font-bold text-zinc-200">{homeClub.shortName} %{homePossessionDisplay}</span>
            <div className="w-12 sm:w-16 h-1.5 bg-zinc-800 rounded-full overflow-hidden flex">
              <div className="bg-red-500 h-full animate-pulse" style={{ width: `${possession}%` }} />
              <div className="bg-blue-500 h-full animate-pulse" style={{ width: `${100 - possession}%` }} />
            </div>
            <span className="font-bold text-zinc-300">%{awayPossessionDisplay} {awayClub.shortName}</span>
          </div>
        </div>

        {/* Celebrations / Match Event Alerts Banners */}
        <BroadcastBanner
          fxState={fxState as any}
          homeClub={homeClub as any}
          awayClub={awayClub as any}
        />
      </div>
    </div>
  );
}
