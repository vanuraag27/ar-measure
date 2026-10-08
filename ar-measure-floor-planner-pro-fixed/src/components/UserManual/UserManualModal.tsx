import { useState, useMemo } from 'react';
import { 
  BookOpen, Search, X, Check, ChevronRight, HelpCircle, 
  Ruler, LayoutGrid, Box, FolderKanban, Sliders, FileText, 
  Download, Sparkles, Move, Camera, Crosshair, Sun, Table, 
  ExternalLink, Layers, Compass, Lightbulb, ShieldAlert, CheckCircle2,
  FileSpreadsheet
} from 'lucide-react';

interface UserManualModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialSection?: string;
}

interface ManualSection {
  id: string;
  category: string;
  title: string;
  icon: React.ReactNode;
  summary: string;
  content: {
    steps?: string[];
    details?: string[];
    tips?: string[];
    tables?: { header: string[]; rows: string[][] };
    specs?: { label: string; value: string }[];
  };
}

const MANUAL_SECTIONS: ManualSection[] = [
  {
    id: 'overview',
    category: 'Getting Started',
    title: '1. App Overview & Navigation',
    icon: <BookOpen className="w-4 h-4 text-amber-400" />,
    summary: 'Understanding the workspace layout, sync indicator, and unit conversion.',
    content: {
      steps: [
        'Bottom Navigation Bar: Use the 5 bottom tabs to toggle between Home (Dashboard), Measure (AR Camera), Floor Plan (2D Editor), Projects (Project Library & Templates), and Settings (Units & CAD Export).',
        'Global Unit Toggle (Top Bar): Tap "m / cm" or "ft / in" at any time to instantly switch all calculations, inputs, and displays between Metric and Imperial systems without corrupting SI base data.',
        'Real-Time Sync Status: Look for the green "Saved" badge in the header. AR Measure Pro automatically persists project structures, rooms, and measurements to your browser storage.',
        'Tutorial & Quick Help: Tap the question mark icon (?) in the top bar to re-launch the visual 5-step onboarding walkthrough.'
      ],
      tips: [
        'All raw measurement data is saved in standard SI units (meters, radians) behind the scenes, ensuring zero cumulative rounding loss when switching unit systems.'
      ],
      specs: [
        { label: 'Supported Devices', value: 'Any modern browser with WebRTC / Camera and WebGL support (iOS, Android, Chrome, Safari, Firefox, Edge)' },
        { label: 'Data Persistence', value: 'Local storage with schema corruption self-repair' }
      ]
    }
  },
  {
    id: 'ar_measure',
    category: 'AR Measuring Tools',
    title: '2. Augmented Reality Measuring Tools',
    icon: <Ruler className="w-4 h-4 text-sky-400" />,
    summary: 'How to calibrate, aim, and use the 8 AR measurement tools with precision.',
    content: {
      steps: [
        'Grant Camera Access: When opening the Measure tab for the first time, allow browser camera permissions.',
        'Surface Detection: Point your camera at a well-lit floor, table, or wall. Move device slowly in small circular motions until yellow surface tracking feature points appear.',
        'Choose an AR Mode from the top toolbar: Tape, Distance, Angle, Area, Perimeter, Volume, Path, or Height.',
        'Placing Points: Align the central circular reticle with your physical target. Tap "Start Point" (or tap anywhere on screen). Walk or move your camera to the end target and tap "Lock Point".',
        'Saving Results: Tap "Save Measurement" at the bottom to store the measurement to your project history, complete with confidence rating and timestamp.'
      ],
      tables: {
        header: ['AR Tool', 'Purpose', 'How to Use'],
        rows: [
          ['Tape', 'Point-to-point linear distance', 'Aim reticle at start point, tap Start, move to end point, tap Lock.'],
          ['Distance', 'Continuous rangefinder', 'Constantly displays distance from your camera lens to target plane.'],
          ['Angle', 'Corner & interior angle meter', 'Tap vertex 1, corner vertex 2, and target 3 to read interior & exterior degrees.'],
          ['Area', 'Surface square footage / m²', 'Tap 3 or more points around a floor or wall boundary to compute enclosed area.'],
          ['Volume', 'Cubic capacity measurement', 'Measure length, width, and height to calculate 3D box or room volume.'],
          ['Height', 'Vertical ceiling clearance', 'Aim at the floor base, tap Lock Base, aim at ceiling crown, tap Lock Top.'],
          ['Path', 'Multi-segment cumulative distance', 'Trace meandering hallways or perimeters with chained waypoints.']
        ]
      },
      tips: [
        'For highest accuracy, ensure steady lighting and avoid featureless solid white walls or deep mirrors.',
        'Use the "Calibration Factor" slider in Settings if your physical hardware camera field-of-view needs fine-tuning.'
      ]
    }
  },
  {
    id: 'room_scanner',
    category: 'Room Scanner & 2D Floor Plan',
    title: '3. Guided Room Scanner & 2D Floor Plan Editor',
    icon: <LayoutGrid className="w-4 h-4 text-amber-400" />,
    summary: 'Scanning physical rooms into digital vector floor plans and placing furniture.',
    content: {
      steps: [
        'Launch Room Scanner: From the Home tab or Measure ribbon, choose "Room Scanner".',
        'Mark Corners: Walk along the room perimeter in a clockwise order. Aim reticle at each baseboard corner and tap "Add Corner".',
        'Auto-Close Loop: When returning to the starting point, tap "Finish Scan". The app generates a 2D floor plan with aligned orthogonal walls and calculated square footage.',
        'Editing in 2D Floor Planner: Drag wall segments or corner vertices to adjust dimensions. Use pinch gestures or mouse scroll to zoom in/out and drag canvas to pan.',
        'Adding Partition Walls & Windows: Tap the Wall or Window tool in the 2D planner to insert interior partition walls and window openings with orientation degrees.',
        'Arranging Furniture: Open the furniture drawer to drag and drop sofas, beds, dining tables, desks, and kitchen counters. Use the rotation wheel to position items.'
      ],
      tips: [
        'Tap the "AI Auto-Name" button when adding or editing a room to let the spatial classifier inspect room proportions and suggest standard room types (e.g. Master Bedroom, Galley Kitchen).'
      ]
    }
  },
  {
    id: 'three_d_view',
    category: '3D Room Model',
    title: '4. Interactive 3D Room Visualizer & Daylight Simulation',
    icon: <Box className="w-4 h-4 text-emerald-400" />,
    summary: 'Orbiting 3D room models, inspecting ceiling heights, and simulating daylight.',
    content: {
      steps: [
        'Open 3D Model: Tap "3D View" from the 2D Floor Planner, Home Dashboard, or Projects view.',
        'Orbit & Inspect: Drag to rotate the 3D room in 360 degrees. Pinch or scroll to zoom in and out. Two-finger drag pans the camera.',
        'Wall Openings & Windows: Inspect transparent window glass cutouts and architectural wall heights (default 2.70m ceiling clearance).',
        'Daylight & Sunlight Simulation: Use the Virtual Light Dimmer slider to preview how natural sunlight illuminates the room at sunrise, noon, and sunset based on your room compass orientation.'
      ],
      tips: [
        'Tap on any furniture item inside the 3D view to inspect its 3D bounding dimensions and clearance.'
      ]
    }
  },
  {
    id: 'projects_templates',
    category: 'Projects & Templates',
    title: '5. Projects Library & Common Room Templates',
    icon: <FolderKanban className="w-4 h-4 text-purple-400" />,
    summary: 'Organizing houses, searching projects, and using instant architectural room templates.',
    content: {
      steps: [
        'Projects Library: Navigate to the "Projects" tab to view all multi-room survey files.',
        'Search Filter: Use the top search bar to quickly find projects and rooms by name (e.g., "Kitchen", "Living", "Suite 8B"). Matching rooms appear as clickable tags to jump straight into their 2D floor plan.',
        'Creating a Project with Starter Templates: Tap "New Project", enter a name, and select a Starter Room Template (Rectangular Room, Master Bedroom, L-Shaped Room, Kitchen, Bathroom, or Home Office).',
        'Adding Rooms via Templates: Inside a project, tap "Add Room". Pick any template to instantly pre-fill room names, dimensions (length × width), boundary polygon vertices, and starter furniture.',
        'Duplicating & Archiving: Tap the copy icon on any project card to duplicate its entire room structure as a template or backup.'
      ],
      tables: {
        header: ['Template', 'Dimensions', 'Shape', 'Sample Furniture Included'],
        rows: [
          ['Rectangular Room', '5.50m × 4.20m (23.10 m²)', 'Rectangle', '3-Seater Sofa, Coffee Table, TV Unit'],
          ['Master Bedroom', '4.80m × 3.80m (18.24 m²)', 'Rectangle', 'King Bed, Wardrobe, Bedside Table'],
          ['L-Shaped Room', '6.00m × 5.00m (23.75 m²)', '6-Vertex L-Alcove', 'Sectional L-Sofa, Dining Table'],
          ['Kitchen', '4.00m × 3.00m (12.00 m²)', 'Rectangle', 'Kitchen Counter, Double Refrigerator'],
          ['Bathroom', '2.80m × 2.20m (6.16 m²)', 'Compact', 'Bathtub, Vanity, Wall Toilet'],
          ['Home Office', '3.60m × 3.00m (10.80 m²)', 'Rectangle', 'Executive Desk, Ergonomic Chair']
        ]
      }
    }
  },
  {
    id: 'cad_exports',
    category: 'CAD, CSV & PDF Exports',
    title: '6. Professional CAD, CSV, SVG & PDF Exports',
    icon: <Download className="w-4 h-4 text-amber-400" />,
    summary: 'Exporting survey data to AutoCAD, Revit, Civil 3D, Excel, Illustrator, and PDF.',
    content: {
      steps: [
        'Open Export Menu: Go to Settings -> File Export, or tap the "Export" button in Projects.',
        'Select Target: Choose whether to export the active room or the entire multi-room project.',
        'Choose Output Format:',
        '• CAD (.DXF): Generates standard AutoCAD Release 12 (AC1009) ASCII DXF files with organized layers (WALLS_PERIMETER, WALLS_INTERIOR, DIMENSIONS, FURNITURE, ROOM_LABELS). Compatible with AutoCAD, Revit, Rhino, SketchUp, LibreCAD, and FreeCAD.',
        '• Survey Data (.CSV): Generates a tabular point file with Civil 3D P,N,E,Z point coordinates, wall segment nodes, door/window schedules, and furniture Bill of Materials (BOM) for Excel and Revit schedules.',
        '• Vector (.SVG): Scalable vector drawing with blueprint or white theme, 1m reference grid, scale bar, and title block for Adobe Illustrator, Figma, or print.',
        '• Survey Report (.PDF): Multi-page dossier with cover sheet, 2D floor plan vector drawings, dimension tables, and client sign-off blocks.',
        'Direct Sharing: Tap "Share" to dispatch files directly to contacts, email, or cloud drives via the Web Share API.'
      ],
      tips: [
        'DXF coordinate units can be set to mm, m, or inches in the Settings export panel before downloading.'
      ]
    }
  },
  {
    id: 'specialty_tools',
    category: 'Specialty Tools',
    title: '7. Physical Screen Ruler & Photo Measure',
    icon: <Crosshair className="w-4 h-4 text-rose-400" />,
    summary: 'Specialized optical measurement tools for small parts and photo documentation.',
    content: {
      steps: [
        'On-Screen Physical Ruler: Access from Home -> "Screen Ruler". Calibrated high-density millimeter and 1/16-inch caliper ruler for measuring physical parts (screws, keys, hardware) directly on your device screen.',
        'Photo Measure: Access from Home -> "Photo Measure". Upload an existing photo of a room, window, or piece of furniture. Draw a calibration line over an object of known size (e.g., standard credit card 85.6mm, or standard door height 2.1m), and then measure any other dimension in the photo.'
      ]
    }
  },
  {
    id: 'troubleshooting',
    category: 'Troubleshooting & FAQ',
    title: '8. Troubleshooting & Best Practices',
    icon: <HelpCircle className="w-4 h-4 text-amber-400" />,
    summary: 'Solutions for camera tracking, lighting, accuracy, and storage backup.',
    content: {
      steps: [
        'Camera is Black or Permission Denied: Ensure camera permissions are enabled in your browser settings (Chrome / Safari -> Site Settings -> Camera -> Allow). Reload page.',
        'Drift or Low Tracking Confidence: Move slowly when aiming. Avoid point-blank surfaces closer than 0.3 meters. Turn on room lights if the environment is too dim.',
        'Export Doesn\'t Download: Ensure browser pop-up blockers are not blocking automatic downloads. Tap the "Share" button as an alternative to send the file via your device system share sheet.',
        'Data Backup: Your projects are stored locally in browser storage. To back up your data before clearing browser cache, export your project as CAD (.DXF), CSV (.CSV), or PDF.'
      ]
    }
  }
];

export function UserManualModal({ isOpen, onClose, initialSection }: UserManualModalProps) {
  const [activeSectionId, setActiveSectionId] = useState<string>(initialSection || 'overview');
  const [searchQuery, setSearchQuery] = useState('');

  // Filter sections by search query
  const filteredSections = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return MANUAL_SECTIONS;
    return MANUAL_SECTIONS.filter(sec => {
      const matchTitle = sec.title.toLowerCase().includes(q);
      const matchSummary = sec.summary.toLowerCase().includes(q);
      const matchCategory = sec.category.toLowerCase().includes(q);
      const matchSteps = sec.content.steps?.some(s => s.toLowerCase().includes(q));
      const matchTips = sec.content.tips?.some(t => t.toLowerCase().includes(q));
      return matchTitle || matchSummary || matchCategory || matchSteps || matchTips;
    });
  }, [searchQuery]);

  const activeSection = useMemo(() => {
    return filteredSections.find(s => s.id === activeSectionId) || filteredSections[0] || MANUAL_SECTIONS[0];
  }, [filteredSections, activeSectionId]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 select-none">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-4xl h-[90vh] max-h-[820px] shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Top Header Bar */}
        <div className="p-4 bg-slate-950/80 border-b border-slate-800/80 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white tracking-tight">AR Measure Pro User Manual</h2>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-mono-numbers">
                  v2.4
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Complete guide to measuring, floor planning, room templates & CAD exports
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors"
            title="Close Manual"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Search Bar Strip */}
        <div className="p-3 bg-slate-900/90 border-b border-slate-800/60 shrink-0">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search user manual (e.g., DXF, CSV, L-Shaped, Tape, Calibration)..."
              className="w-full pl-9 pr-9 py-2 bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none transition-colors shadow-inner"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Main Content Split Pane */}
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
          
          {/* Left Navigation Sidebar */}
          <div className="w-full md:w-64 border-b md:border-b-0 md:border-r border-slate-800/80 bg-slate-950/40 p-2 overflow-y-auto shrink-0 max-h-48 md:max-h-full [scrollbar-width:thin]">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2 py-1 mb-1">
              Table of Contents ({filteredSections.length})
            </div>
            <div className="space-y-1">
              {filteredSections.map(sec => {
                const isActive = activeSection?.id === sec.id;
                return (
                  <button
                    key={sec.id}
                    onClick={() => setActiveSectionId(sec.id)}
                    className={`w-full text-left p-2.5 rounded-xl transition-all flex items-center gap-2.5 ${
                      isActive
                        ? 'bg-amber-500/15 border border-amber-500/40 text-white font-bold shadow-sm'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 border border-transparent'
                    }`}
                  >
                    <div className="shrink-0">{sec.icon}</div>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs truncate">{sec.title}</div>
                      <div className="text-[10px] text-slate-500 truncate">{sec.category}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right Main Article View */}
          <div className="flex-1 p-4 sm:p-6 overflow-y-auto space-y-6 [scrollbar-width:thin]">
            {activeSection ? (
              <div>
                {/* Article Header */}
                <div className="border-b border-slate-800/80 pb-4 mb-5">
                  <div className="flex items-center gap-2 text-xs font-semibold text-amber-400 mb-1">
                    <span>{activeSection.category}</span>
                    <span>·</span>
                    <span className="text-slate-400">{activeSection.id.toUpperCase()}</span>
                  </div>
                  <h3 className="text-xl font-bold text-white tracking-tight flex items-center gap-2.5">
                    {activeSection.title}
                  </h3>
                  <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                    {activeSection.summary}
                  </p>
                </div>

                {/* Steps Section */}
                {activeSection.content.steps && (
                  <div className="space-y-3 mb-6">
                    <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-amber-400" />
                      <span>Step-by-Step Instructions</span>
                    </h4>
                    <div className="space-y-2">
                      {activeSection.content.steps.map((step, idx) => (
                        <div key={idx} className="flex items-start gap-3 p-3 rounded-2xl bg-slate-950/60 border border-slate-800/70 text-xs text-slate-300 leading-relaxed">
                          <span className="w-5 h-5 rounded-full bg-slate-800 text-amber-400 font-bold font-mono-numbers text-[10px] flex items-center justify-center shrink-0 mt-0.5">
                            {idx + 1}
                          </span>
                          <span className="flex-1">{step}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Tables Section */}
                {activeSection.content.tables && (
                  <div className="space-y-2 mb-6">
                    <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
                      <Table className="w-3.5 h-3.5 text-amber-400" />
                      <span>Reference Table</span>
                    </h4>
                    <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950/60">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-800/70 text-slate-300 border-b border-slate-800">
                          <tr>
                            {activeSection.content.tables.header.map((h, i) => (
                              <th key={i} className="p-2.5 font-bold">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/60 text-slate-300">
                          {activeSection.content.tables.rows.map((row, rIdx) => (
                            <tr key={rIdx} className="hover:bg-slate-800/30">
                              {row.map((cell, cIdx) => (
                                <td key={cIdx} className="p-2.5">{cell}</td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Specs Section */}
                {activeSection.content.specs && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-6">
                    {activeSection.content.specs.map((sp, idx) => (
                      <div key={idx} className="p-3 bg-slate-950/70 border border-slate-800 rounded-xl text-xs">
                        <span className="text-[10px] text-slate-400 block font-semibold">{sp.label}</span>
                        <span className="text-slate-200 font-medium mt-0.5 block">{sp.value}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Pro Tips Box */}
                {activeSection.content.tips && (
                  <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs space-y-1.5 mb-6">
                    <div className="flex items-center gap-2 font-bold text-amber-400">
                      <Lightbulb className="w-4 h-4 shrink-0" />
                      <span>Pro Tips</span>
                    </div>
                    {activeSection.content.tips.map((tip, idx) => (
                      <p key={idx} className="text-slate-300 leading-relaxed text-[11px] pl-6">
                        • {tip}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="p-12 text-center text-slate-500">
                <Search className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>No sections found matching your search.</p>
              </div>
            )}
          </div>
        </div>

        {/* Footer Bar */}
        <div className="p-3 bg-slate-950/90 border-t border-slate-800/80 flex items-center justify-between shrink-0 text-xs text-slate-400 px-4">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Interactive User Manual & Guide</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition-colors shadow-sm"
          >
            Got It
          </button>
        </div>

      </div>
    </div>
  );
}
