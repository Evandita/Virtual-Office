import React, { useState } from 'react';
import type { AvatarConfig, PlayerStatus, Room } from '../types';
import { ROOMS } from '../types';

const SHIRT_COLORS = ['#4A90D9', '#E74C3C', '#2ECC71', '#F39C12', '#9B59B6', '#1ABC9C', '#E67E22', '#34495E'];
const SKIN_COLORS = ['#FDBCB4', '#F5C6A5', '#D4A574', '#C68642', '#8D5524', '#5C3A1E'];
const HAIR_COLORS = ['#4A3728', '#1A1110', '#D4A017', '#C0392B', '#8E44AD', '#2C3E50'];

interface SettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  avatar: AvatarConfig;
  onAvatarChange: (avatar: AvatarConfig) => void;
  playerName: string;
  rooms: Room[];
  onToggleRoomLock: (roomId: string) => void;
}

export const SettingsPanel: React.FC<SettingsPanelProps> = ({
  isOpen,
  onClose,
  avatar,
  onAvatarChange,
  playerName,
  rooms,
  onToggleRoomLock,
}) => {
  const [tab, setTab] = useState<'avatar' | 'rooms'>('avatar');

  if (!isOpen) return null;

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.panel} onClick={(e) => e.stopPropagation()}>
        <div style={styles.header}>
          <h2 style={styles.title}>Settings</h2>
          <button style={styles.closeBtn} onClick={onClose}>X</button>
        </div>

        <div style={styles.tabs}>
          <button
            style={{ ...styles.tab, ...(tab === 'avatar' ? styles.activeTab : {}) }}
            onClick={() => setTab('avatar')}
          >
            Avatar
          </button>
          <button
            style={{ ...styles.tab, ...(tab === 'rooms' ? styles.activeTab : {}) }}
            onClick={() => setTab('rooms')}
          >
            Rooms
          </button>
        </div>

        <div style={styles.content}>
          {tab === 'avatar' && (
            <div>
              <div style={styles.previewContainer}>
                <svg width="80" height="80" viewBox="0 0 80 80">
                  <rect x="24" y="40" width="32" height="30" rx="4" fill={avatar.shirtColor} />
                  <circle cx="40" cy="28" r="16" fill={avatar.skinColor} />
                  <circle cx="34" cy="26" r="2" fill="#333" />
                  <circle cx="46" cy="26" r="2" fill="#333" />
                  <path d="M 34 33 Q 40 38 46 33" stroke="#333" strokeWidth="1.5" fill="none" />
                  <ellipse cx="40" cy="16" rx="16" ry="8" fill={avatar.hairColor} />
                </svg>
                <span style={styles.previewName}>{playerName}</span>
              </div>

              <div style={styles.section}>
                <label style={styles.label}>Shirt Color</label>
                <div style={styles.colorRow}>
                  {SHIRT_COLORS.map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => onAvatarChange({ ...avatar, shirtColor: color })}
                      style={{
                        ...styles.colorBtn,
                        backgroundColor: color,
                        border: avatar.shirtColor === color ? '3px solid #fff' : '3px solid transparent',
                      }}
                    />
                  ))}
                </div>
              </div>

              <div style={styles.section}>
                <label style={styles.label}>Skin Tone</label>
                <div style={styles.colorRow}>
                  {SKIN_COLORS.map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => onAvatarChange({ ...avatar, skinColor: color })}
                      style={{
                        ...styles.colorBtn,
                        backgroundColor: color,
                        border: avatar.skinColor === color ? '3px solid #fff' : '3px solid transparent',
                      }}
                    />
                  ))}
                </div>
              </div>

              <div style={styles.section}>
                <label style={styles.label}>Hair Color</label>
                <div style={styles.colorRow}>
                  {HAIR_COLORS.map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => onAvatarChange({ ...avatar, hairColor: color })}
                      style={{
                        ...styles.colorBtn,
                        backgroundColor: color,
                        border: avatar.hairColor === color ? '3px solid #fff' : '3px solid transparent',
                      }}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}

          {tab === 'rooms' && (
            <div>
              <p style={styles.description}>Manage room access and visibility.</p>
              {rooms.filter((r) => r.id !== 'main-hall').map((room) => (
                <div key={room.id} style={styles.roomRow}>
                  <div>
                    <div style={styles.roomName}>{room.name}</div>
                    <div style={styles.roomMeta}>
                      {room.type} {room.soundIsolated ? '| Sound isolated' : ''}
                    </div>
                  </div>
                  <div style={styles.roomActions}>
                    <button
                      style={{
                        ...styles.lockBtn,
                        background: room.isLocked ? 'rgba(231,76,60,0.3)' : 'rgba(46,204,113,0.2)',
                        borderColor: room.isLocked ? '#e74c3c' : '#2ecc71',
                      }}
                      onClick={() => onToggleRoomLock(room.id)}
                    >
                      {room.isLocked ? 'Locked' : 'Open'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 200,
  },
  panel: {
    background: '#1a1a2e',
    borderRadius: '16px',
    border: '1px solid rgba(255,255,255,0.1)',
    width: '480px',
    maxHeight: '80vh',
    overflow: 'auto',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '20px 24px',
    borderBottom: '1px solid rgba(255,255,255,0.08)',
  },
  title: {
    margin: 0,
    fontSize: '18px',
    fontWeight: 700,
  },
  closeBtn: {
    background: 'rgba(255,255,255,0.1)',
    border: 'none',
    color: '#fff',
    width: '28px',
    height: '28px',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '12px',
    fontWeight: 700,
  },
  tabs: {
    display: 'flex',
    borderBottom: '1px solid rgba(255,255,255,0.08)',
  },
  tab: {
    flex: 1,
    padding: '12px',
    background: 'transparent',
    border: 'none',
    borderBottom: '2px solid transparent',
    color: 'rgba(255,255,255,0.5)',
    fontSize: '13px',
    fontWeight: 600,
    cursor: 'pointer',
  },
  activeTab: {
    color: '#4A90D9',
    borderBottomColor: '#4A90D9',
  },
  content: {
    padding: '20px 24px',
  },
  previewContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    marginBottom: '20px',
    gap: '8px',
  },
  previewName: {
    fontSize: '14px',
    fontWeight: 600,
  },
  section: {
    marginBottom: '16px',
  },
  label: {
    display: 'block',
    fontSize: '11px',
    color: 'rgba(255,255,255,0.5)',
    marginBottom: '8px',
    textTransform: 'uppercase' as const,
    letterSpacing: '1px',
  },
  colorRow: {
    display: 'flex',
    gap: '8px',
    flexWrap: 'wrap' as const,
  },
  colorBtn: {
    width: '32px',
    height: '32px',
    borderRadius: '50%',
    cursor: 'pointer',
  },
  description: {
    fontSize: '13px',
    color: 'rgba(255,255,255,0.5)',
    marginBottom: '16px',
  },
  roomRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px',
    background: 'rgba(255,255,255,0.04)',
    borderRadius: '8px',
    marginBottom: '8px',
  },
  roomName: {
    fontSize: '14px',
    fontWeight: 600,
  },
  roomMeta: {
    fontSize: '11px',
    color: 'rgba(255,255,255,0.4)',
    marginTop: '2px',
  },
  roomActions: {
    display: 'flex',
    gap: '8px',
  },
  lockBtn: {
    padding: '4px 12px',
    borderRadius: '4px',
    border: '1px solid',
    color: '#fff',
    fontSize: '11px',
    cursor: 'pointer',
    fontWeight: 600,
  },
};
