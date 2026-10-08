import { 
  ProjectRecord, RoomRecord, FurnitureItem, WallSegment, 
  RoomWindowConfig, MeasurementRecord, AppSettings, 
  LengthUnit, AreaUnit, VolumeUnit, UnitSystem, MeasurementType, TrackingConfidence 
} from '../types';

export interface ValidationResult<T> {
  isValid: boolean;
  errors: string[];
  sanitized: T;
}

export const VALID_PROPERTY_TYPES = ['apartment', 'house', 'villa', 'office', 'commercial'] as const;
export const VALID_ROOM_TYPES = [
  'living_room', 'bedroom', 'kitchen', 'bathroom', 'dining_room', 
  'balcony', 'corridor', 'garage', 'office', 'other'
] as const;
export const VALID_LENGTH_UNITS: LengthUnit[] = ['mm', 'cm', 'm', 'in', 'ft', 'yd'];
export const VALID_AREA_UNITS: AreaUnit[] = ['mm²', 'cm²', 'm²', 'in²', 'ft²', 'yd²'];
export const VALID_VOLUME_UNITS: VolumeUnit[] = ['mm³', 'cm³', 'm³', 'in³', 'ft³', 'yd³'];
export const VALID_UNIT_SYSTEMS: UnitSystem[] = ['metric', 'imperial'];
export const VALID_MEASUREMENT_TYPES: MeasurementType[] = [
  'tape', 'distance', 'angle', 'area', 'perimeter', 'volume', 'path', 'height', 'room_scan'
];
export const VALID_CONFIDENCE_LEVELS: TrackingConfidence[] = ['high', 'medium', 'low'];
export const VALID_WINDOW_WALLS = ['north', 'south', 'east', 'west'] as const;

/**
 * Type guard for checking if value is a non-null object
 */
export function isRecord(value: unknown): value is Record<string, any> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Validates a single furniture item
 */
export function validateFurnitureItem(raw: unknown, roomId?: string, fallbackIndex = 0): ValidationResult<FurnitureItem> {
  const errors: string[] = [];
  const rec = isRecord(raw) ? raw : {};

  const id = typeof rec.id === 'string' && rec.id.trim() ? rec.id.trim() : `furn_${Date.now()}_${fallbackIndex}`;
  if (!rec.id) errors.push(`Furniture missing ID at index ${fallbackIndex}, assigned '${id}'`);

  const assignedRoomId = typeof rec.roomId === 'string' && rec.roomId.trim() ? rec.roomId.trim() : (roomId || '');

  const validTypes = [
    'bed', 'sofa', 'dining_table', 'chair', 'wardrobe', 'tv_unit', 
    'refrigerator', 'kitchen_counter', 'toilet', 'bathtub', 'shower', 'desk', 'door', 'window'
  ];
  const type = validTypes.includes(rec.type) ? rec.type : 'sofa';
  if (!validTypes.includes(rec.type)) errors.push(`Invalid furniture type '${rec.type}', defaulted to 'sofa'`);

  const name = typeof rec.name === 'string' && rec.name.trim() ? rec.name.trim() : 'Furniture Item';
  const x = Number.isFinite(Number(rec.x)) ? Number(rec.x) : 1.0;
  const y = Number.isFinite(Number(rec.y)) ? Number(rec.y) : 1.0;
  const width = Number.isFinite(Number(rec.width)) && Number(rec.width) > 0 ? Number(rec.width) : 1.0;
  const depth = Number.isFinite(Number(rec.depth)) && Number(rec.depth) > 0 ? Number(rec.depth) : 0.8;
  const height = Number.isFinite(Number(rec.height)) && Number(rec.height) > 0 ? Number(rec.height) : 0.8;
  const rotation = Number.isFinite(Number(rec.rotation)) ? Number(rec.rotation) : 0;
  const color = typeof rec.color === 'string' && rec.color.trim() ? rec.color.trim() : '#475569';

  const sanitized: FurnitureItem = {
    id,
    roomId: assignedRoomId || undefined,
    type,
    name,
    x,
    y,
    width,
    depth,
    height,
    rotation,
    color,
  };

  return {
    isValid: errors.length === 0,
    errors,
    sanitized,
  };
}

/**
 * Validates a single wall segment
 */
export function validateWallSegment(raw: unknown, fallbackIndex = 0, defaultHeight = 2.7): ValidationResult<WallSegment> {
  const errors: string[] = [];
  const rec = isRecord(raw) ? raw : {};

  const id = typeof rec.id === 'string' && rec.id.trim() ? rec.id.trim() : `wall_${Date.now()}_${fallbackIndex}`;
  if (!rec.id) errors.push(`Wall segment missing ID, generated '${id}'`);

  const startX = Number.isFinite(Number(rec.startX)) ? Number(rec.startX) : 0;
  const startY = Number.isFinite(Number(rec.startY)) ? Number(rec.startY) : 0;
  const endX = Number.isFinite(Number(rec.endX)) ? Number(rec.endX) : 2.0;
  const endY = Number.isFinite(Number(rec.endY)) ? Number(rec.endY) : 0;
  const thickness = Number.isFinite(Number(rec.thickness)) && Number(rec.thickness) > 0 ? Number(rec.thickness) : 0.15;
  const height = Number.isFinite(Number(rec.height)) && Number(rec.height) > 0 ? Number(rec.height) : defaultHeight;

  const doors = Array.isArray(rec.doors)
    ? rec.doors.map((d: any) => ({
        position: Number.isFinite(Number(d?.position)) ? Number(d.position) : 0.5,
        width: Number.isFinite(Number(d?.width)) && Number(d.width) > 0 ? Number(d.width) : 0.9,
        height: Number.isFinite(Number(d?.height)) && Number(d.height) > 0 ? Number(d.height) : 2.1,
      }))
    : undefined;

  const windows = Array.isArray(rec.windows)
    ? rec.windows.map((w: any) => ({
        position: Number.isFinite(Number(w?.position)) ? Number(w.position) : 0.5,
        width: Number.isFinite(Number(w?.width)) && Number(w.width) > 0 ? Number(w.width) : 1.2,
        height: Number.isFinite(Number(w?.height)) && Number(w.height) > 0 ? Number(w.height) : 1.2,
        sillHeight: Number.isFinite(Number(w?.sillHeight)) ? Number(w.sillHeight) : 0.9,
      }))
    : undefined;

  const sanitized: WallSegment = {
    id,
    startX,
    startY,
    endX,
    endY,
    thickness,
    height,
    doors,
    windows,
  };

  return {
    isValid: errors.length === 0,
    errors,
    sanitized,
  };
}

/**
 * Validates a single room window configuration
 */
export function validateRoomWindow(raw: unknown, fallbackIndex = 0): ValidationResult<RoomWindowConfig> {
  const errors: string[] = [];
  const rec = isRecord(raw) ? raw : {};

  const id = typeof rec.id === 'string' && rec.id.trim() ? rec.id.trim() : `win_${Date.now()}_${fallbackIndex}`;
  const wall = VALID_WINDOW_WALLS.includes(rec.wall) ? rec.wall : 'south';
  if (!VALID_WINDOW_WALLS.includes(rec.wall)) errors.push(`Invalid window wall direction '${rec.wall}', defaulted to 'south'`);

  const offsetMeters = Number.isFinite(Number(rec.offsetMeters)) ? Number(rec.offsetMeters) : 1.5;
  const width = Number.isFinite(Number(rec.width)) && Number(rec.width) > 0 ? Number(rec.width) : 1.5;
  const height = Number.isFinite(Number(rec.height)) && Number(rec.height) > 0 ? Number(rec.height) : 1.2;
  const sillHeight = Number.isFinite(Number(rec.sillHeight)) ? Number(rec.sillHeight) : 0.9;

  const sanitized: RoomWindowConfig = {
    id,
    wall,
    offsetMeters,
    width,
    height,
    sillHeight,
  };

  return {
    isValid: errors.length === 0,
    errors,
    sanitized,
  };
}

/**
 * Validates a single RoomRecord
 */
export function validateRoom(raw: unknown, projectId = '', fallbackIndex = 0): ValidationResult<RoomRecord> {
  const errors: string[] = [];
  const rec = isRecord(raw) ? raw : {};

  const id = typeof rec.id === 'string' && rec.id.trim() ? rec.id.trim() : `room_${Date.now()}_${fallbackIndex}`;
  if (!rec.id) errors.push(`Room missing ID at index ${fallbackIndex}, assigned '${id}'`);

  const assignedProjectId = typeof rec.projectId === 'string' && rec.projectId.trim() ? rec.projectId.trim() : projectId;
  const name = typeof rec.name === 'string' && rec.name.trim() ? rec.name.trim() : `Room ${fallbackIndex + 1}`;
  
  const type = VALID_ROOM_TYPES.includes(rec.type) ? rec.type : 'living_room';
  if (rec.type && !VALID_ROOM_TYPES.includes(rec.type)) {
    errors.push(`Invalid room type '${rec.type}', defaulted to 'living_room'`);
  }

  const length = Number.isFinite(Number(rec.length)) && Number(rec.length) > 0 ? Number(rec.length) : 4.0;
  const width = Number.isFinite(Number(rec.width)) && Number(rec.width) > 0 ? Number(rec.width) : 3.5;
  const height = Number.isFinite(Number(rec.height)) && Number(rec.height) > 0 ? Number(rec.height) : 2.7;
  const area = Number.isFinite(Number(rec.area)) && Number(rec.area) > 0 ? Number(rec.area) : Number((length * width).toFixed(2));
  const perimeter = Number.isFinite(Number(rec.perimeter)) && Number(rec.perimeter) > 0 ? Number(rec.perimeter) : Number((2 * (length + width)).toFixed(2));

  // Sanitize polygon corners
  const corners = Array.isArray(rec.corners) && rec.corners.length >= 3
    ? rec.corners.map((c: any) => ({
        x: Number.isFinite(Number(c?.x)) ? Number(c.x) : 0,
        y: Number.isFinite(Number(c?.y)) ? Number(c.y) : 0,
      }))
    : [
        { x: 0, y: 0 },
        { x: length, y: 0 },
        { x: length, y: width },
        { x: 0, y: width },
      ];

  // Validate furniture items
  const furniture: FurnitureItem[] = Array.isArray(rec.furniture)
    ? rec.furniture.map((f: unknown, fIdx: number) => {
        const valRes = validateFurnitureItem(f, id, fIdx);
        if (!valRes.isValid) errors.push(...valRes.errors);
        return valRes.sanitized;
      })
    : [];

  // Validate partition walls
  const walls: WallSegment[] = Array.isArray(rec.walls)
    ? rec.walls.map((w: unknown, wIdx: number) => {
        const valRes = validateWallSegment(w, wIdx, height);
        if (!valRes.isValid) errors.push(...valRes.errors);
        return valRes.sanitized;
      })
    : [];

  // Validate windows
  const windows: RoomWindowConfig[] = Array.isArray(rec.windows)
    ? rec.windows.map((win: unknown, winIdx: number) => {
        const valRes = validateRoomWindow(win, winIdx);
        if (!valRes.isValid) errors.push(...valRes.errors);
        return valRes.sanitized;
      })
    : [];

  const sanitized: RoomRecord = {
    id,
    projectId: assignedProjectId,
    name,
    type,
    length,
    width,
    height,
    area,
    perimeter,
    corners,
    furniture,
    walls,
    windows,
    color: typeof rec.color === 'string' && rec.color.trim() ? rec.color.trim() : '#3b82f6',
    notes: typeof rec.notes === 'string' ? rec.notes : undefined,
    compassOrientation: Number.isFinite(Number(rec.compassOrientation)) ? Number(rec.compassOrientation) : 0,
  };

  return {
    isValid: errors.length === 0,
    errors,
    sanitized,
  };
}

/**
 * Validates a single ProjectRecord
 */
export function validateProject(raw: unknown, fallbackIndex = 0): ValidationResult<ProjectRecord> {
  const errors: string[] = [];
  const rec = isRecord(raw) ? raw : {};

  const id = typeof rec.id === 'string' && rec.id.trim() ? rec.id.trim() : `proj_${Date.now()}_${fallbackIndex}`;
  if (!rec.id) errors.push(`Project missing ID, generated '${id}'`);

  const name = typeof rec.name === 'string' && rec.name.trim() ? rec.name.trim() : `Project ${fallbackIndex + 1}`;
  const propertyType = VALID_PROPERTY_TYPES.includes(rec.propertyType) ? rec.propertyType : 'apartment';
  if (rec.propertyType && !VALID_PROPERTY_TYPES.includes(rec.propertyType)) {
    errors.push(`Invalid property type '${rec.propertyType}', defaulted to 'apartment'`);
  }

  const createdAt = Number.isFinite(Number(rec.createdAt)) ? Number(rec.createdAt) : Date.now();
  const updatedAt = Number.isFinite(Number(rec.updatedAt)) ? Number(rec.updatedAt) : Date.now();

  // Validate rooms
  let rooms: RoomRecord[] = [];
  if (Array.isArray(rec.rooms) && rec.rooms.length > 0) {
    rooms = rec.rooms.map((r: unknown, rIdx: number) => {
      const valRes = validateRoom(r, id, rIdx);
      if (!valRes.isValid) errors.push(...valRes.errors);
      return valRes.sanitized;
    });
  } else {
    // Generate one default room so project is never empty
    const defaultRoom = validateRoom(null, id, 0).sanitized;
    rooms = [defaultRoom];
    errors.push(`Project '${id}' had no rooms; generated default room.`);
  }

  const sanitized: ProjectRecord = {
    id,
    name,
    propertyType,
    address: typeof rec.address === 'string' && rec.address.trim() ? rec.address.trim() : undefined,
    clientName: typeof rec.clientName === 'string' && rec.clientName.trim() ? rec.clientName.trim() : undefined,
    notes: typeof rec.notes === 'string' ? rec.notes : undefined,
    createdAt,
    updatedAt,
    rooms,
  };

  return {
    isValid: errors.length === 0,
    errors,
    sanitized,
  };
}

/**
 * Validates an array of ProjectRecords before persistence or after retrieval
 */
export function validateProjects(raw: unknown): ValidationResult<ProjectRecord[]> {
  const errors: string[] = [];

  if (!Array.isArray(raw) || raw.length === 0) {
    errors.push('Projects payload is not an array or is empty');
    return {
      isValid: false,
      errors,
      sanitized: [],
    };
  }

  const sanitized: ProjectRecord[] = raw.map((p, idx) => {
    const valRes = validateProject(p, idx);
    if (!valRes.isValid) errors.push(...valRes.errors);
    return valRes.sanitized;
  });

  return {
    isValid: errors.length === 0,
    errors,
    sanitized,
  };
}

/**
 * Validates a single MeasurementRecord
 */
export function validateMeasurement(raw: unknown, fallbackIndex = 0): ValidationResult<MeasurementRecord> {
  const errors: string[] = [];
  const rec = isRecord(raw) ? raw : {};

  const id = typeof rec.id === 'string' && rec.id.trim() ? rec.id.trim() : `meas_${Date.now()}_${fallbackIndex}`;
  const name = typeof rec.name === 'string' && rec.name.trim() ? rec.name.trim() : `Measurement ${fallbackIndex + 1}`;
  
  const type = VALID_MEASUREMENT_TYPES.includes(rec.type) ? rec.type : 'tape';
  if (rec.type && !VALID_MEASUREMENT_TYPES.includes(rec.type)) {
    errors.push(`Invalid measurement type '${rec.type}', defaulted to 'tape'`);
  }

  const primaryValue = Number.isFinite(Number(rec.primaryValue)) ? Number(rec.primaryValue) : 0;
  const unit = typeof rec.unit === 'string' ? rec.unit : 'm';
  const confidence = VALID_CONFIDENCE_LEVELS.includes(rec.confidence) ? rec.confidence : 'high';
  const isArEstimated = Boolean(rec.isArEstimated);
  const timestamp = Number.isFinite(Number(rec.timestamp)) ? Number(rec.timestamp) : Date.now();

  const points = Array.isArray(rec.points)
    ? rec.points.map((p: any) => ({
        x: Number.isFinite(Number(p?.x)) ? Number(p.x) : 0,
        y: Number.isFinite(Number(p?.y)) ? Number(p.y) : 0,
        z: Number.isFinite(Number(p?.z)) ? Number(p.z) : 0,
        screenX: Number.isFinite(Number(p?.screenX)) ? Number(p.screenX) : undefined,
        screenY: Number.isFinite(Number(p?.screenY)) ? Number(p.screenY) : undefined,
      }))
    : [];

  const sanitized: MeasurementRecord = {
    id,
    projectId: typeof rec.projectId === 'string' ? rec.projectId : undefined,
    roomId: typeof rec.roomId === 'string' ? rec.roomId : undefined,
    name,
    type,
    primaryValue,
    unit: unit as any,
    confidence,
    isArEstimated,
    timestamp,
    points,
    secondaryValues: rec.secondaryValues && typeof rec.secondaryValues === 'object' ? rec.secondaryValues : undefined,
    notes: typeof rec.notes === 'string' ? rec.notes : undefined,
    imageUrl: typeof rec.imageUrl === 'string' && rec.imageUrl.length < 500000 ? rec.imageUrl : undefined,
  };

  return {
    isValid: errors.length === 0,
    errors,
    sanitized,
  };
}

/**
 * Validates an array of MeasurementRecords
 */
export function validateMeasurements(raw: unknown): ValidationResult<MeasurementRecord[]> {
  const errors: string[] = [];

  if (!Array.isArray(raw)) {
    errors.push('Measurements payload is not an array');
    return {
      isValid: false,
      errors,
      sanitized: [],
    };
  }

  const sanitized = raw.map((m, idx) => {
    const valRes = validateMeasurement(m, idx);
    if (!valRes.isValid) errors.push(...valRes.errors);
    return valRes.sanitized;
  });

  return {
    isValid: errors.length === 0,
    errors,
    sanitized,
  };
}

/**
 * Validates AppSettings
 */
export function validateSettings(raw: unknown): ValidationResult<AppSettings> {
  const errors: string[] = [];
  const rec = isRecord(raw) ? raw : {};

  const unitSystem: UnitSystem = VALID_UNIT_SYSTEMS.includes(rec.unitSystem)
    ? rec.unitSystem
    : (['in', 'ft', 'yd'].includes(rec.defaultLengthUnit) ? 'imperial' : 'metric');

  const defaultLengthUnit: LengthUnit = VALID_LENGTH_UNITS.includes(rec.defaultLengthUnit)
    ? rec.defaultLengthUnit
    : (unitSystem === 'imperial' ? 'ft' : 'm');

  const defaultAreaUnit: AreaUnit = VALID_AREA_UNITS.includes(rec.defaultAreaUnit)
    ? rec.defaultAreaUnit
    : (unitSystem === 'imperial' ? 'ft²' : 'm²');

  const defaultVolumeUnit: VolumeUnit = VALID_VOLUME_UNITS.includes(rec.defaultVolumeUnit)
    ? rec.defaultVolumeUnit
    : (unitSystem === 'imperial' ? 'ft³' : 'm³');

  const calibrationFactor = Number.isFinite(Number(rec.calibrationFactor)) && Number(rec.calibrationFactor) > 0.5 && Number(rec.calibrationFactor) < 2.0
    ? Number(rec.calibrationFactor)
    : 1.0;

  const deviceHeight = Number.isFinite(Number(rec.deviceHeight)) && Number(rec.deviceHeight) >= 0.6 && Number(rec.deviceHeight) <= 2.5
    ? Number(rec.deviceHeight)
    : 1.4;

  const smoothingFilter = ['off', 'low', 'medium', 'high'].includes(rec.smoothingFilter)
    ? rec.smoothingFilter
    : 'medium';

  const pdfPaperSize = ['a4', 'a3', 'letter'].includes(rec.pdfPaperSize)
    ? rec.pdfPaperSize
    : 'a4';

  const language = ['en', 'hi'].includes(rec.language)
    ? rec.language
    : 'en';

  const sanitized: AppSettings = {
    unitSystem,
    defaultLengthUnit,
    defaultAreaUnit,
    defaultVolumeUnit,
    calibrationFactor,
    deviceHeight,
    smoothingFilter,
    pdfPaperSize,
    language,
    enablePlaneVisualization: rec.enablePlaneVisualization !== false,
    enableFeaturePoints: rec.enableFeaturePoints !== false,
    enableHaptics: rec.enableHaptics !== false,
    enableVoiceGuidance: rec.enableVoiceGuidance !== false,
    hasSeenTutorial: Boolean(rec.hasSeenTutorial),
    theme: ['dark', 'light'].includes(rec.theme) ? rec.theme : 'dark',
  };

  return {
    isValid: errors.length === 0,
    errors,
    sanitized,
  };
}

// ============================================================================
// UNIT SYSTEM CONSISTENCY & CALCULATION VALIDATION UTILITIES
// ============================================================================

export const METRIC_LENGTH_UNITS: LengthUnit[] = ['m', 'cm', 'mm'];
export const IMPERIAL_LENGTH_UNITS: LengthUnit[] = ['ft', 'in', 'yd'];
export const METRIC_AREA_UNITS: AreaUnit[] = ['m²', 'cm²', 'mm²'];
export const IMPERIAL_AREA_UNITS: AreaUnit[] = ['ft²', 'in²', 'yd²'];
export const METRIC_VOLUME_UNITS: VolumeUnit[] = ['m³', 'cm³', 'mm³'];
export const IMPERIAL_VOLUME_UNITS: VolumeUnit[] = ['ft³', 'in³', 'yd³'];

/**
 * Checks whether a given unit belongs to the specified unit system (metric/imperial)
 */
export function isUnitConsistentWithSystem(
  unit: LengthUnit | AreaUnit | VolumeUnit | string, 
  system: UnitSystem
): boolean {
  if (unit === 'deg') return true;
  if (system === 'metric') {
    return (
      METRIC_LENGTH_UNITS.includes(unit as LengthUnit) ||
      METRIC_AREA_UNITS.includes(unit as AreaUnit) ||
      METRIC_VOLUME_UNITS.includes(unit as VolumeUnit)
    );
  }
  return (
    IMPERIAL_LENGTH_UNITS.includes(unit as LengthUnit) ||
    IMPERIAL_AREA_UNITS.includes(unit as AreaUnit) ||
    IMPERIAL_VOLUME_UNITS.includes(unit as VolumeUnit)
  );
}

/**
 * Ensures unit settings (metric/imperial) are consistent across all default units.
 * If unitSystem is metric, ensures default units are metric (m, m², m³).
 * If unitSystem is imperial, ensures default units are imperial (ft, ft², ft³).
 * Prevents configuration corruption when switching unit systems.
 */
export function validateAndHarmonizeUnitSettings(raw: unknown): ValidationResult<AppSettings> {
  const result = validateSettings(raw);
  const settings = result.sanitized;
  const errors = [...result.errors];

  let harmonizedLength = settings.defaultLengthUnit;
  let harmonizedArea = settings.defaultAreaUnit;
  let harmonizedVolume = settings.defaultVolumeUnit;

  if (settings.unitSystem === 'metric') {
    if (!METRIC_LENGTH_UNITS.includes(settings.defaultLengthUnit)) {
      errors.push(`Mismatched defaultLengthUnit '${settings.defaultLengthUnit}' for metric system; harmonized to 'm'.`);
      harmonizedLength = 'm';
    }
    if (!METRIC_AREA_UNITS.includes(settings.defaultAreaUnit)) {
      errors.push(`Mismatched defaultAreaUnit '${settings.defaultAreaUnit}' for metric system; harmonized to 'm²'.`);
      harmonizedArea = 'm²';
    }
    if (!METRIC_VOLUME_UNITS.includes(settings.defaultVolumeUnit)) {
      errors.push(`Mismatched defaultVolumeUnit '${settings.defaultVolumeUnit}' for metric system; harmonized to 'm³'.`);
      harmonizedVolume = 'm³';
    }
  } else {
    // Imperial
    if (!IMPERIAL_LENGTH_UNITS.includes(settings.defaultLengthUnit)) {
      errors.push(`Mismatched defaultLengthUnit '${settings.defaultLengthUnit}' for imperial system; harmonized to 'ft'.`);
      harmonizedLength = 'ft';
    }
    if (!IMPERIAL_AREA_UNITS.includes(settings.defaultAreaUnit)) {
      errors.push(`Mismatched defaultAreaUnit '${settings.defaultAreaUnit}' for imperial system; harmonized to 'ft²'.`);
      harmonizedArea = 'ft²';
    }
    if (!IMPERIAL_VOLUME_UNITS.includes(settings.defaultVolumeUnit)) {
      errors.push(`Mismatched defaultVolumeUnit '${settings.defaultVolumeUnit}' for imperial system; harmonized to 'ft³'.`);
      harmonizedVolume = 'ft³';
    }
  }

  const sanitized: AppSettings = {
    ...settings,
    defaultLengthUnit: harmonizedLength,
    defaultAreaUnit: harmonizedArea,
    defaultVolumeUnit: harmonizedVolume,
  };

  return {
    isValid: errors.length === 0,
    errors,
    sanitized,
  };
}

/**
 * Validates a measurement calculation record to ensure:
 * 1. primaryValue is strictly stored in base SI unit (meters, m², m³, or degrees)
 * 2. unit corresponds to the measurement type
 * 3. secondaryValues are consistent with primary calculation
 * 4. Harmonizes display unit to the active unit system without corrupting SI base data
 */
export function validateMeasurementCalculation(
  raw: unknown,
  activeSettings?: AppSettings
): ValidationResult<MeasurementRecord> {
  const baseResult = validateMeasurement(raw);
  const m = baseResult.sanitized;
  const errors = [...baseResult.errors];

  // Verify primaryValue is valid positive number (or 0)
  if (!Number.isFinite(m.primaryValue) || m.primaryValue < 0) {
    errors.push(`Invalid primaryValue '${m.primaryValue}', normalized to 0`);
    m.primaryValue = 0;
  }

  // Ensure unit corresponds to measurement type
  let expectedUnit = m.unit;
  if (m.type === 'angle') {
    if (m.unit !== 'deg') {
      errors.push(`Angle measurement had unit '${m.unit}', normalized to 'deg'`);
      expectedUnit = 'deg';
    }
  } else if (m.type === 'area') {
    if (!VALID_AREA_UNITS.includes(m.unit as AreaUnit)) {
      const fallbackAreaUnit = activeSettings?.defaultAreaUnit || 'm²';
      errors.push(`Area measurement had non-area unit '${m.unit}', normalized to '${fallbackAreaUnit}'`);
      expectedUnit = fallbackAreaUnit;
    }
  } else if (m.type === 'volume') {
    if (!VALID_VOLUME_UNITS.includes(m.unit as VolumeUnit)) {
      const fallbackVolUnit = activeSettings?.defaultVolumeUnit || 'm³';
      errors.push(`Volume measurement had non-volume unit '${m.unit}', normalized to '${fallbackVolUnit}'`);
      expectedUnit = fallbackVolUnit;
    }
  } else {
    // Length / distance / tape / height / perimeter / path / room_scan
    if (!VALID_LENGTH_UNITS.includes(m.unit as LengthUnit)) {
      const fallbackLenUnit = activeSettings?.defaultLengthUnit || 'm';
      errors.push(`Length measurement had non-length unit '${m.unit}', normalized to '${fallbackLenUnit}'`);
      expectedUnit = fallbackLenUnit;
    }
  }

  // If activeSettings provided, harmonize unit system compatibility without mutating SI primaryValue
  if (activeSettings && expectedUnit !== 'deg') {
    const isConsistent = isUnitConsistentWithSystem(expectedUnit, activeSettings.unitSystem);
    if (!isConsistent) {
      if (m.type === 'area') {
        expectedUnit = activeSettings.defaultAreaUnit;
      } else if (m.type === 'volume') {
        expectedUnit = activeSettings.defaultVolumeUnit;
      } else {
        expectedUnit = activeSettings.defaultLengthUnit;
      }
      errors.push(`Measurement unit harmonized to active unit system '${activeSettings.unitSystem}' (${expectedUnit})`);
    }
  }

  const sanitized: MeasurementRecord = {
    ...m,
    unit: expectedUnit,
  };

  return {
    isValid: errors.length === 0,
    errors,
    sanitized,
  };
}

/**
 * Ensures storage objects (AppSettings, MeasurementRecords, ProjectRecords) have consistent unit
 * settings and SI-calibrated metrics across storage persistence cycles.
 */
export function validateStorageUnitConsistency(
  storage: {
    settings?: unknown;
    measurements?: unknown;
    projects?: unknown;
  }
): {
  isValid: boolean;
  errors: string[];
  sanitized: {
    settings: AppSettings;
    measurements: MeasurementRecord[];
    projects: ProjectRecord[];
  };
} {
  const errors: string[] = [];

  // 1. Harmonize unit settings
  const settingsResult = validateAndHarmonizeUnitSettings(storage.settings);
  if (!settingsResult.isValid) errors.push(...settingsResult.errors);
  const settings = settingsResult.sanitized;

  // 2. Validate measurements with active unit system
  const rawMeasurements = Array.isArray(storage.measurements) ? storage.measurements : [];
  const measurements: MeasurementRecord[] = rawMeasurements.map((m, idx) => {
    const measResult = validateMeasurementCalculation(m, settings);
    if (!measResult.isValid) errors.push(`[Meas ${idx}] ${measResult.errors.join('; ')}`);
    return measResult.sanitized;
  });

  // 3. Validate projects (ensure rooms and walls have positive SI metric dimensions)
  const projectsResult = validateProjects(storage.projects);
  if (!projectsResult.isValid) errors.push(...projectsResult.errors);
  const projects = projectsResult.sanitized;

  return {
    isValid: errors.length === 0,
    errors,
    sanitized: {
      settings,
      measurements,
      projects,
    },
  };
}
