import { useState, useEffect, useRef } from 'react';
import { 
  ProjectRecord, RoomRecord, MeasurementRecord, AppSettings, 
  MeasurementType 
} from './types';
import { 
  getStoredProjects, saveProjects, 
  getStoredMeasurements, saveMeasurements, 
  getStoredSettings, saveSettings,
  getStoredActiveProjectId, saveActiveProjectId,
  getStoredActiveRoomId, saveActiveRoomId
} from './utils/storage';
import { exportProjectToPDF } from './utils/pdfGenerator';
import { getUpdatedSettingsForUnitSystem } from './utils/units';
import { TopHeader, SyncState } from './components/Navigation/TopHeader';
import { BottomNav, AppTab } from './components/Navigation/BottomNav';
import { HomeDashboard } from './components/Home/HomeDashboard';
import { ARCameraOverlay } from './components/ARMeasure/ARCameraOverlay';
import { FloorPlanner2D } from './components/FloorPlanner/FloorPlanner2D';
import { Room3DVisualizer } from './components/ThreeDView/Room3DVisualizer';
import { RoomScannerView } from './components/RoomScanner/RoomScannerView';
import { ScreenRulerView } from './components/Ruler/ScreenRulerView';
import { PhotoMeasureView } from './components/PhotoMeasure/PhotoMeasureView';
import { ProjectsView } from './components/Projects/ProjectsView';
import { SettingsView } from './components/Settings/SettingsView';
import { FirstTimeTutorial } from './components/Tutorial/FirstTimeTutorial';
import { UserManualModal } from './components/UserManual/UserManualModal';
import { 
  Ruler, Navigation, Compass, Layers, Maximize, Box, 
  Milestone, ArrowUpDown, Home, Sliders, ArrowLeft, Plus
} from 'lucide-react';

export default function App() {
  // Global State - loaded defensively from localStorage
  const [projects, setProjects] = useState<ProjectRecord[]>(() => getStoredProjects());
  const [activeProjectId, setActiveProjectId] = useState<string>(() => {
    const storedId = getStoredActiveProjectId();
    const initialProjects = getStoredProjects();
    const exists = initialProjects.some(p => p.id === storedId);
    return exists ? storedId : (initialProjects[0]?.id || 'proj_sample_01');
  });
  const [measurements, setMeasurements] = useState<MeasurementRecord[]>(() => getStoredMeasurements());
  const [settings, setSettings] = useState<AppSettings>(() => getStoredSettings());

  // Navigation State
  const [currentTab, setCurrentTab] = useState<string>('home');
  const [activeTool, setActiveTool] = useState<MeasurementType>('tape');
  const [activeRoomId, setActiveRoomId] = useState<string | null>(() => {
    const storedRoomId = getStoredActiveRoomId();
    const initialProjects = getStoredProjects();
    const initialActiveProjId = getStoredActiveProjectId();
    const curProj = initialProjects.find(p => p.id === initialActiveProjId) || initialProjects[0];
    const roomExists = curProj?.rooms?.some(r => r.id === storedRoomId);
    return roomExists ? storedRoomId : (curProj?.rooms?.[0]?.id || null);
  });
  const [showTutorial, setShowTutorial] = useState<boolean>(!settings.hasSeenTutorial);
  const [showUserManual, setShowUserManual] = useState<boolean>(false);

  // Sync status indicator state
  const [syncStatus, setSyncStatus] = useState<SyncState>('saved');
  const [lastSavedTime, setLastSavedTime] = useState<number | null>(() => Date.now());

  // Track initialization to prevent redundant writes or overwriting valid storage during initial mount
  const isMountedRef = useRef(false);

  // Sync projects to local storage with visual sync state indicator
  useEffect(() => {
    if (!isMountedRef.current) return;
    setSyncStatus('saving');
    const timer = setTimeout(() => {
      try {
        const ok = saveProjects(projects);
        if (ok) {
          setSyncStatus('saved');
          setLastSavedTime(Date.now());
        } else {
          setSyncStatus('error');
        }
      } catch (err) {
        console.error('Failed to persist projects:', err);
        setSyncStatus('error');
      }
    }, 120);

    return () => clearTimeout(timer);
  }, [projects]);

  // Sync measurements to local storage
  useEffect(() => {
    if (!isMountedRef.current) return;
    try {
      const ok = saveMeasurements(measurements);
      if (ok) {
        setLastSavedTime(Date.now());
      }
    } catch {
      setSyncStatus('error');
    }
  }, [measurements]);

  // Sync settings to local storage
  useEffect(() => {
    if (!isMountedRef.current) return;
    try {
      const ok = saveSettings(settings);
      if (ok) {
        setLastSavedTime(Date.now());
      }
    } catch {
      setSyncStatus('error');
    }
  }, [settings]);

  // Sync activeProjectId to local storage
  useEffect(() => {
    if (!isMountedRef.current) return;
    if (activeProjectId) {
      saveActiveProjectId(activeProjectId);
    }
  }, [activeProjectId]);

  // Sync activeRoomId to local storage
  useEffect(() => {
    if (!isMountedRef.current) return;
    saveActiveRoomId(activeRoomId);
  }, [activeRoomId]);

  // Mark as mounted after initial render
  useEffect(() => {
    isMountedRef.current = true;
  }, []);

  const activeProject = projects.find(p => p.id === activeProjectId) || projects[0];

  // Keep activeRoomId in sync with active project's rooms
  useEffect(() => {
    if (!activeProject || !activeProject.rooms || activeProject.rooms.length === 0) return;
    const roomExists = activeProject.rooms.some(r => r.id === activeRoomId);
    if (!roomExists) {
      setActiveRoomId(activeProject.rooms[0].id);
    }
  }, [activeProjectId, activeProject, activeRoomId]);

  // Active room for Floor Planner or 3D view
  const currentRoom = activeProject?.rooms.find(r => r.id === activeRoomId) || activeProject?.rooms[0];

  // Update a single room with resilient matching
  const handleUpdateRoom = (updated: RoomRecord) => {
    if (!activeProject) return;
    const updatedProjects = projects.map(p => {
      if (p.id === activeProject.id) {
        const roomExists = p.rooms.some(r => r.id === updated.id);
        return {
          ...p,
          updatedAt: Date.now(),
          rooms: roomExists
            ? p.rooms.map(r => r.id === updated.id ? updated : r)
            : [...p.rooms, updated]
        };
      }
      return p;
    });
    setProjects(updatedProjects);
  };

  // Add a newly scanned room to the active project
  const handleAddScannedRoom = (newRoomData: Omit<RoomRecord, 'id'>) => {
    if (!activeProject) return;
    const newRoom: RoomRecord = {
      ...newRoomData,
      id: `room_${Date.now()}`,
      projectId: activeProject.id,
      furniture: []
    };
    const updatedProjects = projects.map(p => {
      if (p.id === activeProject.id) {
        return {
          ...p,
          updatedAt: Date.now(),
          rooms: [...p.rooms, newRoom]
        };
      }
      return p;
    });
    setProjects(updatedProjects);
    setActiveRoomId(newRoom.id);
    setCurrentTab('planner');
  };

  // Save measurement from AR overlay
  const handleSaveMeasurement = (rec: Omit<MeasurementRecord, 'id' | 'timestamp'>) => {
    const newRecord: MeasurementRecord = {
      ...rec,
      id: `meas_${Date.now()}`,
      projectId: activeProjectId,
      roomId: currentRoom?.id,
      timestamp: Date.now()
    };
    setMeasurements(prev => [newRecord, ...prev]);
  };

  // Delete measurement
  const handleDeleteMeasurement = (id: string) => {
    setMeasurements(prev => prev.filter(m => m.id !== id));
  };

  // Open 3D View for a specific room
  const handleOpen3DView = (room: RoomRecord) => {
    setActiveRoomId(room.id);
    setCurrentTab('3d_view');
  };

  // Open Floor Planner for a specific room
  const handleOpenRoomPlanner = (room: RoomRecord) => {
    setActiveRoomId(room.id);
    setCurrentTab('planner');
  };

  // Select tool and navigate to AR Measure
  const handleSelectTool = (tool: MeasurementType) => {
    setActiveTool(tool);
    if (tool === 'room_scan') {
      setCurrentTab('scan');
    } else {
      setCurrentTab('measure');
    }
  };

  // Dismiss Tutorial
  const handleCompleteTutorial = () => {
    setShowTutorial(false);
    setSettings(prev => ({ ...prev, hasSeenTutorial: true }));
  };

  // Global Quick Unit System Toggle
  const handleToggleUnitSystem = () => {
    const nextSystem = settings.unitSystem === 'imperial' ? 'metric' : 'imperial';
    const updated = getUpdatedSettingsForUnitSystem(settings, nextSystem);
    setSettings(updated);
  };

  // Tool selector pills when in AR Measure mode
  const AR_TOOLS: { id: MeasurementType; label: string; icon: React.ReactNode }[] = [
    { id: 'tape', label: 'Tape', icon: <Ruler className="w-3.5 h-3.5" /> },
    { id: 'distance', label: 'Distance', icon: <Navigation className="w-3.5 h-3.5" /> },
    { id: 'angle', label: 'Angle', icon: <Compass className="w-3.5 h-3.5" /> },
    { id: 'area', label: 'Area', icon: <Layers className="w-3.5 h-3.5" /> },
    { id: 'perimeter', label: 'Perimeter', icon: <Maximize className="w-3.5 h-3.5" /> },
    { id: 'volume', label: 'Volume', icon: <Box className="w-3.5 h-3.5" /> },
    { id: 'path', label: 'Path', icon: <Milestone className="w-3.5 h-3.5" /> },
    { id: 'height', label: 'Height', icon: <ArrowUpDown className="w-3.5 h-3.5" /> },
  ];

  return (
    <div className="flex flex-col h-[100dvh] w-screen bg-slate-950 text-slate-100 font-sans overflow-hidden">
      {/* Top Header */}
      <TopHeader
        currentTab={currentTab}
        projectName={activeProject?.name}
        settings={settings}
        syncStatus={syncStatus}
        lastSavedTime={lastSavedTime}
        onOpenTutorial={() => setShowTutorial(true)}
        onExportPDF={activeProject ? () => exportProjectToPDF(activeProject, settings) : undefined}
        onToggleUnitSystem={handleToggleUnitSystem}
      />

      {/* Main Content Area */}
      <main className="flex-1 min-h-0 relative overflow-hidden flex flex-col">
        {/* TAB 1: HOME DASHBOARD */}
        {currentTab === 'home' && activeProject && (
          <HomeDashboard
            activeProject={activeProject}
            settings={settings}
            recentMeasurements={measurements}
            onSelectTool={handleSelectTool}
            onNavigateTab={tab => setCurrentTab(tab)}
            onOpen3DView={handleOpen3DView}
          />
        )}

        {/* TAB 2: AR MEASURE (CAMERA OVERLAY) */}
        {currentTab === 'measure' && (
          <div className="w-full flex-1 min-h-0 flex flex-col">
            <ARCameraOverlay
              tool={activeTool}
              settings={settings}
              onSaveMeasurement={handleSaveMeasurement}
              onUpdateSettings={setSettings}
              topSlot={
                <div className="shrink-0 bg-slate-950 border-b border-slate-800/80 px-2 py-1.5 overflow-x-auto [scrollbar-width:none]">
                  <div className="flex items-center gap-1 w-max mx-auto">
                    {AR_TOOLS.map(t => (
                      <button
                        key={t.id}
                        onClick={() => setActiveTool(t.id)}
                        className={`h-8 px-3 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all whitespace-nowrap ${
                          activeTool === t.id
                            ? 'bg-amber-500 text-slate-950 font-bold shadow-md'
                            : 'bg-slate-900 text-slate-400 hover:text-white'
                        }`}
                      >
                        {t.icon}
                        <span>{t.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              }
            />
          </div>
        )}

        {/* TAB 3: GUIDED ROOM SCANNER */}
        {currentTab === 'scan' && (
          <RoomScannerView
            settings={settings}
            onFinishScan={handleAddScannedRoom}
            onCancel={() => setCurrentTab('home')}
          />
        )}

        {/* TAB 4: 2D FLOOR PLANNER */}
        {currentTab === 'planner' && (
          currentRoom ? (
            <div className="w-full flex-1 min-h-0 flex flex-col">
              {/* Room Selector Strip if multiple rooms (in normal flow, never overlaps the planner) */}
              {activeProject && activeProject.rooms.length > 1 && (
                <div className="shrink-0 bg-slate-950 border-b border-slate-800/80 px-2 py-1.5 overflow-x-auto [scrollbar-width:none]">
                  <div className="flex items-center gap-1 w-max">
                    {activeProject.rooms.map(r => (
                      <button
                        key={r.id}
                        onClick={() => setActiveRoomId(r.id)}
                        className={`px-3 py-1 text-xs rounded-lg font-medium whitespace-nowrap transition-colors ${
                          currentRoom.id === r.id
                            ? 'bg-amber-500 text-slate-950 font-bold'
                            : 'bg-slate-900 text-slate-400 hover:text-white'
                        }`}
                      >
                        {r.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <FloorPlanner2D
                room={currentRoom}
                settings={settings}
                onUpdateRoom={handleUpdateRoom}
                onOpen3D={() => handleOpen3DView(currentRoom)}
              />
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
              <Box className="w-12 h-12 text-slate-600 mb-3" />
              <h3 className="text-base font-bold text-white mb-1">No Room Selected</h3>
              <p className="text-xs text-slate-400 max-w-sm mb-4">
                Please add or choose a room in your project to start using the 2D Floor Planner.
              </p>
              <button
                onClick={() => setCurrentTab('projects')}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-xs transition-colors"
              >
                Go to Project Rooms
              </button>
            </div>
          )
        )}

        {/* TAB 5: 3D ROOM VISUALIZER */}
        {currentTab === '3d_view' && (
          currentRoom ? (
            <Room3DVisualizer
              room={currentRoom}
              settings={settings}
              onClose={() => setCurrentTab('planner')}
              onUpdateRoomWindows={(wins, compass) => {
                handleUpdateRoom({
                  ...currentRoom,
                  windows: wins,
                  compassOrientation: compass,
                });
              }}
            />
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
              <Box className="w-12 h-12 text-slate-600 mb-3" />
              <h3 className="text-base font-bold text-white mb-1">No Room for 3D View</h3>
              <p className="text-xs text-slate-400 max-w-sm mb-4">
                Select a room from the House Projects tab to visualize it in 3D.
              </p>
              <button
                onClick={() => setCurrentTab('projects')}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-xs transition-colors"
              >
                Go to Project Rooms
              </button>
            </div>
          )
        )}

        {/* TAB 6: ON-SCREEN PHYSICAL RULER */}
        {currentTab === 'ruler' && (
          <ScreenRulerView onBack={() => setCurrentTab('home')} />
        )}

        {/* TAB 7: PHOTO MEASURE */}
        {currentTab === 'photo_measure' && (
          <PhotoMeasureView settings={settings} />
        )}

        {/* TAB 8: HOUSE PROJECTS & MEASUREMENT HISTORY */}
        {currentTab === 'projects' && (
          <ProjectsView
            projects={projects}
            activeProjectId={activeProjectId}
            settings={settings}
            measurements={measurements}
            onSelectProject={id => setActiveProjectId(id)}
            onUpdateProjects={setProjects}
            onOpenRoomPlanner={handleOpenRoomPlanner}
            onOpen3DView={handleOpen3DView}
            onDeleteMeasurement={handleDeleteMeasurement}
          />
        )}

        {/* TAB 9: SETTINGS */}
        {currentTab === 'settings' && (
          <SettingsView
            settings={settings}
            onUpdateSettings={setSettings}
            onOpenTutorial={() => setShowTutorial(true)}
            activeProject={activeProject}
            projects={projects}
            activeRoom={currentRoom}
          />
        )}
      </main>

      {/* Bottom Thumb-Zone Navigation Bar */}
      <BottomNav
        currentTab={currentTab}
        onSelectTab={tab => {
          if (tab === 'measure') setActiveTool('tape');
          setCurrentTab(tab);
        }}
      />

      {/* First-Time User Tutorial Modal */}
      {showTutorial && (
        <FirstTimeTutorial onComplete={handleCompleteTutorial} />
      )}
    </div>
  );
}
