import React, { useState, useRef, useEffect } from 'react';
import type { ChatMessage } from '../types';

interface ChatPanelProps {
  messages: ChatMessage[];
  onSend: (content: string) => void;
  currentPlayerId: string;
}

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
    <div style={{ ...styles.container, height: isCollapsed ? '40px' : '300px' }}>
      <div style={styles.header} onClick={() => setIsCollapsed(!isCollapsed)}>
        <span>Chat</span>
        <span style={styles.toggle}>{isCollapsed ? '+' : '-'}</span>
      </div>
      {!isCollapsed && (
        <>
          <div style={styles.messages}>
            {messages.map((msg) => (
              <div
                key={msg.id}
                style={{
                  ...styles.message,
                  alignSelf: msg.senderId === currentPlayerId ? 'flex-end' : 'flex-start',
                }}
              >
                <div style={styles.msgHeader}>
                  <span style={styles.sender}>{msg.senderName}</span>
                  <span style={styles.time}>{formatTime(msg.timestamp)}</span>
                </div>
                <div style={styles.msgContent}>{msg.content}</div>
              </div>
            ))}
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
            <button type="submit" style={styles.sendBtn}>Send</button>
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
    background: 'rgba(20,20,40,0.92)',
    borderRadius: '12px',
    border: '1px solid rgba(255,255,255,0.1)',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    transition: 'height 0.2s',
    zIndex: 100,
  },
  header: {
    padding: '10px 16px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    cursor: 'pointer',
    fontWeight: 600,
    fontSize: '14px',
    borderBottom: '1px solid rgba(255,255,255,0.06)',
  },
  toggle: {
    fontSize: '18px',
    color: 'rgba(255,255,255,0.5)',
  },
  messages: {
    flex: 1,
    overflowY: 'auto',
    padding: '8px 12px',
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  message: {
    maxWidth: '85%',
    padding: '6px 10px',
    background: 'rgba(255,255,255,0.06)',
    borderRadius: '8px',
  },
  msgHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: '8px',
    marginBottom: '2px',
  },
  sender: {
    fontSize: '11px',
    fontWeight: 600,
    color: '#4A90D9',
  },
  time: {
    fontSize: '10px',
    color: 'rgba(255,255,255,0.3)',
  },
  msgContent: {
    fontSize: '13px',
    color: 'rgba(255,255,255,0.85)',
    wordBreak: 'break-word',
  },
  inputRow: {
    display: 'flex',
    padding: '8px',
    gap: '8px',
    borderTop: '1px solid rgba(255,255,255,0.06)',
  },
  input: {
    flex: 1,
    padding: '8px 12px',
    borderRadius: '6px',
    border: '1px solid rgba(255,255,255,0.15)',
    background: 'rgba(255,255,255,0.06)',
    color: '#fff',
    fontSize: '13px',
    outline: 'none',
  },
  sendBtn: {
    padding: '8px 16px',
    borderRadius: '6px',
    border: 'none',
    background: '#4A90D9',
    color: '#fff',
    fontSize: '13px',
    fontWeight: 600,
    cursor: 'pointer',
  },
};
