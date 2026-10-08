import { useState, useRef, useEffect } from 'react';
import { LengthUnit } from '../../types';
import { Sliders, RotateCcw, Check, Sparkles } from 'lucide-react';

interface ScreenRulerViewProps {
  onBack?: () => void;
}

export function ScreenRulerView({ onBack }: ScreenRulerViewProps) {
  const [unit, setUnit] = useState<'mm' | 'cm' | 'in'>('cm');
  // Pixels per millimeter calibration factor
  // Standard CSS inch is 96 CSS pixels, so 1 mm ≈ 96 / 25.4 ≈ 3.7795 px
  const defaultPpmm = 3.7795;
  const [ppmm, setPpmm] = useState<number>(() => {
    try {
      const stored = localStorage.getItem('ar_ruler_calib_ppmm');
      return stored ? parseFloat(stored) : defaultPpmm;
    } catch {
      return defaultPpmm;
    }
  });

  const [caliperStart, setCaliperStart] = useState<number>(30); // mm from top
  const [caliperEnd, setCaliperEnd] = useState<number>(90);   // mm from top
  const [isCalibrating, setIsCalibrating] = useState<boolean>(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const rulerHeightPx = 600;
  const totalMm = rulerHeightPx / ppmm;

  const currentDistanceMm = Math.abs(caliperEnd - caliperStart);

  const handleSaveCalibration = (newPpmm: number) => {
    setPpmm(newPpmm);
    try {
      localStorage.setItem('ar_ruler_calib_ppmm', newPpmm.toString());
    } catch {
      // ignore
    }
  };

  const handleResetCalibration = () => {
    handleSaveCalibration(defaultPpmm);
    setIsCalibrating(false);
  };

  // Convert distance to current unit string
  const formatMeasured = () => {
    if (unit === 'mm') {
      return `${currentDistanceMm.toFixed(1)} mm`;
    } else if (unit === 'cm') {
      return `${(currentDistanceMm / 10).toFixed(2)} cm`;
    } else {
      return `${(currentDistanceMm / 25.4).toFixed(3)} in`;
    }
  };

  return (
    <div className="relative w-full h-full min-h-[550px] bg-slate-950 flex flex-col select-none overflow-hidden">
      {/* Top Header */}
      <div className="p-4 bg-slate-900/80 border-b border-slate-800 flex items-center justify-between z-10 backdrop-blur-md">
        <div>
          <h2 className="text-base font-bold text-white">Physical On-Screen Ruler</h2>
          <p className="text-xs text-slate-400">Place object directly against screen to measure</p>
        </div>

        <div className="flex items-center gap-2">
          {/* Unit switcher */}
          <div className="flex bg-slate-800 rounded-lg p-0.5 border border-slate-700">
            {(['mm', 'cm', 'in'] as const).map(u => (
              <button
                key={u}
                onClick={() => setUnit(u)}
                className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors ${
                  unit === u ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'
                }`}
              >
                {u}
              </button>
            ))}
          </div>

          <button
            onClick={() => setIsCalibrating(!isCalibrating)}
            title="Calibrate Screen DPI"
            className={`p-2 rounded-lg border transition-colors ${
              isCalibrating ? 'bg-amber-500 text-slate-950 border-amber-400' : 'bg-slate-800 text-slate-300 border-slate-700 hover:text-white'
            }`}
          >
            <Sliders className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Measurement Display */}
      <div className="bg-slate-900/60 border-b border-slate-800/80 py-3 px-4 flex items-center justify-between">
        <div className="flex items-baseline gap-2">
          <span className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Length:</span>
          <span className="text-2xl font-black font-mono-numbers text-amber-400">{formatMeasured()}</span>
        </div>
        <div className="text-xs font-mono-numbers text-slate-400">
          {(currentDistanceMm).toFixed(1)} mm · {(currentDistanceMm / 10).toFixed(2)} cm · {(currentDistanceMm / 25.4).toFixed(2)}"
        </div>
      </div>

      {/* Calibration Drawer (if active) */}
      {isCalibrating && (
        <div className="bg-slate-900 border-b border-slate-800 p-4 z-20 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-white">Manual Calibration</span>
            <span className="text-xs text-slate-400 font-mono-numbers">{ppmm.toFixed(2)} px/mm</span>
          </div>
          <p className="text-[11px] text-slate-400">
            Align a physical credit card (85.6 mm width) or standard coin against the screen ruler and adjust slider until the marks match exactly.
          </p>
          <div className="flex items-center gap-3">
            <input
              type="range"
              min="2.5"
              max="5.5"
              step="0.01"
              value={ppmm}
              onChange={e => handleSaveCalibration(parseFloat(e.target.value))}
              className="flex-1 accent-amber-500"
            />
            <button
              onClick={handleResetCalibration}
              className="text-xs text-slate-400 hover:text-white px-2 py-1 bg-slate-800 rounded-md"
            >
              Reset
            </button>
            <button
              onClick={() => setIsCalibrating(false)}
              className="text-xs bg-amber-500 text-slate-950 font-bold px-3 py-1 rounded-md"
            >
              Done
            </button>
          </div>
        </div>
      )}

      {/* Ruler Surface with Calipers */}
      <div ref={containerRef} className="flex-1 relative bg-slate-950 overflow-hidden flex">
        {/* Left Side: Metric mm/cm Ruler */}
        <div className="w-24 relative border-r border-slate-800 bg-slate-900/40">
          {Array.from({ length: Math.ceil(totalMm) + 1 }).map((_, mm) => {
            const y = mm * ppmm;
            const isCm = mm % 10 === 0;
            const isMid = mm % 5 === 0 && !isCm;

            return (
              <div key={mm} className="absolute left-0 w-full" style={{ top: `${y}px` }}>
                <div
                  className={`absolute right-0 h-[1px] ${
                    isCm ? 'w-10 bg-amber-400' : isMid ? 'w-6 bg-slate-400' : 'w-3.5 bg-slate-600'
                  }`}
                />
                {isCm && (
                  <span className="absolute left-2 -top-2.5 text-[10px] font-mono-numbers font-bold text-slate-300">
                    {mm / 10}
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {/* Center: Caliper measurement region & touch drag handles */}
        <div className="flex-1 relative">
          {/* Caliper active highlight band */}
          <div
            className="absolute left-0 right-0 bg-amber-500/10 border-y border-amber-500/40 pointer-events-none"
            style={{
              top: `${Math.min(caliperStart, caliperEnd) * ppmm}px`,
              height: `${Math.abs(caliperEnd - caliperStart) * ppmm}px`
            }}
          />

          {/* Caliper Start Pin (Drag Handle) */}
          <div
            className="absolute left-2 right-4 h-9 -mt-4.5 flex items-center cursor-ns-resize group"
            style={{ top: `${caliperStart * ppmm}px` }}
          >
            <div className="w-full border-t-2 border-dashed border-emerald-400" />
            <div className="w-7 h-7 rounded-full bg-emerald-500 text-slate-950 font-bold text-[10px] flex items-center justify-center shrink-0 shadow-lg -ml-3">
              1
            </div>
            <input
              type="range"
              min="0"
              max={totalMm}
              value={caliperStart}
              onChange={e => setCaliperStart(parseFloat(e.target.value))}
              className="absolute inset-0 opacity-0 cursor-ns-resize"
            />
          </div>

          {/* Caliper End Pin (Drag Handle) */}
          <div
            className="absolute left-2 right-4 h-9 -mt-4.5 flex items-center cursor-ns-resize group"
            style={{ top: `${caliperEnd * ppmm}px` }}
          >
            <div className="w-full border-t-2 border-dashed border-amber-400" />
            <div className="w-7 h-7 rounded-full bg-amber-500 text-slate-950 font-bold text-[10px] flex items-center justify-center shrink-0 shadow-lg -ml-3">
              2
            </div>
            <input
              type="range"
              min="0"
              max={totalMm}
              value={caliperEnd}
              onChange={e => setCaliperEnd(parseFloat(e.target.value))}
              className="absolute inset-0 opacity-0 cursor-ns-resize"
            />
          </div>

          {/* Helper tag in center */}
          <div
            className="absolute left-6 pointer-events-none bg-slate-900/90 border border-slate-800 rounded-lg px-2.5 py-1 text-xs font-mono-numbers text-white shadow-lg"
            style={{ top: `${((caliperStart + caliperEnd) / 2) * ppmm - 12}px` }}
          >
            {formatMeasured()}
          </div>
        </div>

        {/* Right Side: Inches Ruler (1/16th inch ticks) */}
        <div className="w-20 relative border-l border-slate-800 bg-slate-900/40">
          {Array.from({ length: Math.ceil(totalMm / 25.4) * 16 + 1 }).map((_, idx) => {
            const inches = idx / 16;
            const y = inches * 25.4 * ppmm;
            const isFullInch = idx % 16 === 0;
            const isHalf = idx % 8 === 0 && !isFullInch;
            const isQuarter = idx % 4 === 0 && !isHalf && !isFullInch;

            return (
              <div key={idx} className="absolute right-0 w-full" style={{ top: `${y}px` }}>
                <div
                  className={`absolute left-0 h-[1px] ${
                    isFullInch ? 'w-10 bg-cyan-400' : isHalf ? 'w-6 bg-slate-400' : isQuarter ? 'w-4 bg-slate-500' : 'w-2.5 bg-slate-700'
                  }`}
                />
                {isFullInch && (
                  <span className="absolute right-2 -top-2.5 text-[10px] font-mono-numbers font-bold text-slate-300">
                    {inches}"
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
