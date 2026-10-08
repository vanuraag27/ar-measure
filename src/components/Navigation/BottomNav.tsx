import { Home, Ruler, LayoutGrid, FolderKanban, Sliders } from 'lucide-react';

export type AppTab = 'home' | 'measure' | 'planner' | 'projects' | 'settings';

interface BottomNavProps {
  currentTab: string;
  onSelectTab: (tab: AppTab) => void;
}

export function BottomNav({ currentTab, onSelectTab }: BottomNavProps) {
  const tabs = [
    { id: 'home' as AppTab, label: 'Home', icon: Home },
    { id: 'measure' as AppTab, label: 'Measure', icon: Ruler },
    { id: 'planner' as AppTab, label: 'Floor Plan', icon: LayoutGrid },
    { id: 'projects' as AppTab, label: 'Projects', icon: FolderKanban },
    { id: 'settings' as AppTab, label: 'Settings', icon: Sliders },
  ];

  return (
    <nav className="shrink-0 relative min-h-16 pb-[env(safe-area-inset-bottom)] bg-slate-950 border-t border-slate-800/80 z-40 px-2 flex items-center justify-around select-none">
      {tabs.map(t => {
        const Icon = t.icon;
        const isActive = currentTab === t.id;

        return (
          <button
            key={t.id}
            onClick={() => onSelectTab(t.id)}
            className={`min-h-[44px] min-w-[54px] flex flex-col items-center justify-center py-1 rounded-xl transition-all ${
              isActive
                ? 'text-amber-400 font-bold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <div className={`p-1 rounded-lg transition-colors ${isActive ? 'bg-amber-500/10' : ''}`}>
              <Icon className={`w-5 h-5 ${isActive ? 'stroke-[2.5]' : 'stroke-2'}`} />
            </div>
            <span className="text-[10px] tracking-tight mt-0.5 whitespace-nowrap">
              {t.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
