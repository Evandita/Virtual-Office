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
      <div style={styles.card}>
        <h1 style={styles.title}>Virtual Office</h1>
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
            <svg width="80" height="80" viewBox="0 0 80 80">
              {/* Body */}
              <rect x="24" y="40" width="32" height="30" rx="4" fill={avatar.shirtColor} />
              {/* Head */}
              <circle cx="40" cy="28" r="16" fill={avatar.skinColor} />
              {/* Eyes */}
              <circle cx="34" cy="26" r="2" fill="#333" />
              <circle cx="46" cy="26" r="2" fill="#333" />
              {/* Smile */}
              <path d="M 34 33 Q 40 38 46 33" stroke="#333" strokeWidth="1.5" fill="none" />
              {/* Hair */}
              <ellipse cx="40" cy="16" rx="16" ry="8" fill={avatar.hairColor} />
            </svg>
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
                  onClick={() => setAvatar({ ...avatar, skinColor: color })}
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
                  onClick={() => setAvatar({ ...avatar, hairColor: color })}
                  style={{
                    ...styles.colorBtn,
                    backgroundColor: color,
                    border: avatar.hairColor === color ? '3px solid #fff' : '3px solid transparent',
                  }}
                />
              ))}
            </div>
          </div>

          <button type="submit" style={styles.joinBtn} disabled={!name.trim()}>
            Join Office
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
    background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
  },
  card: {
    background: 'rgba(255,255,255,0.08)',
    backdropFilter: 'blur(20px)',
    borderRadius: '16px',
    padding: '40px',
    width: '420px',
    border: '1px solid rgba(255,255,255,0.12)',
  },
  title: {
    fontSize: '28px',
    fontWeight: 700,
    textAlign: 'center' as const,
    marginBottom: '8px',
  },
  subtitle: {
    fontSize: '14px',
    color: 'rgba(255,255,255,0.6)',
    textAlign: 'center' as const,
    marginBottom: '24px',
  },
  input: {
    width: '100%',
    padding: '12px 16px',
    borderRadius: '8px',
    border: '1px solid rgba(255,255,255,0.2)',
    background: 'rgba(255,255,255,0.06)',
    color: '#fff',
    fontSize: '16px',
    outline: 'none',
  },
  previewContainer: {
    display: 'flex',
    justifyContent: 'center',
    margin: '20px 0',
  },
  section: {
    marginBottom: '16px',
  },
  label: {
    display: 'block',
    fontSize: '12px',
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
    transition: 'transform 0.15s',
  },
  joinBtn: {
    width: '100%',
    padding: '14px',
    borderRadius: '8px',
    border: 'none',
    background: 'linear-gradient(135deg, #4A90D9, #357ABD)',
    color: '#fff',
    fontSize: '16px',
    fontWeight: 600,
    cursor: 'pointer',
    marginTop: '8px',
  },
};
