import { LengthUnit, AreaUnit, VolumeUnit, UnitSystem, AppSettings } from '../types';

// Base SI units: length in meters, area in m², volume in m³

export const LENGTH_CONVERSIONS: Record<LengthUnit, { factor: number; symbol: string; label: string; decimals: number }> = {
  mm: { factor: 1000, symbol: 'mm', label: 'Millimeters', decimals: 0 },
  cm: { factor: 100, symbol: 'cm', label: 'Centimeters', decimals: 1 },
  m: { factor: 1, symbol: 'm', label: 'Meters', decimals: 3 },
  in: { factor: 39.3700787, symbol: 'in', label: 'Inches', decimals: 2 },
  ft: { factor: 3.2808399, symbol: 'ft', label: 'Feet', decimals: 2 },
  yd: { factor: 1.0936133, symbol: 'yd', label: 'Yards', decimals: 2 },
};

export const AREA_CONVERSIONS: Record<AreaUnit, { factor: number; symbol: string; label: string; decimals: number }> = {
  'mm²': { factor: 1000000, symbol: 'mm²', label: 'Square Millimeters', decimals: 0 },
  'cm²': { factor: 10000, symbol: 'cm²', label: 'Square Centimeters', decimals: 1 },
  'm²': { factor: 1, symbol: 'm²', label: 'Square Meters', decimals: 2 },
  'in²': { factor: 1550.0031, symbol: 'in²', label: 'Square Inches', decimals: 2 },
  'ft²': { factor: 10.7639104, symbol: 'ft²', label: 'Square Feet', decimals: 2 },
  'yd²': { factor: 1.19599, symbol: 'yd²', label: 'Square Yards', decimals: 2 },
};

export const VOLUME_CONVERSIONS: Record<VolumeUnit, { factor: number; symbol: string; label: string; decimals: number }> = {
  'mm³': { factor: 1000000000, symbol: 'mm³', label: 'Cubic Millimeters', decimals: 0 },
  'cm³': { factor: 1000000, symbol: 'cm³', label: 'Cubic Centimeters', decimals: 1 },
  'm³': { factor: 1, symbol: 'm³', label: 'Cubic Meters', decimals: 3 },
  'in³': { factor: 61023.744, symbol: 'in³', label: 'Cubic Inches', decimals: 2 },
  'ft³': { factor: 35.3146667, symbol: 'ft³', label: 'Cubic Feet', decimals: 2 },
  'yd³': { factor: 1.3079506, symbol: 'yd³', label: 'Cubic Yards', decimals: 2 },
};

export function convertLength(meters: number, targetUnit: LengthUnit, calibrationFactor: number = 1.0): number {
  const calibratedMeters = meters * calibrationFactor;
  return calibratedMeters * LENGTH_CONVERSIONS[targetUnit].factor;
}

export function formatLength(meters: number, targetUnit: LengthUnit, calibrationFactor: number = 1.0): string {
  const val = convertLength(meters, targetUnit, calibrationFactor);
  const info = LENGTH_CONVERSIONS[targetUnit];
  return `${val.toFixed(info.decimals)} ${info.symbol}`;
}

/**
 * Format meters into architectural feet and inches (e.g. 14' 6" or 14' 6 1/2")
 */
export function formatFeetAndInches(meters: number, calibrationFactor: number = 1.0): string {
  const totalInches = convertLength(meters, 'in', calibrationFactor);
  const feet = Math.floor(totalInches / 12);
  const inches = totalInches % 12;
  const roundedInches = Math.round(inches * 2) / 2; // to nearest 1/2 inch
  const frac = roundedInches % 1 === 0.5 ? '½' : '';
  const wholeInches = Math.floor(roundedInches);
  
  if (feet === 0) {
    return `${wholeInches}${frac}"`;
  }
  return `${feet}' ${wholeInches}${frac}"`;
}

export function getAllLengthRepresentations(meters: number, calibrationFactor: number = 1.0): Record<LengthUnit, string> {
  const units: LengthUnit[] = ['m', 'cm', 'mm', 'ft', 'in', 'yd'];
  const res: Partial<Record<LengthUnit, string>> = {};
  for (const u of units) {
    res[u] = formatLength(meters, u, calibrationFactor);
  }
  return res as Record<LengthUnit, string>;
}

export function convertArea(sqMeters: number, targetUnit: AreaUnit): number {
  return sqMeters * AREA_CONVERSIONS[targetUnit].factor;
}

export function formatArea(sqMeters: number, targetUnit: AreaUnit): string {
  const val = convertArea(sqMeters, targetUnit);
  const info = AREA_CONVERSIONS[targetUnit];
  return `${val.toFixed(info.decimals)} ${info.symbol}`;
}

export function convertVolume(cuMeters: number, targetUnit: VolumeUnit): number {
  return cuMeters * VOLUME_CONVERSIONS[targetUnit].factor;
}

export function formatVolume(cuMeters: number, targetUnit: VolumeUnit): string {
  const val = convertVolume(cuMeters, targetUnit);
  const info = VOLUME_CONVERSIONS[targetUnit];
  return `${val.toFixed(info.decimals)} ${info.symbol}`;
}

export function formatAngle(degrees: number): string {
  return `${degrees.toFixed(1)}°`;
}

/**
 * Convert and format liquid volume (e.g. paint) according to Metric (Liters) vs Imperial (US Gallons)
 */
export function formatLiquidVolume(liters: number, system: UnitSystem): { value: number; unit: string; formatted: string } {
  if (system === 'imperial') {
    const gallons = liters * 0.264172;
    return {
      value: Number(gallons.toFixed(2)),
      unit: 'gal',
      formatted: `${gallons.toFixed(1)} gal`,
    };
  }
  return {
    value: Number(liters.toFixed(1)),
    unit: 'L',
    formatted: `${liters.toFixed(1)} L`,
  };
}

/**
 * Automatically update all default units when switching between Metric and Imperial
 */
export function getUpdatedSettingsForUnitSystem(
  current: AppSettings, 
  newSystem: UnitSystem,
  preferredLengthUnit?: LengthUnit
): AppSettings {
  if (newSystem === 'imperial') {
    const lengthUnit: LengthUnit = preferredLengthUnit && ['ft', 'in', 'yd'].includes(preferredLengthUnit)
      ? preferredLengthUnit
      : 'ft';
    return {
      ...current,
      unitSystem: 'imperial',
      defaultLengthUnit: lengthUnit,
      defaultAreaUnit: 'ft²',
      defaultVolumeUnit: 'ft³',
    };
  } else {
    const lengthUnit: LengthUnit = preferredLengthUnit && ['m', 'cm', 'mm'].includes(preferredLengthUnit)
      ? preferredLengthUnit
      : 'm';
    return {
      ...current,
      unitSystem: 'metric',
      defaultLengthUnit: lengthUnit,
      defaultAreaUnit: 'm²',
      defaultVolumeUnit: 'm³',
    };
  }
}
