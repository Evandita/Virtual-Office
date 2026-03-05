import Phaser from 'phaser';
import type { Player, AvatarConfig, Direction, Position, Room, Desk } from '../types';
import { TILE_SIZE, MAP_WIDTH, MAP_HEIGHT, PROXIMITY_RADIUS, ROOMS } from '../types';

function createCollisionMap(): number[][] {
  const map: number[][] = [];
  for (let y = 0; y < MAP_HEIGHT; y++) {
    map[y] = [];
    for (let x = 0; x < MAP_WIDTH; x++) {
      if (x === 0 || y === 0 || x === MAP_WIDTH - 1 || y === MAP_HEIGHT - 1) {
        map[y][x] = 1;
      }
      else if (
        ((x === 2 || x === 10) && y >= 2 && y <= 8) ||
        ((y === 2 || y === 8) && x >= 2 && x <= 10)
      ) {
        if (x === 10 && (y === 5 || y === 6)) map[y][x] = 0;
        else map[y][x] = 1;
      }
      else if (
        ((x === 2 || x === 10) && y >= 10 && y <= 16) ||
        ((y === 10 || y === 16) && x >= 2 && x <= 10)
      ) {
        if (x === 10 && (y === 13 || y === 14)) map[y][x] = 0;
        else map[y][x] = 1;
      }
      else if (
        ((x === 38 || x === 48) && y >= 2 && y <= 10) ||
        ((y === 2 || y === 10) && x >= 38 && x <= 48)
      ) {
        if (x === 38 && (y === 6 || y === 7)) map[y][x] = 0;
        else map[y][x] = 1;
      }
      else if (
        ((x === 38 || x === 43) && y >= 12 && y <= 16) ||
        ((y === 12 || y === 16) && x >= 38 && x <= 43)
      ) {
        if (x === 38 && y === 14) map[y][x] = 0;
        else map[y][x] = 1;
      }
      else if (
        ((x === 44 || x === 48) && y >= 12 && y <= 16) ||
        ((y === 12 || y === 16) && x >= 44 && x <= 48)
      ) {
        if (x === 44 && y === 14) map[y][x] = 0;
        else map[y][x] = 1;
      }
      else {
        map[y][x] = 0;
      }
    }
  }
  return map;
}

interface AvatarSprite {
  container: Phaser.GameObjects.Container;
  body: Phaser.GameObjects.Graphics;
  nameText: Phaser.GameObjects.Text;
  statusDot: Phaser.GameObjects.Graphics;
  proximityCircle: Phaser.GameObjects.Graphics;
  targetX: number;
  targetY: number;
}

// Generate desk positions in the open workspace grid
// Each desk group starts at (15 + col*5) and spans 3 tiles wide
function generateDesks(): Desk[] {
  const desks: Desk[] = [];
  let id = 0;
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 4; col++) {
      const baseX = 15 + col * 5;
      const tileY = 22 + row * 4;
      // 3 desk positions per table (matching the 3-tile wide desk)
      desks.push({ id: `desk-${id++}`, tileX: baseX, tileY });
      desks.push({ id: `desk-${id++}`, tileX: baseX + 1, tileY });
      desks.push({ id: `desk-${id++}`, tileX: baseX + 2, tileY });
    }
  }
  return desks;
}

export class OfficeScene extends Phaser.Scene {
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: { W: Phaser.Input.Keyboard.Key; A: Phaser.Input.Keyboard.Key; S: Phaser.Input.Keyboard.Key; D: Phaser.Input.Keyboard.Key };
  private localAvatar!: AvatarSprite;
  private remoteAvatars = new Map<string, AvatarSprite>();
  private collisionMap!: number[][];
  private localPlayer!: Player;
  private lastEmittedPos = { x: 0, y: 0 };

  // Callbacks
  public onMove?: (position: Position, direction: Direction) => void;
  public onProximityChange?: (nearbyPlayerIds: string[], currentRoom: Room | null) => void;
  public onRoomChange?: (room: Room | null) => void;
  public onDeskClick?: (desk: Desk) => void;

  private remotePlayers = new Map<string, Player>();
  private previousNearby = new Set<string>();
  private currentRoom: Room | null = null;
  private desks: Desk[] = generateDesks();
  private deskGraphics: Phaser.GameObjects.Graphics[] = [];
  private deskNameTexts = new Map<string, Phaser.GameObjects.Text>();
  private proximityZone!: Phaser.GameObjects.Graphics;
  private roomHighlightGraphics!: Phaser.GameObjects.Graphics;

  constructor() {
    super({ key: 'OfficeScene' });
  }

  init(data: { player: Player }): void {
    this.localPlayer = data.player;
  }

  create(): void {
    this.collisionMap = createCollisionMap();

    this.drawOfficeMap();
    this.drawDesksOnMap();

    // Proximity zone indicator drawn under avatars
    this.proximityZone = this.add.graphics();
    this.proximityZone.setDepth(5);

    // Room highlight when inside a room
    this.roomHighlightGraphics = this.add.graphics();
    this.roomHighlightGraphics.setDepth(1);

    this.localAvatar = this.createAvatar(this.localPlayer);

    this.cameras.main.startFollow(this.localAvatar.container, true, 0.1, 0.1);
    this.cameras.main.setZoom(1.5);
    this.cameras.main.setBackgroundColor('#1a1a2e');
    this.cameras.main.setBounds(0, 0, MAP_WIDTH * TILE_SIZE, MAP_HEIGHT * TILE_SIZE);

    this.cursors = this.input.keyboard!.createCursorKeys();
    this.wasd = {
      W: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.W),
      A: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      S: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.S),
      D: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.D),
    };

    // Click on desks to claim/assign
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      const worldPoint = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
      const tileX = Math.floor(worldPoint.x / TILE_SIZE);
      const tileY = Math.floor(worldPoint.y / TILE_SIZE);
      const desk = this.desks.find((d) => d.tileX === tileX && d.tileY === tileY);
      if (desk) {
        this.onDeskClick?.(desk);
      }
    });
  }

  private drawOfficeMap(): void {
    const graphics = this.add.graphics();

    // Floor
    graphics.fillStyle(0x2a2a3e, 1);
    graphics.fillRect(0, 0, MAP_WIDTH * TILE_SIZE, MAP_HEIGHT * TILE_SIZE);

    // Grid lines
    graphics.lineStyle(1, 0x3a3a5e, 0.3);
    for (let x = 0; x <= MAP_WIDTH; x++) {
      graphics.lineBetween(x * TILE_SIZE, 0, x * TILE_SIZE, MAP_HEIGHT * TILE_SIZE);
    }
    for (let y = 0; y <= MAP_HEIGHT; y++) {
      graphics.lineBetween(0, y * TILE_SIZE, MAP_WIDTH * TILE_SIZE, y * TILE_SIZE);
    }

    const roomColors: Record<string, { floor: number; wall: number }> = {
      meetingA: { floor: 0x1e3a5f, wall: 0x4a90d9 },
      meetingB: { floor: 0x1e3a5f, wall: 0x4a90d9 },
      lounge: { floor: 0x2d4a1e, wall: 0x6aaf35 },
      focus1: { floor: 0x4a1e3a, wall: 0xd94a90 },
      focus2: { floor: 0x4a1e3a, wall: 0xd94a90 },
    };

    // Room floors
    graphics.fillStyle(roomColors.meetingA.floor, 1);
    graphics.fillRect(3 * TILE_SIZE, 3 * TILE_SIZE, 7 * TILE_SIZE, 5 * TILE_SIZE);

    graphics.fillStyle(roomColors.meetingB.floor, 1);
    graphics.fillRect(3 * TILE_SIZE, 11 * TILE_SIZE, 7 * TILE_SIZE, 5 * TILE_SIZE);

    graphics.fillStyle(roomColors.lounge.floor, 1);
    graphics.fillRect(39 * TILE_SIZE, 3 * TILE_SIZE, 9 * TILE_SIZE, 7 * TILE_SIZE);

    graphics.fillStyle(roomColors.focus1.floor, 1);
    graphics.fillRect(39 * TILE_SIZE, 13 * TILE_SIZE, 4 * TILE_SIZE, 3 * TILE_SIZE);
    graphics.fillRect(45 * TILE_SIZE, 13 * TILE_SIZE, 3 * TILE_SIZE, 3 * TILE_SIZE);

    // Walls
    for (let y = 0; y < MAP_HEIGHT; y++) {
      for (let x = 0; x < MAP_WIDTH; x++) {
        if (this.collisionMap[y][x] === 1) {
          let wallColor = 0x4a4a6e;
          if (x >= 2 && x <= 10 && y >= 2 && y <= 8) wallColor = roomColors.meetingA.wall;
          else if (x >= 2 && x <= 10 && y >= 10 && y <= 16) wallColor = roomColors.meetingB.wall;
          else if (x >= 38 && x <= 48 && y >= 2 && y <= 10) wallColor = roomColors.lounge.wall;
          else if (x >= 38 && x <= 43 && y >= 12 && y <= 16) wallColor = roomColors.focus1.wall;
          else if (x >= 44 && x <= 48 && y >= 12 && y <= 16) wallColor = roomColors.focus2.wall;

          graphics.fillStyle(wallColor, 1);
          graphics.fillRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
        }
      }
    }

    // Door indicators (bright floor tiles at doors)
    const doorTiles = [
      [10, 5], [10, 6],   // Meeting A door
      [10, 13], [10, 14], // Meeting B door
      [38, 6], [38, 7],   // Lounge door
      [38, 14],            // Focus 1 door
      [44, 14],            // Focus 2 door
    ];
    graphics.fillStyle(0x5a5a7e, 1);
    doorTiles.forEach(([dx, dy]) => {
      graphics.fillRect(dx * TILE_SIZE, dy * TILE_SIZE, TILE_SIZE, TILE_SIZE);
    });

    // Furniture
    this.drawFurniture(graphics);

    // Room labels with icons
    const labelStyle = { fontSize: '10px', color: '#ffffffaa', fontFamily: 'Arial', fontStyle: 'bold' };
    const smallLabelStyle = { fontSize: '8px', color: '#ffffffaa', fontFamily: 'Arial', fontStyle: 'bold' };

    this.add.text(4 * TILE_SIZE, 3 * TILE_SIZE + 4, 'Meeting Room A', labelStyle);
    this.add.text(5 * TILE_SIZE, 4 * TILE_SIZE, 'Sound isolated', { fontSize: '7px', color: '#ffffff55', fontFamily: 'Arial' });

    this.add.text(4 * TILE_SIZE, 11 * TILE_SIZE + 4, 'Meeting Room B', labelStyle);
    this.add.text(5 * TILE_SIZE, 12 * TILE_SIZE, 'Sound isolated', { fontSize: '7px', color: '#ffffff55', fontFamily: 'Arial' });

    this.add.text(40 * TILE_SIZE, 3 * TILE_SIZE + 4, 'Lounge', labelStyle);

    this.add.text(39 * TILE_SIZE + 4, 13 * TILE_SIZE + 4, 'Focus 1', smallLabelStyle);
    this.add.text(45 * TILE_SIZE + 4, 13 * TILE_SIZE + 4, 'Focus 2', smallLabelStyle);

    this.add.text(20 * TILE_SIZE, 20 * TILE_SIZE, 'Open Workspace', { fontSize: '12px', color: '#ffffff44', fontFamily: 'Arial' });
  }

  private drawFurniture(graphics: Phaser.GameObjects.Graphics): void {
    const deskColor = 0x5a4a3a;
    const chairColor = 0x3a3a4e;

    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 4; col++) {
        const dx = (15 + col * 5) * TILE_SIZE;
        const dy = (22 + row * 4) * TILE_SIZE;

        graphics.fillStyle(deskColor, 1);
        graphics.fillRect(dx, dy, TILE_SIZE * 3, TILE_SIZE * 1.5);

        graphics.fillStyle(chairColor, 1);
        graphics.fillRect(dx + 8, dy - 10, 12, 10);
        graphics.fillRect(dx + TILE_SIZE + 8, dy - 10, 12, 10);
        graphics.fillRect(dx + 8, dy + TILE_SIZE * 1.5, 12, 10);
        graphics.fillRect(dx + TILE_SIZE + 8, dy + TILE_SIZE * 1.5, 12, 10);
      }
    }

    // Meeting room tables
    graphics.fillStyle(0x6a5a4a, 1);
    graphics.fillRoundedRect(5 * TILE_SIZE, 4.5 * TILE_SIZE, 3 * TILE_SIZE, 2 * TILE_SIZE, 16);
    graphics.fillRoundedRect(5 * TILE_SIZE, 12.5 * TILE_SIZE, 3 * TILE_SIZE, 2 * TILE_SIZE, 16);

    // Lounge couches
    graphics.fillStyle(0x5a3a5a, 1);
    graphics.fillRoundedRect(40 * TILE_SIZE, 4 * TILE_SIZE, 4 * TILE_SIZE, TILE_SIZE, 8);
    graphics.fillRoundedRect(40 * TILE_SIZE, 7 * TILE_SIZE, 4 * TILE_SIZE, TILE_SIZE, 8);
    graphics.fillStyle(0x6a5a4a, 1);
    graphics.fillRoundedRect(41 * TILE_SIZE, 5.5 * TILE_SIZE, 2 * TILE_SIZE, TILE_SIZE, 8);
  }

  private drawDesksOnMap(): void {
    // Draw desk assignment labels
    this.desks.forEach((desk) => {
      if (desk.assignedName) {
        const text = this.add.text(
          desk.tileX * TILE_SIZE + TILE_SIZE / 2,
          desk.tileY * TILE_SIZE - 4,
          desk.assignedName,
          { fontSize: '7px', color: '#f39c12', fontFamily: 'Arial' }
        ).setOrigin(0.5, 1).setDepth(2);
        this.deskNameTexts.set(desk.id, text);
      }
    });
  }

  updateDeskAssignment(deskId: string, assignedTo: string | undefined, assignedName: string | undefined): void {
    const desk = this.desks.find((d) => d.id === deskId);
    if (!desk) return;
    desk.assignedTo = assignedTo;
    desk.assignedName = assignedName;

    // Update or create label
    const existing = this.deskNameTexts.get(deskId);
    if (assignedName) {
      if (existing) {
        existing.setText(assignedName);
      } else {
        const text = this.add.text(
          desk.tileX * TILE_SIZE + TILE_SIZE / 2,
          desk.tileY * TILE_SIZE - 4,
          assignedName,
          { fontSize: '7px', color: '#f39c12', fontFamily: 'Arial' }
        ).setOrigin(0.5, 1).setDepth(2);
        this.deskNameTexts.set(deskId, text);
      }
    } else if (existing) {
      existing.destroy();
      this.deskNameTexts.delete(deskId);
    }
  }

  getDesks(): Desk[] {
    return this.desks;
  }

  private createAvatar(player: Player): AvatarSprite {
    const container = this.add.container(player.position.x, player.position.y);
    container.setDepth(10);

    const body = this.add.graphics();
    this.drawAvatarGraphics(body, player.avatar, player.direction);

    const nameText = this.add.text(0, -28, player.name, {
      fontSize: '10px',
      color: '#ffffff',
      fontFamily: 'Arial',
      stroke: '#000000',
      strokeThickness: 2,
    }).setOrigin(0.5);

    const statusDot = this.add.graphics();
    this.drawStatusDot(statusDot, player.status);

    const proximityCircle = this.add.graphics();

    container.add([proximityCircle, body, nameText, statusDot]);

    return { container, body, nameText, statusDot, proximityCircle, targetX: player.position.x, targetY: player.position.y };
  }

  private drawAvatarGraphics(graphics: Phaser.GameObjects.Graphics, avatar: AvatarConfig, direction: Direction): void {
    graphics.clear();

    graphics.fillStyle(0x000000, 0.2);
    graphics.fillEllipse(0, 12, 20, 8);

    const shirtColor = parseInt(avatar.shirtColor.replace('#', ''), 16);
    graphics.fillStyle(shirtColor, 1);
    graphics.fillRoundedRect(-8, 0, 16, 14, 3);

    const skinColor = parseInt(avatar.skinColor.replace('#', ''), 16);
    graphics.fillStyle(skinColor, 1);
    graphics.fillCircle(0, -6, 9);

    const hairColor = parseInt(avatar.hairColor.replace('#', ''), 16);
    graphics.fillStyle(hairColor, 1);
    graphics.fillEllipse(0, -12, 18, 8);

    graphics.fillStyle(0x333333, 1);
    if (direction === 'up') {
      // no eyes
    } else if (direction === 'left') {
      graphics.fillCircle(-4, -7, 1.5);
    } else if (direction === 'right') {
      graphics.fillCircle(4, -7, 1.5);
    } else {
      graphics.fillCircle(-3, -6, 1.5);
      graphics.fillCircle(3, -6, 1.5);
    }
  }

  private drawStatusDot(graphics: Phaser.GameObjects.Graphics, status: string): void {
    graphics.clear();
    const colors: Record<string, number> = {
      available: 0x2ecc71,
      busy: 0xe74c3c,
      away: 0xf39c12,
      'in-meeting': 0x9b59b6,
    };
    graphics.fillStyle(colors[status] || 0x2ecc71, 1);
    graphics.fillCircle(10, -20, 4);
    graphics.lineStyle(1, 0xffffff, 0.8);
    graphics.strokeCircle(10, -20, 4);
  }

  addRemotePlayer(player: Player): void {
    if (this.remoteAvatars.has(player.id)) return;
    this.remotePlayers.set(player.id, player);
    const avatar = this.createAvatar(player);
    this.remoteAvatars.set(player.id, avatar);
  }

  removeRemotePlayer(playerId: string): void {
    const avatar = this.remoteAvatars.get(playerId);
    if (avatar) {
      avatar.container.destroy();
      this.remoteAvatars.delete(playerId);
    }
    this.remotePlayers.delete(playerId);
  }

  updateRemotePlayer(id: string, position: Position, direction: Direction): void {
    const avatar = this.remoteAvatars.get(id);
    const player = this.remotePlayers.get(id);
    if (avatar && player) {
      avatar.targetX = position.x;
      avatar.targetY = position.y;
      player.position = position;
      player.direction = direction;
      this.drawAvatarGraphics(avatar.body, player.avatar, direction);
    }
  }

  updatePlayerStatus(id: string, status: string): void {
    const player = this.remotePlayers.get(id);
    if (player) {
      player.status = status as any;
      const avatar = this.remoteAvatars.get(id);
      if (avatar) this.drawStatusDot(avatar.statusDot, status);
    }
  }

  getLocalPosition(): Position {
    return { x: this.localAvatar.container.x, y: this.localAvatar.container.y };
  }

  teleportTo(x: number, y: number): void {
    const tileX = Math.floor(x / TILE_SIZE);
    const tileY = Math.floor(y / TILE_SIZE);
    if (tileX >= 0 && tileX < MAP_WIDTH && tileY >= 0 && tileY < MAP_HEIGHT && this.collisionMap[tileY][tileX] === 0) {
      this.localAvatar.container.x = x;
      this.localAvatar.container.y = y;
      this.localPlayer.position = { x, y };
      this.lastEmittedPos = { x, y };
      this.onMove?.(this.localPlayer.position, this.localPlayer.direction);
    }
  }

  update(_time: number, _delta: number): void {
    if (!this.localAvatar) return;

    const speed = 3;
    let dx = 0;
    let dy = 0;
    let newDir: Direction = this.localPlayer.direction;

    if (this.cursors.left.isDown || this.wasd.A.isDown) { dx = -speed; newDir = 'left'; }
    else if (this.cursors.right.isDown || this.wasd.D.isDown) { dx = speed; newDir = 'right'; }
    if (this.cursors.up.isDown || this.wasd.W.isDown) { dy = -speed; newDir = 'up'; }
    else if (this.cursors.down.isDown || this.wasd.S.isDown) { dy = speed; newDir = 'down'; }

    if (dx !== 0 || dy !== 0) {
      const newX = this.localAvatar.container.x + dx;
      const newY = this.localAvatar.container.y + dy;
      const tileX = Math.floor(newX / TILE_SIZE);
      const tileY = Math.floor(newY / TILE_SIZE);

      if (
        tileX >= 0 && tileX < MAP_WIDTH &&
        tileY >= 0 && tileY < MAP_HEIGHT &&
        this.collisionMap[tileY][tileX] === 0
      ) {
        this.localAvatar.container.x = newX;
        this.localAvatar.container.y = newY;
        this.localPlayer.position = { x: newX, y: newY };
      }

      if (newDir !== this.localPlayer.direction) {
        this.localPlayer.direction = newDir;
        this.drawAvatarGraphics(this.localAvatar.body, this.localPlayer.avatar, newDir);
      }

      const distMoved = Math.abs(newX - this.lastEmittedPos.x) + Math.abs(newY - this.lastEmittedPos.y);
      if (distMoved > 4) {
        this.lastEmittedPos = { x: this.localAvatar.container.x, y: this.localAvatar.container.y };
        this.onMove?.(this.localPlayer.position, this.localPlayer.direction);
      }
    }

    // Interpolate remote avatars
    this.remoteAvatars.forEach((avatar) => {
      const lerpFactor = 0.15;
      avatar.container.x += (avatar.targetX - avatar.container.x) * lerpFactor;
      avatar.container.y += (avatar.targetY - avatar.container.y) * lerpFactor;
    });

    this.checkProximity();
    this.checkRoom();
    this.drawProximityZone();
  }

  private drawProximityZone(): void {
    this.proximityZone.clear();

    // Only show when someone is actually nearby
    if (this.previousNearby.size === 0) return;

    const px = this.localAvatar.container.x;
    const py = this.localAvatar.container.y;
    const radius = PROXIMITY_RADIUS * TILE_SIZE;

    // Draw the proximity bubble around the local player
    this.proximityZone.lineStyle(1.5, 0x4a90d9, 0.25);
    this.proximityZone.strokeCircle(px, py, radius);

    // Fill with very subtle color
    this.proximityZone.fillStyle(0x4a90d9, 0.04);
    this.proximityZone.fillCircle(px, py, radius);

    // Draw connection lines to nearby players
    this.previousNearby.forEach((id) => {
      const remote = this.remoteAvatars.get(id);
      if (remote) {
        this.proximityZone.lineStyle(1, 0x4a90d9, 0.3);
        this.proximityZone.lineBetween(px, py, remote.container.x, remote.container.y);
      }
    });
  }

  private checkRoom(): void {
    const tileX = Math.floor(this.localPlayer.position.x / TILE_SIZE);
    const tileY = Math.floor(this.localPlayer.position.y / TILE_SIZE);

    let foundRoom: Room | null = null;
    for (const room of ROOMS) {
      if (room.id === 'main-hall') continue;
      const b = room.bounds;
      if (tileX >= b.x && tileX < b.x + b.width && tileY >= b.y && tileY < b.y + b.height) {
        foundRoom = room;
        break;
      }
    }

    if (foundRoom?.id !== this.currentRoom?.id) {
      this.currentRoom = foundRoom;
      this.onRoomChange?.(foundRoom);

      // Redraw room highlight
      this.roomHighlightGraphics.clear();
      if (foundRoom && foundRoom.id !== 'main-hall') {
        const b = foundRoom.bounds;
        this.roomHighlightGraphics.lineStyle(2, 0xffffff, 0.15);
        this.roomHighlightGraphics.strokeRect(
          b.x * TILE_SIZE, b.y * TILE_SIZE,
          b.width * TILE_SIZE, b.height * TILE_SIZE
        );
      }
    }
  }

  private checkProximity(): void {
    const nearbyNow = new Set<string>();
    const myX = this.localPlayer.position.x / TILE_SIZE;
    const myY = this.localPlayer.position.y / TILE_SIZE;

    const myRoom = this.currentRoom;

    this.remotePlayers.forEach((player, id) => {
      const px = player.position.x / TILE_SIZE;
      const py = player.position.y / TILE_SIZE;
      const dist = Math.sqrt((myX - px) ** 2 + (myY - py) ** 2);

      // In sound-isolated rooms, only hear people in same room
      if (myRoom && myRoom.soundIsolated) {
        const b = myRoom.bounds;
        const inSameRoom = px >= b.x && px < b.x + b.width && py >= b.y && py < b.y + b.height;
        if (inSameRoom) {
          nearbyNow.add(id);
        }
      } else if (dist <= PROXIMITY_RADIUS) {
        // Check if other player is in a sound-isolated room
        const otherRoom = this.getRoomForTile(px, py);
        if (!otherRoom || !otherRoom.soundIsolated) {
          nearbyNow.add(id);
        }
      }
    });

    const changed =
      nearbyNow.size !== this.previousNearby.size ||
      [...nearbyNow].some((id) => !this.previousNearby.has(id));

    if (changed) {
      this.previousNearby = nearbyNow;
      this.onProximityChange?.(Array.from(nearbyNow), this.currentRoom);
    }
  }

  private getRoomForTile(tx: number, ty: number): Room | null {
    for (const room of ROOMS) {
      if (room.id === 'main-hall') continue;
      const b = room.bounds;
      if (tx >= b.x && tx < b.x + b.width && ty >= b.y && ty < b.y + b.height) {
        return room;
      }
    }
    return null;
  }
}
