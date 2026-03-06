/**
 * Procedural avatar sprite sheet generator.
 * Creates a sprite sheet texture at runtime from AvatarConfig colors.
 *
 * Layout: 4 columns (directions: down, left, right, up) x 4 rows (animation frames)
 * Each frame is FRAME_W x FRAME_H pixels.
 */
import type { AvatarConfig } from '../types';

export const FRAME_W = 32;
export const FRAME_H = 48;
const COLS = 4; // down, left, right, up
const ROWS = 4; // animation frames

function hexToRgb(hex: string): string {
  return hex.startsWith('#') ? hex : `#${hex}`;
}

function drawFrame(
  ctx: CanvasRenderingContext2D,
  avatar: AvatarConfig,
  direction: 'down' | 'left' | 'right' | 'up',
  frame: number,
  ox: number,
  oy: number,
): void {
  const cx = ox + FRAME_W / 2;  // center x
  const baseY = oy + FRAME_H;   // bottom of frame

  // Walk bob: frames 1 and 3 are "step" frames with slight vertical offset
  const bob = (frame === 1 || frame === 3) ? -2 : 0;
  // Leg spread for walk frames
  const legSpread = (frame === 1) ? -2 : (frame === 3) ? 2 : 0;

  // Shadow
  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  ctx.beginPath();
  ctx.ellipse(cx, baseY - 3, 9, 4, 0, 0, Math.PI * 2);
  ctx.fill();

  // Legs
  ctx.fillStyle = '#3a3a5a';
  // Left leg
  ctx.fillRect(cx - 5 + legSpread, baseY - 14 + bob, 4, 12);
  // Right leg
  ctx.fillRect(cx + 1 - legSpread, baseY - 14 + bob, 4, 12);

  // Body / shirt
  ctx.fillStyle = hexToRgb(avatar.shirtColor);
  ctx.beginPath();
  ctx.roundRect(cx - 8, baseY - 26 + bob, 16, 16, 3);
  ctx.fill();

  // Arms (slightly different per direction for visual interest)
  ctx.fillStyle = hexToRgb(avatar.skinColor);
  if (direction === 'left') {
    // Left arm forward, right arm back
    ctx.fillRect(cx - 10, baseY - 24 + bob + (frame === 1 ? -1 : frame === 3 ? 1 : 0), 4, 10);
    ctx.fillRect(cx + 6, baseY - 22 + bob + (frame === 1 ? 1 : frame === 3 ? -1 : 0), 4, 10);
  } else if (direction === 'right') {
    ctx.fillRect(cx - 10, baseY - 22 + bob + (frame === 1 ? 1 : frame === 3 ? -1 : 0), 4, 10);
    ctx.fillRect(cx + 6, baseY - 24 + bob + (frame === 1 ? -1 : frame === 3 ? 1 : 0), 4, 10);
  } else {
    // Arms swing for up/down
    const armSwing = (frame === 1) ? 2 : (frame === 3) ? -2 : 0;
    ctx.fillRect(cx - 11, baseY - 23 + bob + armSwing, 4, 10);
    ctx.fillRect(cx + 7, baseY - 23 + bob - armSwing, 4, 10);
  }

  // Head
  ctx.fillStyle = hexToRgb(avatar.skinColor);
  ctx.beginPath();
  ctx.arc(cx, baseY - 33 + bob, 9, 0, Math.PI * 2);
  ctx.fill();

  // Hair
  ctx.fillStyle = hexToRgb(avatar.hairColor);
  const hairStyle = avatar.hairStyle ?? 0;
  if (hairStyle === 0) {
    // Short hair — cap on top
    ctx.beginPath();
    ctx.ellipse(cx, baseY - 39 + bob, 9, 5, 0, 0, Math.PI * 2);
    ctx.fill();
  } else if (hairStyle === 1) {
    // Medium hair — extends down sides
    ctx.beginPath();
    ctx.ellipse(cx, baseY - 38 + bob, 10, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(cx - 10, baseY - 38 + bob, 4, 8);
    ctx.fillRect(cx + 6, baseY - 38 + bob, 4, 8);
  } else {
    // Long hair
    ctx.beginPath();
    ctx.ellipse(cx, baseY - 38 + bob, 10, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(cx - 10, baseY - 38 + bob, 4, 14);
    ctx.fillRect(cx + 6, baseY - 38 + bob, 4, 14);
  }

  // Eyes
  ctx.fillStyle = '#333333';
  if (direction === 'down') {
    ctx.beginPath(); ctx.arc(cx - 3, baseY - 33 + bob, 1.5, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(cx + 3, baseY - 33 + bob, 1.5, 0, Math.PI * 2); ctx.fill();
    // Mouth
    ctx.fillStyle = 'rgba(0,0,0,0.15)';
    ctx.fillRect(cx - 2, baseY - 28 + bob, 4, 1.5);
  } else if (direction === 'left') {
    ctx.beginPath(); ctx.arc(cx - 4, baseY - 33 + bob, 1.5, 0, Math.PI * 2); ctx.fill();
  } else if (direction === 'right') {
    ctx.beginPath(); ctx.arc(cx + 4, baseY - 33 + bob, 1.5, 0, Math.PI * 2); ctx.fill();
  }
  // 'up' direction — no eyes visible
}

/**
 * Generate a sprite sheet texture and register it with Phaser.
 * Returns the texture key.
 */
export function generateAvatarSpriteSheet(
  scene: Phaser.Scene,
  textureKey: string,
  avatar: AvatarConfig,
): string {
  const width = COLS * FRAME_W;
  const height = ROWS * FRAME_H;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;

  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, width, height);

  const directions: Array<'down' | 'left' | 'right' | 'up'> = ['down', 'left', 'right', 'up'];

  for (let col = 0; col < COLS; col++) {
    for (let row = 0; row < ROWS; row++) {
      drawFrame(ctx, avatar, directions[col], row, col * FRAME_W, row * FRAME_H);
    }
  }

  // Remove existing texture if regenerating
  if (scene.textures.exists(textureKey)) {
    scene.textures.remove(textureKey);
  }

  const texture = scene.textures.addCanvas(textureKey, canvas)!;

  // addCanvas auto-creates '__BASE' (full canvas) as default frame.
  // Use string frame names like "f0", "f1" etc. to avoid colliding with
  // the auto-generated numeric frame 0 that covers the full canvas.
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      const frameIdx = row * COLS + col;
      texture.add(`f${frameIdx}`, 0, col * FRAME_W, row * FRAME_H, FRAME_W, FRAME_H);
    }
  }

  return textureKey;
}

/** Get frame names for a given direction's walk animation */
export function getAnimFrames(direction: 'down' | 'left' | 'right' | 'up'): string[] {
  const colMap = { down: 0, left: 1, right: 2, up: 3 };
  const col = colMap[direction];
  return [
    `f${0 * COLS + col}`, `f${1 * COLS + col}`,
    `f${2 * COLS + col}`, `f${3 * COLS + col}`,
  ];
}

/** Get idle frame name for a direction (row 0 = standing) */
export function getIdleFrame(direction: 'down' | 'left' | 'right' | 'up'): string {
  const colMap = { down: 0, left: 1, right: 2, up: 3 };
  return `f${colMap[direction]}`;
}
