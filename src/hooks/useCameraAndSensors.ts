import { useState, useEffect, useRef, useCallback } from 'react';
import { TrackingConfidence } from '../types';
import { CameraBasis, basisFromOrientation, depressionDeg, normalizeVec } from '../utils/arMath';

export type SensorStatus = 'checking' | 'needs_permission' | 'active' | 'unavailable';

export interface CameraSensorsState {
  hasCamera: boolean;
  cameraActive: boolean;
  cameraError: string | null;
  isSimulatedFallback: boolean;
  sensorStatus: SensorStatus;
  /** Camera orientation in app world coordinates (x = East, y = Up, z = North). */
  basis: CameraBasis;
  /** Degrees the camera axis points below the horizon (negative = above). */
  depression: number;
  /** Smoothed angular jitter of the sensor in degrees per frame. */
  jitterDeg: number;
  trackingConfidence: TrackingConfidence;
  lightingCondition: 'good' | 'low' | 'harsh';
  featurePoints: { x: number; y: number; weight: number }[];
}

interface Options {
  /** 1 = no smoothing, lower = smoother. */
  smoothing: number;
}

type Raw = { alpha: number; beta: number; gamma: number };

const DEFAULT_BASIS = basisFromOrientation(0, 55, 0, 0); // looking ~35° below horizon

function currentScreenAngle(): number {
  if (typeof window === 'undefined') return 0;
  const a = window.screen?.orientation?.angle;
  if (typeof a === 'number') return a;
  const legacy = (window as unknown as { orientation?: number }).orientation;
  return typeof legacy === 'number' ? legacy : 0;
}

function lerpVec(a: { x: number; y: number; z: number }, b: { x: number; y: number; z: number }, k: number) {
  return normalizeVec({ x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k, z: a.z + (b.z - a.z) * k });
}

export function useCameraAndSensors(videoRef: React.RefObject<HTMLVideoElement | null>, options: Options = { smoothing: 0.45 }) {
  const [state, setState] = useState<CameraSensorsState>({
    hasCamera: false,
    cameraActive: false,
    cameraError: null,
    isSimulatedFallback: false,
    sensorStatus: 'checking',
    basis: DEFAULT_BASIS,
    depression: 35,
    jitterDeg: 0,
    trackingConfidence: 'low',
    lightingCondition: 'good',
    featurePoints: [],
  });

  const streamRef = useRef<MediaStream | null>(null);
  const offscreenCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const smoothingRef = useRef(options.smoothing);
  smoothingRef.current = options.smoothing;

  // Latest raw orientation (real sensors) or manual-aim orientation (no sensors)
  const rawRef = useRef<Raw | null>(null);
  const manualRef = useRef<{ yaw: number; elevation: number }>({ yaw: 0, elevation: -35 });
  const sensorStatusRef = useRef<SensorStatus>('checking');
  const prevForwardRef = useRef(DEFAULT_BASIS.forward);
  const smoothBasisRef = useRef<CameraBasis>(DEFAULT_BASIS);
  const jitterRef = useRef(0);

  const setSensorStatus = useCallback((status: SensorStatus) => {
    sensorStatusRef.current = status;
    setState(prev => (prev.sensorStatus === status ? prev : { ...prev, sensorStatus: status }));
  }, []);

  // ---------------- Camera ----------------
  const startCamera = useCallback(async () => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Camera API is not supported (HTTPS is required on phones).');
      }
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } },
          audio: false,
        });
      } catch {
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      }
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
      setState(prev => ({ ...prev, hasCamera: true, cameraActive: true, cameraError: null, isSimulatedFallback: false }));
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Camera not accessible';
      setState(prev => ({ ...prev, hasCamera: false, cameraActive: true, cameraError: msg, isSimulatedFallback: true }));
    }
  }, [videoRef]);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setState(prev => ({ ...prev, cameraActive: false }));
  }, [videoRef]);

  // ---------------- Orientation sensors ----------------
  const handleOrientation = useCallback((e: DeviceOrientationEvent) => {
    if (e.beta == null || e.gamma == null) return; // desktop browsers fire one empty event
    const compass = (e as DeviceOrientationEvent & { webkitCompassHeading?: number }).webkitCompassHeading;
    const alpha = typeof compass === 'number' ? (360 - compass) % 360 : (e.alpha ?? 0);
    rawRef.current = { alpha, beta: e.beta, gamma: e.gamma };
    if (sensorStatusRef.current !== 'active') setSensorStatus('active');
  }, [setSensorStatus]);

  /** iOS 13+ requires an explicit user gesture to enable motion sensors. */
  const requestSensorPermission = useCallback(async () => {
    const DOE = (window as unknown as { DeviceOrientationEvent?: { requestPermission?: () => Promise<string> } }).DeviceOrientationEvent;
    try {
      if (DOE && typeof DOE.requestPermission === 'function') {
        const res = await DOE.requestPermission();
        if (res !== 'granted') {
          setSensorStatus('unavailable');
          return false;
        }
      }
      window.addEventListener('deviceorientation', handleOrientation);
      window.setTimeout(() => {
        if (!rawRef.current) setSensorStatus('unavailable');
      }, 1500);
      return true;
    } catch {
      setSensorStatus('unavailable');
      return false;
    }
  }, [handleOrientation, setSensorStatus]);

  useEffect(() => {
    const DOE = (window as unknown as { DeviceOrientationEvent?: { requestPermission?: () => Promise<string> } }).DeviceOrientationEvent;
    let timer: number | undefined;
    if (DOE && typeof DOE.requestPermission === 'function') {
      setSensorStatus('needs_permission');
    } else {
      window.addEventListener('deviceorientation', handleOrientation);
      timer = window.setTimeout(() => {
        if (!rawRef.current) setSensorStatus('unavailable');
      }, 1500);
    }
    return () => {
      if (timer) window.clearTimeout(timer);
      window.removeEventListener('deviceorientation', handleOrientation);
    };
  }, [handleOrientation, setSensorStatus]);

  /** Manual aiming for devices without motion sensors (desktop preview): drag to look around. */
  const aimBy = useCallback((dYawDeg: number, dElevationDeg: number) => {
    const m = manualRef.current;
    manualRef.current = {
      yaw: (m.yaw + dYawDeg + 360) % 360,
      elevation: Math.max(-89, Math.min(60, m.elevation + dElevationDeg)),
    };
  }, []);

  // ---------------- Frame loop ----------------
  useEffect(() => {
    if (!offscreenCanvasRef.current && typeof document !== 'undefined') {
      offscreenCanvasRef.current = document.createElement('canvas');
      offscreenCanvasRef.current.width = 160;
      offscreenCanvasRef.current.height = 120;
    }

    let running = true;
    let frame = 0;
    let lastPublish = 0;
    let rafId = 0;
    let lighting: 'good' | 'low' | 'harsh' = 'good';
    let points: { x: number; y: number; weight: number }[] = [];

    const loop = (now: number) => {
      if (!running) return;
      frame++;

      // 1. Orientation -> camera basis
      const screenAngle = currentScreenAngle();
      const live = sensorStatusRef.current === 'active' && rawRef.current;
      let target: CameraBasis;
      if (live) {
        const r = rawRef.current as Raw;
        target = basisFromOrientation(r.alpha, r.beta, r.gamma, screenAngle);
      } else {
        const m = manualRef.current;
        target = basisFromOrientation(m.yaw, 90 + m.elevation, 0, 0);
      }

      // angular jitter of the raw signal
      const dotF = Math.max(-1, Math.min(1,
        target.forward.x * prevForwardRef.current.x + target.forward.y * prevForwardRef.current.y + target.forward.z * prevForwardRef.current.z));
      const stepDeg = (Math.acos(dotF) * 180) / Math.PI;
      jitterRef.current = jitterRef.current * 0.85 + stepDeg * 0.15;
      prevForwardRef.current = target.forward;

      // exponential smoothing of the camera axes
      const k = Math.max(0.05, Math.min(1, smoothingRef.current));
      const prev = smoothBasisRef.current;
      smoothBasisRef.current = {
        forward: lerpVec(prev.forward, target.forward, k),
        right: lerpVec(prev.right, target.right, k),
        up: lerpVec(prev.up, target.up, k),
      };

      // 2. Light & optical contrast analysis (cheap, every 8th frame)
      const video = videoRef.current;
      const canvas = offscreenCanvasRef.current;
      if (frame % 8 === 0 && video && video.readyState >= 2 && canvas) {
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (ctx) {
          try {
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
            const found: { x: number; y: number; weight: number }[] = [];
            let total = 0, count = 0;
            for (let y = 10; y < canvas.height - 10; y += 12) {
              for (let x = 10; x < canvas.width - 10; x += 12) {
                const i = (y * canvas.width + x) * 4;
                const lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
                total += lum; count++;
                const j = (y * canvas.width + (x + 3)) * 4;
                const lum2 = 0.299 * data[j] + 0.587 * data[j + 1] + 0.114 * data[j + 2];
                const diff = Math.abs(lum - lum2);
                if (diff > 25 && found.length < 40) found.push({ x: x / canvas.width, y: y / canvas.height, weight: diff / 100 });
              }
            }
            const avg = count ? total / count : 128;
            lighting = avg < 30 ? 'low' : avg > 235 ? 'harsh' : 'good';
            points = found;
          } catch { /* ignore frame errors */ }
        }
      }

      // 3. Publish to React at ~30 Hz
      if (now - lastPublish > 33) {
        lastPublish = now;
        const basis = smoothBasisRef.current;
        const dep = depressionDeg(basis.forward);
        const jitter = jitterRef.current;
        const sensorsLive = sensorStatusRef.current === 'active';

        let confidence: TrackingConfidence = 'low';
        if (sensorsLive) {
          if (jitter < 0.25 && dep >= 20 && dep <= 75 && lighting !== 'low') confidence = 'high';
          else if (jitter < 0.7 && dep >= 12) confidence = 'medium';
        }

        setState(prevState => ({
          ...prevState,
          basis,
          depression: dep,
          jitterDeg: jitter,
          trackingConfidence: confidence,
          lightingCondition: lighting,
          featurePoints: points,
        }));
      }

      rafId = requestAnimationFrame(loop);
    };

    rafId = requestAnimationFrame(loop);
    return () => {
      running = false;
      cancelAnimationFrame(rafId);
    };
  }, [videoRef]);

  // Auto-start camera
  useEffect(() => {
    startCamera();
    return () => stopCamera();
  }, [startCamera, stopCamera]);

  return { ...state, startCamera, stopCamera, requestSensorPermission, aimBy };
}
