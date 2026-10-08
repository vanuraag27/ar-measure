import { ProjectRecord, MeasurementRecord, AppSettings, RoomRecord, FurnitureItem, WallSegment, RoomWindowConfig, LengthUnit, AreaUnit, VolumeUnit, UnitSystem } from '../types';
import { 
  validateProject, validateProjects, 
  validateRoom, validateMeasurement, 
  validateMeasurements, validateSettings,
  validateAndHarmonizeUnitSettings,
  validateMeasurementCalculation,
  validateStorageUnitConsistency,
  isUnitConsistentWithSystem
} from './validation';

export { 
  validateProject, validateProjects, 
  validateRoom, validateMeasurement, 
  validateMeasurements, validateSettings,
  validateAndHarmonizeUnitSettings,
  validateMeasurementCalculation,
  validateStorageUnitConsistency,
  isUnitConsistentWithSystem
};

export const STORAGE_KEYS = {
  PROJECTS: 'ar_measure_projects_v1',
  MEASUREMENTS: 'ar_measure_history_v1',
  SETTINGS: 'ar_measure_settings_v1',
  ACTIVE_PROJECT_ID: 'ar_measure_active_proj_v1',
  ACTIVE_ROOM_ID: 'ar_measure_active_room_v1',
} as const;

export const DEFAULT_SETTINGS: AppSettings = {
  unitSystem: 'metric',
  defaultLengthUnit: 'm',
  defaultAreaUnit: 'm²',
  defaultVolumeUnit: 'm³',
  enablePlaneVisualization: true,
  enableFeaturePoints: true,
  smoothingFilter: 'medium',
  calibrationFactor: 1.0,
  deviceHeight: 1.4,
  enableHaptics: true,
  enableVoiceGuidance: true,
  theme: 'dark',
  pdfPaperSize: 'a4',
  language: 'en',
  hasSeenTutorial: false,
};

export const SAMPLE_PROJECT: ProjectRecord = {
  id: 'proj_sample_01',
  name: 'Sunset Heights Residence',
  propertyType: 'apartment',
  address: '450 Skyline Boulevard, Suite 8B',
  clientName: 'Sarah & David Miller',
  createdAt: 1714500000000,
  updatedAt: 1714586400000,
  notes: 'Main floor complete renovation survey. Ceiling clearance 2.75m.',
  rooms: [
    {
      id: 'room_living_01',
      projectId: 'proj_sample_01',
      name: 'Living Room',
      type: 'living_room',
      length: 5.80,
      width: 4.25,
      height: 2.75,
      area: 24.65,
      perimeter: 20.10,
      color: '#3b82f6',
      corners: [
        { x: 0, y: 0 },
        { x: 5.80, y: 0 },
        { x: 5.80, y: 4.25 },
        { x: 0, y: 4.25 }
      ],
      furniture: [
        { id: 'f_sofa_1', roomId: 'room_living_01', type: 'sofa', name: '3-Seater Sofa', x: 2.9, y: 3.2, width: 2.2, depth: 0.9, height: 0.85, rotation: 0, color: '#475569' },
        { id: 'f_tv_1', roomId: 'room_living_01', type: 'tv_unit', name: 'TV Media Console', x: 2.9, y: 0.4, width: 2.0, depth: 0.45, height: 0.5, rotation: 180, color: '#334155' },
        { id: 'f_table_1', roomId: 'room_living_01', type: 'dining_table', name: 'Coffee Table', x: 2.9, y: 1.9, width: 1.2, depth: 0.7, height: 0.45, rotation: 0, color: '#64748b' }
      ],
      walls: [],
      windows: [
        { id: 'win_liv_1', wall: 'south', width: 1.8, height: 1.4, sillHeight: 0.9, offsetMeters: 2.0 }
      ]
    },
    {
      id: 'room_kitchen_01',
      projectId: 'proj_sample_01',
      name: 'Modern Kitchen',
      type: 'kitchen',
      length: 3.80,
      width: 3.00,
      height: 2.75,
      area: 11.40,
      perimeter: 13.60,
      color: '#10b981',
      corners: [
        { x: 0, y: 0 },
        { x: 3.80, y: 0 },
        { x: 3.80, y: 3.00 },
        { x: 0, y: 3.00 }
      ],
      furniture: [
        { id: 'f_counter_1', roomId: 'room_kitchen_01', type: 'kitchen_counter', name: 'L-Countertop', x: 1.8, y: 0.5, width: 2.4, depth: 0.65, height: 0.9, rotation: 0, color: '#0f766e' },
        { id: 'f_fridge_1', roomId: 'room_kitchen_01', type: 'refrigerator', name: 'Smart Refrigerator', x: 3.2, y: 0.5, width: 0.85, depth: 0.75, height: 1.85, rotation: 0, color: '#94a3b8' }
      ],
      walls: [],
      windows: [
        { id: 'win_kit_1', wall: 'east', width: 1.2, height: 1.0, sillHeight: 1.1, offsetMeters: 1.5 }
      ]
    },
    {
      id: 'room_bed_01',
      projectId: 'proj_sample_01',
      name: 'Master Bedroom',
      type: 'bedroom',
      length: 4.20,
      width: 3.50,
      height: 2.75,
      area: 14.70,
      perimeter: 15.40,
      color: '#8b5cf6',
      corners: [
        { x: 0, y: 0 },
        { x: 4.20, y: 0 },
        { x: 4.20, y: 3.50 },
        { x: 0, y: 3.50 }
      ],
      furniture: [
        { id: 'f_bed_1', roomId: 'room_bed_01', type: 'bed', name: 'King Size Bed', x: 2.1, y: 1.8, width: 1.95, depth: 2.15, height: 0.95, rotation: 0, color: '#6366f1' },
        { id: 'f_wardrobe_1', roomId: 'room_bed_01', type: 'wardrobe', name: 'Built-in Wardrobe', x: 0.5, y: 1.8, width: 0.65, depth: 2.2, height: 2.4, rotation: 90, color: '#475569' }
      ],
      walls: [],
      windows: [
        { id: 'win_bed_1', wall: 'south', width: 1.5, height: 1.3, sillHeight: 0.9, offsetMeters: 1.5 }
      ]
    }
  ]
};

export const SAMPLE_MEASUREMENTS: MeasurementRecord[] = [
  {
    id: 'meas_01',
    projectId: 'proj_sample_01',
    roomId: 'room_living_01',
    name: 'Living Room East Wall',
    type: 'tape',
    primaryValue: 5.80,
    unit: 'm',
    confidence: 'high',
    isArEstimated: true,
    timestamp: 1714580000000,
    points: [
      { x: 0, y: 0, z: 2.5 },
      { x: 5.80, y: 0, z: 2.5 }
    ],
    secondaryValues: {
      horizontalDistance: 5.80,
      verticalDistance: 0.0,
      dx: 5.80,
      dy: 0.0,
      dz: 0.0
    }
  },
  {
    id: 'meas_02',
    projectId: 'proj_sample_01',
    roomId: 'room_living_01',
    name: 'Ceiling Clearance Height',
    type: 'height',
    primaryValue: 2.75,
    unit: 'm',
    confidence: 'high',
    isArEstimated: true,
    timestamp: 1714582000000,
    points: [
      { x: 1.2, y: 0, z: 2.5 },
      { x: 1.2, y: 2.75, z: 2.5 }
    ],
    secondaryValues: {
      horizontalDistance: 0.0,
      verticalDistance: 2.75,
      dy: 2.75
    }
  },
  {
    id: 'meas_03',
    projectId: 'proj_sample_01',
    roomId: 'room_kitchen_01',
    name: 'Dining Area Floor',
    type: 'area',
    primaryValue: 11.40,
    unit: 'm²',
    confidence: 'high',
    isArEstimated: true,
    timestamp: 1714584000000,
    points: [
      { x: 5.8, y: 0, z: 0 },
      { x: 8.8, y: 0, z: 0 },
      { x: 8.8, y: 0, z: 3.8 },
      { x: 5.8, y: 0, z: 3.8 }
    ],
    secondaryValues: {
      perimeter: 13.60
    }
  }
];

// ============================================================================
// DATA SANITIZATION & NORMALIZATION HELPERS (DELEGATED TO VALIDATION MODULE)
// ============================================================================

/**
 * Sanitizes and validates a single room record with defensive fallbacks
 */
export function sanitizeRoom(raw: any, projectId: string, index = 0): RoomRecord {
  return validateRoom(raw, projectId, index).sanitized;
}

/**
 * Sanitizes and validates a single project record with fallback rooms
 */
export function sanitizeProject(raw: any, index = 0): ProjectRecord {
  return validateProject(raw, index).sanitized;
}

/**
 * Sanitizes a single measurement record
 */
export function sanitizeMeasurement(raw: any, index = 0): MeasurementRecord {
  return validateMeasurement(raw, index).sanitized;
}

// ============================================================================
// CENTRALIZED STORAGE ERROR-HANDLING WRAPPERS
// ============================================================================

/**
 * Centralized error-handling wrapper for reading and deserializing localStorage data.
 * Catches missing storage, JSON parsing issues, and structural schema errors,
 * repairing corrupted entries with sanitized default objects.
 */
export function safeStorageGet<T>(
  key: string,
  deserializerAndValidator: (parsedJson: unknown) => { isValid: boolean; sanitized: T; errors?: string[] },
  defaultFallbackFactory: () => T,
  options: { autoRepair?: boolean; logPrefix?: string } = { autoRepair: true, logPrefix: 'Storage' }
): T {
  try {
    if (typeof localStorage === 'undefined') {
      return defaultFallbackFactory();
    }

    const raw = localStorage.getItem(key);
    if (raw === null || raw.trim() === '') {
      const fallback = defaultFallbackFactory();
      if (options.autoRepair) {
        try {
          localStorage.setItem(key, JSON.stringify(fallback));
        } catch {}
      }
      return fallback;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch (parseErr) {
      console.warn(`[${options.logPrefix}] Corrupted JSON detected for key '${key}'. Restoring sanitized default:`, parseErr);
      const fallback = defaultFallbackFactory();
      if (options.autoRepair) {
        try {
          localStorage.setItem(key, JSON.stringify(fallback));
        } catch {}
      }
      return fallback;
    }

    const { sanitized, isValid, errors } = deserializerAndValidator(parsed);
    if (!isValid && errors && errors.length > 0) {
      console.warn(`[${options.logPrefix}] Validation repairs applied for key '${key}':`, errors);
      if (options.autoRepair) {
        try {
          localStorage.setItem(key, JSON.stringify(sanitized));
        } catch {}
      }
    }

    return sanitized;
  } catch (err) {
    console.warn(`[${options.logPrefix}] Unexpected storage read error for key '${key}':`, err);
    const fallback = defaultFallbackFactory();
    try {
      localStorage.setItem(key, JSON.stringify(fallback));
    } catch {}
    return fallback;
  }
}

/**
 * Centralized error-handling wrapper for serializing and persisting to localStorage.
 * Checks data structures before persistence with prePersistenceValidator,
 * handles quota-exceeded errors with fallback pruning, and returns a boolean status.
 */
export function safeStorageSet<T>(
  key: string,
  data: T,
  prePersistenceValidator: (data: T) => { isValid: boolean; sanitized: T; errors?: string[] },
  onQuotaRecovery?: (sanitized: T) => T,
  options: { logPrefix?: string } = { logPrefix: 'Storage' }
): boolean {
  try {
    if (typeof localStorage === 'undefined') return false;

    // Validate and check data structure before persistence
    const { sanitized, isValid, errors } = prePersistenceValidator(data);
    if (!isValid && errors && errors.length > 0) {
      console.warn(`[${options.logPrefix}] Pre-persistence validation normalized data for '${key}':`, errors);
    }

    const serialized = JSON.stringify(sanitized);

    try {
      localStorage.setItem(key, serialized);
      return true;
    } catch (quotaErr) {
      console.warn(`[${options.logPrefix}] Storage quota exceeded for '${key}'. Attempting recovery:`, quotaErr);
      if (onQuotaRecovery) {
        try {
          const recovered = onQuotaRecovery(sanitized);
          localStorage.setItem(key, JSON.stringify(recovered));
          return true;
        } catch (subErr) {
          console.error(`[${options.logPrefix}] Quota recovery failed for '${key}':`, subErr);
          return false;
        }
      }
      return false;
    }
  } catch (err) {
    console.error(`[${options.logPrefix}] Failed to persist to storage for key '${key}':`, err);
    return false;
  }
}

// ============================================================================
// STORAGE LOAD & SAVE FUNCTIONS WITH RESILIENT ERROR HANDLING
// ============================================================================

/**
 * Loads and validates stored projects from localStorage
 */
export function getStoredProjects(): ProjectRecord[] {
  return safeStorageGet<ProjectRecord[]>(
    STORAGE_KEYS.PROJECTS,
    (parsed) => {
      const result = validateProjects(parsed);
      if (!result.isValid || result.sanitized.length === 0) {
        return { isValid: false, sanitized: [SAMPLE_PROJECT], errors: result.errors };
      }
      return result;
    },
    () => [SAMPLE_PROJECT],
    { autoRepair: true, logPrefix: 'Projects' }
  );
}

/**
 * Persists projects to localStorage with pre-persistence validation
 */
export function saveProjects(projects: ProjectRecord[]): boolean {
  return safeStorageSet<ProjectRecord[]>(
    STORAGE_KEYS.PROJECTS,
    projects,
    (data) => {
      const result = validateProjects(data);
      if (result.sanitized.length === 0) {
        return { isValid: false, sanitized: [SAMPLE_PROJECT], errors: ['Empty project array; defaulted to sample'] };
      }
      return result;
    },
    (sanitized) => {
      return sanitized.slice(0, 3);
    },
    { logPrefix: 'Projects' }
  );
}

/**
 * Loads stored measurement history
 */
/**
 * Loads stored measurement history with unit consistency validation
 */
export function getStoredMeasurements(): MeasurementRecord[] {
  return safeStorageGet<MeasurementRecord[]>(
    STORAGE_KEYS.MEASUREMENTS,
    (parsed) => {
      const settings = getStoredSettings();
      const rawList = Array.isArray(parsed) ? parsed : [];
      const sanitized = rawList.map(m => validateMeasurementCalculation(m, settings).sanitized);
      return { isValid: true, sanitized, errors: [] };
    },
    () => SAMPLE_MEASUREMENTS,
    { autoRepair: true, logPrefix: 'Measurements' }
  );
}

/**
 * Persists measurement history to localStorage with unit validation & quota protection
 */
export function saveMeasurements(measurements: MeasurementRecord[]): boolean {
  return safeStorageSet<MeasurementRecord[]>(
    STORAGE_KEYS.MEASUREMENTS,
    measurements,
    (data) => {
      const settings = getStoredSettings();
      const rawList = Array.isArray(data) ? data : [];
      const sanitized = rawList.map(m => validateMeasurementCalculation(m, settings).sanitized);
      return { isValid: true, sanitized, errors: [] };
    },
    (sanitized) => {
      // Quota exceeded: trim heavy image URLs and keep latest 50 records
      return sanitized.slice(0, 50).map(m => ({ ...m, imageUrl: undefined }));
    },
    { logPrefix: 'Measurements' }
  );
}

/**
 * Loads and validates application settings with metric/imperial harmonization
 */
export function getStoredSettings(): AppSettings {
  return safeStorageGet<AppSettings>(
    STORAGE_KEYS.SETTINGS,
    (parsed) => validateAndHarmonizeUnitSettings(parsed),
    () => DEFAULT_SETTINGS,
    { autoRepair: true, logPrefix: 'Settings' }
  );
}

/**
 * Persists settings to localStorage with unit harmonization
 */
export function saveSettings(settings: AppSettings): boolean {
  return safeStorageSet<AppSettings>(
    STORAGE_KEYS.SETTINGS,
    settings,
    (data) => validateAndHarmonizeUnitSettings(data),
    undefined,
    { logPrefix: 'Settings' }
  );
}

/**
 * Gets stored active project ID with fallback
 */
export function getStoredActiveProjectId(fallbackId = 'proj_sample_01'): string {
  try {
    if (typeof localStorage === 'undefined') return fallbackId;
    const stored = localStorage.getItem(STORAGE_KEYS.ACTIVE_PROJECT_ID);
    return stored && stored.trim() ? stored.trim() : fallbackId;
  } catch {
    return fallbackId;
  }
}

/**
 * Persists active project ID
 */
export function saveActiveProjectId(id: string): void {
  try {
    if (typeof localStorage === 'undefined') return;
    if (id && id.trim()) {
      localStorage.setItem(STORAGE_KEYS.ACTIVE_PROJECT_ID, id.trim());
    }
  } catch (err) {
    console.warn('Failed to save active project ID:', err);
  }
}

/**
 * Gets stored active room ID
 */
export function getStoredActiveRoomId(): string | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    const stored = localStorage.getItem(STORAGE_KEYS.ACTIVE_ROOM_ID);
    return stored && stored.trim() ? stored.trim() : null;
  } catch {
    return null;
  }
}

/**
 * Persists active room ID
 */
export function saveActiveRoomId(id: string | null): void {
  try {
    if (typeof localStorage === 'undefined') return;
    if (id && id.trim()) {
      localStorage.setItem(STORAGE_KEYS.ACTIVE_ROOM_ID, id.trim());
    } else {
      localStorage.removeItem(STORAGE_KEYS.ACTIVE_ROOM_ID);
    }
  } catch (err) {
    console.warn('Failed to save active room ID:', err);
  }
}
