import React, { useRef, useEffect } from 'react';
import type { Player, Position, Room } from '../types';
import { TILE_SIZE, MAP_WIDTH, MAP_HEIGHT, ROOMS } from '../types';
import { ROOM_VISUALS, WORKSPACE_RUG } from '../game/mapConfig';

interface MinimapProps {
  getLocalPosition: () => Position | null;
  remotePlayers: Map<string, Player>;
  onTeleport: (x: number, y: number) => void;
  currentRoom: Room | null;
}

const SCALE = 4;
const W = MAP_WIDTH * SCALE;
const H = MAP_HEIGHT * SCALE;
const MINIMAP_FPS = 10; // throttle to save CPU
const FRAME_INTERVAL = 1000 / MINIMAP_FPS;

// Derive colors from room visuals config
function hexToCSS(hex: number): string {
  return '#' + hex.toString(16).padStart(6, '0');
}

const ROOM_COLORS: Record<string, string> = {};
const ROOM_BORDER_COLORS: Record<string, string> = {};
for (const rv of ROOM_VISUALS) {
  ROOM_COLORS[rv.id] = hexToCSS(rv.floor.base);
  ROOM_BORDER_COLORS[rv.id] = hexToCSS(rv.wall.top);
}

const MapIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" />
    <line x1="8" y1="2" x2="8" y2="18" />
    <line x1="16" y1="6" x2="16" y2="22" />
  </svg>
);

export const Minimap: React.FC<MinimapProps> = ({ getLocalPosition, remotePlayers, onTeleport, currentRoom }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isExpanded, setIsExpanded] = React.useState(true);
  const remotePlayersRef = useRef(remotePlayers);
  const currentRoomRef = useRef(currentRoom);
  remotePlayersRef.current = remotePlayers;
  currentRoomRef.current = currentRoom;

  useEffect(() => {
    let animId: number;
    let lastTime = 0;

    const draw = (time: number) => {
      animId = requestAnimationFrame(draw);

      // Throttle rendering
      if (time - lastTime < FRAME_INTERVAL) return;
      lastTime = time;

      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d')!;

      ctx.fillStyle = '#1e1e2f';
      ctx.fillRect(0, 0, W, H);

      // Rooms
      for (const room of ROOMS) {
        if (room.id === 'main-hall') continue;
        const b = room.bounds;
        ctx.fillStyle = ROOM_COLORS[room.id] || '#333';
        ctx.fillRect(b.x * SCALE, b.y * SCALE, b.width * SCALE, b.height * SCALE);

        ctx.strokeStyle = ROOM_BORDER_COLORS[room.id] || '#555';
        ctx.lineWidth = 1;
        ctx.strokeRect(b.x * SCALE + 0.5, b.y * SCALE + 0.5, b.width * SCALE - 1, b.height * SCALE - 1);

        if (currentRoomRef.current?.id === room.id) {
          ctx.strokeStyle = '#ffffff44';
          ctx.lineWidth = 2;
          ctx.strokeRect(b.x * SCALE, b.y * SCALE, b.width * SCALE, b.height * SCALE);
        }
      }

      // Workspace area
      const wr = WORKSPACE_RUG;
      ctx.fillStyle = 'rgba(40, 38, 74, 0.25)';
      ctx.fillRect(wr.x * SCALE, wr.y * SCALE, wr.w * SCALE, wr.h * SCALE);

      // Outer border
      ctx.strokeStyle = '#3a3a5a';
      ctx.lineWidth = 1;
      ctx.strokeRect(0.5, 0.5, W - 1, H - 1);

      // Remote players
      ctx.fillStyle = '#5B8FD9';
      remotePlayersRef.current.forEach((player) => {
        const px = (player.position.x / TILE_SIZE) * SCALE;
        const py = (player.position.y / TILE_SIZE) * SCALE;
        ctx.beginPath();
        ctx.arc(px, py, 2.5, 0, Math.PI * 2);
        ctx.fill();
      });

      // Local player
      const localPos = getLocalPosition();
      if (localPos) {
        const px = (localPos.x / TILE_SIZE) * SCALE;
        const py = (localPos.y / TILE_SIZE) * SCALE;

        ctx.strokeStyle = 'rgba(46, 204, 113, 0.3)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(px, py, 6, 0, Math.PI * 2);
        ctx.stroke();

        ctx.fillStyle = '#2ecc71';
        ctx.beginPath();
        ctx.arc(px, py, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    };

    animId = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animId);
  }, [getLocalPosition]);

  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const tileX = (e.clientX - rect.left) / SCALE;
    const tileY = (e.clientY - rect.top) / SCALE;
    onTeleport(tileX * TILE_SIZE, tileY * TILE_SIZE);
  };

  return (
    <div style={styles.container}>
      <div style={styles.header} onClick={() => setIsExpanded(!isExpanded)}>
        <div style={styles.headerLeft}>
          <MapIcon />
          <span>Map</span>
        </div>
        <span style={styles.toggle}>{isExpanded ? '\u2212' : '+'}</span>
      </div>
      {isExpanded && (
        <>
          <canvas
            ref={canvasRef}
            width={W}
            height={H}
            style={styles.canvas}
            onClick={handleClick}
            title="Click to teleport"
          />
          <div style={styles.legend}>
            {ROOMS.filter((r) => r.id !== 'main-hall').map((room) => (
              <button
                key={room.id}
                style={{
                  ...styles.roomBtn,
                  borderColor: ROOM_BORDER_COLORS[room.id] || 'rgba(255,255,255,0.1)',
                }}
                onClick={() => {
                  const b = room.bounds;
                  onTeleport((b.x + b.width / 2) * TILE_SIZE, (b.y + b.height / 2) * TILE_SIZE);
                }}
              >
                <span style={{ ...styles.roomDot, background: ROOM_BORDER_COLORS[room.id] || '#555' }} />
                {room.name}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    position: 'absolute',
    bottom: '16px',
    left: '16px',
    background: 'rgba(12,12,24,0.88)',
    backdropFilter: 'blur(16px)',
    borderRadius: '14px',
    border: '1px solid rgba(255,255,255,0.07)',
    overflow: 'hidden',
    zIndex: 100,
    width: `${W + 16}px`,
    boxShadow: '0 4px 24px rgba(0,0,0,0.3)',
  },
  header: {
    padding: '8px 12px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    cursor: 'pointer',
    fontWeight: 600,
    fontSize: '13px',
    borderBottom: '1px solid rgba(255,255,255,0.05)',
    color: 'rgba(255,255,255,0.85)',
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  toggle: {
    fontSize: '16px',
    color: 'rgba(255,255,255,0.35)',
    fontWeight: 300,
  },
  canvas: {
    display: 'block',
    margin: '8px',
    borderRadius: '8px',
    cursor: 'crosshair',
  },
  legend: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '4px',
    padding: '4px 8px 8px',
  },
  roomBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    padding: '3px 8px',
    borderRadius: '6px',
    border: '1px solid rgba(255,255,255,0.08)',
    background: 'rgba(255,255,255,0.03)',
    color: 'rgba(255,255,255,0.7)',
    fontSize: '9px',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  roomDot: {
    width: '6px',
    height: '6px',
    borderRadius: '50%',
    display: 'inline-block',
  },
};
