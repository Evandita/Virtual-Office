import React, { useState } from 'react';
import type { AvatarConfig } from '../types';

const SHIRT_COLORS = ['#4A90D9', '#E74C3C', '#2ECC71', '#F39C12', '#9B59B6', '#1ABC9C', '#E67E22', '#34495E'];
const SKIN_COLORS = ['#FDBCB4', '#F5C6A5', '#D4A574', '#C68642', '#8D5524', '#5C3A1E'];
const HAIR_COLORS = ['#4A3728', '#1A1110', '#D4A017', '#C0392B', '#8E44AD', '#2C3E50'];

interface LoginScreenProps {
  onJoin: (name: string, avatar: AvatarConfig) => void;
  defaultAvatar: AvatarConfig;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onJoin, defaultAvatar }) => {
  const [name, setName] = useState('');
  const [avatar, setAvatar] = useState<AvatarConfig>(defaultAvatar);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim()) {
      onJoin(name.trim(), avatar);
    }
  };

  return (
    <div style={styles.container}>
      {/* Background decoration */}
      <div style={styles.bgOrb1} />
      <div style={styles.bgOrb2} />

      <div style={styles.card}>
        <div style={styles.logoArea}>
          <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
            <rect width="40" height="40" rx="10" fill="url(#logo-grad)" />
            <path d="M12 20c0-4.4 3.6-8 8-8s8 3.6 8 8-3.6 8-8 8" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" />
            <circle cx="20" cy="20" r="3" fill="#fff" />
            <defs>
              <linearGradient id="logo-grad" x1="0" y1="0" x2="40" y2="40">
                <stop stopColor="#4A90D9" />
                <stop offset="1" stopColor="#7B68EE" />
              </linearGradient>
            </defs>
          </svg>
          <h1 style={styles.title}>Virtual Office</h1>
        </div>
        <p style={styles.subtitle}>Enter your name and customize your avatar to join</p>

        <form onSubmit={handleSubmit}>
          <input
            type="text"
            placeholder="Your name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={styles.input}
            maxLength={20}
            autoFocus
          />

          {/* Avatar preview */}
          <div style={styles.previewContainer}>
            <div style={styles.previewBg}>
              <svg width="80" height="80" viewBox="0 0 80 80">
                <rect x="24" y="40" width="32" height="30" rx="4" fill={avatar.shirtColor} />
                <circle cx="40" cy="28" r="16" fill={avatar.skinColor} />
                <circle cx="34" cy="26" r="2" fill="#333" />
                <circle cx="46" cy="26" r="2" fill="#333" />
                <path d="M 34 33 Q 40 38 46 33" stroke="#333" strokeWidth="1.5" fill="none" />
                <ellipse cx="40" cy="16" rx="16" ry="8" fill={avatar.hairColor} />
              </svg>
            </div>
            {name && <span style={styles.previewName}>{name}</span>}
          </div>

          {/* Color pickers */}
          <div style={styles.section}>
            <label style={styles.label}>Shirt Color</label>
            <div style={styles.colorRow}>
              {SHIRT_COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setAvatar({ ...avatar, shirtColor: color })}
                  style={{
                    ...styles.colorBtn,
                    backgroundColor: color,
                    boxShadow: avatar.shirtColor === color ? `0 0 0 2px #0c0c18, 0 0 0 4px ${color}` : 'none',
                    transform: avatar.shirtColor === color ? 'scale(1.15)' : 'scale(1)',
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
                  onClick={() => setAvatar({ ...avatar, skinColor: color })}
                  style={{
                    ...styles.colorBtn,
                    backgroundColor: color,
                    boxShadow: avatar.skinColor === color ? `0 0 0 2px #0c0c18, 0 0 0 4px ${color}` : 'none',
                    transform: avatar.skinColor === color ? 'scale(1.15)' : 'scale(1)',
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
                  onClick={() => setAvatar({ ...avatar, hairColor: color })}
                  style={{
                    ...styles.colorBtn,
                    backgroundColor: color,
                    boxShadow: avatar.hairColor === color ? `0 0 0 2px #0c0c18, 0 0 0 4px ${color}` : 'none',
                    transform: avatar.hairColor === color ? 'scale(1.15)' : 'scale(1)',
                  }}
                />
              ))}
            </div>
          </div>

          <button
            type="submit"
            style={{
              ...styles.joinBtn,
              opacity: name.trim() ? 1 : 0.5,
              cursor: name.trim() ? 'pointer' : 'default',
            }}
            disabled={!name.trim()}
          >
            Join Office
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: 8 }}>
              <line x1="5" y1="12" x2="19" y2="12" />
              <polyline points="12 5 19 12 12 19" />
            </svg>
          </button>
        </form>
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100vw',
    height: '100vh',
    background: '#0c0c18',
    position: 'relative',
    overflow: 'hidden',
  },
  bgOrb1: {
    position: 'absolute',
    width: '600px',
    height: '600px',
    borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(74,144,217,0.12) 0%, transparent 70%)',
    top: '-200px',
    right: '-100px',
    pointerEvents: 'none',
  },
  bgOrb2: {
    position: 'absolute',
    width: '500px',
    height: '500px',
    borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(123,104,238,0.1) 0%, transparent 70%)',
    bottom: '-150px',
    left: '-100px',
    pointerEvents: 'none',
  },
  card: {
    position: 'relative',
    background: 'rgba(255,255,255,0.04)',
    backdropFilter: 'blur(24px)',
    borderRadius: '20px',
    padding: '40px',
    width: '420px',
    border: '1px solid rgba(255,255,255,0.08)',
    boxShadow: '0 8px 48px rgba(0,0,0,0.4)',
  },
  logoArea: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '12px',
    marginBottom: '8px',
  },
  title: {
    fontSize: '26px',
    fontWeight: 700,
    margin: 0,
    background: 'linear-gradient(135deg, #6BA4E8, #9B8EC8)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
  },
  subtitle: {
    fontSize: '14px',
    color: 'rgba(255,255,255,0.4)',
    textAlign: 'center' as const,
    marginBottom: '28px',
    marginTop: '4px',
  },
  input: {
    width: '100%',
    padding: '13px 16px',
    borderRadius: '12px',
    border: '1px solid rgba(255,255,255,0.1)',
    background: 'rgba(255,255,255,0.04)',
    color: '#fff',
    fontSize: '15px',
    outline: 'none',
    transition: 'border-color 0.2s',
    boxSizing: 'border-box',
  },
  previewContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    margin: '20px 0',
    gap: '8px',
  },
  previewBg: {
    width: '100px',
    height: '100px',
    borderRadius: '20px',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.06)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewName: {
    fontSize: '14px',
    fontWeight: 600,
    color: 'rgba(255,255,255,0.7)',
  },
  section: {
    marginBottom: '18px',
  },
  label: {
    display: 'block',
    fontSize: '11px',
    color: 'rgba(255,255,255,0.35)',
    marginBottom: '10px',
    textTransform: 'uppercase' as const,
    letterSpacing: '1.5px',
    fontWeight: 600,
  },
  colorRow: {
    display: 'flex',
    gap: '10px',
    flexWrap: 'wrap' as const,
  },
  colorBtn: {
    width: '34px',
    height: '34px',
    borderRadius: '10px',
    cursor: 'pointer',
    border: 'none',
    transition: 'transform 0.15s, box-shadow 0.15s',
  },
  joinBtn: {
    width: '100%',
    padding: '14px',
    borderRadius: '12px',
    border: 'none',
    background: 'linear-gradient(135deg, #4A90D9, #6B68D9)',
    color: '#fff',
    fontSize: '15px',
    fontWeight: 600,
    cursor: 'pointer',
    marginTop: '8px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'opacity 0.2s',
    boxShadow: '0 4px 16px rgba(74,144,217,0.3)',
  },
};
