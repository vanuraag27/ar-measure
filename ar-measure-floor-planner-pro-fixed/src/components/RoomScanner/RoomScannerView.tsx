import { useState } from 'react';
import { AppSettings, RoomRecord } from '../../types';
import { ARCameraOverlay } from '../ARMeasure/ARCameraOverlay';
import { formatLength, formatArea } from '../../utils/units';
import { classifyRoomLayout, AIRoomClassificationResult } from '../../utils/aiRoomClassifier';
import { 
  Check, RotateCcw, Home, Sparkles, RefreshCw, 
  Sofa, Bed, UtensilsCrossed, Bath, Tv, Square, Plus, X 
} from 'lucide-react';

interface RoomScannerViewProps {
  settings: AppSettings;
  onFinishScan: (newRoom: Omit<RoomRecord, 'id'>) => void;
  onCancel: () => void;
}

const COMMON_DETECTABLE_FURNITURE = [
  { id: 'sofa', name: 'Sofa / Couch', icon: Sofa },
  { id: 'bed', name: 'Bed', icon: Bed },
  { id: 'kitchen_counter', name: 'Kitchen Counter', icon: Square },
  { id: 'dining_table', name: 'Dining Table', icon: UtensilsCrossed },
  { id: 'wardrobe', name: 'Wardrobe / Closet', icon: Square },
  { id: 'tv_unit', name: 'TV Unit', icon: Tv },
  { id: 'bathtub', name: 'Bathtub / Toilet', icon: Bath },
  { id: 'desk', name: 'Work Desk', icon: Square },
];

export function RoomScannerView({ settings, onFinishScan, onCancel }: RoomScannerViewProps) {
  const [step, setStep] = useState<'scanning' | 'review'>('scanning');
  const [roomName, setRoomName] = useState('Scanned Room');
  const [roomType, setRoomType] = useState<RoomRecord['type']>('living_room');
  const [scannedCorners, setScannedCorners] = useState<{ x: number; y: number }[]>([]);
  const [roomLength, setRoomLength] = useState(5.8);
  const [roomWidth, setRoomWidth] = useState(4.25);
  const [ceilingHeight, setCeilingHeight] = useState(2.75);

  // Detected furniture items during scan
  const [detectedFurniture, setDetectedFurniture] = useState<string[]>(['Sofa / Couch']);

  // AI Classification state
  const [aiClassification, setAiClassification] = useState<AIRoomClassificationResult | null>(null);
  const [isClassifying, setIsClassifying] = useState(false);

  const calculatedArea = Number((roomLength * roomWidth).toFixed(2));
  const calculatedPerimeter = Number((2 * (roomLength + roomWidth)).toFixed(2));

  // Toggle detected furniture during scanning
  const handleToggleFurniture = (item: string) => {
    setDetectedFurniture(prev => 
      prev.includes(item) ? prev.filter(f => f !== item) : [...prev, item]
    );
  };

  // Run AI classification
  const runAiClassification = async (l: number, w: number, area: number, perim: number, items: string[]) => {
    setIsClassifying(true);
    try {
      const result = await classifyRoomLayout({
        length: l,
        width: w,
        height: ceilingHeight,
        area: area,
        perimeter: perim,
        detectedFurniture: items,
      });

      setAiClassification(result);
      if (result.roomName) setRoomName(result.roomName);
      if (result.roomType) setRoomType(result.roomType);
    } catch (e) {
      console.error('Failed to run AI classification:', e);
    } finally {
      setIsClassifying(false);
    }
  };

  const handleScanFinished = async (
    corners: { x: number; y: number }[],
    l: number,
    w: number,
    area: number,
    perim: number
  ) => {
    const validCorners = corners.length >= 3 ? corners : [
      { x: 0, y: 0 },
      { x: Math.max(1, l), y: 0 },
      { x: Math.max(1, l), y: Math.max(1, w) },
      { x: 0, y: Math.max(1, w) }
    ];
    const finalL = Math.max(1, Number(l.toFixed(2)));
    const finalW = Math.max(1, Number(w.toFixed(2)));
    const finalArea = Number((finalL * finalW).toFixed(2));
    const finalPerim = Number((2 * (finalL + finalW)).toFixed(2));

    setScannedCorners(validCorners);
    setRoomLength(finalL);
    setRoomWidth(finalW);
    setStep('review');

    // Automatically trigger AI classification based on layout & detected furniture
    await runAiClassification(finalL, finalW, finalArea, finalPerim, detectedFurniture);
  };

  const handleConfirmRoom = () => {
    onFinishScan({
      projectId: '',
      name: roomName.trim() || 'Scanned Room',
      type: roomType,
      length: roomLength,
      width: roomWidth,
      height: ceilingHeight,
      area: calculatedArea,
      perimeter: calculatedPerimeter,
      corners: scannedCorners,
      furniture: []
    });
  };

  return (
    <div className="relative w-full flex-1 min-h-0 bg-slate-950 flex flex-col select-none overflow-hidden">
      {step === 'scanning' ? (
        <div className="w-full flex-1 min-h-0 flex flex-col">
          <ARCameraOverlay
            tool="room_scan"
            settings={settings}
            onSaveMeasurement={() => {}}
            onFinishRoomScan={handleScanFinished}
            topSlot={
              <>
          <div className="bg-slate-900 border-b border-slate-800 px-3 py-2 flex items-center justify-between">
                  <div>
                    <div className="text-xs font-bold text-white flex items-center gap-1.5">
                      <Home className="w-4 h-4 text-amber-500" />
                      <span>Room Walkthrough Scanner</span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Scan room corners. Tag detected furniture below for automatic AI classification.
                    </p>
                  </div>
                  <button
                    onClick={onCancel}
                    className="text-xs text-slate-400 hover:text-white px-2.5 py-1 bg-slate-800 rounded-lg"
                  >
                    Exit
                  </button>
                </div>

              </>
            }
            bottomSlot={
              <div className="shrink-0 bg-slate-950">
          {/* Floating Furniture Tagger Bar during Scan (Above Bottom Controls) */}
          <div className="px-2 pb-2">
            <div className="bg-slate-950/85 backdrop-blur-md border border-slate-800/80 rounded-2xl p-2.5 shadow-xl">
              <div className="flex items-center justify-between px-1 mb-1.5">
                <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-300">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  <span>Detected Elements & Furniture:</span>
                </div>
                <span className="text-[10px] text-amber-400 font-mono-numbers">
                  {detectedFurniture.length} detected
                </span>
              </div>

              {/* Scrollable list of detectable furniture */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none]">
                {COMMON_DETECTABLE_FURNITURE.map(item => {
                  const isDetected = detectedFurniture.includes(item.name);
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.id}
                      onClick={() => handleToggleFurniture(item.name)}
                      className={`h-8 px-2.5 rounded-xl text-[11px] font-medium flex items-center gap-1.5 shrink-0 transition-all ${
                        isDetected
                          ? 'bg-amber-500 text-slate-950 font-bold shadow-sm'
                          : 'bg-slate-900 text-slate-400 border border-slate-800 hover:text-white'
                      }`}
                    >
                      <Icon className="w-3 h-3" />
                      <span>{item.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
              </div>
            }
          />
        </div>
      ) : (
        /* Review and Geometry Correction Step with AI Room Classifier */
        <div className="flex-1 p-4 bg-slate-950 overflow-y-auto pb-6">
          <div className="max-w-md mx-auto space-y-4">
            {/* AI Classification Hero Card */}
            <div className="bg-gradient-to-br from-amber-500/10 via-slate-900 to-slate-900 border border-amber-500/30 rounded-2xl p-4 shadow-xl relative overflow-hidden">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-[11px] font-bold text-amber-400 uppercase tracking-wider block">
                      AI Room Classifier
                    </span>
                    <span className="text-xs text-slate-400">Powered by Gemini</span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {aiClassification && (
                    <span className="text-[11px] font-mono-numbers text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full font-semibold">
                      {Math.round(aiClassification.confidence * 100)}% Match
                    </span>
                  )}
                  <button
                    onClick={() => runAiClassification(roomLength, roomWidth, calculatedArea, calculatedPerimeter, detectedFurniture)}
                    disabled={isClassifying}
                    title="Re-run AI Classification"
                    className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg transition-colors disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isClassifying ? 'animate-spin text-amber-400' : ''}`} />
                  </button>
                </div>
              </div>

              {isClassifying ? (
                <div className="py-4 text-center">
                  <div className="w-5 h-5 border-2 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                  <p className="text-xs text-slate-300 font-medium">
                    Analyzing room layout, aspect ratio & detected furniture...
                  </p>
                </div>
              ) : (
                <div className="space-y-2 mt-2">
                  <div className="text-lg font-black text-white tracking-tight">
                    {roomName}
                  </div>
                  {aiClassification?.reasoning && (
                    <p className="text-xs text-slate-300 leading-relaxed bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/80">
                      {aiClassification.reasoning}
                    </p>
                  )}

                  {aiClassification?.suggestedFurniture && aiClassification.suggestedFurniture.length > 0 && (
                    <div className="pt-1">
                      <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold block mb-1">
                        Recommended Layout Elements:
                      </span>
                      <div className="flex flex-wrap gap-1">
                        {aiClassification.suggestedFurniture.map((item, idx) => (
                          <span
                            key={idx}
                            className="text-[11px] bg-slate-800/80 text-slate-300 px-2 py-0.5 rounded-lg border border-slate-700/60"
                          >
                            {item}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Room Geometry Summary Card */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3 shadow-lg">
              <div className="grid grid-cols-2 gap-3 pb-3 border-b border-slate-800">
                <div>
                  <span className="text-xs text-slate-400">Total Calculated Area</span>
                  <div className="text-2xl font-black font-mono-numbers text-amber-400 mt-0.5">
                    {formatArea(calculatedArea, settings.defaultAreaUnit)}
                  </div>
                </div>
                <div>
                  <span className="text-xs text-slate-400">Room Perimeter</span>
                  <div className="text-lg font-bold font-mono-numbers text-white mt-1">
                    {formatLength(calculatedPerimeter, settings.defaultLengthUnit)}
                  </div>
                </div>
              </div>

              {/* Editable Fields */}
              <div className="space-y-3 pt-1">
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Room Name</label>
                  <input
                    type="text"
                    value={roomName}
                    onChange={e => setRoomName(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-amber-500 font-semibold"
                  />
                </div>

                <div>
                  <label className="text-xs text-slate-400 block mb-1">Room Type</label>
                  <select
                    value={roomType}
                    onChange={e => setRoomType(e.target.value as RoomRecord['type'])}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-amber-500"
                  >
                    <option value="living_room">Living Room</option>
                    <option value="bedroom">Bedroom</option>
                    <option value="kitchen">Kitchen</option>
                    <option value="bathroom">Bathroom</option>
                    <option value="dining_room">Dining Room</option>
                    <option value="balcony">Balcony</option>
                    <option value="corridor">Corridor</option>
                    <option value="office">Home Office</option>
                    <option value="garage">Garage</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="text-xs text-slate-400 block mb-1">Length (m)</label>
                    <input
                      type="number"
                      step="0.05"
                      value={roomLength}
                      onChange={e => setRoomLength(Math.max(0.5, parseFloat(e.target.value) || 1))}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm font-mono-numbers text-white"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400 block mb-1">Width (m)</label>
                    <input
                      type="number"
                      step="0.05"
                      value={roomWidth}
                      onChange={e => setRoomWidth(Math.max(0.5, parseFloat(e.target.value) || 1))}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm font-mono-numbers text-white"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400 block mb-1">Height (m)</label>
                    <input
                      type="number"
                      step="0.05"
                      value={ceilingHeight}
                      onChange={e => setCeilingHeight(Math.max(1.5, parseFloat(e.target.value) || 2.7))}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm font-mono-numbers text-white"
                    />
                  </div>
                </div>

                {/* Detected Furniture Items display & toggle */}
                <div>
                  <label className="text-xs text-slate-400 block mb-1.5">Detected Furniture / Fixtures</label>
                  <div className="flex flex-wrap gap-1.5">
                    {COMMON_DETECTABLE_FURNITURE.map(item => {
                      const isDetected = detectedFurniture.includes(item.name);
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => {
                            handleToggleFurniture(item.name);
                            const updated = isDetected
                              ? detectedFurniture.filter(f => f !== item.name)
                              : [...detectedFurniture, item.name];
                            runAiClassification(roomLength, roomWidth, calculatedArea, calculatedPerimeter, updated);
                          }}
                          className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                            isDetected
                              ? 'bg-amber-500/20 border border-amber-500/40 text-amber-300 font-semibold'
                              : 'bg-slate-950 border border-slate-800 text-slate-400 hover:text-white'
                          }`}
                        >
                          {item.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setStep('scanning')}
                className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-xl text-xs flex items-center justify-center gap-1.5 transition-colors"
              >
                <RotateCcw className="w-4 h-4" />
                Rescan
              </button>
              <button
                onClick={handleConfirmRoom}
                className="flex-1 py-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-lg shadow-amber-500/20 transition-all active:scale-98"
              >
                <Check className="w-4 h-4" />
                Open in Floor Planner
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
