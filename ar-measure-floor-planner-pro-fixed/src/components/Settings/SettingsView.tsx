import { useState } from 'react';
import { AppSettings, LengthUnit, AreaUnit, VolumeUnit, UnitSystem, ProjectRecord, RoomRecord } from '../../types';
import { getUpdatedSettingsForUnitSystem, formatLength, formatArea, formatFeetAndInches } from '../../utils/units';
import { getStoredProjects } from '../../utils/storage';
import { 
  downloadRoomDXF, downloadProjectDXF, 
  downloadRoomSVG, downloadProjectSVG,
  downloadRoomCSV, downloadProjectCSV,
  shareDXF, shareSVG, sharePDF, shareCSV,
  DxfOptions, SvgOptions 
} from '../../utils/floorPlanExporters';
import { exportProjectToPDF } from '../../utils/pdfGenerator';
import { 
  Sliders, Volume2, Smartphone, FileText, Globe, 
  ShieldAlert, RotateCcw, Check, Sparkles, Scale, RefreshCw, Compass,
  FileDown, Download, Layers, Box, PenTool, Printer, CheckCircle2, ChevronRight,
  Share2, Send, Table, FileSpreadsheet, BookOpen
} from 'lucide-react';

interface SettingsViewProps {
  settings: AppSettings;
  onUpdateSettings: (settings: AppSettings) => void;
  onOpenTutorial: () => void;
  onOpenUserManual?: () => void;
  activeProject?: ProjectRecord;
  projects?: ProjectRecord[];
  activeRoom?: RoomRecord;
}

export function SettingsView({
  settings,
  onUpdateSettings,
  onOpenTutorial,
  onOpenUserManual,
  activeProject: propActiveProject,
  projects: propProjects,
  activeRoom: propActiveRoom
}: SettingsViewProps) {
  // Projects & Rooms context (with fallback to storage)
  const availableProjects = (propProjects && propProjects.length > 0) ? propProjects : getStoredProjects();
  const [selectedProjectId, setSelectedProjectId] = useState<string>(
    propActiveProject?.id || availableProjects[0]?.id || ''
  );
  
  const currentProject = availableProjects.find(p => p.id === selectedProjectId) || availableProjects[0];
  const rooms = currentProject?.rooms || [];

  const [selectedRoomId, setSelectedRoomId] = useState<string>(
    propActiveRoom?.id || rooms[0]?.id || 'all'
  );

  const selectedRoom = rooms.find(r => r.id === selectedRoomId);

  // Calibration and settings state
  const [calibFactorInput, setCalibFactorInput] = useState(settings.calibrationFactor.toString());
  const [deviceHeightInput, setDeviceHeightInput] = useState((settings.deviceHeight ?? 1.4).toString());
  const [saveToast, setSaveToast] = useState<string | null>(null);

  // File Export Options
  const [dxfUnit, setDxfUnit] = useState<'mm' | 'm' | 'in'>('mm');
  const [dxfIncludeFurniture, setDxfIncludeFurniture] = useState(true);
  const [dxfIncludeDimensions, setDxfIncludeDimensions] = useState(true);

  const [svgTheme, setSvgTheme] = useState<'dark' | 'light'>('dark');
  const [svgIncludeGrid, setSvgIncludeGrid] = useState(true);
  const [svgIncludeTitleBlock, setSvgIncludeTitleBlock] = useState(true);

  const handleUpdate = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    const next = { ...settings, [key]: value };
    onUpdateSettings(next);
    showNotice();
  };

  const showNotice = (msg: string = 'Settings updated') => {
    setSaveToast(msg);
    setTimeout(() => setSaveToast(null), 2400);
  };

  // Global Unit System Toggle
  const handleToggleUnitSystem = (system: UnitSystem) => {
    const updated = getUpdatedSettingsForUnitSystem(settings, system);
    onUpdateSettings(updated);
    showNotice(`Switched globally to ${system === 'imperial' ? 'Imperial (ft / in)' : 'Metric (m / cm)'}`);
  };

  const handleSaveCalibration = () => {
    const val = parseFloat(calibFactorInput);
    if (!isNaN(val) && val > 0.5 && val < 2.0) {
      handleUpdate('calibrationFactor', val);
    }
  };

  const handleSaveDeviceHeight = () => {
    const val = parseFloat(deviceHeightInput);
    if (!isNaN(val) && val >= 0.6 && val <= 2.5) {
      handleUpdate('deviceHeight', val);
    }
  };

  const handleResetCalibration = () => {
    setCalibFactorInput('1.000');
    handleUpdate('calibrationFactor', 1.0);
  };

  // Export Handlers
  const handleExportDXF = () => {
    if (!currentProject) return;
    const dxfOpts: DxfOptions = {
      unit: dxfUnit,
      includeFurniture: dxfIncludeFurniture,
      includeDimensions: dxfIncludeDimensions,
      includeWalls: true,
      includeAnnotations: true
    };

    if (selectedRoomId === 'all' || !selectedRoom) {
      downloadProjectDXF(currentProject, settings, dxfOpts);
      showNotice(`Exported all rooms in ${currentProject.name} to DXF`);
    } else {
      downloadRoomDXF(selectedRoom, currentProject, settings, dxfOpts);
      showNotice(`Exported ${selectedRoom.name} to CAD DXF`);
    }
  };

  const handleExportSVG = () => {
    if (!currentProject) return;
    const svgOpts: SvgOptions = {
      theme: svgTheme,
      includeGrid: svgIncludeGrid,
      includeTitleBlock: svgIncludeTitleBlock,
      includeFurniture: true,
      includeDimensions: true,
      includeScaleBar: true
    };

    if (selectedRoomId === 'all' || !selectedRoom) {
      downloadProjectSVG(currentProject, settings, svgOpts);
      showNotice(`Exported full project vectors to SVG`);
    } else {
      downloadRoomSVG(selectedRoom, currentProject, settings, svgOpts);
      showNotice(`Exported ${selectedRoom.name} to Vector SVG`);
    }
  };

  const handleExportPDF = () => {
    if (!currentProject) return;
    exportProjectToPDF(currentProject, settings);
    showNotice(`Generated Architectural Survey Report PDF`);
  };

  const handleExportCSV = () => {
    if (!currentProject) return;
    if (selectedRoomId === 'all' || !selectedRoom) {
      downloadProjectCSV(currentProject, settings);
      showNotice(`Exported all rooms in ${currentProject.name} to CAD CSV schedule`);
    } else {
      downloadRoomCSV(selectedRoom, currentProject, settings);
      showNotice(`Exported ${selectedRoom.name} CAD survey points & schedule to CSV`);
    }
  };

  // Web Share API Handlers
  const [isSharing, setIsSharing] = useState<string | null>(null);

  const handleShareCSV = async () => {
    if (!currentProject) return;
    setIsSharing('csv');
    const target = (selectedRoomId === 'all' || !selectedRoom) ? currentProject : selectedRoom;
    try {
      const res = await shareCSV(target, currentProject, settings);
      showNotice(res.message);
    } catch (e) {
      console.error('Error sharing CSV:', e);
    } finally {
      setIsSharing(null);
    }
  };

  const handleShareDXF = async () => {
    if (!currentProject) return;
    setIsSharing('dxf');
    const dxfOpts: DxfOptions = {
      unit: dxfUnit,
      includeFurniture: dxfIncludeFurniture,
      includeDimensions: dxfIncludeDimensions,
      includeWalls: true,
      includeAnnotations: true
    };

    const target = (selectedRoomId === 'all' || !selectedRoom) ? currentProject : selectedRoom;
    try {
      const res = await shareDXF(target, currentProject, settings, dxfOpts);
      showNotice(res.message);
    } catch (e) {
      console.error('Error sharing DXF:', e);
    } finally {
      setIsSharing(null);
    }
  };

  const handleShareSVG = async () => {
    if (!currentProject) return;
    setIsSharing('svg');
    const svgOpts: SvgOptions = {
      theme: svgTheme,
      includeGrid: svgIncludeGrid,
      includeTitleBlock: svgIncludeTitleBlock,
      includeFurniture: true,
      includeDimensions: true,
      includeScaleBar: true
    };

    const target = (selectedRoomId === 'all' || !selectedRoom) ? currentProject : selectedRoom;
    try {
      const res = await shareSVG(target, currentProject, settings, svgOpts);
      showNotice(res.message);
    } catch (e) {
      console.error('Error sharing SVG:', e);
    } finally {
      setIsSharing(null);
    }
  };

  const handleSharePDF = async () => {
    if (!currentProject) return;
    setIsSharing('pdf');
    try {
      const res = await sharePDF(currentProject, settings);
      showNotice(res.message);
    } catch (e) {
      console.error('Error sharing PDF:', e);
    } finally {
      setIsSharing(null);
    }
  };

  const isImperial = settings.unitSystem === 'imperial';

  return (
    <div className="relative w-full h-full min-h-0 bg-slate-950 flex flex-col select-none overflow-y-auto pb-6">
      {/* Header */}
      <div className="p-4 bg-slate-900/80 border-b border-slate-800 backdrop-blur-md sticky top-0 z-20 flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-white">App Settings</h2>
          <p className="text-xs text-slate-400">Measurement preferences, CAD/vector export & calibration</p>
        </div>
        <div className="flex items-center gap-2">
          {onOpenUserManual && (
            <button
              onClick={onOpenUserManual}
              className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-xs flex items-center gap-1.5 transition-colors shadow-sm"
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>User Manual</span>
            </button>
          )}
          <button
            onClick={onOpenTutorial}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden sm:inline">Tutorial</span>
          </button>
        </div>
      </div>

      <div className="p-4 space-y-6 max-w-xl mx-auto w-full">
        {/* SECTION 1: GLOBAL UNIT SYSTEM TOGGLE */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-amber-500 uppercase tracking-wider flex items-center gap-1.5">
              <Scale className="w-3.5 h-3.5" />
              <span>Global Unit System</span>
            </h3>
            <span className="text-[11px] font-mono-numbers px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
              {isImperial ? 'Imperial Active' : 'Metric Active'}
            </span>
          </div>

          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 space-y-4">
            {/* Primary Toggle Switch */}
            <div className="grid grid-cols-2 gap-2 p-1 bg-slate-950/80 rounded-2xl border border-slate-800">
              <button
                type="button"
                onClick={() => handleToggleUnitSystem('metric')}
                className={`py-3 px-3 rounded-xl flex flex-col items-center justify-center transition-all ${
                  !isImperial
                    ? 'bg-amber-500 text-slate-950 font-black shadow-lg scale-[1.01]'
                    : 'text-slate-400 hover:text-white hover:bg-slate-900'
                }`}
              >
                <div className="text-sm font-bold tracking-tight">Metric System</div>
                <div className={`text-[10px] mt-0.5 ${!isImperial ? 'text-slate-900 font-semibold' : 'text-slate-500'}`}>
                  Meters, cm, mm (m², m³)
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleToggleUnitSystem('imperial')}
                className={`py-3 px-3 rounded-xl flex flex-col items-center justify-center transition-all ${
                  isImperial
                    ? 'bg-amber-500 text-slate-950 font-black shadow-lg scale-[1.01]'
                    : 'text-slate-400 hover:text-white hover:bg-slate-900'
                }`}
              >
                <div className="text-sm font-bold tracking-tight">Imperial System</div>
                <div className={`text-[10px] mt-0.5 ${isImperial ? 'text-slate-900 font-semibold' : 'text-slate-500'}`}>
                  Feet, inches, yards (ft², ft³)
                </div>
              </button>
            </div>

            {/* Live conversion sample card */}
            <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3 flex items-center justify-between text-xs">
              <div className="space-y-0.5">
                <div className="text-slate-400 text-[11px]">Live Sample Preview (Room 5.8m × 4.25m):</div>
                <div className="font-mono-numbers font-semibold text-white">
                  {formatLength(5.8, settings.defaultLengthUnit)} × {formatLength(4.25, settings.defaultLengthUnit)}
                  <span className="text-slate-500 mx-1.5">·</span>
                  <span className="text-amber-400 font-bold">{formatArea(24.65, settings.defaultAreaUnit)}</span>
                </div>
                {isImperial && (
                  <div className="text-[10px] font-mono-numbers text-slate-400">
                    Architectural: {formatFeetAndInches(5.8)} × {formatFeetAndInches(4.25)}
                  </div>
                )}
              </div>
              <div className="text-right">
                <span className="text-[10px] uppercase font-bold tracking-wider text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-1 rounded-lg inline-flex items-center gap-1">
                  <Check className="w-3 h-3" /> Syncs All Views
                </span>
              </div>
            </div>

            {/* Fine-Tuning Length Unit */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs text-slate-300 font-semibold">Active Length Unit</label>
                <span className="text-[10px] text-slate-500">
                  {isImperial ? 'Recommended: ft or in' : 'Recommended: m or cm'}
                </span>
              </div>
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
                {(['m', 'cm', 'mm', 'ft', 'in', 'yd'] as LengthUnit[]).map(u => {
                  const isUnitImperial = ['ft', 'in', 'yd'].includes(u);
                  return (
                    <button
                      key={u}
                      onClick={() => {
                        const newSystem: UnitSystem = isUnitImperial ? 'imperial' : 'metric';
                        const updated = getUpdatedSettingsForUnitSystem(settings, newSystem, u);
                        onUpdateSettings(updated);
                        showNotice(`Length set to ${u}`);
                      }}
                      className={`py-2 rounded-xl text-xs font-mono-numbers font-semibold transition-all ${
                        settings.defaultLengthUnit === u
                          ? 'bg-amber-500 text-slate-950 font-bold shadow-md'
                          : 'bg-slate-800/80 text-slate-400 hover:text-white'
                      }`}
                    >
                      {u}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Fine-Tuning Area Unit */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs text-slate-300 font-semibold">Active Area Unit</label>
                <span className="text-[10px] text-slate-500">Used in floor plans, scans & reports</span>
              </div>
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
                {(['m²', 'ft²', 'yd²', 'cm²', 'mm²', 'in²'] as AreaUnit[]).map(u => (
                  <button
                    key={u}
                    onClick={() => handleUpdate('defaultAreaUnit', u)}
                    className={`py-2 rounded-xl text-xs font-mono-numbers font-semibold transition-all ${
                      settings.defaultAreaUnit === u
                        ? 'bg-amber-500 text-slate-950 font-bold shadow-md'
                        : 'bg-slate-800/80 text-slate-400 hover:text-white'
                    }`}
                  >
                    {u}
                  </button>
                ))}
              </div>
            </div>

            {/* Fine-Tuning Volume Unit */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs text-slate-300 font-semibold">Active Volume Unit</label>
                <span className="text-[10px] text-slate-500">Used in 3D bounding box scans</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                {(['m³', 'ft³', 'cm³', 'yd³'] as VolumeUnit[]).map(u => (
                  <button
                    key={u}
                    onClick={() => handleUpdate('defaultVolumeUnit', u)}
                    className={`py-2 rounded-xl text-xs font-mono-numbers font-semibold transition-all ${
                      settings.defaultVolumeUnit === u
                        ? 'bg-amber-500 text-slate-950 font-bold shadow-md'
                        : 'bg-slate-800/80 text-slate-400 hover:text-white'
                    }`}
                  >
                    {u}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* SECTION 2: FILE EXPORT MENU (DXF, SVG, PDF) */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-amber-500 uppercase tracking-wider flex items-center gap-1.5">
              <FileDown className="w-3.5 h-3.5" />
              <span>File Export & CAD Integration</span>
            </h3>
            <span className="text-[10px] font-mono-numbers text-slate-400 bg-slate-900 border border-slate-800 px-2 py-0.5 rounded-full">
              DXF · SVG · PDF
            </span>
          </div>

          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 space-y-5">
            {/* Export Scope Selector (Project & Room) */}
            <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-3 space-y-2.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-200">Export Scope & Target</span>
                {selectedRoom && selectedRoomId !== 'all' ? (
                  <span className="text-[11px] font-mono-numbers text-amber-400">
                    {formatLength(selectedRoom.length, settings.defaultLengthUnit)} × {formatLength(selectedRoom.width, settings.defaultLengthUnit)} ({formatArea(selectedRoom.area, settings.defaultAreaUnit)})
                  </span>
                ) : (
                  <span className="text-[11px] font-mono-numbers text-slate-400">
                    {rooms.length} room{rooms.length !== 1 ? 's' : ''} in {currentProject?.name}
                  </span>
                )}
              </div>

              {/* Room Selection Buttons */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none]">
                <button
                  onClick={() => setSelectedRoomId('all')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                    selectedRoomId === 'all'
                      ? 'bg-amber-500 text-slate-950 font-bold shadow'
                      : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                  }`}
                >
                  All Rooms (Project Plan)
                </button>

                {rooms.map(r => (
                  <button
                    key={r.id}
                    onClick={() => setSelectedRoomId(r.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                      selectedRoomId === r.id
                        ? 'bg-amber-500 text-slate-950 font-bold shadow'
                        : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                    }`}
                  >
                    {r.name}
                  </button>
                ))}
              </div>
            </div>

            {/* QUICK ONE-CLICK EXPORT & SHARE ACTIONS */}
            <div>
              <div className="flex items-center justify-between text-[11px] font-semibold text-slate-400 mb-2 uppercase tracking-wide">
                <span>Quick Actions ({selectedRoomId === 'all' ? 'All Rooms' : selectedRoom?.name || 'Selected'}):</span>
                <span className="text-[10px] text-amber-400/80 font-normal flex items-center gap-1">
                  <Share2 className="w-3 h-3" /> Web Share Supported
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {/* 1. DXF CAD */}
                <div className="p-2.5 rounded-xl bg-slate-800/80 border border-slate-700/80 flex flex-col justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Box className="w-4 h-4 text-sky-400 shrink-0" />
                    <div>
                      <div className="font-bold text-xs text-white">CAD (.DXF)</div>
                      <div className="text-[10px] text-slate-400 font-mono-numbers">AutoCAD / Rhino</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 pt-1">
                    <button
                      onClick={handleExportDXF}
                      title="Download DXF file"
                      className="flex-1 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-700 text-sky-300 text-xs font-semibold flex items-center justify-center gap-1 transition-colors border border-slate-800"
                    >
                      <Download className="w-3 h-3" />
                      <span>Save</span>
                    </button>
                    <button
                      onClick={handleShareDXF}
                      disabled={isSharing === 'dxf'}
                      title="Share DXF via Web Share"
                      className="flex-1 py-1.5 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 text-xs font-bold flex items-center justify-center gap-1 transition-colors"
                    >
                      <Share2 className="w-3 h-3" />
                      <span>Share</span>
                    </button>
                  </div>
                </div>

                {/* 2. CSV CAD DATA */}
                <div className="p-2.5 rounded-xl bg-slate-800/80 border border-slate-700/80 flex flex-col justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Table className="w-4 h-4 text-teal-400 shrink-0" />
                    <div>
                      <div className="font-bold text-xs text-white">Data (.CSV)</div>
                      <div className="text-[10px] text-slate-400 font-mono-numbers">Civil 3D / Excel</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 pt-1">
                    <button
                      onClick={handleExportCSV}
                      title="Download CSV file"
                      className="flex-1 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-700 text-teal-300 text-xs font-semibold flex items-center justify-center gap-1 transition-colors border border-slate-800"
                    >
                      <Download className="w-3 h-3" />
                      <span>Save</span>
                    </button>
                    <button
                      onClick={handleShareCSV}
                      disabled={isSharing === 'csv'}
                      title="Share CSV via Web Share"
                      className="flex-1 py-1.5 rounded-lg bg-teal-500 hover:bg-teal-400 text-slate-950 text-xs font-bold flex items-center justify-center gap-1 transition-colors"
                    >
                      <Share2 className="w-3 h-3" />
                      <span>Share</span>
                    </button>
                  </div>
                </div>

                {/* 3. SVG VECTOR */}
                <div className="p-2.5 rounded-xl bg-slate-800/80 border border-slate-700/80 flex flex-col justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <PenTool className="w-4 h-4 text-amber-400 shrink-0" />
                    <div>
                      <div className="font-bold text-xs text-white">Vector (.SVG)</div>
                      <div className="text-[10px] text-slate-400 font-mono-numbers">Illustrator / Figma</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 pt-1">
                    <button
                      onClick={handleExportSVG}
                      title="Download SVG file"
                      className="flex-1 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-700 text-amber-300 text-xs font-semibold flex items-center justify-center gap-1 transition-colors border border-slate-800"
                    >
                      <Download className="w-3 h-3" />
                      <span>Save</span>
                    </button>
                    <button
                      onClick={handleShareSVG}
                      disabled={isSharing === 'svg'}
                      title="Share SVG via Web Share"
                      className="flex-1 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold flex items-center justify-center gap-1 transition-colors"
                    >
                      <Share2 className="w-3 h-3" />
                      <span>Share</span>
                    </button>
                  </div>
                </div>

                {/* 4. PDF REPORT */}
                <div className="p-2.5 rounded-xl bg-slate-800/80 border border-slate-700/80 flex flex-col justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-emerald-400 shrink-0" />
                    <div>
                      <div className="font-bold text-xs text-white">Report (.PDF)</div>
                      <div className="text-[10px] text-slate-400 font-mono-numbers">Survey Dossier</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 pt-1">
                    <button
                      onClick={handleExportPDF}
                      title="Download PDF file"
                      className="flex-1 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-700 text-emerald-300 text-xs font-semibold flex items-center justify-center gap-1 transition-colors border border-slate-800"
                    >
                      <Download className="w-3 h-3" />
                      <span>Save</span>
                    </button>
                    <button
                      onClick={handleSharePDF}
                      disabled={isSharing === 'pdf'}
                      title="Share PDF via Web Share"
                      className="flex-1 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold flex items-center justify-center gap-1 transition-colors"
                    >
                      <Share2 className="w-3 h-3" />
                      <span>Share</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* FORMAT CARD 1: DXF FOR CAD SOFTWARE */}
            <div className="border-t border-slate-800/80 pt-4 space-y-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-sky-500/10 border border-sky-500/20 text-sky-400 flex items-center justify-center">
                    <Box className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-white flex items-center gap-1.5">
                      <span>DXF Format (AutoCAD & CAD Software)</span>
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-sky-500/20 text-sky-300 font-mono-numbers">
                        .DXF
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-400">
                      Standard layered CAD drawing compatible with AutoCAD, LibreCAD, Rhino, SketchUp & FreeCAD
                    </div>
                  </div>
                </div>
              </div>

              {/* DXF Options */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 bg-slate-950/50 p-2.5 rounded-xl border border-slate-800/60 text-xs">
                <div>
                  <label className="text-[11px] text-slate-400 font-semibold block mb-1">CAD Coordinate Unit</label>
                  <div className="grid grid-cols-3 gap-1">
                    {(['mm', 'm', 'in'] as const).map(u => (
                      <button
                        key={u}
                        onClick={() => setDxfUnit(u)}
                        className={`py-1 rounded-lg text-xs font-mono-numbers uppercase transition-colors ${
                          dxfUnit === u
                            ? 'bg-sky-500 text-slate-950 font-bold'
                            : 'bg-slate-900 text-slate-400 hover:text-white'
                        }`}
                      >
                        {u}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex flex-col justify-center space-y-1.5 pt-1 sm:pt-0">
                  <label className="flex items-center gap-2 text-[11px] text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={dxfIncludeFurniture}
                      onChange={e => setDxfIncludeFurniture(e.target.checked)}
                      className="w-4 h-4 accent-sky-500 rounded"
                    />
                    <span>Include Furniture layer</span>
                  </label>
                  <label className="flex items-center gap-2 text-[11px] text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={dxfIncludeDimensions}
                      onChange={e => setDxfIncludeDimensions(e.target.checked)}
                      className="w-4 h-4 accent-sky-500 rounded"
                    />
                    <span>Include Dimension annotations</span>
                  </label>
                </div>
              </div>

              {/* DXF Action Buttons */}
              <div className="flex items-center gap-2">
                <button
                  onClick={handleExportDXF}
                  className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-sky-400 border border-slate-700/80 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors"
                >
                  <Download className="w-4 h-4" />
                  <span>Download DXF</span>
                </button>
                <button
                  onClick={handleShareDXF}
                  disabled={isSharing === 'dxf'}
                  className="flex-1 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors shadow-sm"
                >
                  <Share2 className="w-4 h-4" />
                  <span>{isSharing === 'dxf' ? 'Sharing...' : 'Share DXF'}</span>
                </button>
              </div>
            </div>

            {/* FORMAT CARD: CSV FOR CAD DATA & POINT CLOUD SCHEDULES */}
            <div className="border-t border-slate-800/80 pt-4 space-y-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-teal-500/10 border border-teal-500/20 text-teal-400 flex items-center justify-center">
                    <Table className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-white flex items-center gap-1.5">
                      <span>CSV Format (CAD Points, Wall Nodes & Schedules)</span>
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-teal-500/20 text-teal-300 font-mono-numbers">
                        .CSV
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-400">
                      Standard tabular CAD point file compatible with AutoCAD, Autodesk Civil 3D, Revit Schedules, Rhino & Excel
                    </div>
                  </div>
                </div>
              </div>

              {/* CSV Details & Preview Box */}
              <div className="bg-slate-950/50 p-3 rounded-xl border border-slate-800/60 text-xs space-y-2">
                <div className="flex items-center justify-between text-[11px] text-slate-400 border-b border-slate-800/80 pb-2">
                  <span className="font-semibold text-slate-300">Target: {selectedRoom ? selectedRoom.name : `All Rooms (${rooms.length})`}</span>
                  <span className="font-mono-numbers text-teal-400">Comma-Separated Values (RFC 4180)</span>
                </div>
                
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                  <div className="bg-slate-900/80 p-2 rounded-lg border border-slate-800">
                    <span className="text-slate-400 block text-[10px]">Boundary Corners</span>
                    <span className="font-mono-numbers font-bold text-white">
                      {selectedRoom ? `${selectedRoom.corners?.length || 4} Points` : `${rooms.reduce((s, r) => s + (r.corners?.length || 4), 0)} Points`}
                    </span>
                  </div>
                  <div className="bg-slate-900/80 p-2 rounded-lg border border-slate-800">
                    <span className="text-slate-400 block text-[10px]">Wall Segments</span>
                    <span className="font-mono-numbers font-bold text-white">
                      {selectedRoom ? `${selectedRoom.walls?.length || 4} Walls` : `${rooms.length * 4} Walls`}
                    </span>
                  </div>
                  <div className="bg-slate-900/80 p-2 rounded-lg border border-slate-800">
                    <span className="text-slate-400 block text-[10px]">Openings & Windows</span>
                    <span className="font-mono-numbers font-bold text-white">
                      {selectedRoom ? `${selectedRoom.windows?.length || 0} Windows` : `${rooms.reduce((s, r) => s + (r.windows?.length || 0), 0)} Windows`}
                    </span>
                  </div>
                  <div className="bg-slate-900/80 p-2 rounded-lg border border-slate-800">
                    <span className="text-slate-400 block text-[10px]">Furniture / BOM</span>
                    <span className="font-mono-numbers font-bold text-white">
                      {selectedRoom ? `${selectedRoom.furniture?.length || 0} Fixtures` : `${rooms.reduce((s, r) => s + (r.furniture?.length || 0), 0)} Fixtures`}
                    </span>
                  </div>
                </div>

                <div className="text-[10px] text-slate-400 flex items-center gap-1.5 pt-1">
                  <CheckCircle2 className="w-3 h-3 text-teal-400 shrink-0" />
                  <span>Includes Civil 3D P,N,E,Z point coordinates, gross wall areas, and bill of materials (BOM).</span>
                </div>
              </div>

              {/* CSV Action Buttons */}
              <div className="flex items-center gap-2">
                <button
                  onClick={handleExportCSV}
                  className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-teal-400 border border-slate-700/80 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors"
                >
                  <Download className="w-4 h-4" />
                  <span>Download CSV</span>
                </button>
                <button
                  onClick={handleShareCSV}
                  disabled={isSharing === 'csv'}
                  className="flex-1 py-2.5 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors shadow-sm"
                >
                  <Share2 className="w-4 h-4" />
                  <span>{isSharing === 'csv' ? 'Sharing...' : 'Share CSV'}</span>
                </button>
              </div>
            </div>

            {/* FORMAT CARD 2: SVG FOR VECTOR EDITING */}
            <div className="border-t border-slate-800/80 pt-4 space-y-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center">
                    <PenTool className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-white flex items-center gap-1.5">
                      <span>SVG Format (Vector Graphics & Web)</span>
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-mono-numbers">
                        .SVG
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-400">
                      Editable vector floor plan with grouped elements for Adobe Illustrator, Inkscape, Figma & print
                    </div>
                  </div>
                </div>
              </div>

              {/* SVG Options */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 bg-slate-950/50 p-2.5 rounded-xl border border-slate-800/60 text-xs">
                <div>
                  <label className="text-[11px] text-slate-400 font-semibold block mb-1">Visual Theme</label>
                  <div className="grid grid-cols-2 gap-1">
                    <button
                      onClick={() => setSvgTheme('dark')}
                      className={`py-1 rounded-lg text-xs transition-colors ${
                        svgTheme === 'dark'
                          ? 'bg-amber-500 text-slate-950 font-bold'
                          : 'bg-slate-900 text-slate-400 hover:text-white'
                      }`}
                    >
                      Dark Blueprint
                    </button>
                    <button
                      onClick={() => setSvgTheme('light')}
                      className={`py-1 rounded-lg text-xs transition-colors ${
                        svgTheme === 'light'
                          ? 'bg-amber-500 text-slate-950 font-bold'
                          : 'bg-slate-900 text-slate-400 hover:text-white'
                      }`}
                    >
                      Clean White
                    </button>
                  </div>
                </div>

                <div className="flex flex-col justify-center space-y-1.5 pt-1 sm:pt-0">
                  <label className="flex items-center gap-2 text-[11px] text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={svgIncludeGrid}
                      onChange={e => setSvgIncludeGrid(e.target.checked)}
                      className="w-4 h-4 accent-amber-500 rounded"
                    />
                    <span>Include Reference Grid (1m)</span>
                  </label>
                  <label className="flex items-center gap-2 text-[11px] text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={svgIncludeTitleBlock}
                      onChange={e => setSvgIncludeTitleBlock(e.target.checked)}
                      className="w-4 h-4 accent-amber-500 rounded"
                    />
                    <span>Include Architectural Title Block</span>
                  </label>
                </div>
              </div>

              {/* SVG Action Buttons */}
              <div className="flex items-center gap-2">
                <button
                  onClick={handleExportSVG}
                  className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-400 border border-slate-700/80 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors"
                >
                  <Download className="w-4 h-4" />
                  <span>Download SVG</span>
                </button>
                <button
                  onClick={handleShareSVG}
                  disabled={isSharing === 'svg'}
                  className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors shadow-sm"
                >
                  <Share2 className="w-4 h-4" />
                  <span>{isSharing === 'svg' ? 'Sharing...' : 'Share SVG'}</span>
                </button>
              </div>
            </div>

            {/* FORMAT CARD 3: PDF ARCHITECTURAL SURVEY REPORT */}
            <div className="border-t border-slate-800/80 pt-4 space-y-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center">
                    <FileText className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-white flex items-center gap-1.5">
                      <span>PDF Format (Architectural Survey Dossier)</span>
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-mono-numbers">
                        .PDF
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-400">
                      Multi-page survey report with cover overview, 2D floor plans, dimension schedules & bill of materials
                    </div>
                  </div>
                </div>
              </div>

              {/* PDF Options */}
              <div className="bg-slate-950/50 p-2.5 rounded-xl border border-slate-800/60 text-xs flex items-center justify-between">
                <div>
                  <span className="text-[11px] text-slate-400 font-semibold block">Report Paper Format</span>
                  <span className="text-xs text-slate-200 uppercase font-mono-numbers">{settings.pdfPaperSize || 'a4'} Portrait</span>
                </div>
                <div className="grid grid-cols-3 gap-1">
                  {(['a4', 'a3', 'letter'] as const).map(sz => (
                    <button
                      key={sz}
                      onClick={() => handleUpdate('pdfPaperSize', sz)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-mono-numbers uppercase transition-colors ${
                        settings.pdfPaperSize === sz
                          ? 'bg-emerald-500 text-slate-950 font-bold'
                          : 'bg-slate-900 text-slate-400 hover:text-white'
                      }`}
                    >
                      {sz}
                    </button>
                  ))}
                </div>
              </div>

              {/* PDF Action Buttons */}
              <div className="flex items-center gap-2">
                <button
                  onClick={handleExportPDF}
                  className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-emerald-400 border border-slate-700/80 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors"
                >
                  <Download className="w-4 h-4" />
                  <span>Download PDF</span>
                </button>
                <button
                  onClick={handleSharePDF}
                  disabled={isSharing === 'pdf'}
                  className="flex-1 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors shadow-sm"
                >
                  <Share2 className="w-4 h-4" />
                  <span>{isSharing === 'pdf' ? 'Sharing...' : 'Share PDF'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* SECTION 3: AR TRACKING & CALIBRATION */}
        <div className="space-y-3">
          <h3 className="text-xs font-bold text-amber-500 uppercase tracking-wider">AR & Sensor Calibration</h3>
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 space-y-4">
            {/* Plane Visualization Toggle */}
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs font-semibold text-slate-200">Show Surface Plane Grids</div>
                <div className="text-[11px] text-slate-400">Renders detected floor/wall tracking mesh</div>
              </div>
              <input
                type="checkbox"
                checked={settings.enablePlaneVisualization}
                onChange={e => handleUpdate('enablePlaneVisualization', e.target.checked)}
                className="w-5 h-5 accent-amber-500 rounded"
              />
            </div>

            {/* Feature Points Toggle */}
            <div className="flex items-center justify-between border-t border-slate-800/80 pt-3">
              <div>
                <div className="text-xs font-semibold text-slate-200">Optical Feature Points</div>
                <div className="text-[11px] text-slate-400">Displays real-time tracked visual contrast points</div>
              </div>
              <input
                type="checkbox"
                checked={settings.enableFeaturePoints}
                onChange={e => handleUpdate('enableFeaturePoints', e.target.checked)}
                className="w-5 h-5 accent-amber-500 rounded"
              />
            </div>

            {/* Jitter Smoothing Filter */}
            <div className="border-t border-slate-800/80 pt-3">
              <label className="text-xs font-semibold text-slate-200 block mb-2">Sensor Smoothing Filter</label>
              <div className="grid grid-cols-4 gap-1.5">
                {(['off', 'low', 'medium', 'high'] as const).map(s => (
                  <button
                    key={s}
                    onClick={() => handleUpdate('smoothingFilter', s)}
                    className={`py-1.5 rounded-xl text-xs capitalize font-medium transition-all ${
                      settings.smoothingFilter === s
                        ? 'bg-amber-500 text-slate-950 font-bold'
                        : 'bg-slate-800/80 text-slate-400 hover:text-white'
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            {/* Device Height (drives all AR ranging) */}
            <div className="border-t border-slate-800/80 pt-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-semibold text-slate-200">Phone Height Above Floor</span>
                <span className="text-xs font-mono-numbers text-amber-400 font-bold">
                  {(settings.deviceHeight ?? 1.4).toFixed(2)} m
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mb-2">
                Distance from the floor to the phone camera while you measure. AR ranging is calculated from this
                height, so measure it once with a tape (typically 1.2 – 1.6 m) for the best accuracy.
              </p>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  step="0.01"
                  min="0.6"
                  max="2.5"
                  value={deviceHeightInput}
                  onChange={e => setDeviceHeightInput(e.target.value)}
                  className="flex-1 px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs font-mono-numbers text-white focus:outline-none focus:border-amber-500"
                />
                <button
                  onClick={handleSaveDeviceHeight}
                  className="px-3 py-1.5 bg-amber-500 text-slate-950 text-xs font-bold rounded-xl hover:bg-amber-400"
                >
                  Apply
                </button>
              </div>
            </div>

            {/* Calibration Factor */}
            <div className="border-t border-slate-800/80 pt-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-semibold text-slate-200">Calibration Correction Factor</span>
                <span className="text-xs font-mono-numbers text-amber-400 font-bold">
                  ×{settings.calibrationFactor.toFixed(4)}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mb-2">
                Scales every AR measurement. Easiest way: take a tape measurement in AR, tap CAL and enter the true length. Manual example: a known 1.000 m measured as 0.982 m gives 1.0183
              </p>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  step="0.001"
                  min="0.5"
                  max="2.0"
                  value={calibFactorInput}
                  onChange={e => setCalibFactorInput(e.target.value)}
                  className="flex-1 px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs font-mono-numbers text-white focus:outline-none focus:border-amber-500"
                />
                <button
                  onClick={handleSaveCalibration}
                  className="px-3 py-1.5 bg-amber-500 text-slate-950 text-xs font-bold rounded-xl hover:bg-amber-400"
                >
                  Apply
                </button>
                <button
                  onClick={handleResetCalibration}
                  className="px-3 py-1.5 bg-slate-800 text-slate-300 text-xs rounded-xl hover:bg-slate-700"
                >
                  Reset
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* SECTION 4: AUDIO & HAPTICS */}
        <div className="space-y-3">
          <h3 className="text-xs font-bold text-amber-500 uppercase tracking-wider">Feedback & Voice</h3>
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs font-semibold text-slate-200">Voice Guidance Instructions</div>
                <div className="text-[11px] text-slate-400">Speaks measurement cues ("Surface detected", "Point locked")</div>
              </div>
              <input
                type="checkbox"
                checked={settings.enableVoiceGuidance}
                onChange={e => handleUpdate('enableVoiceGuidance', e.target.checked)}
                className="w-5 h-5 accent-amber-500 rounded"
              />
            </div>

            <div className="flex items-center justify-between border-t border-slate-800/80 pt-3">
              <div>
                <div className="text-xs font-semibold text-slate-200">Haptic Vibration</div>
                <div className="text-[11px] text-slate-400">Vibrates phone upon point lock, finish, or tracking lost</div>
              </div>
              <input
                type="checkbox"
                checked={settings.enableHaptics}
                onChange={e => handleUpdate('enableHaptics', e.target.checked)}
                className="w-5 h-5 accent-amber-500 rounded"
              />
            </div>
          </div>
        </div>

        {/* SECTION 5: LANGUAGE PREFERENCES */}
        <div className="space-y-3">
          <h3 className="text-xs font-bold text-amber-500 uppercase tracking-wider">Language</h3>
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => handleUpdate('language', 'en')}
                className={`py-2 rounded-xl text-xs font-semibold transition-all ${
                  settings.language === 'en'
                    ? 'bg-amber-500 text-slate-950 font-bold'
                    : 'bg-slate-800/80 text-slate-400 hover:text-white'
                }`}
              >
                English
              </button>
              <button
                onClick={() => handleUpdate('language', 'hi')}
                className={`py-2 rounded-xl text-xs font-semibold transition-all ${
                  settings.language === 'hi'
                    ? 'bg-amber-500 text-slate-950 font-bold'
                    : 'bg-slate-800/80 text-slate-400 hover:text-white'
                }`}
              >
                हिन्दी (Hindi)
              </button>
            </div>
          </div>
        </div>

        {/* SECTION 6: HELP & USER MANUAL */}
        <div className="space-y-3">
          <h3 className="text-xs font-bold text-amber-500 uppercase tracking-wider">Help & Documentation</h3>
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs font-bold text-white flex items-center gap-1.5">
                  <BookOpen className="w-4 h-4 text-amber-400" />
                  <span>Interactive User Manual</span>
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5">
                  Complete manual covering AR tools, 2D drafting, 3D daylight, room templates & CAD exports
                </div>
              </div>
              {onOpenUserManual && (
                <button
                  onClick={onOpenUserManual}
                  className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold rounded-xl transition-colors shrink-0 shadow-sm"
                >
                  Open Manual
                </button>
              )}
            </div>

            <div className="flex items-center justify-between border-t border-slate-800/80 pt-3">
              <div>
                <div className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  <span>Onboarding Tutorial</span>
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5">
                  Step-by-step 5-step visual tutorial for first-time measurement
                </div>
              </div>
              <button
                onClick={onOpenTutorial}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl transition-colors border border-slate-700/80 shrink-0"
              >
                Launch Tutorial
              </button>
            </div>
          </div>
        </div>

        {/* SECTION 7: PROFESSIONAL DISCLAIMER */}
        <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-4">
          <div className="flex items-start gap-3">
            <ShieldAlert className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
            <div>
              <h4 className="text-xs font-bold text-white uppercase tracking-wider mb-1">
                Professional Measurement Disclaimer
              </h4>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                AR measurements are optical and sensor-based estimates and may vary depending on device hardware, lighting conditions, surface characteristics, tracking quality, and user movement. For construction, legal, structural, or professional surveying work, always verify critical measurements using calibrated physical surveying instruments.
              </p>
            </div>
          </div>
        </div>
      </div>

      {saveToast && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 bg-emerald-500 text-slate-950 font-bold px-4 py-2 rounded-xl text-xs shadow-xl z-50 flex items-center gap-1.5 animate-fade-in">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{saveToast}</span>
        </div>
      )}
    </div>
  );
}
