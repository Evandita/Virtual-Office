import React, { useRef, useEffect } from 'react';

interface VideoOverlayProps {
  localStream: MediaStream | null;
  remoteStreams: Map<string, MediaStream>;
  remoteScreenStreams: Map<string, MediaStream>;
  playerNames: Map<string, string>;
  screenStream: MediaStream | null;
  screenShareLabel: string;
  peerMediaState: Map<string, { video: boolean; audio: boolean; screen: boolean }>;
}

const VideoTile: React.FC<{ stream: MediaStream; name: string; muted?: boolean; large?: boolean; hasVideo?: boolean }> = ({ stream, name, muted = false, large = false, hasVideo = true }) => {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const el = videoRef.current;
    if (el) {
      el.srcObject = stream;
      el.play().catch(() => {});
    }

    const onAddTrack = () => {
      if (el) el.play().catch(() => {});
    };
    stream.addEventListener('addtrack', onAddTrack);
    return () => {
      stream.removeEventListener('addtrack', onAddTrack);
    };
  }, [stream]);

  return (
    <div style={{ ...tileStyles.container, ...(large ? tileStyles.large : {}) }}>
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={muted}
        style={tileStyles.video}
      />
      {!hasVideo && (
        <div style={tileStyles.audioOverlay}>
          <div style={tileStyles.avatarCircle}>{name.charAt(0).toUpperCase()}</div>
        </div>
      )}
      <div style={tileStyles.nameBar}>
        <span style={tileStyles.name}>{name}</span>
      </div>
    </div>
  );
};

export const VideoOverlay: React.FC<VideoOverlayProps> = ({ localStream, remoteStreams, remoteScreenStreams, playerNames, screenStream, screenShareLabel, peerMediaState }) => {
  if (!localStream && remoteStreams.size === 0 && remoteScreenStreams.size === 0 && !screenStream) return null;

  return (
    <div style={styles.container}>
      {screenStream && (
        <VideoTile stream={screenStream} name={screenShareLabel} muted large />
      )}
      {Array.from(remoteScreenStreams.entries()).map(([peerId, stream]) => (
        <VideoTile
          key={`screen-${peerId}`}
          stream={stream}
          name={`${playerNames.get(peerId) || 'Unknown'}'s Screen`}
          large
        />
      ))}
      {localStream && (
        <VideoTile
          stream={localStream}
          name="You"
          muted
          hasVideo={localStream.getVideoTracks().some((t) => t.readyState === 'live')}
        />
      )}
      {Array.from(remoteStreams.entries()).map(([peerId, stream]) => {
        const mediaState = peerMediaState.get(peerId);
        const peerHasVideo = mediaState ? mediaState.video : stream.getVideoTracks().length > 0;
        const peerHasAudio = mediaState ? mediaState.audio : stream.getAudioTracks().length > 0;

        if (!peerHasVideo && !peerHasAudio) return null;

        return (
          <VideoTile
            key={peerId}
            stream={stream}
            name={playerNames.get(peerId) || 'Unknown'}
            hasVideo={peerHasVideo}
          />
        );
      })}
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    position: 'absolute',
    top: '64px',
    right: '16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    zIndex: 100,
  },
};

const tileStyles: Record<string, React.CSSProperties> = {
  container: {
    position: 'relative',
    width: '168px',
    height: '126px',
    borderRadius: '12px',
    overflow: 'hidden',
    border: '1px solid rgba(255,255,255,0.08)',
    background: '#0a0a18',
    boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
  },
  large: {
    width: '320px',
    height: '180px',
    border: '1px solid rgba(46,204,113,0.25)',
  },
  video: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  nameBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: '4px 10px',
    background: 'linear-gradient(transparent, rgba(0,0,0,0.6))',
  },
  name: {
    fontSize: '11px',
    color: '#fff',
    fontWeight: 500,
    textShadow: '0 1px 2px rgba(0,0,0,0.5)',
  },
  audioOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'linear-gradient(135deg, #1a1a2e, #16213e)',
  },
  avatarCircle: {
    width: '48px',
    height: '48px',
    borderRadius: '50%',
    background: 'linear-gradient(135deg, #4A90D9, #7B68EE)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '20px',
    fontWeight: 700,
    color: '#fff',
  },
};
