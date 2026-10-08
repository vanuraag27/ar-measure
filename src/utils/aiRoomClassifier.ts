import { RoomRecord } from '../types';

export interface AIRoomClassificationResult {
  roomName: string;
  roomType: RoomRecord['type'];
  confidence: number;
  reasoning: string;
  suggestedFurniture?: string[];
}

export async function classifyRoomLayout(params: {
  length: number;
  width: number;
  height?: number;
  area: number;
  perimeter: number;
  corners?: { x: number; y: number }[];
  detectedFurniture?: string[];
}): Promise<AIRoomClassificationResult> {
  try {
    const res = await fetch('/api/classify-room', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(params),
    });

    if (!res.ok) {
      throw new Error(`Server returned ${res.status}`);
    }

    const data = await res.json();
    if (data && data.roomName && data.roomType) {
      return {
        roomName: data.roomName,
        roomType: data.roomType,
        confidence: typeof data.confidence === 'number' ? data.confidence : 0.85,
        reasoning: data.reasoning || 'Classified based on room dimensions and perimeter layout.',
        suggestedFurniture: data.suggestedFurniture || []
      };
    }
  } catch (err) {
    console.warn('AI room classification request failed, using local spatial heuristic:', err);
  }

  // Client-side fallback heuristic
  return fallbackClientClassification(params);
}

function fallbackClientClassification(params: {
  length: number;
  width: number;
  area: number;
  detectedFurniture?: string[];
}): AIRoomClassificationResult {
  const { length, width, area } = params;
  const furn = (params.detectedFurniture || []).map(f => f.toLowerCase());

  if (furn.some(f => f.includes('bed') || f.includes('wardrobe'))) {
    return {
      roomName: area > 16 ? 'Master Bedroom' : 'Bedroom',
      roomType: 'bedroom',
      confidence: 0.90,
      reasoning: 'Detected sleeping furniture and scale are characteristic of a residential bedroom.',
      suggestedFurniture: ['Bedside Table', 'Dresser', 'Reading Lamp']
    };
  }

  if (furn.some(f => f.includes('kitchen') || f.includes('refrigerator') || f.includes('counter'))) {
    return {
      roomName: 'Kitchen',
      roomType: 'kitchen',
      confidence: 0.92,
      reasoning: 'Cooking and prep elements confirm a kitchen environment.',
      suggestedFurniture: ['Bar Stools', 'Storage Cart']
    };
  }

  if (furn.some(f => f.includes('bath') || f.includes('toilet') || f.includes('shower'))) {
    return {
      roomName: 'Bathroom',
      roomType: 'bathroom',
      confidence: 0.93,
      reasoning: 'Plumbing fixtures indicate a bathroom space.',
      suggestedFurniture: ['Vanity Shelf', 'Towel Rack']
    };
  }

  if (area >= 22 || furn.some(f => f.includes('sofa') || f.includes('tv'))) {
    return {
      roomName: area > 28 ? 'Grand Living Room' : 'Living Room',
      roomType: 'living_room',
      confidence: 0.88,
      reasoning: 'Large open footprint with seating arrangements suggests a central gathering area.',
      suggestedFurniture: ['Sectional Sofa', 'Coffee Table', 'Entertainment Unit']
    };
  }

  if (length / Math.max(1, width) > 2.8) {
    return {
      roomName: 'Hallway / Corridor',
      roomType: 'corridor',
      confidence: 0.86,
      reasoning: 'Long narrow linear aspect ratio matches a passageway or hallway.',
      suggestedFurniture: ['Runner Rug', 'Slim Console']
    };
  }

  if (area < 8) {
    return {
      roomName: 'Balcony / Utility',
      roomType: 'balcony',
      confidence: 0.78,
      reasoning: 'Compact boundary typical of a balcony, pantry, or utility nook.',
      suggestedFurniture: ['Compact Seating', 'Planter Pots']
    };
  }

  return {
    roomName: 'Study / Bedroom',
    roomType: 'bedroom',
    confidence: 0.80,
    reasoning: 'Medium proportions suitable for private living or a study.',
    suggestedFurniture: ['Work Desk', 'Bookcase', 'Armchair']
  };
}
