import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { RoomRecord, AppSettings, FurnitureItem, RoomWindowConfig, DaylightAnalysisResult } from '../../types';
import { formatLength, formatArea } from '../../utils/units';
import { calculateSolarPosition, analyzeRoomDaylight, SolarPosition } from '../../utils/daylightAnalysis';
import { 
  Eye, RotateCw, ZoomIn, ZoomOut, Layers, Home, Navigation, 
  Info, Sun, Compass, Sparkles, RefreshCw, X, Plus, Trash2, 
  Sliders, ShieldAlert, Check, Flame, ChevronRight,
  Sunrise, Sunset, Moon, Lightbulb, SlidersHorizontal, ChevronDown, ChevronUp
} from 'lucide-react';

interface Room3DVisualizerProps {
  room: RoomRecord;
  settings: AppSettings;
  onClose?: () => void;
  onUpdateRoomWindows?: (windows: RoomWindowConfig[], compass: number) => void;
}

const DEFAULT_WINDOWS: RoomWindowConfig[] = [
  { id: 'win_1', wall: 'south', width: 1.6, height: 1.3, sillHeight: 0.9, offsetMeters: 2.0 },
  { id: 'win_2', wall: 'east', width: 1.2, height: 1.2, sillHeight: 0.9, offsetMeters: 1.5 },
];

export function Room3DVisualizer({ room, settings, onClose, onUpdateRoomWindows }: Room3DVisualizerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [viewMode, setViewMode] = useState<'orbit' | 'walkthrough'>('orbit');
  const [showCeiling, setShowCeiling] = useState<boolean>(false);
  const [wallTransparency, setWallTransparency] = useState<boolean>(true);
  const [statsOpen, setStatsOpen] = useState<boolean>(false);

  // Natural Light & Solar Simulation States
  const [daylightMode, setDaylightMode] = useState<boolean>(true);
  const [timeOfDay, setTimeOfDay] = useState<number>(12.0); // Default Midday (12:00 PM)
  const [dimmerLevel, setDimmerLevel] = useState<number>(100); // 0% to 150% virtual dimmer slider
  const [isDimmerExpanded, setIsDimmerExpanded] = useState<boolean>(true);
  const [season, setSeason] = useState<'summer' | 'equinox' | 'winter'>('equinox');
  const [compassOrientation, setCompassOrientation] = useState<number>(room.compassOrientation ?? 0); // 0 = North along Z=0
  const [windows, setWindows] = useState<RoomWindowConfig[]>(() => {
    return room.windows && room.windows.length > 0 ? room.windows : DEFAULT_WINDOWS;
  });
  const [showHeatmap, setShowHeatmap] = useState<boolean>(false);

  // AI Daylight Analysis State
  const [aiAnalysis, setAiAnalysis] = useState<DaylightAnalysisResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [showAnalysisModal, setShowAnalysisModal] = useState<boolean>(false);
  const [showWindowsDrawer, setShowWindowsDrawer] = useState<boolean>(false);

  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const animIdRef = useRef<number | null>(null);
  const sunLightRef = useRef<THREE.DirectionalLight | null>(null);
  const ambientLightRef = useRef<THREE.AmbientLight | null>(null);
  const floorMeshRef = useRef<THREE.Mesh | null>(null);
  const heatmapMeshRef = useRef<THREE.Mesh | null>(null);

  // Orbit state
  const isDraggingRef = useRef(false);
  const prevMouseRef = useRef({ x: 0, y: 0 });
  const sphericalRef = useRef({ radius: 8.5, theta: Math.PI / 4, phi: Math.PI / 3 });
  const centerTargetRef = useRef(new THREE.Vector3(room.length / 2, (room.height || 2.7) / 2, room.width / 2));

  // Walkthrough state
  const walkPosRef = useRef(new THREE.Vector3(room.length / 2, 1.6, room.width / 2));
  const walkYawRef = useRef(0);
  const walkPitchRef = useRef(0);

  // Convert decimal hours into 12-hour string (e.g. 10.5 -> "10:30 AM")
  const formatTime = (h: number) => {
    const wholeHours = Math.floor(h);
    const mins = Math.round((h - wholeHours) * 60);
    const period = wholeHours >= 12 ? 'PM' : 'AM';
    const displayHour = wholeHours % 12 === 0 ? 12 : wholeHours % 12;
    const displayMin = mins < 10 ? `0${mins}` : mins;
    return `${displayHour}:${displayMin} ${period}`;
  };

  // Compute live solar analysis and window exposure metrics based on orientation and time
  const solarData = (() => {
    const solarPos = calculateSolarPosition(timeOfDay, season, compassOrientation);

    // Identify current solar phase
    let phaseKey: 'dawn' | 'morning' | 'midday' | 'afternoon' | 'sunset' | 'night' = 'midday';
    let phaseName = 'Midday Zenith';
    let colorTemp = '5600K';

    if (solarPos.elevationDeg <= 0 || timeOfDay < 5.8 || timeOfDay >= 20.5) {
      phaseKey = 'night';
      phaseName = 'Night / Twilight';
      colorTemp = '1800K';
    } else if (timeOfDay < 7.75) {
      phaseKey = 'dawn';
      phaseName = 'Dawn (Sunrise)';
      colorTemp = '2700K';
    } else if (timeOfDay < 11.25) {
      phaseKey = 'morning';
      phaseName = 'Morning Light';
      colorTemp = '4200K';
    } else if (timeOfDay < 14.5) {
      phaseKey = 'midday';
      phaseName = 'Midday Peak';
      colorTemp = '5600K';
    } else if (timeOfDay < 17.5) {
      phaseKey = 'afternoon';
      phaseName = 'Afternoon Sun';
      colorTemp = '4600K';
    } else {
      phaseKey = 'sunset';
      phaseName = 'Sunset (Golden Hour)';
      colorTemp = '2200K';
    }

    // Direct and diffuse lux calculation scaled by dimmer slider
    const sinElev = Math.max(0, Math.sin((solarPos.elevationDeg * Math.PI) / 180));
    const directLux = solarPos.elevationDeg > 0 
      ? Math.round(sinElev * 82000 * (dimmerLevel / 100))
      : Math.round(25 * (dimmerLevel / 100));
    const diffuseLux = Math.round((220 + sinElev * 1900) * (dimmerLevel / 100));

    // Compass-relative azimuth & active window illumination
    // Azimuth: 0=North, 90=East, 180=South, 270=West
    const azim = (solarPos.azimuthDeg + 360) % 360;
    let activeWall: 'north' | 'east' | 'south' | 'west' = 'south';
    if (azim >= 45 && azim < 135) activeWall = 'east';
    else if (azim >= 135 && azim < 225) activeWall = 'south';
    else if (azim >= 225 && azim < 315) activeWall = 'west';
    else activeWall = 'north';

    const windowsOnActiveWall = windows.filter(w => w.wall === activeWall);
    const hasDirectOpening = windowsOnActiveWall.length > 0 && solarPos.elevationDeg > 0;

    let exposureNote = '';
    if (solarPos.elevationDeg <= 0) {
      exposureNote = 'Sun below horizon. Ambient twilight & artificial light.';
    } else if (hasDirectOpening) {
      exposureNote = `Direct solar influx through ${windowsOnActiveWall.length} ${activeWall.toUpperCase()} window(s) at ${solarPos.elevationDeg.toFixed(0)}° elevation.`;
    } else {
      exposureNote = `Sun at ${azim.toFixed(0)}° (${activeWall.toUpperCase()}); diffused atmospheric daylight (no direct glazing on this wall).`;
    }

    // Glare risk evaluation
    let glareRiskLevel: 'Low' | 'Moderate' | 'High' = 'Low';
    if (hasDirectOpening && solarPos.elevationDeg < 25 && directLux > 20000) {
      glareRiskLevel = 'High'; // Low morning or sunset sun directly in eyes
    } else if (hasDirectOpening && directLux > 40000) {
      glareRiskLevel = 'Moderate';
    }

    return {
      solarPos,
      phaseKey,
      phaseName,
      colorTemp,
      directLux,
      diffuseLux,
      activeWall,
      hasDirectOpening,
      exposureNote,
      glareRiskLevel
    };
  })();

  // Preset Handlers for Dawn, Midday, Sunset, Night
  const handlePresetDawn = () => {
    setTimeOfDay(7.0);
    setDimmerLevel(85);
  };

  const handlePresetMidday = () => {
    setTimeOfDay(12.0);
    setDimmerLevel(100);
  };

  const handlePresetSunset = () => {
    setTimeOfDay(18.75);
    setDimmerLevel(90);
  };

  const handlePresetNight = () => {
    setTimeOfDay(21.25);
    setDimmerLevel(25);
  };

  // Run AI Natural Light Analysis
  const handleRunAIAnalysis = async () => {
    setIsAnalyzing(true);
    setShowAnalysisModal(true);
    try {
      const res = await analyzeRoomDaylight({
        roomName: room.name,
        roomType: room.type,
        length: room.length,
        width: room.width,
        height: room.height || 2.75,
        area: room.area,
        compassOrientation,
        windows,
        timeOfDay: formatTime(timeOfDay),
        season,
      });
      setAiAnalysis(res);
    } catch (e) {
      console.error('Error running daylight analysis:', e);
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Add / remove windows
  const handleAddWindow = (wall: RoomWindowConfig['wall']) => {
    const newWin: RoomWindowConfig = {
      id: `win_${Date.now()}`,
      wall,
      width: 1.5,
      height: 1.3,
      sillHeight: 0.9,
      offsetMeters: 1.5,
    };
    const updated = [...windows, newWin];
    setWindows(updated);
    if (onUpdateRoomWindows) onUpdateRoomWindows(updated, compassOrientation);
  };

  const handleDeleteWindow = (id: string) => {
    const updated = windows.filter(w => w.id !== id);
    setWindows(updated);
    if (onUpdateRoomWindows) onUpdateRoomWindows(updated, compassOrientation);
  };

  // Initialize Three.js scene
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const width = container.clientWidth;
    const height = container.clientHeight;

    const scene = new THREE.Scene();
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(52, width / height, 0.1, 100);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    rendererRef.current = renderer;

    container.appendChild(renderer.domElement);

    const roomL = Math.max(1, room.length);
    const roomW = Math.max(1, room.width);
    const roomH = room.height || 2.7;
    centerTargetRef.current = new THREE.Vector3(roomL / 2, roomH / 2, roomW / 2);

    // Ambient light
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.45);
    scene.add(ambientLight);
    ambientLightRef.current = ambientLight;

    // Sun directional light with shadow mapping
    const sunLight = new THREE.DirectionalLight(0xfffaed, 1.5);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    sunLight.shadow.camera.near = 0.5;
    sunLight.shadow.camera.far = 45;
    const d = Math.max(roomL, roomW) * 1.5;
    sunLight.shadow.camera.left = -d;
    sunLight.shadow.camera.right = d;
    sunLight.shadow.camera.top = d;
    sunLight.shadow.camera.bottom = -d;
    sunLight.shadow.bias = -0.0005;
    scene.add(sunLight);
    sunLightRef.current = sunLight;

    // Fill bounce light (simulating atmospheric sky reflection)
    const skyFill = new THREE.HemisphereLight(0x90cdf4, 0x1e293b, 0.35);
    scene.add(skyFill);

    // Floor Mesh
    const floorGeo = new THREE.PlaneGeometry(roomL, roomW);
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      roughness: 0.35,
      metalness: 0.08,
    });
    const floorMesh = new THREE.Mesh(floorGeo, floorMat);
    floorMesh.rotation.x = -Math.PI / 2;
    floorMesh.position.set(roomL / 2, 0, roomW / 2);
    floorMesh.receiveShadow = true;
    scene.add(floorMesh);
    floorMeshRef.current = floorMesh;

    // Architectural Grid Lines
    const gridHelper = new THREE.GridHelper(Math.max(roomL, roomW) * 1.4, Math.ceil(Math.max(roomL, roomW) * 2), 0x334155, 0x1e293b);
    gridHelper.position.set(roomL / 2, 0.005, roomW / 2);
    scene.add(gridHelper);

    // Sunlight Lux Heatmap Canvas Overlay on Floor
    const heatmapCanvas = document.createElement('canvas');
    heatmapCanvas.width = 256;
    heatmapCanvas.height = 256;
    const hCtx = heatmapCanvas.getContext('2d');
    if (hCtx) {
      const grad = hCtx.createRadialGradient(128, 128, 20, 128, 128, 120);
      grad.addColorStop(0, 'rgba(245, 158, 11, 0.7)');   // High lux (yellow/amber)
      grad.addColorStop(0.4, 'rgba(16, 185, 129, 0.5)'); // Moderate lux (emerald)
      grad.addColorStop(0.8, 'rgba(56, 189, 248, 0.3)'); // Diffuse lux (cyan)
      grad.addColorStop(1, 'rgba(30, 41, 59, 0.0)');
      hCtx.fillStyle = grad;
      hCtx.fillRect(0, 0, 256, 256);
    }
    const heatmapTexture = new THREE.CanvasTexture(heatmapCanvas);
    const heatmapGeo = new THREE.PlaneGeometry(roomL * 0.98, roomW * 0.98);
    const heatmapMat = new THREE.MeshBasicMaterial({
      map: heatmapTexture,
      transparent: true,
      opacity: showHeatmap ? 0.75 : 0.0,
      side: THREE.DoubleSide
    });
    const heatmapMesh = new THREE.Mesh(heatmapGeo, heatmapMat);
    heatmapMesh.rotation.x = -Math.PI / 2;
    heatmapMesh.position.set(roomL / 2, 0.015, roomW / 2);
    scene.add(heatmapMesh);
    heatmapMeshRef.current = heatmapMesh;

    // Walls
    const wallThick = 0.12;
    const wallMat = new THREE.MeshStandardMaterial({
      color: 0x334155,
      roughness: 0.85,
      transparent: true,
      opacity: wallTransparency ? 0.75 : 1.0,
      side: THREE.DoubleSide
    });

    const windowGlassMat = new THREE.MeshPhysicalMaterial({
      color: 0x93c5fd,
      transparent: true,
      opacity: 0.35,
      roughness: 0.1,
      metalness: 0.9,
      transmission: 0.8,
      ior: 1.5,
    });

    const createWallWithWindows = (length: number, height: number, wallType: 'north' | 'south' | 'east' | 'west') => {
      const wallGroup = new THREE.Group();
      const wallWins = windows.filter(w => w.wall === wallType);

      if (wallWins.length === 0) {
        const geo = new THREE.BoxGeometry(length, height, wallThick);
        const mesh = new THREE.Mesh(geo, wallMat);
        mesh.position.set(0, height / 2, 0);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        wallGroup.add(mesh);
      } else {
        const win = wallWins[0];
        const winW = Math.min(length - 0.4, win.width);
        const winH = Math.min(height - 0.4, win.height);
        const sillH = win.sillHeight || 0.9;
        const winPos = Math.max(-length / 2 + winW / 2 + 0.2, Math.min(length / 2 - winW / 2 - 0.2, (win.offsetMeters || length / 2) - length / 2));

        // Bottom sub-wall
        if (sillH > 0.05) {
          const bGeo = new THREE.BoxGeometry(length, sillH, wallThick);
          const bMesh = new THREE.Mesh(bGeo, wallMat);
          bMesh.position.set(0, sillH / 2, 0);
          bMesh.castShadow = true;
          bMesh.receiveShadow = true;
          wallGroup.add(bMesh);
        }

        // Top lintel wall
        const topH = Math.max(0.1, height - (sillH + winH));
        const tGeo = new THREE.BoxGeometry(length, topH, wallThick);
        const tMesh = new THREE.Mesh(tGeo, wallMat);
        tMesh.position.set(0, height - topH / 2, 0);
        tMesh.castShadow = true;
        tMesh.receiveShadow = true;
        wallGroup.add(tMesh);

        // Glass pane
        const glassGeo = new THREE.BoxGeometry(winW, winH, wallThick * 0.4);
        const glassMesh = new THREE.Mesh(glassGeo, windowGlassMat);
        glassMesh.position.set(winPos, sillH + winH / 2, 0);
        wallGroup.add(glassMesh);
      }

      return wallGroup;
    };

    // North Wall (Z = 0)
    const northWall = createWallWithWindows(roomL, roomH, 'north');
    northWall.position.set(roomL / 2, 0, 0);
    scene.add(northWall);

    // South Wall (Z = roomW)
    const southWall = createWallWithWindows(roomL, roomH, 'south');
    southWall.position.set(roomL / 2, 0, roomW);
    scene.add(southWall);

    // West Wall (X = 0)
    const westWall = createWallWithWindows(roomW, roomH, 'west');
    westWall.rotation.y = Math.PI / 2;
    westWall.position.set(0, 0, roomW / 2);
    scene.add(westWall);

    // East Wall (X = roomL)
    const eastWall = createWallWithWindows(roomW, roomH, 'east');
    eastWall.rotation.y = -Math.PI / 2;
    eastWall.position.set(roomL, 0, roomW / 2);
    scene.add(eastWall);

    // Ceiling (optional)
    if (showCeiling) {
      const ceilGeo = new THREE.PlaneGeometry(roomL, roomW);
      const ceilMat = new THREE.MeshStandardMaterial({ color: 0x475569, side: THREE.DoubleSide });
      const ceilMesh = new THREE.Mesh(ceilGeo, ceilMat);
      ceilMesh.rotation.x = Math.PI / 2;
      ceilMesh.position.set(roomL / 2, roomH, roomW / 2);
      scene.add(ceilMesh);
    }

    // Furniture Objects
    (room.furniture || []).forEach(item => {
      const fGroup = create3DFurnitureMesh(item);
      scene.add(fGroup);
    });

    // 3D Compass Indicator on Floor
    const compassGroup = new THREE.Group();
    const ringGeo = new THREE.RingGeometry(0.35, 0.4, 32);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0xf59e0b, side: THREE.DoubleSide });
    const ringMesh = new THREE.Mesh(ringGeo, ringMat);
    ringMesh.rotation.x = -Math.PI / 2;
    compassGroup.add(ringMesh);

    const arrowGeo = new THREE.ConeGeometry(0.12, 0.45, 8);
    const arrowMat = new THREE.MeshBasicMaterial({ color: 0xef4444 });
    const arrowMesh = new THREE.Mesh(arrowGeo, arrowMat);
    arrowMesh.rotation.x = -Math.PI / 2;
    arrowMesh.position.z = -0.3;
    compassGroup.add(arrowMesh);

    const southArrowGeo = new THREE.ConeGeometry(0.1, 0.35, 8);
    const southArrowMat = new THREE.MeshBasicMaterial({ color: 0x94a3b8 });
    const southArrow = new THREE.Mesh(southArrowGeo, southArrowMat);
    southArrow.rotation.x = Math.PI / 2;
    southArrow.position.z = 0.3;
    compassGroup.add(southArrow);

    compassGroup.position.set(0.6, 0.05, 0.6);
    compassGroup.rotation.y = (compassOrientation * Math.PI) / 180;
    scene.add(compassGroup);

    // Render loop
    const updateCamera = () => {
      if (!cameraRef.current) return;
      if (viewMode === 'orbit') {
        const r = sphericalRef.current.radius;
        const theta = sphericalRef.current.theta;
        const phi = sphericalRef.current.phi;
        const target = centerTargetRef.current;

        const x = target.x + r * Math.sin(phi) * Math.sin(theta);
        const y = target.y + r * Math.cos(phi);
        const z = target.z + r * Math.sin(phi) * Math.cos(theta);

        cameraRef.current.position.set(x, y, z);
        cameraRef.current.lookAt(target);
      } else {
        const pos = walkPosRef.current;
        cameraRef.current.position.set(pos.x, pos.y, pos.z);
        const lookTarget = new THREE.Vector3(
          pos.x + Math.sin(walkYawRef.current) * Math.cos(walkPitchRef.current),
          pos.y + Math.sin(walkPitchRef.current),
          pos.z + Math.cos(walkYawRef.current) * Math.cos(walkPitchRef.current)
        );
        cameraRef.current.lookAt(lookTarget);
      }
    };

    const animate = () => {
      updateCamera();
      if (rendererRef.current && sceneRef.current && cameraRef.current) {
        rendererRef.current.render(sceneRef.current, cameraRef.current);
      }
      animIdRef.current = requestAnimationFrame(animate);
    };

    animate();

    const handleResize = () => {
      if (!containerRef.current || !rendererRef.current || !cameraRef.current) return;
      const w = containerRef.current.clientWidth;
      const h = containerRef.current.clientHeight;
      cameraRef.current.aspect = w / h;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(w, h);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (animIdRef.current) cancelAnimationFrame(animIdRef.current);
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [room, showCeiling, wallTransparency, viewMode, windows, compassOrientation, showHeatmap]);

  // Update Sun Direction, Virtual Dimmer Level, and Sky Color in Real Time
  useEffect(() => {
    if (!sunLightRef.current || !sceneRef.current) return;

    if (daylightMode) {
      const { solarPos, directLux } = solarData;
      const center = centerTargetRef.current;

      const r = 24;
      const elevRad = (solarPos.elevationDeg * Math.PI) / 180;
      const azimRad = (solarPos.azimuthDeg * Math.PI) / 180;

      const sunX = center.x + r * Math.cos(elevRad) * Math.sin(azimRad);
      const sunY = Math.max(0.1, r * Math.sin(elevRad));
      const sunZ = center.z + r * Math.cos(elevRad) * Math.cos(azimRad);

      sunLightRef.current.position.set(sunX, sunY, sunZ);
      sunLightRef.current.target.position.copy(center);
      sunLightRef.current.target.updateMatrixWorld();
      sunLightRef.current.color.setHex(solarPos.colorHex);

      // Virtual Dimmer intensity scaling
      const dimmerMultiplier = dimmerLevel / 100;
      sunLightRef.current.intensity = solarPos.intensity * dimmerMultiplier;
      sunLightRef.current.castShadow = solarPos.elevationDeg > 0 && dimmerLevel > 5;

      if (ambientLightRef.current) {
        ambientLightRef.current.intensity = solarPos.ambientIntensity * dimmerMultiplier;
      }

      // Update Heatmap opacity dynamically based on dimmer & sunlight lux
      if (heatmapMeshRef.current && showHeatmap) {
        const hMat = heatmapMeshRef.current.material as THREE.MeshBasicMaterial;
        hMat.opacity = Math.min(0.85, Math.max(0.1, (directLux / 60000) * 0.75 * dimmerMultiplier));
      }

      // Smooth background sky transition responding to time of day & dimmer
      let skyHex = 0x090d16;
      if (solarPos.elevationDeg > 0 && dimmerLevel > 15) {
        if (solarPos.elevationDeg < 15) {
          skyHex = dimmerLevel > 50 ? 0x2e1b12 : 0x1a0f12; // Dawn / Sunset warm glow
        } else if (solarPos.elevationDeg < 35) {
          skyHex = dimmerLevel > 50 ? 0x152238 : 0x0d1420; // Morning / Afternoon azure
        } else {
          skyHex = dimmerLevel > 50 ? 0x102a45 : 0x091522; // Noon clear blue
        }
      } else {
        skyHex = 0x060912; // Night sky
      }

      sceneRef.current.background = new THREE.Color(skyHex);
      sceneRef.current.fog = new THREE.FogExp2(skyHex, 0.025);
    } else {
      // Studio default light
      const dimmerMultiplier = dimmerLevel / 100;
      sunLightRef.current.position.set(room.length * 1.5, (room.height || 2.7) * 2.5, room.width * 1.5);
      sunLightRef.current.color.setHex(0xffffff);
      sunLightRef.current.intensity = 1.3 * dimmerMultiplier;
      if (ambientLightRef.current) ambientLightRef.current.intensity = 0.55 * dimmerMultiplier;
      sceneRef.current.background = new THREE.Color(0x090d16);
      sceneRef.current.fog = new THREE.FogExp2(0x090d16, 0.035);
    }
  }, [daylightMode, timeOfDay, season, compassOrientation, dimmerLevel, showHeatmap, room.length, room.width, room.height, solarData]);

  // Pointer interactions
  const handlePointerDown = (e: React.PointerEvent) => {
    isDraggingRef.current = true;
    prevMouseRef.current = { x: e.clientX, y: e.clientY };
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDraggingRef.current) return;
    const dx = e.clientX - prevMouseRef.current.x;
    const dy = e.clientY - prevMouseRef.current.y;
    prevMouseRef.current = { x: e.clientX, y: e.clientY };

    if (viewMode === 'orbit') {
      sphericalRef.current.theta -= dx * 0.008;
      sphericalRef.current.phi = Math.max(0.1, Math.min(Math.PI / 2 - 0.05, sphericalRef.current.phi - dy * 0.008));
    } else {
      walkYawRef.current -= dx * 0.006;
      walkPitchRef.current = Math.max(-Math.PI / 3, Math.min(Math.PI / 3, walkPitchRef.current - dy * 0.006));
    }
  };

  const handlePointerUp = () => {
    isDraggingRef.current = false;
  };

  const handleWheel = (e: React.WheelEvent) => {
    if (viewMode === 'orbit') {
      sphericalRef.current.radius = Math.max(2, Math.min(25, sphericalRef.current.radius + e.deltaY * 0.01));
    } else {
      const moveStep = -Math.sign(e.deltaY) * 0.3;
      walkPosRef.current.x += Math.sin(walkYawRef.current) * moveStep;
      walkPosRef.current.z += Math.cos(walkYawRef.current) * moveStep;
    }
  };

  return (
    <div className="relative w-full h-full min-h-[550px] bg-slate-950 select-none overflow-hidden flex flex-col">
      {/* 3D Canvas */}
      <div
        ref={containerRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onWheel={handleWheel}
        className="w-full h-full flex-1 touch-none cursor-grab active:cursor-grabbing"
      />

      {/* Top Floating HUD Bar */}
      <div className="absolute top-3 left-3 right-3 flex items-center justify-between pointer-events-none z-10 gap-2 flex-wrap">
        <div className="bg-slate-900/85 backdrop-blur-md border border-slate-800 rounded-xl px-3 py-2 flex items-center gap-2 pointer-events-auto shadow-lg">
          <Home className="w-4 h-4 text-amber-500" />
          <span className="text-sm font-semibold text-white">{room.name}</span>
          <span className="text-xs text-slate-500">·</span>
          <span className="text-xs font-mono-numbers text-amber-400">{formatArea(room.area, settings.defaultAreaUnit)}</span>
        </div>

        {/* Sunlight Simulation & AI Daylight Button */}
        <div className="flex items-center gap-2 pointer-events-auto">
          {/* AI Daylight Analysis Trigger */}
          <button
            onClick={handleRunAIAnalysis}
            className="px-3 py-1.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-lg shadow-amber-500/20 active:scale-95 transition-all"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>AI Sunlight Analysis</span>
          </button>

          {/* Mode Switcher */}
          <div className="hidden sm:flex bg-slate-900/85 backdrop-blur-md border border-slate-800 rounded-xl p-1 shadow-lg">
            <button
              onClick={() => setViewMode('orbit')}
              className={`px-3 py-1 text-xs font-medium rounded-lg transition-colors ${
                viewMode === 'orbit' ? 'bg-slate-800 text-white font-semibold' : 'text-slate-400 hover:text-white'
              }`}
            >
              Orbit
            </button>
            <button
              onClick={() => setViewMode('walkthrough')}
              className={`px-3 py-1 text-xs font-medium rounded-lg transition-colors ${
                viewMode === 'walkthrough' ? 'bg-slate-800 text-white font-semibold' : 'text-slate-400 hover:text-white'
              }`}
            >
              Walk
            </button>
          </div>

          {onClose && (
            <button
              onClick={onClose}
              className="bg-slate-900/85 hover:bg-slate-800 text-slate-300 hover:text-white px-3 py-1.5 rounded-xl text-xs font-medium border border-slate-800 backdrop-blur-md transition-colors"
            >
              Back
            </button>
          )}
        </div>
      </div>

      {/* Floating Toolbar Left: Daylight, Dimmer, Windows, Heatmap, Ceiling */}
      <div className="absolute left-3 top-20 flex flex-col gap-2 z-10">
        {/* Toggle Daylight Solar Simulation */}
        <button
          onClick={() => setDaylightMode(!daylightMode)}
          title="Toggle Sunlight Simulation"
          className={`w-10 h-10 rounded-xl flex items-center justify-center border backdrop-blur-md shadow-md transition-all ${
            daylightMode ? 'bg-amber-500 text-slate-950 font-bold border-amber-400 shadow-amber-500/20' : 'bg-slate-900/80 border-slate-800 text-slate-400 hover:text-white'
          }`}
        >
          <Sun className="w-4 h-4" />
        </button>

        {/* Toggle Virtual Light Dimmer Panel */}
        <button
          onClick={() => setIsDimmerExpanded(!isDimmerExpanded)}
          title="Toggle Virtual Light Dimmer Studio"
          className={`w-10 h-10 rounded-xl flex items-center justify-center border backdrop-blur-md shadow-md transition-all ${
            isDimmerExpanded ? 'bg-amber-500/20 border-amber-500/50 text-amber-400' : 'bg-slate-900/80 border-slate-800 text-slate-400 hover:text-white'
          }`}
        >
          <Sliders className="w-4 h-4" />
        </button>

        {/* Windows Manager Drawer */}
        <button
          onClick={() => setShowWindowsDrawer(!showWindowsDrawer)}
          title="Manage Windows & Glazing"
          className={`w-10 h-10 rounded-xl flex items-center justify-center border backdrop-blur-md shadow-md transition-all ${
            showWindowsDrawer ? 'bg-amber-500/20 border-amber-500/50 text-amber-400' : 'bg-slate-900/80 border-slate-800 text-slate-400 hover:text-white'
          }`}
        >
          <Compass className="w-4 h-4" />
        </button>

        {/* Toggle Lux Heatmap */}
        <button
          onClick={() => setShowHeatmap(!showHeatmap)}
          title="Toggle Sunlight Lux Heatmap"
          className={`w-10 h-10 rounded-xl flex items-center justify-center border backdrop-blur-md shadow-md transition-all ${
            showHeatmap ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400' : 'bg-slate-900/80 border-slate-800 text-slate-400 hover:text-white'
          }`}
        >
          <Flame className="w-4 h-4" />
        </button>

        {/* Toggle Ceiling */}
        <button
          onClick={() => setShowCeiling(!showCeiling)}
          title="Toggle Ceiling"
          className={`w-10 h-10 rounded-xl flex items-center justify-center border backdrop-blur-md shadow-md transition-all ${
            showCeiling ? 'bg-amber-500/20 border-amber-500/50 text-amber-400' : 'bg-slate-900/80 border-slate-800 text-slate-400 hover:text-white'
          }`}
        >
          <Layers className="w-4 h-4" />
        </button>

        {/* Dimensions info */}
        <button
          onClick={() => setStatsOpen(!statsOpen)}
          title="Dimensions info"
          className="w-10 h-10 rounded-xl flex items-center justify-center bg-slate-900/80 border border-slate-800 text-slate-400 hover:text-white backdrop-blur-md shadow-md"
        >
          <Info className="w-4 h-4" />
        </button>
      </div>

      {/* VIRTUAL LIGHT DIMMER & SOLAR SIMULATION STUDIO (BOTTOM CENTER) */}
      {daylightMode && isDimmerExpanded && (
        <div className="absolute bottom-4 left-3 right-3 max-w-xl mx-auto bg-slate-900/95 backdrop-blur-xl border border-slate-800 rounded-2xl p-4 shadow-2xl z-20 space-y-3.5 animate-fade-in">
          {/* Top Bar: Title, Live Phase Badge, Time & Lux readout */}
          <div className="flex items-center justify-between text-xs gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center">
                <Sliders className="w-3.5 h-3.5" />
              </div>
              <span className="font-bold text-white text-xs tracking-tight">Virtual Light Dimmer</span>
              <span className="text-[10px] font-mono-numbers px-2 py-0.5 rounded-full bg-slate-800 text-amber-300 font-semibold border border-slate-700/60">
                {solarData.phaseName} ({solarData.colorTemp})
              </span>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-mono-numbers font-bold text-white bg-slate-950 px-2 py-0.5 rounded-md border border-slate-800">
                {formatTime(timeOfDay)}
              </span>
              <button
                onClick={() => setIsDimmerExpanded(false)}
                title="Minimize Dimmer"
                className="text-slate-400 hover:text-white p-1 rounded-md transition-colors"
              >
                <ChevronDown className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Quick Times-of-Day Presets (Dawn, Midday, Sunset, Night) */}
          <div className="grid grid-cols-4 gap-1.5">
            <button
              onClick={handlePresetDawn}
              className={`py-1.5 px-2 rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all ${
                solarData.phaseKey === 'dawn'
                  ? 'bg-amber-500 text-slate-950 font-bold shadow-md'
                  : 'bg-slate-800/80 text-slate-300 hover:text-white hover:bg-slate-800 border border-slate-700/60'
              }`}
            >
              <Sunrise className="w-3.5 h-3.5" />
              <span>Dawn</span>
            </button>

            <button
              onClick={handlePresetMidday}
              className={`py-1.5 px-2 rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all ${
                solarData.phaseKey === 'midday'
                  ? 'bg-amber-500 text-slate-950 font-bold shadow-md'
                  : 'bg-slate-800/80 text-slate-300 hover:text-white hover:bg-slate-800 border border-slate-700/60'
              }`}
            >
              <Sun className="w-3.5 h-3.5" />
              <span>Midday</span>
            </button>

            <button
              onClick={handlePresetSunset}
              className={`py-1.5 px-2 rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all ${
                solarData.phaseKey === 'sunset'
                  ? 'bg-amber-500 text-slate-950 font-bold shadow-md'
                  : 'bg-slate-800/80 text-slate-300 hover:text-white hover:bg-slate-800 border border-slate-700/60'
              }`}
            >
              <Sunset className="w-3.5 h-3.5" />
              <span>Sunset</span>
            </button>

            <button
              onClick={handlePresetNight}
              className={`py-1.5 px-2 rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all ${
                solarData.phaseKey === 'night'
                  ? 'bg-amber-500 text-slate-950 font-bold shadow-md'
                  : 'bg-slate-800/80 text-slate-300 hover:text-white hover:bg-slate-800 border border-slate-700/60'
              }`}
            >
              <Moon className="w-3.5 h-3.5" />
              <span>Night</span>
            </button>
          </div>

          {/* SLIDER 1: Solar Time-of-Day Trajectory */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-[11px] text-slate-400">
              <span className="font-semibold flex items-center gap-1">
                <Sun className="w-3 h-3 text-amber-400" />
                <span>Sunlight Solar Time</span>
              </span>
              <span className="font-mono-numbers text-amber-400 font-bold">
                {formatTime(timeOfDay)}
              </span>
            </div>

            <div className="relative flex items-center">
              <input
                type="range"
                min="6.0"
                max="21.0"
                step="0.25"
                value={timeOfDay}
                onChange={e => setTimeOfDay(parseFloat(e.target.value))}
                className="w-full h-2 bg-gradient-to-r from-amber-600 via-sky-400 to-indigo-900 rounded-lg appearance-none cursor-pointer accent-amber-400"
              />
            </div>

            <div className="flex justify-between text-[9px] font-mono-numbers text-slate-500 pt-0.5">
              <span>6:00 AM (Dawn)</span>
              <span>12:00 PM (Midday)</span>
              <span>6:45 PM (Sunset)</span>
              <span>9:00 PM (Night)</span>
            </div>
          </div>

          {/* SLIDER 2: Virtual Light Dimmer Intensity */}
          <div className="space-y-1 border-t border-slate-800/80 pt-2.5">
            <div className="flex items-center justify-between text-[11px] text-slate-400">
              <span className="font-semibold flex items-center gap-1">
                <Lightbulb className="w-3 h-3 text-amber-400" />
                <span>Illumination Dimmer</span>
              </span>
              <span className="font-mono-numbers font-bold text-white">
                {dimmerLevel}% Intensity
              </span>
            </div>

            <div className="flex items-center gap-3">
              <input
                type="range"
                min="5"
                max="140"
                step="5"
                value={dimmerLevel}
                onChange={e => setDimmerLevel(parseInt(e.target.value))}
                className="flex-1 h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
              />
              <div className="flex items-center gap-1">
                {[30, 70, 100].map(lvl => (
                  <button
                    key={lvl}
                    onClick={() => setDimmerLevel(lvl)}
                    className={`px-1.5 py-0.5 text-[9px] font-mono-numbers rounded ${
                      dimmerLevel === lvl ? 'bg-amber-500 text-slate-950 font-bold' : 'bg-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    {lvl}%
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* SLIDER 3: Room Orientation (Compass North Angle) & Live Solar Flux Analysis */}
          <div className="space-y-1.5 border-t border-slate-800/80 pt-2.5">
            <div className="flex items-center justify-between text-[11px] text-slate-400">
              <div className="flex items-center gap-1.5">
                <Compass className="w-3 h-3 text-amber-400" />
                <span className="font-semibold">Room Orientation:</span>
                <span className="font-mono-numbers text-white font-bold">{compassOrientation}° North</span>
              </div>

              {/* Season selector */}
              <div className="flex items-center gap-1 bg-slate-950 px-1 py-0.5 rounded-lg border border-slate-800 text-[10px]">
                {(['summer', 'equinox', 'winter'] as const).map(s => (
                  <button
                    key={s}
                    onClick={() => setSeason(s)}
                    className={`px-1.5 py-0.2 capitalize rounded transition-colors ${
                      season === s ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            <input
              type="range"
              min="0"
              max="350"
              step="10"
              value={compassOrientation}
              onChange={e => {
                const val = parseInt(e.target.value);
                setCompassOrientation(val);
                if (onUpdateRoomWindows) onUpdateRoomWindows(windows, val);
              }}
              className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
            />
          </div>

          {/* REAL-TIME SUNLIGHT ANALYSIS DATA STRIP */}
          <div className="bg-slate-950/80 p-2.5 rounded-xl border border-slate-800 text-[11px] space-y-1.5">
            <div className="flex items-center justify-between">
              <div className="text-slate-300 font-medium truncate flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse shrink-0" />
                <span className="truncate">{solarData.exposureNote}</span>
              </div>
              <span className={`text-[9px] px-1.5 py-0.2 rounded font-bold uppercase ${
                solarData.glareRiskLevel === 'High' ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30' :
                solarData.glareRiskLevel === 'Moderate' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' :
                'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
              }`}>
                Glare: {solarData.glareRiskLevel}
              </span>
            </div>

            <div className="grid grid-cols-4 gap-2 text-[10px] font-mono-numbers text-slate-400 border-t border-slate-800/80 pt-1.5">
              <div>
                <span className="text-slate-500 block">Elevation:</span>
                <span className="text-white font-bold">{solarData.solarPos.elevationDeg.toFixed(0)}°</span>
              </div>
              <div>
                <span className="text-slate-500 block">Azimuth:</span>
                <span className="text-white font-bold">{solarData.solarPos.azimuthDeg.toFixed(0)}°</span>
              </div>
              <div>
                <span className="text-slate-500 block">Direct Lux:</span>
                <span className="text-amber-400 font-bold">~{solarData.directLux.toLocaleString()}</span>
              </div>
              <div>
                <span className="text-slate-500 block">Diffuse:</span>
                <span className="text-sky-300 font-bold">~{solarData.diffuseLux.toLocaleString()}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Minimized Dimmer Badge (if closed) */}
      {daylightMode && !isDimmerExpanded && (
        <button
          onClick={() => setIsDimmerExpanded(true)}
          className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-slate-900/90 backdrop-blur-md border border-slate-800 hover:border-amber-500/60 rounded-full px-4 py-2 shadow-2xl z-20 flex items-center gap-2 text-xs font-semibold text-white transition-all active:scale-95"
        >
          <Sliders className="w-3.5 h-3.5 text-amber-400" />
          <span>Virtual Light Dimmer: {solarData.phaseName} ({formatTime(timeOfDay)})</span>
          <ChevronUp className="w-3.5 h-3.5 text-slate-400" />
        </button>
      )}

      {/* Windows Configuration Drawer (if active) */}
      {showWindowsDrawer && (
        <div className="absolute top-16 left-16 bg-slate-900/95 backdrop-blur-xl border border-slate-800 rounded-2xl p-4 shadow-2xl z-30 w-72 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
              <Compass className="w-3.5 h-3.5 text-amber-400" />
              <span>Window Openings ({windows.length})</span>
            </h4>
            <button
              onClick={() => setShowWindowsDrawer(false)}
              className="text-slate-400 hover:text-white p-1"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Windows list */}
          <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
            {windows.map(win => (
              <div
                key={win.id}
                className="bg-slate-950 p-2.5 rounded-xl border border-slate-800 flex items-center justify-between text-xs"
              >
                <div>
                  <span className="font-semibold text-amber-400 capitalize">{win.wall} Wall Window</span>
                  <div className="text-[10px] text-slate-400 font-mono-numbers mt-0.5">
                    {win.width}m × {win.height}m · Sill: {win.sillHeight || 0.9}m
                  </div>
                </div>
                <button
                  onClick={() => handleDeleteWindow(win.id)}
                  className="text-slate-500 hover:text-rose-400 p-1 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>

          {/* Add window buttons by wall */}
          <div>
            <span className="text-[10px] text-slate-400 uppercase font-semibold block mb-1">
              Add Window by Wall:
            </span>
            <div className="grid grid-cols-2 gap-1.5">
              {(['south', 'east', 'west', 'north'] as const).map(w => (
                <button
                  key={w}
                  onClick={() => handleAddWindow(w)}
                  className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white text-xs rounded-lg capitalize border border-slate-700/80 transition-colors flex items-center justify-center gap-1"
                >
                  <Plus className="w-3 h-3 text-amber-400" />
                  <span>{w} Wall</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* AI Natural Light Analysis Modal */}
      {showAnalysisModal && (
        <div className="absolute inset-0 bg-black/75 backdrop-blur-md z-40 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-lg p-5 shadow-2xl space-y-4 max-h-[85vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">AI Natural Light & Solar Analysis</h3>
                  <p className="text-xs text-slate-400">Powered by Gemini 3.8 Flash</p>
                </div>
              </div>
              <button
                onClick={() => setShowAnalysisModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {isAnalyzing ? (
              <div className="py-12 text-center space-y-3">
                <div className="w-8 h-8 border-3 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto" />
                <p className="text-sm font-semibold text-white">Calculating Solar Path & Daylighting...</p>
                <p className="text-xs text-slate-400 max-w-xs mx-auto">
                  Simulating sun trajectory for {formatTime(timeOfDay)} across {windows.length} window aperture(s) at {compassOrientation}° orientation.
                </p>
              </div>
            ) : aiAnalysis ? (
              <div className="space-y-4">
                {/* Score & Rating Banner */}
                <div className="bg-gradient-to-r from-amber-500/20 via-slate-800 to-slate-800 border border-amber-500/40 rounded-2xl p-4 flex items-center justify-between">
                  <div>
                    <span className="text-[11px] font-bold text-amber-400 uppercase tracking-wider block">
                      Natural Daylighting Score
                    </span>
                    <div className="text-3xl font-black font-mono-numbers text-white mt-0.5">
                      {aiAnalysis.overallScore} <span className="text-sm font-normal text-slate-400">/ 100</span>
                    </div>
                    <div className="text-xs font-semibold text-amber-300 mt-1">
                      {aiAnalysis.ratingLabel}
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="text-[11px] text-slate-400 block">Daily Direct Sun</span>
                    <div className="text-2xl font-black font-mono-numbers text-amber-400 mt-0.5">
                      ~{aiAnalysis.dailySunlightHours}h
                    </div>
                    <span className="text-[10px] text-slate-500 block">per day</span>
                  </div>
                </div>

                {/* Solar Exposure Profile (Morning / Midday / Afternoon) */}
                <div className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800 space-y-2">
                  <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                    Daily Sunlight Trajectory
                  </h4>
                  <div className="space-y-1.5 text-xs">
                    <div className="flex gap-2">
                      <span className="text-amber-400 font-semibold w-16 shrink-0">Morning:</span>
                      <span className="text-slate-300">{aiAnalysis.solarExposureProfile.morning}</span>
                    </div>
                    <div className="flex gap-2">
                      <span className="text-amber-400 font-semibold w-16 shrink-0">Midday:</span>
                      <span className="text-slate-300">{aiAnalysis.solarExposureProfile.midday}</span>
                    </div>
                    <div className="flex gap-2">
                      <span className="text-amber-400 font-semibold w-16 shrink-0">Afternoon:</span>
                      <span className="text-slate-300">{aiAnalysis.solarExposureProfile.afternoon}</span>
                    </div>
                  </div>
                </div>

                {/* Glare & Health Benefits Grid */}
                <div className="grid grid-cols-2 gap-2.5">
                  <div className="bg-slate-950 p-3 rounded-2xl border border-slate-800">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-white mb-1">
                      <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
                      <span>Glare Risk: {aiAnalysis.glareRisk.level}</span>
                    </div>
                    <p className="text-[11px] text-slate-400 leading-relaxed">
                      {aiAnalysis.glareRisk.details}
                    </p>
                  </div>

                  <div className="bg-slate-950 p-3 rounded-2xl border border-slate-800">
                    <div className="text-xs font-bold text-white mb-1">
                      Circadian & Health
                    </div>
                    <p className="text-[11px] text-slate-400 leading-relaxed">
                      {aiAnalysis.biophilicAndHealthBenefits}
                    </p>
                  </div>
                </div>

                {/* Architectural Recommendations */}
                <div className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800 space-y-2">
                  <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                    Architectural Placement Recommendations
                  </h4>
                  <ul className="space-y-1.5 text-xs text-slate-300">
                    {aiAnalysis.placementRecommendations.map((rec, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                        <span>{rec}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Thermal & Energy note */}
                <div className="text-[11px] text-slate-400 bg-slate-800/40 p-2.5 rounded-xl border border-slate-800">
                  <span className="font-semibold text-slate-300">Energy & Lighting Offset: </span>
                  {aiAnalysis.thermalAndEnergyImpact}
                </div>
              </div>
            ) : null}

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setShowAnalysisModal(false)}
                className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs rounded-xl transition-colors"
              >
                Close Report
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// 3D Furniture builder helper
function create3DFurnitureMesh(item: FurnitureItem): THREE.Group {
  const group = new THREE.Group();
  const w = Math.max(0.2, item.width);
  const d = Math.max(0.2, item.depth);
  const h = Math.max(0.2, item.height);

  const baseMat = new THREE.MeshStandardMaterial({
    color: item.color ? parseInt(item.color.replace('#', '0x')) : 0x475569,
    roughness: 0.6,
  });

  if (item.type === 'bed') {
    const frameGeo = new THREE.BoxGeometry(w, 0.25, d);
    const frame = new THREE.Mesh(frameGeo, new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.8 }));
    frame.position.y = 0.125;
    frame.castShadow = true;
    frame.receiveShadow = true;
    group.add(frame);

    const matGeo = new THREE.BoxGeometry(w * 0.95, 0.25, d * 0.95);
    const mattress = new THREE.Mesh(matGeo, new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.9 }));
    mattress.position.y = 0.375;
    mattress.castShadow = true;
    group.add(mattress);

    const headGeo = new THREE.BoxGeometry(w, 0.8, 0.1);
    const headboard = new THREE.Mesh(headGeo, baseMat);
    headboard.position.set(0, 0.4, -d / 2 + 0.05);
    headboard.castShadow = true;
    group.add(headboard);
  } else if (item.type === 'sofa') {
    const baseGeo = new THREE.BoxGeometry(w, 0.35, d);
    const seat = new THREE.Mesh(baseGeo, baseMat);
    seat.position.y = 0.175;
    seat.castShadow = true;
    seat.receiveShadow = true;
    group.add(seat);

    const backGeo = new THREE.BoxGeometry(w, 0.5, 0.2);
    const back = new THREE.Mesh(backGeo, baseMat);
    back.position.set(0, 0.45, -d / 2 + 0.1);
    back.castShadow = true;
    group.add(back);
  } else {
    const boxGeo = new THREE.BoxGeometry(w, h, d);
    const box = new THREE.Mesh(boxGeo, baseMat);
    box.position.y = h / 2;
    box.castShadow = true;
    box.receiveShadow = true;
    group.add(box);
  }

  group.position.set(item.x, 0, item.y);
  group.rotation.y = (item.rotation * Math.PI) / 180;
  return group;
}
