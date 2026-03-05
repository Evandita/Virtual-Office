export interface Position {
  x: number;
  y: number;
}

export interface Player {
  id: string;
  name: string;
  avatar: AvatarConfig;
  position: Position;
  direction: Direction;
  status: PlayerStatus;
  roomId: string;
}

export interface AvatarConfig {
  skinColor: string;
  shirtColor: string;
  hairStyle: number;
  hairColor: string;
}

export type Direction = 'up' | 'down' | 'left' | 'right';
export type PlayerStatus = 'available' | 'busy' | 'away' | 'in-meeting';

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  content: string;
  timestamp: number;
  roomId: string;
}

export interface Room {
  id: string;
  name: string;
  type: 'open' | 'meeting' | 'lounge' | 'private';
  bounds: { x: number; y: number; width: number; height: number };
  isLocked?: boolean;
  soundIsolated?: boolean;
}

export interface Desk {
  id: string;
  tileX: number;
  tileY: number;
  assignedTo?: string;
  assignedName?: string;
}

export const TILE_SIZE = 32;
export const MAP_WIDTH = 50;
export const MAP_HEIGHT = 35;
export const PROXIMITY_RADIUS = 5;

export const ROOMS: Room[] = [
  { id: 'main-hall', name: 'Main Hall', type: 'open', bounds: { x: 0, y: 0, width: 50, height: 35 }, soundIsolated: false },
  { id: 'meeting-a', name: 'Meeting Room A', type: 'meeting', bounds: { x: 2, y: 2, width: 9, height: 7 }, soundIsolated: true },
  { id: 'meeting-b', name: 'Meeting Room B', type: 'meeting', bounds: { x: 2, y: 10, width: 9, height: 7 }, soundIsolated: true },
  { id: 'lounge', name: 'Lounge', type: 'lounge', bounds: { x: 38, y: 2, width: 11, height: 9 }, soundIsolated: false },
  { id: 'focus-1', name: 'Focus Room 1', type: 'private', bounds: { x: 38, y: 12, width: 6, height: 5 }, soundIsolated: true },
  { id: 'focus-2', name: 'Focus Room 2', type: 'private', bounds: { x: 44, y: 12, width: 5, height: 5 }, soundIsolated: true },
];
