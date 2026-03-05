import React, { useState } from 'react';
import type { PlayerStatus, Room } from '../types';

interface ToolbarProps {
  playerName: string;
  status: PlayerStatus;
  onStatusChange: (status: PlayerStatus) => void;
  micEnabled: boolean;
  camEnabled: boolean;
  screenSharing: boolean;
  onToggleMic: () => void;
  onToggleCam: () => void;
  onToggleScreenShare: () => void;
  onOpenSettings: () => void;
  playerCount: number;
  currentRoom: Room | null;
}

const STATUS_OPTIONS: { value: PlayerStatus; label: string; color: string }[] = [
  { value: 'available', label: 'Available', color: '#2ecc71' },
  { value: 'busy', label: 'Busy', color: '#e74c3c' },
  { value: 'away', label: 'Away', color: '#f39c12' },
  { value: 'in-meeting', label: 'In Meeting', color: '#9b59b6' },
];

export const Toolbar: React.FC<ToolbarProps> = ({
  playerName,
  status,
  onStatusChange,
  micEnabled,
  camEnabled,
  screenSharing,
  onToggleMic,
  onToggleCam,
  onToggleScreenShare,
  onOpenSettings,
  playerCount,
  currentRoom,
}) => {
  const [showStatus, setShowStatus] = useState(false);
  const currentStatus = STATUS_OPTIONS.find((s) => s.value === status)!;

  return (
    <div style={styles.container}>
      <div style={styles.left}>
        <span style={styles.logo}>Virtual Office</span>
        <span style={styles.playerCount}>{playerCount} online</span>
        {currentRoom && currentRoom.id !== 'main-hall' && (
          <span style={styles.roomIndicator}>
            {currentRoom.soundIsolated && '🔇 '}
            {currentRoom.name}
          </span>
        )}
      </div>

      <div style={styles.center}>
        <button
          style={{ ...styles.toolBtn, background: micEnabled ? 'rgba(255,255,255,0.1)' : 'rgba(231,76,60,0.3)' }}
          onClick={onToggleMic}
          title={micEnabled ? 'Mute' : 'Unmute'}
        >
          {micEnabled ? 'Mic On' : 'Mic Off'}
        </button>
        <button
          style={{ ...styles.toolBtn, background: camEnabled ? 'rgba(255,255,255,0.1)' : 'rgba(231,76,60,0.3)' }}
          onClick={onToggleCam}
          title={camEnabled ? 'Camera Off' : 'Camera On'}
        >
          {camEnabled ? 'Cam On' : 'Cam Off'}
        </button>
        <button
          style={{ ...styles.toolBtn, background: screenSharing ? 'rgba(46,204,113,0.3)' : 'rgba(255,255,255,0.1)' }}
          onClick={onToggleScreenShare}
          title={screenSharing ? 'Stop Sharing' : 'Share Screen'}
        >
          {screenSharing ? 'Stop Share' : 'Share Screen'}
        </button>
      </div>

      <div style={styles.right}>
        <div style={{ position: 'relative' }}>
          <button style={styles.statusBtn} onClick={() => setShowStatus(!showStatus)}>
            <span style={{ ...styles.dot, background: currentStatus.color }} />
            {currentStatus.label}
          </button>
          {showStatus && (
            <div style={styles.statusDropdown}>
              {STATUS_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  style={styles.statusOption}
                  onClick={() => { onStatusChange(opt.value); setShowStatus(false); }}
                >
                  <span style={{ ...styles.dot, background: opt.color }} />
                  {opt.label}
                </button>
              ))}
            </div>
          )}
        </div>
        <button style={styles.settingsBtn} onClick={onOpenSettings} title="Settings">
          Settings
        </button>
        <span style={styles.playerName}>{playerName}</span>
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '48px',
    background: 'rgba(15,15,30,0.92)',
    borderBottom: '1px solid rgba(255,255,255,0.08)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0 16px',
    zIndex: 100,
  },
  left: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  logo: {
    fontWeight: 700,
    fontSize: '15px',
    color: '#4A90D9',
  },
  playerCount: {
    fontSize: '12px',
    color: 'rgba(255,255,255,0.4)',
    background: 'rgba(255,255,255,0.06)',
    padding: '2px 8px',
    borderRadius: '10px',
  },
  roomIndicator: {
    fontSize: '12px',
    color: '#f39c12',
    background: 'rgba(243,156,18,0.1)',
    padding: '2px 10px',
    borderRadius: '10px',
    border: '1px solid rgba(243,156,18,0.2)',
  },
  center: {
    display: 'flex',
    gap: '8px',
  },
  toolBtn: {
    padding: '6px 14px',
    borderRadius: '6px',
    border: '1px solid rgba(255,255,255,0.12)',
    color: '#fff',
    fontSize: '12px',
    cursor: 'pointer',
    fontWeight: 500,
  },
  right: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  statusBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '6px 12px',
    borderRadius: '6px',
    border: '1px solid rgba(255,255,255,0.12)',
    background: 'rgba(255,255,255,0.06)',
    color: '#fff',
    fontSize: '12px',
    cursor: 'pointer',
  },
  dot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    display: 'inline-block',
  },
  statusDropdown: {
    position: 'absolute',
    top: '100%',
    right: 0,
    marginTop: '4px',
    background: 'rgba(20,20,40,0.95)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '8px',
    overflow: 'hidden',
    minWidth: '140px',
    zIndex: 101,
  },
  statusOption: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    width: '100%',
    padding: '8px 12px',
    border: 'none',
    background: 'transparent',
    color: '#fff',
    fontSize: '12px',
    cursor: 'pointer',
    textAlign: 'left',
  },
  settingsBtn: {
    padding: '6px 12px',
    borderRadius: '6px',
    border: '1px solid rgba(255,255,255,0.12)',
    background: 'rgba(255,255,255,0.06)',
    color: '#fff',
    fontSize: '12px',
    cursor: 'pointer',
  },
  playerName: {
    fontSize: '13px',
    fontWeight: 500,
  },
};
