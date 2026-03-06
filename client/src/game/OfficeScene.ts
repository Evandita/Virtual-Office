import Phaser from 'phaser';
import type { Player, Direction, Position, Room, Desk } from '../types';
import { TILE_SIZE, MAP_WIDTH, MAP_HEIGHT, PROXIMITY_RADIUS, ROOMS } from '../types';
import {
  PALETTE, ROOM_VISUALS, FURNITURE, DECORATIONS, DESK_GRID,
  WORKSPACE_RUG, LOUNGE_RUG, WORKSPACE_LABEL,
  type RoomVisual, type FurnitureItem, type DecorationItem,
  type FurnitureType, type DecorationType,
} from './mapConfig';
import { subscribeMapConfig, getMapConfig, updateMapConfig } from './mapStore';
import {
  generateAvatarSpriteSheet, getAnimFrames, getIdleFrame,
  FRAME_H,
} from './avatarSpriteGen';

// ── Collision map generated from room wall definitions ─────────────────────
function createCollisionMap(rooms: RoomVisual[] = ROOM_VISUALS): number[][] {
  const map: number[][] = [];
  for (let y = 0; y < MAP_HEIGHT; y++) {
    map[y] = [];
    for (let x = 0; x < MAP_WIDTH; x++) {
      if (x === 0 || y === 0 || x === MAP_WIDTH - 1 || y === MAP_HEIGHT - 1) {
        map[y][x] = 1;
      } else {
        map[y][x] = 0;
      }
    }
  }

  for (const rv of rooms) {
    const w = rv.walls;
    for (let x = w.x; x <= w.x + w.w; x++) {
      for (let y = w.y; y <= w.y + w.h; y++) {
        // Only wall edges (top/bottom/left/right of the rect)
        if (x === w.x || x === w.x + w.w || y === w.y || y === w.y + w.h) {
          if (x >= 0 && x < MAP_WIDTH && y >= 0 && y < MAP_HEIGHT) {
            map[y][x] = 1;
          }
        }
      }
    }
    // Carve door openings
    for (const d of rv.doors) {
      if (d.y >= 0 && d.y < MAP_HEIGHT && d.x >= 0 && d.x < MAP_WIDTH) {
        map[d.y][d.x] = 0;
      }
    }
  }

  return map;
}

interface AvatarSprite {
  container: Phaser.GameObjects.Container;
  sprite: Phaser.GameObjects.Sprite;
  shadow: Phaser.GameObjects.Graphics;
  nameText: Phaser.GameObjects.Text;
  statusDot: Phaser.GameObjects.Graphics;
  proximityCircle: Phaser.GameObjects.Graphics;
  textureKey: string;
  targetX: number;
  targetY: number;
  isMoving: boolean;
  lastDir: Direction;
}

function generateDesks(): Desk[] {
  const desks: Desk[] = [];
  let id = 0;
  const g = DESK_GRID;
  for (let row = 0; row < g.rows; row++) {
    for (let col = 0; col < g.cols; col++) {
      const baseX = g.startX + col * g.colSpacing;
      const tileY = g.startY + row * g.rowSpacing;
      for (let d = 0; d < g.deskWidth; d++) {
        desks.push({ id: `desk-${id++}`, tileX: baseX + d, tileY });
      }
    }
  }
  return desks;
}

// Seeded pseudo-random for deterministic decoration sizing
function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

export class OfficeScene extends Phaser.Scene {
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: { W: Phaser.Input.Keyboard.Key; A: Phaser.Input.Keyboard.Key; S: Phaser.Input.Keyboard.Key; D: Phaser.Input.Keyboard.Key };
  private localAvatar!: AvatarSprite;
  private remoteAvatars = new Map<string, AvatarSprite>();
  private collisionMap!: number[][];
  private localPlayer!: Player;
  private lastEmittedPos = { x: 0, y: 0 };

  public onMove?: (position: Position, direction: Direction) => void;
  public onProximityChange?: (nearbyPlayerIds: string[], currentRoom: Room | null) => void;
  public onRoomChange?: (room: Room | null) => void;
  public onDeskClick?: (desk: Desk) => void;

  private remotePlayers = new Map<string, Player>();
  private previousNearby = new Set<string>();
  private currentRoom: Room | null = null;
  private desks: Desk[] = generateDesks();
  private deskNameTexts = new Map<string, Phaser.GameObjects.Text>();
  private proximityZone!: Phaser.GameObjects.Graphics;
  private roomHighlightGraphics!: Phaser.GameObjects.Graphics;
  private animatedObjects: Phaser.GameObjects.Graphics[] = [];
  private mapGraphics!: Phaser.GameObjects.Graphics;
  private mapLabelTexts: Phaser.GameObjects.Text[] = [];
  private unsubMapConfig?: () => void;
  private _pendingRebuild = false;
  // Dynamic config overrides (updated by map editor)
  private dynRooms: RoomVisual[] = ROOM_VISUALS;
  private dynFurniture: FurnitureItem[] = FURNITURE;
  private dynDecorations: DecorationItem[] = DECORATIONS;

  // ── Editor mode state ──
  private _editMode = false;
  private editorGrid!: Phaser.GameObjects.Graphics;
  private editorGhost!: Phaser.GameObjects.Graphics;
  private editorSelect!: Phaser.GameObjects.Graphics;
  private editorHover!: Phaser.GameObjects.Graphics;
  private editorGhostType: string | null = null;
  private editorGhostCategory: 'decoration' | 'furniture' | null = null;
  private editorSelectedIdx = -1;
  private editorSelectedCategory: 'decoration' | 'furniture' | null = null;
  private editorDragging = false;
  private editorDragStart = { x: 0, y: 0 };
  private editorDragItemStart = { x: 0, y: 0 };
  public onEditorSelect?: (category: 'decoration' | 'furniture' | null, index: number, item: DecorationItem | FurnitureItem | null) => void;

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

    this.proximityZone = this.add.graphics();
    this.proximityZone.setDepth(5);

    this.roomHighlightGraphics = this.add.graphics();
    this.roomHighlightGraphics.setDepth(1);

    this.localAvatar = this.createAvatar(this.localPlayer);

    this.cameras.main.startFollow(this.localAvatar.container, true, 0.1, 0.1);
    this.cameras.main.setZoom(1.5);
    this.cameras.main.setBackgroundColor('#0c0c18');
    this.cameras.main.setBounds(0, 0, MAP_WIDTH * TILE_SIZE, MAP_HEIGHT * TILE_SIZE);

    this.cursors = this.input.keyboard!.createCursorKeys();
    this.wasd = {
      W: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.W),
      A: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      S: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.S),
      D: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.D),
    };

    // Disable game keyboard input when an HTML input/textarea is focused
    const disableKeys = () => { this.input.keyboard!.enabled = false; };
    const enableKeys = () => { this.input.keyboard!.enabled = true; };
    document.addEventListener('focusin', (e) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement)?.isContentEditable) {
        disableKeys();
      }
    });
    document.addEventListener('focusout', () => { enableKeys(); });

    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (this._editMode) return; // Skip desk clicks in edit mode
      const worldPoint = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
      const tileX = Math.floor(worldPoint.x / TILE_SIZE);
      const tileY = Math.floor(worldPoint.y / TILE_SIZE);
      const desk = this.desks.find((d) => d.tileX === tileX && d.tileY === tileY);
      if (desk) this.onDeskClick?.(desk);
    });

    this.createAnimatedElements();

    // Editor overlay graphics (always created, only visible in edit mode)
    this.editorGrid = this.add.graphics().setDepth(50).setVisible(false);
    this.editorGhost = this.add.graphics().setDepth(52).setVisible(false);
    this.editorSelect = this.add.graphics().setDepth(51).setVisible(false);
    this.editorHover = this.add.graphics().setDepth(51).setVisible(false);

    // Subscribe to map config changes from the editor
    // Defer rebuild to next frame to avoid destroying objects mid-update
    this.unsubMapConfig = subscribeMapConfig((config) => {
      this.dynRooms = config.rooms;
      this.dynFurniture = config.furniture;
      this.dynDecorations = config.decorations;
      this._pendingRebuild = true;
    });
  }

  /** Rebuild the entire map visuals from current dynamic config */
  rebuildMap(): void {
    // Destroy old map graphics
    this.mapGraphics?.destroy();
    // Destroy old labels
    this.mapLabelTexts.forEach((t) => t.destroy());
    this.mapLabelTexts = [];
    // Destroy old animated objects
    this.animatedObjects.forEach((o) => o.destroy());
    this.animatedObjects = [];
    // Remove all tweens (animated elements use tweens)
    this.tweens.killAll();

    // Rebuild collision map
    this.collisionMap = createCollisionMap(this.dynRooms);

    // Redraw everything
    this.drawOfficeMap();
    this.createAnimatedElements();
  }

  // ── Map drawing ────────────────────────────────────────────────────────
  private drawOfficeMap(): void {
    const g = this.add.graphics();
    this.mapGraphics = g;
    const T = TILE_SIZE;

    // 1. Base floor — single rect fill (no per-tile loop)
    g.fillStyle(PALETTE.floor.base, 1);
    g.fillRect(0, 0, MAP_WIDTH * T, MAP_HEIGHT * T);

    // 2. Alternating tile rows for subtle texture (2 fills per row, not per tile)
    g.fillStyle(PALETTE.floor.alt, 1);
    for (let y = 0; y < MAP_HEIGHT; y++) {
      for (let x = y % 2; x < MAP_WIDTH; x += 2) {
        if (this.collisionMap[y][x] === 0) {
          g.fillRect(x * T, y * T, T, T);
        }
      }
    }

    // 3. Room floors — two rects per room (base + alt checkerboard)
    for (const rv of this.dynRooms) {
      const b = rv.bounds;
      // Fill base
      g.fillStyle(rv.floor.base, 1);
      g.fillRect(b.x * T, b.y * T, b.w * T, b.h * T);
      // Overlay alt tiles for subtle checker
      g.fillStyle(rv.floor.alt, 1);
      for (let ry = 0; ry < b.h; ry++) {
        for (let rx = (ry % 2 === 0 ? 1 : 0); rx < b.w; rx += 2) {
          g.fillRect((b.x + rx) * T, (b.y + ry) * T, T, T);
        }
      }
    }

    // 4. Workspace rug
    const wr = WORKSPACE_RUG;
    g.fillStyle(PALETTE.rug.workspace, 0.3);
    g.fillRoundedRect(wr.x * T, wr.y * T, wr.w * T, wr.h * T, 8);
    g.lineStyle(1, PALETTE.rug.workspace, 0.2);
    g.strokeRoundedRect(wr.x * T, wr.y * T, wr.w * T, wr.h * T, 8);

    // Lounge rug
    const lr = LOUNGE_RUG;
    g.fillStyle(PALETTE.rug.lounge, 0.25);
    g.fillRoundedRect(lr.x * T, lr.y * T, lr.w * T, lr.h * T, 6);

    // 5. Walls — batch by room, only edges
    this.drawWalls(g);

    // 6. Door openings
    this.drawDoors(g);

    // 7. Furniture
    this.drawFurniture(g);

    // 8. Decorations
    this.drawDecorations(g);

    // 9. Labels
    this.drawLabels();
  }

  private drawWalls(g: Phaser.GameObjects.Graphics): void {
    const T = TILE_SIZE;

    // Build a map of which room each wall tile belongs to
    const wallRoom = new Map<string, RoomVisual>();
    for (const rv of this.dynRooms) {
      const w = rv.walls;
      for (let x = w.x; x <= w.x + w.w; x++) {
        for (let y = w.y; y <= w.y + w.h; y++) {
          if (x === w.x || x === w.x + w.w || y === w.y || y === w.y + w.h) {
            wallRoom.set(`${x},${y}`, rv);
          }
        }
      }
    }

    for (let y = 0; y < MAP_HEIGHT; y++) {
      for (let x = 0; x < MAP_WIDTH; x++) {
        if (this.collisionMap[y][x] !== 1) continue;

        const rv = wallRoom.get(`${x},${y}`);
        const wc = rv ? rv.wall : PALETTE.wallOuter;

        g.fillStyle(wc.face, 1);
        g.fillRect(x * T, y * T, T, T);
        g.fillStyle(wc.top, 1);
        g.fillRect(x * T, y * T, T, 3);
        g.fillStyle(wc.edge, 0.2);
        g.fillRect(x * T, y * T, 2, T);
      }
    }
  }

  private drawDoors(g: Phaser.GameObjects.Graphics): void {
    const T = TILE_SIZE;
    for (const rv of this.dynRooms) {
      for (const d of rv.doors) {
        g.fillStyle(PALETTE.door.fill, 1);
        g.fillRect(d.x * T, d.y * T, T, T);
        g.fillStyle(PALETTE.door.glow, 0.1);
        g.fillRect(d.x * T - 2, d.y * T - 2, T + 4, T + 4);
      }
    }
  }

  private drawFurniture(g: Phaser.GameObjects.Graphics): void {
    const T = TILE_SIZE;

    for (const f of this.dynFurniture) {
      const px = f.x * T;
      const py = f.y * T;

      switch (f.type) {
        case 'meeting-table': {
          const tw = (f.w ?? 3) * T;
          const th = (f.h ?? 2) * T;
          // Shadow
          g.fillStyle(0x000000, 0.12);
          g.fillEllipse(px + tw / 2 + 2, py + th / 2 + 2, tw - 8, th - 8);
          // Surface
          g.fillStyle(0x4a3e32, 1);
          g.fillEllipse(px + tw / 2, py + th / 2, tw - 8, th - 8);
          // Highlight
          g.fillStyle(0x5a4e42, 0.4);
          g.fillEllipse(px + tw / 2 - 4, py + th / 2 - 4, tw * 0.55, th * 0.4);
          // Chairs around table
          const cx = px + tw / 2;
          const cy = py + th / 2;
          const chairAngles = [0, Math.PI / 3, Math.PI * 2 / 3, Math.PI, Math.PI * 4 / 3, Math.PI * 5 / 3];
          for (const angle of chairAngles) {
            const chairX = cx + Math.cos(angle) * (tw / 2 + 4);
            const chairY = cy + Math.sin(angle) * (th / 2 + 4);
            g.fillStyle(0x38384e, 1);
            g.fillCircle(chairX, chairY, 5);
            g.fillStyle(0x42425a, 1);
            g.fillCircle(chairX, chairY, 3.5);
          }
          break;
        }
        case 'couch': {
          const cw = (f.w ?? 4) * T;
          g.fillStyle(0x3a2a3a, 1);
          g.fillRoundedRect(px, py, cw, T * 0.8, 5);
          // Cushion highlight
          g.fillStyle(0x4a3a4a, 0.5);
          g.fillRoundedRect(px + 4, py + 3, cw - 8, 5, 3);
          break;
        }
        case 'coffee-table': {
          const tw = (f.w ?? 2) * T;
          g.fillStyle(0x000000, 0.08);
          g.fillRoundedRect(px + 2, py + 2, tw, T * 0.7, 5);
          g.fillStyle(0x4a3e32, 1);
          g.fillRoundedRect(px, py, tw, T * 0.7, 5);
          g.fillStyle(0x5a4e42, 0.4);
          g.fillRoundedRect(px + 3, py + 2, tw - 6, 3, 2);
          break;
        }
        case 'focus-desk': {
          const dw = (f.w ?? 2) * T;
          g.fillStyle(0x000000, 0.1);
          g.fillRoundedRect(px + 2, py + 2, dw, T * 0.8, 3);
          g.fillStyle(0x3e3434, 1);
          g.fillRoundedRect(px, py, dw, T * 0.8, 3);
          // Monitor
          g.fillStyle(0x28283a, 1);
          g.fillRoundedRect(px + T * 0.4, py + 3, T * 0.6, T * 0.4, 2);
          g.fillStyle(0x3a5a7a, 0.5);
          g.fillRect(px + T * 0.45, py + 5, T * 0.5, T * 0.25);
          break;
        }
      }
    }

    // Workspace desk groups from grid config
    const dg = DESK_GRID;
    for (let row = 0; row < dg.rows; row++) {
      for (let col = 0; col < dg.cols; col++) {
        const dx = (dg.startX + col * dg.colSpacing) * T;
        const dy = (dg.startY + row * dg.rowSpacing) * T;
        const dw = dg.deskWidth * T;
        const dh = T * 1.2;

        // Shadow
        g.fillStyle(0x000000, 0.1);
        g.fillRoundedRect(dx + 2, dy + 2, dw, dh, 4);

        // Desk surface
        g.fillStyle(0x4a3e32, 1);
        g.fillRoundedRect(dx, dy, dw, dh, 4);
        // Top edge highlight
        g.fillStyle(0x5a4e42, 1);
        g.fillRoundedRect(dx + 2, dy + 1, dw - 4, 3, 2);

        // Two monitors centered on desk
        const monW = T * 0.5;
        const monH = T * 0.35;
        const mon1X = dx + dw * 0.25 - monW / 2;
        const mon2X = dx + dw * 0.6 - monW / 2;
        const monY = dy + 5;
        g.fillStyle(0x28283a, 1);
        g.fillRoundedRect(mon1X, monY, monW, monH, 2);
        g.fillRoundedRect(mon2X, monY, monW, monH, 2);
        g.fillStyle(0x3a5a7a, 0.5);
        g.fillRect(mon1X + 2, monY + 2, monW - 4, monH - 4);
        g.fillRect(mon2X + 2, monY + 2, monW - 4, monH - 4);

        // Chairs — 2 above, 2 below, evenly spaced
        const chairSpacing = dw / 3;
        for (let ci = 1; ci <= 2; ci++) {
          const chairX = dx + chairSpacing * ci;
          // Above
          g.fillStyle(0x38384e, 1);
          g.fillCircle(chairX, dy - 6, 5);
          g.fillStyle(0x42425a, 1);
          g.fillCircle(chairX, dy - 6, 3.5);
          // Below
          g.fillStyle(0x38384e, 1);
          g.fillCircle(chairX, dy + dh + 6, 5);
          g.fillStyle(0x42425a, 1);
          g.fillCircle(chairX, dy + dh + 6, 3.5);
        }
      }
    }
  }

  private drawDecorations(g: Phaser.GameObjects.Graphics): void {
    const T = TILE_SIZE;
    const rand = seededRandom(42);

    for (const dec of this.dynDecorations) {
      const px = dec.x * T;
      const py = dec.y * T;

      switch (dec.type) {
        case 'plant': {
          // Pot
          g.fillStyle(0x6e4e32, 1);
          g.fillRoundedRect(px + T * 0.25, py + T * 0.55, T * 0.5, T * 0.35, 3);
          g.fillStyle(0x5e4228, 1);
          g.fillRect(px + T * 0.2, py + T * 0.5, T * 0.6, 4);
          // Leaves — simple overlapping circles
          const leafC = [0x2a5a2a, 0x346834, 0x3e783e];
          for (let i = 0; i < 4; i++) {
            const angle = (i / 4) * Math.PI * 2 + 0.3;
            const lx = px + T * 0.5 + Math.cos(angle) * 5;
            const ly = py + T * 0.35 + Math.sin(angle) * 3;
            g.fillStyle(leafC[i % 3], 0.85);
            g.fillCircle(lx, ly, 4);
          }
          g.fillStyle(0x4a8a4a, 0.7);
          g.fillCircle(px + T * 0.5, py + T * 0.3, 3);
          break;
        }
        case 'whiteboard': {
          const ww = (dec.w ?? 3) * T;
          g.fillStyle(0xc8c8c8, 1);
          g.fillRoundedRect(px, py + 4, ww, T * 0.5, 3);
          g.lineStyle(1, 0x888888, 0.4);
          g.strokeRoundedRect(px, py + 4, ww, T * 0.5, 3);
          // Content lines
          g.lineStyle(1, 0x4a80b8, 0.25);
          g.lineBetween(px + 6, py + 12, px + ww - 10, py + 12);
          g.lineBetween(px + 6, py + 18, px + ww * 0.7, py + 18);
          break;
        }
        case 'tv-screen': {
          const tw = (dec.w ?? 3) * T;
          g.fillStyle(0x1a1a28, 1);
          g.fillRoundedRect(px, py + 4, tw, T * 0.55, 3);
          g.fillStyle(0x2a4a3a, 0.35);
          g.fillRect(px + 3, py + 7, tw - 6, T * 0.35);
          g.lineStyle(1, 0x444444, 0.4);
          g.strokeRoundedRect(px, py + 4, tw, T * 0.55, 3);
          break;
        }
        case 'water-cooler': {
          g.fillStyle(0x6a8a9a, 1);
          g.fillRoundedRect(px + T * 0.2, py + T * 0.15, T * 0.6, T * 0.7, 3);
          g.fillStyle(0x5a7a8a, 1);
          g.fillRoundedRect(px + T * 0.25, py + T * 0.2, T * 0.5, T * 0.25, 2);
          g.fillStyle(0x8aacbb, 0.3);
          g.fillRect(px + T * 0.3, py + T * 0.22, T * 0.25, T * 0.1);
          break;
        }
        case 'bookshelf': {
          const bw = (dec.w ?? 4) * T;
          g.fillStyle(0x4a3428, 1);
          g.fillRoundedRect(px, py + 4, bw, T * 0.6, 3);
          // Books — deterministic sizing
          const bookColors = [0xc04040, 0x3080b0, 0x30a050, 0xc09030, 0x8050a0, 0x20a080];
          let bx = px + 4;
          for (let i = 0; i < 12 && bx < px + bw - 6; i++) {
            const bWidth = 5 + Math.floor(rand() * 4);
            g.fillStyle(bookColors[i % bookColors.length], 0.7);
            g.fillRect(bx, py + 7, bWidth, T * 0.5 - 3);
            bx += bWidth + 2;
          }
          break;
        }
        case 'bulletin-board': {
          const bw = (dec.w ?? 2) * T;
          g.fillStyle(0x5a4a30, 1);
          g.fillRoundedRect(px, py + 4, bw, T * 0.55, 3);
          const stickyColors = [0xe8d860, 0x70c8d8, 0xd880a0, 0x88c888];
          for (let i = 0; i < 4; i++) {
            g.fillStyle(stickyColors[i], 0.6);
            g.fillRect(px + 5 + i * (bw / 4 - 1), py + 9, bw / 4 - 4, 10);
          }
          break;
        }
        case 'lamp': {
          // Floor lamp — pole + shade + glow
          g.fillStyle(0x888888, 0.6);
          g.fillRect(px + T * 0.45, py + T * 0.3, 3, T * 0.6);
          // Base
          g.fillStyle(0x666666, 0.7);
          g.fillEllipse(px + T * 0.5, py + T * 0.85, T * 0.4, T * 0.15);
          // Shade
          g.fillStyle(0xe8d888, 0.5);
          g.fillEllipse(px + T * 0.5, py + T * 0.25, T * 0.45, T * 0.25);
          // Warm glow
          g.fillStyle(0xffe8a0, 0.06);
          g.fillCircle(px + T * 0.5, py + T * 0.5, T * 0.8);
          break;
        }
        case 'clock': {
          // Wall clock
          g.fillStyle(0x444460, 1);
          g.fillCircle(px + T * 0.5, py + T * 0.5, T * 0.35);
          g.fillStyle(0xdddddd, 0.9);
          g.fillCircle(px + T * 0.5, py + T * 0.5, T * 0.28);
          // Hour hand
          g.lineStyle(2, 0x333333, 0.8);
          g.lineBetween(px + T * 0.5, py + T * 0.5, px + T * 0.5 + 4, py + T * 0.5 - 3);
          // Minute hand
          g.lineStyle(1, 0x333333, 0.6);
          g.lineBetween(px + T * 0.5, py + T * 0.5, px + T * 0.5 - 2, py + T * 0.5 - 6);
          // Center dot
          g.fillStyle(0x333333, 1);
          g.fillCircle(px + T * 0.5, py + T * 0.5, 1.5);
          break;
        }
        case 'printer': {
          // Office printer/copier
          g.fillStyle(0x555566, 1);
          g.fillRoundedRect(px + T * 0.1, py + T * 0.25, T * 0.8, T * 0.55, 3);
          // Paper tray
          g.fillStyle(0xcccccc, 0.6);
          g.fillRect(px + T * 0.2, py + T * 0.35, T * 0.6, T * 0.1);
          // Control panel
          g.fillStyle(0x3a8a5a, 0.5);
          g.fillRect(px + T * 0.55, py + T * 0.5, T * 0.2, T * 0.08);
          // Status LED
          g.fillStyle(0x44cc66, 0.8);
          g.fillCircle(px + T * 0.7, py + T * 0.65, 1.5);
          break;
        }
        case 'trash-bin': {
          g.fillStyle(0x555555, 0.7);
          g.fillRoundedRect(px + T * 0.3, py + T * 0.4, T * 0.4, T * 0.45, 2);
          // Rim
          g.fillStyle(0x666666, 0.8);
          g.fillRect(px + T * 0.25, py + T * 0.38, T * 0.5, 3);
          break;
        }
        case 'rug-round': {
          g.fillStyle(0x3a3050, 0.2);
          g.fillCircle(px + T * 0.5, py + T * 0.5, T * 0.9);
          g.lineStyle(1, 0x4a4068, 0.15);
          g.strokeCircle(px + T * 0.5, py + T * 0.5, T * 0.9);
          g.lineStyle(1, 0x4a4068, 0.1);
          g.strokeCircle(px + T * 0.5, py + T * 0.5, T * 0.6);
          break;
        }
        case 'wall-art': {
          // Small framed picture on wall
          g.fillStyle(0x4a3e32, 1);
          g.fillRoundedRect(px + T * 0.1, py + T * 0.15, T * 0.8, T * 0.6, 2);
          // Canvas
          const artColors = [0x3a6888, 0x885a3a, 0x3a8858, 0x7a3a88];
          const colorIdx = Math.floor((dec.x * 7 + dec.y * 13) % artColors.length);
          g.fillStyle(artColors[colorIdx], 0.6);
          g.fillRect(px + T * 0.18, py + T * 0.22, T * 0.64, T * 0.46);
          // Abstract detail
          g.fillStyle(0xffffff, 0.1);
          g.fillCircle(px + T * 0.5, py + T * 0.4, T * 0.15);
          break;
        }
      }
    }
  }

  private drawLabels(): void {
    const T = TILE_SIZE;
    const labelStyle: Phaser.Types.GameObjects.Text.TextStyle = {
      fontSize: '10px', color: '#ffffffbb', fontFamily: 'Inter, Arial, sans-serif', fontStyle: 'bold',
    };
    const subStyle: Phaser.Types.GameObjects.Text.TextStyle = {
      fontSize: '7px', color: '#ffffff38', fontFamily: 'Inter, Arial, sans-serif',
    };

    for (const rv of this.dynRooms) {
      const b = rv.bounds;
      this.mapLabelTexts.push(this.add.text(b.x * T + 4, b.y * T + 4, rv.label, labelStyle));
      if (rv.subLabel) {
        this.mapLabelTexts.push(this.add.text(b.x * T + 4, b.y * T + 16, rv.subLabel, subStyle));
      }
    }

    const wl = WORKSPACE_LABEL;
    this.mapLabelTexts.push(this.add.text(wl.x * T, wl.y * T, wl.text, {
      fontSize: '11px', color: '#ffffff28', fontFamily: 'Inter, Arial, sans-serif', fontStyle: 'bold',
      letterSpacing: 3,
    }));
  }

  // ── Animated environment elements ───────────────────────────────────────
  private createAnimatedElements(): void {
    const T = TILE_SIZE;

    // Animated TV screens — subtle color cycling glow
    for (const dec of this.dynDecorations) {
      if (dec.type === 'tv-screen') {
        const tw = (dec.w ?? 3) * T;
        const glow = this.add.graphics();
        glow.setDepth(3);
        glow.setAlpha(0.3);
        const px = dec.x * T;
        const py = dec.y * T;
        glow.fillStyle(0x2a6a5a, 1);
        glow.fillRect(px + 3, py + 7, tw - 6, T * 0.35);
        this.animatedObjects.push(glow);

        this.tweens.add({
          targets: glow,
          alpha: { from: 0.15, to: 0.45 },
          duration: 2000,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut',
        });
      }

      // Animated plants — gentle sway
      if (dec.type === 'plant') {
        const plantTop = this.add.graphics();
        plantTop.setDepth(3);
        const px = dec.x * T + T * 0.5;
        const py = dec.y * T + T * 0.25;
        plantTop.fillStyle(0x4a8a4a, 0.4);
        plantTop.fillCircle(0, 0, 5);
        plantTop.fillStyle(0x3a7a3a, 0.3);
        plantTop.fillCircle(-3, 2, 4);
        plantTop.fillCircle(3, 2, 4);
        plantTop.setPosition(px, py);
        this.animatedObjects.push(plantTop);

        this.tweens.add({
          targets: plantTop,
          x: { from: px - 0.8, to: px + 0.8 },
          duration: 2500 + Math.random() * 1500,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut',
        });
      }

      // Water cooler — bubble effect
      if (dec.type === 'water-cooler') {
        const bubble = this.add.graphics();
        bubble.setDepth(3);
        const px = dec.x * T + T * 0.5;
        const py = dec.y * T + T * 0.3;
        bubble.fillStyle(0xaaccee, 0.4);
        bubble.fillCircle(0, 0, 2);
        bubble.setPosition(px, py);
        this.animatedObjects.push(bubble);

        this.tweens.add({
          targets: bubble,
          y: { from: py, to: py - 6 },
          alpha: { from: 0.5, to: 0 },
          duration: 2000,
          repeat: -1,
          ease: 'Sine.easeOut',
        });
      }
    }

    // Workspace monitor screen flicker — subtle blue glow on desk monitors
    const dg = DESK_GRID;
    for (let row = 0; row < dg.rows; row++) {
      for (let col = 0; col < dg.cols; col++) {
        const dx = (dg.startX + col * dg.colSpacing) * T;
        const dy = (dg.startY + row * dg.rowSpacing) * T;
        const dw = dg.deskWidth * T;
        const monW = T * 0.5;
        const monH = T * 0.35;
        const mon1X = dx + dw * 0.25 - monW / 2;
        const mon2X = dx + dw * 0.6 - monW / 2;
        const monY = dy + 5;

        const glow = this.add.graphics();
        glow.setDepth(3);
        glow.fillStyle(0x3a6a9a, 1);
        glow.fillRect(mon1X + 2, monY + 2, monW - 4, monH - 4);
        glow.fillRect(mon2X + 2, monY + 2, monW - 4, monH - 4);
        glow.setAlpha(0.2);
        this.animatedObjects.push(glow);

        this.tweens.add({
          targets: glow,
          alpha: { from: 0.1, to: 0.35 },
          duration: 3000 + Math.random() * 2000,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut',
        });
      }
    }
  }

  // ── Desk labels ──────────────────────────────────────────────────────────
  private drawDesksOnMap(): void {
    this.desks.forEach((desk) => {
      if (desk.assignedName) {
        const text = this.add.text(
          desk.tileX * TILE_SIZE + TILE_SIZE / 2,
          desk.tileY * TILE_SIZE - 4,
          desk.assignedName,
          { fontSize: '7px', color: '#f0b952', fontFamily: 'Arial' }
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

    const existing = this.deskNameTexts.get(deskId);
    if (assignedName) {
      if (existing) {
        existing.setText(assignedName);
      } else {
        const text = this.add.text(
          desk.tileX * TILE_SIZE + TILE_SIZE / 2,
          desk.tileY * TILE_SIZE - 4,
          assignedName,
          { fontSize: '7px', color: '#f0b952', fontFamily: 'Arial' }
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

  // ── Avatars ──────────────────────────────────────────────────────────────
  private spriteKeyCounter = 0;

  private createAvatar(player: Player): AvatarSprite {
    const textureKey = `avatar-${player.id}-${this.spriteKeyCounter++}`;
    generateAvatarSpriteSheet(this, textureKey, player.avatar);

    // Create walk/idle animations for this texture
    const dirs: Direction[] = ['down', 'left', 'right', 'up'];
    for (const dir of dirs) {
      const walkKey = `${textureKey}-walk-${dir}`;
      const frames = getAnimFrames(dir);
      if (!this.anims.exists(walkKey)) {
        this.anims.create({
          key: walkKey,
          frames: frames.map(f => ({ key: textureKey, frame: f })),
          frameRate: 8,
          repeat: -1,
        });
      }
    }

    const container = this.add.container(player.position.x, player.position.y);
    container.setDepth(10);

    // Shadow
    const shadow = this.add.graphics();
    shadow.fillStyle(0x000000, 0.2);
    shadow.fillEllipse(0, FRAME_H / 2 - 3, 20, 8);

    // Sprite
    const sprite = this.add.sprite(0, 0, textureKey, getIdleFrame(player.direction));
    sprite.setOrigin(0.5, 0.5);

    const nameText = this.add.text(0, -FRAME_H / 2 - 4, player.name, {
      fontSize: '10px', color: '#ffffff', fontFamily: 'Arial',
      stroke: '#000000', strokeThickness: 2,
    }).setOrigin(0.5);

    const statusDot = this.add.graphics();
    this.drawStatusDot(statusDot, player.status);

    const proximityCircle = this.add.graphics();
    container.add([proximityCircle, shadow, sprite, nameText, statusDot]);

    return {
      container, sprite, shadow, nameText, statusDot, proximityCircle, textureKey,
      targetX: player.position.x, targetY: player.position.y,
      isMoving: false, lastDir: player.direction,
    };
  }

  private setAvatarDirection(avatar: AvatarSprite, direction: Direction, moving: boolean): void {
    if (moving) {
      const walkKey = `${avatar.textureKey}-walk-${direction}`;
      if (!avatar.isMoving || avatar.lastDir !== direction) {
        avatar.sprite.play(walkKey, true);
      }
      avatar.isMoving = true;
    } else {
      if (avatar.isMoving || avatar.lastDir !== direction) {
        avatar.sprite.stop();
        avatar.sprite.setFrame(getIdleFrame(direction));
      }
      avatar.isMoving = false;
    }
    avatar.lastDir = direction;
  }

  private drawStatusDot(graphics: Phaser.GameObjects.Graphics, status: string): void {
    graphics.clear();
    const colors: Record<string, number> = {
      available: 0x2ecc71, busy: 0xe74c3c, away: 0xf39c12, 'in-meeting': 0x9b59b6,
    };
    graphics.fillStyle(colors[status] || 0x2ecc71, 1);
    graphics.fillCircle(10, -20, 4);
    graphics.lineStyle(1, 0xffffff, 0.8);
    graphics.strokeCircle(10, -20, 4);
  }

  // ── Remote player management ─────────────────────────────────────────────
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
      const wasMoving = avatar.targetX !== position.x || avatar.targetY !== position.y;
      avatar.targetX = position.x;
      avatar.targetY = position.y;
      player.position = position;
      player.direction = direction;
      this.setAvatarDirection(avatar, direction, wasMoving);
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

  // ── Game loop ────────────────────────────────────────────────────────────
  update(_time: number, _delta: number): void {
    if (!this.localAvatar) return;

    if (this._pendingRebuild) {
      this._pendingRebuild = false;
      this.rebuildMap();
    }

    const speed = 3;
    let dx = 0;
    let dy = 0;
    let newDir: Direction = this.localPlayer.direction;

    if (this.cursors.left.isDown || this.wasd.A.isDown) { dx = -speed; newDir = 'left'; }
    else if (this.cursors.right.isDown || this.wasd.D.isDown) { dx = speed; newDir = 'right'; }
    if (this.cursors.up.isDown || this.wasd.W.isDown) { dy = -speed; newDir = 'up'; }
    else if (this.cursors.down.isDown || this.wasd.S.isDown) { dy = speed; newDir = 'down'; }

    const isMoving = dx !== 0 || dy !== 0;

    if (isMoving) {
      const newX = this.localAvatar.container.x + dx;
      const newY = this.localAvatar.container.y + dy;
      const tileX = Math.floor(newX / TILE_SIZE);
      const tileY = Math.floor(newY / TILE_SIZE);

      if (tileX >= 0 && tileX < MAP_WIDTH && tileY >= 0 && tileY < MAP_HEIGHT && this.collisionMap[tileY][tileX] === 0) {
        this.localAvatar.container.x = newX;
        this.localAvatar.container.y = newY;
        this.localPlayer.position = { x: newX, y: newY };
      }

      this.localPlayer.direction = newDir;

      const distMoved = Math.abs(newX - this.lastEmittedPos.x) + Math.abs(newY - this.lastEmittedPos.y);
      if (distMoved > 4) {
        this.lastEmittedPos = { x: this.localAvatar.container.x, y: this.localAvatar.container.y };
        this.onMove?.(this.localPlayer.position, this.localPlayer.direction);
      }
    }

    // Update local avatar animation
    this.setAvatarDirection(this.localAvatar, this.localPlayer.direction, isMoving);

    // Interpolate remote avatars & stop walk anim when arrived
    this.remoteAvatars.forEach((avatar) => {
      avatar.container.x += (avatar.targetX - avatar.container.x) * 0.15;
      avatar.container.y += (avatar.targetY - avatar.container.y) * 0.15;
      const stillMoving = Math.abs(avatar.container.x - avatar.targetX) > 0.5 || Math.abs(avatar.container.y - avatar.targetY) > 0.5;
      if (!stillMoving && avatar.isMoving) {
        this.setAvatarDirection(avatar, avatar.lastDir, false);
      }
    });

    this.checkProximity();
    this.checkRoom();
    this.drawProximityZone();
  }

  private drawProximityZone(): void {
    this.proximityZone.clear();
    if (this.previousNearby.size === 0) return;

    const px = this.localAvatar.container.x;
    const py = this.localAvatar.container.y;
    const radius = PROXIMITY_RADIUS * TILE_SIZE;

    this.proximityZone.lineStyle(1.5, 0x4a90d9, 0.2);
    this.proximityZone.strokeCircle(px, py, radius);
    this.proximityZone.fillStyle(0x4a90d9, 0.03);
    this.proximityZone.fillCircle(px, py, radius);

    this.previousNearby.forEach((id) => {
      const remote = this.remoteAvatars.get(id);
      if (remote) {
        this.proximityZone.lineStyle(1, 0x4a90d9, 0.2);
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

      this.roomHighlightGraphics.clear();
      if (foundRoom && foundRoom.id !== 'main-hall') {
        const b = foundRoom.bounds;
        this.roomHighlightGraphics.lineStyle(2, 0xffffff, 0.1);
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

      if (myRoom && myRoom.soundIsolated) {
        const b = myRoom.bounds;
        if (px >= b.x && px < b.x + b.width && py >= b.y && py < b.y + b.height) {
          nearbyNow.add(id);
        }
      } else if (dist <= PROXIMITY_RADIUS) {
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

  // ═══════════════════════════════════════════════════════════════════════
  // ── Map Editor Mode ─────────────────────────────────────────────────
  // ═══════════════════════════════════════════════════════════════════════

  private editorPanning = false;
  private editorPanLast = { x: 0, y: 0 };

  setEditMode(on: boolean): void {
    this._editMode = on;
    this.editorGrid.setVisible(on);
    if (on) {
      this.drawEditorGrid();
      this.cameras.main.stopFollow();
      this.cameras.main.removeBounds();
      this.input.mouse?.disableContextMenu();
      this.input.on('pointermove', this.editorPointerMove, this);
      this.input.on('pointerdown', this.editorPointerDown, this);
      this.input.on('pointerup', this.editorPointerUp, this);
      this.input.on('wheel', this.editorWheel, this);
    } else {
      this.editorGhost.setVisible(false).clear();
      this.editorSelect.setVisible(false).clear();
      this.editorHover.setVisible(false).clear();
      this.editorGrid.setVisible(false);
      this.editorSelectedIdx = -1;
      this.editorSelectedCategory = null;
      this.editorDragging = false;
      this.editorPanning = false;
      this.cameras.main.startFollow(this.localAvatar.container, true, 0.1, 0.1);
      this.cameras.main.setBounds(0, 0, MAP_WIDTH * TILE_SIZE, MAP_HEIGHT * TILE_SIZE);
      this.input.off('pointermove', this.editorPointerMove, this);
      this.input.off('pointerdown', this.editorPointerDown, this);
      this.input.off('pointerup', this.editorPointerUp, this);
      this.input.off('wheel', this.editorWheel, this);
    }
  }

  get editMode(): boolean { return this._editMode; }

  /** Set what the ghost cursor shows when placing */
  setEditorPlaceTool(category: 'decoration' | 'furniture' | null, type: string | null): void {
    this.editorGhostCategory = category;
    this.editorGhostType = type;
    if (!type) {
      this.editorGhost.setVisible(false).clear();
    }
  }

  /** Deselect current item */
  editorDeselect(): void {
    this.editorSelectedIdx = -1;
    this.editorSelectedCategory = null;
    this.editorSelect.setVisible(false).clear();
    this.onEditorSelect?.(null, -1, null);
  }

  /** Delete the currently selected item */
  editorDeleteSelected(): void {
    if (this.editorSelectedIdx < 0 || !this.editorSelectedCategory) return;
    const config = getMapConfig();
    if (this.editorSelectedCategory === 'decoration') {
      const newDecs = [...config.decorations];
      newDecs.splice(this.editorSelectedIdx, 1);
      updateMapConfig({ decorations: newDecs });
    } else {
      const newFurn = [...config.furniture];
      newFurn.splice(this.editorSelectedIdx, 1);
      updateMapConfig({ furniture: newFurn });
    }
    this.editorDeselect();
  }

  private drawEditorGrid(): void {
    const g = this.editorGrid;
    g.clear();
    g.lineStyle(0.5, 0xffffff, 0.06);
    const T = TILE_SIZE;
    for (let x = 0; x <= MAP_WIDTH; x++) {
      g.lineBetween(x * T, 0, x * T, MAP_HEIGHT * T);
    }
    for (let y = 0; y <= MAP_HEIGHT; y++) {
      g.lineBetween(0, y * T, MAP_WIDTH * T, y * T);
    }
    // Tile coordinates at edges
    g.lineStyle(1, 0xffffff, 0.12);
    g.lineBetween(0, 0, MAP_WIDTH * T, 0);
    g.lineBetween(0, 0, 0, MAP_HEIGHT * T);
  }

  private editorWorldToTile(pointer: Phaser.Input.Pointer): { tx: number; ty: number } {
    const wp = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
    return {
      tx: Math.floor(wp.x / TILE_SIZE),
      ty: Math.floor(wp.y / TILE_SIZE),
    };
  }

  private editorPointerMove = (pointer: Phaser.Input.Pointer): void => {
    if (!this._editMode) return;

    // Right-click / middle-click camera panning
    if (this.editorPanning) {
      const dx = pointer.x - this.editorPanLast.x;
      const dy = pointer.y - this.editorPanLast.y;
      this.cameras.main.scrollX -= dx / this.cameras.main.zoom;
      this.cameras.main.scrollY -= dy / this.cameras.main.zoom;
      this.editorPanLast = { x: pointer.x, y: pointer.y };
      return;
    }

    const { tx, ty } = this.editorWorldToTile(pointer);
    const T = TILE_SIZE;

    // Drag handling
    if (this.editorDragging && this.editorSelectedIdx >= 0 && this.editorSelectedCategory) {
      const config = getMapConfig();
      const dx = tx - this.editorDragStart.x;
      const dy = ty - this.editorDragStart.y;
      const newX = this.editorDragItemStart.x + dx;
      const newY = this.editorDragItemStart.y + dy;

      if (this.editorSelectedCategory === 'decoration') {
        const newDecs = [...config.decorations];
        newDecs[this.editorSelectedIdx] = { ...newDecs[this.editorSelectedIdx], x: newX, y: newY };
        updateMapConfig({ decorations: newDecs });
      } else {
        const newFurn = [...config.furniture];
        newFurn[this.editorSelectedIdx] = { ...newFurn[this.editorSelectedIdx], x: newX, y: newY };
        updateMapConfig({ furniture: newFurn });
      }
      this.drawEditorSelection();
      return;
    }

    // Ghost preview when placing
    if (this.editorGhostType && this.editorGhostCategory) {
      this.editorGhost.clear().setVisible(true);
      this.editorGhost.fillStyle(0x4a90d9, 0.25);
      this.editorGhost.lineStyle(1.5, 0x4a90d9, 0.5);
      const w = this.getItemTileWidth(this.editorGhostCategory, this.editorGhostType);
      const h = this.getItemTileHeight(this.editorGhostCategory, this.editorGhostType);
      this.editorGhost.fillRect(tx * T, ty * T, w * T, h * T);
      this.editorGhost.strokeRect(tx * T, ty * T, w * T, h * T);
      // Label
      return;
    }

    // Hover highlight
    const hit = this.editorHitTest(tx, ty);
    if (hit) {
      this.editorHover.clear().setVisible(true);
      this.editorHover.lineStyle(1.5, 0xffffff, 0.3);
      const item = hit.category === 'decoration'
        ? this.dynDecorations[hit.index]
        : this.dynFurniture[hit.index];
      const w = this.getItemTileWidth(hit.category, (item as any).type);
      const h = this.getItemTileHeight(hit.category, (item as any).type);
      this.editorHover.strokeRect(item.x * T, item.y * T, w * T, h * T);
    } else {
      this.editorHover.setVisible(false).clear();
    }
  };

  private editorPointerDown = (pointer: Phaser.Input.Pointer): void => {
    if (!this._editMode) return;

    // Right-click or middle-click starts camera panning
    if (pointer.rightButtonDown() || pointer.middleButtonDown()) {
      this.editorPanning = true;
      this.editorPanLast = { x: pointer.x, y: pointer.y };
      return;
    }

    const { tx, ty } = this.editorWorldToTile(pointer);
    // If we have a placement tool, place item
    if (this.editorGhostType && this.editorGhostCategory) {
      this.editorPlaceItem(tx, ty);
      return;
    }

    // Otherwise try to select/start drag
    const hit = this.editorHitTest(tx, ty);
    if (hit) {
      this.editorSelectedIdx = hit.index;
      this.editorSelectedCategory = hit.category;
      this.drawEditorSelection();

      const item = hit.category === 'decoration'
        ? this.dynDecorations[hit.index]
        : this.dynFurniture[hit.index];
      this.onEditorSelect?.(hit.category, hit.index, item);

      // Start drag
      this.editorDragging = true;
      this.editorDragStart = { x: tx, y: ty };
      this.editorDragItemStart = { x: item.x, y: item.y };
    } else {
      this.editorDeselect();
    }
  };

  private editorPointerUp = (): void => {
    this.editorDragging = false;
    this.editorPanning = false;
  };

  private editorWheel = (_pointer: Phaser.Input.Pointer, _dx: number[], _dy: number[], dz: number): void => {
    if (!this._editMode) return;
    const cam = this.cameras.main;
    const newZoom = Phaser.Math.Clamp(cam.zoom - dz * 0.001, 0.5, 3);
    cam.setZoom(newZoom);
  };

  private editorPlaceItem(tx: number, ty: number): void {
    if (!this.editorGhostCategory || !this.editorGhostType) return;
    const config = getMapConfig();

    if (this.editorGhostCategory === 'decoration') {
      const newDec: DecorationItem = { type: this.editorGhostType as DecorationType, x: tx, y: ty };
      const w = this.getItemTileWidth('decoration', this.editorGhostType);
      if (w > 1) newDec.w = w;
      updateMapConfig({ decorations: [...config.decorations, newDec] });
    } else {
      const newFurn: FurnitureItem = {
        type: this.editorGhostType as FurnitureType,
        x: tx, y: ty,
        w: this.getItemTileWidth('furniture', this.editorGhostType),
        h: this.getItemTileHeight('furniture', this.editorGhostType),
      };
      updateMapConfig({ furniture: [...config.furniture, newFurn] });
    }
  }

  private editorHitTest(tx: number, ty: number): { category: 'decoration' | 'furniture'; index: number } | null {
    // Check decorations first (usually on top)
    for (let i = this.dynDecorations.length - 1; i >= 0; i--) {
      const d = this.dynDecorations[i];
      const w = this.getItemTileWidth('decoration', d.type);
      const h = this.getItemTileHeight('decoration', d.type);
      if (tx >= d.x && tx < d.x + w && ty >= d.y && ty < d.y + h) {
        return { category: 'decoration', index: i };
      }
    }
    // Check furniture
    for (let i = this.dynFurniture.length - 1; i >= 0; i--) {
      const f = this.dynFurniture[i];
      const w = f.w ?? this.getItemTileWidth('furniture', f.type);
      const h = f.h ?? this.getItemTileHeight('furniture', f.type);
      if (tx >= f.x && tx < f.x + w && ty >= f.y && ty < f.y + h) {
        return { category: 'furniture', index: i };
      }
    }
    return null;
  }

  private drawEditorSelection(): void {
    if (this.editorSelectedIdx < 0 || !this.editorSelectedCategory) {
      this.editorSelect.setVisible(false).clear();
      return;
    }
    const T = TILE_SIZE;
    const item = this.editorSelectedCategory === 'decoration'
      ? this.dynDecorations[this.editorSelectedIdx]
      : this.dynFurniture[this.editorSelectedIdx];
    if (!item) { this.editorSelect.setVisible(false).clear(); return; }
    const w = this.getItemTileWidth(this.editorSelectedCategory, (item as any).type);
    const h = this.getItemTileHeight(this.editorSelectedCategory, (item as any).type);

    this.editorSelect.clear().setVisible(true);
    // Selection box
    this.editorSelect.lineStyle(2, 0x4af04a, 0.8);
    this.editorSelect.strokeRect(item.x * T - 1, item.y * T - 1, w * T + 2, h * T + 2);
    // Corner handles
    const corners = [
      [item.x * T, item.y * T],
      [(item.x + w) * T, item.y * T],
      [item.x * T, (item.y + h) * T],
      [(item.x + w) * T, (item.y + h) * T],
    ];
    this.editorSelect.fillStyle(0x4af04a, 1);
    for (const [cx, cy] of corners) {
      this.editorSelect.fillRect(cx - 3, cy - 3, 6, 6);
    }
  }

  private getItemTileWidth(category: string, type: string): number {
    if (category === 'furniture') {
      const defaults: Record<string, number> = { 'meeting-table': 3, couch: 4, 'coffee-table': 2, 'focus-desk': 2 };
      return defaults[type] ?? 1;
    }
    const defaults: Record<string, number> = { bookshelf: 4, whiteboard: 3, 'tv-screen': 3, 'bulletin-board': 2 };
    return defaults[type] ?? 1;
  }

  private getItemTileHeight(category: string, type: string): number {
    if (category === 'furniture') {
      const defaults: Record<string, number> = { 'meeting-table': 2, couch: 1, 'coffee-table': 1, 'focus-desk': 1 };
      return defaults[type] ?? 1;
    }
    return 1;
  }
}
