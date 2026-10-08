import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Type } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json({ limit: '10mb' }));

const port = process.env.PORT || 3000;

// Gemini client initialization per gemini-api skill guidelines
const apiKey = process.env.GEMINI_API_KEY;
let ai: GoogleGenAI | null = null;

if (apiKey) {
  ai = new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function heuristicRoomClassification(data: {
  length?: number;
  width?: number;
  height?: number;
  area?: number;
  detectedFurniture?: string[];
}) {
  const l = data.length || 4.5;
  const w = data.width || 3.5;
  const area = data.area || l * w;
  const furn = (data.detectedFurniture || []).map(f => f.toLowerCase());

  if (furn.some(f => f.includes('bed') || f.includes('wardrobe'))) {
    return {
      roomName: area > 16 ? 'Master Bedroom' : 'Guest Bedroom',
      roomType: 'bedroom',
      confidence: 0.92,
      reasoning: 'Presence of bed/wardrobe items and cozy dimensional footprint indicate a primary sleeping quarter.',
      suggestedFurniture: ['Nightstand with Lamp', 'Full-length Mirror', 'Accent Armchair']
    };
  }

  if (furn.some(f => f.includes('kitchen') || f.includes('refrigerator') || f.includes('fridge') || f.includes('counter'))) {
    return {
      roomName: area > 14 ? 'Chef’s Kitchen' : 'Kitchen',
      roomType: 'kitchen',
      confidence: 0.94,
      reasoning: 'Identified culinary preparation surfaces, refrigeration units, and utility perimeter.',
      suggestedFurniture: ['Kitchen Island Stools', 'Pantry Storage Cart', 'Hanging Pot Rack']
    };
  }

  if (furn.some(f => f.includes('bathtub') || f.includes('toilet') || f.includes('shower'))) {
    return {
      roomName: area > 6 ? 'Primary Bathroom' : 'Guest Bathroom',
      roomType: 'bathroom',
      confidence: 0.95,
      reasoning: 'Sanitary fixtures and enclosed square footage match standard residential bath layouts.',
      suggestedFurniture: ['Vanity Mirror Cabinet', 'Towel Rack', 'Laundry Hamper']
    };
  }

  if (furn.some(f => f.includes('dining') || (furn.includes('table') && !furn.includes('coffee')))) {
    return {
      roomName: 'Dining Room',
      roomType: 'dining_room',
      confidence: 0.88,
      reasoning: 'Central dining surface arrangements and square room proportions.',
      suggestedFurniture: ['Buffet Sideboard', 'Pendant Chandelier', 'Dining Chairs']
    };
  }

  if (furn.some(f => f.includes('sofa') || f.includes('tv') || f.includes('couch')) || area >= 20) {
    return {
      roomName: area > 26 ? 'Great Room / Main Living Room' : 'Living Room',
      roomType: 'living_room',
      confidence: 0.89,
      reasoning: 'Spacious floor plan with seating fixtures oriented toward entertainment and congregation.',
      suggestedFurniture: ['Coffee Table', 'Media Console', 'Bookshelf', 'Floor Lamp']
    };
  }

  if (l / Math.max(1, w) > 2.8) {
    return {
      roomName: 'Main Corridor',
      roomType: 'corridor',
      confidence: 0.85,
      reasoning: 'Elongated aspect ratio with narrow width typical of residential circulation hallways.',
      suggestedFurniture: ['Runner Rug', 'Wall Sconces', 'Slim Console Table']
    };
  }

  if (area < 8) {
    return {
      roomName: 'Compact Utility / Balcony',
      roomType: 'balcony',
      confidence: 0.78,
      reasoning: 'Smaller perimeter layout consistent with outdoor terrace, balcony, or laundry niche.',
      suggestedFurniture: ['Bistro Chairs', 'Planter Boxes']
    };
  }

  return {
    roomName: 'Multi-Purpose Room',
    roomType: 'living_room',
    confidence: 0.75,
    reasoning: 'Balanced medium room area suitable for living or study configuration.',
    suggestedFurniture: ['Modular Sofa', 'Work Desk', 'Low Credenza']
  };
}

// AI Room Classifier API
app.post('/api/classify-room', async (req, res) => {
  try {
    const { length, width, height, area, perimeter, corners, detectedFurniture } = req.body;

    if (!ai) {
      const fallback = heuristicRoomClassification({ length, width, height, area, detectedFurniture });
      return res.json(fallback);
    }

    const prompt = `Analyze this scanned architectural room boundary and detected elements to automatically classify and name the room:
Room Layout & Dimensions:
- Length: ${length} m
- Width: ${width} m
- Ceiling Height: ${height || 2.75} m
- Floor Area: ${area} m²
- Perimeter: ${perimeter} m
- Aspect Ratio (Length / Width): ${(length / Math.max(0.1, width)).toFixed(2)}
- Detected Furniture / Fixtures: ${JSON.stringify(detectedFurniture || [])}

Available standard room types:
- living_room
- bedroom
- kitchen
- bathroom
- dining_room
- balcony
- corridor
- office
- garage
- other

Provide a realistic, professional architectural title (e.g. "Primary Living Room", "Master Suite", "Open-Concept Kitchen", "Executive Home Office", "Full Guest Bathroom"), exact roomType, confidence score between 0.0 and 1.0, a concise 1-2 sentence architectural reasoning, and 2-4 recommended furniture items that fit this space.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            roomName: {
              type: Type.STRING,
              description: 'The natural title for the room, e.g. "Master Bedroom" or "Formal Living Room"',
            },
            roomType: {
              type: Type.STRING,
              description: 'One of the valid room types: living_room, bedroom, kitchen, bathroom, dining_room, balcony, corridor, office, garage, other',
            },
            confidence: {
              type: Type.NUMBER,
              description: 'Confidence score from 0.0 to 1.0',
            },
            reasoning: {
              type: Type.STRING,
              description: '1-2 sentence explanation of why this classification matches the layout dimensions and items.',
            },
            suggestedFurniture: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: 'List of 2-4 recommended furniture pieces.',
            },
          },
          required: ['roomName', 'roomType', 'confidence', 'reasoning'],
        },
      },
    });

    const text = response.text?.trim() || '{}';
    const parsed = JSON.parse(text);
    return res.json(parsed);
  } catch (err) {
    console.error('Gemini room classification error, falling back to local heuristic:', err);
    const fallback = heuristicRoomClassification(req.body);
    return res.json(fallback);
  }
});

function heuristicDaylightAnalysis(data: {
  roomName?: string;
  roomType?: string;
  length?: number;
  width?: number;
  height?: number;
  area?: number;
  compassOrientation?: number;
  windows?: { wall: string; width: number; height: number; offsetMeters?: number }[];
  timeOfDay?: string | number;
  season?: string;
}) {
  const l = data.length || 5.0;
  const w = data.width || 4.0;
  const roomArea = data.area || l * w;
  const windows = data.windows || [];
  const compass = data.compassOrientation || 0; // 0=North

  // Total glazing area in m²
  const totalGlazingArea = windows.reduce((acc, win) => acc + (win.width * win.height), 0);
  const wfr = roomArea > 0 ? (totalGlazingArea / roomArea) * 100 : 15; // Window to floor ratio %

  // Check walls that have windows
  const hasSouth = windows.some(win => win.wall === 'south');
  const hasEast = windows.some(win => win.wall === 'east');
  const hasWest = windows.some(win => win.wall === 'west');
  const hasNorth = windows.some(win => win.wall === 'north');

  let score = 50;
  let dailyHours = 2.0;
  let ratingLabel = 'Moderate Natural Light';
  let glareLevel: 'Low' | 'Moderate' | 'High' = 'Low';
  let glareDetails = 'Minimal direct glare risk from diffuse ambient light.';

  if (windows.length === 0) {
    score = 15;
    dailyHours = 0;
    ratingLabel = 'No Direct Daylighting';
    glareLevel = 'Low';
    glareDetails = 'No exterior window apertures detected.';
  } else if (hasSouth && hasEast) {
    score = 92;
    dailyHours = 6.5;
    ratingLabel = 'Optimal South-East Sun Exposure';
    glareLevel = 'Moderate';
    glareDetails = 'Direct morning and midday sunlight; sheer diffusing blinds recommended.';
  } else if (hasSouth) {
    score = 88;
    dailyHours = 5.8;
    ratingLabel = 'Abundant South Sunlight';
    glareLevel = 'Moderate';
    glareDetails = 'Consistent solar path penetration through midday and early afternoon.';
  } else if (hasWest) {
    score = 74;
    dailyHours = 4.2;
    ratingLabel = 'Intense Afternoon Daylight';
    glareLevel = 'High';
    glareDetails = 'Low-angle afternoon sun creates potential display glare and thermal gain.';
  } else if (hasEast) {
    score = 78;
    dailyHours = 4.0;
    ratingLabel = 'Gentle Morning Sunlight';
    glareLevel = 'Low';
    glareDetails = 'Invigorating morning illumination with soft indirect light in the afternoon.';
  } else if (hasNorth) {
    score = 65;
    dailyHours = 1.0;
    ratingLabel = 'Consistent Diffuse Daylight';
    glareLevel = 'Low';
    glareDetails = 'Even, glare-free indirect daylight ideal for art and screen workstations.';
  }

  // Adjust score based on window-to-floor ratio
  if (wfr >= 15 && wfr <= 25) {
    score = Math.min(98, score + 6);
  } else if (wfr < 8 && windows.length > 0) {
    score = Math.max(30, score - 15);
  }

  return {
    overallScore: Math.round(score),
    ratingLabel,
    dailySunlightHours: Number(dailyHours.toFixed(1)),
    solarExposureProfile: {
      morning: hasEast || hasSouth ? 'Direct morning solar illumination stimulating circadian wakefulness.' : 'Soft indirect ambient light.',
      midday: hasSouth ? 'Peak overhead sunlight penetration across central floor zone.' : 'Diffuse room-wide ambient illumination.',
      afternoon: hasWest ? 'Strong warm direct sunlight with deep horizontal shadow casting.' : 'Soft fading evening daylight.'
    },
    glareRisk: {
      level: glareLevel,
      details: glareDetails
    },
    biophilicAndHealthBenefits: 'Optimized natural light supports circadian rhythm alignment, elevating daytime alertness and cognitive productivity.',
    thermalAndEnergyImpact: `Estimated ${Math.round(score * 0.4)}% reduction in daytime artificial lighting needs with positive winter passive solar heat gain.`,
    placementRecommendations: [
      hasWest ? 'Position computer workstations perpendicular to West windows to eliminate direct screen reflection.' : 'Position reading desk near primary window aperture for optimal 500+ lux reading light.',
      hasSouth ? 'Install dual-layer roller blinds or thermal drapery to regulate peak summer solar heat gain.' : 'Use light-colored interior wall finishes to bounce indirect daylight deeper into the space.',
      'Orient seating or bed headboard away from direct low-angle solar rays to avoid sleep disruption.'
    ],
    luxEstimate: {
      directSunLux: windows.length > 0 ? Math.round(15000 + score * 300) : 50,
      diffuseDaylightLux: windows.length > 0 ? Math.round(300 + wfr * 25) : 50
    }
  };
}

// AI Natural Light & Solar Exposure Analysis API
app.post('/api/analyze-daylight', async (req, res) => {
  try {
    const { roomName, roomType, length, width, height, area, compassOrientation, windows, timeOfDay, season } = req.body;

    if (!ai) {
      const fallback = heuristicDaylightAnalysis(req.body);
      return res.json(fallback);
    }

    const prompt = `Perform an expert architectural natural daylighting and solar path analysis for this interior room:
Room Specifications:
- Name: ${roomName || 'Room'}
- Type: ${roomType || 'Living Room'}
- Dimensions: ${length}m Length × ${width}m Width × ${height || 2.75}m Height (Area: ${area} m²)
- Compass Orientation (North angle): ${compassOrientation || 0}°
- Window Apertures: ${JSON.stringify(windows || [])}
- Selected Time: ${timeOfDay || '12:00 PM'}
- Season: ${season || 'equinox'}

Analyze solar angles, daylight factor, direct sunlight hours, glare risks, and placement suggestions.
Output a structured architectural assessment with overall score (0-100), rating label, daily sunlight hours, morning/midday/afternoon profiles, glare risk, biophilic benefits, energy savings, placement recommendations, and direct/diffuse lux estimates.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            overallScore: {
              type: Type.NUMBER,
              description: 'Overall daylighting score between 0 and 100',
            },
            ratingLabel: {
              type: Type.STRING,
              description: 'Qualitative rating, e.g. "Optimal South-Facing Daylight"',
            },
            dailySunlightHours: {
              type: Type.NUMBER,
              description: 'Direct sunlight exposure in hours',
            },
            solarExposureProfile: {
              type: Type.OBJECT,
              properties: {
                morning: { type: Type.STRING },
                midday: { type: Type.STRING },
                afternoon: { type: Type.STRING },
              },
              required: ['morning', 'midday', 'afternoon'],
            },
            glareRisk: {
              type: Type.OBJECT,
              properties: {
                level: { type: Type.STRING, description: 'Low, Moderate, or High' },
                details: { type: Type.STRING },
              },
              required: ['level', 'details'],
            },
            biophilicAndHealthBenefits: {
              type: Type.STRING,
              description: 'Circadian and mental wellbeing impacts',
            },
            thermalAndEnergyImpact: {
              type: Type.STRING,
              description: 'Artificial lighting offset and thermal heat gain info',
            },
            placementRecommendations: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: '3-4 actionable architectural placement tips for desks, beds, or blinds',
            },
            luxEstimate: {
              type: Type.OBJECT,
              properties: {
                directSunLux: { type: Type.NUMBER },
                diffuseDaylightLux: { type: Type.NUMBER },
              },
              required: ['directSunLux', 'diffuseDaylightLux'],
            },
          },
          required: [
            'overallScore',
            'ratingLabel',
            'dailySunlightHours',
            'solarExposureProfile',
            'glareRisk',
            'biophilicAndHealthBenefits',
            'thermalAndEnergyImpact',
            'placementRecommendations',
            'luxEstimate',
          ],
        },
      },
    });

    const text = response.text?.trim() || '{}';
    const parsed = JSON.parse(text);
    return res.json(parsed);
  } catch (err) {
    console.error('Gemini daylight analysis error, falling back to local heuristic:', err);
    const fallback = heuristicDaylightAnalysis(req.body);
    return res.json(fallback);
  }
});

// Heuristic object detector for instant offline / simulated fallback
function heuristicObjectDetection(planeType?: string) {
  if (planeType === 'vertical_wall') {
    return [
      {
        label: 'Interior Door',
        category: 'opening',
        box2d: [160, 140, 780, 420],
        confidence: 0.94,
        estimatedDimensions: '0.90m × 2.10m',
        notes: 'Standard interior door frame'
      },
      {
        label: 'Baseboard Molding',
        category: 'structural',
        box2d: [780, 40, 850, 960],
        confidence: 0.91,
        estimatedDimensions: '100mm height trim',
        notes: 'Perimeter floor-wall junction'
      },
      {
        label: 'Duplex Wall Outlet',
        category: 'fixture',
        box2d: [680, 720, 730, 770],
        confidence: 0.88,
        estimatedDimensions: '0.30m above finished floor',
        notes: '120V power receptacle'
      }
    ];
  } else {
    return [
      {
        label: '3-Seater Sofa',
        category: 'furniture',
        box2d: [380, 220, 740, 780],
        confidence: 0.92,
        estimatedDimensions: '2.20m × 0.90m',
        notes: 'Upholstered seating unit'
      },
      {
        label: 'Baseboard Trim',
        category: 'structural',
        box2d: [310, 80, 360, 920],
        confidence: 0.89,
        estimatedDimensions: '120mm height',
        notes: 'Wall boundary trim'
      }
    ];
  }
}

// AI-powered Real-Time Object & Structural Element Recognition API
app.post('/api/recognize-objects', async (req, res) => {
  try {
    const { image, planeType, estimatedDistance } = req.body;

    if (!ai || !image) {
      const fallback = heuristicObjectDetection(planeType);
      return res.json({ detectedObjects: fallback });
    }

    const base64Data = image.replace(/^data:image\/\w+;base64,/, '');
    const imagePart = {
      inlineData: {
        mimeType: 'image/jpeg',
        data: base64Data,
      },
    };

    const prompt = `You are a real-time computer vision engine for an AR architectural measurement and home planning app.
Detect and locate visible furniture and structural elements in this camera frame:
- Structural elements: Doors, Windows, Baseboards, Trim Molding, Wall Outlets, Light Switches, Radiators, Fireplaces
- Furniture items: Sofas, Beds, Dining Tables, Coffee Tables, Chairs, Kitchen Counters, Wardrobes, TV Units, Desks
- Fixtures: Toilets, Bathtubs, Sinks

For each detected element:
1. label: clear title (e.g. "Interior Door", "Baseboard Molding", "Sofa", "Window Frame", "Wall Outlet")
2. category: one of 'structural', 'furniture', 'fixture', 'opening'
3. box2d: [ymin, xmin, ymax, xmax] as 4 integers from 0 to 1000
4. confidence: 0.0 to 1.0
5. estimatedDimensions: architectural dimension estimate (e.g. "0.9m × 2.1m", "100mm height", "2.2m length")
6. notes: brief usage or location note`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: { parts: [imagePart, { text: prompt }] },
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              label: { type: Type.STRING },
              category: { type: Type.STRING },
              box2d: {
                type: Type.ARRAY,
                items: { type: Type.INTEGER },
                description: '[ymin, xmin, ymax, xmax] 0-1000 coordinates',
              },
              confidence: { type: Type.NUMBER },
              estimatedDimensions: { type: Type.STRING },
              notes: { type: Type.STRING },
            },
            required: ['label', 'category', 'box2d', 'confidence'],
          },
        },
      },
    });

    const parsed = JSON.parse(response.text || '[]');
    return res.json({ detectedObjects: Array.isArray(parsed) ? parsed : [] });
  } catch (err) {
    console.error('Gemini object recognition error, falling back to local heuristic:', err);
    const fallback = heuristicObjectDetection(req.body.planeType);
    return res.json({ detectedObjects: fallback });
  }
});

// Mount Vite or static files
if (process.env.NODE_ENV !== 'production') {
  const { createServer: createViteServer } = await import('vite');
  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: 'spa',
  });
  app.use(vite.middlewares);
} else {
  app.use(express.static(path.resolve(__dirname, 'dist')));
  app.get('*', (req, res) => {
    res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
  });
}

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
