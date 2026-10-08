import { 
  Ruler, Navigation, Compass, Layers, Maximize, Box, 
  Milestone, ArrowUpDown, Home, LayoutGrid, Eye, Camera, 
  Clock, FolderKanban, Sliders, Sparkles, ChevronRight, FileText,
  BookOpen
} from 'lucide-react';
import { MeasurementType, ProjectRecord, MeasurementRecord, AppSettings, RoomRecord } from '../../types';
import { formatLength, formatArea, formatVolume } from '../../utils/units';

interface HomeDashboardProps {
  activeProject: ProjectRecord;
  settings: AppSettings;
  recentMeasurements: MeasurementRecord[];
  onSelectTool: (tool: MeasurementType) => void;
  onNavigateTab: (tab: 'measure' | 'scan' | 'planner' | 'projects' | 'settings' | 'ruler' | 'photo_measure' | '3d_view') => void;
  onOpen3DView: (room: RoomRecord) => void;
  onOpenUserManual?: () => void;
}

export function HomeDashboard({
  activeProject,
  settings,
  recentMeasurements,
  onSelectTool,
  onNavigateTab,
  onOpen3DView,
  onOpenUserManual,
}: HomeDashboardProps) {
  const totalFloorArea = activeProject.rooms.reduce((acc, r) => acc + (r.area || 0), 0);
  const firstRoom = activeProject.rooms[0];

  return (
    <div className="relative w-full h-full min-h-0 bg-slate-950 flex flex-col select-none overflow-y-auto pb-6">
      {/* Top Welcome & Active Project Card */}
      <div className="p-4 bg-gradient-to-b from-slate-900 to-slate-950 border-b border-slate-800/80">
        <div className="flex items-center justify-between mb-3">
          <div>
            <span className="text-[11px] font-bold text-amber-500 uppercase tracking-wider">
              AR Measurement Studio
            </span>
            <h1 className="text-xl font-black text-white tracking-tight mt-0.5">
              {activeProject.name}
            </h1>
          </div>
          <button
            onClick={() => onNavigateTab('projects')}
            className="px-3 py-1.5 bg-slate-800/90 hover:bg-slate-700 text-slate-200 hover:text-white rounded-xl text-xs font-semibold border border-slate-700 transition-colors flex items-center gap-1.5"
          >
            <FolderKanban className="w-3.5 h-3.5 text-amber-400" />
            Switch
          </button>
        </div>

        {/* Quick Stats Grid */}
        <div className="grid grid-cols-3 gap-2 pt-1">
          <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3">
            <span className="text-[10px] text-slate-400 block font-medium">Total Area</span>
            <span className="text-sm sm:text-base font-black font-mono-numbers text-amber-400">
              {formatArea(totalFloorArea, settings.defaultAreaUnit)}
            </span>
          </div>
          <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3">
            <span className="text-[10px] text-slate-400 block font-medium">Rooms</span>
            <span className="text-sm sm:text-base font-black font-mono-numbers text-white">
              {activeProject.rooms.length}
            </span>
          </div>
          <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3">
            <span className="text-[10px] text-slate-400 block font-medium">History</span>
            <span className="text-sm sm:text-base font-black font-mono-numbers text-white">
              {recentMeasurements.length}
            </span>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-6 max-w-2xl mx-auto w-full">
        {/* SECTION 1: AR MEASUREMENT TOOLS */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-bold text-amber-500 uppercase tracking-wider flex items-center gap-1.5">
              <span>AR Tools</span>
            </h2>
            <span className="text-[11px] text-slate-500">Optical 3D Tracking</span>
          </div>

          <div className="grid grid-cols-3 gap-2.5">
            {/* 1. Tape Measure */}
            <button
              onClick={() => onSelectTool('tape')}
              className="bg-slate-900/90 hover:bg-slate-800/90 active:scale-[0.98] border border-slate-800 hover:border-amber-500/40 rounded-2xl p-3.5 flex flex-col items-center text-center transition-all group"
            >
              <div className="w-11 h-11 rounded-xl bg-amber-500/10 text-amber-400 group-hover:bg-amber-500 group-hover:text-slate-950 flex items-center justify-center transition-colors mb-2">
                <Ruler className="w-5 h-5" />
              </div>
              <span className="text-xs font-bold text-white leading-tight">Tape Measure</span>
              <span className="text-[10px] text-slate-400 mt-0.5">Point-to-point</span>
            </button>

            {/* 2. Distance */}
            <button
              onClick={() => onSelectTool('distance')}
              className="bg-slate-900/90 hover:bg-slate-800/90 active:scale-[0.98] border border-slate-800 hover:border-amber-500/40 rounded-2xl p-3.5 flex flex-col items-center text-center transition-all group"
            >
              <div className="w-11 h-11 rounded-xl bg-sky-500/10 text-sky-400 group-hover:bg-sky-500 group-hover:text-slate-950 flex items-center justify-center transition-colors mb-2">
                <Navigation className="w-5 h-5" />
              </div>
              <span className="text-xs font-bold text-white leading-tight">Distance</span>
              <span className="text-[10px] text-slate-400 mt-0.5">Camera to plane</span>
            </button>

            {/* 3. Angle */}
            <button
              onClick={() => onSelectTool('angle')}
              className="bg-slate-900/90 hover:bg-slate-800/90 active:scale-[0.98] border border-slate-800 hover:border-amber-500/40 rounded-2xl p-3.5 flex flex-col items-center text-center transition-all group"
            >
              <div className="w-11 h-11 rounded-xl bg-emerald-500/10 text-emerald-400 group-hover:bg-emerald-500 group-hover:text-slate-950 flex items-center justify-center transition-colors mb-2">
                <Compass className="w-5 h-5" />
              </div>
              <span className="text-xs font-bold text-white leading-tight">Angle</span>
              <span className="text-[10px] text-slate-400 mt-0.5">3-point corner</span>
            </button>

            {/* 4. Area */}
            <button
              onClick={() => onSelectTool('area')}
              className="bg-slate-900/90 hover:bg-slate-800/90 active:scale-[0.98] border border-slate-800 hover:border-amber-500/40 rounded-2xl p-3.5 flex flex-col items-center text-center transition-all group"
            >
              <div className="w-11 h-11 rounded-xl bg-indigo-500/10 text-indigo-400 group-hover:bg-indigo-500 group-hover:text-slate-950 flex items-center justify-center transition-colors mb-2">
                <Layers className="w-5 h-5" />
              </div>
              <span className="text-xs font-bold text-white leading-tight">Area</span>
              <span className="text-[10px] text-slate-400 mt-0.5">Polygon surface</span>
            </button>

            {/* 5. Perimeter */}
            <button
              onClick={() => onSelectTool('perimeter')}
              className="bg-slate-900/90 hover:bg-slate-800/90 active:scale-[0.98] border border-slate-800 hover:border-amber-500/40 rounded-2xl p-3.5 flex flex-col items-center text-center transition-all group"
            >
              <div className="w-11 h-11 rounded-xl bg-purple-500/10 text-purple-400 group-hover:bg-purple-500 group-hover:text-slate-950 flex items-center justify-center transition-colors mb-2">
                <Maximize className="w-5 h-5" />
              </div>
              <span className="text-xs font-bold text-white leading-tight">Perimeter</span>
              <span className="text-[10px] text-slate-400 mt-0.5">Boundary loop</span>
            </button>

            {/* 6. Volume */}
            <button
              onClick={() => onSelectTool('volume')}
              className="bg-slate-900/90 hover:bg-slate-800/90 active:scale-[0.98] border border-slate-800 hover:border-amber-500/40 rounded-2xl p-3.5 flex flex-col items-center text-center transition-all group"
            >
              <div className="w-11 h-11 rounded-xl bg-amber-500/10 text-amber-400 group-hover:bg-amber-500 group-hover:text-slate-950 flex items-center justify-center transition-colors mb-2">
                <Box className="w-5 h-5" />
              </div>
              <span className="text-xs font-bold text-white leading-tight">Volume</span>
              <span className="text-[10px] text-slate-400 mt-0.5">3D Bounding box</span>
            </button>

            {/* 7. Path Scan */}
            <button
              onClick={() => onSelectTool('path')}
              className="bg-slate-900/90 hover:bg-slate-800/90 active:scale-[0.98] border border-slate-800 hover:border-amber-500/40 rounded-2xl p-3.5 flex flex-col items-center text-center transition-all group"
            >
              <div className="w-11 h-11 rounded-xl bg-teal-500/10 text-teal-400 group-hover:bg-teal-500 group-hover:text-slate-950 flex items-center justify-center transition-colors mb-2">
                <Milestone className="w-5 h-5" />
              </div>
              <span className="text-xs font-bold text-white leading-tight">Path Scan</span>
              <span className="text-[10px] text-slate-400 mt-0.5">Walking route</span>
            </button>

            {/* 8. Height */}
            <button
              onClick={() => onSelectTool('height')}
              className="bg-slate-900/90 hover:bg-slate-800/90 active:scale-[0.98] border border-slate-800 hover:border-amber-500/40 rounded-2xl p-3.5 flex flex-col items-center text-center transition-all group"
            >
              <div className="w-11 h-11 rounded-xl bg-orange-500/10 text-orange-400 group-hover:bg-orange-500 group-hover:text-slate-950 flex items-center justify-center transition-colors mb-2">
                <ArrowUpDown className="w-5 h-5" />
              </div>
              <span className="text-xs font-bold text-white leading-tight">Height</span>
              <span className="text-[10px] text-slate-400 mt-0.5">Floor-to-ceiling</span>
            </button>

            {/* 9. Room Scan */}
            <button
              onClick={() => onSelectTool('room_scan')}
              className="bg-slate-900/90 hover:bg-slate-800/90 active:scale-[0.98] border border-slate-800 hover:border-amber-500/40 rounded-2xl p-3.5 flex flex-col items-center text-center transition-all group"
            >
              <div className="w-11 h-11 rounded-xl bg-rose-500/10 text-rose-400 group-hover:bg-rose-500 group-hover:text-slate-950 flex items-center justify-center transition-colors mb-2">
                <Home className="w-5 h-5" />
              </div>
              <span className="text-xs font-bold text-white leading-tight">Room Scan</span>
              <span className="text-[10px] text-slate-400 mt-0.5">Auto perimeter</span>
            </button>
          </div>
        </div>

        {/* SECTION 2: HOME & DESIGN */}
        <div>
          <h2 className="text-xs font-bold text-amber-500 uppercase tracking-wider mb-3">
            Home & Design
          </h2>
          <div className="grid grid-cols-2 gap-3">
            {/* 2D Floor Planner */}
            <button
              onClick={() => onNavigateTab('planner')}
              className="p-4 rounded-2xl bg-slate-900/80 hover:bg-slate-800 border border-slate-800 flex items-center gap-3.5 text-left transition-all active:scale-[0.98]"
            >
              <div className="w-12 h-12 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center shrink-0">
                <LayoutGrid className="w-6 h-6" />
              </div>
              <div>
                <div className="text-sm font-bold text-white">Floor Planner</div>
                <div className="text-[11px] text-slate-400 mt-0.5">2D Walls, Doors & Furniture</div>
              </div>
            </button>

            {/* 3D Room Visualizer */}
            <button
              onClick={() => firstRoom && onOpen3DView(firstRoom)}
              className="p-4 rounded-2xl bg-slate-900/80 hover:bg-slate-800 border border-slate-800 flex items-center gap-3.5 text-left transition-all active:scale-[0.98]"
            >
              <div className="w-12 h-12 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center shrink-0">
                <Eye className="w-6 h-6" />
              </div>
              <div>
                <div className="text-sm font-bold text-white">3D Room View</div>
                <div className="text-[11px] text-slate-400 mt-0.5">Orbit & Walkthrough</div>
              </div>
            </button>
          </div>
        </div>

        {/* SECTION 3: OTHER UTILITIES */}
        <div>
          <h2 className="text-xs font-bold text-amber-500 uppercase tracking-wider mb-3">
            Specialized Utilities
          </h2>
          <div className="grid grid-cols-2 gap-3">
            {/* On-Screen Physical Ruler */}
            <button
              onClick={() => onNavigateTab('ruler')}
              className="p-3.5 rounded-2xl bg-slate-900/80 hover:bg-slate-800 border border-slate-800 flex items-center gap-3 text-left transition-all active:scale-[0.98]"
            >
              <div className="w-10 h-10 rounded-xl bg-sky-500/10 text-sky-400 flex items-center justify-center shrink-0">
                <Ruler className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xs font-bold text-white">On-Screen Ruler</div>
                <div className="text-[10px] text-slate-400">Calibrated mm/cm/in</div>
              </div>
            </button>

            {/* Photo Measure */}
            <button
              onClick={() => onNavigateTab('photo_measure')}
              className="p-3.5 rounded-2xl bg-slate-900/80 hover:bg-slate-800 border border-slate-800 flex items-center gap-3 text-left transition-all active:scale-[0.98]"
            >
              <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center shrink-0">
                <Camera className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xs font-bold text-white">Photo Measure</div>
                <div className="text-[10px] text-slate-400">Reference scale</div>
              </div>
            </button>
          </div>
        </div>

        {/* SECTION 4: RECENT MEASUREMENTS PREVIEW */}
        {recentMeasurements.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-xs font-bold text-amber-500 uppercase tracking-wider">
                Recent Measurements
              </h2>
              <button
                onClick={() => onNavigateTab('projects')}
                className="text-[11px] text-slate-400 hover:text-white flex items-center gap-1"
              >
                <span>View all</span>
                <ChevronRight className="w-3 h-3" />
              </button>
            </div>

            <div className="space-y-2">
              {recentMeasurements.slice(0, 3).map(m => (
                <div
                  key={m.id}
                  className="bg-slate-900/70 border border-slate-800 rounded-xl p-3 flex items-center justify-between"
                >
                  <div>
                    <span className="text-xs font-bold text-white">{m.name}</span>
                    <div className="text-[11px] text-slate-400 flex items-center gap-1.5 mt-0.5">
                      <span className="uppercase text-[10px] font-semibold text-amber-400">{m.type}</span>
                      <span>·</span>
                      <span>{new Date(m.timestamp).toLocaleDateString()}</span>
                    </div>
                  </div>
                  <span className="text-sm font-black font-mono-numbers text-white">
                    {m.type === 'angle'
                      ? `${m.primaryValue.toFixed(1)}°`
                      : m.type === 'area'
                      ? formatArea(m.primaryValue, settings.defaultAreaUnit)
                      : m.type === 'volume'
                      ? formatVolume(m.primaryValue, settings.defaultVolumeUnit)
                      : formatLength(m.primaryValue, settings.defaultLengthUnit)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* SECTION 5: HOW TO USE & USER MANUAL BANNER */}
        <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-slate-900/80 border border-amber-500/25 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center shrink-0 mt-0.5">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-white">User Manual & Detailed Guide</h3>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300">
                  New
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                Step-by-step instructions on AR laser tools, 2D floor planning, room templates, daylight simulation, and CAD (DXF/CSV/PDF) exporting.
              </p>
            </div>
          </div>
          {onOpenUserManual && (
            <button
              onClick={onOpenUserManual}
              className="px-4 py-2 bg-amber-500 hover:bg-amber-400 active:scale-95 text-slate-950 font-bold text-xs rounded-xl transition-all shadow-md shrink-0 flex items-center justify-center gap-1.5 self-start sm:self-auto"
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>Read Manual</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
