import { AppSettings, UnitSystem } from '../../types';
import { Sparkles, HelpCircle, FileText, Scale, CheckCircle2, RefreshCw, AlertCircle, BookOpen } from 'lucide-react';

export type SyncState = 'saved' | 'saving' | 'error';

interface TopHeaderProps {
  currentTab: string;
  projectName?: string;
  settings?: AppSettings;
  syncStatus?: SyncState;
  lastSavedTime?: number | null;
  onOpenTutorial: () => void;
  onOpenUserManual?: () => void;
  onExportPDF?: () => void;
  onToggleUnitSystem?: () => void;
}

export function TopHeader({ 
  currentTab, 
  projectName, 
  settings, 
  syncStatus = 'saved',
  lastSavedTime,
  onOpenTutorial, 
  onOpenUserManual,
  onExportPDF,
  onToggleUnitSystem 
}: TopHeaderProps) {
  const getTabTitle = () => {
    switch (currentTab) {
      case 'home': return 'Dashboard';
      case 'measure': return 'AR Measure';
      case 'scan': return 'Room Scanner';
      case 'planner': return '2D Floor Planner';
      case 'projects': return 'House Projects';
      case 'ruler': return 'On-Screen Ruler';
      case 'photo_measure': return 'Photo Measure';
      case '3d_view': return '3D Room Model';
      case 'settings': return 'Settings';
      default: return 'AR Measure Pro';
    }
  };

  const isImperial = settings?.unitSystem === 'imperial';

  return (
    <header className="h-14 bg-slate-950/90 backdrop-blur-md border-b border-slate-800/80 px-3 gap-2 flex items-center justify-between z-30 shrink-0 select-none">
      {/* Zone 1: Single element brand wordmark in display face */}
      <div className="flex items-center gap-2">
        <span className="font-display font-black text-sm sm:text-base tracking-tight text-white whitespace-nowrap">
          AR MEASURE <span className="text-amber-500">PRO</span>
        </span>
      </div>

      {/* Zone 2: Current context title & Sync Status */}
      <div className="flex items-center gap-2 sm:gap-3">
        <div className="hidden sm:flex items-center gap-2 text-xs text-slate-400">
          <span className="font-semibold text-slate-200">{getTabTitle()}</span>
          {projectName && (
            <>
              <span aria-hidden="true">·</span>
              <span className="truncate max-w-[150px]">{projectName}</span>
            </>
          )}
        </div>

        {/* Sync Status Indicator */}
        <div 
          className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium border transition-all duration-200 select-none ${
            syncStatus === 'saving'
              ? 'bg-amber-950/50 border-amber-500/40 text-amber-300'
              : syncStatus === 'error'
              ? 'bg-rose-950/50 border-rose-500/40 text-rose-300'
              : 'bg-emerald-950/40 border-emerald-500/30 text-emerald-400'
          }`}
          title={
            syncStatus === 'saving'
              ? 'Saving changes to local storage...'
              : syncStatus === 'error'
              ? 'Failed to save changes to local storage'
              : lastSavedTime
                ? `Saved to local storage (${new Date(lastSavedTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })})`
                : 'Project data saved locally'
          }
          role="status"
          aria-live="polite"
        >
          {syncStatus === 'saving' && (
            <>
              <RefreshCw className="w-2.5 h-2.5 animate-spin text-amber-400 shrink-0" />
              <span className="text-[10px] tracking-tight">Saving</span>
            </>
          )}
          {syncStatus === 'saved' && (
            <>
              <CheckCircle2 className="w-2.5 h-2.5 text-emerald-400 shrink-0" />
              <span className="text-[10px] tracking-tight">Saved</span>
            </>
          )}
          {syncStatus === 'error' && (
            <>
              <AlertCircle className="w-2.5 h-2.5 text-rose-400 shrink-0" />
              <span className="text-[10px] tracking-tight">Sync error</span>
            </>
          )}
        </div>
      </div>

      {/* Zone 3: Context Actions */}
      <div className="flex items-center gap-1.5">
        {/* Quick Global Unit Toggle Button */}
        {onToggleUnitSystem && settings && (
          <button
            onClick={onToggleUnitSystem}
            title={`Switch to ${isImperial ? 'Metric System (m, cm)' : 'Imperial System (ft, in)'}`}
            className="h-8 px-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700/80 text-xs font-mono-numbers flex items-center gap-1 text-slate-200 hover:text-white transition-all shadow-sm active:scale-95 whitespace-nowrap shrink-0"
          >
            <Scale className="w-3.5 h-3.5 text-amber-400" />
            <span className="font-bold text-amber-400 whitespace-nowrap">{isImperial ? 'ft/in' : 'm/cm'}</span>
          </button>
        )}

        {onExportPDF && (
          <button
            onClick={onExportPDF}
            title="Export Architectural PDF"
            className="h-8 px-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center gap-1 shadow-sm transition-colors whitespace-nowrap"
          >
            <FileText className="w-3.5 h-3.5" />
            <span className="hidden xs:inline">PDF</span>
          </button>
        )}

        {onOpenUserManual && (
          <button
            onClick={onOpenUserManual}
            title="User Manual & Detailed Guide"
            className="h-8 px-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white flex items-center gap-1.5 border border-slate-800 transition-colors shadow-sm"
          >
            <BookOpen className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-xs font-semibold hidden md:inline">Manual</span>
          </button>
        )}

        <button
          onClick={onOpenTutorial}
          title="User Tutorial"
          className="w-8 h-8 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center border border-slate-800 transition-colors"
        >
          <HelpCircle className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
}
