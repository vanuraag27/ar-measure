import { ProjectRecord, RoomRecord, AppSettings, FurnitureItem, WallSegment } from '../types';
import { formatLength, formatArea } from './units';
import { exportProjectToPDF, generateProjectPDFBlob } from './pdfGenerator';

export interface DxfOptions {
  unit?: 'mm' | 'm' | 'in';
  includeFurniture?: boolean;
  includeDimensions?: boolean;
  includeWalls?: boolean;
  includeAnnotations?: boolean;
}

export interface SvgOptions {
  theme?: 'dark' | 'light';
  includeFurniture?: boolean;
  includeDimensions?: boolean;
  includeGrid?: boolean;
  includeTitleBlock?: boolean;
  includeScaleBar?: boolean;
}

/**
 * Triggers a client-side file download for string content
 */
export function triggerDownload(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ============================================================================
// 1. DXF (AUTOCAD / CAD EXCHANGE FORMAT) GENERATOR
// ============================================================================

/**
 * Generates an AutoCAD R12/2000 ASCII DXF file for a given RoomRecord
 */
export function generateRoomDXF(
  room: RoomRecord,
  project?: ProjectRecord,
  settings?: AppSettings,
  options: DxfOptions = {}
): string {
  const {
    unit = 'mm',
    includeFurniture = true,
    includeDimensions = true,
    includeWalls = true,
    includeAnnotations = true,
  } = options;

  // Scale factor from base meters
  // mm: 1000, m: 1, in: 39.37007874
  const factor = unit === 'mm' ? 1000 : unit === 'in' ? 39.37007874 : 1.0;
  const insUnitCode = unit === 'mm' ? 4 : unit === 'in' ? 1 : 6;

  const roomL = room.length * factor;
  const roomW = room.width * factor;
  const wallThk = 0.15 * factor; // 150mm wall thickness

  const lines: string[] = [];

  // Helper to add line
  const add = (code: number, val: string | number) => {
    lines.push(code.toString());
    lines.push(val.toString());
  };

  // Helper to add a 2D line entity
  const addLine = (
    layer: string,
    x1: number,
    y1: number,
    x2: number,
    y2: number
  ) => {
    add(0, 'LINE');
    add(8, layer);
    add(10, x1.toFixed(3));
    add(20, y1.toFixed(3));
    add(30, '0.0');
    add(11, x2.toFixed(3));
    add(21, y2.toFixed(3));
    add(31, '0.0');
  };

  // Helper to add a text entity
  const addText = (
    layer: string,
    x: number,
    y: number,
    height: number,
    text: string,
    rotation = 0
  ) => {
    add(0, 'TEXT');
    add(8, layer);
    add(10, x.toFixed(3));
    add(20, y.toFixed(3));
    add(30, '0.0');
    add(40, height.toFixed(3));
    add(1, text);
    if (rotation !== 0) {
      add(50, rotation.toFixed(2));
    }
  };

  // DXF HEADER SECTION
  add(0, 'SECTION');
  add(2, 'HEADER');
  add(9, '$ACADVER');
  add(1, 'AC1009'); // AutoCAD Release 11/12 (maximum universal compatibility)
  add(9, '$INSUNITS');
  add(70, insUnitCode);
  add(0, 'ENDSEC');

  // DXF TABLES SECTION (LAYERS)
  add(0, 'SECTION');
  add(2, 'TABLES');
  add(0, 'TABLE');
  add(2, 'LAYER');
  add(70, 6);

  const layersDef = [
    { name: 'WALLS_PERIMETER', color: 7 }, // White
    { name: 'WALLS_INTERIOR', color: 4 },  // Cyan
    { name: 'DIMENSIONS', color: 2 },      // Yellow
    { name: 'FURNITURE', color: 5 },       // Blue
    { name: 'ROOM_LABELS', color: 3 },     // Green
    { name: 'TITLE_BLOCK', color: 6 },     // Magenta
  ];

  layersDef.forEach(l => {
    add(0, 'LAYER');
    add(2, l.name);
    add(70, 0);
    add(62, l.color);
    add(6, 'CONTINUOUS');
  });

  add(0, 'ENDTAB');
  add(0, 'ENDSEC');

  // DXF ENTITIES SECTION
  add(0, 'SECTION');
  add(2, 'ENTITIES');

  // 1. PERIMETER WALLS (Outer and Inner double-line)
  if (includeWalls) {
    // Outer perimeter
    addLine('WALLS_PERIMETER', 0, 0, roomL, 0);
    addLine('WALLS_PERIMETER', roomL, 0, roomL, roomW);
    addLine('WALLS_PERIMETER', roomL, roomW, 0, roomW);
    addLine('WALLS_PERIMETER', 0, roomW, 0, 0);

    // Inner perimeter (cavity/double wall)
    if (roomL > wallThk * 2 && roomW > wallThk * 2) {
      addLine('WALLS_PERIMETER', wallThk, wallThk, roomL - wallThk, wallThk);
      addLine('WALLS_PERIMETER', roomL - wallThk, wallThk, roomL - wallThk, roomW - wallThk);
      addLine('WALLS_PERIMETER', roomL - wallThk, roomW - wallThk, wallThk, roomW - wallThk);
      addLine('WALLS_PERIMETER', wallThk, roomW - wallThk, wallThk, wallThk);
    }

    // Interior Partition Walls
    (room.walls || []).forEach(w => {
      const sx = w.startX * factor;
      const sy = w.startY * factor;
      const ex = w.endX * factor;
      const ey = w.endY * factor;
      const thk = (w.thickness || 0.15) * factor;

      const angle = Math.atan2(ey - sy, ex - sx);
      const nx = -Math.sin(angle) * (thk / 2);
      const ny = Math.cos(angle) * (thk / 2);

      // Line 1
      addLine('WALLS_INTERIOR', sx + nx, sy + ny, ex + nx, ey + ny);
      // Line 2
      addLine('WALLS_INTERIOR', sx - nx, sy - ny, ex - nx, ey - ny);
      // Caps
      addLine('WALLS_INTERIOR', sx + nx, sy + ny, sx - nx, sy - ny);
      addLine('WALLS_INTERIOR', ex + nx, ey + ny, ex - nx, ey - ny);
    });
  }

  // 2. DIMENSION LINES
  if (includeDimensions) {
    const dimOffset = 250 * (factor / 1000);
    const tickLen = 80 * (factor / 1000);
    const textH = 160 * (factor / 1000);

    // Horizontal Top Dimension (Length)
    const dimYTop = roomW + dimOffset;
    addLine('DIMENSIONS', 0, dimYTop, roomL, dimYTop);
    addLine('DIMENSIONS', 0, dimYTop - tickLen, 0, dimYTop + tickLen);
    addLine('DIMENSIONS', roomL, dimYTop - tickLen, roomL, dimYTop + tickLen);

    const lengthStr = settings ? formatLength(room.length, settings.defaultLengthUnit) : `${room.length.toFixed(2)}m`;
    addText('DIMENSIONS', roomL / 2 - textH * 2, dimYTop + textH * 0.4, textH, lengthStr);

    // Vertical Left Dimension (Width)
    const dimXLeft = -dimOffset;
    addLine('DIMENSIONS', dimXLeft, 0, dimXLeft, roomW);
    addLine('DIMENSIONS', dimXLeft - tickLen, 0, dimXLeft + tickLen, 0);
    addLine('DIMENSIONS', dimXLeft - tickLen, roomW, dimXLeft + tickLen, roomW);

    const widthStr = settings ? formatLength(room.width, settings.defaultLengthUnit) : `${room.width.toFixed(2)}m`;
    addText('DIMENSIONS', dimXLeft - textH * 1.2, roomW / 2 - textH * 2, textH, widthStr, 90);
  }

  // 3. FURNITURE ITEMS
  if (includeFurniture) {
    (room.furniture || []).forEach(f => {
      const cx = f.x * factor;
      const cy = f.y * factor;
      const halfW = (f.width * factor) / 2;
      const halfD = (f.depth * factor) / 2;
      const rad = (f.rotation * Math.PI) / 180;
      const cos = Math.cos(rad);
      const sin = Math.sin(rad);

      const rotatePoint = (px: number, py: number) => ({
        x: cx + px * cos - py * sin,
        y: cy + px * sin + py * cos,
      });

      const p1 = rotatePoint(-halfW, -halfD);
      const p2 = rotatePoint(halfW, -halfD);
      const p3 = rotatePoint(halfW, halfD);
      const p4 = rotatePoint(-halfW, halfD);

      addLine('FURNITURE', p1.x, p1.y, p2.x, p2.y);
      addLine('FURNITURE', p2.x, p2.y, p3.x, p3.y);
      addLine('FURNITURE', p3.x, p3.y, p4.x, p4.y);
      addLine('FURNITURE', p4.x, p4.y, p1.x, p1.y);

      // Label inside furniture
      const fTextH = 100 * (factor / 1000);
      addText('FURNITURE', cx - halfW * 0.7, cy - fTextH / 2, fTextH, f.name, f.rotation);
    });
  }

  // 4. ROOM LABELS & ANNOTATIONS
  if (includeAnnotations) {
    const labelH = 240 * (factor / 1000);
    const subLabelH = 140 * (factor / 1000);

    addText('ROOM_LABELS', roomL / 2 - labelH * 2, roomW / 2 + subLabelH, labelH, room.name.toUpperCase());

    const areaStr = settings ? formatArea(room.area, settings.defaultAreaUnit) : `${room.area.toFixed(2)} m²`;
    addText('ROOM_LABELS', roomL / 2 - subLabelH * 2, roomW / 2 - subLabelH * 1.5, subLabelH, areaStr);

    // Title Block in corner
    const titleX = 0;
    const titleY = -350 * (factor / 1000);
    const titleH = 120 * (factor / 1000);
    const projName = project?.name || 'Architectural Survey';
    const dateStr = new Date().toLocaleDateString();

    addText('TITLE_BLOCK', titleX, titleY, titleH, `PROJECT: ${projName.toUpperCase()} · ROOM: ${room.name.toUpperCase()}`);
    addText('TITLE_BLOCK', titleX, titleY - titleH * 1.5, titleH * 0.8, `DATE: ${dateStr} · UNITS: ${unit.toUpperCase()} · SCALE 1:50`);
  }

  // DXF FOOTER SECTION
  add(0, 'ENDSEC');
  add(0, 'EOF');

  return lines.join('\n');
}

/**
 * Downloads a room or project as a DXF file
 */
export function downloadRoomDXF(
  room: RoomRecord,
  project?: ProjectRecord,
  settings?: AppSettings,
  options?: DxfOptions
): void {
  const dxfContent = generateRoomDXF(room, project, settings, options);
  const cleanRoomName = room.name.replace(/\s+/g, '_');
  const filename = `${cleanRoomName}_FloorPlan.dxf`;
  triggerDownload(dxfContent, filename, 'application/dxf');
}

/**
 * Generates and downloads a multi-room project as combined DXF
 */
export function downloadProjectDXF(
  project: ProjectRecord,
  settings?: AppSettings,
  options?: DxfOptions
): void {
  // If single room, export that room
  if (project.rooms.length === 1) {
    downloadRoomDXF(project.rooms[0], project, settings, options);
    return;
  }

  // Place rooms horizontally spaced out in CAD coordinates
  const {
    unit = 'mm',
    includeFurniture = true,
    includeDimensions = true,
    includeWalls = true,
    includeAnnotations = true,
  } = options || {};

  const factor = unit === 'mm' ? 1000 : unit === 'in' ? 39.37007874 : 1.0;
  const insUnitCode = unit === 'mm' ? 4 : unit === 'in' ? 1 : 6;
  const lines: string[] = [];

  const add = (code: number, val: string | number) => {
    lines.push(code.toString());
    lines.push(val.toString());
  };

  const addLine = (layer: string, x1: number, y1: number, x2: number, y2: number) => {
    add(0, 'LINE');
    add(8, layer);
    add(10, x1.toFixed(3));
    add(20, y1.toFixed(3));
    add(30, '0.0');
    add(11, x2.toFixed(3));
    add(21, y2.toFixed(3));
    add(31, '0.0');
  };

  const addText = (layer: string, x: number, y: number, height: number, text: string, rotation = 0) => {
    add(0, 'TEXT');
    add(8, layer);
    add(10, x.toFixed(3));
    add(20, y.toFixed(3));
    add(30, '0.0');
    add(40, height.toFixed(3));
    add(1, text);
    if (rotation !== 0) add(50, rotation.toFixed(2));
  };

  add(0, 'SECTION');
  add(2, 'HEADER');
  add(9, '$ACADVER');
  add(1, 'AC1009');
  add(9, '$INSUNITS');
  add(70, insUnitCode);
  add(0, 'ENDSEC');

  add(0, 'SECTION');
  add(2, 'TABLES');
  add(0, 'TABLE');
  add(2, 'LAYER');
  add(70, 6);
  [
    { name: 'WALLS_PERIMETER', color: 7 },
    { name: 'WALLS_INTERIOR', color: 4 },
    { name: 'DIMENSIONS', color: 2 },
    { name: 'FURNITURE', color: 5 },
    { name: 'ROOM_LABELS', color: 3 },
    { name: 'TITLE_BLOCK', color: 6 },
  ].forEach(l => {
    add(0, 'LAYER');
    add(2, l.name);
    add(70, 0);
    add(62, l.color);
    add(6, 'CONTINUOUS');
  });
  add(0, 'ENDTAB');
  add(0, 'ENDSEC');

  add(0, 'SECTION');
  add(2, 'ENTITIES');

  let currentOffsetX = 0;
  const roomSpacing = 2.0 * factor;

  project.rooms.forEach(room => {
    const roomL = room.length * factor;
    const roomW = room.width * factor;
    const wallThk = 0.15 * factor;
    const ox = currentOffsetX;

    if (includeWalls) {
      addLine('WALLS_PERIMETER', ox, 0, ox + roomL, 0);
      addLine('WALLS_PERIMETER', ox + roomL, 0, ox + roomL, roomW);
      addLine('WALLS_PERIMETER', ox + roomL, roomW, ox, roomW);
      addLine('WALLS_PERIMETER', ox, roomW, ox, 0);

      if (roomL > wallThk * 2 && roomW > wallThk * 2) {
        addLine('WALLS_PERIMETER', ox + wallThk, wallThk, ox + roomL - wallThk, wallThk);
        addLine('WALLS_PERIMETER', ox + roomL - wallThk, wallThk, ox + roomL - wallThk, roomW - wallThk);
        addLine('WALLS_PERIMETER', ox + roomL - wallThk, roomW - wallThk, ox + wallThk, roomW - wallThk);
        addLine('WALLS_PERIMETER', ox + wallThk, roomW - wallThk, ox + wallThk, wallThk);
      }
    }

    if (includeDimensions) {
      const dimOffset = 250 * (factor / 1000);
      const textH = 160 * (factor / 1000);
      addLine('DIMENSIONS', ox, roomW + dimOffset, ox + roomL, roomW + dimOffset);
      const lengthStr = settings ? formatLength(room.length, settings.defaultLengthUnit) : `${room.length.toFixed(2)}m`;
      addText('DIMENSIONS', ox + roomL / 2 - textH * 2, roomW + dimOffset + textH * 0.4, textH, lengthStr);
    }

    if (includeFurniture) {
      (room.furniture || []).forEach(f => {
        const cx = ox + f.x * factor;
        const cy = f.y * factor;
        const halfW = (f.width * factor) / 2;
        const halfD = (f.depth * factor) / 2;
        const rad = (f.rotation * Math.PI) / 180;
        const cos = Math.cos(rad);
        const sin = Math.sin(rad);

        const rP = (px: number, py: number) => ({
          x: cx + px * cos - py * sin,
          y: cy + px * sin + py * cos,
        });

        const p1 = rP(-halfW, -halfD);
        const p2 = rP(halfW, -halfD);
        const p3 = rP(halfW, halfD);
        const p4 = rP(-halfW, halfD);

        addLine('FURNITURE', p1.x, p1.y, p2.x, p2.y);
        addLine('FURNITURE', p2.x, p2.y, p3.x, p3.y);
        addLine('FURNITURE', p3.x, p3.y, p4.x, p4.y);
        addLine('FURNITURE', p4.x, p4.y, p1.x, p1.y);
      });
    }

    if (includeAnnotations) {
      const labelH = 240 * (factor / 1000);
      addText('ROOM_LABELS', ox + roomL / 2 - labelH * 2, roomW / 2, labelH, room.name.toUpperCase());
    }

    currentOffsetX += roomL + roomSpacing;
  });

  add(0, 'ENDSEC');
  add(0, 'EOF');

  const cleanProjName = (project.name || 'Project').replace(/\s+/g, '_');
  triggerDownload(lines.join('\n'), `${cleanProjName}_Full_CAD_Plan.dxf`, 'application/dxf');
}

// ============================================================================
// 2. SVG (VECTOR GRAPHICS FOR ILLUSTRATOR / INKSCAPE / FIGMA) GENERATOR
// ============================================================================

/**
 * Generates an architectural SVG vector file for a given RoomRecord
 */
export function generateRoomSVG(
  room: RoomRecord,
  project?: ProjectRecord,
  settings?: AppSettings,
  options: SvgOptions = {}
): string {
  const {
    theme = 'dark',
    includeFurniture = true,
    includeDimensions = true,
    includeGrid = true,
    includeTitleBlock = true,
    includeScaleBar = true,
  } = options;

  // Pixels per meter in SVG coordinate space
  const ppm = 80;
  const padding = 120;
  const roomW = room.length * ppm;
  const roomH = room.width * ppm;
  const svgWidth = Math.max(800, roomW + padding * 2);
  const svgHeight = Math.max(650, roomH + padding * 2 + (includeTitleBlock ? 90 : 0));

  // Placement offset
  const ox = (svgWidth - roomW) / 2;
  const oy = padding;

  const isDark = theme === 'dark';
  const bgColor = isDark ? '#090d16' : '#ffffff';
  const gridMinor = isDark ? '#111827' : '#f1f5f9';
  const gridMajor = isDark ? '#1e293b' : '#e2e8f0';
  const wallOuter = isDark ? '#f8fafc' : '#0f172a';
  const wallInner = isDark ? '#475569' : '#64748b';
  const floorFill = isDark ? 'rgba(30, 41, 59, 0.45)' : '#f8fafc';
  const dimColor = isDark ? '#f59e0b' : '#d97706';
  const textColor = isDark ? '#ffffff' : '#0f172a';
  const textMuted = isDark ? '#94a3b8' : '#64748b';

  let svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${svgWidth} ${svgHeight}" width="${svgWidth}" height="${svgHeight}" style="background-color: ${bgColor}; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
  <defs>
    <!-- Architectural Dimension Tick Markers -->
    <marker id="tick" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
      <line x1="1" y1="9" x2="9" y2="1" stroke="${dimColor}" stroke-width="1.5" />
    </marker>
    <!-- Minor Grid Pattern (0.2m) -->
    <pattern id="grid-sub" width="${ppm / 5}" height="${ppm / 5}" patternUnits="userSpaceOnUse">
      <path d="M ${ppm / 5} 0 L 0 0 0 ${ppm / 5}" fill="none" stroke="${gridMinor}" stroke-width="0.5" />
    </pattern>
    <!-- Major Grid Pattern (1m) -->
    <pattern id="grid-main" width="${ppm}" height="${ppm}" patternUnits="userSpaceOnUse">
      <rect width="${ppm}" height="${ppm}" fill="url(#grid-sub)" />
      <path d="M ${ppm} 0 L 0 0 0 ${ppm}" fill="none" stroke="${gridMajor}" stroke-width="1" />
    </pattern>
  </defs>
`;

  // 1. Background Grid
  if (includeGrid) {
    svg += `
  <!-- Architectural Reference Grid -->
  <g id="reference-grid">
    <rect width="${svgWidth}" height="${svgHeight}" fill="url(#grid-main)" opacity="0.8" />
  </g>`;
  }

  // 2. Room Floor
  svg += `
  <!-- Room Floor Plan -->
  <g id="floor-geometry">
    <rect x="${ox}" y="${oy}" width="${roomW}" height="${roomH}" fill="${floorFill}" />
  </g>`;

  // 3. Perimeter Walls (Double Line Architectural Style)
  const doubleWallOffset = 4;
  svg += `
  <!-- Structural Perimeter Walls -->
  <g id="walls-perimeter">
    <!-- Outer Wall Boundary -->
    <rect x="${ox}" y="${oy}" width="${roomW}" height="${roomH}" fill="none" stroke="${wallOuter}" stroke-width="5" stroke-linejoin="miter" />
    <!-- Inner Cavity Line -->
    <rect x="${ox + doubleWallOffset}" y="${oy + doubleWallOffset}" width="${Math.max(1, roomW - doubleWallOffset * 2)}" height="${Math.max(1, roomH - doubleWallOffset * 2)}" fill="none" stroke="${wallInner}" stroke-width="1.5" stroke-linejoin="miter" />
  </g>`;

  // 4. Interior Partition Walls
  if ((room.walls || []).length > 0) {
    svg += `
  <!-- Interior Structural Partition Walls -->
  <g id="walls-interior">`;
    room.walls?.forEach(w => {
      const wx1 = ox + w.startX * ppm;
      const wy1 = oy + w.startY * ppm;
      const wx2 = ox + w.endX * ppm;
      const wy2 = oy + w.endY * ppm;
      const thk = Math.max(4, (w.thickness || 0.15) * ppm);
      svg += `
    <line x1="${wx1}" y1="${wy1}" x2="${wx2}" y2="${wy2}" stroke="${isDark ? '#38bdf8' : '#0284c7'}" stroke-width="${thk}" stroke-linecap="square" />
    <line x1="${wx1}" y1="${wy1}" x2="${wx2}" y2="${wy2}" stroke="${isDark ? '#0284c7' : '#0369a1'}" stroke-width="1.5" />`;
    });
    svg += `
  </g>`;
  }

  // 5. Furniture Items
  if (includeFurniture && (room.furniture || []).length > 0) {
    svg += `
  <!-- Furniture & Fixtures -->
  <g id="furniture-items">`;
    (room.furniture || []).forEach(f => {
      const fx = ox + f.x * ppm;
      const fy = oy + f.y * ppm;
      const fw = f.width * ppm;
      const fd = f.depth * ppm;
      const fColor = f.color || (isDark ? '#475569' : '#cbd5e1');

      svg += `
    <g transform="translate(${fx}, ${fy}) rotate(${f.rotation})">
      <rect x="${-fw / 2}" y="${-fd / 2}" width="${fw}" height="${fd}" rx="3" fill="${fColor}" stroke="${isDark ? '#94a3b8' : '#475569'}" stroke-width="1.2" opacity="0.9" />
      <text x="0" y="0" text-anchor="middle" dominant-baseline="middle" fill="#ffffff" font-size="10" font-weight="600">${f.name}</text>
    </g>`;
    });
    svg += `
  </g>`;
  }

  // 6. Dimension Lines
  if (includeDimensions) {
    const lenText = settings ? formatLength(room.length, settings.defaultLengthUnit) : `${room.length.toFixed(2)}m`;
    const widText = settings ? formatLength(room.width, settings.defaultLengthUnit) : `${room.width.toFixed(2)}m`;

    svg += `
  <!-- Dimension Lines & Annotations -->
  <g id="dimension-lines">
    <!-- Top Length Dimension -->
    <line x1="${ox}" y1="${oy - 25}" x2="${ox + roomW}" y2="${oy - 25}" stroke="${dimColor}" stroke-width="1.5" />
    <line x1="${ox}" y1="${oy - 32}" x2="${ox}" y2="${oy - 18}" stroke="${dimColor}" stroke-width="1.5" />
    <line x1="${ox + roomW}" y1="${oy - 32}" x2="${ox + roomW}" y2="${oy - 18}" stroke="${dimColor}" stroke-width="1.5" />
    <text x="${ox + roomW / 2}" y="${oy - 32}" text-anchor="middle" fill="${dimColor}" font-family="'JetBrains Mono', monospace" font-size="12" font-weight="600">${lenText}</text>

    <!-- Left Width Dimension -->
    <line x1="${ox - 25}" y1="${oy}" x2="${ox - 25}" y2="${oy + roomH}" stroke="${dimColor}" stroke-width="1.5" />
    <line x1="${ox - 32}" y1="${oy}" x2="${ox - 18}" y2="${oy}" stroke="${dimColor}" stroke-width="1.5" />
    <line x1="${ox - 32}" y1="${oy + roomH}" x2="${ox - 18}" y2="${oy + roomH}" stroke="${dimColor}" stroke-width="1.5" />
    <text x="${ox - 32}" y="${oy + roomH / 2}" text-anchor="middle" fill="${dimColor}" font-family="'JetBrains Mono', monospace" font-size="12" font-weight="600" transform="rotate(-90, ${ox - 32}, ${oy + roomH / 2})">${widText}</text>
  </g>`;
  }

  // 7. Room Label in Center
  const areaText = settings ? formatArea(room.area, settings.defaultAreaUnit) : `${room.area.toFixed(2)} m²`;
  svg += `
  <!-- Room Identifiers -->
  <g id="room-labels">
    <text x="${ox + roomW / 2}" y="${oy + roomH / 2 - 8}" text-anchor="middle" fill="${textColor}" font-size="16" font-weight="bold" letter-spacing="1">${room.name.toUpperCase()}</text>
    <text x="${ox + roomW / 2}" y="${oy + roomH / 2 + 14}" text-anchor="middle" fill="${textMuted}" font-family="'JetBrains Mono', monospace" font-size="13">${areaText}</text>
  </g>`;

  // 8. Graphic Scale Bar
  if (includeScaleBar) {
    const isImperial = settings?.unitSystem === 'imperial';
    const scaleBarMeters = isImperial ? 0.9144 : 1.0;
    const scaleBarPixels = scaleBarMeters * ppm;
    const scaleLabel = isImperial ? '3 ft' : '1.0m';
    const sX = 30;
    const sY = svgHeight - (includeTitleBlock ? 110 : 30);

    svg += `
  <!-- Architectural Graphic Scale -->
  <g id="graphic-scale">
    <line x1="${sX}" y1="${sY}" x2="${sX + scaleBarPixels}" y2="${sY}" stroke="${textColor}" stroke-width="2" />
    <line x1="${sX}" y1="${sY - 4}" x2="${sX}" y2="${sY + 4}" stroke="${textColor}" stroke-width="2" />
    <line x1="${sX + scaleBarPixels}" y1="${sY - 4}" x2="${sX + scaleBarPixels}" y2="${sY + 4}" stroke="${textColor}" stroke-width="2" />
    <text x="${sX}" y="${sY - 7}" fill="${textColor}" font-family="'JetBrains Mono', monospace" font-size="10">0</text>
    <text x="${sX + scaleBarPixels}" y="${sY - 7}" text-anchor="end" fill="${textColor}" font-family="'JetBrains Mono', monospace" font-size="10">${scaleLabel}</text>
    <text x="${sX + scaleBarPixels + 12}" y="${sY + 3}" fill="${textMuted}" font-family="'JetBrains Mono', monospace" font-size="10">Scale: 1:50</text>
  </g>`;
  }

  // 9. Architectural Title Block (Bottom)
  if (includeTitleBlock) {
    const tbX = 24;
    const tbY = svgHeight - 80;
    const tbW = svgWidth - 48;
    const tbH = 60;
    const projName = project?.name || 'Architectural Floor Plan';
    const dateStr = new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });

    svg += `
  <!-- Professional Architectural Title Block -->
  <g id="title-block">
    <rect x="${tbX}" y="${tbY}" width="${tbW}" height="${tbH}" rx="8" fill="${isDark ? '#0f172a' : '#f1f5f9'}" stroke="${isDark ? '#1e293b' : '#cbd5e1'}" stroke-width="1" />
    <text x="${tbX + 16}" y="${tbY + 24}" fill="${textColor}" font-size="13" font-weight="bold">${projName.toUpperCase()}</text>
    <text x="${tbX + 16}" y="${tbY + 44}" fill="${textMuted}" font-size="10">ROOM: ${room.name} · AREA: ${areaText} · CEILING: ${formatLength(room.height || 2.7, settings?.defaultLengthUnit || 'm')}</text>
    
    <text x="${tbX + tbW - 16}" y="${tbY + 24}" text-anchor="end" fill="${dimColor}" font-size="11" font-weight="bold">AUTOCAD & VECTOR READY</text>
    <text x="${tbX + tbW - 16}" y="${tbY + 44}" text-anchor="end" fill="${textMuted}" font-size="10">${dateStr} · SpatialSurvey AR</text>
  </g>`;
  }

  svg += `
</svg>`;

  return svg;
}

/**
 * Downloads a room as an SVG file
 */
export function downloadRoomSVG(
  room: RoomRecord,
  project?: ProjectRecord,
  settings?: AppSettings,
  options?: SvgOptions
): void {
  const svgContent = generateRoomSVG(room, project, settings, options);
  const cleanRoomName = room.name.replace(/\s+/g, '_');
  const filename = `${cleanRoomName}_FloorPlan.svg`;
  triggerDownload(svgContent, filename, 'image/svg+xml');
}

/**
 * Downloads all rooms in a project as a combined multi-room SVG
 */
export function downloadProjectSVG(
  project: ProjectRecord,
  settings?: AppSettings,
  options?: SvgOptions
): void {
  if (project.rooms.length === 1) {
    downloadRoomSVG(project.rooms[0], project, settings, options);
    return;
  }

  const { theme = 'dark' } = options || {};
  const isDark = theme === 'dark';
  const bgColor = isDark ? '#090d16' : '#ffffff';
  const textColor = isDark ? '#ffffff' : '#0f172a';
  const textMuted = isDark ? '#94a3b8' : '#64748b';

  // Layout all rooms horizontally
  const ppm = 65;
  const padding = 100;
  let totalW = padding;
  let maxH = 0;

  project.rooms.forEach(r => {
    totalW += r.length * ppm + 80;
    maxH = Math.max(maxH, r.width * ppm);
  });
  totalW += padding;
  const totalH = maxH + padding * 2 + 100;

  let svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalW} ${totalH}" width="${totalW}" height="${totalH}" style="background-color: ${bgColor}; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <g id="project-header">
    <text x="${padding}" y="50" fill="${textColor}" font-size="22" font-weight="bold">${(project.name || 'Full Project Plan').toUpperCase()}</text>
    <text x="${padding}" y="74" fill="${textMuted}" font-size="12">${project.rooms.length} Rooms · Generated: ${new Date().toLocaleDateString()}</text>
  </g>`;

  let curX = padding;
  const baseOy = 120;

  project.rooms.forEach(r => {
    const rw = r.length * ppm;
    const rh = r.width * ppm;

    svg += `
  <g id="room-${r.id}" transform="translate(${curX}, ${baseOy})">
    <!-- Room Floor & Walls -->
    <rect width="${rw}" height="${rh}" fill="${isDark ? 'rgba(30, 41, 59, 0.45)' : '#f8fafc'}" stroke="${isDark ? '#f8fafc' : '#0f172a'}" stroke-width="4" />
    <text x="${rw / 2}" y="${rh / 2 - 6}" text-anchor="middle" fill="${textColor}" font-size="14" font-weight="bold">${r.name}</text>
    <text x="${rw / 2}" y="${rh / 2 + 14}" text-anchor="middle" fill="${textMuted}" font-size="11">${formatArea(r.area, settings?.defaultAreaUnit || 'm²')}</text>
    
    <!-- Top & Left Dimensions -->
    <text x="${rw / 2}" y="-12" text-anchor="middle" fill="${isDark ? '#f59e0b' : '#d97706'}" font-size="10">${formatLength(r.length, settings?.defaultLengthUnit || 'm')}</text>
    <text x="-12" y="${rh / 2}" text-anchor="middle" fill="${isDark ? '#f59e0b' : '#d97706'}" font-size="10" transform="rotate(-90, -12, ${rh / 2})">${formatLength(r.width, settings?.defaultLengthUnit || 'm')}</text>
  </g>`;

    curX += rw + 80;
  });

  svg += `
</svg>`;

  const cleanProjName = (project.name || 'Project').replace(/\s+/g, '_');
  triggerDownload(svg, `${cleanProjName}_Full_Vector_Plan.svg`, 'image/svg+xml');
}

// ============================================================================
// 3. WEB SHARE API INTEGRATION & SHARING DISPATCHERS
// ============================================================================

export interface ShareResult {
  success: boolean;
  shared: boolean;
  message: string;
}

/**
 * Checks if the browser environment supports the Web Share API with files
 */
export function isWebShareSupported(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.share === 'function';
}

/**
 * Shares a file using the Web Share API with automatic download fallback
 */
export async function shareFileWithWebShare(params: {
  file: File;
  title: string;
  text: string;
  fallbackDownload: () => void;
}): Promise<ShareResult> {
  const { file, title, text, fallbackDownload } = params;

  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    try {
      // Test if files can be shared
      if (typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title,
          text,
        });
        return { success: true, shared: true, message: `Shared ${file.name} successfully!` };
      } else {
        // Fallback: share text/title
        await navigator.share({
          title,
          text: `${text}\n${file.name}`,
        });
        return { success: true, shared: true, message: `Shared ${title}` };
      }
    } catch (err: any) {
      if (err.name === 'AbortError') {
        return { success: true, shared: false, message: 'Share dismissed' };
      }
      console.warn('Web Share file dispatch failed, falling back to download:', err);
    }
  }

  // Fallback to direct download
  fallbackDownload();
  return {
    success: true,
    shared: false,
    message: 'Web Share not supported on this browser — downloaded file to device instead!'
  };
}

/**
 * Shares a Room or Project as DXF via Web Share API
 */
export async function shareDXF(
  roomOrProject: RoomRecord | ProjectRecord,
  project: ProjectRecord,
  settings?: AppSettings,
  options?: DxfOptions
): Promise<ShareResult> {
  const isRoom = 'type' in roomOrProject && 'length' in roomOrProject;
  const dxfContent = isRoom
    ? generateRoomDXF(roomOrProject as RoomRecord, project, settings, options)
    : (() => {
        // For project, generate project DXF content
        const p = roomOrProject as ProjectRecord;
        if (p.rooms.length === 1) return generateRoomDXF(p.rooms[0], p, settings, options);
        // Fallback to room 1 or single room
        return generateRoomDXF(p.rooms[0], p, settings, options);
      })();

  const cleanName = (isRoom ? (roomOrProject as RoomRecord).name : (project.name || 'CAD_FloorPlan')).replace(/\s+/g, '_');
  const filename = `${cleanName}_CAD_Plan.dxf`;
  const file = new File([dxfContent], filename, { type: 'application/dxf' });

  return shareFileWithWebShare({
    file,
    title: `${isRoom ? (roomOrProject as RoomRecord).name : project.name} - CAD Floor Plan`,
    text: `Architectural CAD Floor Plan (${filename}) from SpatialSurvey AR`,
    fallbackDownload: () => {
      triggerDownload(dxfContent, filename, 'application/dxf');
    }
  });
}

/**
 * Shares a Room or Project as SVG via Web Share API
 */
export async function shareSVG(
  roomOrProject: RoomRecord | ProjectRecord,
  project: ProjectRecord,
  settings?: AppSettings,
  options?: SvgOptions
): Promise<ShareResult> {
  const isRoom = 'type' in roomOrProject && 'length' in roomOrProject;
  const svgContent = isRoom
    ? generateRoomSVG(roomOrProject as RoomRecord, project, settings, options)
    : generateRoomSVG((roomOrProject as ProjectRecord).rooms[0], project, settings, options);

  const cleanName = (isRoom ? (roomOrProject as RoomRecord).name : (project.name || 'Vector_FloorPlan')).replace(/\s+/g, '_');
  const filename = `${cleanName}_FloorPlan.svg`;
  const file = new File([svgContent], filename, { type: 'image/svg+xml' });

  return shareFileWithWebShare({
    file,
    title: `${isRoom ? (roomOrProject as RoomRecord).name : project.name} - Vector Floor Plan`,
    text: `Scalable Vector Floor Plan (${filename}) from SpatialSurvey AR`,
    fallbackDownload: () => {
      triggerDownload(svgContent, filename, 'image/svg+xml');
    }
  });
}

/**
 * Shares Project Survey Report PDF via Web Share API
 */
export async function sharePDF(
  project: ProjectRecord,
  settings: AppSettings
): Promise<ShareResult> {
  const { blob, filename } = generateProjectPDFBlob(project, settings);
  const file = new File([blob], filename, { type: 'application/pdf' });

  return shareFileWithWebShare({
    file,
    title: `${project.name || 'Project'} - Architectural Survey Report`,
    text: `Complete Architectural Survey & Floor Plan Report (${filename}) from SpatialSurvey AR`,
    fallbackDownload: () => {
      exportProjectToPDF(project, settings);
    }
  });
}

// ============================================================================
// 4. CAD-COMPATIBLE CSV SURVEY & POINT DATA EXPORTER
// ============================================================================

/**
 * Generates a CAD-compatible CSV Survey & Schedule file for a RoomRecord
 */
export function generateRoomCSV(
  room: RoomRecord,
  project?: ProjectRecord,
  settings?: AppSettings
): string {
  const rows: string[] = [];

  const esc = (val: string | number | undefined | null) => {
    if (val === undefined || val === null) return '""';
    const s = String(val).replace(/"/g, '""');
    return `"${s}"`;
  };

  const lenUnit = settings?.defaultLengthUnit || 'm';
  const areaUnit = settings?.defaultAreaUnit || 'm²';

  // Section 1: Metadata / CAD Survey Header
  rows.push('# AR MEASURE PRO - ARCHITECTURAL CAD SURVEY EXPORT');
  rows.push('# Professional CAD Point & Attribute Schedule (AutoCAD / Civil 3D / Revit / Excel)');
  rows.push(`# Export Date: ${new Date().toISOString()}`);
  rows.push(`# Project: ${project?.name || 'Default Project'}`);
  rows.push(`# Room: ${room.name} (${room.type})`);
  rows.push('');

  // Section 2: Room Summary Table
  rows.push(['SECTION', 'ROOM_SUMMARY'].join(','));
  rows.push(['Field', 'Value_SI_Base', 'Formatted_Value', 'Unit'].join(','));
  rows.push(['Room ID', esc(room.id), esc(room.id), 'id'].join(','));
  rows.push(['Room Name', esc(room.name), esc(room.name), 'string'].join(','));
  rows.push(['Room Type', esc(room.type), esc(room.type), 'category'].join(','));
  rows.push(['Length', room.length.toFixed(3), esc(formatLength(room.length, lenUnit)), lenUnit].join(','));
  rows.push(['Width', room.width.toFixed(3), esc(formatLength(room.width, lenUnit)), lenUnit].join(','));
  rows.push(['Height', room.height.toFixed(3), esc(formatLength(room.height, lenUnit)), lenUnit].join(','));
  rows.push(['Floor Area', room.area.toFixed(2), esc(formatArea(room.area, areaUnit)), areaUnit].join(','));
  rows.push(['Perimeter', room.perimeter.toFixed(2), esc(formatLength(room.perimeter, lenUnit)), lenUnit].join(','));
  const wallArea = (room.perimeter * room.height).toFixed(2);
  rows.push(['Wall Surface Area', wallArea, esc(formatArea(Number(wallArea), areaUnit)), areaUnit].join(','));
  rows.push(['Orientation Deg', (room.compassOrientation || 0).toFixed(1), `${(room.compassOrientation || 0).toFixed(1)}°`, 'deg'].join(','));
  rows.push('');

  // Section 3: CAD Boundary Survey Points (Civil 3D Point File compatible: Point_ID, Index, X, Y, Z, Description)
  rows.push(['SECTION', 'CAD_BOUNDARY_POINTS'].join(','));
  rows.push(['Point_ID', 'Point_Index', 'X_Easting_Meters', 'Y_Northing_Meters', 'Z_Elevation_Meters', 'Description'].join(','));
  const corners = (room.corners && room.corners.length >= 3)
    ? room.corners
    : [
        { x: 0, y: 0 },
        { x: room.length, y: 0 },
        { x: room.length, y: room.width },
        { x: 0, y: room.width }
      ];

  corners.forEach((c, idx) => {
    rows.push([
      `P${idx + 1}`,
      (idx + 1).toString(),
      c.x.toFixed(3),
      c.y.toFixed(3),
      '0.000',
      esc(`Room Corner ${idx + 1}`)
    ].join(','));
  });
  rows.push('');

  // Section 4: Wall Segments Schedule
  rows.push(['SECTION', 'WALL_SEGMENTS'].join(','));
  rows.push(['Wall_ID', 'Start_X', 'Start_Y', 'End_X', 'End_Y', 'Length_Meters', 'Thickness_Meters', 'Height_Meters', 'Doors_Count', 'Windows_Count'].join(','));
  if (room.walls && room.walls.length > 0) {
    room.walls.forEach((w, wIdx) => {
      const len = Math.hypot(w.endX - w.startX, w.endY - w.startY);
      rows.push([
        w.id || `WALL_${wIdx + 1}`,
        w.startX.toFixed(3),
        w.startY.toFixed(3),
        w.endX.toFixed(3),
        w.endY.toFixed(3),
        len.toFixed(3),
        (w.thickness || 0.15).toFixed(3),
        (w.height || room.height).toFixed(3),
        (w.doors?.length || 0).toString(),
        (w.windows?.length || 0).toString()
      ].join(','));
    });
  } else {
    // Generate 4 perimeter walls from room dimensions
    const perimeterWalls = [
      { id: 'WALL_NORTH', sx: 0, sy: room.width, ex: room.length, ey: room.width },
      { id: 'WALL_EAST', sx: room.length, sy: room.width, ex: room.length, ey: 0 },
      { id: 'WALL_SOUTH', sx: room.length, sy: 0, ex: 0, ey: 0 },
      { id: 'WALL_WEST', sx: 0, sy: 0, ex: 0, ey: room.width },
    ];
    perimeterWalls.forEach(pw => {
      const len = Math.hypot(pw.ex - pw.sx, pw.ey - pw.sy);
      rows.push([
        pw.id,
        pw.sx.toFixed(3),
        pw.sy.toFixed(3),
        pw.ex.toFixed(3),
        pw.ey.toFixed(3),
        len.toFixed(3),
        '0.150',
        room.height.toFixed(3),
        '0',
        '0'
      ].join(','));
    });
  }
  rows.push('');

  // Section 5: Windows & Openings Schedule
  rows.push(['SECTION', 'WINDOWS_AND_OPENINGS'].join(','));
  rows.push(['Window_ID', 'Wall_Direction', 'Offset_Meters', 'Width_Meters', 'Height_Meters', 'Sill_Height_Meters', 'Glazing_Area_SqM'].join(','));
  (room.windows || []).forEach((win, winIdx) => {
    const glzArea = (win.width * win.height).toFixed(2);
    rows.push([
      win.id || `WIN_${winIdx + 1}`,
      esc(win.wall),
      win.offsetMeters.toFixed(3),
      win.width.toFixed(3),
      win.height.toFixed(3),
      win.sillHeight.toFixed(3),
      glzArea
    ].join(','));
  });
  rows.push('');

  // Section 6: Furniture & Fixture Schedule (Bill of Materials / BOM)
  rows.push(['SECTION', 'FURNITURE_FIXTURES_SCHEDULE'].join(','));
  rows.push(['Item_ID', 'Category', 'Name', 'Center_X_Meters', 'Center_Y_Meters', 'Width_Meters', 'Depth_Meters', 'Height_Meters', 'Rotation_Deg', 'Color_Hex'].join(','));
  (room.furniture || []).forEach((f, fIdx) => {
    rows.push([
      f.id || `FURN_${fIdx + 1}`,
      esc(f.type),
      esc(f.name),
      f.x.toFixed(3),
      f.y.toFixed(3),
      f.width.toFixed(3),
      f.depth.toFixed(3),
      f.height.toFixed(3),
      f.rotation.toFixed(1),
      esc(f.color || '#475569')
    ].join(','));
  });

  return rows.join('\r\n');
}

/**
 * Downloads a CAD-compatible CSV file for a given RoomRecord
 */
export function downloadRoomCSV(
  room: RoomRecord,
  project?: ProjectRecord,
  settings?: AppSettings
): void {
  const content = generateRoomCSV(room, project, settings);
  const cleanName = room.name.replace(/\s+/g, '_');
  const filename = `${cleanName}_CAD_Data.csv`;
  triggerDownload(content, filename, 'text/csv;charset=utf-8;');
}

/**
 * Generates a multi-room project CSV schedule
 */
export function generateProjectCSV(
  project: ProjectRecord,
  settings?: AppSettings
): string {
  const rows: string[] = [];
  const esc = (val: string | number | undefined | null) => {
    if (val === undefined || val === null) return '""';
    const s = String(val).replace(/"/g, '""');
    return `"${s}"`;
  };

  rows.push('# AR MEASURE PRO - FULL PROJECT ARCHITECTURAL CAD SCHEDULE');
  rows.push(`# Project Name: ${project.name}`);
  rows.push(`# Property Type: ${project.propertyType}`);
  if (project.address) rows.push(`# Address: ${project.address}`);
  rows.push(`# Total Rooms: ${project.rooms.length}`);
  const totalArea = project.rooms.reduce((acc, r) => acc + (r.area || 0), 0);
  rows.push(`# Total Floor Area: ${totalArea.toFixed(2)} m2`);
  rows.push('');

  // Project Rooms Master Schedule
  rows.push(['SECTION', 'PROJECT_ROOMS_SCHEDULE'].join(','));
  rows.push(['Room_Index', 'Room_ID', 'Room_Name', 'Room_Type', 'Length_Meters', 'Width_Meters', 'Height_Meters', 'Floor_Area_SqM', 'Perimeter_Meters', 'Furniture_Count', 'Windows_Count'].join(','));
  project.rooms.forEach((r, idx) => {
    rows.push([
      (idx + 1).toString(),
      esc(r.id),
      esc(r.name),
      esc(r.type),
      r.length.toFixed(3),
      r.width.toFixed(3),
      r.height.toFixed(3),
      r.area.toFixed(2),
      r.perimeter.toFixed(2),
      (r.furniture?.length || 0).toString(),
      (r.windows?.length || 0).toString()
    ].join(','));
  });
  rows.push('');

  // Combined Furniture & Fixtures BOM
  rows.push(['SECTION', 'PROJECT_BILL_OF_MATERIALS'].join(','));
  rows.push(['Room_Name', 'Item_ID', 'Category', 'Item_Name', 'Width_Meters', 'Depth_Meters', 'Height_Meters'].join(','));
  project.rooms.forEach(r => {
    (r.furniture || []).forEach(f => {
      rows.push([
        esc(r.name),
        esc(f.id),
        esc(f.type),
        esc(f.name),
        f.width.toFixed(3),
        f.depth.toFixed(3),
        f.height.toFixed(3)
      ].join(','));
    });
  });

  return rows.join('\r\n');
}

/**
 * Downloads a multi-room CAD schedule CSV file for a full ProjectRecord
 */
export function downloadProjectCSV(
  project: ProjectRecord,
  settings?: AppSettings
): void {
  const content = generateProjectCSV(project, settings);
  const cleanName = project.name.replace(/\s+/g, '_');
  const filename = `${cleanName}_Project_CAD_Schedule.csv`;
  triggerDownload(content, filename, 'text/csv;charset=utf-8;');
}

/**
 * Shares Room or Project CAD CSV via Web Share API
 */
export async function shareCSV(
  roomOrProject: RoomRecord | ProjectRecord,
  project: ProjectRecord,
  settings?: AppSettings
): Promise<ShareResult> {
  const isRoom = 'type' in roomOrProject && 'length' in roomOrProject;
  const csvContent = isRoom
    ? generateRoomCSV(roomOrProject as RoomRecord, project, settings)
    : generateProjectCSV(project, settings);

  const cleanName = (isRoom ? (roomOrProject as RoomRecord).name : (project.name || 'CAD_Schedule')).replace(/\s+/g, '_');
  const filename = `${cleanName}_CAD_Data.csv`;
  const file = new File([csvContent], filename, { type: 'text/csv;charset=utf-8;' });

  return shareFileWithWebShare({
    file,
    title: `${isRoom ? (roomOrProject as RoomRecord).name : project.name} - CAD CSV Data`,
    text: `Architectural CAD Room Data & Point Schedule (${filename}) from SpatialSurvey AR`,
    fallbackDownload: () => {
      triggerDownload(csvContent, filename, 'text/csv;charset=utf-8;');
    }
  });
}


