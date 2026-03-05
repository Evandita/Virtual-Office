// Shared types and constants for virtual office

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
  type: RoomType;
  bounds: { x: number; y: number; width: number; height: number };
}

export type RoomType = 'open' | 'meeting' | 'lounge' | 'private';

// Socket event types
export interface ServerToClientEvents {
  'player:joined': (player: Player) => void;
  'player:left': (playerId: string) => void;
  'player:moved': (data: { id: string; position: Position; direction: Direction }) => void;
  'player:status-changed': (data: { id: string; status: PlayerStatus }) => void;
  'players:list': (players: Player[]) => void;
  'chat:message': (message: ChatMessage) => void;
  'chat:history': (messages: ChatMessage[]) => void;
  'webrtc:offer': (data: { from: string; offer: RTCSessionDescriptionInit }) => void;
  'webrtc:answer': (data: { from: string; answer: RTCSessionDescriptionInit }) => void;
  'webrtc:ice-candidate': (data: { from: string; candidate: RTCIceCandidateInit }) => void;
  'webrtc:peer-left': (peerId: string) => void;
  'room:entered': (data: { playerId: string; roomId: string }) => void;
}

export interface ClientToServerEvents {
  'player:join': (data: { name: string; avatar: AvatarConfig }) => void;
  'player:move': (data: { position: Position; direction: Direction }) => void;
  'player:status': (status: PlayerStatus) => void;
  'chat:send': (data: { content: string; roomId: string }) => void;
  'webrtc:offer': (data: { to: string; offer: RTCSessionDescriptionInit }) => void;
  'webrtc:answer': (data: { to: string; answer: RTCSessionDescriptionInit }) => void;
  'webrtc:ice-candidate': (data: { to: string; candidate: RTCIceCandidateInit }) => void;
}

// Constants
export const TILE_SIZE = 32;
export const MAP_WIDTH = 50;
export const MAP_HEIGHT = 35;
export const PROXIMITY_RADIUS = 5; // tiles - distance for audio/video activation
export const MOVEMENT_SPEED = 3; // pixels per frame

export const DEFAULT_ROOMS: Room[] = [
  { id: 'main-hall', name: 'Main Hall', type: 'open', bounds: { x: 0, y: 0, width: 50, height: 35 } },
  { id: 'meeting-room-1', name: 'Meeting Room A', type: 'meeting', bounds: { x: 2, y: 2, width: 8, height: 6 } },
  { id: 'meeting-room-2', name: 'Meeting Room B', type: 'meeting', bounds: { x: 2, y: 10, width: 8, height: 6 } },
  { id: 'lounge', name: 'Lounge', type: 'lounge', bounds: { x: 38, y: 2, width: 10, height: 8 } },
  { id: 'private-1', name: 'Focus Room 1', type: 'private', bounds: { x: 38, y: 12, width: 5, height: 4 } },
  { id: 'private-2', name: 'Focus Room 2', type: 'private', bounds: { x: 44, y: 12, width: 5, height: 4 } },
];

export const DEFAULT_AVATAR: AvatarConfig = {
  skinColor: '#FDBCB4',
  shirtColor: '#4A90D9',
  hairStyle: 0,
  hairColor: '#4A3728',
};
