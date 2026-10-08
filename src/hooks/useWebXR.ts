import { useState, useEffect, useRef, useCallback } from 'react';
import { CameraBasis, Vec3, normalizeVec } from '../utils/arMath';

/* Minimal WebXR typings (the DOM lib does not ship them) */
/* eslint-disable @typescript-eslint/no-explicit-any */
type XRAny = any;

export interface WebXRState {
  supported: boolean;      // device + browser can run ARCore-backed sessions
  active: boolean;         // session running
  tracking: boolean;       // viewer pose currently available
  camPos: Vec3 | null;     // metres, floor = y 0 (local-floor)
  basis: CameraBasis | null;
  hit: Vec3 | null;        // real surface hit under the screen centre (floor, wall, table...)
  vFovDeg: number;
  error: string | null;
}

/**
 * ARCore-backed measuring through WebXR (Chrome on Android with Google Play Services for AR).
 * The device tracks its own 6-DoF pose and detects real surfaces, so no assumed phone height is needed
 * and the user may walk around while measuring.
 */
export function useWebXR(overlayRootRef: React.RefObject<HTMLElement | null>) {
  const [state, setState] = useState<WebXRState>({
    supported: false, active: false, tracking: false, camPos: null, basis: null, hit: null, vFovDeg: 62, error: null,
  });
  const sessionRef = useRef<XRAny>(null);
  const glCanvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const xr = (navigator as XRAny).xr;
    if (!xr || typeof xr.isSessionSupported !== 'function') return;
    xr.isSessionSupported('immersive-ar').then((ok: boolean) => setState(s => ({ ...s, supported: !!ok }))).catch(() => {});
  }, []);

  const stop = useCallback(async () => {
    try { await sessionRef.current?.end(); } catch { /* already ended */ }
  }, []);

  const start = useCallback(async () => {
    const xr = (navigator as XRAny).xr;
    if (!xr) { setState(s => ({ ...s, error: 'WebXR not available' })); return false; }
    try {
      const root = overlayRootRef.current;
      const init: XRAny = { requiredFeatures: ['hit-test'], optionalFeatures: ['local-floor', 'dom-overlay'] };
      if (root) init.domOverlay = { root };
      const session: XRAny = await xr.requestSession('immersive-ar', init);
      sessionRef.current = session;

      const canvas = document.createElement('canvas');
      glCanvasRef.current = canvas;
      const gl: XRAny = canvas.getContext('webgl', { xrCompatible: true, alpha: true, antialias: false });
      if (!gl) throw new Error('WebGL unavailable');
      await gl.makeXRCompatible?.();
      const XRWebGLLayerCtor = (window as XRAny).XRWebGLLayer;
      session.updateRenderState({ baseLayer: new XRWebGLLayerCtor(session, gl) });

      let refSpace: XRAny;
      try { refSpace = await session.requestReferenceSpace('local-floor'); }
      catch { refSpace = await session.requestReferenceSpace('local'); }
      const viewerSpace = await session.requestReferenceSpace('viewer');
      const hitSource = await session.requestHitTestSource({ space: viewerSpace });

      let lastPublish = 0;
      const onFrame = (t: number, frame: XRAny) => {
        if (!sessionRef.current) return;
        session.requestAnimationFrame(onFrame);
        const layer = session.renderState.baseLayer;
        gl.bindFramebuffer(gl.FRAMEBUFFER, layer.framebuffer);
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

        if (t - lastPublish < 33) return;
        lastPublish = t;

        const pose = frame.getViewerPose(refSpace);
        if (!pose) { setState(s => ({ ...s, tracking: false, hit: null })); return; }
        const m: Float32Array = pose.transform.matrix; // column-major
        const camPos: Vec3 = { x: m[12], y: m[13], z: m[14] };
        const basis: CameraBasis = {
          right: normalizeVec({ x: m[0], y: m[1], z: m[2] }),
          up: normalizeVec({ x: m[4], y: m[5], z: m[6] }),
          forward: normalizeVec({ x: -m[8], y: -m[9], z: -m[10] }),
        };
        let vFov = 62;
        const proj: Float32Array | undefined = pose.views?.[0]?.projectionMatrix;
        if (proj && proj[5]) vFov = (2 * Math.atan(1 / proj[5]) * 180) / Math.PI;

        let hit: Vec3 | null = null;
        const results = frame.getHitTestResults(hitSource);
        if (results.length > 0) {
          const hp = results[0].getPose(refSpace);
          if (hp) hit = { x: hp.transform.position.x, y: hp.transform.position.y, z: hp.transform.position.z };
        }
        setState(s => ({ ...s, tracking: true, camPos, basis, hit, vFovDeg: vFov }));
      };
      session.requestAnimationFrame(onFrame);

      session.addEventListener('end', () => {
        sessionRef.current = null;
        try { hitSource.cancel(); } catch { /* ignore */ }
        setState(s => ({ ...s, active: false, tracking: false, camPos: null, basis: null, hit: null }));
      });
      setState(s => ({ ...s, active: true, error: null }));
      return true;
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Could not start ARCore session';
      setState(s => ({ ...s, active: false, error: msg }));
      return false;
    }
  }, [overlayRootRef]);

  useEffect(() => () => { sessionRef.current?.end?.().catch?.(() => {}); }, []);

  return { ...state, start, stop };
}
