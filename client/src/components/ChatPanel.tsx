import React, { useState, useRef, useEffect } from 'react';
import type { ChatMessage } from '../types';

interface ChatPanelProps {
  messages: ChatMessage[];
  onSend: (content: string) => void;
  currentPlayerId: string;
}

const SendIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="22" y1="2" x2="11" y2="13" />
    <polygon points="22 2 15 22 11 13 2 9 22 2" />
  </svg>
);

const ChatIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
  </svg>
);

export const ChatPanel: React.FC<ChatPanelProps> = ({ messages, onSend, currentPlayerId }) => {
  const [input, setInput] = useState('');
  const [isCollapsed, setIsCollapsed] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim()) {
      onSend(input.trim());
      setInput('');
    }
  };

  const formatTime = (ts: number) => {
    const d = new Date(ts);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div style={{ ...styles.container, height: isCollapsed ? '42px' : '320px' }}>
      <div style={styles.header} onClick={() => setIsCollapsed(!isCollapsed)}>
        <div style={styles.headerLeft}>
          <ChatIcon />
          <span>Chat</span>
          {messages.length > 0 && (
            <span style={styles.msgCount}>{messages.length}</span>
          )}
        </div>
        <span style={styles.toggle}>{isCollapsed ? '+' : '\u2212'}</span>
      </div>
      {!isCollapsed && (
        <>
          <div style={styles.messages}>
            {messages.length === 0 && (
              <div style={styles.emptyState}>No messages yet. Say hello!</div>
            )}
            {messages.map((msg) => {
              const isMine = msg.senderId === currentPlayerId;
              return (
                <div
                  key={msg.id}
                  style={{
                    ...styles.message,
                    ...(isMine ? styles.myMessage : {}),
                    alignSelf: isMine ? 'flex-end' : 'flex-start',
                  }}
                >
                  <div style={styles.msgHeader}>
                    <span style={{ ...styles.sender, color: isMine ? '#7EB8F0' : '#9B8EC8' }}>{msg.senderName}</span>
                    <span style={styles.time}>{formatTime(msg.timestamp)}</span>
                  </div>
                  <div style={styles.msgContent}>{msg.content}</div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>
          <form onSubmit={handleSubmit} style={styles.inputRow}>
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type a message..."
              style={styles.input}
              maxLength={500}
            />
            <button type="submit" style={styles.sendBtn} disabled={!input.trim()}>
              <SendIcon />
            </button>
          </form>
        </>
      )}
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    position: 'absolute',
    bottom: '16px',
    right: '16px',
    width: '320px',
    background: 'rgba(12,12,24,0.88)',
    backdropFilter: 'blur(16px)',
    borderRadius: '14px',
    border: '1px solid rgba(255,255,255,0.07)',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    transition: 'height 0.25s ease',
    zIndex: 100,
    boxShadow: '0 4px 24px rgba(0,0,0,0.3)',
  },
  header: {
    padding: '10px 16px',
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
  msgCount: {
    fontSize: '10px',
    background: 'rgba(74,144,217,0.2)',
    color: '#7EB8F0',
    padding: '1px 6px',
    borderRadius: '8px',
    fontWeight: 600,
  },
  toggle: {
    fontSize: '16px',
    color: 'rgba(255,255,255,0.35)',
    fontWeight: 300,
  },
  messages: {
    flex: 1,
    overflowY: 'auto',
    padding: '10px 14px',
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  emptyState: {
    textAlign: 'center',
    color: 'rgba(255,255,255,0.2)',
    fontSize: '12px',
    marginTop: '40px',
  },
  message: {
    maxWidth: '85%',
    padding: '8px 12px',
    background: 'rgba(255,255,255,0.04)',
    borderRadius: '10px',
    border: '1px solid rgba(255,255,255,0.03)',
  },
  myMessage: {
    background: 'rgba(74,144,217,0.08)',
    border: '1px solid rgba(74,144,217,0.1)',
  },
  msgHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: '8px',
    marginBottom: '3px',
  },
  sender: {
    fontSize: '11px',
    fontWeight: 600,
  },
  time: {
    fontSize: '10px',
    color: 'rgba(255,255,255,0.25)',
  },
  msgContent: {
    fontSize: '13px',
    color: 'rgba(255,255,255,0.8)',
    wordBreak: 'break-word',
    lineHeight: '1.4',
  },
  inputRow: {
    display: 'flex',
    padding: '10px',
    gap: '8px',
    borderTop: '1px solid rgba(255,255,255,0.05)',
  },
  input: {
    flex: 1,
    padding: '9px 14px',
    borderRadius: '10px',
    border: '1px solid rgba(255,255,255,0.08)',
    background: 'rgba(255,255,255,0.04)',
    color: '#fff',
    fontSize: '13px',
    outline: 'none',
    transition: 'border-color 0.15s',
  },
  sendBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '38px',
    height: '38px',
    borderRadius: '10px',
    border: 'none',
    background: 'linear-gradient(135deg, #4A90D9, #5B6FD9)',
    color: '#fff',
    cursor: 'pointer',
    transition: 'opacity 0.15s',
  },
};
