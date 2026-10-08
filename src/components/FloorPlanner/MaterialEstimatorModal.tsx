import { useState } from 'react';
import { RoomRecord, AppSettings, UnitSystem } from '../../types';
import { formatLength, formatArea, convertArea, convertLength, formatFeetAndInches } from '../../utils/units';
import { 
  Calculator, Paintbrush, Layers, Check, Copy, X, 
  HelpCircle, Sparkles, DollarSign, Scale, ChevronRight
} from 'lucide-react';

interface MaterialEstimatorModalProps {
  room: RoomRecord;
  settings: AppSettings;
  onClose: () => void;
  onSaveToNotes?: (notes: string) => void;
}

type FlooringType = 'hardwood' | 'porcelain_tile' | 'lvp' | 'laminate' | 'carpet';

interface FlooringOption {
  id: FlooringType;
  name: string;
  packCoverageM2: number; // m² per box
  packCoverageSqFt: number; // sq ft per box
  unitMetric: string;
  unitImperial: string;
  recommendedWastePercent: number;
  typicalCostPerM2: number;
  typicalCostPerSqFt: number;
  description: string;
}

const FLOORING_OPTIONS: FlooringOption[] = [
  {
    id: 'hardwood',
    name: 'Engineered Hardwood Planks',
    packCoverageM2: 2.10,
    packCoverageSqFt: 22.6,
    unitMetric: 'boxes (2.1 m²/box)',
    unitImperial: 'boxes (22.6 sq ft/box)',
    recommendedWastePercent: 10,
    typicalCostPerM2: 55,
    typicalCostPerSqFt: 5.50,
    description: 'Tongue-and-groove hardwood planks. Straight installation.'
  },
  {
    id: 'porcelain_tile',
    name: 'Porcelain / Ceramic Floor Tile',
    packCoverageM2: 1.44,
    packCoverageSqFt: 15.5,
    unitMetric: 'boxes (1.44 m²/box, 60×60cm)',
    unitImperial: 'boxes (15.5 sq ft/box, 24×24in)',
    recommendedWastePercent: 12,
    typicalCostPerM2: 42,
    typicalCostPerSqFt: 4.20,
    description: 'Large format floor tiles including joint cut allowances.'
  },
  {
    id: 'lvp',
    name: 'Luxury Vinyl Plank (LVP / SPC)',
    packCoverageM2: 2.22,
    packCoverageSqFt: 23.9,
    unitMetric: 'boxes (2.22 m²/box)',
    unitImperial: 'boxes (23.9 sq ft/box)',
    recommendedWastePercent: 10,
    typicalCostPerM2: 32,
    typicalCostPerSqFt: 3.20,
    description: 'Waterproof interlocking click vinyl flooring.'
  },
  {
    id: 'laminate',
    name: 'High-Density Laminate',
    packCoverageM2: 2.13,
    packCoverageSqFt: 22.9,
    unitMetric: 'boxes (2.13 m²/box)',
    unitImperial: 'boxes (22.9 sq ft/box)',
    recommendedWastePercent: 8,
    typicalCostPerM2: 24,
    typicalCostPerSqFt: 2.40,
    description: 'Durable residential click laminate.'
  },
  {
    id: 'carpet',
    name: 'Broadloom Carpet & Underlay',
    packCoverageM2: 3.66,
    packCoverageSqFt: 39.4,
    unitMetric: 'linear meters (3.66m roll width)',
    unitImperial: 'linear feet (12ft roll width)',
    recommendedWastePercent: 12,
    typicalCostPerM2: 28,
    typicalCostPerSqFt: 2.80,
    description: 'Seamless cut-pile carpet with underpad cushion.'
  }
];

export function MaterialEstimatorModal({ room, settings, onClose, onSaveToNotes }: MaterialEstimatorModalProps) {
  const [activeTab, setActiveTab] = useState<'flooring' | 'paint' | 'summary'>('flooring');
  
  // Local unit system toggle defaulting to global settings
  const [localUnitSystem, setLocalUnitSystem] = useState<UnitSystem>(settings.unitSystem || 'metric');
  const isImperial = localUnitSystem === 'imperial';

  // Flooring states
  const [flooringType, setFlooringType] = useState<FlooringType>('hardwood');
  const [flooringWastePercent, setFlooringWastePercent] = useState<number>(10);
  const [flooringCostMetric, setFlooringCostMetric] = useState<number>(50); // $/m²
  const [flooringCostImperial, setFlooringCostImperial] = useState<number>(4.95); // $/sq ft

  // Paint states
  const [ceilingHeightMeters, setCeilingHeightMeters] = useState<number>(room.height || 2.75);
  const [paintCoats, setPaintCoats] = useState<number>(2);
  const [includeCeiling, setIncludeCeiling] = useState<boolean>(true);
  const [wallPaintCostMetric, setWallPaintCostMetric] = useState<number>(18); // $/Liter
  const [wallPaintCostImperial, setWallPaintCostImperial] = useState<number>(45); // $/Gallon
  const [doorDeductionsCount, setDoorDeductionsCount] = useState<number>(1);

  // Notification
  const [copied, setCopied] = useState<boolean>(false);
  const [savedNotes, setSavedNotes] = useState<boolean>(false);

  const selectedFlooring = FLOORING_OPTIONS.find(f => f.id === flooringType) || FLOORING_OPTIONS[0];

  // 1. Flooring Calculations
  const netFloorAreaM2 = room.area;
  const netFloorAreaSqFt = room.area * 10.7639;

  const packCoverage = isImperial ? selectedFlooring.packCoverageSqFt : selectedFlooring.packCoverageM2;
  const netFloorArea = isImperial ? netFloorAreaSqFt : netFloorAreaM2;
  const grossFlooringArea = netFloorArea * (1 + flooringWastePercent / 100);
  const flooringPacksNeeded = Math.ceil(grossFlooringArea / packCoverage);
  const totalPurchasedFlooringArea = Number((flooringPacksNeeded * packCoverage).toFixed(1));

  // Underlayment rolls
  const underlaymentRollsNeeded = isImperial 
    ? Math.ceil(grossFlooringArea / 100) // 100 sq ft rolls
    : Math.ceil(grossFlooringArea / 10); // 10 m² rolls

  const unitRateFlooring = isImperial ? flooringCostImperial : flooringCostMetric;
  const totalFlooringEstimatedCost = Math.round(totalPurchasedFlooringArea * unitRateFlooring);

  // 2. Wall & Ceiling Paint Calculations
  const grossWallAreaM2 = room.perimeter * ceilingHeightMeters;
  const windowsAreaM2 = (room.windows || []).reduce((acc, w) => acc + (w.width * w.height), 0);
  const defaultDoorsAreaM2 = doorDeductionsCount * 1.89; // standard door ~0.9m x 2.1m = 1.89m²
  const totalDeductionsM2 = windowsAreaM2 + defaultDoorsAreaM2;
  const netWallAreaM2 = Math.max(1, grossWallAreaM2 - totalDeductionsM2);
  const ceilingAreaM2 = includeCeiling ? netFloorAreaM2 : 0;

  // Spread rates:
  // Metric: 11 m² / liter per coat
  // Imperial: 350 sq ft / gallon per coat (standard architectural guideline)
  const totalLitersWallPaint = (netWallAreaM2 * paintCoats) / 11;
  const totalLitersCeilingPaint = includeCeiling ? (ceilingAreaM2 * Math.min(2, paintCoats)) / 11 : 0;
  const totalLitersCombined = totalLitersWallPaint + totalLitersCeilingPaint;
  const totalGallonsCombined = totalLitersCombined * 0.264172;

  // Sizing and cost
  const cansMetricNeeded = Math.ceil(totalLitersCombined / 4); // 4L standard container
  const cansImperialNeeded = Math.ceil(totalGallonsCombined); // 1-gal standard container

  const totalPaintEstimatedCost = isImperial
    ? Math.round(totalGallonsCombined * wallPaintCostImperial)
    : Math.round(totalLitersCombined * wallPaintCostMetric);

  // Skirting boards / Baseboards linear length
  const baseboardsLengthMeters = Math.max(1, room.perimeter - (doorDeductionsCount * 0.9));
  const baseboardsLengthFeet = baseboardsLengthMeters * 3.28084;

  // Combined Estimated Cost
  const grandTotalCost = totalFlooringEstimatedCost + totalPaintEstimatedCost;

  // Area & unit labels
  const areaUnitLabel = isImperial ? 'sq ft' : 'm²';
  const lengthUnitLabel = isImperial ? 'ft' : 'm';
  const volumeUnitLabel = isImperial ? 'Gallons' : 'Liters';

  // Generate full architectural BOM text
  const generateBOMText = () => {
    if (isImperial) {
      const lenFt = room.length * 3.28084;
      const widFt = room.width * 3.28084;
      const ceilFt = ceilingHeightMeters * 3.28084;
      const grossWallSqFt = grossWallAreaM2 * 10.7639;
      const dedSqFt = totalDeductionsM2 * 10.7639;
      const netWallSqFt = netWallAreaM2 * 10.7639;
      const ceilSqFt = ceilingAreaM2 * 10.7639;

      return `=== MATERIAL & FINISHES ESTIMATE (IMPERIAL): ${room.name.toUpperCase()} ===
Dimensions: ${lenFt.toFixed(2)} ft × ${widFt.toFixed(2)} ft (${formatFeetAndInches(room.length)} × ${formatFeetAndInches(room.width)})
Floor Area: ${netFloorAreaSqFt.toFixed(1)} sq ft · Perimeter: ${(room.perimeter * 3.28084).toFixed(1)} ft
Ceiling Height: ${ceilFt.toFixed(1)} ft

1. FLOORING:
- Material: ${selectedFlooring.name}
- Net Floor Area: ${netFloorAreaSqFt.toFixed(1)} sq ft
- Waste Allowance: ${flooringWastePercent}% (${grossFlooringArea.toFixed(1)} sq ft gross)
- Required Packs: ${flooringPacksNeeded} ${selectedFlooring.unitImperial} (${totalPurchasedFlooringArea} sq ft total)
- Underlayment: ${underlaymentRollsNeeded} roll(s) (100 sq ft/roll)
- Unit Rate: $${flooringCostImperial.toFixed(2)} / sq ft
- Estimated Flooring Cost: $${totalFlooringEstimatedCost}

2. PAINT & WALL COATING:
- Gross Wall Area: ${grossWallSqFt.toFixed(1)} sq ft
- Aperture Deductions: -${dedSqFt.toFixed(1)} sq ft (${doorDeductionsCount} door(s), ${(room.windows || []).length} window(s))
- Net Wall Paint Area: ${netWallSqFt.toFixed(1)} sq ft
${includeCeiling ? `- Ceiling Paint Area: ${ceilSqFt.toFixed(1)} sq ft\n` : ''}- Total Paint Coats: ${paintCoats} coat(s)
- Total Paint Required: ${totalGallonsCombined.toFixed(1)} Gallons (~${cansImperialNeeded} × 1-Gal cans)
- Baseboard / Trim Length: ${baseboardsLengthFeet.toFixed(1)} linear ft
- Paint Unit Rate: $${wallPaintCostImperial.toFixed(2)} / Gallon
- Estimated Paint Cost: $${totalPaintEstimatedCost}

GRAND TOTAL ESTIMATE: $${grandTotalCost}
(Calculated by AR Measure & Floor Planner Pro)`;
    }

    return `=== MATERIAL & FINISHES ESTIMATE (METRIC): ${room.name.toUpperCase()} ===
Dimensions: ${room.length.toFixed(2)}m × ${room.width.toFixed(2)}m (Area: ${room.area.toFixed(2)} m², Perimeter: ${room.perimeter.toFixed(2)}m)
Ceiling Height: ${ceilingHeightMeters.toFixed(2)}m

1. FLOORING:
- Material: ${selectedFlooring.name}
- Net Floor Area: ${netFloorAreaM2.toFixed(2)} m²
- Waste Allowance: ${flooringWastePercent}% (${grossFlooringArea.toFixed(2)} m² gross)
- Required Packs: ${flooringPacksNeeded} ${selectedFlooring.unitMetric} (${totalPurchasedFlooringArea} m² total)
- Underlayment: ${underlaymentRollsNeeded} roll(s) (10 m²/roll)
- Unit Rate: $${flooringCostMetric} / m²
- Estimated Flooring Cost: $${totalFlooringEstimatedCost}

2. PAINT & WALL COATING:
- Gross Wall Area: ${grossWallAreaM2.toFixed(2)} m²
- Aperture Deductions: -${totalDeductionsM2.toFixed(2)} m² (${doorDeductionsCount} door(s), ${(room.windows || []).length} window(s))
- Net Wall Paint Area: ${netWallAreaM2.toFixed(2)} m²
${includeCeiling ? `- Ceiling Paint Area: ${ceilingAreaM2.toFixed(2)} m²\n` : ''}- Total Paint Coats: ${paintCoats} coat(s)
- Total Paint Required: ${totalLitersCombined.toFixed(1)} Liters (~${cansMetricNeeded} × 4L cans)
- Baseboard / Skirting Length: ${baseboardsLengthMeters.toFixed(2)} meters
- Paint Unit Rate: $${wallPaintCostMetric} / Liter
- Estimated Paint Cost: $${totalPaintEstimatedCost}

GRAND TOTAL ESTIMATE: $${grandTotalCost}
(Calculated by AR Measure & Floor Planner Pro)`;
  };

  const handleCopyBOM = async () => {
    try {
      await navigator.clipboard.writeText(generateBOMText());
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // fallback
    }
  };

  const handleSaveToRoomNotes = () => {
    if (onSaveToNotes) {
      onSaveToNotes(generateBOMText());
      setSavedNotes(true);
      setTimeout(() => setSavedNotes(false), 2500);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-3 select-none">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-xl p-5 shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        {/* Top Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center">
              <Calculator className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white leading-tight">
                Material Estimator
              </h3>
              <p className="text-xs text-slate-400">
                {room.name} · {isImperial ? `${netFloorAreaSqFt.toFixed(1)} sq ft` : `${room.area.toFixed(2)} m²`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Quick Modal Unit System Switcher */}
            <div className="flex bg-slate-950 p-0.5 rounded-xl border border-slate-800 text-xs">
              <button
                type="button"
                onClick={() => setLocalUnitSystem('metric')}
                className={`px-2 py-1 rounded-lg font-bold text-[11px] transition-colors ${
                  !isImperial ? 'bg-amber-500 text-slate-950 shadow-sm' : 'text-slate-400 hover:text-white'
                }`}
              >
                Metric
              </button>
              <button
                type="button"
                onClick={() => setLocalUnitSystem('imperial')}
                className={`px-2 py-1 rounded-lg font-bold text-[11px] transition-colors ${
                  isImperial ? 'bg-amber-500 text-slate-950 shadow-sm' : 'text-slate-400 hover:text-white'
                }`}
              >
                Imperial
              </button>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tab Controls (Zero-pill button segmented bar) */}
        <div className="flex items-center gap-1 p-1 bg-slate-950/80 rounded-xl border border-slate-800 my-3">
          <button
            onClick={() => setActiveTab('flooring')}
            className={`flex-1 py-1.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors ${
              activeTab === 'flooring' ? 'bg-amber-500 text-slate-950 font-bold shadow-sm' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Flooring</span>
          </button>
          <button
            onClick={() => setActiveTab('paint')}
            className={`flex-1 py-1.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors ${
              activeTab === 'paint' ? 'bg-amber-500 text-slate-950 font-bold shadow-sm' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Paintbrush className="w-3.5 h-3.5" />
            <span>Paint & Walls</span>
          </button>
          <button
            onClick={() => setActiveTab('summary')}
            className={`flex-1 py-1.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors ${
              activeTab === 'summary' ? 'bg-amber-500 text-slate-950 font-bold shadow-sm' : 'text-slate-400 hover:text-white'
            }`}
          >
            <DollarSign className="w-3.5 h-3.5" />
            <span>Bill of Materials</span>
          </button>
        </div>

        {/* Body Content */}
        <div className="flex-1 overflow-y-auto pr-1 space-y-4">
          {/* TAB 1: FLOORING ESTIMATION */}
          {activeTab === 'flooring' && (
            <div className="space-y-4">
              {/* Output Hero Metrics */}
              <div className="bg-gradient-to-r from-amber-500/10 via-slate-800/80 to-slate-800/80 border border-amber-500/30 rounded-2xl p-4 flex items-center justify-between shadow-lg">
                <div>
                  <span className="text-[10px] text-amber-400 font-bold uppercase tracking-wider block">
                    Boxes / Packs Required
                  </span>
                  <div className="text-3xl font-black font-mono-numbers text-white mt-0.5">
                    {flooringPacksNeeded} <span className="text-xs font-medium text-slate-400">Packs</span>
                  </div>
                  <div className="text-xs text-slate-300 mt-1">
                    Covers {totalPurchasedFlooringArea} {areaUnitLabel} ({grossFlooringArea.toFixed(1)} {areaUnitLabel} gross)
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-[10px] text-slate-400 font-semibold block">Underlayment</span>
                  <div className="text-xl font-bold font-mono-numbers text-amber-400 mt-0.5">
                    {underlaymentRollsNeeded} <span className="text-xs text-slate-300 font-normal">roll(s)</span>
                  </div>
                  <span className="text-[10px] text-slate-500 block">Est. Cost: ${totalFlooringEstimatedCost}</span>
                </div>
              </div>

              {/* Material Selection Grid */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-300 block">Select Flooring Material</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {FLOORING_OPTIONS.map(opt => {
                    const isSelected = opt.id === flooringType;
                    const coverageStr = isImperial ? opt.unitImperial : opt.unitMetric;
                    return (
                      <button
                        key={opt.id}
                        onClick={() => {
                          setFlooringType(opt.id);
                          setFlooringWastePercent(opt.recommendedWastePercent);
                          if (isImperial) {
                            setFlooringCostImperial(opt.typicalCostPerSqFt);
                          } else {
                            setFlooringCostMetric(opt.typicalCostPerM2);
                          }
                        }}
                        className={`p-3 rounded-xl border text-left transition-all ${
                          isSelected
                            ? 'bg-amber-500/10 border-amber-500 text-white shadow-sm'
                            : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold">{opt.name}</span>
                          {isSelected && <Check className="w-3.5 h-3.5 text-amber-400" />}
                        </div>
                        <div className="text-[11px] font-mono-numbers text-slate-400 mt-1">
                          {coverageStr}
                        </div>
                        <div className="text-[10px] text-slate-500 mt-0.5">
                          {opt.description}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Waste & Pricing Adjustments */}
              <div className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800 space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <div>
                    <span className="text-slate-300 font-semibold">Waste Allowance:</span>
                    <span className="text-slate-400 ml-1">({flooringWastePercent}%)</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {[5, 10, 15, 20].map(w => (
                      <button
                        key={w}
                        onClick={() => setFlooringWastePercent(w)}
                        className={`px-2 py-0.5 text-xs font-mono-numbers rounded-md transition-colors ${
                          flooringWastePercent === w ? 'bg-amber-500 text-slate-950 font-bold' : 'bg-slate-800 text-slate-400 hover:text-white'
                        }`}
                      >
                        +{w}%
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-800/80">
                  <span className="text-slate-400">Material Cost ($/{areaUnitLabel}):</span>
                  <div className="flex items-center gap-1">
                    <span className="text-slate-400">$</span>
                    {isImperial ? (
                      <input
                        type="number"
                        step="0.25"
                        min="0.5"
                        max="50"
                        value={flooringCostImperial}
                        onChange={e => setFlooringCostImperial(Math.max(0.1, parseFloat(e.target.value) || 0))}
                        className="w-16 px-2 py-0.5 bg-slate-900 border border-slate-700 rounded text-center text-xs font-mono-numbers text-amber-400"
                      />
                    ) : (
                      <input
                        type="number"
                        min="5"
                        max="300"
                        value={flooringCostMetric}
                        onChange={e => setFlooringCostMetric(Math.max(1, parseFloat(e.target.value) || 0))}
                        className="w-16 px-2 py-0.5 bg-slate-900 border border-slate-700 rounded text-center text-xs font-mono-numbers text-amber-400"
                      />
                    )}
                    <span className="text-slate-400">/ {areaUnitLabel}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: PAINT & WALL ESTIMATION */}
          {activeTab === 'paint' && (
            <div className="space-y-4">
              {/* Output Hero Metrics */}
              <div className="bg-gradient-to-r from-sky-500/10 via-slate-800/80 to-slate-800/80 border border-sky-500/30 rounded-2xl p-4 flex items-center justify-between shadow-lg">
                <div>
                  <span className="text-[10px] text-sky-400 font-bold uppercase tracking-wider block">
                    Total Paint Volume
                  </span>
                  <div className="text-3xl font-black font-mono-numbers text-white mt-0.5">
                    {isImperial ? totalGallonsCombined.toFixed(1) : totalLitersCombined.toFixed(1)}{' '}
                    <span className="text-xs font-medium text-slate-400">{volumeUnitLabel}</span>
                  </div>
                  <div className="text-xs text-slate-300 mt-1">
                    ~{isImperial ? `${cansImperialNeeded} Gallon Cans` : `${cansMetricNeeded} Cans (4L)`} · {paintCoats} Coats
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-[10px] text-slate-400 font-semibold block">Net Wall Surface</span>
                  <div className="text-xl font-bold font-mono-numbers text-sky-400 mt-0.5">
                    {isImperial ? (netWallAreaM2 * 10.7639).toFixed(1) : netWallAreaM2.toFixed(1)}{' '}
                    <span className="text-xs text-slate-300 font-normal">{areaUnitLabel}</span>
                  </div>
                  <span className="text-[10px] text-slate-500 block">Est. Cost: ${totalPaintEstimatedCost}</span>
                </div>
              </div>

              {/* Wall Surface Parameters */}
              <div className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800 space-y-3">
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="text-slate-400 block mb-1">
                      Ceiling Height ({lengthUnitLabel})
                    </label>
                    {isImperial ? (
                      <input
                        type="number"
                        step="0.25"
                        min="5.0"
                        max="20.0"
                        value={Number((ceilingHeightMeters * 3.28084).toFixed(2))}
                        onChange={e => {
                          const ft = parseFloat(e.target.value) || 9.0;
                          setCeilingHeightMeters(ft / 3.28084);
                        }}
                        className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs font-mono-numbers text-white"
                      />
                    ) : (
                      <input
                        type="number"
                        step="0.05"
                        min="1.5"
                        max="6.0"
                        value={ceilingHeightMeters}
                        onChange={e => setCeilingHeightMeters(Math.max(1.0, parseFloat(e.target.value) || 2.75))}
                        className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs font-mono-numbers text-white"
                      />
                    )}
                  </div>
                  <div>
                    <label className="text-slate-400 block mb-1">Number of Coats</label>
                    <div className="flex gap-1.5">
                      {[1, 2, 3].map(c => (
                        <button
                          key={c}
                          onClick={() => setPaintCoats(c)}
                          className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                            paintCoats === c ? 'bg-sky-500 text-slate-950' : 'bg-slate-900 text-slate-400 hover:text-white'
                          }`}
                        >
                          {c} {c === 1 ? 'Coat' : 'Coats'}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-800/80">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="inclCeiling"
                      checked={includeCeiling}
                      onChange={e => setIncludeCeiling(e.target.checked)}
                      className="w-4 h-4 accent-sky-500 rounded"
                    />
                    <label htmlFor="inclCeiling" className="text-slate-200 cursor-pointer">
                      Include Ceiling (+{isImperial ? `${netFloorAreaSqFt.toFixed(1)} sq ft` : `${room.area.toFixed(1)} m²`})
                    </label>
                  </div>
                  <span className="text-[11px] text-slate-400 font-mono-numbers">
                    +{isImperial ? `${(totalLitersCeilingPaint * 0.264172).toFixed(1)} gal` : `${totalLitersCeilingPaint.toFixed(1)} L`}
                  </span>
                </div>

                <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-800/80">
                  <div>
                    <span className="text-slate-300">Door & Window Deductions:</span>
                    <div className="text-[10px] text-slate-400">
                      {(room.windows || []).length} window(s) + {doorDeductionsCount} door(s)
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-slate-400">Doors:</span>
                    <input
                      type="number"
                      min="0"
                      max="10"
                      value={doorDeductionsCount}
                      onChange={e => setDoorDeductionsCount(Math.max(0, parseInt(e.target.value) || 0))}
                      className="w-12 px-2 py-0.5 bg-slate-900 border border-slate-700 rounded text-center text-xs font-mono-numbers text-white"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-800/80">
                  <span className="text-slate-400">Paint Cost per {isImperial ? 'Gallon' : 'Liter'} ($):</span>
                  <div className="flex items-center gap-1">
                    <span className="text-slate-400">$</span>
                    {isImperial ? (
                      <input
                        type="number"
                        min="15"
                        max="150"
                        value={wallPaintCostImperial}
                        onChange={e => setWallPaintCostImperial(Math.max(1, parseFloat(e.target.value) || 0))}
                        className="w-16 px-2 py-0.5 bg-slate-900 border border-slate-700 rounded text-center text-xs font-mono-numbers text-sky-400"
                      />
                    ) : (
                      <input
                        type="number"
                        min="5"
                        max="80"
                        value={wallPaintCostMetric}
                        onChange={e => setWallPaintCostMetric(Math.max(1, parseFloat(e.target.value) || 0))}
                        className="w-16 px-2 py-0.5 bg-slate-900 border border-slate-700 rounded text-center text-xs font-mono-numbers text-sky-400"
                      />
                    )}
                  </div>
                </div>
              </div>

              {/* Trim / Baseboard item */}
              <div className="bg-slate-950 p-3 rounded-2xl border border-slate-800 flex items-center justify-between text-xs">
                <div>
                  <span className="font-semibold text-slate-200">Baseboards & Trim Length</span>
                  <div className="text-[10px] text-slate-400">Room perimeter minus door openings</div>
                </div>
                <span className="text-sm font-bold font-mono-numbers text-amber-400">
                  {isImperial ? `${baseboardsLengthFeet.toFixed(1)} linear ft` : `${baseboardsLengthMeters.toFixed(1)} m`}
                </span>
              </div>
            </div>
          )}

          {/* TAB 3: BILL OF MATERIALS SUMMARY */}
          {activeTab === 'summary' && (
            <div className="space-y-3">
              <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 font-mono text-xs text-slate-300 whitespace-pre-wrap leading-relaxed">
                {generateBOMText()}
              </div>

              <div className="flex items-center justify-between bg-slate-800/50 p-3 rounded-xl border border-slate-800">
                <span className="text-xs font-semibold text-slate-300">Total Material Budget:</span>
                <span className="text-lg font-black font-mono-numbers text-amber-400">
                  ${grandTotalCost}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Bottom Actions */}
        <div className="flex items-center justify-between gap-2 pt-3 border-t border-slate-800 mt-2">
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyBOM}
              className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied BOM!' : 'Copy Summary'}</span>
            </button>

            {onSaveToNotes && (
              <button
                onClick={handleSaveToRoomNotes}
                className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors"
              >
                {savedNotes ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Sparkles className="w-3.5 h-3.5 text-amber-400" />}
                <span>{savedNotes ? 'Saved to Notes!' : 'Save to Notes'}</span>
              </button>
            )}
          </div>

          <button
            onClick={onClose}
            className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-xs transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
