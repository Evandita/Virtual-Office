import React, { useRef, useEffect } from 'react';
import type { Player, Position, Room } from '../types';
import { TILE_SIZE, MAP_WIDTH, MAP_HEIGHT, ROOMS } from '../types';

interface MinimapProps {
  getLocalPosition: () => Position | null;
  remotePlayers: Map<string, Player>;
  onTeleport: (x: number, y: number) => void;
  currentRoom: Room | null;
}

const SCALE = 4; // pixels per tile
const W = MAP_WIDTH * SCALE;
const H = MAP_HEIGHT * SCALE;

const ROOM_COLORS: Record<string, string> = {
  'meeting-a': '#1e3a5f',
  'meeting-b': '#1e3a5f',
  'lounge': '#2d4a1e',
  'focus-1': '#4a1e3a',
  'focus-2': '#4a1e3a',
};

export const Minimap: React.FC<MinimapProps> = ({ getLocalPosition, remotePlayers, onTeleport, currentRoom }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isExpanded, setIsExpanded] = React.useState(true);
  const remotePlayersRef = useRef(remotePlayers);
  const currentRoomRef = useRef(currentRoom);
  remotePlayersRef.current = remotePlayers;
  currentRoomRef.current = currentRoom;

  useEffect(() => {
    let animId: number;
    const draw = () => {
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d')!;
        ctx.clearRect(0, 0, W, H);

        ctx.fillStyle = '#2a2a3e';
        ctx.fillRect(0, 0, W, H);

        for (const room of ROOMS) {
          if (room.id === 'main-hall') continue;
          const b = room.bounds;
          ctx.fillStyle = ROOM_COLORS[room.id] || '#333';
          ctx.fillRect(b.x * SCALE, b.y * SCALE, b.width * SCALE, b.height * SCALE);

          if (currentRoomRef.current?.id === room.id) {
            ctx.strokeStyle = '#ffffff44';
            ctx.lineWidth = 2;
            ctx.strokeRect(b.x * SCALE, b.y * SCALE, b.width * SCALE, b.height * SCALE);
          }
        }

        ctx.strokeStyle = '#4a4a6e';
        ctx.lineWidth = 1;
        ctx.strokeRect(0, 0, W, H);

        remotePlayersRef.current.forEach((player) => {
          const px = (player.position.x / TILE_SIZE) * SCALE;
          const py = (player.position.y / TILE_SIZE) * SCALE;
          ctx.fillStyle = '#4A90D9';
          ctx.beginPath();
          ctx.arc(px, py, 2, 0, Math.PI * 2);
          ctx.fill();
        });

        const localPos = getLocalPosition();
        if (localPos) {
          const px = (localPos.x / TILE_SIZE) * SCALE;
          const py = (localPos.y / TILE_SIZE) * SCALE;
          ctx.fillStyle = '#2ecc71';
          ctx.beginPath();
          ctx.arc(px, py, 3, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = '#fff';
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      }
      animId = requestAnimationFrame(draw);
    };
    animId = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animId);
  }, [getLocalPosition]);

  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;
    const tileX = clickX / SCALE;
    const tileY = clickY / SCALE;
    onTeleport(tileX * TILE_SIZE, tileY * TILE_SIZE);
  };

  return (
    <div style={styles.container}>
      <div style={styles.header} onClick={() => setIsExpanded(!isExpanded)}>
        <span>Map</span>
        <span style={styles.toggle}>{isExpanded ? '-' : '+'}</span>
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
                style={styles.roomBtn}
                onClick={() => {
                  const b = room.bounds;
                  const cx = (b.x + b.width / 2) * TILE_SIZE;
                  const cy = (b.y + b.height / 2) * TILE_SIZE;
                  onTeleport(cx, cy);
                }}
              >
                <span style={{ ...styles.roomDot, background: ROOM_COLORS[room.id] || '#555' }} />
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
    background: 'rgba(20,20,40,0.92)',
    borderRadius: '12px',
    border: '1px solid rgba(255,255,255,0.1)',
    overflow: 'hidden',
    zIndex: 100,
    width: `${W + 16}px`,
  },
  header: {
    padding: '8px 12px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    cursor: 'pointer',
    fontWeight: 600,
    fontSize: '13px',
    borderBottom: '1px solid rgba(255,255,255,0.06)',
  },
  toggle: {
    fontSize: '16px',
    color: 'rgba(255,255,255,0.5)',
  },
  canvas: {
    display: 'block',
    margin: '8px',
    borderRadius: '6px',
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
    borderRadius: '4px',
    border: '1px solid rgba(255,255,255,0.1)',
    background: 'rgba(255,255,255,0.04)',
    color: '#fff',
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
