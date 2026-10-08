export type LengthUnit = 'mm' | 'cm' | 'm' | 'in' | 'ft' | 'yd';
export type AreaUnit = 'mm²' | 'cm²' | 'm²' | 'in²' | 'ft²' | 'yd²';
export type VolumeUnit = 'mm³' | 'cm³' | 'm³' | 'in³' | 'ft³' | 'yd³';
export type UnitSystem = 'metric' | 'imperial';

export type MeasurementType = 
  | 'tape' 
  | 'distance' 
  | 'angle' 
  | 'area' 
  | 'perimeter' 
  | 'volume' 
  | 'path' 
  | 'height' 
  | 'room_scan';

export type TrackingConfidence = 'high' | 'medium' | 'low';

export interface Point3D {
  x: number; // in meters (relative to AR origin)
  y: number; // vertical height in meters
  z: number; // depth in meters
  screenX?: number; // projected 2D coordinates on viewport
  screenY?: number;
}

export interface MeasurementRecord {
  id: string;
  projectId?: string;
  roomId?: string;
  name: string;
  type: MeasurementType;
  primaryValue: number; // always stored in base SI unit (meters, m², m³, or degrees)
  unit: LengthUnit | AreaUnit | VolumeUnit | 'deg';
  secondaryValues?: {
    horizontalDistance?: number;
    verticalDistance?: number;
    dx?: number;
    dy?: number;
    dz?: number;
    perimeter?: number;
    segments?: number[];
    dimensions?: { length: number; width: number; height: number };
  };
  points: Point3D[];
  confidence: TrackingConfidence;
  isArEstimated: boolean;
  notes?: string;
  timestamp: number;
  imageUrl?: string;
}

export interface FurnitureItem {
  id: string;
  roomId?: string;
  type: 'bed' | 'sofa' | 'dining_table' | 'chair' | 'wardrobe' | 'tv_unit' | 'refrigerator' | 'kitchen_counter' | 'toilet' | 'bathtub' | 'shower' | 'desk' | 'door' | 'window';
  name: string;
  x: number; // meters from room origin
  y: number; // meters from room origin
  width: number; // meters
  depth: number; // meters
  height: number; // meters
  rotation: number; // degrees
  color?: string;
}

export interface WallSegment {
  id: string;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  thickness: number; // e.g. 0.15m (15cm)
  height: number; // e.g. 2.7m
  doors?: { position: number; width: number; height: number }[];
  windows?: { position: number; width: number; height: number; sillHeight: number }[];
}

export interface RoomWindowConfig {
  id: string;
  wall: 'north' | 'south' | 'east' | 'west';
  offsetMeters: number; // offset along wall in meters
  width: number; // width in meters, e.g. 1.4m
  height: number; // height in meters, e.g. 1.2m
  sillHeight: number; // height from floor, e.g. 0.9m
}

export interface DaylightAnalysisResult {
  overallScore: number; // 0 - 100
  ratingLabel: string;
  dailySunlightHours: number;
  solarExposureProfile: {
    morning: string;
    midday: string;
    afternoon: string;
  };
  glareRisk: {
    level: 'Low' | 'Moderate' | 'High';
    details: string;
  };
  biophilicAndHealthBenefits: string;
  thermalAndEnergyImpact: string;
  placementRecommendations: string[];
  luxEstimate: {
    directSunLux: number;
    diffuseDaylightLux: number;
  };
}

export interface RoomRecord {
  id: string;
  projectId: string;
  name: string;
  type: 'living_room' | 'bedroom' | 'kitchen' | 'bathroom' | 'dining_room' | 'balcony' | 'corridor' | 'garage' | 'office' | 'other';
  length: number; // meters
  width: number; // meters
  height: number; // meters
  area: number; // m²
  perimeter: number; // meters
  corners: { x: number; y: number }[]; // 2D polygon in meters
  walls?: WallSegment[];
  windows?: RoomWindowConfig[];
  compassOrientation?: number; // 0 = North along room length (Z=0), 90 = East, 180 = South, 270 = West
  furniture: FurnitureItem[];
  color?: string;
  notes?: string;
}

export interface ProjectRecord {
  id: string;
  name: string;
  propertyType: 'apartment' | 'house' | 'villa' | 'office' | 'commercial';
  address?: string;
  clientName?: string;
  createdAt: number;
  updatedAt: number;
  rooms: RoomRecord[];
  notes?: string;
}

export interface AppSettings {
  unitSystem: UnitSystem;
  defaultLengthUnit: LengthUnit;
  defaultAreaUnit: AreaUnit;
  defaultVolumeUnit: VolumeUnit;
  enablePlaneVisualization: boolean;
  enableFeaturePoints: boolean;
  smoothingFilter: 'off' | 'low' | 'medium' | 'high';
  calibrationFactor: number; // Default 1.000 - scale correction applied to AR ranging
  deviceHeight: number; // metres from floor to the phone camera while measuring (default 1.40)
  enableHaptics: boolean;
  enableVoiceGuidance: boolean;
  theme: 'dark' | 'light';
  pdfPaperSize: 'a4' | 'a3' | 'letter';
  language: 'en' | 'hi';
  hasSeenTutorial: boolean;
}

export interface ARPlane {
  id: string;
  type: 'horizontal_floor' | 'horizontal_table' | 'vertical_wall' | 'ceiling';
  center: Point3D;
  normal: { x: number; y: number; z: number };
  width: number;
  height: number;
  confidence: number;
}
