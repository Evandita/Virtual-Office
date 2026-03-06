/**
 * Map Configuration — single source of truth for the office layout.
 * Edit this file to customize rooms, furniture, decorations, and colors.
 *
 * Coordinate system: tile-based (0,0 top-left). TILE_SIZE pixels per tile.
 * Walls are auto-generated from room bounds. Doors are openings in those walls.
 */

// ── Color palette ──────────────────────────────────────────────────────────
// Keep colors muted/dark to avoid over-saturation.
export const PALETTE = {
  floor:      { base: 0x22223a, alt: 0x202036 },
  background: 0x0c0c18,
  wallOuter:  { face: 0x2e2e48, top: 0x3a3a58, edge: 0x4a4a68 },
  door:       { fill: 0x3a3a58, glow: 0x5a6a8a },
  rug:        { workspace: 0x28264a, lounge: 0x1e3028 },
};

// ── Room visual configs ────────────────────────────────────────────────────
export interface RoomVisual {
  id: string;
  name: string;
  type: 'open' | 'meeting' | 'lounge' | 'private';
  // Interior bounds (floor area, inside walls)
  bounds: { x: number; y: number; w: number; h: number };
  // Wall rect (outer edge including walls). Doors cut through this.
  walls: { x: number; y: number; w: number; h: number };
  doors: { x: number; y: number }[];  // tile positions of door openings
  soundIsolated: boolean;
  // Colors — deliberately muted
  floor: { base: number; alt: number };
  wall:  { face: number; top: number; edge: number };
  label: string;
  subLabel?: string;
}

export const ROOM_VISUALS: RoomVisual[] = [
  {
    id: 'meeting-a', name: 'Meeting Room A', type: 'meeting',
    bounds: { x: 3, y: 3, w: 7, h: 5 },
    walls:  { x: 2, y: 2, w: 8, h: 6 },
    doors:  [{ x: 10, y: 5 }, { x: 10, y: 6 }],
    soundIsolated: true,
    floor: { base: 0x1e2840, alt: 0x212c46 },
    wall:  { face: 0x2e4570, top: 0x3a5888, edge: 0x4a6898 },
    label: 'Meeting Room A', subLabel: 'Sound isolated',
  },
  {
    id: 'meeting-b', name: 'Meeting Room B', type: 'meeting',
    bounds: { x: 3, y: 11, w: 7, h: 5 },
    walls:  { x: 2, y: 10, w: 8, h: 6 },
    doors:  [{ x: 10, y: 13 }, { x: 10, y: 14 }],
    soundIsolated: true,
    floor: { base: 0x1e2840, alt: 0x212c46 },
    wall:  { face: 0x2e4570, top: 0x3a5888, edge: 0x4a6898 },
    label: 'Meeting Room B', subLabel: 'Sound isolated',
  },
  {
    id: 'lounge', name: 'Lounge', type: 'lounge',
    bounds: { x: 39, y: 3, w: 9, h: 7 },
    walls:  { x: 38, y: 2, w: 10, h: 8 },
    doors:  [{ x: 38, y: 6 }, { x: 38, y: 7 }],
    soundIsolated: false,
    floor: { base: 0x1e2a22, alt: 0x212e26 },
    wall:  { face: 0x2e5038, top: 0x3a6848, edge: 0x4a7858 },
    label: 'Lounge', subLabel: 'Relax & chat',
  },
  {
    id: 'focus-1', name: 'Focus Room 1', type: 'private',
    bounds: { x: 39, y: 13, w: 4, h: 3 },
    walls:  { x: 38, y: 12, w: 5, h: 4 },
    doors:  [{ x: 38, y: 14 }],
    soundIsolated: true,
    floor: { base: 0x28202a, alt: 0x2c242e },
    wall:  { face: 0x503848, top: 0x684858, edge: 0x785868 },
    label: 'Focus 1',
  },
  {
    id: 'focus-2', name: 'Focus Room 2', type: 'private',
    bounds: { x: 45, y: 13, w: 3, h: 3 },
    walls:  { x: 44, y: 12, w: 4, h: 4 },
    doors:  [{ x: 44, y: 14 }],
    soundIsolated: true,
    floor: { base: 0x28202a, alt: 0x2c242e },
    wall:  { face: 0x503848, top: 0x684858, edge: 0x785868 },
    label: 'Focus 2',
  },
];

// ── Furniture definitions ──────────────────────────────────────────────────
export type FurnitureType = 'desk-group' | 'meeting-table' | 'couch' | 'coffee-table' | 'focus-desk'
  | 'single-desk' | 'chair' | 'filing-cabinet' | 'standing-desk';

export interface FurnitureItem {
  type: FurnitureType;
  x: number;  // tile x
  y: number;  // tile y
  w?: number; // tile width (for tables)
  h?: number; // tile height
}

// Workspace desk groups: 4 columns x 3 rows
export const DESK_GRID = { startX: 15, startY: 22, cols: 4, rows: 3, colSpacing: 5, rowSpacing: 4, deskWidth: 3 };

export const FURNITURE: FurnitureItem[] = [
  // Meeting room tables (centered in rooms)
  { type: 'meeting-table', x: 5, y: 4.5, w: 3, h: 2 },
  { type: 'meeting-table', x: 5, y: 12.5, w: 3, h: 2 },
  // Lounge
  { type: 'couch', x: 40, y: 4.5, w: 4, h: 1 },
  { type: 'couch', x: 40, y: 7.5, w: 4, h: 1 },
  { type: 'coffee-table', x: 41, y: 5.8, w: 2, h: 1 },
  // Focus room desks
  { type: 'focus-desk', x: 40, y: 14, w: 2, h: 1 },
  { type: 'focus-desk', x: 46, y: 14, w: 2, h: 1 },
];

// ── Decoration definitions ─────────────────────────────────────────────────
export type DecorationType =
  | 'plant' | 'whiteboard' | 'tv-screen' | 'water-cooler' | 'bookshelf'
  | 'bulletin-board' | 'lamp' | 'clock' | 'printer' | 'trash-bin' | 'rug-round' | 'wall-art'
  | 'vending-machine' | 'speaker' | 'fire-extinguisher' | 'coat-rack' | 'umbrella-stand'
  | 'server-rack' | 'monitor-wall' | 'bean-bag';

export interface DecorationItem {
  type: DecorationType;
  x: number;  // tile x
  y: number;  // tile y
  w?: number;
}

export const DECORATIONS: DecorationItem[] = [
  // ── Plants — generously placed throughout ──
  { type: 'plant', x: 11, y: 3 },
  { type: 'plant', x: 11, y: 8 },
  { type: 'plant', x: 11, y: 11 },
  { type: 'plant', x: 11, y: 16 },
  { type: 'plant', x: 37, y: 3 },
  { type: 'plant', x: 37, y: 10 },
  { type: 'plant', x: 37, y: 16 },
  { type: 'plant', x: 13, y: 19 },
  { type: 'plant', x: 20, y: 19 },
  { type: 'plant', x: 27, y: 19 },
  { type: 'plant', x: 34, y: 19 },
  { type: 'plant', x: 46, y: 4 },
  { type: 'plant', x: 46, y: 8 },
  { type: 'plant', x: 39, y: 9 },
  { type: 'plant', x: 42, y: 13 },
  { type: 'plant', x: 47, y: 13 },
  { type: 'plant', x: 15, y: 2 },
  { type: 'plant', x: 25, y: 2 },
  { type: 'plant', x: 35, y: 2 },
  { type: 'plant', x: 15, y: 33 },
  { type: 'plant', x: 25, y: 33 },
  { type: 'plant', x: 35, y: 33 },

  // ── Whiteboards — inside meeting rooms ──
  { type: 'whiteboard', x: 4.5, y: 3, w: 3 },
  { type: 'whiteboard', x: 4.5, y: 11, w: 3 },

  // ── TV screens ──
  { type: 'tv-screen', x: 42, y: 3, w: 3 },

  // ── Water coolers ──
  { type: 'water-cooler', x: 13, y: 9 },
  { type: 'water-cooler', x: 36, y: 17 },

  // ── Bookshelves ──
  { type: 'bookshelf', x: 14, y: 18, w: 4 },
  { type: 'bookshelf', x: 30, y: 18, w: 3 },

  // ── Bulletin boards ──
  { type: 'bulletin-board', x: 24, y: 18, w: 2 },
  { type: 'bulletin-board', x: 12, y: 2, w: 2 },

  // ── Floor lamps ──
  { type: 'lamp', x: 12, y: 5 },
  { type: 'lamp', x: 12, y: 13 },
  { type: 'lamp', x: 36, y: 5 },
  { type: 'lamp', x: 36, y: 13 },
  { type: 'lamp', x: 14, y: 34 },
  { type: 'lamp', x: 34, y: 34 },

  // ── Wall clocks ──
  { type: 'clock', x: 20, y: 1 },
  { type: 'clock', x: 30, y: 1 },

  // ── Printers / copiers ──
  { type: 'printer', x: 13, y: 17 },
  { type: 'printer', x: 36, y: 9 },

  // ── Trash bins ──
  { type: 'trash-bin', x: 12, y: 9 },
  { type: 'trash-bin', x: 36, y: 17 },

  // ── Round rugs ──
  { type: 'rug-round', x: 24, y: 10 },
  { type: 'rug-round', x: 30, y: 10 },

  // ── Wall art ──
  { type: 'wall-art', x: 18, y: 1 },
  { type: 'wall-art', x: 32, y: 1 },
  { type: 'wall-art', x: 25, y: 1 },
];

// ── Interactive item state tracking ────────────────────────────────────────
// Items that can be toggled on/off by clicking
export type InteractiveType = 'lamp' | 'tv-screen' | 'printer' | 'vending-machine' | 'monitor-wall' | 'speaker';

export function isInteractive(type: string): type is InteractiveType {
  return ['lamp', 'tv-screen', 'printer', 'vending-machine', 'monitor-wall', 'speaker'].includes(type);
}

// ── Workspace rug area ─────────────────────────────────────────────────────
export const WORKSPACE_RUG = { x: 14, y: 21, w: 20, h: 12 };
export const LOUNGE_RUG = { x: 40, y: 5, w: 6, h: 3 };

// ── Label positions ────────────────────────────────────────────────────────
export const WORKSPACE_LABEL = { x: 21, y: 20, text: 'Open Workspace' };
