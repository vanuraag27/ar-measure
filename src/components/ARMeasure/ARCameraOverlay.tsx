import { useState, useRef, useEffect, useCallback, useMemo, ReactNode } from 'react';
import { MeasurementType, Point3D, LengthUnit, MeasurementRecord, AppSettings } from '../../types';
import { useCameraAndSensors } from '../../hooks/useCameraAndSensors';
import {
  Vec3, VerticalPlane, calculateDeltas, calculateAngle3Points, calculatePolygonArea3D,
  calculatePolygonPerimeter, calculatePathLength, minAreaRect, median,
  intersectFloor, intersectVerticalPlane, verticalPlaneThrough, projectToScreen, estimateFloorError,
} from '../../utils/arMath';
import { LENGTH_CONVERSIONS, formatArea, formatVolume, formatAngle, formatFeetAndInches } from '../../utils/units';
import { feedback } from '../../utils/soundAndSpeech';
import { recognizeObjectsInFrame, DetectedARObject } from '../../utils/aiObjectRecognition';
import {
  Undo, RotateCcw, Save, Check, ChevronDown, Crosshair, Sparkles, Move, Ruler, Target,
} from 'lucide-react';

interface ARCameraOverlayProps {
  tool: MeasurementType;
  settings: AppSettings;
  onSaveMeasurement: (rec: Omit<MeasurementRecord, 'id' | 'timestamp'>) => void;
  onFinishRoomScan?: (corners: { x: number; y: number }[], length: number, width: number, area: number, perimeter: number) => void;
  onUpdateSettings?: (s: AppSettings) => void;
  /** Rendered above the camera view, in normal layout flow (never overlaps). */
  topSlot?: ReactNode;
  /** Rendered below the control panel, in normal layout flow (never overlaps). */
  bottomSlot?: ReactNode;
}

type MState = 'idle' | 'measuring' | 'frozen';
type Surface = 'floor' | 'wall';

const MIN_DEPRESSION = 8;      // deg below horizon needed to hit the floor
const V_FOV = 62;              // vertical field of view used only to DRAW markers (measurement uses the centre ray)
const AVG_WINDOW_MS = 300;     // lock = median of the last 300 ms of samples

/** Length formatter with sensible (non-over-precise) decimals. */
function fmtLen(meters: number, unit: LengthUnit): string {
  const v = meters * LENGTH_CONVERSIONS[unit].factor;
  const dec = unit === 'm' ? 2 : unit === 'mm' ? 0 : unit === 'cm' ? 1 : 2;
  return `${v.toFixed(dec)} ${unit}`;
}

interface Result {
  kind: 'length' | 'area' | 'volume' | 'angle';
  value: number;            // SI
  valid: boolean;
  lines: string[];          // secondary readouts
  secondary?: MeasurementRecord['secondaryValues'];
}

export function ARCameraOverlay({
  tool, settings, onSaveMeasurement, onFinishRoomScan, onUpdateSettings, topSlot, bottomSlot,
}: ARCameraOverlayProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const [viewSize, setViewSize] = useState({ w: 360, h: 420 });

  const smoothFactor = settings.smoothingFilter === 'off' ? 1 : settings.smoothingFilter === 'low' ? 0.7 : settings.smoothingFilter === 'high' ? 0.15 : 0.4;
  const {
    cameraActive, isSimulatedFallback, sensorStatus, basis, depression, jitterDeg,
    trackingConfidence, lightingCondition, featurePoints, startCamera, requestSensorPermission, aimBy,
  } = useCameraAndSensors(videoRef, { smoothing: smoothFactor });

  // ---- measurement state ----
  const [lockedPoints, setLockedPoints] = useState<Point3D[]>([]);
  const [mState, setMState] = useState<MState>('idle');
  const [activeUnit, setActiveUnit] = useState<LengthUnit>(settings.defaultLengthUnit);
  const [projectionMode, setProjectionMode] = useState<'3d' | 'horizontal' | 'vertical'>('3d');
  const [tapeSurface, setTapeSurface] = useState<Surface>('floor');
  const [tapeWall, setTapeWall] = useState<VerticalPlane | null>(null);
  const [volumeBaseCount, setVolumeBaseCount] = useState<number | null>(null); // set once base is finished
  const [origin, setOrigin] = useState<{ x: number; z: number }>({ x: 0, z: 0 });
  const [anchoring, setAnchoring] = useState(false);

  const [showUnitMenu, setShowUnitMenu] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [showCalModal, setShowCalModal] = useState(false);
  const [calInput, setCalInput] = useState('');
  const [measurementName, setMeasurementName] = useState('');
  const [notes, setNotes] = useState('');
  const [toast, setToast] = useState<string | null>(null);

  // AI labels (optional, off by default - labels are suggestions, never used for measuring)
  const [aiVisionEnabled, setAiVisionEnabled] = useState(false);
  const [detectedObjects, setDetectedObjects] = useState<DetectedARObject[]>([]);
  const recognizingRef = useRef(false);

  useEffect(() => { setActiveUnit(settings.defaultLengthUnit); }, [settings.defaultLengthUnit]);

  const announce = useCallback((text: string) => feedback.speak(text, settings.enableVoiceGuidance, settings.language), [settings.enableVoiceGuidance, settings.language]);
  const flash = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2600);
  }, []);

  // ---- viewport size (so canvas and projection always match what is on screen) ----
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setViewSize({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    setViewSize({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  // ---- geometry ----
  const deviceHeight = (settings.deviceHeight ?? 1.4) * settings.calibrationFactor;
  const camPos: Vec3 = useMemo(() => ({ x: origin.x, y: deviceHeight, z: origin.z }), [origin, deviceHeight]);

  // Which surface does the reticle ray need to hit right now?
  const nearestBase = useCallback((pts: Point3D[]): Point3D | null => {
    if (pts.length === 0) return null;
    return pts.reduce((best, p) => (Math.hypot(p.x - camPos.x, p.z - camPos.z) < Math.hypot(best.x - camPos.x, best.z - camPos.z) ? p : best), pts[0]);
  }, [camPos]);

  const activePlane: VerticalPlane | null = useMemo(() => {
    if (tool === 'height' && lockedPoints.length >= 1) return verticalPlaneThrough(lockedPoints[0], camPos);
    if (tool === 'volume' && volumeBaseCount !== null) {
      const near = nearestBase(lockedPoints.slice(0, volumeBaseCount));
      return near ? verticalPlaneThrough(near, camPos) : null;
    }
    if (tool === 'tape' && tapeSurface === 'wall') return tapeWall;
    return null;
  }, [tool, lockedPoints, volumeBaseCount, tapeSurface, tapeWall, camPos, nearestBase]);

  const surface: Surface = activePlane ? 'wall' : 'floor';

  const hit: Vec3 | null = useMemo(() => {
    if (surface === 'wall' && activePlane) return intersectVerticalPlane(camPos, basis.forward, activePlane);
    return intersectFloor(camPos, basis.forward, MIN_DEPRESSION);
  }, [surface, activePlane, camPos, basis]);

  // Rolling buffer -> locking uses a median of the last few samples to reject sensor spikes
  const bufferRef = useRef<{ t: number; p: Vec3; s: Surface }[]>([]);
  useEffect(() => {
    const now = performance.now();
    if (hit) bufferRef.current.push({ t: now, p: hit, s: surface });
    bufferRef.current = bufferRef.current.filter(e => now - e.t < AVG_WINDOW_MS && e.s === surface);
  }, [hit, surface]);

  const lockableHit = useCallback((): Point3D | null => {
    if (!hit) return null;
    const buf = bufferRef.current.filter(e => e.s === surface);
    if (buf.length < 3) return { ...hit };
    return {
      x: median(buf.map(e => e.p.x)),
      y: median(buf.map(e => e.p.y)),
      z: median(buf.map(e => e.p.z)),
    };
  }, [hit, surface]);

  const accuracyM = useMemo(() => {
    if (!hit) return null;
    if (surface === 'floor') return estimateFloorError(deviceHeight, depression);
    const d = Math.hypot(hit.x - camPos.x, hit.z - camPos.z);
    return Math.max(0.005, d * 0.006 + 0.01); // ~0.35° pointing noise on a wall at distance d
  }, [hit, surface, deviceHeight, depression, camPos]);

  // ---- tool reset ----
  const resetAll = useCallback((silent = false) => {
    setLockedPoints([]);
    setMState('idle');
    setVolumeBaseCount(null);
    setAnchoring(false);
    if (!silent) announce('Measurement reset.');
  }, [announce]);

  useEffect(() => {
    setLockedPoints([]);
    setMState('idle');
    setVolumeBaseCount(null);
    setAnchoring(false);
    setMeasurementName(defaultName(tool));
    setShowSaveModal(false);
  }, [tool]);

  // ---- committing points ----
  const finishCommon = () => {
    setMState('frozen');
    feedback.measurementComplete(true, settings.enableHaptics);
  };

  const handlePrimary = () => {
    if (anchoring) return confirmAnchor();
    const pt = lockableHit();
    if (!pt) return;

    // Tape on a wall: first define the wall plane from its base on the floor
    if (tool === 'tape' && tapeSurface === 'wall' && !tapeWall) {
      const plane = verticalPlaneThrough(pt, camPos);
      if (!plane) { flash('Wall base too close. Step back ≥ 0.5 m.'); return; }
      setTapeWall(plane);
      feedback.pointLocked(true, settings.enableHaptics);
      announce('Wall set. Now aim at points on the wall.');
      return;
    }

    feedback.pointLocked(true, settings.enableHaptics);
    const n = lockedPoints.length;

    switch (tool) {
      case 'tape':
        if (n === 0) { setLockedPoints([pt]); setMState('measuring'); announce('Start locked.'); }
        else { setLockedPoints([lockedPoints[0], pt]); finishCommon(); }
        break;
      case 'distance':
        setLockedPoints([pt]); finishCommon();
        break;
      case 'height':
        if (n === 0) { setLockedPoints([{ ...pt, y: 0 }]); setMState('measuring'); announce('Base locked. Aim at the top.'); }
        else { setLockedPoints([lockedPoints[0], pt]); finishCommon(); }
        break;
      case 'angle':
        if (n < 2) { setLockedPoints([...lockedPoints, pt]); setMState('measuring'); }
        else { setLockedPoints([...lockedPoints, pt]); finishCommon(); }
        break;
      case 'volume':
        if (volumeBaseCount === null) { setLockedPoints([...lockedPoints, pt]); setMState('measuring'); }
        else { setLockedPoints([...lockedPoints, pt]); finishCommon(); }
        break;
      default: // area, perimeter, path, room_scan
        setLockedPoints([...lockedPoints, pt]); setMState('measuring');
        announce(`Point ${n + 1} added.`);
    }
  };

  const handleFinishMultiPoint = () => {
    const minPts = tool === 'area' || tool === 'room_scan' ? 3 : 2;
    if (lockedPoints.length < minPts) return;
    finishCommon();
    if (tool === 'room_scan' && onFinishRoomScan) {
      const minX = Math.min(...lockedPoints.map(p => p.x));
      const minZ = Math.min(...lockedPoints.map(p => p.z));
      const corners = lockedPoints.map(p => ({ x: Number((p.x - minX).toFixed(2)), y: Number((p.z - minZ).toFixed(2)) }));
      const rect = minAreaRect(lockedPoints);
      onFinishRoomScan(corners, rect.length, rect.width, calculatePolygonArea3D(lockedPoints), calculatePolygonPerimeter(lockedPoints));
    }
  };

  const handleSetVolumeHeight = () => {
    if (lockedPoints.length < 3) return;
    setVolumeBaseCount(lockedPoints.length);
    announce('Now aim at the top edge of the object.');
  };

  const handleUndo = () => {
    if (anchoring) { setAnchoring(false); return; }
    if (lockedPoints.length === 0 && !(tool === 'tape' && tapeWall)) return;
    if (tool === 'tape' && tapeSurface === 'wall' && lockedPoints.length === 0 && tapeWall) { setTapeWall(null); return; }
    if (tool === 'volume' && volumeBaseCount !== null && lockedPoints.length === volumeBaseCount) { setVolumeBaseCount(null); setMState('measuring'); return; }
    const next = lockedPoints.slice(0, -1);
    setLockedPoints(next);
    setMState(next.length === 0 ? 'idle' : 'measuring');
    if (tool === 'volume' && next.length < (volumeBaseCount ?? 0)) setVolumeBaseCount(null);
  };

  // ---- re-anchoring after the user physically moved ----
  const startAnchor = () => { if (lockedPoints.length) { setAnchoring(true); setTapeWall(null); } };
  const confirmAnchor = () => {
    const ref = lockedPoints[lockedPoints.length - 1];
    const cur = surface === 'floor' ? lockableHit() : null;
    if (!ref || !cur) { flash('Aim at the floor point you locked last.'); return; }
    setOrigin(o => ({ x: o.x + (ref.x - cur.x), z: o.z + (ref.z - cur.z) }));
    setAnchoring(false);
    feedback.pointLocked(true, settings.enableHaptics);
    flash('Position re-anchored. Continue measuring.');
  };

  // ---- results ----
  const result: Result = useMemo(() => {
    const live = mState !== 'frozen' && hit ? ({ x: hit.x, y: hit.y, z: hit.z } as Point3D) : null;
    const pts = lockedPoints;
    const empty = (kind: Result['kind']): Result => ({ kind, value: 0, valid: false, lines: [] });

    switch (tool) {
      case 'tape': {
        const a = pts[0];
        const b = pts[1] ?? (pts.length === 1 ? live : null);
        if (!a || !b) return empty('length');
        const d = calculateDeltas(a, b);
        const v = projectionMode === 'horizontal' ? d.horizontalDistance : projectionMode === 'vertical' ? d.verticalDistance : d.direct3DDistance;
        return {
          kind: 'length', value: v, valid: true,
          lines: [`ΔH ${fmtLen(d.horizontalDistance, activeUnit)} · ΔV ${fmtLen(d.verticalDistance, activeUnit)}`],
          secondary: { dx: d.dx, dy: d.dy, dz: d.dz, horizontalDistance: d.horizontalDistance, verticalDistance: d.verticalDistance },
        };
      }
      case 'distance': {
        const t = pts[0] ?? live;
        if (!t) return empty('length');
        const horiz = Math.hypot(t.x - camPos.x, t.z - camPos.z);
        const los = Math.hypot(horiz, camPos.y - t.y);
        return {
          kind: 'length', value: horiz, valid: true,
          lines: [`Line of sight ${fmtLen(los, activeUnit)}`],
          secondary: { horizontalDistance: horiz, verticalDistance: camPos.y - t.y },
        };
      }
      case 'height': {
        const base = pts[0];
        const top = pts[1] ?? live;
        if (!base || !top) return empty('length');
        const h = Math.abs(top.y - base.y);
        return { kind: 'length', value: h, valid: true, lines: [], secondary: { verticalDistance: h } };
      }
      case 'angle': {
        const p = [...pts];
        if (p.length === 2 && live) p.push(live);
        if (p.length < 3) return empty('angle');
        return { kind: 'angle', value: calculateAngle3Points(p[0], p[1], p[2]), valid: true, lines: [] };
      }
      case 'volume': {
        const baseN = volumeBaseCount ?? pts.length;
        const base = pts.slice(0, baseN);
        const baseWithLive = volumeBaseCount === null && live && mState === 'measuring' ? [...base, live] : base;
        if (baseWithLive.length < 3) return empty('volume');
        const area = calculatePolygonArea3D(baseWithLive);
        let height = 0;
        if (volumeBaseCount !== null) {
          const top = pts[volumeBaseCount] ?? live;
          height = top ? Math.max(0, top.y) : 0;
        }
        const rect = minAreaRect(baseWithLive);
        return {
          kind: 'volume', value: area * height, valid: height > 0,
          lines: [
            `Base ${formatArea(area, settings.defaultAreaUnit)}`,
            `L ${fmtLen(rect.length, activeUnit)} · W ${fmtLen(rect.width, activeUnit)} · H ${fmtLen(height, activeUnit)}`,
          ],
          secondary: { dimensions: { length: rect.length, width: rect.width, height } },
        };
      }
      case 'path': {
        const p = mState === 'frozen' || !live ? pts : [...pts, live];
        const { total, segments } = calculatePathLength(p);
        return { kind: 'length', value: total, valid: p.length >= 2, lines: segments.length ? [`${segments.length} segment${segments.length > 1 ? 's' : ''} · last ${fmtLen(segments[segments.length - 1], activeUnit)}`] : [], secondary: { segments } };
      }
      case 'perimeter': {
        const p = mState === 'frozen' || !live ? pts : [...pts, live];
        const per = calculatePolygonPerimeter(p);
        return { kind: 'length', value: per, valid: p.length >= 2, lines: [`${p.length} corners`], secondary: { perimeter: per } };
      }
      default: { // area, room_scan
        const p = mState === 'frozen' || !live ? pts : [...pts, live];
        if (p.length < 3) return empty('area');
        const area = calculatePolygonArea3D(p);
        const per = calculatePolygonPerimeter(p);
        return { kind: 'area', value: area, valid: true, lines: [`Perimeter ${fmtLen(per, activeUnit)}`], secondary: { perimeter: per } };
      }
    }
  }, [tool, lockedPoints, hit, mState, projectionMode, activeUnit, camPos, volumeBaseCount, settings.defaultAreaUnit]);

  const valueText = (() => {
    if (!result.valid && result.value === 0) return '—';
    switch (result.kind) {
      case 'angle': return formatAngle(result.value);
      case 'area': return formatArea(result.value, settings.defaultAreaUnit);
      case 'volume': return formatVolume(result.value, settings.defaultVolumeUnit);
      default: return fmtLen(result.value, activeUnit);
    }
  })();

  // ---- save ----
  const handleConfirmSave = () => {
    const unit = result.kind === 'angle' ? 'deg' : result.kind === 'area' ? settings.defaultAreaUnit : result.kind === 'volume' ? settings.defaultVolumeUnit : activeUnit;
    onSaveMeasurement({
      name: measurementName || defaultName(tool),
      type: tool,
      primaryValue: result.value,
      unit,
      confidence: trackingConfidence,
      isArEstimated: true,
      points: lockedPoints,
      notes,
      secondaryValues: result.secondary,
    });
    setShowSaveModal(false);
    flash('Saved to history.');
    announce('Saved.');
  };

  // ---- calibration against a known length ----
  const handleApplyCalibration = () => {
    const real = parseFloat(calInput);
    if (!isFinite(real) || real <= 0 || result.value <= 0 || !onUpdateSettings) return;
    const realM = real / LENGTH_CONVERSIONS[activeUnit].factor;
    const next = Math.max(0.5, Math.min(2.0, settings.calibrationFactor * (realM / result.value)));
    onUpdateSettings({ ...settings, calibrationFactor: Number(next.toFixed(4)) });
    setShowCalModal(false);
    resetAll(true);
    flash(`Calibrated ×${next.toFixed(3)} - measure again.`);
  };

  // ---- optional AI labels ----
  useEffect(() => {
    if (!aiVisionEnabled) { setDetectedObjects([]); return; }
    const run = async () => {
      if (recognizingRef.current || !videoRef.current || videoRef.current.readyState < 2) return;
      recognizingRef.current = true;
      try {
        const c = document.createElement('canvas');
        c.width = 480; c.height = 360;
        c.getContext('2d')?.drawImage(videoRef.current, 0, 0, 480, 360);
        const objs = await recognizeObjectsInFrame({ image: c.toDataURL('image/jpeg', 0.65), planeType: depression > 60 ? 'horizontal_floor' : 'vertical_wall' });
        setDetectedObjects(objs);
      } finally { recognizingRef.current = false; }
    };
    const t = window.setTimeout(run, 800);
    const iv = window.setInterval(run, 5000);
    return () => { clearTimeout(t); clearInterval(iv); };
  }, [aiVisionEnabled, depression]);

  // ---- drag to aim when there are no motion sensors (desktop preview) ----
  const dragRef = useRef<{ x: number; y: number } | null>(null);
  const onPointerDown = (e: React.PointerEvent) => { if (sensorStatus === 'unavailable') dragRef.current = { x: e.clientX, y: e.clientY }; };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragRef.current) return;
    aimBy((e.clientX - dragRef.current.x) * 0.2, (e.clientY - dragRef.current.y) * 0.2);
    dragRef.current = { x: e.clientX, y: e.clientY };
  };
  const onPointerUp = () => { dragRef.current = null; };

  // ---- canvas drawing ----
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const { w, h } = viewSize;
    if (canvas.width !== w) canvas.width = w;
    if (canvas.height !== h) canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, w, h);
    const cx = w / 2, cy = h / 2;
    const proj = (p: Vec3) => projectToScreen(p, camPos, basis, w, h, V_FOV);

    // optical feature points
    if (settings.enableFeaturePoints) {
      ctx.fillStyle = 'rgba(245,158,11,0.55)';
      featurePoints.forEach(fp => { ctx.beginPath(); ctx.arc(fp.x * w, fp.y * h, 2, 0, Math.PI * 2); ctx.fill(); });
    }

    // true-scale floor grid (1 m squares) projected from the real camera pose
    if (settings.enablePlaneVisualization && depression > 5) {
      ctx.save();
      ctx.strokeStyle = 'rgba(56,189,248,0.28)';
      ctx.lineWidth = 1;
      const R = 8, step = 0.25;
      const gx0 = Math.round(camPos.x), gz0 = Math.round(camPos.z);
      for (let k = -R; k <= R; k++) {
        for (const axis of ['x', 'z'] as const) {
          ctx.beginPath();
          let pen = false;
          for (let s = -R; s <= R + 1e-6; s += step) {
            const p = axis === 'x' ? { x: gx0 + k, y: 0, z: gz0 + s } : { x: gx0 + s, y: 0, z: gz0 + k };
            const q = proj(p);
            if (q && Math.abs(q.x) < w * 3 && Math.abs(q.y) < h * 3) { pen ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y); pen = true; } else pen = false;
          }
          ctx.stroke();
        }
      }
      ctx.restore();
    }

    // optional AI label boxes (suggestions only)
    if (aiVisionEnabled) {
      detectedObjects.forEach(o => {
        const [ymin, xmin, ymax, xmax] = o.box2d;
        const bx = (xmin / 1000) * w, by = (ymin / 1000) * h;
        ctx.strokeStyle = '#38bdf8'; ctx.lineWidth = 1; ctx.setLineDash([4, 4]);
        ctx.strokeRect(bx, by, ((xmax - xmin) / 1000) * w, ((ymax - ymin) / 1000) * h);
        ctx.setLineDash([]);
        ctx.font = '10px "JetBrains Mono", monospace'; ctx.fillStyle = '#38bdf8';
        ctx.fillText(`${o.label} (AI)`, bx + 3, Math.max(12, by - 3));
      });
    }

    // measurement geometry
    const locked = lockedPoints.map(p => ({ p, s: proj(p) }));
    const cursor = hit && mState !== 'frozen' ? hit : null;
    const chain = [...locked.map(l => l.p), ...(cursor && mState === 'measuring' ? [cursor] : [])];
    const closes = tool === 'area' || tool === 'room_scan' || tool === 'perimeter' || (tool === 'volume' && volumeBaseCount === null);
    const baseChain = tool === 'volume' && volumeBaseCount !== null ? lockedPoints.slice(0, volumeBaseCount) : chain;

    const drawPoly = (pts: Vec3[], close: boolean, fill: boolean) => {
      const sp = pts.map(proj);
      if (sp.some(s => !s) || sp.length < 2) return;
      ctx.beginPath();
      sp.forEach((s, i) => (i ? ctx.lineTo(s!.x, s!.y) : ctx.moveTo(s!.x, s!.y)));
      if (close && sp.length >= 3) ctx.closePath();
      if (fill && sp.length >= 3) { ctx.fillStyle = 'rgba(245,158,11,0.18)'; ctx.fill(); }
      ctx.strokeStyle = '#f59e0b'; ctx.lineWidth = 3; ctx.stroke();
    };
    const fillable = tool === 'area' || tool === 'room_scan' || tool === 'volume';
    if (tool === 'angle') drawPoly(chain, false, false);
    else if (tool === 'distance') { /* beam drawn below */ }
    else if (tool === 'height' || (tool === 'tape')) drawPoly(chain, false, false);
    else drawPoly(baseChain, closes, fillable);

    // vertical edge for height / volume top
    if (tool === 'height' && lockedPoints[0]) {
      const top = lockedPoints[1] ?? (cursor && mState === 'measuring' ? cursor : null);
      if (top) { const a = proj(lockedPoints[0]), b = proj({ ...lockedPoints[0], y: top.y }); if (a && b) { ctx.strokeStyle = '#10b981'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); } }
    }

    // segment length labels
    const labelPill = (text: string, x: number, y: number) => {
      ctx.font = 'bold 11px "JetBrains Mono", monospace';
      const tw = ctx.measureText(text).width + 10;
      ctx.fillStyle = 'rgba(2,6,23,0.85)';
      ctx.beginPath(); ctx.roundRect(x - tw / 2, y - 9, tw, 18, 5); ctx.fill();
      ctx.fillStyle = '#fde68a'; ctx.textAlign = 'center'; ctx.fillText(text, x, y + 4);
    };
    if (tool !== 'distance' && tool !== 'angle' && chain.length >= 2 && chain.length <= 14) {
      for (let i = 0; i < chain.length - 1; i++) {
        const a = proj(chain[i]), b = proj(chain[i + 1]);
        if (!a || !b) continue;
        const d = Math.hypot(chain[i + 1].x - chain[i].x, chain[i + 1].y - chain[i].y, chain[i + 1].z - chain[i].z);
        labelPill(fmtLen(d, activeUnit), (a.x + b.x) / 2, (a.y + b.y) / 2);
      }
    }
    if (tool === 'angle' && lockedPoints.length >= 2) {
      const v = proj(lockedPoints[1]);
      if (v && result.valid) labelPill(formatAngle(result.value), v.x, v.y - 24);
    }

    // rubber band to the reticle
    if (cursor && mState === 'measuring' && locked.length) {
      const last = locked[locked.length - 1].s;
      if (last) { ctx.save(); ctx.setLineDash([6, 6]); ctx.strokeStyle = '#38bdf8'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(last.x, last.y); ctx.lineTo(cx, cy); ctx.stroke(); ctx.restore(); }
    }
    if (tool === 'distance' && (cursor || lockedPoints[0])) {
      const t = lockedPoints[0] ?? cursor!;
      const s = proj(t);
      ctx.save(); ctx.setLineDash([4, 4]); ctx.strokeStyle = 'rgba(56,189,248,0.8)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(cx, h); ctx.lineTo(s ? s.x : cx, s ? s.y : cy); ctx.stroke(); ctx.restore();
    }

    // locked point markers
    locked.forEach(({ s }, i) => {
      if (!s) return;
      ctx.fillStyle = '#f59e0b'; ctx.beginPath(); ctx.arc(s.x, s.y, 6, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(s.x, s.y, 10, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = '#fff'; ctx.font = 'bold 10px "JetBrains Mono", monospace'; ctx.textAlign = 'center';
      ctx.fillText(`P${i + 1}`, s.x, s.y - 15);
    });

    // wall plane edge indicator
    if (activePlane && surface === 'wall') {
      ctx.fillStyle = 'rgba(168,85,247,0.9)'; ctx.font = '10px "JetBrains Mono", monospace'; ctx.textAlign = 'left';
      ctx.fillText('WALL PLANE', 10, h - 10);
    }

    // reticle
    const ok = !!hit;
    const col = ok ? '#10b981' : '#f43f5e';
    ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(cx, cy, 20, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.arc(cx, cy, 3, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(cx - 30, cy); ctx.lineTo(cx - 22, cy); ctx.moveTo(cx + 30, cy); ctx.lineTo(cx + 22, cy);
    ctx.moveTo(cx, cy - 30); ctx.lineTo(cx, cy - 22); ctx.moveTo(cx, cy + 30); ctx.lineTo(cx, cy + 22);
    ctx.stroke();
  }, [viewSize, basis, camPos, depression, hit, lockedPoints, mState, tool, featurePoints, detectedObjects, aiVisionEnabled,
      settings.enableFeaturePoints, settings.enablePlaneVisualization, activeUnit, volumeBaseCount, activePlane, surface, result]);

  // ---- UI helpers ----
  const hint: string = (() => {
    if (sensorStatus === 'needs_permission') return 'Tap "Enable motion sensors" to start.';
    if (anchoring) return 'Stand at your new spot, aim at the LAST locked point, tap MATCH.';
    if (!hit) {
      if (surface === 'wall') return 'Aim at the wall you set (face it directly).';
      return depression < MIN_DEPRESSION ? 'Tilt the phone down toward the floor.' : 'Aim at a surface.';
    }
    if (tool === 'tape' && tapeSurface === 'wall' && !tapeWall) return 'Aim at where the wall meets the floor, tap SET WALL.';
    if (tool === 'height' && lockedPoints.length === 0) return 'Aim at the floor directly under the object, tap START.';
    if (tool === 'height' && lockedPoints.length === 1) return 'Tilt up to the top edge (stay in the same spot), tap LOCK TOP.';
    if (tool === 'volume' && volumeBaseCount === null) return `Tap the floor corners of the object's base (${lockedPoints.length}/3+).`;
    if (tool === 'volume') return 'Aim at the top edge of the object, tap LOCK TOP.';
    if (tool === 'angle') return ['Aim at the end of the first edge.', 'Aim at the corner (vertex).', 'Aim at the end of the second edge.'][Math.min(2, lockedPoints.length)] ?? '';
    if (accuracyM !== null && accuracyM > 0.15 && surface === 'floor') return 'Far target = low accuracy. Step closer or aim steeper.';
    if (jitterDeg > 0.7) return 'Hold steady…';
    if (mState === 'frozen') return 'Measurement locked. Save it or start a new one.';
    return { tape: 'Stand still and aim at each end of the line.', distance: 'Aim at the base of the target (floor level).', area: 'Tap each floor corner, then FINISH.', perimeter: 'Tap each floor corner, then FINISH.', path: 'Tap points along the route, then FINISH.', room_scan: 'Tap every floor corner of the room, then FINISH.', height: '', angle: '', volume: '' }[tool] ?? '';
  })();

  const canLock = !!hit || anchoring;
  const needsFinish = tool === 'area' || tool === 'perimeter' || tool === 'path' || tool === 'room_scan';
  const finishMin = tool === 'area' || tool === 'room_scan' ? 3 : 2;
  const primaryLabel = (() => {
    if (anchoring) return 'MATCH';
    if (mState === 'frozen') return 'NEW';
    if (tool === 'tape' && tapeSurface === 'wall' && !tapeWall) return 'SET WALL';
    if (tool === 'distance') return 'LOCK';
    if (mState === 'idle') return 'START';
    if (tool === 'tape') return 'LOCK END';
    if (tool === 'height' || (tool === 'volume' && volumeBaseCount !== null)) return 'LOCK TOP';
    if (tool === 'angle') return lockedPoints.length === 2 ? 'LOCK ANGLE' : '+ POINT';
    return '+ POINT';
  })();

  const canSave = result.valid && (mState === 'frozen' || tool === 'distance' || (needsFinish && lockedPoints.length >= finishMin));
  const confColor = trackingConfidence === 'high' ? 'bg-emerald-500' : trackingConfidence === 'medium' ? 'bg-amber-500' : 'bg-rose-500';

  return (
    <div className="flex flex-col w-full h-full min-h-0 bg-slate-950 select-none">
      {topSlot}

      {/* ===== Camera viewport (nothing but overlays tied to the camera lives here) ===== */}
      <div
        ref={viewportRef}
        className="relative flex-1 min-h-[220px] overflow-hidden bg-slate-950 touch-none"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <video ref={videoRef} playsInline muted autoPlay className={`absolute inset-0 w-full h-full object-cover ${isSimulatedFallback ? 'opacity-0' : ''}`} />
        {isSimulatedFallback && (
          <div className="absolute inset-0 bg-gradient-to-b from-slate-900 to-slate-950 flex items-start justify-center pt-14">
            <button onClick={startCamera} className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-amber-400 text-xs font-semibold rounded-lg border border-slate-700">
              Camera unavailable - tap to retry
            </button>
          </div>
        )}
        <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none" />

        {/* top row: status (left) + options (right) - single flex row so they can never overlap */}
        <div className="absolute top-2 left-2 right-2 flex items-start justify-between gap-2 pointer-events-none">
          <div className="min-w-0 bg-slate-900/85 backdrop-blur-md border border-slate-800 rounded-xl px-2.5 py-1.5 flex items-center gap-2 pointer-events-auto">
            <span className={`w-2 h-2 rounded-full shrink-0 ${confColor}`} />
            <span className="text-[11px] font-medium text-slate-200 truncate">
              {surface === 'wall' ? 'Wall' : 'Floor'}{hit && accuracyM !== null ? ` · ±${(accuracyM * 100).toFixed(accuracyM < 0.1 ? 1 : 0)} cm` : ' · no target'}
            </span>
            <span className="text-[10px] text-slate-500 capitalize shrink-0">{trackingConfidence}</span>
          </div>
          <div className="flex items-center gap-1.5 pointer-events-auto shrink-0">
            <button
              onClick={() => setAiVisionEnabled(v => !v)}
              title="AI labels (suggestions only, not used for measuring)"
              className={`h-8 w-8 rounded-xl border flex items-center justify-center backdrop-blur-md ${aiVisionEnabled ? 'bg-amber-500 text-slate-950 border-amber-400' : 'bg-slate-900/85 text-slate-400 border-slate-800'}`}
            >
              <Sparkles className="w-3.5 h-3.5" />
            </button>
            <div className="relative">
              <button onClick={() => setShowUnitMenu(v => !v)} className="h-8 bg-slate-900/85 border border-slate-800 rounded-xl px-2.5 text-xs font-mono-numbers text-amber-400 flex items-center gap-1 backdrop-blur-md">
                {activeUnit}<ChevronDown className="w-3 h-3 text-slate-400" />
              </button>
              {showUnitMenu && (
                <div className="absolute right-0 top-9 bg-slate-900 border border-slate-800 rounded-xl p-1 shadow-xl z-30 min-w-[64px]">
                  {(['m', 'cm', 'mm', 'ft', 'in', 'yd'] as LengthUnit[]).map(u => (
                    <button key={u} onClick={() => { setActiveUnit(u); setShowUnitMenu(false); }}
                      className={`w-full text-left px-2.5 py-1 text-xs rounded-lg font-mono-numbers ${activeUnit === u ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-300 hover:bg-slate-800'}`}>
                      {u}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* sensor permission / no-sensor notices */}
        {sensorStatus === 'needs_permission' && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-950/70 z-20">
            <button onClick={requestSensorPermission} className="px-5 py-3 bg-amber-500 text-slate-950 font-bold text-sm rounded-2xl shadow-xl">
              Enable motion sensors
            </button>
          </div>
        )}
        {sensorStatus === 'unavailable' && (
          <div className="absolute top-12 left-2 right-2 flex justify-center pointer-events-none">
            <div className="bg-slate-900/90 border border-amber-500/40 text-amber-300 text-[11px] rounded-lg px-2.5 py-1 flex items-center gap-1.5">
              <Move className="w-3 h-3" /> No motion sensors - drag the view to aim (preview only; use a phone for real measuring)
            </div>
          </div>
        )}
        {lightingCondition === 'low' && (
          <div className="absolute top-12 left-2 pointer-events-none text-[11px] text-rose-300 bg-slate-900/85 rounded-lg px-2 py-0.5">Low light</div>
        )}

        {/* hint pill + toast (bottom of camera view only) */}
        <div className="absolute bottom-2 left-2 right-2 flex flex-col items-center gap-1 pointer-events-none">
          {toast && <div className="bg-emerald-500 text-slate-950 text-xs font-bold px-3 py-1 rounded-full shadow">{toast}</div>}
          {hint && <div className="bg-slate-950/80 text-slate-200 text-[11px] px-3 py-1 rounded-full text-center max-w-full">{hint}</div>}
        </div>
      </div>

      {/* ===== Control panel (solid, below camera - never covers it) ===== */}
      <div className="shrink-0 bg-slate-950 border-t border-slate-800 px-3 pt-2 pb-2.5 space-y-2">
        {/* Readout */}
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[10px] font-semibold tracking-wider uppercase text-amber-500">
              {tool.replace('_', ' ')}{mState !== 'frozen' && result.valid ? ' · live' : mState === 'frozen' ? ' · locked' : ''}
            </div>
            <div className="text-2xl sm:text-3xl font-black font-mono-numbers text-white leading-tight truncate">{valueText}</div>
          </div>
          <div className="text-right text-[11px] font-mono-numbers text-slate-400 leading-snug min-w-0">
            {result.kind === 'length' && result.valid && settings.unitSystem === 'imperial' && <div className="text-amber-400 font-bold">{formatFeetAndInches(result.value)}</div>}
            {result.kind === 'length' && result.valid && settings.unitSystem !== 'imperial' && activeUnit !== 'ft' && <div>{fmtLen(result.value, 'ft')}</div>}
            {result.lines.map((l, i) => <div key={i} className="truncate">{l}</div>)}
          </div>
        </div>

        {/* Tool options row */}
        {(tool === 'tape' || (lockedPoints.length > 0 && mState === 'measuring')) && (
          <div className="flex items-center gap-2 overflow-x-auto [scrollbar-width:none]">
            {tool === 'tape' && (
              <>
                <div className="flex bg-slate-900 border border-slate-800 rounded-xl p-0.5 shrink-0">
                  {(['floor', 'wall'] as const).map(s => (
                    <button key={s} onClick={() => { setTapeSurface(s); resetAll(true); }}
                      className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg capitalize ${tapeSurface === s ? 'bg-amber-500 text-slate-950' : 'text-slate-400'}`}>{s}</button>
                  ))}
                </div>
                <div className="flex bg-slate-900 border border-slate-800 rounded-xl p-0.5 shrink-0">
                  {(['3d', 'horizontal', 'vertical'] as const).map(m => (
                    <button key={m} onClick={() => setProjectionMode(m)}
                      className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg ${projectionMode === m ? 'bg-amber-500 text-slate-950' : 'text-slate-400'}`}>{m === '3d' ? '3D' : m === 'horizontal' ? 'H' : 'V'}</button>
                  ))}
                </div>
              </>
            )}
            {tool === 'tape' && tapeSurface === 'wall' && tapeWall && (
              <button onClick={() => { setTapeWall(null); resetAll(true); }} className="shrink-0 px-2.5 py-1 text-[11px] rounded-xl bg-slate-900 border border-slate-800 text-slate-300">Reset wall</button>
            )}
            {mState === 'frozen' && tool === 'tape' && onUpdateSettings && (
              <button onClick={() => { setCalInput(''); setShowCalModal(true); }} className="shrink-0 px-2.5 py-1 text-[11px] font-semibold rounded-xl bg-sky-500/20 border border-sky-500/40 text-sky-300 flex items-center gap-1">
                <Ruler className="w-3 h-3" /> CAL
              </button>
            )}
            {lockedPoints.length > 0 && mState === 'measuring' && surface === 'floor' && !anchoring && tool !== 'height' && (
              <button onClick={startAnchor} className="shrink-0 px-2.5 py-1 text-[11px] rounded-xl bg-slate-900 border border-slate-800 text-slate-300 flex items-center gap-1">
                <Target className="w-3 h-3" /> I moved
              </button>
            )}
          </div>
        )}

        {/* Buttons */}
        <div className="flex items-center gap-2">
          <button onClick={() => resetAll()} disabled={lockedPoints.length === 0 && mState === 'idle' && !tapeWall} title="Reset"
            className="w-11 h-11 shrink-0 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 disabled:opacity-40 flex items-center justify-center active:scale-95">
            <RotateCcw className="w-4 h-4" />
          </button>
          <button onClick={handleUndo} disabled={lockedPoints.length === 0 && !anchoring && !tapeWall} title="Undo last point"
            className="w-11 h-11 shrink-0 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 disabled:opacity-40 flex items-center justify-center active:scale-95">
            <Undo className="w-4 h-4" />
          </button>

          <div className="flex-1 flex gap-1.5 min-w-0">
            {mState === 'frozen' ? (
              <button onClick={() => resetAll(true)} className="flex-1 h-12 rounded-xl bg-slate-800 text-white font-bold text-sm active:scale-[0.98]">NEW MEASUREMENT</button>
            ) : (
              <>
                <button onClick={handlePrimary} disabled={!canLock}
                  className={`flex-1 min-w-0 h-12 rounded-xl font-bold text-sm flex items-center justify-center gap-1.5 active:scale-[0.98] disabled:bg-slate-800 disabled:text-slate-500 ${mState === 'measuring' && (tool === 'tape' || tool === 'height') ? 'bg-emerald-500 text-slate-950' : 'bg-amber-500 text-slate-950'}`}>
                  {mState === 'measuring' && (tool === 'tape' || tool === 'height') ? <Check className="w-4 h-4" /> : <Crosshair className="w-4 h-4" />}
                  <span className="truncate">{canLock ? primaryLabel : 'NO TARGET'}</span>
                </button>
                {needsFinish && lockedPoints.length >= finishMin && (
                  <button onClick={handleFinishMultiPoint} className="h-12 px-4 rounded-xl bg-emerald-500 text-slate-950 font-bold text-sm flex items-center gap-1 active:scale-[0.98]"><Check className="w-4 h-4" />FINISH</button>
                )}
                {tool === 'volume' && volumeBaseCount === null && lockedPoints.length >= 3 && (
                  <button onClick={handleSetVolumeHeight} className="h-12 px-3 rounded-xl bg-emerald-500 text-slate-950 font-bold text-xs active:scale-[0.98]">SET HEIGHT</button>
                )}
              </>
            )}
          </div>

          {tool !== 'room_scan' && (
            <button onClick={() => setShowSaveModal(true)} disabled={!canSave} title="Save measurement"
              className="w-11 h-11 shrink-0 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 disabled:opacity-30 flex items-center justify-center active:scale-95">
              <Save className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {bottomSlot}

      {/* Save modal */}
      {showSaveModal && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-sm p-5 shadow-2xl">
            <h3 className="text-base font-bold text-white mb-3">Save Measurement</h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-slate-400 block mb-1">Label / Name</label>
                <input value={measurementName} onChange={e => setMeasurementName(e.target.value)} placeholder="e.g. Living Room North Wall"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-amber-500" />
              </div>
              <div>
                <label className="text-xs text-slate-400 block mb-1">Value</label>
                <div className="font-mono-numbers text-base font-bold text-amber-400 px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl">
                  {valueText}{accuracyM !== null && result.kind === 'length' ? <span className="text-xs text-slate-500 font-normal"> (±{(accuracyM * 100).toFixed(1)} cm est.)</span> : null}
                </div>
              </div>
              <div>
                <label className="text-xs text-slate-400 block mb-1">Notes (optional)</label>
                <input value={notes} onChange={e => setNotes(e.target.value)} placeholder="e.g. Wall outlet at 1.2 m"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-amber-500" />
              </div>
              <div className="flex gap-2 pt-2">
                <button onClick={() => setShowSaveModal(false)} className="flex-1 py-2.5 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold">Cancel</button>
                <button onClick={handleConfirmSave} className="flex-1 py-2.5 rounded-xl bg-amber-500 text-slate-950 text-xs font-bold">Save to History</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Calibration modal */}
      {showCalModal && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-sm p-5 shadow-2xl">
            <h3 className="text-base font-bold text-white mb-1">Calibrate with a known length</h3>
            <p className="text-xs text-slate-400 mb-3">
              You just measured <span className="text-amber-400 font-mono-numbers">{fmtLen(result.value, activeUnit)}</span>. Enter the real length (checked with a tape) in {activeUnit}. Use a ≥ 2 m line for best results.
            </p>
            <input type="number" step="any" autoFocus value={calInput} onChange={e => setCalInput(e.target.value)} placeholder={`Real length in ${activeUnit}`}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white font-mono-numbers focus:outline-none focus:border-amber-500" />
            <div className="flex gap-2 pt-4">
              <button onClick={() => setShowCalModal(false)} className="flex-1 py-2.5 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold">Cancel</button>
              <button onClick={handleApplyCalibration} className="flex-1 py-2.5 rounded-xl bg-amber-500 text-slate-950 text-xs font-bold">Apply calibration</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function defaultName(tool: MeasurementType): string {
  switch (tool) {
    case 'tape': return 'Linear Measurement';
    case 'distance': return 'Target Distance';
    case 'angle': return 'Corner Angle';
    case 'area': return 'Floor Area';
    case 'perimeter': return 'Boundary Perimeter';
    case 'volume': return 'Object Volume';
    case 'path': return 'Route Path';
    case 'height': return 'Object / Wall Height';
    case 'room_scan': return 'Scanned Room';
  }
}
