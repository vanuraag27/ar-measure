import { useState, useRef, useEffect, useCallback } from 'react';
import { RoomRecord, FurnitureItem, WallSegment, AppSettings } from '../../types';
import { formatLength, formatArea, LENGTH_CONVERSIONS } from '../../utils/units';
import { MaterialEstimatorModal } from './MaterialEstimatorModal';
import { 
  Plus, Trash2, RotateCw, Download, 
  ZoomIn, ZoomOut, Move, Square, Bed, Sofa, Tv, 
  UtensilsCrossed, Bath, Check, Calculator,
  Undo2, Redo2, History, Building2, Sliders, Layers,
  CornerDownLeft, Copy, Armchair, Refrigerator, ShowerHead, DoorOpen, AppWindow,
  List, ChevronDown, RotateCcw
} from 'lucide-react';

interface FloorPlanner2DProps {
  room: RoomRecord;
  settings: AppSettings;
  onUpdateRoom: (updated: RoomRecord) => void;
  onOpen3D?: () => void;
}

interface HistoryEntry {
  room: RoomRecord;
  description: string;
  timestamp: number;
}

type DragTarget = 
  | { type: 'furniture'; id: string }
  | { type: 'wall_handle'; handle: 'east' | 'south' | 'corner_se' | 'north' | 'west' }
  | { type: 'partition_wall'; id: string; part: 'body' | 'start' | 'end' }
  | null;

const FURNITURE_CATALOG: { type: FurnitureItem['type']; name: string; width: number; depth: number; height: number; icon: React.ReactNode; color: string }[] = [
  { type: 'sofa', name: '3-Seater Sofa', width: 2.2, depth: 0.9, height: 0.85, icon: <Sofa className="w-4 h-4" />, color: '#475569' },
  { type: 'bed', name: 'King Bed', width: 1.95, depth: 2.15, height: 0.95, icon: <Bed className="w-4 h-4" />, color: '#6366f1' },
  { type: 'bed', name: 'Single Bed', width: 1.0, depth: 2.0, height: 0.6, icon: <Bed className="w-4 h-4" />, color: '#818cf8' },
  { type: 'dining_table', name: 'Dining Table', width: 1.6, depth: 0.9, height: 0.75, icon: <UtensilsCrossed className="w-4 h-4" />, color: '#0f766e' },
  { type: 'chair', name: 'Chair', width: 0.5, depth: 0.5, height: 0.9, icon: <Armchair className="w-4 h-4" />, color: '#a16207' },
  { type: 'desk', name: 'Work Desk', width: 1.4, depth: 0.7, height: 0.75, icon: <Square className="w-4 h-4" />, color: '#92400e' },
  { type: 'wardrobe', name: 'Wardrobe', width: 1.8, depth: 0.6, height: 2.2, icon: <Square className="w-4 h-4" />, color: '#334155' },
  { type: 'tv_unit', name: 'TV Media Console', width: 1.8, depth: 0.45, height: 0.5, icon: <Tv className="w-4 h-4" />, color: '#64748b' },
  { type: 'refrigerator', name: 'Refrigerator', width: 0.75, depth: 0.7, height: 1.8, icon: <Refrigerator className="w-4 h-4" />, color: '#94a3b8' },
  { type: 'kitchen_counter', name: 'Kitchen Counter', width: 2.4, depth: 0.65, height: 0.9, icon: <Square className="w-4 h-4" />, color: '#0f766e' },
  { type: 'bathtub', name: 'Bathtub', width: 1.7, depth: 0.75, height: 0.6, icon: <Bath className="w-4 h-4" />, color: '#0284c7' },
  { type: 'shower', name: 'Shower', width: 0.9, depth: 0.9, height: 2.1, icon: <ShowerHead className="w-4 h-4" />, color: '#0ea5e9' },
  { type: 'toilet', name: 'Toilet', width: 0.45, depth: 0.65, height: 0.8, icon: <Bath className="w-4 h-4" />, color: '#38bdf8' },
  { type: 'door', name: 'Door', width: 0.9, depth: 0.12, height: 2.1, icon: <DoorOpen className="w-4 h-4" />, color: '#b45309' },
  { type: 'window', name: 'Window', width: 1.2, depth: 0.12, height: 1.2, icon: <AppWindow className="w-4 h-4" />, color: '#7dd3fc' },
];

export function FloorPlanner2D({ room, settings, onUpdateRoom, onOpen3D }: FloorPlanner2DProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Undo / Redo Stacks
  const [undoStack, setUndoStack] = useState<HistoryEntry[]>([]);
  const [redoStack, setRedoStack] = useState<HistoryEntry[]>([]);
  const [showHistoryModal, setShowHistoryModal] = useState(false);

  // Selection & Interaction State
  const [selectedFurnitureId, setSelectedFurnitureId] = useState<string | null>(null);
  const [selectedWallId, setSelectedWallId] = useState<string | null>(null);
  const [dragTarget, setDragTarget] = useState<DragTarget>(null);
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [dragInitialRoom, setDragInitialRoom] = useState<RoomRecord | null>(null);
  const [hoveredWallHandle, setHoveredWallHandle] = useState<'east' | 'south' | 'corner_se' | 'north' | 'west' | null>(null);

  // Canvas Viewport Transform
  const [scale, setScale] = useState<number>(60); // pixels per meter
  const [offset, setOffset] = useState<{ x: number; y: number }>({ x: 80, y: 80 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [activeScalePreset, setActiveScalePreset] = useState<'1:20' | '1:50' | '1:100' | 'fit'>('fit');

  const [containerSize, setContainerSize] = useState({ w: 0, h: 0 });
  const [showItemsList, setShowItemsList] = useState(false);

  // Modals & Panels
  const [showCatalog, setShowCatalog] = useState(false);
  const [showMaterialEstimator, setShowMaterialEstimator] = useState(false);
  const [showWallSettingsModal, setShowWallSettingsModal] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const toastTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Structural Wall Edit Inputs for Modal
  const [modalWallLength, setModalWallLength] = useState<string>(room.length.toString());
  const [modalWallWidth, setModalWallWidth] = useState<string>(room.width.toString());
  const [modalWallHeight, setModalWallHeight] = useState<string>((room.height || 2.7).toString());

  // Show transient toast
  const showToast = useCallback((msg: string) => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    setToastMessage(msg);
    toastTimeoutRef.current = setTimeout(() => {
      setToastMessage(null);
    }, 2800);
  }, []);

  // Track room ID to reset undo/redo when switching rooms
  const currentRoomIdRef = useRef(room.id);
  useEffect(() => {
    if (currentRoomIdRef.current !== room.id) {
      currentRoomIdRef.current = room.id;
      setUndoStack([]);
      setRedoStack([]);
      setSelectedFurnitureId(null);
      setSelectedWallId(null);
    }
  }, [room.id]);

  // Push record to undo stack
  const pushHistory = useCallback((previousRoom: RoomRecord, description: string) => {
    setUndoStack(prev => {
      const entry: HistoryEntry = {
        room: JSON.parse(JSON.stringify(previousRoom)),
        description,
        timestamp: Date.now(),
      };
      const updated = [...prev, entry];
      return updated.length > 50 ? updated.slice(updated.length - 50) : updated;
    });
    setRedoStack([]); // Clear redo stack on new action
  }, []);

  // Handle Undo
  const handleUndo = useCallback(() => {
    if (undoStack.length === 0) return;
    const lastEntry = undoStack[undoStack.length - 1];
    const newUndoStack = undoStack.slice(0, -1);

    const currentSnapshot: HistoryEntry = {
      room: JSON.parse(JSON.stringify(room)),
      description: lastEntry.description,
      timestamp: Date.now(),
    };

    setRedoStack(prev => [...prev, currentSnapshot]);
    setUndoStack(newUndoStack);
    onUpdateRoom(lastEntry.room);
    showToast(`Reverted: ${lastEntry.description}`);
  }, [undoStack, room, onUpdateRoom, showToast]);

  // Handle Redo
  const handleRedo = useCallback(() => {
    if (redoStack.length === 0) return;
    const nextEntry = redoStack[redoStack.length - 1];
    const newRedoStack = redoStack.slice(0, -1);

    const currentSnapshot: HistoryEntry = {
      room: JSON.parse(JSON.stringify(room)),
      description: nextEntry.description,
      timestamp: Date.now(),
    };

    setUndoStack(prev => [...prev, currentSnapshot]);
    setRedoStack(newRedoStack);
    onUpdateRoom(nextEntry.room);
    showToast(`Redid: ${nextEntry.description}`);
  }, [redoStack, room, onUpdateRoom, showToast]);

  // Keyboard shortcut listener (Ctrl+Z / Cmd+Z for Undo, Ctrl+Y / Cmd+Shift+Z for Redo)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        (e.target as HTMLElement)?.isContentEditable
      ) {
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          handleRedo();
        } else {
          handleUndo();
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        handleRedo();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleUndo, handleRedo]);

  // Track the canvas area size (orientation changes, panels opening/closing)
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setContainerSize({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    setContainerSize({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  // Auto-fit to viewport on mount, room change, or first real size
  const fitReadyRef = useRef(false);
  useEffect(() => {
    const w = containerSize.w, h = containerSize.h;
    if (w < 50 || h < 50) return;
    const fitScale = Math.max(15, Math.min(120, Math.min((w - 110) / Math.max(1, room.length), (h - 100) / Math.max(1, room.width))));
    setScale(fitScale);
    setOffset({ x: (w - room.length * fitScale) / 2, y: (h - room.width * fitScale) / 2 + 8 });
    fitReadyRef.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room.id, room.length, room.width, containerSize.w > 50 && containerSize.h > 50]);

  // Scale presets
  const handleScalePreset = (preset: '1:20' | '1:50' | '1:100' | 'fit') => {
    setActiveScalePreset(preset);
    if (!containerRef.current) return;
    const w = containerRef.current.clientWidth;
    const h = containerRef.current.clientHeight;

    if (preset === 'fit') {
      const fitScale = Math.max(15, Math.min(120, Math.min((w - 110) / Math.max(1, room.length), (h - 100) / Math.max(1, room.width))));
      setScale(fitScale);
      setOffset({
        x: (w - room.length * fitScale) / 2,
        y: (h - room.width * fitScale) / 2 + 8
      });
    } else if (preset === '1:20') {
      setScale(95);
    } else if (preset === '1:50') {
      setScale(55);
    } else if (preset === '1:100') {
      setScale(30);
    }
  };

  // Canvas drawing
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !containerRef.current) return;

    canvas.width = containerRef.current.clientWidth;
    canvas.height = containerRef.current.clientHeight;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear background
    ctx.fillStyle = '#090d16';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Architectural Grid (1m major, 0.2m minor)
    const gridSize = scale;
    const subGridSize = scale / 5;

    // Minor lines
    ctx.strokeStyle = '#111827';
    ctx.lineWidth = 0.5;
    const startX = offset.x % subGridSize;
    const startY = offset.y % subGridSize;
    for (let x = startX; x < canvas.width; x += subGridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height);
      ctx.stroke();
    }
    for (let y = startY; y < canvas.height; y += subGridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
      ctx.stroke();
    }

    // Major meter lines
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1;
    const mStartX = offset.x % gridSize;
    const mStartY = offset.y % gridSize;
    for (let x = mStartX; x < canvas.width; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height);
      ctx.stroke();
    }
    for (let y = mStartY; y < canvas.height; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
      ctx.stroke();
    }

    // Room boundaries
    const originX = offset.x;
    const originY = offset.y;
    const rPixelWidth = room.length * scale;
    const rPixelHeight = room.width * scale;

    // Room Floor
    ctx.fillStyle = 'rgba(30, 41, 59, 0.45)';
    ctx.fillRect(originX, originY, rPixelWidth, rPixelHeight);

    // Structural Perimeter Walls (Thick double-line architectural style)
    ctx.strokeStyle = '#f8fafc';
    ctx.lineWidth = 5;
    ctx.strokeRect(originX, originY, rPixelWidth, rPixelHeight);

    // Inner line for double-wall
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(originX + 3, originY + 3, rPixelWidth - 6, rPixelHeight - 6);

    // Dimension Lines
    const dimColor = '#f59e0b';
    ctx.strokeStyle = dimColor;
    ctx.fillStyle = dimColor;
    ctx.lineWidth = 1.5;
    ctx.font = '11px "JetBrains Mono", monospace';

    // Top Width Dimension Line (Room Length)
    const dimY = originY - 18;
    ctx.beginPath();
    ctx.moveTo(originX, dimY);
    ctx.lineTo(originX + rPixelWidth, dimY);
    ctx.moveTo(originX, dimY - 4);
    ctx.lineTo(originX, dimY + 4);
    ctx.moveTo(originX + rPixelWidth, dimY - 4);
    ctx.lineTo(originX + rPixelWidth, dimY + 4);
    ctx.stroke();
    const lenText = formatLength(room.length, settings.defaultLengthUnit);
    ctx.textAlign = 'center';
    ctx.fillText(lenText, originX + rPixelWidth / 2, dimY - 6);

    // Left Height Dimension Line (Room Width)
    const dimX = originX - 18;
    ctx.beginPath();
    ctx.moveTo(dimX, originY);
    ctx.lineTo(dimX, originY + rPixelHeight);
    ctx.moveTo(dimX - 4, originY);
    ctx.lineTo(dimX + 4, originY);
    ctx.moveTo(dimX - 4, originY + rPixelHeight);
    ctx.lineTo(dimX + 4, originY + rPixelHeight);
    ctx.stroke();
    const widText = formatLength(room.width, settings.defaultLengthUnit);
    ctx.save();
    ctx.translate(dimX - 8, originY + rPixelHeight / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.textAlign = 'center';
    ctx.fillText(widText, 0, 0);
    ctx.restore();

    // Structural Wall Resizing Handles (Grips on edges)
    // 1. East Wall Handle (Resizes length)
    const eastHandleX = originX + rPixelWidth;
    const eastHandleY = originY + rPixelHeight / 2;
    const isEastActive = hoveredWallHandle === 'east' || (dragTarget?.type === 'wall_handle' && dragTarget.handle === 'east');
    ctx.fillStyle = isEastActive ? '#f59e0b' : '#38bdf8';
    ctx.beginPath();
    ctx.roundRect(eastHandleX - 4, eastHandleY - 18, 8, 36, 4);
    ctx.fill();
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 1;
    ctx.stroke();

    // 2. South Wall Handle (Resizes width)
    const southHandleX = originX + rPixelWidth / 2;
    const southHandleY = originY + rPixelHeight;
    const isSouthActive = hoveredWallHandle === 'south' || (dragTarget?.type === 'wall_handle' && dragTarget.handle === 'south');
    ctx.fillStyle = isSouthActive ? '#f59e0b' : '#38bdf8';
    ctx.beginPath();
    ctx.roundRect(southHandleX - 18, southHandleY - 4, 36, 8, 4);
    ctx.fill();
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 1;
    ctx.stroke();

    // 3. South-East Corner Handle (Resizes both length & width)
    const cornerX = originX + rPixelWidth;
    const cornerY = originY + rPixelHeight;
    const isCornerActive = hoveredWallHandle === 'corner_se' || (dragTarget?.type === 'wall_handle' && dragTarget.handle === 'corner_se');
    ctx.fillStyle = isCornerActive ? '#f59e0b' : '#38bdf8';
    ctx.beginPath();
    ctx.arc(cornerX, cornerY, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Structural Interior Partition Walls
    (room.walls || []).forEach(wall => {
      const wx1 = originX + wall.startX * scale;
      const wy1 = originY + wall.startY * scale;
      const wx2 = originX + wall.endX * scale;
      const wy2 = originY + wall.endY * scale;
      const isSelected = wall.id === selectedWallId;

      ctx.save();
      // Thick structural line
      ctx.strokeStyle = isSelected ? '#38bdf8' : '#e2e8f0';
      ctx.lineWidth = Math.max(4, (wall.thickness || 0.15) * scale);
      ctx.lineCap = 'square';
      ctx.beginPath();
      ctx.moveTo(wx1, wy1);
      ctx.lineTo(wx2, wy2);
      ctx.stroke();

      // Inner architectural core line
      ctx.strokeStyle = isSelected ? '#0284c7' : '#64748b';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // End-point caps
      ctx.fillStyle = isSelected ? '#38bdf8' : '#94a3b8';
      ctx.beginPath();
      ctx.arc(wx1, wy1, isSelected ? 5 : 3, 0, Math.PI * 2);
      ctx.arc(wx2, wy2, isSelected ? 5 : 3, 0, Math.PI * 2);
      ctx.fill();

      // Wall Length Label
      const wallLen = Math.hypot(wall.endX - wall.startX, wall.endY - wall.startY);
      const midX = (wx1 + wx2) / 2;
      const midY = (wy1 + wy2) / 2;
      ctx.fillStyle = isSelected ? '#38bdf8' : '#cbd5e1';
      ctx.font = '10px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillText(formatLength(wallLen, settings.defaultLengthUnit), midX, midY - 8);

      ctx.restore();
    });

    // Room label (top-left inside the room so furniture never covers it)
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.font = 'bold 12px "Cabinet Grotesk", sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(room.name.toUpperCase(), originX + 10, originY + 20, Math.max(40, rPixelWidth - 20));
    ctx.fillStyle = '#94a3b8';
    ctx.font = '10px "JetBrains Mono", monospace';
    ctx.fillText(formatArea(room.area, settings.defaultAreaUnit), originX + 10, originY + 34, Math.max(40, rPixelWidth - 20));

    // Furniture Items
    (room.furniture || []).forEach(item => {
      const fx = originX + item.x * scale;
      const fy = originY + item.y * scale;
      const fw = item.width * scale;
      const fd = item.depth * scale;
      const isSelected = item.id === selectedFurnitureId;

      ctx.save();
      ctx.translate(fx, fy);
      ctx.rotate((item.rotation * Math.PI) / 180);

      // Box body
      ctx.fillStyle = isSelected ? '#3b82f6' : (item.color || '#475569');
      ctx.strokeStyle = isSelected ? '#60a5fa' : '#94a3b8';
      ctx.lineWidth = isSelected ? 2 : 1;

      ctx.fillRect(-fw / 2, -fd / 2, fw, fd);
      ctx.strokeRect(-fw / 2, -fd / 2, fw, fd);

      // Label inside furniture (counter-rotated so text is never upside-down)
      ctx.save();
      ctx.rotate(-(item.rotation * Math.PI) / 180);
      ctx.fillStyle = '#ffffff';
      ctx.font = '10px "Plus Jakarta Sans", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(item.name, 0, 0, Math.max(30, Math.max(fw, fd) - 4));
      ctx.restore();

      // Selection marker + live size label
      if (isSelected) {
        ctx.fillStyle = '#f59e0b';
        ctx.beginPath();
        ctx.arc(0, -fd / 2 - 12, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.rotate(-(item.rotation * Math.PI) / 180);
        ctx.font = '10px "JetBrains Mono", monospace';
        ctx.fillStyle = '#fde68a';
        ctx.fillText(`${formatLength(item.width, settings.defaultLengthUnit)} × ${formatLength(item.depth, settings.defaultLengthUnit)}`, 0, Math.max(fw, fd) / 2 + 14);
      }

      ctx.restore();
    });

    // Graphic Scale Bar at bottom left
    const sbarX = 24;
    const sbarY = canvas.height - 30;
    const isImperial = settings.unitSystem === 'imperial';
    const scaleBarMeters = isImperial ? 0.9144 : 1.0; // 3 feet (1 yard) or 1 meter
    const scaleBarPixels = scaleBarMeters * scale;
    const scaleLabel = isImperial ? '3 ft' : '1.0m';

    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(sbarX, sbarY);
    ctx.lineTo(sbarX + scaleBarPixels, sbarY);
    ctx.moveTo(sbarX, sbarY - 4);
    ctx.lineTo(sbarX, sbarY + 4);
    ctx.moveTo(sbarX + scaleBarPixels, sbarY - 4);
    ctx.lineTo(sbarX + scaleBarPixels, sbarY + 4);
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.font = '10px "JetBrains Mono", monospace';
    ctx.textAlign = 'left';
    ctx.fillText('0', sbarX - 2, sbarY - 7);
    ctx.textAlign = 'right';
    ctx.fillText(scaleLabel, sbarX + scaleBarPixels + 2, sbarY - 7);
    ctx.textAlign = 'left';
    ctx.fillText(`Scale: ${activeScalePreset}`, sbarX + scaleBarPixels + 15, sbarY + 3);

  }, [room, scale, offset, selectedFurnitureId, selectedWallId, settings, activeScalePreset, hoveredWallHandle, dragTarget, containerSize]);

  // Pointer interactions: drag furniture, resize walls, drag partition walls, or pan canvas
  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* ignore */ }

    const originX = offset.x;
    const originY = offset.y;
    const rPixelWidth = room.length * scale;
    const rPixelHeight = room.width * scale;

    // Snapshot current room before any drag operation starts (for undo tracking on release)
    setDragInitialRoom(JSON.parse(JSON.stringify(room)));

    // 1. Check Hit on Wall Handles:
    // South-East Corner
    if (Math.hypot(mouseX - (originX + rPixelWidth), mouseY - (originY + rPixelHeight)) <= 14) {
      setDragTarget({ type: 'wall_handle', handle: 'corner_se' });
      setSelectedFurnitureId(null);
      setSelectedWallId(null);
      return;
    }
    // East Wall Handle
    if (
      Math.abs(mouseX - (originX + rPixelWidth)) <= 12 &&
      Math.abs(mouseY - (originY + rPixelHeight / 2)) <= 24
    ) {
      setDragTarget({ type: 'wall_handle', handle: 'east' });
      setSelectedFurnitureId(null);
      setSelectedWallId(null);
      return;
    }
    // South Wall Handle
    if (
      Math.abs(mouseX - (originX + rPixelWidth / 2)) <= 24 &&
      Math.abs(mouseY - (originY + rPixelHeight)) <= 12
    ) {
      setDragTarget({ type: 'wall_handle', handle: 'south' });
      setSelectedFurnitureId(null);
      setSelectedWallId(null);
      return;
    }

    // 2. Check Hit on Partition Walls:
    let clickedWall: { wall: WallSegment; part: 'body' | 'start' | 'end' } | null = null;
    for (const w of room.walls || []) {
      const wx1 = originX + w.startX * scale;
      const wy1 = originY + w.startY * scale;
      const wx2 = originX + w.endX * scale;
      const wy2 = originY + w.endY * scale;

      // Start handle
      if (Math.hypot(mouseX - wx1, mouseY - wy1) <= 10) {
        clickedWall = { wall: w, part: 'start' };
        break;
      }
      // End handle
      if (Math.hypot(mouseX - wx2, mouseY - wy2) <= 10) {
        clickedWall = { wall: w, part: 'end' };
        break;
      }
      // Line body distance
      const l2 = Math.hypot(wx2 - wx1, wy2 - wy1) ** 2;
      if (l2 > 0) {
        const t = Math.max(0, Math.min(1, ((mouseX - wx1) * (wx2 - wx1) + (mouseY - wy1) * (wy2 - wy1)) / l2));
        const projX = wx1 + t * (wx2 - wx1);
        const projY = wy1 + t * (wy2 - wy1);
        if (Math.hypot(mouseX - projX, mouseY - projY) <= 10) {
          clickedWall = { wall: w, part: 'body' };
          break;
        }
      }
    }

    if (clickedWall) {
      setSelectedWallId(clickedWall.wall.id);
      setSelectedFurnitureId(null);
      setDragTarget({ type: 'partition_wall', id: clickedWall.wall.id, part: clickedWall.part });
      setDragOffset({
        x: mouseX - (originX + clickedWall.wall.startX * scale),
        y: mouseY - (originY + clickedWall.wall.startY * scale)
      });
      return;
    }

    // 3. Check Hit on Furniture:
    let clickedFurniture: FurnitureItem | null = null;
    for (let i = (room.furniture || []).length - 1; i >= 0; i--) {
      const f = room.furniture[i];
      const fx = originX + f.x * scale;
      const fy = originY + f.y * scale;
      // generous touch target (min 14 px half-size) and rotation-aware
      const fw = Math.max(14, (f.width * scale) / 2);
      const fd = Math.max(14, (f.depth * scale) / 2);
      const rad = (-f.rotation * Math.PI) / 180;
      const lx = (mouseX - fx) * Math.cos(rad) - (mouseY - fy) * Math.sin(rad);
      const ly = (mouseX - fx) * Math.sin(rad) + (mouseY - fy) * Math.cos(rad);

      if (Math.abs(lx) <= fw && Math.abs(ly) <= fd) {
        clickedFurniture = f;
        break;
      }
    }

    if (clickedFurniture) {
      setSelectedFurnitureId(clickedFurniture.id);
      setSelectedWallId(null);
      setDragTarget({ type: 'furniture', id: clickedFurniture.id });
      setDragOffset({
        x: mouseX - (originX + clickedFurniture.x * scale),
        y: mouseY - (originY + clickedFurniture.y * scale)
      });
      return;
    }

    // 4. Default: Pan Canvas
    setSelectedFurnitureId(null);
    setSelectedWallId(null);
    setIsPanning(true);
    setPanStart({ x: e.clientX - offset.x, y: e.clientY - offset.y });
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const originX = offset.x;
    const originY = offset.y;
    const rPixelWidth = room.length * scale;
    const rPixelHeight = room.width * scale;

    // Hover handle detection for cursor feedback
    if (!dragTarget && !isPanning) {
      if (Math.hypot(mouseX - (originX + rPixelWidth), mouseY - (originY + rPixelHeight)) <= 14) {
        setHoveredWallHandle('corner_se');
      } else if (
        Math.abs(mouseX - (originX + rPixelWidth)) <= 12 &&
        Math.abs(mouseY - (originY + rPixelHeight / 2)) <= 24
      ) {
        setHoveredWallHandle('east');
      } else if (
        Math.abs(mouseX - (originX + rPixelWidth / 2)) <= 24 &&
        Math.abs(mouseY - (originY + rPixelHeight)) <= 12
      ) {
        setHoveredWallHandle('south');
      } else {
        setHoveredWallHandle(null);
      }
    }

    // Drag Furniture
    if (dragTarget?.type === 'furniture') {
      const dragged = (room.furniture || []).find(f => f.id === dragTarget.id);
      const margin = dragged && (dragged.type === 'door' || dragged.type === 'window') ? 0 : 0.2;
      const newMetersX = Math.max(margin, Math.min(room.length - margin, (mouseX - offset.x - dragOffset.x) / scale));
      const newMetersY = Math.max(margin, Math.min(room.width - margin, (mouseY - offset.y - dragOffset.y) / scale));

      const updated = (room.furniture || []).map(f => {
        if (f.id === dragTarget.id) {
          return { ...f, x: Number(newMetersX.toFixed(2)), y: Number(newMetersY.toFixed(2)) };
        }
        return f;
      });
      onUpdateRoom({ ...room, furniture: updated });
    } 
    // Drag Structural Perimeter Wall Handles (Resizing Room Dimensions)
    else if (dragTarget?.type === 'wall_handle') {
      let newLength = room.length;
      let newWidth = room.width;

      if (dragTarget.handle === 'east' || dragTarget.handle === 'corner_se') {
        const rawMetersL = (mouseX - originX) / scale;
        // Snap to 0.05m increments
        newLength = Math.max(1.5, Math.min(25.0, Math.round(rawMetersL * 20) / 20));
      }

      if (dragTarget.handle === 'south' || dragTarget.handle === 'corner_se') {
        const rawMetersW = (mouseY - originY) / scale;
        // Snap to 0.05m increments
        newWidth = Math.max(1.5, Math.min(25.0, Math.round(rawMetersW * 20) / 20));
      }

      const area = Number((newLength * newWidth).toFixed(2));
      const perimeter = Number((2 * (newLength + newWidth)).toFixed(2));
      const corners = [
        { x: 0, y: 0 },
        { x: newLength, y: 0 },
        { x: newLength, y: newWidth },
        { x: 0, y: newWidth }
      ];

      // Keep furniture inside resized boundaries
      const clampedFurniture = (room.furniture || []).map(f => ({
        ...f,
        x: Math.max(0.2, Math.min(newLength - 0.2, f.x)),
        y: Math.max(0.2, Math.min(newWidth - 0.2, f.y))
      }));

      onUpdateRoom({
        ...room,
        length: newLength,
        width: newWidth,
        area,
        perimeter,
        corners,
        furniture: clampedFurniture
      });
    }
    // Drag Partition Walls
    else if (dragTarget?.type === 'partition_wall') {
      const curWall = (room.walls || []).find(w => w.id === dragTarget.id);
      if (!curWall) return;

      const snapX = (px: number) => Math.max(0, Math.min(room.length, Math.round(((px - originX) / scale) * 20) / 20));
      const snapY = (py: number) => Math.max(0, Math.min(room.width, Math.round(((py - originY) / scale) * 20) / 20));

      let updatedWall: WallSegment = { ...curWall };
      if (dragTarget.part === 'start') {
        updatedWall.startX = snapX(mouseX);
        updatedWall.startY = snapY(mouseY);
      } else if (dragTarget.part === 'end') {
        updatedWall.endX = snapX(mouseX);
        updatedWall.endY = snapY(mouseY);
      } else {
        // Move whole wall
        const wallDx = curWall.endX - curWall.startX;
        const wallDy = curWall.endY - curWall.startY;
        const newStartX = snapX(mouseX - dragOffset.x);
        const newStartY = snapY(mouseY - dragOffset.y);
        updatedWall.startX = newStartX;
        updatedWall.startY = newStartY;
        updatedWall.endX = Number((newStartX + wallDx).toFixed(2));
        updatedWall.endY = Number((newStartY + wallDy).toFixed(2));
      }

      const updatedWalls = (room.walls || []).map(w => w.id === curWall.id ? updatedWall : w);
      onUpdateRoom({ ...room, walls: updatedWalls });
    }
    // Pan Viewport
    else if (isPanning) {
      setOffset({
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y
      });
    }
  };

  const handlePointerUp = () => {
    // If a drag operation was in progress, check if state changed and record to undo stack
    if (dragInitialRoom) {
      if (dragTarget?.type === 'furniture') {
        const prevItem = (dragInitialRoom.furniture || []).find(f => f.id === dragTarget.id);
        const currItem = (room.furniture || []).find(f => f.id === dragTarget.id);
        if (prevItem && currItem && (prevItem.x !== currItem.x || prevItem.y !== currItem.y)) {
          pushHistory(dragInitialRoom, `Moved ${currItem.name}`);
        }
      } else if (dragTarget?.type === 'wall_handle') {
        if (dragInitialRoom.length !== room.length || dragInitialRoom.width !== room.width) {
          pushHistory(
            dragInitialRoom,
            `Resized Walls (${formatLength(room.length, settings.defaultLengthUnit)} × ${formatLength(room.width, settings.defaultLengthUnit)})`
          );
        }
      } else if (dragTarget?.type === 'partition_wall') {
        const prevWall = (dragInitialRoom.walls || []).find(w => w.id === dragTarget.id);
        const currWall = (room.walls || []).find(w => w.id === dragTarget.id);
        if (
          prevWall &&
          currWall &&
          (prevWall.startX !== currWall.startX ||
            prevWall.startY !== currWall.startY ||
            prevWall.endX !== currWall.endX ||
            prevWall.endY !== currWall.endY)
        ) {
          pushHistory(dragInitialRoom, 'Adjusted Partition Wall');
        }
      }
    }

    setIsPanning(false);
    setDragTarget(null);
    setDragInitialRoom(null);
  };

  // Add new furniture item
  const handleAddFurniture = (catItem: typeof FURNITURE_CATALOG[0]) => {
    const newItem: FurnitureItem = {
      id: `furn_${Date.now()}`,
      roomId: room.id,
      type: catItem.type,
      name: catItem.name,
      x: Number(Math.min(room.length - 0.2, room.length / 2 + ((room.furniture || []).length % 5) * 0.3).toFixed(2)),
      y: Number(Math.min(room.width - 0.2, room.width / 2 + ((room.furniture || []).length % 5) * 0.3).toFixed(2)),
      width: catItem.width,
      depth: catItem.depth,
      height: catItem.height,
      rotation: 0,
      color: catItem.color
    };
    pushHistory(room, `Added ${catItem.name}`);
    onUpdateRoom({
      ...room,
      furniture: [...(room.furniture || []), newItem]
    });
    setSelectedFurnitureId(newItem.id);
    setSelectedWallId(null);
    setShowCatalog(false);
    showToast(`Added ${catItem.name}`);
  };

  // Rotate selected furniture by 90 deg
  const handleRotateSelectedFurniture = () => {
    if (!selectedFurnitureId) return;
    const item = (room.furniture || []).find(f => f.id === selectedFurnitureId);
    if (!item) return;

    pushHistory(room, `Rotated ${item.name}`);
    const updated = (room.furniture || []).map(f => {
      if (f.id === selectedFurnitureId) {
        return { ...f, rotation: (f.rotation + 90) % 360 };
      }
      return f;
    });
    onUpdateRoom({ ...room, furniture: updated });
  };

  // Delete selected furniture
  const handleDeleteSelectedFurniture = () => {
    if (!selectedFurnitureId) return;
    const item = (room.furniture || []).find(f => f.id === selectedFurnitureId);
    if (!item) return;

    pushHistory(room, `Deleted ${item.name}`);
    const updated = (room.furniture || []).filter(f => f.id !== selectedFurnitureId);
    onUpdateRoom({ ...room, furniture: updated });
    setSelectedFurnitureId(null);
    showToast(`Deleted ${item.name}`);
  };

  // Delete any furniture item by id (used by the items list and the inspector)
  const handleDeleteFurnitureById = (id: string) => {
    const item = (room.furniture || []).find(f => f.id === id);
    if (!item) return;
    pushHistory(room, `Deleted ${item.name}`);
    onUpdateRoom({ ...room, furniture: (room.furniture || []).filter(f => f.id !== id) });
    if (selectedFurnitureId === id) setSelectedFurnitureId(null);
    showToast(`Deleted ${item.name}`);
  };

  const handleClearAllFurniture = () => {
    if ((room.furniture || []).length === 0) return;
    if (!window.confirm(`Remove all ${room.furniture.length} furniture items from ${room.name}?`)) return;
    pushHistory(room, 'Cleared all furniture');
    onUpdateRoom({ ...room, furniture: [] });
    setSelectedFurnitureId(null);
    showToast('All furniture removed');
  };

  const handleDuplicateSelectedFurniture = () => {
    const item = (room.furniture || []).find(f => f.id === selectedFurnitureId);
    if (!item) return;
    const copy: FurnitureItem = {
      ...item,
      id: `furn_${Date.now()}`,
      x: Number(Math.min(room.length - 0.2, item.x + 0.3).toFixed(2)),
      y: Number(Math.min(room.width - 0.2, item.y + 0.3).toFixed(2)),
    };
    pushHistory(room, `Duplicated ${item.name}`);
    onUpdateRoom({ ...room, furniture: [...(room.furniture || []), copy] });
    setSelectedFurnitureId(copy.id);
    showToast(`Duplicated ${item.name}`);
  };

  const handleUpdateSelectedFurniture = (patch: Partial<FurnitureItem>, description: string) => {
    if (!selectedFurnitureId) return;
    pushHistory(room, description);
    onUpdateRoom({
      ...room,
      furniture: (room.furniture || []).map(f => (f.id === selectedFurnitureId ? { ...f, ...patch } : f)),
    });
  };

  const handleRotateSelectedBy = (deg: number) => {
    const item = (room.furniture || []).find(f => f.id === selectedFurnitureId);
    if (!item) return;
    handleUpdateSelectedFurniture({ rotation: (((item.rotation + deg) % 360) + 360) % 360 }, `Rotated ${item.name}`);
  };

  // Unit helpers for the size inspector (edit in the user's current unit)
  const unitFactor = LENGTH_CONVERSIONS[settings.defaultLengthUnit].factor;
  const unitDecimals = settings.defaultLengthUnit === 'm' ? 2 : settings.defaultLengthUnit === 'mm' ? 0 : 1;

  // Delete / Backspace removes the selected item (when not typing in a field)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedFurnitureId) {
        e.preventDefault();
        handleDeleteFurnitureById(selectedFurnitureId);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedFurnitureId, room]);

  // Add Partition Wall
  const handleAddPartitionWall = () => {
    const defaultLen = Math.min(2.4, Number((room.length * 0.4).toFixed(2)));
    const startX = Number(((room.length - defaultLen) / 2).toFixed(2));
    const centerY = Number((room.width / 2).toFixed(2));

    const newWall: WallSegment = {
      id: `wall_${Date.now()}`,
      startX,
      startY: centerY,
      endX: Number((startX + defaultLen).toFixed(2)),
      endY: centerY,
      thickness: 0.15,
      height: room.height || 2.7,
    };

    pushHistory(room, 'Added Partition Wall');
    onUpdateRoom({
      ...room,
      walls: [...(room.walls || []), newWall]
    });
    setSelectedWallId(newWall.id);
    setSelectedFurnitureId(null);
    showToast('Added Partition Wall');
  };

  // Rotate selected partition wall 90 deg
  const handleRotateSelectedWall = () => {
    if (!selectedWallId) return;
    const wall = (room.walls || []).find(w => w.id === selectedWallId);
    if (!wall) return;

    pushHistory(room, 'Rotated Partition Wall');
    const midX = (wall.startX + wall.endX) / 2;
    const midY = (wall.startY + wall.endY) / 2;
    const dx = wall.endX - wall.startX;
    const dy = wall.endY - wall.startY;
    const halfLen = Math.hypot(dx, dy) / 2;

    const isHorizontal = Math.abs(dy) < Math.abs(dx);
    const updatedWall: WallSegment = {
      ...wall,
      startX: isHorizontal ? midX : Number((midX - halfLen).toFixed(2)),
      startY: isHorizontal ? Number((midY - halfLen).toFixed(2)) : midY,
      endX: isHorizontal ? midX : Number((midX + halfLen).toFixed(2)),
      endY: isHorizontal ? Number((midY + halfLen).toFixed(2)) : midY,
    };

    const updated = (room.walls || []).map(w => w.id === selectedWallId ? updatedWall : w);
    onUpdateRoom({ ...room, walls: updated });
  };

  // Delete selected partition wall
  const handleDeleteSelectedWall = () => {
    if (!selectedWallId) return;
    pushHistory(room, 'Deleted Partition Wall');
    const updated = (room.walls || []).filter(w => w.id !== selectedWallId);
    onUpdateRoom({ ...room, walls: updated });
    setSelectedWallId(null);
    showToast('Deleted Partition Wall');
  };

  // Save Structural Wall Settings from Modal
  const handleSaveWallSettingsModal = () => {
    const l = Math.max(1.5, Math.min(25.0, parseFloat(modalWallLength) || room.length));
    const w = Math.max(1.5, Math.min(25.0, parseFloat(modalWallWidth) || room.width));
    const h = Math.max(2.0, Math.min(6.0, parseFloat(modalWallHeight) || (room.height || 2.7)));

    const area = Number((l * w).toFixed(2));
    const perimeter = Number((2 * (l + w)).toFixed(2));
    const corners = [
      { x: 0, y: 0 },
      { x: l, y: 0 },
      { x: l, y: w },
      { x: 0, y: w }
    ];

    pushHistory(
      room,
      `Updated Wall Dimensions (${formatLength(l, settings.defaultLengthUnit)} × ${formatLength(w, settings.defaultLengthUnit)})`
    );

    onUpdateRoom({
      ...room,
      length: l,
      width: w,
      height: h,
      area,
      perimeter,
      corners
    });

    setShowWallSettingsModal(false);
    showToast(`Updated Wall Structure: ${l}m × ${w}m`);
  };

  // Export 2D Plan as PNG Image
  const handleExportPNG = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    try {
      const dataUrl = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.download = `${room.name.replace(/\s+/g, '_')}_2D_FloorPlan.png`;
      link.href = dataUrl;
      link.click();
      showToast('Exported 2D plan to PNG!');
    } catch {
      // ignore
    }
  };

  const selectedItem = (room.furniture || []).find(f => f.id === selectedFurnitureId);
  const selectedWall = (room.walls || []).find(w => w.id === selectedWallId);

  // Dynamic canvas cursor
  let canvasCursor = 'cursor-crosshair';
  if (hoveredWallHandle === 'east' || hoveredWallHandle === 'west') canvasCursor = 'cursor-ew-resize';
  else if (hoveredWallHandle === 'south' || hoveredWallHandle === 'north') canvasCursor = 'cursor-ns-resize';
  else if (hoveredWallHandle === 'corner_se') canvasCursor = 'cursor-nwse-resize';
  else if (isPanning) canvasCursor = 'cursor-grabbing';
  else if (dragTarget?.type === 'furniture') canvasCursor = 'cursor-move';

  const items = room.furniture || [];
  const iconBtn = 'h-9 min-w-9 px-2 rounded-lg flex items-center justify-center gap-1.5 text-xs font-medium transition-colors';
  const numInput = 'w-full bg-slate-950 border border-slate-800 rounded-lg px-2 py-1.5 text-xs font-mono-numbers text-white text-center focus:outline-none focus:border-amber-500';

  return (
    <div className="relative w-full flex-1 min-h-0 bg-slate-950 flex flex-col select-none overflow-hidden">
      {/* ===== Top bar (in normal flow - scrolls sideways instead of overlapping) ===== */}
      <div className="shrink-0 bg-slate-950 border-b border-slate-800/80 px-2 py-1.5 flex items-center gap-1.5 flex-wrap">
        <div className="shrink-0 bg-slate-900 border border-slate-800 rounded-xl p-0.5 flex items-center">
          <button
            onClick={handleUndo}
            disabled={undoStack.length === 0}
            title={undoStack.length > 0 ? `Undo: ${undoStack[undoStack.length - 1].description} (Ctrl+Z)` : 'Undo (Ctrl+Z)'}
            className={`${iconBtn} ${undoStack.length > 0 ? 'text-amber-400 hover:bg-slate-800' : 'text-slate-600 opacity-50'}`}
          >
            <Undo2 className="w-4 h-4" />
            {undoStack.length > 0 && <span className="text-[10px] font-mono-numbers font-bold text-amber-300">{undoStack.length}</span>}
          </button>
          <button
            onClick={handleRedo}
            disabled={redoStack.length === 0}
            title={redoStack.length > 0 ? `Redo: ${redoStack[redoStack.length - 1].description} (Ctrl+Y)` : 'Redo (Ctrl+Y)'}
            className={`${iconBtn} ${redoStack.length > 0 ? 'text-amber-400 hover:bg-slate-800' : 'text-slate-600 opacity-50'}`}
          >
            <Redo2 className="w-4 h-4" />
            {redoStack.length > 0 && <span className="text-[10px] font-mono-numbers font-bold text-amber-300">{redoStack.length}</span>}
          </button>
          {(undoStack.length > 0 || redoStack.length > 0) && (
            <button onClick={() => setShowHistoryModal(true)} title="Edit history" className={`${iconBtn} text-slate-400 hover:text-white hover:bg-slate-800`}>
              <History className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="shrink-0 bg-slate-900 border border-slate-800 rounded-xl p-0.5 flex items-center">
          {(['fit'] as const).map(p => (
            <button
              key={p}
              onClick={() => handleScalePreset(p)}
              className={`h-9 px-2.5 text-xs font-mono-numbers rounded-lg ${activeScalePreset === p ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-300 hover:text-white'}`}
            >
              {p === 'fit' ? 'Fit' : p}
            </button>
          ))}
        </div>

        <button
          onClick={() => {
            setModalWallLength(room.length.toString());
            setModalWallWidth(room.width.toString());
            setModalWallHeight((room.height || 2.7).toString());
            setShowWallSettingsModal(true);
          }}
          title="Room dimensions & ceiling height"
          className={`shrink-0 ${iconBtn} bg-slate-900 border border-slate-800 text-slate-200 hover:text-white`}
        >
          <Building2 className="w-4 h-4 text-amber-400" /><span className="hidden sm:inline">Room size</span>
        </button>
        {onOpen3D && (
          <button onClick={onOpen3D} className={`shrink-0 ${iconBtn} bg-slate-900 border border-slate-800 text-white`}>3D</button>
        )}
        <button onClick={() => setShowMaterialEstimator(true)} title="Flooring & paint estimator" className={`shrink-0 ${iconBtn} bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold`}>
          <Calculator className="w-4 h-4" /><span className="hidden sm:inline">Materials</span>
        </button>
        <button onClick={handleExportPNG} title="Download PNG" className={`shrink-0 ${iconBtn} bg-slate-900 border border-slate-800 text-slate-300 hover:text-white`}>
          <Download className="w-4 h-4" />
        </button>
      </div>

      {/* ===== Canvas area ===== */}
      <div ref={containerRef} className="relative flex-1 min-h-0 overflow-hidden">
        <canvas
          ref={canvasRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          className={`absolute inset-0 w-full h-full touch-none ${canvasCursor}`}
        />

        {/* Zoom controls (small, bottom-right of the canvas only) */}
        <div className="absolute right-2 bottom-2 flex flex-col gap-1.5 z-10">
          <button onClick={() => setScale(s => Math.min(140, s * 1.2))} title="Zoom in" className="w-9 h-9 rounded-xl bg-slate-900/90 border border-slate-800 text-slate-300 hover:text-white flex items-center justify-center"><ZoomIn className="w-4 h-4" /></button>
          <button onClick={() => setScale(s => Math.max(15, s * 0.8))} title="Zoom out" className="w-9 h-9 rounded-xl bg-slate-900/90 border border-slate-800 text-slate-300 hover:text-white flex items-center justify-center"><ZoomOut className="w-4 h-4" /></button>
        </div>

        {/* Live dimension HUD while dragging wall handles */}
        {dragTarget?.type === 'wall_handle' && (
          <div className="absolute top-2 left-1/2 -translate-x-1/2 bg-amber-500 text-slate-950 px-3 py-1 rounded-full font-bold text-xs shadow-xl z-20 pointer-events-none whitespace-nowrap">
            {formatLength(room.length, settings.defaultLengthUnit)} × {formatLength(room.width, settings.defaultLengthUnit)} ({formatArea(room.area, settings.defaultAreaUnit)})
          </div>
        )}
      </div>

      {/* ===== Dock: add / delete / edit furniture (always visible, never under the nav) ===== */}
      <div className="shrink-0 bg-slate-950 border-t border-slate-800/80">
        {/* Items list (expandable) */}
        {showItemsList && !selectedItem && (
          <div className="max-h-32 overflow-y-auto border-b border-slate-800/80 px-2 py-1.5 space-y-1">
            {items.length === 0 ? (
              <div className="text-xs text-slate-500 text-center py-3">No furniture yet - tap “Add furniture”.</div>
            ) : (
              items.map(f => (
                <div
                  key={f.id}
                  className={`flex items-center gap-2 rounded-lg px-2 py-1 border ${f.id === selectedFurnitureId ? 'bg-sky-500/15 border-sky-500/40' : 'bg-slate-900 border-slate-800'}`}
                >
                  <button onClick={() => { setSelectedFurnitureId(f.id); setSelectedWallId(null); }} className="flex-1 min-w-0 text-left">
                    <div className="text-xs font-semibold text-slate-100 truncate">{f.name}</div>
                    <div className="text-[10px] font-mono-numbers text-slate-400 truncate">
                      {formatLength(f.width, settings.defaultLengthUnit)} × {formatLength(f.depth, settings.defaultLengthUnit)}
                    </div>
                  </button>
                  <button
                    onClick={() => handleDeleteFurnitureById(f.id)}
                    title={`Delete ${f.name}`}
                    className="h-8 w-8 shrink-0 rounded-lg bg-rose-500/15 hover:bg-rose-500/30 text-rose-400 border border-rose-500/30 flex items-center justify-center"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))
            )}
            {items.length > 1 && (
              <button onClick={handleClearAllFurniture} className="w-full text-[11px] text-rose-400 hover:text-rose-300 py-1">Remove all furniture</button>
            )}
          </div>
        )}

        {/* Inspector: selected furniture */}
        {selectedItem && (
          <div className="border-b border-slate-800/80 px-2 py-2 space-y-2 bg-slate-900/60">
            <div className="flex items-center gap-2">
              <input
                value={selectedItem.name}
                onChange={e => handleUpdateSelectedFurniture({ name: e.target.value }, 'Renamed item')}
                className="flex-1 min-w-0 bg-slate-950 border border-slate-800 rounded-lg px-2 py-1.5 text-xs font-semibold text-white focus:outline-none focus:border-amber-500"
              />
              <button onClick={() => handleRotateSelectedBy(-15)} title="Rotate -15°" className={`${iconBtn} bg-slate-800 text-amber-400 border border-slate-700`}><RotateCcw className="w-4 h-4" /></button>
              <button onClick={() => handleRotateSelectedBy(90)} title="Rotate 90°" className={`${iconBtn} bg-slate-800 text-amber-400 border border-slate-700`}><RotateCw className="w-4 h-4" /></button>
              <button onClick={handleDuplicateSelectedFurniture} title="Duplicate" className={`${iconBtn} bg-slate-800 text-slate-200 border border-slate-700`}><Copy className="w-4 h-4" /></button>
              <button onClick={handleDeleteSelectedFurniture} title="Delete (Del)" className={`${iconBtn} bg-rose-500/20 text-rose-400 border border-rose-500/40`}><Trash2 className="w-4 h-4" /><span className="hidden sm:inline">Delete</span></button>
              <button onClick={() => setSelectedFurnitureId(null)} title="Done" className={`${iconBtn} bg-slate-800 text-slate-300 border border-slate-700`}><Check className="w-4 h-4" /></button>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {([
                ['Width', 'width'],
                ['Depth', 'depth'],
                ['Height', 'height'],
              ] as const).map(([label, key]) => (
                <label key={key} className="block">
                  <span className="text-[10px] text-slate-400">{label} ({settings.defaultLengthUnit})</span>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    key={`${selectedItem.id}-${key}-${selectedItem[key]}`}
                    defaultValue={(selectedItem[key] * unitFactor).toFixed(unitDecimals)}
                    onBlur={e => {
                      const v = parseFloat(e.target.value);
                      if (!isFinite(v) || v <= 0) return;
                      const meters = Math.max(0.05, Math.min(20, v / unitFactor));
                      if (Math.abs(meters - selectedItem[key]) > 1e-4) handleUpdateSelectedFurniture({ [key]: Number(meters.toFixed(3)) }, `Resized ${selectedItem.name}`);
                    }}
                    onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                    className={numInput}
                  />
                </label>
              ))}
              <label className="block">
                <span className="text-[10px] text-slate-400">Rotation (°)</span>
                <input
                  type="number"
                  step="1"
                  key={`${selectedItem.id}-rot-${selectedItem.rotation}`}
                  defaultValue={Math.round(selectedItem.rotation)}
                  onBlur={e => {
                    const v = parseFloat(e.target.value);
                    if (!isFinite(v)) return;
                    const r = ((v % 360) + 360) % 360;
                    if (r !== selectedItem.rotation) handleUpdateSelectedFurniture({ rotation: r }, `Rotated ${selectedItem.name}`);
                  }}
                  onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                  className={numInput}
                />
              </label>
            </div>
          </div>
        )}

        {/* Inspector: selected partition wall */}
        {selectedWall && (
          <div className="border-b border-slate-800/80 px-2 py-2 flex items-center gap-2 bg-slate-900/60">
            <div className="flex-1 min-w-0">
              <div className="text-xs font-semibold text-sky-400 flex items-center gap-1.5"><Layers className="w-3.5 h-3.5" /><span>Partition Wall</span></div>
              <div className="text-[11px] font-mono-numbers text-slate-400 truncate">
                {formatLength(Math.hypot(selectedWall.endX - selectedWall.startX, selectedWall.endY - selectedWall.startY), settings.defaultLengthUnit)} · {(selectedWall.thickness * 100).toFixed(0)} cm thick
              </div>
            </div>
            <button onClick={handleRotateSelectedWall} title="Rotate wall 90°" className={`${iconBtn} bg-slate-800 text-sky-400 border border-slate-700`}><RotateCw className="w-4 h-4" /></button>
            <button onClick={handleDeleteSelectedWall} title="Delete wall" className={`${iconBtn} bg-rose-500/20 text-rose-400 border border-rose-500/40`}><Trash2 className="w-4 h-4" /><span className="hidden sm:inline">Delete</span></button>
            <button onClick={() => setSelectedWallId(null)} title="Done" className={`${iconBtn} bg-slate-800 text-slate-300 border border-slate-700`}><Check className="w-4 h-4" /></button>
          </div>
        )}

        {/* Primary action row */}
        <div className="px-2 py-2 flex items-center gap-2">
          <button
            onClick={() => setShowCatalog(true)}
            className="h-11 flex-1 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm flex items-center justify-center gap-2 active:scale-[0.98]"
          >
            <Plus className="w-5 h-5" /> Add furniture
          </button>
          <button
            onClick={() => setShowItemsList(v => !v)}
            className={`h-11 px-3 rounded-xl border text-xs font-semibold flex items-center gap-1.5 ${showItemsList ? 'bg-sky-500/20 border-sky-500/40 text-sky-300' : 'bg-slate-900 border-slate-800 text-slate-200'}`}
          >
            <List className="w-4 h-4" /> Items ({items.length}) <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showItemsList ? 'rotate-180' : ''}`} />
          </button>
          <button
            onClick={handleAddPartitionWall}
            title="Add partition wall"
            className="h-11 px-3 rounded-xl bg-slate-900 border border-slate-800 text-slate-200 hover:text-amber-400 text-xs font-semibold flex items-center gap-1.5"
          >
            <Layers className="w-4 h-4" /> <span className="hidden sm:inline">Wall</span>
          </button>
        </div>
      </div>

      {/* Furniture Catalog Modal */}
      {showCatalog && (
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm z-30 flex items-center justify-center p-3">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md max-h-full flex flex-col p-4 shadow-2xl">
            <div className="flex items-center justify-between mb-3 shrink-0">
              <h3 className="text-base font-bold text-white">Add Furniture & Elements</h3>
              <button
                onClick={() => setShowCatalog(false)}
                className="text-xs text-slate-400 hover:text-white px-2 py-1 rounded-md"
              >
                Cancel
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2.5 overflow-y-auto pr-1 min-h-0">
              {FURNITURE_CATALOG.map((f, i) => (
                <button
                  key={i}
                  onClick={() => handleAddFurniture(f)}
                  className="flex items-center gap-3 p-3 rounded-xl bg-slate-800/80 hover:bg-slate-800 border border-slate-700/60 text-left transition-all active:scale-[0.98]"
                >
                  <div className="w-9 h-9 rounded-lg bg-slate-700 flex items-center justify-center text-amber-400 shrink-0">
                    {f.icon}
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-slate-200 leading-tight">{f.name}</div>
                    <div className="text-[10px] font-mono-numbers text-slate-400">
                      {formatLength(f.width, settings.defaultLengthUnit)} × {formatLength(f.depth, settings.defaultLengthUnit)}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Structural Wall Settings Modal */}
      {showWallSettingsModal && (
        <div className="absolute inset-0 bg-black/70 backdrop-blur-sm z-30 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl animate-fade-in">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center">
                  <Building2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Structural Wall Edits</h3>
                  <p className="text-xs text-slate-400">Modify room perimeter dimensions & wall structure</p>
                </div>
              </div>
              <button
                onClick={() => setShowWallSettingsModal(false)}
                className="text-xs text-slate-400 hover:text-white px-2 py-1 rounded-md"
              >
                Cancel
              </button>
            </div>

            <div className="space-y-4">
              {/* Length (North/South Wall) */}
              <div>
                <div className="flex items-center justify-between text-xs text-slate-300 mb-1.5">
                  <span className="font-semibold">Room Length (North/South Walls)</span>
                  <span className="font-mono-numbers text-amber-400">
                    {formatLength(parseFloat(modalWallLength) || room.length, settings.defaultLengthUnit)}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setModalWallLength(v => Math.max(1.5, Number(((parseFloat(v) || room.length) - 0.2).toFixed(2))).toString())}
                    className="w-9 h-9 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold flex items-center justify-center border border-slate-700"
                  >
                    -
                  </button>
                  <input
                    type="number"
                    step="0.1"
                    min="1.5"
                    max="25.0"
                    value={modalWallLength}
                    onChange={e => setModalWallLength(e.target.value)}
                    className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-center text-sm font-mono-numbers text-white focus:outline-none focus:border-amber-500"
                  />
                  <button
                    onClick={() => setModalWallLength(v => Math.min(25.0, Number(((parseFloat(v) || room.length) + 0.2).toFixed(2))).toString())}
                    className="w-9 h-9 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold flex items-center justify-center border border-slate-700"
                  >
                    +
                  </button>
                </div>
              </div>

              {/* Width (East/West Wall) */}
              <div>
                <div className="flex items-center justify-between text-xs text-slate-300 mb-1.5">
                  <span className="font-semibold">Room Width (East/West Walls)</span>
                  <span className="font-mono-numbers text-amber-400">
                    {formatLength(parseFloat(modalWallWidth) || room.width, settings.defaultLengthUnit)}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setModalWallWidth(v => Math.max(1.5, Number(((parseFloat(v) || room.width) - 0.2).toFixed(2))).toString())}
                    className="w-9 h-9 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold flex items-center justify-center border border-slate-700"
                  >
                    -
                  </button>
                  <input
                    type="number"
                    step="0.1"
                    min="1.5"
                    max="25.0"
                    value={modalWallWidth}
                    onChange={e => setModalWallWidth(e.target.value)}
                    className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-center text-sm font-mono-numbers text-white focus:outline-none focus:border-amber-500"
                  />
                  <button
                    onClick={() => setModalWallWidth(v => Math.min(25.0, Number(((parseFloat(v) || room.width) + 0.2).toFixed(2))).toString())}
                    className="w-9 h-9 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold flex items-center justify-center border border-slate-700"
                  >
                    +
                  </button>
                </div>
              </div>

              {/* Ceiling Height */}
              <div>
                <div className="flex items-center justify-between text-xs text-slate-300 mb-1.5">
                  <span className="font-semibold">Ceiling Height</span>
                  <span className="font-mono-numbers text-amber-400">
                    {formatLength(parseFloat(modalWallHeight) || (room.height || 2.7), settings.defaultLengthUnit)}
                  </span>
                </div>
                <input
                  type="number"
                  step="0.1"
                  min="2.0"
                  max="6.0"
                  value={modalWallHeight}
                  onChange={e => setModalWallHeight(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-center text-sm font-mono-numbers text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              {/* Quick Dimension Presets */}
              <div className="pt-2">
                <span className="text-[11px] text-slate-400 font-semibold block mb-2">Architectural Presets:</span>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { label: 'Living Room', l: 5.5, w: 4.2 },
                    { label: 'Master Bed', l: 4.5, w: 3.8 },
                    { label: 'Kitchen', l: 3.8, w: 3.0 },
                  ].map((preset, idx) => (
                    <button
                      key={idx}
                      onClick={() => {
                        setModalWallLength(preset.l.toString());
                        setModalWallWidth(preset.w.toString());
                      }}
                      className="px-2 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700/60 text-xs text-slate-300 hover:text-white transition-colors"
                    >
                      <div className="font-medium truncate">{preset.label}</div>
                      <div className="text-[10px] text-amber-400/80 font-mono-numbers">{preset.l}m × {preset.w}m</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-3 pt-3">
                <button
                  onClick={() => setShowWallSettingsModal(false)}
                  className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveWallSettingsModal}
                  className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-md transition-colors"
                >
                  Apply Wall Changes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* History Log Popover Modal */}
      {showHistoryModal && (
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm z-30 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-sm p-5 shadow-2xl">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <History className="w-4 h-4 text-amber-400" />
                <h3 className="text-sm font-bold text-white">Planning Action History</h3>
              </div>
              <button
                onClick={() => setShowHistoryModal(false)}
                className="text-xs text-slate-400 hover:text-white px-2 py-1 rounded-md"
              >
                Close
              </button>
            </div>

            <div className="text-xs text-slate-400 mb-3">
              {undoStack.length} undo step(s) available · {redoStack.length} redo step(s)
            </div>

            <div className="space-y-1.5 max-h-[50vh] overflow-y-auto pr-1">
              {undoStack.length === 0 ? (
                <div className="text-xs text-slate-500 py-4 text-center">No edits in undo stack yet</div>
              ) : (
                [...undoStack].reverse().map((entry, idx) => (
                  <div
                    key={idx}
                    className="p-2.5 rounded-xl bg-slate-800/60 border border-slate-800 flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center gap-2 truncate">
                      <CornerDownLeft className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      <span className="text-slate-200 truncate">{entry.description}</span>
                    </div>
                    <span className="text-[10px] font-mono-numbers text-slate-500 shrink-0 ml-2">
                      {new Date(entry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </span>
                  </div>
                ))
              )}
            </div>

            <div className="mt-4 flex gap-2">
              <button
                onClick={() => {
                  handleUndo();
                  setShowHistoryModal(false);
                }}
                disabled={undoStack.length === 0}
                className="flex-1 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-40 disabled:hover:bg-amber-500 text-slate-950 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors"
              >
                <Undo2 className="w-3.5 h-3.5" />
                <span>Undo Last</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Notification Toast */}
      {toastMessage && (
        <div className="absolute top-28 left-1/2 -translate-x-1/2 bg-slate-900 border border-amber-500/50 text-white font-medium px-4 py-2 rounded-xl text-xs shadow-xl z-30 flex items-center gap-2 animate-fade-in backdrop-blur-md">
          <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Material Estimator Modal */}
      {showMaterialEstimator && (
        <MaterialEstimatorModal
          room={room}
          settings={settings}
          onClose={() => setShowMaterialEstimator(false)}
          onSaveToNotes={notes => {
            pushHistory(room, 'Saved material estimate to notes');
            onUpdateRoom({ ...room, notes });
            showToast('Material estimate saved to room notes!');
          }}
        />
      )}
    </div>
  );
}
