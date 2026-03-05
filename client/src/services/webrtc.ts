import { Socket } from 'socket.io-client';

const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
};

export class WebRTCManager {
  private peers = new Map<string, RTCPeerConnection>();
  private pendingCandidates = new Map<string, RTCIceCandidateInit[]>();
  private _remoteStreamIds = new Map<string, string>();
  private localStream: MediaStream | null = null;
  private screenStream: MediaStream | null = null;
  private socket: Socket;
  private onRemoteStream: (peerId: string, stream: MediaStream) => void;
  private onPeerDisconnected: (peerId: string) => void;
  private onScreenStream: ((peerId: string, stream: MediaStream | null) => void) | null = null;
  private onRemoteMediaState: ((peerId: string, state: { video: boolean; audio: boolean; screen: boolean }) => void) | null = null;

  constructor(
    socket: Socket,
    onRemoteStream: (peerId: string, stream: MediaStream) => void,
    onPeerDisconnected: (peerId: string) => void
  ) {
    this.socket = socket;
    this.onRemoteStream = onRemoteStream;
    this.onPeerDisconnected = onPeerDisconnected;
    this.setupSignaling();
  }

  setScreenStreamCallback(cb: (peerId: string, stream: MediaStream | null) => void): void {
    this.onScreenStream = cb;
  }

  setMediaStateCallback(cb: (peerId: string, state: { video: boolean; audio: boolean; screen: boolean }) => void): void {
    this.onRemoteMediaState = cb;
  }

  private setupSignaling(): void {
    this.socket.on('webrtc:offer', async (data: { from: string; offer: RTCSessionDescriptionInit }) => {
      try {
        const pc = this.getOrCreatePeer(data.from);

        // Handle glare: both peers sent offers simultaneously
        if (pc.signalingState === 'have-local-offer') {
          const isPolite = this.socket.id! < data.from;
          if (!isPolite) return;
          await pc.setLocalDescription({ type: 'rollback' });
        }

        await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
        await this.flushPendingCandidates(data.from, pc);
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        this.socket.emit('webrtc:answer', { to: data.from, answer });

        // After answering, add our local tracks and renegotiate if needed.
        // An answer cannot add new m-sections, so if we have tracks the offerer
        // didn't know about, we must send our own offer.
        if (await this.addLocalTracksToPeer(pc)) {
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          this.socket.emit('webrtc:offer', { to: data.from, offer });
        }
      } catch (err) {
        console.warn('Error handling offer from', data.from, err);
      }
    });

    this.socket.on('webrtc:answer', async (data: { from: string; answer: RTCSessionDescriptionInit }) => {
      const pc = this.peers.get(data.from);
      if (pc) {
        try {
          await pc.setRemoteDescription(new RTCSessionDescription(data.answer));
          await this.flushPendingCandidates(data.from, pc);
        } catch (err) {
          console.warn('Error handling answer from', data.from, err);
        }
      }
    });

    this.socket.on('webrtc:ice-candidate', async (data: { from: string; candidate: RTCIceCandidateInit }) => {
      const pc = this.peers.get(data.from);
      if (!pc) return;

      // Queue candidates that arrive before remote description is set
      if (!pc.remoteDescription) {
        const queue = this.pendingCandidates.get(data.from) || [];
        queue.push(data.candidate);
        this.pendingCandidates.set(data.from, queue);
        return;
      }

      try {
        await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
      } catch (err) {
        console.warn('Failed to add ICE candidate from', data.from, err);
      }
    });

    this.socket.on('webrtc:peer-left', (peerId: string) => {
      this.closePeer(peerId, false); // don't notify back — they already know
      this.onPeerDisconnected(peerId);
    });

    this.socket.on('webrtc:media-state', (data: { from: string; video: boolean; audio: boolean; screen: boolean }) => {
      this.onRemoteMediaState?.(data.from, { video: data.video, audio: data.audio, screen: data.screen });
    });
  }

  private async flushPendingCandidates(peerId: string, pc: RTCPeerConnection): Promise<void> {
    const candidates = this.pendingCandidates.get(peerId);
    if (!candidates) return;
    this.pendingCandidates.delete(peerId);
    for (const candidate of candidates) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (err) {
        console.warn('Failed to add queued ICE candidate for', peerId, err);
      }
    }
  }

  private broadcastMediaState(): void {
    const video = this.localStream?.getVideoTracks().some((t) => t.readyState === 'live') ?? false;
    const audio = this.localStream?.getAudioTracks().some((t) => t.readyState === 'live') ?? false;
    const screen = this.screenStream?.getVideoTracks().some((t) => t.readyState === 'live') ?? false;
    for (const peerId of this.peers.keys()) {
      this.socket.emit('webrtc:media-state', { to: peerId, video, audio, screen });
    }
  }

  /**
   * Add local camera/mic tracks to a peer connection.
   * Uses replaceTrack on existing idle senders when possible (no renegotiation needed).
   * Returns true if addTrack was called (renegotiation IS needed).
   * NOTE: Screen share tracks are handled separately by startScreenShare/addScreenTracksToPeer.
   */
  private async addLocalTracksToPeer(pc: RTCPeerConnection): Promise<boolean> {
    if (!this.localStream) return false;
    let added = false;
    const senders = pc.getSenders();
    for (const track of this.localStream.getTracks()) {
      if (senders.some((s) => s.track?.id === track.id)) continue;

      // Try to reuse a sender that was muted via replaceTrack(null)
      const transceiver = pc.getTransceivers().find(
        (t) => t.sender.track === null && t.receiver.track?.kind === track.kind
      );
      if (transceiver) {
        await transceiver.sender.replaceTrack(track);
      } else {
        pc.addTrack(track, this.localStream!);
        added = true;
      }
    }
    return added;
  }

  /**
   * Add screen share track to a peer connection and renegotiate.
   * Kept separate from addLocalTracksToPeer to avoid ontrack stream overwrite issues.
   */
  private async addScreenTracksToPeer(peerId: string, pc: RTCPeerConnection): Promise<void> {
    if (!this.screenStream) return;
    const screenTrack = this.screenStream.getVideoTracks()[0];
    if (!screenTrack) return;
    if (pc.getSenders().some((s) => s.track?.id === screenTrack.id)) return;

    try {
      pc.addTrack(screenTrack, this.screenStream!);
    } catch (err) {
      console.warn('Failed to add screen track for peer', peerId, err);
      return;
    }

    // Wait for stable state before creating offer
    if (pc.signalingState !== 'stable') {
      await new Promise<void>((resolve) => {
        const check = () => {
          if (pc.signalingState === 'stable') {
            pc.removeEventListener('signalingstatechange', check);
            resolve();
          }
        };
        pc.addEventListener('signalingstatechange', check);
        setTimeout(() => { pc.removeEventListener('signalingstatechange', check); resolve(); }, 2000);
      });
    }

    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      this.socket.emit('webrtc:offer', { to: peerId, offer });
    } catch (err) {
      console.warn('Screen track renegotiation failed for peer', peerId, err);
    }
  }

  async startLocalStream(constraints: { audio: boolean; video: boolean }): Promise<MediaStream> {
    const needAudio = constraints.audio && (!this.localStream || this.localStream.getAudioTracks().length === 0);
    const needVideo = constraints.video && (!this.localStream || this.localStream.getVideoTracks().length === 0);

    if (!needAudio && !needVideo && this.localStream) return this.localStream;

    const mediaConstraints: MediaStreamConstraints = {};
    if (needAudio) mediaConstraints.audio = true;
    if (needVideo) mediaConstraints.video = { width: 160, height: 120, frameRate: 15 };

    if (!mediaConstraints.audio && !mediaConstraints.video) return this.localStream!;

    const newStream = await navigator.mediaDevices.getUserMedia(mediaConstraints);

    if (!this.localStream) {
      this.localStream = newStream;
    } else {
      newStream.getTracks().forEach((track) => {
        this.localStream!.addTrack(track);
      });
    }

    // Add new tracks to all existing peer connections
    const newTracks = newStream.getTracks();
    for (const [peerId, pc] of this.peers.entries()) {
      let needsRenegotiation = false;
      for (const track of newTracks) {
        // Reuse idle sender from replaceTrack(null) if available
        const transceiver = pc.getTransceivers().find(
          (t) => t.sender.track === null && t.receiver.track?.kind === track.kind
        );
        if (transceiver) {
          await transceiver.sender.replaceTrack(track);
        } else {
          const hasSender = pc.getSenders().some((s) => s.track?.id === track.id);
          if (!hasSender) {
            pc.addTrack(track, this.localStream!);
            needsRenegotiation = true;
          }
        }
      }
      if (needsRenegotiation) {
        try {
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          this.socket.emit('webrtc:offer', { to: peerId, offer });
        } catch (err) {
          console.warn('Renegotiation failed for peer', peerId, err);
        }
      }
    }

    this.broadcastMediaState();
    return this.localStream;
  }

  stopLocalStream(): void {
    if (this.localStream) {
      this.localStream.getTracks().forEach((t) => t.stop());
      this.localStream = null;
    }
  }

  async stopAndRemoveLocalStream(): Promise<void> {
    if (!this.localStream) return;

    // Mute all local senders on peers (replaceTrack(null) — no renegotiation needed)
    const trackIds = new Set(this.localStream.getTracks().map((t) => t.id));
    for (const [, pc] of this.peers.entries()) {
      for (const sender of pc.getSenders()) {
        if (sender.track && trackIds.has(sender.track.id)) {
          await sender.replaceTrack(null);
        }
      }
    }

    // Release hardware
    this.localStream.getTracks().forEach((t) => t.stop());
    this.localStream = null;
    this.broadcastMediaState();
  }

  async removeTracksByKind(kind: 'audio' | 'video'): Promise<void> {
    if (!this.localStream) return;

    const tracksToRemove = this.localStream.getTracks().filter((t) => t.kind === kind);
    const trackIds = new Set(tracksToRemove.map((t) => t.id));

    // Mute senders on peers (replaceTrack(null) — remote track fires 'mute')
    for (const [, pc] of this.peers.entries()) {
      for (const sender of pc.getSenders()) {
        if (sender.track && trackIds.has(sender.track.id)) {
          await sender.replaceTrack(null);
        }
      }
    }

    // Stop and remove tracks from local stream
    tracksToRemove.forEach((t) => {
      t.stop();
      this.localStream!.removeTrack(t);
    });

    if (this.localStream.getTracks().length === 0) {
      this.localStream = null;
    }
    this.broadcastMediaState();
  }

  getLocalStream(): MediaStream | null {
    return this.localStream;
  }

  private getOrCreatePeer(peerId: string): RTCPeerConnection {
    let pc = this.peers.get(peerId);
    if (pc) return pc;

    pc = new RTCPeerConnection(ICE_SERVERS);
    this.peers.set(peerId, pc);

    // Tracks are NOT added here — managed by addLocalTracksToPeer / connectToPeer

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        this.socket.emit('webrtc:ice-candidate', { to: peerId, candidate: event.candidate.toJSON() });
      }
    };

    pc.ontrack = (event) => {
      const stream = event.streams[0] || new MediaStream([event.track]);

      // Determine if this is a screen share track or camera track.
      // Screen share tracks arrive on a separate MediaStream.
      // If we already have a camera stream for this peer, a new stream with
      // a different ID is likely the screen share — route it to the screen callback.
      const isNewStream = !this._remoteStreamIds.get(peerId) || this._remoteStreamIds.get(peerId) !== stream.id;
      const existingStreamId = this._remoteStreamIds.get(peerId);

      if (existingStreamId && existingStreamId !== stream.id) {
        // Second stream from same peer → screen share
        this.onScreenStream?.(peerId, stream);
      } else {
        // First stream from peer → camera/mic
        this._remoteStreamIds.set(peerId, stream.id);
        this.onRemoteStream(peerId, stream);
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc!.connectionState === 'disconnected' || pc!.connectionState === 'failed') {
        this.closePeer(peerId);
        this.onPeerDisconnected(peerId);
      }
    };

    return pc;
  }

  async connectToPeer(peerId: string): Promise<void> {
    const pc = this.getOrCreatePeer(peerId);

    // Add local camera/mic tracks (uses replaceTrack for existing idle senders)
    const tracksAdded = await this.addLocalTracksToPeer(pc);

    // Only send offer if we actually have tracks to negotiate.
    // Don't send empty offers — they create fragile state and block later renegotiation.
    if (tracksAdded && pc.signalingState === 'stable') {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      this.socket.emit('webrtc:offer', { to: peerId, offer });
    }

    // If screen share is active, add it as a separate renegotiation
    // (must be separate to avoid ontrack overwriting the camera stream)
    if (this.screenStream) {
      // Wait for the cam/mic offer to complete first
      if (pc.signalingState !== 'stable') {
        await new Promise<void>((resolve) => {
          const check = () => {
            if (pc.signalingState === 'stable') {
              pc.removeEventListener('signalingstatechange', check);
              resolve();
            }
          };
          pc.addEventListener('signalingstatechange', check);
          setTimeout(() => { pc.removeEventListener('signalingstatechange', check); resolve(); }, 3000);
        });
      }
      await this.addScreenTracksToPeer(peerId, pc);
    }
  }

  closePeer(peerId: string, notify = true): void {
    const pc = this.peers.get(peerId);
    if (pc) {
      pc.close();
      this.peers.delete(peerId);
      this.pendingCandidates.delete(peerId);
      this._remoteStreamIds.delete(peerId);
      // Notify remote peer so they clean up immediately (don't wait for ICE timeout)
      if (notify) {
        this.socket.emit('webrtc:peer-leave', { to: peerId });
      }
    }
  }

  disconnectAllPeers(): void {
    // Notify all peers before closing
    for (const peerId of this.peers.keys()) {
      this.socket.emit('webrtc:peer-leave', { to: peerId });
    }
    this.peers.forEach((pc) => pc.close());
    this.peers.clear();
    this.pendingCandidates.clear();
    this._remoteStreamIds.clear();
  }

  closeAll(): void {
    this.disconnectAllPeers();
    this.stopLocalStream();
  }

  isConnectedTo(peerId: string): boolean {
    return this.peers.has(peerId);
  }

  getConnectedPeerIds(): string[] {
    return Array.from(this.peers.keys());
  }

  async startScreenShare(): Promise<MediaStream> {
    this.screenStream = await navigator.mediaDevices.getDisplayMedia({
      video: { width: 1280, height: 720, frameRate: 15 },
      audio: false,
    });

    // Add screen track to all existing peers and renegotiate
    for (const [peerId, pc] of this.peers.entries()) {
      await this.addScreenTracksToPeer(peerId, pc);
    }

    // When user stops sharing via browser UI
    const screenTrack = this.screenStream.getVideoTracks()[0];
    screenTrack.onended = () => {
      this.stopScreenShare();
    };

    this.broadcastMediaState();
    return this.screenStream;
  }

  async stopScreenShare(): Promise<void> {
    if (!this.screenStream) return;

    const screenTrackIds = new Set(this.screenStream.getTracks().map((t) => t.id));

    // Remove screen senders from peers and renegotiate
    for (const [peerId, pc] of this.peers.entries()) {
      let removed = false;
      for (const sender of pc.getSenders()) {
        if (sender.track && screenTrackIds.has(sender.track.id)) {
          try { pc.removeTrack(sender); removed = true; } catch (_) { /* ignore */ }
        }
      }
      if (removed) {
        try {
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          this.socket.emit('webrtc:offer', { to: peerId, offer });
        } catch (err) {
          console.warn('Screen stop renegotiation failed for peer', peerId, err);
        }
      }
    }

    this.screenStream.getTracks().forEach((t) => t.stop());
    this.screenStream = null;
    this.onScreenStream?.('local', null);
    this.broadcastMediaState();
  }

  getScreenStream(): MediaStream | null {
    return this.screenStream;
  }
}
