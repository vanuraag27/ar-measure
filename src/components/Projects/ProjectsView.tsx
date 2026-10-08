import { useState } from 'react';
import { ProjectRecord, RoomRecord, MeasurementRecord, AppSettings, FurnitureItem } from '../../types';
import { formatLength, formatArea, formatVolume } from '../../utils/units';
import { exportProjectToPDF } from '../../utils/pdfGenerator';
import { 
  sharePDF, shareDXF, shareSVG,
  downloadProjectDXF, downloadProjectSVG,
  isWebShareSupported
} from '../../utils/floorPlanExporters';
import { 
  FolderPlus, FileText, Home, Plus, Trash2, Copy, 
  ExternalLink, Download, Layers, Calendar, ChevronRight, Check, Sparkles, Share2,
  X, Box, PenTool, FileDown, Search, Shapes, Layout
} from 'lucide-react';

export interface RoomTemplate {
  id: string;
  name: string;
  type: RoomRecord['type'];
  length: number;
  width: number;
  shape: 'rectangular' | 'l_shaped' | 'compact';
  description: string;
  corners?: { x: number; y: number }[];
  furniture?: Omit<FurnitureItem, 'roomId'>[];
}

export const ROOM_TEMPLATES: RoomTemplate[] = [
  {
    id: 'rect_living',
    name: 'Rectangular Room',
    type: 'living_room',
    length: 5.5,
    width: 4.2,
    shape: 'rectangular',
    description: 'Standard 5.5 × 4.2m living or open layout',
    corners: [{ x: 0, y: 0 }, { x: 5.5, y: 0 }, { x: 5.5, y: 4.2 }, { x: 0, y: 4.2 }],
    furniture: [
      { id: 'f_sofa', type: 'sofa', name: '3-Seater Sofa', x: 2.8, y: 3.2, width: 2.2, depth: 0.9, height: 0.85, rotation: 0, color: '#475569' },
      { id: 'f_table', type: 'dining_table', name: 'Coffee Table', x: 2.8, y: 2.1, width: 1.2, depth: 0.7, height: 0.45, rotation: 0, color: '#94a3b8' }
    ]
  },
  {
    id: 'master_bedroom',
    name: 'Master Bedroom',
    type: 'bedroom',
    length: 4.8,
    width: 3.8,
    shape: 'rectangular',
    description: 'Spacious 4.8 × 3.8m bedroom with king bed & wardrobe',
    corners: [{ x: 0, y: 0 }, { x: 4.8, y: 0 }, { x: 4.8, y: 3.8 }, { x: 0, y: 3.8 }],
    furniture: [
      { id: 'f_bed', type: 'bed', name: 'King Bed', x: 2.4, y: 2.6, width: 2.0, depth: 2.1, height: 1.1, rotation: 0, color: '#334155' },
      { id: 'f_wardrobe', type: 'wardrobe', name: 'Wardrobe', x: 0.6, y: 1.8, width: 0.6, depth: 1.8, height: 2.2, rotation: 90, color: '#475569' }
    ]
  },
  {
    id: 'l_shaped_room',
    name: 'L-Shaped Room',
    type: 'living_room',
    length: 6.0,
    width: 5.0,
    shape: 'l_shaped',
    description: '6.0 × 5.0m open-plan living & dining alcove',
    corners: [
      { x: 0, y: 0 },
      { x: 6.0, y: 0 },
      { x: 6.0, y: 2.8 },
      { x: 3.5, y: 2.8 },
      { x: 3.5, y: 5.0 },
      { x: 0, y: 5.0 }
    ],
    furniture: [
      { id: 'f_sofa_l', type: 'sofa', name: 'Sectional Sofa', x: 2.0, y: 3.8, width: 2.4, depth: 1.6, height: 0.85, rotation: 0, color: '#475569' },
      { id: 'f_dining_l', type: 'dining_table', name: 'Dining Table', x: 4.8, y: 1.4, width: 1.6, depth: 0.9, height: 0.75, rotation: 0, color: '#64748b' }
    ]
  },
  {
    id: 'kitchen_modern',
    name: 'Kitchen',
    type: 'kitchen',
    length: 4.0,
    width: 3.0,
    shape: 'rectangular',
    description: '4.0 × 3.0m culinary space with counter & appliances',
    corners: [{ x: 0, y: 0 }, { x: 4.0, y: 0 }, { x: 4.0, y: 3.0 }, { x: 0, y: 3.0 }],
    furniture: [
      { id: 'f_counter', type: 'kitchen_counter', name: 'Kitchen Counter', x: 2.0, y: 0.4, width: 3.6, depth: 0.65, height: 0.9, rotation: 0, color: '#334155' },
      { id: 'f_fridge', type: 'refrigerator', name: 'Refrigerator', x: 3.5, y: 1.8, width: 0.9, depth: 0.8, height: 1.85, rotation: 90, color: '#64748b' }
    ]
  },
  {
    id: 'compact_bathroom',
    name: 'Bathroom',
    type: 'bathroom',
    length: 2.8,
    width: 2.2,
    shape: 'compact',
    description: '2.8 × 2.2m bathroom with tub, vanity & toilet',
    corners: [{ x: 0, y: 0 }, { x: 2.8, y: 0 }, { x: 2.8, y: 2.2 }, { x: 0, y: 2.2 }],
    furniture: [
      { id: 'f_bath', type: 'bathtub', name: 'Bathtub', x: 1.9, y: 0.6, width: 1.6, depth: 0.8, height: 0.6, rotation: 0, color: '#e2e8f0' },
      { id: 'f_toilet', type: 'toilet', name: 'Toilet', x: 0.6, y: 1.6, width: 0.5, depth: 0.7, height: 0.8, rotation: 90, color: '#f1f5f9' }
    ]
  },
  {
    id: 'home_office',
    name: 'Home Office',
    type: 'office',
    length: 3.6,
    width: 3.0,
    shape: 'rectangular',
    description: '3.6 × 3.0m studio with workstation & desk',
    corners: [{ x: 0, y: 0 }, { x: 3.6, y: 0 }, { x: 3.6, y: 3.0 }, { x: 0, y: 3.0 }],
    furniture: [
      { id: 'f_desk', type: 'desk', name: 'Desk', x: 1.8, y: 1.5, width: 1.6, depth: 0.8, height: 0.75, rotation: 0, color: '#475569' },
      { id: 'f_chair', type: 'chair', name: 'Office Chair', x: 1.8, y: 2.1, width: 0.65, depth: 0.65, height: 1.0, rotation: 180, color: '#1e293b' }
    ]
  }
];

interface ProjectsViewProps {
  projects: ProjectRecord[];
  activeProjectId: string;
  settings: AppSettings;
  measurements: MeasurementRecord[];
  onSelectProject: (id: string) => void;
  onUpdateProjects: (updated: ProjectRecord[]) => void;
  onOpenRoomPlanner: (room: RoomRecord) => void;
  onOpen3DView: (room: RoomRecord) => void;
  onDeleteMeasurement?: (id: string) => void;
}

export function ProjectsView({
  projects,
  activeProjectId,
  settings,
  measurements,
  onSelectProject,
  onUpdateProjects,
  onOpenRoomPlanner,
  onOpen3DView,
  onDeleteMeasurement
}: ProjectsViewProps) {
  const [activeTab, setActiveTab] = useState<'rooms' | 'history' | 'all_projects'>('rooms');
  const [showNewProjectModal, setShowNewProjectModal] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newPropertyType, setNewPropertyType] = useState<ProjectRecord['propertyType']>('apartment');
  const [newAddress, setNewAddress] = useState('');
  const [showAddRoomModal, setShowAddRoomModal] = useState(false);
  const [newRoomName, setNewRoomName] = useState('');
  const [newRoomType, setNewRoomType] = useState<RoomRecord['type']>('living_room');
  const [newRoomLength, setNewRoomLength] = useState('5.0');
  const [newRoomWidth, setNewRoomWidth] = useState('4.0');

  // Room template selection state
  const [selectedProjectTemplateId, setSelectedProjectTemplateId] = useState<string>('rect_living');
  const [selectedAddRoomTemplateId, setSelectedAddRoomTemplateId] = useState<string | null>(null);

  // Search filter query for projects and rooms
  const [searchQuery, setSearchQuery] = useState('');
  const [roomSearchQuery, setRoomSearchQuery] = useState('');

  // Project Export & Web Share state
  const [showExportModal, setShowExportModal] = useState(false);
  const [isSharing, setIsSharing] = useState<string | null>(null);
  const [exportNotice, setExportNotice] = useState<string | null>(null);
  const [dxfUnit, setDxfUnit] = useState<'mm' | 'm' | 'in'>('mm');

  const showToast = (msg: string) => {
    setExportNotice(msg);
    setTimeout(() => setExportNotice(null), 3000);
  };

  const handleSharePdf = async () => {
    if (!currentProject) return;
    setIsSharing('pdf');
    try {
      const res = await sharePDF(currentProject, settings);
      showToast(res.message);
    } catch (e) {
      console.error('Error sharing PDF:', e);
    } finally {
      setIsSharing(null);
    }
  };

  const handleShareDxf = async () => {
    if (!currentProject) return;
    setIsSharing('dxf');
    try {
      const res = await shareDXF(currentProject, currentProject, settings, { unit: dxfUnit });
      showToast(res.message);
    } catch (e) {
      console.error('Error sharing DXF:', e);
    } finally {
      setIsSharing(null);
    }
  };

  const handleShareSvg = async () => {
    if (!currentProject) return;
    setIsSharing('svg');
    try {
      const res = await shareSVG(currentProject, currentProject, settings);
      showToast(res.message);
    } catch (e) {
      console.error('Error sharing SVG:', e);
    } finally {
      setIsSharing(null);
    }
  };

  const currentProject = projects.find(p => p.id === activeProjectId) || projects[0];

  const totalHouseArea = currentProject ? currentProject.rooms.reduce((acc, r) => acc + (r.area || 0), 0) : 0;

  // Filter projects by name or room name
  const filteredProjects = projects.filter(proj => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    const matchProjName = proj.name.toLowerCase().includes(q);
    const matchRoomName = proj.rooms.some(r => r.name.toLowerCase().includes(q));
    const matchAddress = proj.address?.toLowerCase().includes(q) || false;
    return matchProjName || matchRoomName || matchAddress;
  });

  // Filter rooms in current project
  const displayedRooms = currentProject?.rooms.filter(room => {
    const q = roomSearchQuery.toLowerCase().trim();
    if (!q) return true;
    return room.name.toLowerCase().includes(q);
  }) || [];

  // Create Project
  const handleCreateProject = () => {
    if (!newProjectName.trim()) return;
    const template = ROOM_TEMPLATES.find(t => t.id === selectedProjectTemplateId) || ROOM_TEMPLATES[0];
    const newProjId = `proj_${Date.now()}`;
    const newRoomId = `room_${Date.now()}_1`;
    const initialCorners = template.corners ? [...template.corners] : [
      { x: 0, y: 0 }, { x: template.length, y: 0 },
      { x: template.length, y: template.width }, { x: 0, y: template.width }
    ];
    const initialArea = template.shape === 'l_shaped' ? 23.75 : Number((template.length * template.width).toFixed(2));
    const initialPerimeter = template.shape === 'l_shaped' ? 22.0 : Number((2 * (template.length + template.width)).toFixed(2));

    const newProj: ProjectRecord = {
      id: newProjId,
      name: newProjectName.trim(),
      propertyType: newPropertyType,
      address: newAddress.trim() || undefined,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      rooms: [
        {
          id: newRoomId,
          projectId: newProjId,
          name: template.name,
          type: template.type,
          length: template.length,
          width: template.width,
          height: 2.7,
          area: initialArea,
          perimeter: initialPerimeter,
          corners: initialCorners,
          furniture: (template.furniture || []).map((f, idx) => ({
            ...f,
            id: `f_${Date.now()}_${idx}`,
            roomId: newRoomId
          }))
        }
      ]
    };
    const next = [newProj, ...projects];
    onUpdateProjects(next);
    onSelectProject(newProj.id);
    setShowNewProjectModal(false);
    setNewProjectName('');
  };

  // Add Room to Current Project
  const handleAddRoom = () => {
    if (!currentProject || !newRoomName.trim()) return;
    const l = Math.max(0.5, parseFloat(newRoomLength) || 4.0);
    const w = Math.max(0.5, parseFloat(newRoomWidth) || 3.5);
    const area = Number((l * w).toFixed(2));
    const perimeter = Number((2 * (l + w)).toFixed(2));
    const newRoomId = `room_${Date.now()}`;

    const template = ROOM_TEMPLATES.find(t => t.id === selectedAddRoomTemplateId);
    const isMatchingLShaped = template?.shape === 'l_shaped' && Math.abs(l - template.length) < 0.1 && Math.abs(w - template.width) < 0.1;

    const corners = isMatchingLShaped && template?.corners
      ? [...template.corners]
      : [
          { x: 0, y: 0 },
          { x: l, y: 0 },
          { x: l, y: w },
          { x: 0, y: w }
        ];

    const furniture = template?.furniture
      ? template.furniture.map((f, i) => ({
          ...f,
          id: `f_${Date.now()}_${i}`,
          roomId: newRoomId
        }))
      : [];

    const newRoom: RoomRecord = {
      id: newRoomId,
      projectId: currentProject.id,
      name: newRoomName.trim(),
      type: newRoomType,
      length: l,
      width: w,
      height: 2.7,
      area: isMatchingLShaped ? 23.75 : area,
      perimeter: isMatchingLShaped ? 22.0 : perimeter,
      corners,
      furniture
    };

    const updatedProjects = projects.map(p => {
      if (p.id === currentProject.id) {
        return {
          ...p,
          updatedAt: Date.now(),
          rooms: [...p.rooms, newRoom]
        };
      }
      return p;
    });
    onUpdateProjects(updatedProjects);
    setShowAddRoomModal(false);
    setNewRoomName('');
    setSelectedAddRoomTemplateId(null);
  };

  // Delete Room
  const handleDeleteRoom = (roomId: string) => {
    if (!currentProject) return;
    const updatedProjects = projects.map(p => {
      if (p.id === currentProject.id) {
        return {
          ...p,
          rooms: p.rooms.filter(r => r.id !== roomId)
        };
      }
      return p;
    });
    onUpdateProjects(updatedProjects);
  };

  // Duplicate Project
  const handleDuplicateProject = (proj: ProjectRecord) => {
    const dup: ProjectRecord = {
      ...proj,
      id: `proj_${Date.now()}`,
      name: `${proj.name} (Copy)`,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      rooms: proj.rooms.map(r => ({ ...r, id: `room_${Date.now()}_${Math.random()}` }))
    };
    onUpdateProjects([dup, ...projects]);
  };

  // Delete Project
  const handleDeleteProject = (projId: string) => {
    if (projects.length <= 1) {
      alert('You must keep at least one project.');
      return;
    }
    const next = projects.filter(p => p.id !== projId);
    onUpdateProjects(next);
    if (activeProjectId === projId) {
      onSelectProject(next[0].id);
    }
  };

  return (
    <div className="relative w-full h-full min-h-0 bg-slate-950 flex flex-col select-none overflow-y-auto pb-6">
      {/* Top Project Bar */}
      <div className="p-4 bg-slate-900/80 border-b border-slate-800 backdrop-blur-md sticky top-0 z-20">
        <div className="flex items-center justify-between gap-3 mb-2">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-white tracking-tight">{currentProject?.name}</h2>
              <span className="text-xs bg-slate-800 text-slate-300 px-2 py-0.5 rounded-full capitalize">
                {currentProject?.propertyType}
              </span>
            </div>
            {currentProject?.address && (
              <p className="text-xs text-slate-400 mt-0.5">{currentProject.address}</p>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={handleSharePdf}
              disabled={isSharing === 'pdf'}
              title="Share Project Survey Report via Web Share"
              className="px-3 py-1.5 bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-md transition-all active:scale-95 disabled:opacity-50"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>{isSharing === 'pdf' ? 'Sharing...' : 'Share'}</span>
            </button>
            <button
              onClick={() => setShowExportModal(true)}
              title="Open Project Export & Share Menu"
              className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-md transition-all active:scale-95"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export</span>
            </button>
          </div>
        </div>

        {/* Export / Share Feedback Toast */}
        {exportNotice && (
          <div className="mb-2 px-3 py-2 bg-amber-500/10 border border-amber-500/30 rounded-xl text-xs text-amber-300 flex items-center justify-between animate-in fade-in slide-in-from-top-1">
            <span>{exportNotice}</span>
            <button onClick={() => setExportNotice(null)} className="text-amber-400 hover:text-white">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Tab Navigation */}
        <div className="flex items-center gap-1 p-1 bg-slate-950/70 rounded-xl border border-slate-800">
          <button
            onClick={() => setActiveTab('rooms')}
            className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              activeTab === 'rooms' ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-400 hover:text-white'
            }`}
          >
            Rooms ({currentProject?.rooms.length || 0})
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              activeTab === 'history' ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-400 hover:text-white'
            }`}
          >
            Measurements ({measurements.length})
          </button>
          <button
            onClick={() => setActiveTab('all_projects')}
            className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              activeTab === 'all_projects' ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-400 hover:text-white'
            }`}
          >
            All Projects ({projects.length})
          </button>
        </div>
      </div>

      {/* TAB 1: ROOMS IN HOUSE PROJECT */}
      {activeTab === 'rooms' && currentProject && (
        <div className="p-4 space-y-4">
          {/* House Totals Banner */}
          <div className="bg-gradient-to-r from-slate-900 via-slate-900 to-slate-800 border border-slate-800 rounded-2xl p-4 flex items-center justify-between shadow-lg">
            <div>
              <div className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Total House Area</div>
              <div className="text-2xl font-black font-mono-numbers text-amber-400 mt-0.5">
                {formatArea(totalHouseArea, settings.defaultAreaUnit)}
              </div>
            </div>
            <div className="text-right">
              <div className="text-xs text-slate-400 font-semibold">Total Rooms</div>
              <div className="text-xl font-bold font-mono-numbers text-white mt-0.5">
                {currentProject.rooms.length}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between pt-1">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">Room Schedule</h3>
            <button
              onClick={() => setShowAddRoomModal(true)}
              className="px-3 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Room
            </button>
          </div>

          {/* Room Filter Search */}
          {currentProject.rooms.length > 0 && (
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <input
                type="text"
                value={roomSearchQuery}
                onChange={e => setRoomSearchQuery(e.target.value)}
                placeholder="Filter rooms by name (e.g. Living, Kitchen)..."
                className="w-full pl-8 pr-8 py-2 bg-slate-900 border border-slate-800 focus:border-amber-500 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none transition-colors shadow-inner"
              />
              {roomSearchQuery && (
                <button
                  onClick={() => setRoomSearchQuery('')}
                  title="Clear room search"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-white rounded-md transition-colors"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          )}

          {/* Rooms Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {displayedRooms.length === 0 ? (
              <div className="p-8 text-center bg-slate-900/40 border border-slate-800/80 rounded-2xl col-span-full">
                <Search className="w-6 h-6 text-slate-600 mx-auto mb-2" />
                <p className="text-xs font-semibold text-slate-300">No rooms match &ldquo;{roomSearchQuery}&rdquo;</p>
                <button
                  onClick={() => setRoomSearchQuery('')}
                  className="mt-2 text-xs text-amber-400 hover:underline font-medium"
                >
                  Clear room filter
                </button>
              </div>
            ) : (
              displayedRooms.map(room => (
              <div
                key={room.id}
                className="bg-slate-900/90 border border-slate-800/80 rounded-2xl p-4 flex flex-col justify-between hover:border-slate-700 transition-all shadow-md group"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-amber-500" />
                      <h4 className="text-sm font-bold text-white">{room.name}</h4>
                    </div>
                    <button
                      onClick={() => handleDeleteRoom(room.id)}
                      className="opacity-40 group-hover:opacity-100 hover:text-rose-400 text-slate-400 p-1 transition-opacity"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs py-2 border-y border-slate-800/80 my-2">
                    <div>
                      <span className="text-slate-400">Dimensions:</span>
                      <div className="font-mono-numbers font-semibold text-slate-200 mt-0.5">
                        {formatLength(room.length, settings.defaultLengthUnit)} × {formatLength(room.width, settings.defaultLengthUnit)}
                      </div>
                    </div>
                    <div>
                      <span className="text-slate-400">Floor Area:</span>
                      <div className="font-mono-numbers font-bold text-amber-400 mt-0.5">
                        {formatArea(room.area, settings.defaultAreaUnit)}
                      </div>
                    </div>
                  </div>

                  <div className="text-[11px] text-slate-400 flex items-center justify-between">
                    <span>Perimeter: {formatLength(room.perimeter, settings.defaultLengthUnit)}</span>
                    <span>Furniture: {room.furniture.length} items</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 mt-4 pt-2">
                  <button
                    onClick={() => onOpenRoomPlanner(room)}
                    className="flex-1 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-xl text-xs font-semibold transition-colors flex items-center justify-center gap-1.5"
                  >
                    2D Floor Plan
                  </button>
                  <button
                    onClick={() => onOpen3DView(room)}
                    className="flex-1 py-2 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded-xl text-xs font-semibold transition-colors flex items-center justify-center gap-1.5"
                  >
                    3D View
                  </button>
                </div>
              </div>
            ))
          )}
          </div>
        </div>
      )}

      {/* TAB 2: MEASUREMENT HISTORY */}
      {activeTab === 'history' && (
        <div className="p-4 space-y-3">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-2">Saved Measurements</h3>
          {measurements.length === 0 ? (
            <div className="text-center py-12 text-slate-500 text-xs">
              No saved measurements yet. Use AR tools to measure and save.
            </div>
          ) : (
            <div className="space-y-2">
              {measurements.map(m => (
                <div
                  key={m.id}
                  className="bg-slate-900 border border-slate-800 rounded-xl p-3 flex items-center justify-between hover:border-slate-700 transition-all"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-white">{m.name}</span>
                      <span className="text-[10px] text-amber-500 uppercase tracking-wider font-mono">
                        {m.type}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-2">
                      <span>{new Date(m.timestamp).toLocaleDateString()}</span>
                      <span>·</span>
                      <span className="capitalize">{m.confidence} confidence</span>
                      {m.notes && <span>· {m.notes}</span>}
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="text-base font-black font-mono-numbers text-amber-400">
                      {m.type === 'angle'
                        ? `${m.primaryValue.toFixed(1)}°`
                        : m.type === 'area'
                        ? formatArea(m.primaryValue, settings.defaultAreaUnit)
                        : m.type === 'volume'
                        ? formatVolume(m.primaryValue, settings.defaultVolumeUnit)
                        : formatLength(m.primaryValue, settings.defaultLengthUnit)}
                    </span>
                    {onDeleteMeasurement && (
                      <button
                        onClick={() => onDeleteMeasurement(m.id)}
                        className="text-slate-500 hover:text-rose-400 p-1 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: ALL PROJECTS */}
      {activeTab === 'all_projects' && (
        <div className="p-4 space-y-3">
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">All House Projects</h3>
            <button
              onClick={() => setShowNewProjectModal(true)}
              className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-md transition-colors"
            >
              <FolderPlus className="w-4 h-4" />
              New Project
            </button>
          </div>

          {/* Search Input Field at top of Project List */}
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Filter projects and rooms by name..."
              className="w-full pl-9 pr-9 py-2 bg-slate-900 border border-slate-800 focus:border-amber-500 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none transition-colors shadow-inner"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                title="Clear project search"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-white rounded-md transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {searchQuery.trim() && (
            <div className="flex items-center justify-between text-xs text-slate-400 px-1">
              <span>
                Found {filteredProjects.length} of {projects.length} project{projects.length === 1 ? '' : 's'}
              </span>
              <button
                onClick={() => setSearchQuery('')}
                className="text-amber-400 hover:text-amber-300 font-medium hover:underline text-[11px]"
              >
                Clear filter
              </button>
            </div>
          )}

          {filteredProjects.length === 0 ? (
            <div className="p-8 text-center bg-slate-900/40 border border-slate-800/80 rounded-2xl">
              <Search className="w-8 h-8 text-slate-600 mx-auto mb-2" />
              <h4 className="text-sm font-bold text-white mb-1">No Projects Found</h4>
              <p className="text-xs text-slate-400 max-w-xs mx-auto mb-3">
                No projects or rooms match &ldquo;{searchQuery}&rdquo;.
              </p>
              <button
                onClick={() => setSearchQuery('')}
                className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl transition-colors"
              >
                Clear Search
              </button>
            </div>
          ) : (
            <div className="space-y-2.5">
              {filteredProjects.map(proj => (
                <div
                  key={proj.id}
                  onClick={() => { onSelectProject(proj.id); setActiveTab('rooms'); }}
                  className={`p-4 rounded-2xl border cursor-pointer transition-all flex flex-col gap-2 ${
                    proj.id === activeProjectId
                      ? 'bg-slate-900 border-amber-500/60 shadow-lg'
                      : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-bold text-white">{proj.name}</h4>
                        {proj.id === activeProjectId && (
                          <span className="text-[10px] bg-amber-500 text-slate-950 font-bold px-2 py-0.5 rounded-full">
                            ACTIVE
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-400 mt-1 flex items-center gap-2">
                        <span>{proj.rooms.length} Rooms</span>
                        <span>·</span>
                        <span className="font-mono-numbers">
                          {formatArea(proj.rooms.reduce((s, r) => s + r.area, 0), settings.defaultAreaUnit)}
                        </span>
                        {proj.address && <span>· {proj.address}</span>}
                      </div>
                    </div>

                    <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                      <button
                        onClick={() => handleDuplicateProject(proj)}
                        title="Duplicate project"
                        className="p-2 hover:bg-slate-800 text-slate-400 hover:text-white rounded-lg transition-colors"
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteProject(proj.id)}
                        title="Delete project"
                        className="p-2 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Matching rooms indicator when searching */}
                  {searchQuery.trim() && proj.rooms.some(r => r.name.toLowerCase().includes(searchQuery.toLowerCase().trim())) && (
                    <div className="mt-1 pt-2 border-t border-slate-800/80 flex flex-wrap items-center gap-1.5" onClick={e => e.stopPropagation()}>
                      <span className="text-[10px] text-slate-400 font-medium">Matching rooms:</span>
                      {proj.rooms
                        .filter(r => r.name.toLowerCase().includes(searchQuery.toLowerCase().trim()))
                        .map(r => (
                          <button
                            key={r.id}
                            onClick={() => {
                              onSelectProject(proj.id);
                              onOpenRoomPlanner(r);
                            }}
                            className="text-[10px] bg-amber-500/15 border border-amber-500/30 text-amber-300 px-2 py-0.5 rounded-full flex items-center gap-1 hover:bg-amber-500/30 transition-colors"
                            title={`Open 2D Floor Plan for ${r.name}`}
                          >
                            <Box className="w-2.5 h-2.5 text-amber-400" />
                            <span>{r.name}</span>
                          </button>
                        ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* New Project Modal */}
      {showNewProjectModal && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-5 shadow-2xl space-y-3.5 max-h-[90vh] overflow-y-auto">
            <h3 className="text-base font-bold text-white">Create New House Project</h3>
            <div>
              <label className="text-xs text-slate-400 block mb-1">Project Name</label>
              <input
                type="text"
                placeholder="e.g. Oakwood Villa"
                value={newProjectName}
                onChange={e => setNewProjectName(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-amber-500"
              />
            </div>
            <div>
              <label className="text-xs text-slate-400 block mb-1">Property Type</label>
              <select
                value={newPropertyType}
                onChange={e => setNewPropertyType(e.target.value as ProjectRecord['propertyType'])}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-amber-500"
              >
                <option value="apartment">Apartment</option>
                <option value="house">Detached House</option>
                <option value="villa">Villa / Estate</option>
                <option value="office">Commercial / Office</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-400 block mb-1">Address (Optional)</label>
              <input
                type="text"
                placeholder="e.g. 120 Maple Street"
                value={newAddress}
                onChange={e => setNewAddress(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-amber-500"
              />
            </div>

            {/* Starter Room Template */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs text-slate-300 font-semibold flex items-center gap-1.5">
                  <Shapes className="w-3.5 h-3.5 text-amber-400" />
                  <span>Starter Room Template</span>
                </label>
                <span className="text-[10px] text-amber-400 font-medium">Pre-populates layout</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 p-1 bg-slate-950/70 rounded-xl border border-slate-800 max-h-44 overflow-y-auto [scrollbar-width:thin]">
                {ROOM_TEMPLATES.map(tmpl => {
                  const isSelected = selectedProjectTemplateId === tmpl.id;
                  return (
                    <button
                      type="button"
                      key={tmpl.id}
                      onClick={() => setSelectedProjectTemplateId(tmpl.id)}
                      className={`p-2 rounded-xl border text-left flex flex-col justify-between transition-all ${
                        isSelected
                          ? 'bg-amber-500/15 border-amber-500 text-white shadow-sm ring-1 ring-amber-500/40'
                          : 'bg-slate-900/80 border-slate-800/80 text-slate-300 hover:border-slate-700 hover:bg-slate-800/60'
                      }`}
                    >
                      <div className="flex items-center justify-between w-full mb-1">
                        <span className="text-xs font-bold truncate">{tmpl.name}</span>
                        {isSelected && <Check className="w-3.5 h-3.5 text-amber-400 shrink-0" />}
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono-numbers">
                        {formatLength(tmpl.length, settings.defaultLengthUnit)} × {formatLength(tmpl.width, settings.defaultLengthUnit)}
                      </div>
                      <span className="text-[9px] text-slate-500 truncate mt-0.5 capitalize">{tmpl.shape.replace('_', ' ')}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setShowNewProjectModal(false)}
                className="flex-1 py-2.5 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold hover:bg-slate-700"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateProject}
                className="flex-1 py-2.5 rounded-xl bg-amber-500 text-slate-950 text-xs font-bold hover:bg-amber-400"
              >
                Create Project
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Room Modal */}
      {showAddRoomModal && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-5 shadow-2xl space-y-3.5 max-h-[90vh] overflow-y-auto">
            <h3 className="text-base font-bold text-white">Add Room to Project</h3>

            {/* Room Templates Quick Picker */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs text-slate-300 font-semibold flex items-center gap-1.5">
                  <Shapes className="w-3.5 h-3.5 text-amber-400" />
                  <span>Choose Room Template</span>
                </label>
                <span className="text-[10px] text-slate-400">Pre-populates dimensions</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 p-1 bg-slate-950/70 rounded-xl border border-slate-800 max-h-40 overflow-y-auto [scrollbar-width:thin]">
                {ROOM_TEMPLATES.map(tmpl => {
                  const isSelected = selectedAddRoomTemplateId === tmpl.id;
                  return (
                    <button
                      type="button"
                      key={tmpl.id}
                      onClick={() => {
                        setSelectedAddRoomTemplateId(tmpl.id);
                        setNewRoomName(tmpl.name);
                        setNewRoomType(tmpl.type);
                        setNewRoomLength(tmpl.length.toString());
                        setNewRoomWidth(tmpl.width.toString());
                      }}
                      className={`p-2 rounded-xl border text-left flex flex-col justify-between transition-all ${
                        isSelected
                          ? 'bg-amber-500/15 border-amber-500 text-white shadow-sm ring-1 ring-amber-500/40'
                          : 'bg-slate-900/80 border-slate-800/80 text-slate-300 hover:border-slate-700 hover:bg-slate-800/60'
                      }`}
                    >
                      <div className="flex items-center justify-between w-full mb-0.5">
                        <span className="text-xs font-bold truncate">{tmpl.name}</span>
                        {isSelected && <Check className="w-3 h-3 text-amber-400 shrink-0" />}
                      </div>
                      <div className="text-[10px] text-amber-400 font-mono-numbers font-medium">
                        {formatLength(tmpl.length, settings.defaultLengthUnit)} × {formatLength(tmpl.width, settings.defaultLengthUnit)}
                      </div>
                      <span className="text-[9px] text-slate-500 truncate mt-0.5 capitalize">{tmpl.shape.replace('_', ' ')}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs text-slate-400">Room Name</label>
                <button
                  type="button"
                  onClick={async () => {
                    const l = parseFloat(newRoomLength) || 4.5;
                    const w = parseFloat(newRoomWidth) || 3.5;
                    const { classifyRoomLayout } = await import('../../utils/aiRoomClassifier');
                    const res = await classifyRoomLayout({
                      length: l,
                      width: w,
                      area: l * w,
                      perimeter: 2 * (l + w),
                      detectedFurniture: [newRoomType.replace('_', ' ')]
                    });
                    if (res.roomName) setNewRoomName(res.roomName);
                    if (res.roomType) setNewRoomType(res.roomType);
                  }}
                  className="text-[11px] text-amber-400 hover:text-amber-300 font-semibold flex items-center gap-1 transition-colors"
                >
                  <Sparkles className="w-3 h-3" />
                  <span>AI Auto-Name</span>
                </button>
              </div>
              <input
                type="text"
                placeholder="e.g. Master Bedroom"
                value={newRoomName}
                onChange={e => setNewRoomName(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-amber-500 font-semibold"
              />
            </div>

            <div>
              <label className="text-xs text-slate-400 block mb-1">Room Type</label>
              <select
                value={newRoomType}
                onChange={e => setNewRoomType(e.target.value as RoomRecord['type'])}
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
              </select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-slate-400 block mb-1">Length (meters)</label>
                <input
                  type="number"
                  step="0.1"
                  value={newRoomLength}
                  onChange={e => setNewRoomLength(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm font-mono-numbers text-white focus:outline-none focus:border-amber-500"
                />
              </div>
              <div>
                <label className="text-xs text-slate-400 block mb-1">Width (meters)</label>
                <input
                  type="number"
                  step="0.1"
                  value={newRoomWidth}
                  onChange={e => setNewRoomWidth(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm font-mono-numbers text-white focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setShowAddRoomModal(false)}
                className="flex-1 py-2.5 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold hover:bg-slate-700"
              >
                Cancel
              </button>
              <button
                onClick={handleAddRoom}
                className="flex-1 py-2.5 rounded-xl bg-amber-500 text-slate-950 text-xs font-bold hover:bg-amber-400"
              >
                Add Room
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PROJECT EXPORT & WEB SHARE MENU MODAL */}
      {showExportModal && currentProject && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg p-5 space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <FileDown className="w-5 h-5 text-amber-500" />
                  <span>Project Export & Share Menu</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Send {currentProject.name} to apps, contacts, CAD software or printers
                </p>
              </div>
              <button
                onClick={() => setShowExportModal(false)}
                className="w-8 h-8 rounded-lg bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* FORMAT 1: PDF ARCHITECTURAL DOSSIER */}
            <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2.5">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-white flex items-center gap-1.5">
                      <span>Architectural Survey Report</span>
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 font-mono-numbers">
                        .PDF
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-400">
                      Multi-page survey dossier with schedules, room dimensions & cover sheet
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <button
                  onClick={() => {
                    exportProjectToPDF(currentProject, settings);
                    showToast('Downloaded PDF Survey Dossier');
                  }}
                  className="flex-1 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-emerald-400 border border-slate-700/80 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download PDF</span>
                </button>
                <button
                  onClick={handleSharePdf}
                  disabled={isSharing === 'pdf'}
                  className="flex-1 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors shadow-md disabled:opacity-50"
                >
                  <Share2 className="w-3.5 h-3.5" />
                  <span>{isSharing === 'pdf' ? 'Sharing...' : 'Share PDF'}</span>
                </button>
              </div>
            </div>

            {/* FORMAT 2: DXF FOR CAD SOFTWARE */}
            <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2.5">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-lg bg-sky-500/10 border border-sky-500/20 text-sky-400 flex items-center justify-center shrink-0">
                    <Box className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-white flex items-center gap-1.5">
                      <span>AutoCAD & CAD Exchange Format</span>
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-sky-500/20 text-sky-300 font-mono-numbers">
                        .DXF
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-400">
                      Layered CAD vector geometry for AutoCAD, LibreCAD, Revit, SketchUp & Rhino
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between text-xs bg-slate-900/90 p-2 rounded-lg border border-slate-800">
                <span className="text-slate-400 text-[11px]">CAD Coordinate Units:</span>
                <div className="flex items-center gap-1">
                  {(['mm', 'm', 'in'] as const).map(u => (
                    <button
                      key={u}
                      onClick={() => setDxfUnit(u)}
                      className={`px-2 py-0.5 rounded text-[11px] font-mono-numbers uppercase transition-colors ${
                        dxfUnit === u
                          ? 'bg-sky-500 text-slate-950 font-bold'
                          : 'bg-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      {u}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <button
                  onClick={() => {
                    downloadProjectDXF(currentProject, settings, { unit: dxfUnit });
                    showToast(`Downloaded ${currentProject.name} as CAD DXF`);
                  }}
                  className="flex-1 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-sky-400 border border-slate-700/80 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download DXF</span>
                </button>
                <button
                  onClick={handleShareDxf}
                  disabled={isSharing === 'dxf'}
                  className="flex-1 py-2 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors shadow-md disabled:opacity-50"
                >
                  <Share2 className="w-3.5 h-3.5" />
                  <span>{isSharing === 'dxf' ? 'Sharing...' : 'Share DXF'}</span>
                </button>
              </div>
            </div>

            {/* FORMAT 3: SVG SCALABLE VECTOR */}
            <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2.5">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
                    <PenTool className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-white flex items-center gap-1.5">
                      <span>Scalable Vector Graphics</span>
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 font-mono-numbers">
                        .SVG
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-400">
                      Lossless vector floor plan for Figma, Adobe Illustrator, Inkscape & web
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <button
                  onClick={() => {
                    downloadProjectSVG(currentProject, settings);
                    showToast(`Downloaded ${currentProject.name} as Vector SVG`);
                  }}
                  className="flex-1 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-400 border border-slate-700/80 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download SVG</span>
                </button>
                <button
                  onClick={handleShareSvg}
                  disabled={isSharing === 'svg'}
                  className="flex-1 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors shadow-md disabled:opacity-50"
                >
                  <Share2 className="w-3.5 h-3.5" />
                  <span>{isSharing === 'svg' ? 'Sharing...' : 'Share SVG'}</span>
                </button>
              </div>
            </div>

            <div className="pt-1">
              <button
                onClick={() => setShowExportModal(false)}
                className="w-full py-2.5 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold hover:bg-slate-700 transition-colors"
              >
                Close Menu
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
