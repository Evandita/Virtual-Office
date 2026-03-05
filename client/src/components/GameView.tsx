import React, { useEffect, useRef, useState, useCallback } from 'react';
import Phaser from 'phaser';
import { OfficeScene } from '../game/OfficeScene';
import { connectSocket, disconnectSocket } from '../services/socket';
import { WebRTCManager } from '../services/webrtc';
import { ChatPanel } from './ChatPanel';
import { VideoOverlay } from './VideoOverlay';
import { Toolbar } from './Toolbar';
import { Minimap } from './Minimap';
import { SettingsPanel } from './SettingsPanel';
import type { Player, AvatarConfig, ChatMessage, PlayerStatus, Position, Direction, Room, Desk } from '../types';
import { TILE_SIZE, ROOMS } from '../types';

interface GameViewProps {
  playerName: string;
  avatar: AvatarConfig;
}

export const GameView: React.FC<GameViewProps> = ({ playerName, avatar: initialAvatar }) => {
  const gameContainerRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Phaser.Game | null>(null);
  const sceneRef = useRef<OfficeScene | null>(null);
  const webrtcRef = useRef<WebRTCManager | null>(null);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [status, setStatus] = useState<PlayerStatus>('available');
  const [micEnabled, setMicEnabled] = useState(false);
  const [camEnabled, setCamEnabled] = useState(false);
  const [screenSharing, setScreenSharing] = useState(false);
  const [playerCount, setPlayerCount] = useState(1);
  const [socketId, setSocketId] = useState('');
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
  const [remoteStreams, setRemoteStreams] = useState<Map<string, MediaStream>>(new Map());
  const [playerNames, setPlayerNames] = useState<Map<string, string>>(new Map());
  const [nearbyPlayers, setNearbyPlayers] = useState<string[]>([]);
  const [currentRoom, setCurrentRoom] = useState<Room | null>(null);
  const [avatar, setAvatar] = useState<AvatarConfig>(initialAvatar);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [rooms, setRooms] = useState<Room[]>(ROOMS);
  const getLocalPosition = useCallback(() => {
    return sceneRef.current?.getLocalPosition() ?? null;
  }, []);
  const [remotePlayersMap, setRemotePlayersMap] = useState<Map<string, Player>>(new Map());
  const [peerMediaState, setPeerMediaState] = useState<Map<string, { video: boolean; audio: boolean; screen: boolean }>>(new Map());
  const [remoteScreenStreams, setRemoteScreenStreams] = useState<Map<string, MediaStream>>(new Map());

  // Media preference refs (persist across proximity changes)
  // Start OFF - user must manually enable
  const micPref = useRef(false);
  const camPref = useRef(false);

  useEffect(() => {
    const socket = connectSocket();

    socket.on('connect', () => {
      setSocketId(socket.id!);

      const rtc = new WebRTCManager(
        socket,
        (peerId, stream) => {
          setRemoteStreams((prev) => new Map(prev).set(peerId, stream));
        },
        (peerId) => {
          setRemoteStreams((prev) => { const n = new Map(prev); n.delete(peerId); return n; });
          setRemoteScreenStreams((prev) => { const n = new Map(prev); n.delete(peerId); return n; });
        }
      );
      rtc.setScreenStreamCallback((peerId, stream) => {
        if (stream) {
          setRemoteScreenStreams((prev) => new Map(prev).set(peerId, stream));
        } else {
          setRemoteScreenStreams((prev) => { const n = new Map(prev); n.delete(peerId); return n; });
        }
      });
      rtc.setMediaStateCallback((peerId, state) => {
        setPeerMediaState((prev) => new Map(prev).set(peerId, state));
      });
      webrtcRef.current = rtc;

      socket.emit('player:join', { name: playerName, avatar });
    });

    socket.on('players:list', (players: Player[]) => {
      setPlayerCount(players.length);
      const names = new Map<string, string>();
      const pMap = new Map<string, Player>();
      players.forEach((p) => {
        names.set(p.id, p.name);
        if (p.id !== socket.id) {
          pMap.set(p.id, p);
          sceneRef.current?.addRemotePlayer(p);
        }
      });
      setPlayerNames(names);
      setRemotePlayersMap(pMap);
    });

    socket.on('player:joined', (player: Player) => {
      setPlayerCount((c) => c + 1);
      setPlayerNames((prev) => new Map(prev).set(player.id, player.name));
      setRemotePlayersMap((prev) => new Map(prev).set(player.id, player));
      sceneRef.current?.addRemotePlayer(player);
    });

    socket.on('player:left', (playerId: string) => {
      setPlayerCount((c) => Math.max(1, c - 1));
      setPlayerNames((prev) => { const n = new Map(prev); n.delete(playerId); return n; });
      setRemotePlayersMap((prev) => { const n = new Map(prev); n.delete(playerId); return n; });
      sceneRef.current?.removeRemotePlayer(playerId);
    });

    socket.on('player:moved', (data: { id: string; position: Position; direction: Direction }) => {
      sceneRef.current?.updateRemotePlayer(data.id, data.position, data.direction);
      setRemotePlayersMap((prev) => {
        const n = new Map(prev);
        const p = n.get(data.id);
        if (p) n.set(data.id, { ...p, position: data.position, direction: data.direction });
        return n;
      });
    });

    socket.on('player:status-changed', (data: { id: string; status: PlayerStatus }) => {
      sceneRef.current?.updatePlayerStatus(data.id, data.status);
    });

    socket.on('chat:history', (history: ChatMessage[]) => setMessages(history));
    socket.on('chat:message', (message: ChatMessage) => setMessages((prev) => [...prev, message]));

    // Desk assignment events
    socket.on('desk:assigned' as any, (data: { deskId: string; assignedTo: string; assignedName: string }) => {
      sceneRef.current?.updateDeskAssignment(data.deskId, data.assignedTo, data.assignedName);
    });
    socket.on('desk:unassigned' as any, (data: { deskId: string }) => {
      sceneRef.current?.updateDeskAssignment(data.deskId, undefined, undefined);
    });

    // Room lock events
    socket.on('room:locked' as any, (data: { roomId: string; isLocked: boolean }) => {
      setRooms((prev) => prev.map((r) => r.id === data.roomId ? { ...r, isLocked: data.isLocked } : r));
    });

    // Create Phaser game
    const localPlayer: Player = {
      id: socket.id || 'local',
      name: playerName,
      avatar,
      position: { x: 25 * TILE_SIZE, y: 17 * TILE_SIZE },
      direction: 'down',
      status: 'available',
      roomId: 'main-hall',
    };

    const config: Phaser.Types.Core.GameConfig = {
      type: Phaser.AUTO,
      parent: gameContainerRef.current!,
      width: window.innerWidth,
      height: window.innerHeight,
      backgroundColor: '#1a1a2e',
      scene: OfficeScene,
      physics: { default: 'arcade' },
      scale: {
        mode: Phaser.Scale.RESIZE,
        autoCenter: Phaser.Scale.CENTER_BOTH,
      },
      input: { keyboard: true },
    };

    const game = new Phaser.Game(config);
    gameRef.current = game;
    game.scene.start('OfficeScene', { player: localPlayer });

    const checkScene = setInterval(() => {
      const scene = game.scene.getScene('OfficeScene') as OfficeScene;
      if (scene && scene.scene.isActive()) {
        sceneRef.current = scene;
        clearInterval(checkScene);

        scene.onMove = (position, direction) => {
          socket.emit('player:move', { position, direction });
        };

        scene.onProximityChange = (nearby, room) => {
          setNearbyPlayers(nearby);
        };

        scene.onRoomChange = (room) => {
          setCurrentRoom(room);
        };

        scene.onDeskClick = (desk) => {
          if (desk.assignedTo === socket.id) {
            // Unassign own desk
            socket.emit('desk:toggle' as any, { deskId: desk.id });
          } else if (!desk.assignedTo) {
            // Claim desk
            socket.emit('desk:toggle' as any, { deskId: desk.id });
          }
        };
      }
    }, 100);

    return () => {
      clearInterval(checkScene);
      webrtcRef.current?.closeAll();
      disconnectSocket();
      gameRef.current?.destroy(true);
    };
  }, [playerName]);

  // Handle proximity-based WebRTC connections
  useEffect(() => {
    const rtc = webrtcRef.current;
    if (!rtc) return;

    const handleProximity = async () => {
      if (nearbyPlayers.length > 0) {
        try {
          // Only acquire stream if user has enabled mic or cam
          if (micPref.current || camPref.current) {
            const stream = await rtc.startLocalStream({ audio: micPref.current, video: camPref.current });
            setLocalStream(stream);
          }

          for (const peerId of nearbyPlayers) {
            if (!rtc.isConnectedTo(peerId)) {
              await rtc.connectToPeer(peerId);
            }
          }
        } catch (err) {
          console.warn('Could not access media devices:', err);
        }
      } else {
        // No one nearby - close peer connections but keep local stream
        // so user doesn't have to re-grant permissions
        rtc.disconnectAllPeers();
        setRemoteStreams(new Map());
      }
    };

    handleProximity();
  }, [nearbyPlayers]);

  const handleSendMessage = useCallback((content: string) => {
    const socket = connectSocket();
    socket.emit('chat:send', { content, roomId: currentRoom?.id || 'main-hall' });
  }, [currentRoom]);

  const handleStatusChange = useCallback((newStatus: PlayerStatus) => {
    setStatus(newStatus);
    connectSocket().emit('player:status', newStatus);
  }, []);

  const handleToggleMic = useCallback(async () => {
    const rtc = webrtcRef.current;
    if (!rtc) return;

    const newVal = !micPref.current;
    micPref.current = newVal;
    setMicEnabled(newVal);

    if (newVal) {
      try {
        const stream = await rtc.startLocalStream({ audio: true, video: false });
        setLocalStream(stream);
      } catch (err) {
        console.warn('Could not access microphone:', err);
        micPref.current = false;
        setMicEnabled(false);
      }
    } else {
      if (!camPref.current) {
        rtc.stopAndRemoveLocalStream();
        setLocalStream(null);
      } else {
        await rtc.removeTracksByKind('audio');
        setLocalStream(rtc.getLocalStream());
      }
    }
  }, []);

  const handleToggleCam = useCallback(async () => {
    const rtc = webrtcRef.current;
    if (!rtc) return;

    const newVal = !camPref.current;
    camPref.current = newVal;
    setCamEnabled(newVal);

    if (newVal) {
      try {
        const stream = await rtc.startLocalStream({ audio: false, video: true });
        setLocalStream(stream);
      } catch (err) {
        console.warn('Could not access camera:', err);
        camPref.current = false;
        setCamEnabled(false);
      }
    } else {
      if (!micPref.current) {
        rtc.stopAndRemoveLocalStream();
        setLocalStream(null);
      } else {
        await rtc.removeTracksByKind('video');
        setLocalStream(rtc.getLocalStream());
      }
    }
  }, []);

  const handleToggleScreenShare = useCallback(async () => {
    const rtc = webrtcRef.current;
    if (!rtc) return;

    if (screenSharing) {
      rtc.stopScreenShare();
      setScreenStream(null);
      setScreenSharing(false);
    } else {
      try {
        const stream = await rtc.startScreenShare();
        setScreenStream(stream);
        setScreenSharing(true);
        stream.getVideoTracks()[0].onended = () => {
          setScreenStream(null);
          setScreenSharing(false);
        };
      } catch (err) {
        console.warn('Screen share cancelled or failed:', err);
      }
    }
  }, [screenSharing]);

  const handleTeleport = useCallback((x: number, y: number) => {
    sceneRef.current?.teleportTo(x, y);
  }, []);

  const handleAvatarChange = useCallback((newAvatar: AvatarConfig) => {
    setAvatar(newAvatar);
    // In a full implementation, emit avatar change to server
  }, []);

  const handleToggleRoomLock = useCallback((roomId: string) => {
    setRooms((prev) => prev.map((r) =>
      r.id === roomId ? { ...r, isLocked: !r.isLocked } : r
    ));
    connectSocket().emit('room:lock' as any, { roomId });
  }, []);

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative' }}>
      <div ref={gameContainerRef} style={{ width: '100%', height: '100%' }} />

      <Toolbar
        playerName={playerName}
        status={status}
        onStatusChange={handleStatusChange}
        micEnabled={micEnabled}
        camEnabled={camEnabled}
        screenSharing={screenSharing}
        onToggleMic={handleToggleMic}
        onToggleCam={handleToggleCam}
        onToggleScreenShare={handleToggleScreenShare}
        onOpenSettings={() => setSettingsOpen(true)}
        playerCount={playerCount}
        currentRoom={currentRoom}
      />

      <VideoOverlay
        localStream={localStream}
        remoteStreams={remoteStreams}
        remoteScreenStreams={remoteScreenStreams}
        playerNames={playerNames}
        screenStream={screenStream}
        screenShareLabel={screenSharing ? 'Your Screen' : 'Screen Share'}
        peerMediaState={peerMediaState}
      />

      <Minimap
        getLocalPosition={getLocalPosition}
        remotePlayers={remotePlayersMap}
        onTeleport={handleTeleport}
        currentRoom={currentRoom}
      />

      <ChatPanel
        messages={messages}
        onSend={handleSendMessage}
        currentPlayerId={socketId}
      />

      <SettingsPanel
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        avatar={avatar}
        onAvatarChange={handleAvatarChange}
        playerName={playerName}
        rooms={rooms}
        onToggleRoomLock={handleToggleRoomLock}
      />
    </div>
  );
};
