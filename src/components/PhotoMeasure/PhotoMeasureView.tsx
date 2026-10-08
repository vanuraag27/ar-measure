import { useState, useRef, useEffect } from 'react';
import { LengthUnit, AppSettings } from '../../types';
import { formatLength } from '../../utils/units';
import { Camera, Upload, Sliders, Check, Download, Trash2, ArrowRight } from 'lucide-react';

interface PhotoLine {
  id: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  isReference?: boolean;
  label?: string;
  realMeters?: number;
}

export function PhotoMeasureView({ settings }: { settings: AppSettings }) {
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [lines, setLines] = useState<PhotoLine[]>([]);
  const [activeDrawingLine, setActiveDrawingLine] = useState<PhotoLine | null>(null);
  const [mode, setMode] = useState<'calibrate' | 'measure'>('calibrate');
  const [referenceLengthMeters, setReferenceLengthMeters] = useState<number>(0.9); // Default 0.9m (e.g. door width)
  const [scalePxPerMeter, setScalePxPerMeter] = useState<number | null>(null);
  const [unit, setUnit] = useState<LengthUnit>(settings.defaultLengthUnit);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);

  // Load sample room image on initial load if none provided
  useEffect(() => {
    // Generate a clean interior architectural perspective on an offscreen canvas
    const sampleCanvas = document.createElement('canvas');
    sampleCanvas.width = 800;
    sampleCanvas.height = 600;
    const ctx = sampleCanvas.getContext('2d');
    if (ctx) {
      // Room background
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(0, 0, 800, 600);

      // Floor
      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.moveTo(0, 420);
      ctx.lineTo(800, 420);
      ctx.lineTo(800, 600);
      ctx.lineTo(0, 600);
      ctx.fill();

      // Door (Reference object 0.9m x 2.1m)
      ctx.fillStyle = '#334155';
      ctx.fillRect(120, 160, 140, 260);
      ctx.strokeStyle = '#64748b';
      ctx.lineWidth = 4;
      ctx.strokeRect(120, 160, 140, 260);

      // Door handle
      ctx.fillStyle = '#f59e0b';
      ctx.beginPath();
      ctx.arc(245, 300, 5, 0, Math.PI * 2);
      ctx.fill();

      // Window
      ctx.fillStyle = '#38bdf8';
      ctx.fillRect(360, 180, 220, 160);
      ctx.strokeStyle = '#cbd5e1';
      ctx.lineWidth = 4;
      ctx.strokeRect(360, 180, 220, 160);

      // Table
      ctx.fillStyle = '#475569';
      ctx.fillRect(340, 360, 320, 25);
      ctx.fillRect(370, 385, 20, 80);
      ctx.fillRect(630, 385, 20, 80);

      const url = sampleCanvas.toDataURL('image/jpeg');
      setImageSrc(url);
    }
  }, []);

  // When imageSrc updates, create HTMLImageElement
  useEffect(() => {
    if (!imageSrc) return;
    const img = new Image();
    img.src = imageSrc;
    img.onload = () => {
      imgRef.current = img;
      redraw();
    };
  }, [imageSrc]);

  // Redraw canvas with image and measurement lines
  const redraw = () => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img) return;

    canvas.width = canvas.parentElement?.clientWidth || 800;
    canvas.height = canvas.parentElement?.clientHeight || 600;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw scaled image to fit
    const aspect = img.width / img.height;
    let drawW = canvas.width;
    let drawH = canvas.width / aspect;
    if (drawH > canvas.height) {
      drawH = canvas.height;
      drawW = canvas.height * aspect;
    }
    const drawX = (canvas.width - drawW) / 2;
    const drawY = (canvas.height - drawH) / 2;

    ctx.drawImage(img, drawX, drawY, drawW, drawH);

    // Draw all lines
    const allLines = activeDrawingLine ? [...lines, activeDrawingLine] : lines;

    allLines.forEach((ln, idx) => {
      const isRef = ln.isReference;
      const color = isRef ? '#10b981' : '#f59e0b';

      ctx.strokeStyle = color;
      ctx.lineWidth = 2.5;

      // Line
      ctx.beginPath();
      ctx.moveTo(ln.x1, ln.y1);
      ctx.lineTo(ln.x2, ln.y2);
      ctx.stroke();

      // End caps
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(ln.x1, ln.y1, 6, 0, Math.PI * 2);
      ctx.arc(ln.x2, ln.y2, 6, 0, Math.PI * 2);
      ctx.fill();

      // Calculate length in pixels
      const dx = ln.x2 - ln.x1;
      const dy = ln.y2 - ln.y1;
      const distPx = Math.sqrt(dx * dx + dy * dy);

      // Label
      let text = '';
      if (isRef) {
        text = `REF: ${referenceLengthMeters.toFixed(2)}m`;
      } else if (scalePxPerMeter) {
        const meters = distPx / scalePxPerMeter;
        text = formatLength(meters, unit);
      } else {
        text = `${Math.round(distPx)}px (uncalibrated)`;
      }

      const midX = (ln.x1 + ln.x2) / 2;
      const midY = (ln.y1 + ln.y2) / 2;

      ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
      ctx.strokeStyle = color;
      ctx.lineWidth = 1;
      const textW = ctx.measureText(text).width + 16;
      ctx.beginPath();
      ctx.roundRect(midX - textW / 2, midY - 14, textW, 22, 6);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 11px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, midX, midY - 3);
    });
  };

  useEffect(() => {
    redraw();
  }, [lines, activeDrawingLine, scalePxPerMeter, unit]);

  // Pointer drawing handlers
  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    setActiveDrawingLine({
      id: `line_${Date.now()}`,
      x1: x,
      y1: y,
      x2: x,
      y2: y,
      isReference: mode === 'calibrate'
    });
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!activeDrawingLine) return;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    setActiveDrawingLine(prev => (prev ? { ...prev, x2: x, y2: y } : null));
  };

  const handlePointerUp = () => {
    if (!activeDrawingLine) return;

    const dx = activeDrawingLine.x2 - activeDrawingLine.x1;
    const dy = activeDrawingLine.y2 - activeDrawingLine.y1;
    const distPx = Math.sqrt(dx * dx + dy * dy);

    if (distPx > 10) {
      if (mode === 'calibrate') {
        const newScale = distPx / referenceLengthMeters;
        setScalePxPerMeter(newScale);
        setLines(prev => [...prev.filter(l => !l.isReference), { ...activeDrawingLine, isReference: true }]);
        setMode('measure');
      } else {
        setLines(prev => [...prev, activeDrawingLine]);
      }
    }
    setActiveDrawingLine(null);
  };

  // Upload custom photo
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = evt => {
      if (typeof evt.target?.result === 'string') {
        setImageSrc(evt.target.result);
        setLines([]);
        setScalePxPerMeter(null);
        setMode('calibrate');
      }
    };
    reader.readAsDataURL(file);
  };

  // Download annotated image
  const handleDownload = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const url = canvas.toDataURL('image/jpeg', 0.95);
    const link = document.createElement('a');
    link.download = `Photo_Measurement_${Date.now()}.jpg`;
    link.href = url;
    link.click();
  };

  return (
    <div className="relative w-full h-full min-h-[550px] bg-slate-950 flex flex-col select-none overflow-hidden">
      {/* Top Header */}
      <div className="p-3 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between z-10 backdrop-blur-md">
        <div>
          <h2 className="text-sm font-bold text-white">Photo Measure</h2>
          <p className="text-[11px] text-slate-400">
            {mode === 'calibrate'
              ? 'Draw a line over known object (e.g. door width) to calibrate'
              : 'Draw lines to measure objects at scale'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Hidden File Input */}
          <input
            type="file"
            ref={fileInputRef}
            accept="image/*"
            onChange={handleFileUpload}
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg text-xs font-medium border border-slate-700 flex items-center gap-1.5 transition-colors"
          >
            <Upload className="w-3.5 h-3.5" />
            Upload Photo
          </button>

          <button
            onClick={() => setLines([])}
            title="Clear all lines"
            className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-rose-400 rounded-lg border border-slate-700 transition-colors"
          >
            <Trash2 className="w-4 h-4" />
          </button>

          <button
            onClick={handleDownload}
            title="Save annotated image"
            className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg text-xs flex items-center gap-1.5 shadow-md transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            Export
          </button>
        </div>
      </div>

      {/* Mode & Scale Bar */}
      <div className="px-4 py-2 bg-slate-900/60 border-b border-slate-800/80 flex items-center justify-between text-xs">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setMode('calibrate')}
            className={`px-3 py-1 rounded-lg font-medium transition-colors ${
              mode === 'calibrate' ? 'bg-emerald-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'
            }`}
          >
            1. Calibrate Scale
          </button>
          <ArrowRight className="w-3.5 h-3.5 text-slate-600" />
          <button
            onClick={() => {
              if (!scalePxPerMeter) {
                alert('Please draw a reference line first to calibrate the scale.');
                return;
              }
              setMode('measure');
            }}
            className={`px-3 py-1 rounded-lg font-medium transition-colors ${
              mode === 'measure' ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'
            }`}
          >
            2. Measure Objects
          </button>
        </div>

        {mode === 'calibrate' && (
          <div className="flex items-center gap-2">
            <span className="text-slate-400">Ref Size:</span>
            <input
              type="number"
              step="0.05"
              min="0.1"
              value={referenceLengthMeters}
              onChange={e => setReferenceLengthMeters(Math.max(0.05, parseFloat(e.target.value) || 0.9))}
              className="w-16 px-2 py-0.5 bg-slate-950 border border-slate-700 rounded text-center font-mono-numbers text-amber-400"
            />
            <span className="text-slate-400">m</span>
          </div>
        )}
      </div>

      {/* Canvas Area */}
      <div className="flex-1 relative bg-black flex items-center justify-center overflow-hidden">
        <canvas
          ref={canvasRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          className="w-full h-full touch-none cursor-crosshair"
        />
      </div>
    </div>
  );
}
