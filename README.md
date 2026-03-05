# Virtual Office

An open-source virtual office application where teams can work together in a 2D spatial environment. Move your avatar around office rooms, and automatically connect with nearby colleagues via real-time audio, video, and screen sharing.

## Features

- **2D spatial office** — Navigate a pixel-art office with keyboard controls (arrow keys / WASD)
- **Proximity-based video/audio** — Automatically connect to nearby colleagues via WebRTC
- **Screen sharing** — Share your screen with nearby peers
- **Real-time chat** — Room-based text chat with message history
- **Custom avatars** — Choose shirt color, skin tone, and hair style
- **Multiple rooms** — Main Hall, Meeting Rooms, Lounge, Private Office, Open Workspace
- **Desk assignment** — Claim a desk as your own workspace
- **Room management** — Lock/unlock rooms for private meetings
- **Minimap** — Overview of the office with click-to-teleport
- **Status indicators** — Set yourself as Available, Busy, Away, or In Meeting

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Game Engine | [Phaser 3](https://phaser.io/) |
| Frontend | React 19, TypeScript, Vite |
| Backend | Node.js, Express, Socket.IO |
| Real-time | WebRTC (peer-to-peer), Socket.IO (signaling) |

## Getting Started

### Prerequisites

- Node.js 18+
- npm 9+

### Installation

```bash
git clone <repo-url>
cd virtual-office
npm install
```

### Development

```bash
npm run dev
```

This starts both the server (port 3001) and client (port 5173) concurrently.

Or run them separately:

```bash
npm run dev:server   # Express + Socket.IO on port 3001
npm run dev:client   # Vite dev server on port 5173
```

### Production Build

```bash
npm run build
npm start
```

## Project Structure

```
virtual-office/
├── client/                 # React + Phaser frontend
│   └── src/
│       ├── components/     # React UI components
│       │   ├── GameView.tsx       # Main orchestrator
│       │   ├── VideoOverlay.tsx   # Video call tiles
│       │   ├── Toolbar.tsx        # Top navigation bar
│       │   ├── ChatPanel.tsx      # Chat sidebar
│       │   ├── Minimap.tsx        # Office minimap
│       │   ├── LoginScreen.tsx    # Login + avatar picker
│       │   └── SettingsPanel.tsx  # Settings modal
│       ├── game/
│       │   └── OfficeScene.ts     # Phaser game scene
│       ├── services/
│       │   ├── socket.ts          # Socket.IO client
│       │   └── webrtc.ts          # WebRTC manager
│       ├── types.ts               # Type definitions
│       ├── App.tsx                # Root component
│       └── main.tsx               # Entry point
├── server/                 # Express + Socket.IO backend
│   └── src/
│       └── index.ts               # Server entry point
├── shared/                 # Shared types (reference)
│   └── src/
│       └── index.ts
└── package.json            # Workspace root
```

## How It Works

1. **Join** — Enter your name and customize your avatar
2. **Move** — Use arrow keys or WASD to walk around the office
3. **Connect** — Walk near a colleague to automatically start a video/audio call
4. **Chat** — Use the chat panel to send text messages
5. **Share** — Toggle screen sharing from the toolbar
6. **Explore** — Use the minimap to teleport between rooms

### Proximity System

When two players are within 5 tiles of each other, a WebRTC peer connection is established automatically. Moving apart disconnects the call. This creates a natural "walk up and talk" experience.

### WebRTC Architecture

- **Signaling**: Socket.IO relays WebRTC offers, answers, and ICE candidates
- **Media**: Peer-to-peer audio/video via `getUserMedia` and `getDisplayMedia`
- **State**: Media on/off state is broadcast via socket events for reliable UI updates

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3001` | Server port |
| `CLIENT_URL` | `http://localhost:5173` | CORS origin for Socket.IO |

## License

MIT
