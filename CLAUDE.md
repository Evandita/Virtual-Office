# Virtual Office - Claude Code Project Guide

## Project Overview

Open-source virtual office application (similar to Gather/Ovice). Users join with an avatar, move around a 2D office map, and automatically connect via WebRTC for audio/video/screen sharing when in proximity to other users.

## Tech Stack

- **Monorepo**: npm workspaces (`client/`, `server/`, `shared/`)
- **Client**: React 19 + Vite + Phaser 3 (game engine) + Socket.IO client + WebRTC
- **Server**: Express + Socket.IO + TypeScript (tsx for dev)
- **Shared**: TypeScript types/constants (not actively used by client — client has its own `types.ts`)

## Quick Start

```bash
npm install          # install all workspace deps
npm run dev          # starts both server (port 3001) and client (port 5173) via concurrently
```

Individual:
```bash
npm run dev:server   # tsx watch server/src/index.ts
npm run dev:client   # vite dev server
```

## Architecture

### Client (`client/src/`)

| File | Purpose |
|------|---------|
| `main.tsx` | React entry point |
| `App.tsx` | Login/GameView router |
| `types.ts` | Client-side types, room/desk constants, map dimensions |
| `game/OfficeScene.ts` | Phaser scene — map rendering, avatar sprites, collision, proximity detection, room awareness |
| `services/socket.ts` | Socket.IO singleton (connect/disconnect) |
| `services/webrtc.ts` | WebRTC peer connection manager — signaling, media streams, screen share, ICE candidate queuing |
| `components/GameView.tsx` | Main orchestrator — wires Phaser + Socket.IO + WebRTC + all UI components |
| `components/VideoOverlay.tsx` | Video tiles for local/remote camera streams and screen shares |
| `components/Toolbar.tsx` | Top bar — player info, status, mic/cam/screen controls |
| `components/ChatPanel.tsx` | Collapsible chat with message history |
| `components/Minimap.tsx` | Canvas minimap with click-to-teleport |
| `components/LoginScreen.tsx` | Name input + avatar customization |
| `components/SettingsPanel.tsx` | Settings modal (avatar edit, room lock) |

### Server (`server/src/`)

| File | Purpose |
|------|---------|
| `index.ts` | Express + Socket.IO server — player state, chat history, desk assignments, room locks, WebRTC signal relay |

### Key Data Flow

1. **Player movement**: Phaser keyboard input → `player:move` socket event → broadcast to others
2. **Proximity**: Phaser `checkProximity()` → `onProximityChange` callback → `GameView` useEffect → `WebRTCManager.connectToPeer()`
3. **WebRTC**: Proximity triggers peer connection → offer/answer/ICE via Socket.IO relay → `ontrack` delivers remote streams
4. **Media state**: Camera/mic/screen changes → `broadcastMediaState()` sends socket event → `peerMediaState` in React state → UI updates

## WebRTC Design (Important)

The WebRTC implementation in `webrtc.ts` has several non-obvious design decisions:

- **No empty offers**: `connectToPeer()` only sends an offer if there are actual tracks to send. Empty offers create fragile signaling state.
- **Glare handling**: Uses polite/impolite peer pattern (lower socket ID is polite). Polite peer rolls back on simultaneous offers.
- **Post-answer renegotiation**: After answering an offer, the answerer checks if it has tracks the offerer doesn't know about and sends its own offer.
- **`replaceTrack(null)` for muting**: Camera/mic off uses `replaceTrack(null)` instead of removing tracks — avoids renegotiation.
- **Explicit media state signaling**: `broadcastMediaState()` sends `{video, audio, screen}` via socket because `replaceTrack(null)` mute events are unreliable across browsers.
- **ICE candidate queuing**: Candidates that arrive before `setRemoteDescription` are queued in `pendingCandidates` and flushed after.
- **Separate screen share streams**: Screen share tracks go through a separate `onScreenStream` callback to avoid overwriting camera streams in `remoteStreams` map. The `_remoteStreamIds` map tracks which stream ID is the "camera" stream per peer.

## Socket Events

| Event | Direction | Purpose |
|-------|-----------|---------|
| `player:join` | C→S | Join with name + avatar |
| `players:list` | S→C | Full player list on join |
| `player:joined` / `player:left` | S→C | Player enter/leave |
| `player:move` | C→S→C | Position + direction updates |
| `player:status` | C→S→C | Status changes (available/busy/away/in-meeting) |
| `chat:send` / `chat:message` | C→S→C | Chat messages |
| `chat:history` | S→C | Last 50 messages on join |
| `desk:toggle` | C→S | Claim/release desk |
| `desk:assigned` / `desk:unassigned` | S→C | Desk state changes |
| `room:lock` | C→S | Toggle room lock |
| `room:locked` | S→C | Room lock state |
| `webrtc:offer` / `webrtc:answer` / `webrtc:ice-candidate` | C→S→C | WebRTC signaling relay |
| `webrtc:peer-left` | S→C | Peer disconnected |
| `webrtc:media-state` | C→S→C | Camera/mic/screen on/off state |

## Map Layout

- 50x35 tile grid, TILE_SIZE=32px
- 6 rooms: Main Hall, Meeting Room A/B, Lounge, Private Office, Open Workspace
- Rooms defined in `client/src/types.ts` ROOMS constant with x/y/width/height bounds
- Proximity radius: 5 tiles

## Common Pitfalls

- The `shared/` package types are NOT used by the client. The client has its own `types.ts` with additional fields (Desk, isLocked, soundIsolated). Keep them in sync manually.
- Video elements must never have `display: none` — browsers stop decoding. Use an overlay div instead to hide video visually.
- `ontrack` can fire multiple times per peer (camera stream + screen stream). Each fires with a different `MediaStream` — don't overwrite blindly.
- WebRTC renegotiation must wait for `signalingState === 'stable'` before creating new offers.
- The server is stateful (in-memory Maps). Restarting it loses all player/desk/room state.
