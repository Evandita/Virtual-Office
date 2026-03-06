/**
 * Reactive map configuration store.
 * Wraps mapConfig data so the map editor can mutate it and trigger scene rebuilds.
 */
import {
  ROOM_VISUALS, FURNITURE, DECORATIONS,
  DESK_GRID, WORKSPACE_RUG, LOUNGE_RUG, WORKSPACE_LABEL,
  type RoomVisual, type FurnitureItem, type DecorationItem,
} from './mapConfig';

export interface MapConfig {
  rooms: RoomVisual[];
  furniture: FurnitureItem[];
  decorations: DecorationItem[];
  deskGrid: typeof DESK_GRID;
  workspaceRug: typeof WORKSPACE_RUG;
  loungeRug: typeof LOUNGE_RUG;
  workspaceLabel: typeof WORKSPACE_LABEL;
}

type Listener = (config: MapConfig) => void;

let currentConfig: MapConfig = {
  rooms: [...ROOM_VISUALS],
  furniture: [...FURNITURE],
  decorations: [...DECORATIONS],
  deskGrid: { ...DESK_GRID },
  workspaceRug: { ...WORKSPACE_RUG },
  loungeRug: { ...LOUNGE_RUG },
  workspaceLabel: { ...WORKSPACE_LABEL },
};

const listeners = new Set<Listener>();

// ── Interactive state (lamp on/off, tv on/off, etc.) ──────────────────────
// Key: "decoration:index" e.g. "decoration:5"
const interactiveState = new Map<string, boolean>();

export function getInteractiveState(key: string): boolean {
  return interactiveState.get(key) ?? true; // default ON
}

export function toggleInteractive(key: string): boolean {
  const current = getInteractiveState(key);
  interactiveState.set(key, !current);
  return !current;
}

// ── Config CRUD ───────────────────────────────────────────────────────────

export function getMapConfig(): MapConfig {
  return currentConfig;
}

export function updateMapConfig(partial: Partial<MapConfig>): void {
  currentConfig = { ...currentConfig, ...partial };
  listeners.forEach((fn) => fn(currentConfig));
}

export function subscribeMapConfig(fn: Listener): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

export function exportMapConfigJSON(): string {
  return JSON.stringify(currentConfig, null, 2);
}

export function importMapConfigJSON(json: string): void {
  try {
    const parsed = JSON.parse(json) as MapConfig;
    if (parsed.rooms && parsed.furniture && parsed.decorations) {
      currentConfig = parsed;
      listeners.forEach((fn) => fn(currentConfig));
    }
  } catch (e) {
    console.error('Failed to import map config:', e);
  }
}
