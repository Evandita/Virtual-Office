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
      {/* Overlay covers the frozen/black video when peer has no active video */}
      {!hasVideo && (
        <div style={tileStyles.audioOverlay}>{name.charAt(0).toUpperCase()}</div>
      )}
      <span style={tileStyles.name}>{name}</span>
    </div>
  );
};

export const VideoOverlay: React.FC<VideoOverlayProps> = ({ localStream, remoteStreams, remoteScreenStreams, playerNames, screenStream, screenShareLabel, peerMediaState }) => {
  if (!localStream && remoteStreams.size === 0 && remoteScreenStreams.size === 0 && !screenStream) return null;

  return (
    <div style={styles.container}>
      {/* Local screen share */}
      {screenStream && (
        <VideoTile stream={screenStream} name={screenShareLabel} muted large />
      )}
      {/* Remote screen shares */}
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

        // Hide tile entirely if peer has no media at all
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
    top: '56px',
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
    width: '160px',
    height: '120px',
    borderRadius: '8px',
    overflow: 'hidden',
    border: '2px solid rgba(255,255,255,0.15)',
    background: '#000',
  },
  large: {
    width: '320px',
    height: '180px',
    border: '2px solid rgba(46,204,113,0.4)',
  },
  video: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  name: {
    position: 'absolute',
    bottom: '4px',
    left: '8px',
    fontSize: '11px',
    color: '#fff',
    textShadow: '0 1px 3px rgba(0,0,0,0.8)',
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
    fontSize: '32px',
    fontWeight: 700,
    color: 'rgba(255,255,255,0.5)',
    background: '#1a1a2e',
  },
};
