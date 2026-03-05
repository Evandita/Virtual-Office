import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { v4 as uuidv4 } from 'uuid';

// Inline types to avoid depending on shared package build
interface Position { x: number; y: number; }
interface AvatarConfig { skinColor: string; shirtColor: string; hairStyle: number; hairColor: string; }
type Direction = 'up' | 'down' | 'left' | 'right';
type PlayerStatus = 'available' | 'busy' | 'away' | 'in-meeting';

interface Player {
  id: string;
  name: string;
  avatar: AvatarConfig;
  position: Position;
  direction: Direction;
  status: PlayerStatus;
  roomId: string;
}

interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  content: string;
  timestamp: number;
  roomId: string;
}

const app = express();
app.use(cors());

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    methods: ['GET', 'POST'],
  },
});

interface Desk {
  id: string;
  assignedTo?: string;
  assignedName?: string;
}

interface RoomState {
  isLocked: boolean;
}

// State
const players = new Map<string, Player>();
const chatHistory: ChatMessage[] = [];
const MAX_CHAT_HISTORY = 200;
const desks = new Map<string, Desk>();
const roomStates = new Map<string, RoomState>();

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', players: players.size });
});

io.on('connection', (socket) => {
  console.log(`Client connected: ${socket.id}`);

  socket.on('player:join', (data: { name: string; avatar: AvatarConfig }) => {
    const player: Player = {
      id: socket.id,
      name: data.name,
      avatar: data.avatar,
      position: { x: 25 * 32, y: 17 * 32 }, // center of map in pixels
      direction: 'down',
      status: 'available',
      roomId: 'main-hall',
    };

    players.set(socket.id, player);

    // Send existing players to new player
    socket.emit('players:list', Array.from(players.values()));

    // Send chat history
    socket.emit('chat:history', chatHistory.slice(-50));

    // Notify others
    socket.broadcast.emit('player:joined', player);

    console.log(`Player joined: ${data.name} (${socket.id})`);
  });

  socket.on('player:move', (data: { position: Position; direction: Direction }) => {
    const player = players.get(socket.id);
    if (!player) return;

    player.position = data.position;
    player.direction = data.direction;

    // Broadcast to all other players
    socket.broadcast.emit('player:moved', {
      id: socket.id,
      position: data.position,
      direction: data.direction,
    });
  });

  socket.on('player:status', (status: PlayerStatus) => {
    const player = players.get(socket.id);
    if (!player) return;

    player.status = status;
    io.emit('player:status-changed', { id: socket.id, status });
  });

  socket.on('chat:send', (data: { content: string; roomId: string }) => {
    const player = players.get(socket.id);
    if (!player) return;

    const message: ChatMessage = {
      id: uuidv4(),
      senderId: socket.id,
      senderName: player.name,
      content: data.content,
      timestamp: Date.now(),
      roomId: data.roomId,
    };

    chatHistory.push(message);
    if (chatHistory.length > MAX_CHAT_HISTORY) {
      chatHistory.shift();
    }

    io.emit('chat:message', message);
  });

  // Desk assignment
  socket.on('desk:toggle', (data: { deskId: string }) => {
    const player = players.get(socket.id);
    if (!player) return;

    const desk = desks.get(data.deskId);
    if (desk && desk.assignedTo === socket.id) {
      // Unassign
      desks.delete(data.deskId);
      io.emit('desk:unassigned', { deskId: data.deskId });
    } else if (!desk || !desk.assignedTo) {
      // Assign
      // First unassign any existing desk for this player
      desks.forEach((d, id) => {
        if (d.assignedTo === socket.id) {
          desks.delete(id);
          io.emit('desk:unassigned', { deskId: id });
        }
      });
      desks.set(data.deskId, { id: data.deskId, assignedTo: socket.id, assignedName: player.name });
      io.emit('desk:assigned', { deskId: data.deskId, assignedTo: socket.id, assignedName: player.name });
    }
  });

  // Room lock toggle
  socket.on('room:lock', (data: { roomId: string }) => {
    const state = roomStates.get(data.roomId) || { isLocked: false };
    state.isLocked = !state.isLocked;
    roomStates.set(data.roomId, state);
    io.emit('room:locked', { roomId: data.roomId, isLocked: state.isLocked });
  });

  // WebRTC signaling
  socket.on('webrtc:offer', (data: { to: string; offer: unknown }) => {
    io.to(data.to).emit('webrtc:offer', { from: socket.id, offer: data.offer });
  });

  socket.on('webrtc:answer', (data: { to: string; answer: unknown }) => {
    io.to(data.to).emit('webrtc:answer', { from: socket.id, answer: data.answer });
  });

  socket.on('webrtc:ice-candidate', (data: { to: string; candidate: unknown }) => {
    io.to(data.to).emit('webrtc:ice-candidate', { from: socket.id, candidate: data.candidate });
  });

  // Proximity-based peer disconnect (not full socket disconnect)
  socket.on('webrtc:peer-leave', (data: { to: string }) => {
    io.to(data.to).emit('webrtc:peer-left', socket.id);
  });

  socket.on('webrtc:media-state', (data: { to: string; video: boolean; audio: boolean; screen: boolean }) => {
    io.to(data.to).emit('webrtc:media-state', { from: socket.id, video: data.video, audio: data.audio, screen: data.screen });
  });

  socket.on('disconnect', () => {
    const player = players.get(socket.id);
    if (player) {
      console.log(`Player left: ${player.name} (${socket.id})`);
      players.delete(socket.id);

      // Unassign desks
      desks.forEach((d, id) => {
        if (d.assignedTo === socket.id) {
          desks.delete(id);
          io.emit('desk:unassigned', { deskId: id });
        }
      });

      io.emit('player:left', socket.id);
      io.emit('webrtc:peer-left', socket.id);
    }
  });
});

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
  console.log(`Virtual Office server running on port ${PORT}`);
});
