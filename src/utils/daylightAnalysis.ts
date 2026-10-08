import { DaylightAnalysisResult, RoomRecord, RoomWindowConfig } from '../types';

export interface SolarPosition {
  azimuthDeg: number;    // 0 = North, 90 = East, 180 = South, 270 = West
  elevationDeg: number;  // 0 at horizon, 90 at zenith
  intensity: number;     // 0 to 1
  colorHex: number;      // Three.js hex color
  ambientIntensity: number;
}

/**
 * Calculates solar azimuth, elevation, intensity and color based on time of day (6 to 20 hrs),
 * season, and compass orientation.
 */
export function calculateSolarPosition(
  hour: number, // 6.0 to 20.0
  season: 'summer' | 'equinox' | 'winter' = 'equinox',
  compassNorthAngle: number = 0 // degrees
): SolarPosition {
  // Solar noon is at 12:00
  // Sunrise ~ 6:00, Sunset ~ 18:30 (adjusted by season)
  let maxElevation = 55; // equinox default
  if (season === 'summer') maxElevation = 75;
  if (season === 'winter') maxElevation = 35;

  // Hour angle relative to noon (12:00 = 0 deg, each hour = 15 deg)
  const hourAngle = (hour - 12) * 15; // -90 at 6am, +90 at 6pm

  // Solar elevation: peak at noon, 0 at horizon
  const elevationRad = Math.asin(Math.max(0, Math.cos((hourAngle * Math.PI) / 180) * Math.sin((maxElevation * Math.PI) / 180)));
  const elevationDeg = (elevationRad * 180) / Math.PI;

  // Solar Azimuth: East (90°) in morning -> South (180°) at noon -> West (270°) in afternoon
  let baseAzimuth = 180 + hourAngle * 0.95;
  if (hour < 6) baseAzimuth = 70;
  if (hour > 19) baseAzimuth = 290;

  // Adjust by compass North angle so orientation rotates relative to world
  const adjustedAzimuth = (baseAzimuth - compassNorthAngle + 360) % 360;

  // Determine light color & intensity based on solar elevation
  let intensity = 0;
  let colorHex = 0xffffff;
  let ambientIntensity = 0.35;

  if (elevationDeg <= 0) {
    // Night
    intensity = 0.05;
    colorHex = 0x223355;
    ambientIntensity = 0.15;
  } else if (elevationDeg < 12) {
    // Golden hour / sunrise / sunset
    intensity = 0.95;
    colorHex = 0xff9944; // Warm amber gold
    ambientIntensity = 0.28;
  } else if (elevationDeg < 30) {
    // Mid-morning / late afternoon
    intensity = 1.3;
    colorHex = 0xffe2b8; // Soft warm sunlight
    ambientIntensity = 0.45;
  } else {
    // High noon
    intensity = 1.6;
    colorHex = 0xfffcf0; // Bright crisp solar white
    ambientIntensity = 0.6;
  }

  return {
    azimuthDeg: adjustedAzimuth,
    elevationDeg,
    intensity,
    colorHex,
    ambientIntensity
  };
}

/**
 * Requests AI-based natural daylight analysis from backend
 */
export async function analyzeRoomDaylight(params: {
  roomName: string;
  roomType: string;
  length: number;
  width: number;
  height: number;
  area: number;
  compassOrientation: number;
  windows: RoomWindowConfig[];
  timeOfDay: string;
  season: 'summer' | 'equinox' | 'winter';
}): Promise<DaylightAnalysisResult> {
  try {
    const res = await fetch('/api/analyze-daylight', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return data;
  } catch (err) {
    console.warn('Backend daylight analysis unavailable, using client-side estimation:', err);
    return fallbackClientDaylightAnalysis(params);
  }
}

function fallbackClientDaylightAnalysis(params: {
  roomName: string;
  roomType: string;
  length: number;
  width: number;
  height: number;
  area: number;
  compassOrientation: number;
  windows: RoomWindowConfig[];
}): DaylightAnalysisResult {
  const { area, windows } = params;
  const totalGlazing = windows.reduce((s, w) => s + w.width * w.height, 0);
  const wfr = area > 0 ? (totalGlazing / area) * 100 : 15;

  const hasSouth = windows.some(w => w.wall === 'south');
  const hasEast = windows.some(w => w.wall === 'east');
  const hasWest = windows.some(w => w.wall === 'west');
  const hasNorth = windows.some(w => w.wall === 'north');

  let score = 55;
  let dailyHours = 3.0;
  let ratingLabel = 'Moderate Natural Light';
  let glareLevel: 'Low' | 'Moderate' | 'High' = 'Low';
  let glareDetails = 'Diffused light through perimeter glazing.';

  if (windows.length === 0) {
    score = 15;
    dailyHours = 0;
    ratingLabel = 'Windowless Interior Space';
    glareDetails = 'No exterior window openings.';
  } else if (hasSouth) {
    score = 88;
    dailyHours = 6.0;
    ratingLabel = 'Abundant South Sunlight';
    glareLevel = 'Moderate';
    glareDetails = 'Direct solar penetration through midday hours.';
  } else if (hasEast) {
    score = 80;
    dailyHours = 4.5;
    ratingLabel = 'Invigorating Morning Light';
    glareLevel = 'Low';
    glareDetails = 'Optimal morning sun angles without intense afternoon heat gain.';
  } else if (hasWest) {
    score = 75;
    dailyHours = 4.5;
    ratingLabel = 'Warm Afternoon Exposure';
    glareLevel = 'High';
    glareDetails = 'Low-angle afternoon sun requires anti-glare window blinds.';
  } else if (hasNorth) {
    score = 68;
    dailyHours = 1.5;
    ratingLabel = 'Uniform Indirect Daylight';
    glareLevel = 'Low';
    glareDetails = 'Even, glare-free indirect daylight.';
  }

  return {
    overallScore: Math.round(score),
    ratingLabel,
    dailySunlightHours: dailyHours,
    solarExposureProfile: {
      morning: hasEast || hasSouth ? 'Direct morning sunlight filling eastern floor area.' : 'Soft indirect daylight.',
      midday: hasSouth ? 'Overhead direct sun beams penetrating deep into room.' : 'Gentle ambient illumination.',
      afternoon: hasWest ? 'Rich golden sunlight creating long shadows on East wall.' : 'Gradual dusk transition.'
    },
    glareRisk: {
      level: glareLevel,
      details: glareDetails
    },
    biophilicAndHealthBenefits: 'Provides daily circadian lighting support, fostering mental focus and natural melatonin regulation.',
    thermalAndEnergyImpact: `Estimated ${Math.round(score * 0.35)}% reduction in daytime electrical lighting usage.`,
    placementRecommendations: [
      hasWest ? 'Avoid positioning computer monitors facing west windows to mitigate direct reflections.' : 'Place reading desks within 2m of windows for natural 500+ lux illumination.',
      hasSouth ? 'Install adjustable louvers or sheer shades for solar control during peak sun angles.' : 'Maintain unobstructed window sightlines to maximize outdoor daylight bounce.'
    ],
    luxEstimate: {
      directSunLux: windows.length > 0 ? 32000 : 0,
      diffuseDaylightLux: windows.length > 0 ? Math.round(350 + wfr * 20) : 50
    }
  };
}
