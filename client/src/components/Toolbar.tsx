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

// SVG icon components
const MicIcon = ({ muted }: { muted: boolean }) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
    <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
    <line x1="12" y1="19" x2="12" y2="23" />
    <line x1="8" y1="23" x2="16" y2="23" />
    {muted && <line x1="1" y1="1" x2="23" y2="23" stroke="#e74c3c" strokeWidth="2.5" />}
  </svg>
);

const CamIcon = ({ off }: { off: boolean }) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M23 7l-7 5 7 5V7z" />
    <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
    {off && <line x1="1" y1="1" x2="23" y2="23" stroke="#e74c3c" strokeWidth="2.5" />}
  </svg>
);

const ScreenIcon = ({ active }: { active: boolean }) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={active ? '#2ecc71' : 'currentColor'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
    <line x1="8" y1="21" x2="16" y2="21" />
    <line x1="12" y1="17" x2="12" y2="21" />
  </svg>
);

const SettingsIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </svg>
);

const UsersIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);

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
        <span style={styles.playerCount}>
          <UsersIcon />
          {playerCount}
        </span>
        {currentRoom && currentRoom.id !== 'main-hall' && (
          <span style={styles.roomIndicator}>
            {currentRoom.soundIsolated && (
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: 4 }}>
                <path d="M11 5L6 9H2v6h4l5 4V5z" />
                <line x1="23" y1="9" x2="17" y2="15" />
                <line x1="17" y1="9" x2="23" y2="15" />
              </svg>
            )}
            {currentRoom.name}
          </span>
        )}
      </div>

      <div style={styles.center}>
        <button
          style={{
            ...styles.toolBtn,
            background: micEnabled ? 'rgba(46,204,113,0.15)' : 'rgba(231,76,60,0.15)',
            borderColor: micEnabled ? 'rgba(46,204,113,0.3)' : 'rgba(231,76,60,0.3)',
          }}
          onClick={onToggleMic}
          title={micEnabled ? 'Mute' : 'Unmute'}
        >
          <MicIcon muted={!micEnabled} />
        </button>
        <button
          style={{
            ...styles.toolBtn,
            background: camEnabled ? 'rgba(46,204,113,0.15)' : 'rgba(231,76,60,0.15)',
            borderColor: camEnabled ? 'rgba(46,204,113,0.3)' : 'rgba(231,76,60,0.3)',
          }}
          onClick={onToggleCam}
          title={camEnabled ? 'Camera Off' : 'Camera On'}
        >
          <CamIcon off={!camEnabled} />
        </button>
        <div style={styles.divider} />
        <button
          style={{
            ...styles.toolBtn,
            background: screenSharing ? 'rgba(46,204,113,0.15)' : 'rgba(255,255,255,0.05)',
            borderColor: screenSharing ? 'rgba(46,204,113,0.3)' : 'rgba(255,255,255,0.1)',
          }}
          onClick={onToggleScreenShare}
          title={screenSharing ? 'Stop Sharing' : 'Share Screen'}
        >
          <ScreenIcon active={screenSharing} />
        </button>
      </div>

      <div style={styles.right}>
        <div style={{ position: 'relative' }}>
          <button style={styles.statusBtn} onClick={() => setShowStatus(!showStatus)}>
            <span style={{ ...styles.dot, background: currentStatus.color, boxShadow: `0 0 6px ${currentStatus.color}55` }} />
            {currentStatus.label}
          </button>
          {showStatus && (
            <div style={styles.statusDropdown}>
              {STATUS_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  style={{
                    ...styles.statusOption,
                    background: opt.value === status ? 'rgba(255,255,255,0.08)' : 'transparent',
                  }}
                  onClick={() => { onStatusChange(opt.value); setShowStatus(false); }}
                >
                  <span style={{ ...styles.dot, background: opt.color }} />
                  {opt.label}
                </button>
              ))}
            </div>
          )}
        </div>
        <button style={styles.iconBtn} onClick={onOpenSettings} title="Settings">
          <SettingsIcon />
        </button>
        <div style={styles.userBadge}>
          <div style={styles.userAvatar}>{playerName.charAt(0).toUpperCase()}</div>
          <span style={styles.playerName}>{playerName}</span>
        </div>
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
    height: '52px',
    background: 'rgba(12,12,24,0.88)',
    backdropFilter: 'blur(16px)',
    borderBottom: '1px solid rgba(255,255,255,0.06)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0 20px',
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
    color: '#6BA4E8',
    letterSpacing: '-0.3px',
  },
  playerCount: {
    display: 'flex',
    alignItems: 'center',
    gap: '5px',
    fontSize: '12px',
    color: 'rgba(255,255,255,0.45)',
    background: 'rgba(255,255,255,0.05)',
    padding: '3px 10px',
    borderRadius: '12px',
  },
  roomIndicator: {
    display: 'flex',
    alignItems: 'center',
    fontSize: '12px',
    color: '#f0b952',
    background: 'rgba(240,185,82,0.08)',
    padding: '3px 12px',
    borderRadius: '12px',
    border: '1px solid rgba(240,185,82,0.15)',
  },
  center: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  toolBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '40px',
    height: '36px',
    borderRadius: '10px',
    border: '1px solid rgba(255,255,255,0.1)',
    color: '#fff',
    cursor: 'pointer',
    transition: 'all 0.15s',
  },
  divider: {
    width: '1px',
    height: '20px',
    background: 'rgba(255,255,255,0.08)',
    margin: '0 4px',
  },
  right: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  statusBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '6px 14px',
    borderRadius: '10px',
    border: '1px solid rgba(255,255,255,0.08)',
    background: 'rgba(255,255,255,0.04)',
    color: '#fff',
    fontSize: '12px',
    cursor: 'pointer',
    fontWeight: 500,
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
    marginTop: '6px',
    background: 'rgba(16,16,32,0.96)',
    backdropFilter: 'blur(16px)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '10px',
    overflow: 'hidden',
    minWidth: '150px',
    zIndex: 101,
    boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
  },
  statusOption: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    width: '100%',
    padding: '10px 14px',
    border: 'none',
    background: 'transparent',
    color: '#fff',
    fontSize: '12px',
    cursor: 'pointer',
    textAlign: 'left',
    transition: 'background 0.1s',
  },
  iconBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '36px',
    height: '36px',
    borderRadius: '10px',
    border: '1px solid rgba(255,255,255,0.08)',
    background: 'rgba(255,255,255,0.04)',
    color: '#fff',
    cursor: 'pointer',
  },
  userBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '4px 10px 4px 4px',
    borderRadius: '10px',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.06)',
  },
  userAvatar: {
    width: '28px',
    height: '28px',
    borderRadius: '8px',
    background: 'linear-gradient(135deg, #4A90D9, #7B68EE)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '13px',
    fontWeight: 700,
    color: '#fff',
  },
  playerName: {
    fontSize: '13px',
    fontWeight: 500,
    color: 'rgba(255,255,255,0.85)',
  },
};
