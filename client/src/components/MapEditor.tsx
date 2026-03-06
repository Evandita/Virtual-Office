import React, { useState, useCallback, useRef, useEffect } from 'react';
import type { DecorationType, FurnitureType, DecorationItem, FurnitureItem, RoomVisual } from '../game/mapConfig';
import type { OfficeScene } from '../game/OfficeScene';
import {
  getMapConfig, updateMapConfig,
  exportMapConfigJSON, importMapConfigJSON,
} from '../game/mapStore';

interface MapEditorProps {
  isOpen: boolean;
  onClose: () => void;
  scene: OfficeScene | null;
}

type EditorTool = 'select' | 'place' | 'eraser' | 'room' | 'desk';

// ── Item definitions with emoji icons ──────────────────────────────────
interface ItemDef {
  category: 'decoration' | 'furniture';
  type: string;
  label: string;
  icon: string;
  desc: string;
}

const DECORATION_ITEMS: ItemDef[] = [
  { category: 'decoration', type: 'plant', label: 'Plant', icon: '\u{1F331}', desc: 'Potted plant' },
  { category: 'decoration', type: 'lamp', label: 'Lamp', icon: '\u{1F4A1}', desc: 'Floor lamp (interactive)' },
  { category: 'decoration', type: 'bookshelf', label: 'Bookshelf', icon: '\u{1F4DA}', desc: '4-tile bookshelf' },
  { category: 'decoration', type: 'whiteboard', label: 'Whiteboard', icon: '\u{1F4CB}', desc: '3-tile whiteboard' },
  { category: 'decoration', type: 'tv-screen', label: 'TV Screen', icon: '\u{1F4FA}', desc: '3-tile TV (interactive)' },
  { category: 'decoration', type: 'water-cooler', label: 'Water Cooler', icon: '\u{1F4A7}', desc: 'Water dispenser' },
  { category: 'decoration', type: 'bulletin-board', label: 'Bulletin', icon: '\u{1F4CC}', desc: '2-tile board' },
  { category: 'decoration', type: 'clock', label: 'Clock', icon: '\u{1F570}', desc: 'Wall clock' },
  { category: 'decoration', type: 'printer', label: 'Printer', icon: '\u{1F5A8}', desc: 'Printer (interactive)' },
  { category: 'decoration', type: 'trash-bin', label: 'Trash Bin', icon: '\u{1F5D1}', desc: 'Waste bin' },
  { category: 'decoration', type: 'rug-round', label: 'Round Rug', icon: '\u{2B55}', desc: 'Decorative rug' },
  { category: 'decoration', type: 'wall-art', label: 'Wall Art', icon: '\u{1F5BC}', desc: 'Framed picture' },
  { category: 'decoration', type: 'vending-machine', label: 'Vending', icon: '\u{1F964}', desc: 'Vending machine (interactive)' },
  { category: 'decoration', type: 'speaker', label: 'Speaker', icon: '\u{1F50A}', desc: 'Speaker (interactive)' },
  { category: 'decoration', type: 'fire-extinguisher', label: 'Fire Ext.', icon: '\u{1F9EF}', desc: 'Fire extinguisher' },
  { category: 'decoration', type: 'coat-rack', label: 'Coat Rack', icon: '\u{1F9E5}', desc: 'Coat rack' },
  { category: 'decoration', type: 'umbrella-stand', label: 'Umbrella', icon: '\u{2602}', desc: 'Umbrella stand' },
  { category: 'decoration', type: 'server-rack', label: 'Server Rack', icon: '\u{1F5A5}', desc: '2-tile server rack' },
  { category: 'decoration', type: 'monitor-wall', label: 'Monitor Wall', icon: '\u{1F4BB}', desc: '4-tile monitors (interactive)' },
  { category: 'decoration', type: 'bean-bag', label: 'Bean Bag', icon: '\u{1FA91}', desc: 'Bean bag chair' },
];

const FURNITURE_ITEMS: ItemDef[] = [
  { category: 'furniture', type: 'meeting-table', label: 'Meeting Table', icon: '\u{1F4BC}', desc: '3x2 table with chairs' },
  { category: 'furniture', type: 'couch', label: 'Couch', icon: '\u{1F6CB}', desc: '4-tile sofa' },
  { category: 'furniture', type: 'coffee-table', label: 'Coffee Table', icon: '\u{2615}', desc: '2-tile table' },
  { category: 'furniture', type: 'focus-desk', label: 'Focus Desk', icon: '\u{1F4BB}', desc: '2-tile desk with monitor' },
  { category: 'furniture', type: 'single-desk', label: 'Single Desk', icon: '\u{1F5A5}', desc: '2-tile basic desk' },
  { category: 'furniture', type: 'standing-desk', label: 'Standing Desk', icon: '\u{1F9CD}', desc: '2-tile standing desk' },
  { category: 'furniture', type: 'chair', label: 'Chair', icon: '\u{1FA91}', desc: 'Office chair' },
  { category: 'furniture', type: 'filing-cabinet', label: 'Filing Cabinet', icon: '\u{1F5C4}', desc: 'File storage' },
];

const ALL_ITEMS = [...DECORATION_ITEMS, ...FURNITURE_ITEMS];

type PaletteTab = 'all' | 'decorations' | 'furniture';

const ROOM_TYPES: { value: RoomVisual['type']; label: string }[] = [
  { value: 'meeting', label: 'Meeting' },
  { value: 'lounge', label: 'Lounge' },
  { value: 'private', label: 'Private' },
  { value: 'open', label: 'Open' },
];

const ROOM_COLOR_PRESETS: { label: string; floor: { base: number; alt: number }; wall: { face: number; top: number; edge: number } }[] = [
  { label: 'Blue', floor: { base: 0x1e2840, alt: 0x212c46 }, wall: { face: 0x2e4570, top: 0x3a5888, edge: 0x4a6898 } },
  { label: 'Green', floor: { base: 0x1e2a22, alt: 0x212e26 }, wall: { face: 0x2e5038, top: 0x3a6848, edge: 0x4a7858 } },
  { label: 'Purple', floor: { base: 0x28202a, alt: 0x2c242e }, wall: { face: 0x503848, top: 0x684858, edge: 0x785868 } },
  { label: 'Red', floor: { base: 0x2a2020, alt: 0x2e2424 }, wall: { face: 0x503030, top: 0x684040, edge: 0x785050 } },
  { label: 'Teal', floor: { base: 0x1e2828, alt: 0x222c2c }, wall: { face: 0x2e4848, top: 0x3a6060, edge: 0x4a7070 } },
  { label: 'Gold', floor: { base: 0x2a2818, alt: 0x2e2c1c }, wall: { face: 0x504830, top: 0x686040, edge: 0x787050 } },
];

const DOOR_SIDES = [
  { value: 'left', label: 'Left' },
  { value: 'right', label: 'Right' },
  { value: 'top', label: 'Top' },
  { value: 'bottom', label: 'Bottom' },
] as const;

function getDoorSide(room: RoomVisual): string {
  if (room.doors.length === 0) return 'left';
  const d = room.doors[0];
  const w = room.walls;
  if (d.x === w.x) return 'left';
  if (d.x === w.x + w.w) return 'right';
  if (d.y === w.y) return 'top';
  if (d.y === w.y + w.h) return 'bottom';
  return 'left';
}

function computeDoorPosition(room: RoomVisual, side: string): { x: number; y: number } {
  const w = room.walls;
  switch (side) {
    case 'left':   return { x: w.x, y: w.y + Math.floor(w.h / 2) };
    case 'right':  return { x: w.x + w.w, y: w.y + Math.floor(w.h / 2) };
    case 'top':    return { x: w.x + Math.floor(w.w / 2), y: w.y };
    case 'bottom': return { x: w.x + Math.floor(w.w / 2), y: w.y + w.h };
    default:       return { x: w.x, y: w.y + Math.floor(w.h / 2) };
  }
}

export const MapEditor: React.FC<MapEditorProps> = ({ isOpen, onClose, scene }) => {
  const [tool, setTool] = useState<EditorTool>('select');
  const [selectedItem, setSelectedItem] = useState<ItemDef | null>(null);
  const [selection, setSelection] = useState<{
    category: 'decoration' | 'furniture' | null;
    index: number;
    item: DecorationItem | FurnitureItem | null;
  }>({ category: null, index: -1, item: null });
  const [selectedRoom, setSelectedRoom] = useState<{ index: number; room: RoomVisual | null }>({ index: -1, room: null });
  const [itemCount, setItemCount] = useState(0);
  const [undoStack, setUndoStack] = useState<string[]>([]);
  const [paletteTab, setPaletteTab] = useState<PaletteTab>('all');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const pushUndo = useCallback(() => {
    setUndoStack(prev => [...prev.slice(-19), exportMapConfigJSON()]);
  }, []);

  useEffect(() => {
    if (!scene) return;
    scene.setEditMode(isOpen);
    if (isOpen) {
      const cfg = getMapConfig();
      setItemCount(cfg.decorations.length + cfg.furniture.length + cfg.rooms.length);
      scene.onEditorSelect = (category, index, item) => {
        setSelection({ category, index, item });
      };
      scene.onEditorRoomSelect = (index, room) => {
        setSelectedRoom({ index, room: room ? { ...room } : null });
      };
    }
    return () => {
      if (scene.editMode) scene.setEditMode(false);
      scene.onEditorSelect = undefined;
      scene.onEditorRoomSelect = undefined;
    };
  }, [isOpen, scene]);

  useEffect(() => {
    if (!scene || !isOpen) return;
    if (tool === 'place' && selectedItem) {
      scene.setEditorPlaceTool(selectedItem.category, selectedItem.type);
      scene.setEditorToolMode('items');
    } else if (tool === 'room') {
      scene.setEditorPlaceTool(null, null);
      scene.setEditorToolMode('room');
    } else if (tool === 'desk') {
      scene.setEditorPlaceTool(null, null);
      scene.setEditorToolMode('desk');
    } else {
      scene.setEditorPlaceTool(null, null);
      scene.setEditorToolMode('items');
    }
  }, [tool, selectedItem, scene, isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT') return;
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selection.index >= 0 || selectedRoom.index >= 0) {
          pushUndo();
          scene?.editorDeleteSelected();
          refreshCount();
          setSelectedRoom({ index: -1, room: null });
        }
      }
      if (e.key === 'Escape') {
        if (tool === 'place' || tool === 'room' || tool === 'desk') {
          setTool('select');
          setSelectedItem(null);
        } else {
          scene?.editorDeselect();
          setSelection({ category: null, index: -1, item: null });
          setSelectedRoom({ index: -1, room: null });
        }
      }
      if (e.key === 'z' && (e.metaKey || e.ctrlKey)) {
        handleUndo();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, selection, selectedRoom, tool, undoStack, scene]);

  const refreshCount = useCallback(() => {
    const cfg = getMapConfig();
    setItemCount(cfg.decorations.length + cfg.furniture.length + cfg.rooms.length);
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const id = setInterval(refreshCount, 500);
    return () => clearInterval(id);
  }, [isOpen, refreshCount]);

  const handleSelectPaletteItem = useCallback((item: ItemDef) => {
    pushUndo();
    setSelectedItem(item);
    setTool('place');
    scene?.editorDeselect();
    setSelection({ category: null, index: -1, item: null });
    setSelectedRoom({ index: -1, room: null });
  }, [scene, pushUndo]);

  const handleToolChange = useCallback((t: EditorTool) => {
    setTool(t);
    if (t !== 'place') {
      setSelectedItem(null);
      scene?.setEditorPlaceTool(null, null);
    }
  }, [scene]);

  const handleDeleteSelected = useCallback(() => {
    if (selection.index < 0 && selectedRoom.index < 0) return;
    pushUndo();
    scene?.editorDeleteSelected();
    setSelection({ category: null, index: -1, item: null });
    setSelectedRoom({ index: -1, room: null });
    refreshCount();
  }, [selection, selectedRoom, scene, pushUndo, refreshCount]);

  const handleUndo = useCallback(() => {
    if (undoStack.length === 0) return;
    const prev = undoStack[undoStack.length - 1];
    setUndoStack(s => s.slice(0, -1));
    importMapConfigJSON(prev);
    refreshCount();
    scene?.editorDeselect();
    setSelection({ category: null, index: -1, item: null });
    setSelectedRoom({ index: -1, room: null });
  }, [undoStack, refreshCount, scene]);

  const handleExport = useCallback(() => {
    const json = exportMapConfigJSON();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'map-config.json';
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  const handleImport = useCallback(() => { fileInputRef.current?.click(); }, []);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    pushUndo();
    const reader = new FileReader();
    reader.onload = () => {
      importMapConfigJSON(reader.result as string);
      refreshCount();
    };
    reader.readAsText(file);
    e.target.value = '';
  }, [pushUndo, refreshCount]);

  // Room editing handlers
  const handleRoomNameChange = useCallback((name: string) => {
    if (selectedRoom.index < 0 || !scene) return;
    pushUndo();
    scene.editorUpdateRoom(selectedRoom.index, { name, label: name });
    setSelectedRoom(prev => prev.room ? { ...prev, room: { ...prev.room, name, label: name } } : prev);
  }, [selectedRoom.index, scene, pushUndo]);

  const handleRoomSubLabelChange = useCallback((subLabel: string) => {
    if (selectedRoom.index < 0 || !scene) return;
    pushUndo();
    scene.editorUpdateRoom(selectedRoom.index, { subLabel: subLabel || undefined });
    setSelectedRoom(prev => prev.room ? { ...prev, room: { ...prev.room, subLabel: subLabel || undefined } } : prev);
  }, [selectedRoom.index, scene, pushUndo]);

  const handleRoomTypeChange = useCallback((type: RoomVisual['type']) => {
    if (selectedRoom.index < 0 || !scene) return;
    pushUndo();
    scene.editorUpdateRoom(selectedRoom.index, { type });
    setSelectedRoom(prev => prev.room ? { ...prev, room: { ...prev.room, type } } : prev);
  }, [selectedRoom.index, scene, pushUndo]);

  const handleRoomColorChange = useCallback((preset: typeof ROOM_COLOR_PRESETS[0]) => {
    if (selectedRoom.index < 0 || !scene) return;
    pushUndo();
    scene.editorUpdateRoom(selectedRoom.index, { floor: preset.floor, wall: preset.wall });
    setSelectedRoom(prev => prev.room ? { ...prev, room: { ...prev.room, floor: preset.floor, wall: preset.wall } } : prev);
  }, [selectedRoom.index, scene, pushUndo]);

  const handleRoomSoundChange = useCallback((soundIsolated: boolean) => {
    if (selectedRoom.index < 0 || !scene) return;
    pushUndo();
    scene.editorUpdateRoom(selectedRoom.index, { soundIsolated });
    setSelectedRoom(prev => prev.room ? { ...prev, room: { ...prev.room, soundIsolated } } : prev);
  }, [selectedRoom.index, scene, pushUndo]);

  const handleDoorSideChange = useCallback((side: string) => {
    if (selectedRoom.index < 0 || !scene || !selectedRoom.room) return;
    pushUndo();
    const newDoor = computeDoorPosition(selectedRoom.room, side);
    scene.editorUpdateRoom(selectedRoom.index, { doors: [newDoor] });
    setSelectedRoom(prev => prev.room ? { ...prev, room: { ...prev.room, doors: [newDoor] } } : prev);
  }, [selectedRoom.index, selectedRoom.room, scene, pushUndo]);

  const filteredItems = paletteTab === 'all' ? ALL_ITEMS
    : paletteTab === 'decorations' ? DECORATION_ITEMS
    : FURNITURE_ITEMS;

  if (!isOpen) return null;

  const hasRoomSelected = selectedRoom.index >= 0 && selectedRoom.room;
  const hasItemSelected = selection.item !== null;

  return (
    <div style={s.overlay} data-editor-panel>
      <div style={s.panel}>
        {/* Header */}
        <div style={s.header}>
          <div style={s.headerLeft}>
            <span style={s.headerIcon}>&#9998;</span>
            <span style={s.headerTitle}>Map Editor</span>
            <span style={s.badge}>{itemCount}</span>
          </div>
          <button style={s.closeBtn} onClick={onClose} title="Close editor (items are saved)">
            &#x2715;
          </button>
        </div>

        {/* Toolbar */}
        <div style={s.toolbar}>
          {([
            ['select', '\u{1F446}', 'Select'],
            ['place', '\u{2795}', 'Place'],
            ['eraser', '\u{1F6AB}', 'Eraser'],
            ['room', '\u{1F3D7}', 'Room'],
            ['desk', '\u{1F4CB}', 'Desk'],
          ] as [EditorTool, string, string][]).map(([t, icon, label]) => (
            <button
              key={t}
              style={{ ...s.toolBtn, ...(tool === t ? s.toolBtnActive : {}) }}
              onClick={() => handleToolChange(t)}
              title={label}
            >
              <span style={{ fontSize: '14px' }}>{icon}</span>
              <span style={{ fontSize: '9px' }}>{label}</span>
            </button>
          ))}
          <div style={{ flex: 1 }} />
          <button
            style={{ ...s.iconBtn, opacity: undoStack.length ? 1 : 0.3 }}
            onClick={handleUndo}
            disabled={!undoStack.length}
            title="Undo (Ctrl+Z)"
          >
            &#x21A9;
          </button>
        </div>

        {/* Room Builder Help */}
        {tool === 'room' && (
          <div style={s.section}>
            <div style={s.sectionTitle}>Room Builder</div>
            <div style={s.hint}>
              Click and drag on the map to create a room.<br />
              Minimum size: 4x4 tiles. Red = overlap detected.<br />
              Use Select tool to edit room properties.
            </div>
          </div>
        )}

        {/* Desk Tool Help */}
        {tool === 'desk' && (
          <div style={s.section}>
            <div style={s.sectionTitle}>Desk Placement</div>
            <div style={s.hint}>
              Click on the map to place a 2-tile desk.<br />
              Desks can be claimed by users who sit at them.
            </div>
          </div>
        )}

        {/* Room Editing Panel */}
        {hasRoomSelected && selectedRoom.room && (
          <div style={s.section}>
            <div style={s.sectionTitle}>Room Properties</div>

            {/* Name */}
            <div style={s.fieldRow}>
              <label style={s.fieldLabel}>Name</label>
              <input
                style={s.fieldInput}
                value={selectedRoom.room.name}
                onChange={(e) => handleRoomNameChange(e.target.value)}
              />
            </div>

            {/* Sub Label */}
            <div style={s.fieldRow}>
              <label style={s.fieldLabel}>Subtitle</label>
              <input
                style={s.fieldInput}
                value={selectedRoom.room.subLabel || ''}
                onChange={(e) => handleRoomSubLabelChange(e.target.value)}
                placeholder="Optional description"
              />
            </div>

            {/* Type */}
            <div style={s.fieldRow}>
              <label style={s.fieldLabel}>Type</label>
              <div style={s.chipRow}>
                {ROOM_TYPES.map((rt) => (
                  <button
                    key={rt.value}
                    style={{
                      ...s.chip,
                      ...(selectedRoom.room!.type === rt.value ? s.chipActive : {}),
                    }}
                    onClick={() => handleRoomTypeChange(rt.value)}
                  >
                    {rt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Color */}
            <div style={s.fieldRow}>
              <label style={s.fieldLabel}>Color</label>
              <div style={s.chipRow}>
                {ROOM_COLOR_PRESETS.map((preset) => (
                  <button
                    key={preset.label}
                    style={{
                      ...s.colorChip,
                      background: '#' + preset.wall.face.toString(16).padStart(6, '0'),
                      boxShadow: selectedRoom.room!.wall.face === preset.wall.face
                        ? '0 0 0 2px #fff'
                        : 'none',
                    }}
                    onClick={() => handleRoomColorChange(preset)}
                    title={preset.label}
                  />
                ))}
              </div>
            </div>

            {/* Door Side */}
            <div style={s.fieldRow}>
              <label style={s.fieldLabel}>Door</label>
              <div style={s.chipRow}>
                {DOOR_SIDES.map((ds) => (
                  <button
                    key={ds.value}
                    style={{
                      ...s.chip,
                      ...(getDoorSide(selectedRoom.room!) === ds.value ? s.chipActive : {}),
                    }}
                    onClick={() => handleDoorSideChange(ds.value)}
                  >
                    {ds.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Sound Isolated */}
            <div style={s.fieldRow}>
              <label style={s.fieldLabel}>Sound</label>
              <button
                style={{
                  ...s.chip,
                  ...(selectedRoom.room.soundIsolated ? s.chipActive : {}),
                  width: 'auto',
                }}
                onClick={() => handleRoomSoundChange(!selectedRoom.room!.soundIsolated)}
              >
                {selectedRoom.room.soundIsolated ? 'Isolated' : 'Open'}
              </button>
            </div>

            {/* Info */}
            <div style={s.propGrid}>
              <span style={s.propLabel}>Position</span>
              <span style={s.propValue}>({selectedRoom.room.walls.x}, {selectedRoom.room.walls.y})</span>
              <span style={s.propLabel}>Size</span>
              <span style={s.propValue}>{selectedRoom.room.walls.w + 1}x{selectedRoom.room.walls.h + 1} tiles</span>
            </div>

            <button style={s.deleteBtn} onClick={handleDeleteSelected}>
              &#x1F5D1; Delete Room
            </button>
          </div>
        )}

        {/* Item Palette */}
        {(tool === 'place' || tool === 'select' || tool === 'eraser') && !hasRoomSelected && (
          <div style={s.section}>
            <div style={s.sectionTitle}>
              {tool === 'place' ? 'Click an item, then click on the map' : 'Items'}
            </div>
            <div style={s.tabRow}>
              {([
                ['all', 'All'],
                ['decorations', 'Decor'],
                ['furniture', 'Furniture'],
              ] as [PaletteTab, string][]).map(([tab, label]) => (
                <button
                  key={tab}
                  style={{ ...s.tabBtn, ...(paletteTab === tab ? s.tabBtnActive : {}) }}
                  onClick={() => setPaletteTab(tab)}
                >
                  {label}
                </button>
              ))}
            </div>
            <div style={s.palette}>
              {filteredItems.map((item) => (
                <button
                  key={`${item.category}-${item.type}`}
                  style={{
                    ...s.paletteItem,
                    ...(selectedItem?.type === item.type && selectedItem?.category === item.category
                      ? s.paletteItemActive : {}),
                  }}
                  onClick={() => handleSelectPaletteItem(item)}
                  title={`${item.label} — ${item.desc}`}
                >
                  <span style={{ fontSize: '18px', lineHeight: 1 }}>{item.icon}</span>
                  <span style={s.paletteLabel}>{item.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Selected item properties */}
        {hasItemSelected && !hasRoomSelected && (
          <div style={s.section}>
            <div style={s.sectionTitle}>Selected Item</div>
            <div style={s.propGrid}>
              <span style={s.propLabel}>Type</span>
              <span style={s.propValue}>{(selection.item as any).type}</span>
              <span style={s.propLabel}>Position</span>
              <span style={s.propValue}>
                ({selection.item!.x}, {selection.item!.y})
              </span>
              {(selection.item as any).w && (
                <>
                  <span style={s.propLabel}>Width</span>
                  <span style={s.propValue}>{(selection.item as any).w} tiles</span>
                </>
              )}
            </div>
            <button style={s.deleteBtn} onClick={handleDeleteSelected}>
              &#x1F5D1; Delete Item
            </button>
            <div style={s.hint}>Drag to move. Press Delete to remove.</div>
          </div>
        )}

        {/* Help text */}
        {tool === 'select' && !hasItemSelected && !hasRoomSelected && (
          <div style={s.section}>
            <div style={s.hint}>
              Click items or rooms to select them.<br />
              Drag items to reposition. Scroll to zoom.<br />
              Right-click drag to pan the camera.<br />
              Click interactive items in play mode to toggle.
            </div>
          </div>
        )}

        {/* Import/Export */}
        <div style={s.section}>
          <div style={s.sectionTitle}>Map Data</div>
          <div style={s.actionRow}>
            <button style={s.actionBtn} onClick={handleExport}>
              &#x1F4E5; Export
            </button>
            <button style={s.actionBtn} onClick={handleImport}>
              &#x1F4E4; Import
            </button>
          </div>
          <input ref={fileInputRef} type="file" accept=".json" style={{ display: 'none' }} onChange={handleFileChange} />
        </div>

        {/* Keyboard shortcuts reference */}
        <div style={s.shortcuts}>
          <span><b>Del</b> Delete</span>
          <span><b>Esc</b> Deselect</span>
          <span><b>Ctrl+Z</b> Undo</span>
          <span><b>Scroll</b> Zoom</span>
          <span><b>RClick</b> Pan</span>
        </div>
      </div>
    </div>
  );
};

// ── Styles ──────────────────────────────────────────────────────────────
const s: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'absolute',
    top: '56px',
    left: '12px',
    zIndex: 200,
    pointerEvents: 'auto',
  },
  panel: {
    width: '300px',
    maxHeight: 'calc(100vh - 80px)',
    overflowY: 'auto',
    background: 'rgba(10,10,22,0.95)',
    backdropFilter: 'blur(20px)',
    borderRadius: '16px',
    border: '1px solid rgba(255,255,255,0.08)',
    boxShadow: '0 8px 40px rgba(0,0,0,0.5)',
    color: '#fff',
    display: 'flex',
    flexDirection: 'column',
  },
  header: {
    padding: '12px 16px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottom: '1px solid rgba(255,255,255,0.06)',
  },
  headerLeft: { display: 'flex', alignItems: 'center', gap: '8px' },
  headerIcon: { fontSize: '16px' },
  headerTitle: { fontWeight: 700, fontSize: '14px' },
  badge: {
    fontSize: '10px',
    background: 'rgba(74,144,217,0.2)',
    color: '#7EB8F0',
    padding: '2px 8px',
    borderRadius: '10px',
    fontWeight: 600,
  },
  closeBtn: {
    background: 'rgba(255,80,80,0.12)',
    border: '1px solid rgba(255,80,80,0.2)',
    color: 'rgba(255,120,120,0.8)',
    borderRadius: '8px',
    width: '28px',
    height: '28px',
    cursor: 'pointer',
    fontSize: '12px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  toolbar: {
    display: 'flex',
    gap: '3px',
    padding: '8px 12px',
    borderBottom: '1px solid rgba(255,255,255,0.04)',
    alignItems: 'center',
  },
  toolBtn: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    gap: '1px',
    padding: '5px 8px',
    borderRadius: '10px',
    border: '1px solid rgba(255,255,255,0.06)',
    background: 'rgba(255,255,255,0.02)',
    color: 'rgba(255,255,255,0.6)',
    cursor: 'pointer',
    transition: 'all 0.15s',
  },
  toolBtnActive: {
    background: 'rgba(74,144,217,0.2)',
    borderColor: 'rgba(74,144,217,0.4)',
    color: '#7EB8F0',
  },
  iconBtn: {
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.08)',
    color: 'rgba(255,255,255,0.6)',
    borderRadius: '8px',
    width: '32px',
    height: '32px',
    cursor: 'pointer',
    fontSize: '14px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  section: {
    padding: '10px 14px',
    borderBottom: '1px solid rgba(255,255,255,0.04)',
  },
  sectionTitle: {
    fontSize: '10px',
    color: 'rgba(255,255,255,0.4)',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.5px',
    marginBottom: '8px',
    fontWeight: 600,
  },
  tabRow: {
    display: 'flex',
    gap: '4px',
    marginBottom: '8px',
  },
  tabBtn: {
    flex: 1,
    padding: '4px 6px',
    borderRadius: '6px',
    border: '1px solid rgba(255,255,255,0.06)',
    background: 'rgba(255,255,255,0.02)',
    color: 'rgba(255,255,255,0.4)',
    cursor: 'pointer',
    fontSize: '9px',
    fontWeight: 600,
    textAlign: 'center' as const,
  },
  tabBtnActive: {
    background: 'rgba(74,144,217,0.15)',
    borderColor: 'rgba(74,144,217,0.3)',
    color: '#7EB8F0',
  },
  palette: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: '4px',
    maxHeight: '240px',
    overflowY: 'auto' as const,
  },
  paletteItem: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    gap: '2px',
    padding: '5px 2px',
    borderRadius: '8px',
    border: '1px solid rgba(255,255,255,0.04)',
    background: 'rgba(255,255,255,0.02)',
    color: 'rgba(255,255,255,0.6)',
    cursor: 'pointer',
    transition: 'all 0.12s',
  },
  paletteItemActive: {
    background: 'rgba(46,204,113,0.15)',
    borderColor: 'rgba(46,204,113,0.4)',
    color: '#2ecc71',
    boxShadow: '0 0 8px rgba(46,204,113,0.15)',
  },
  paletteLabel: {
    fontSize: '7px',
    textAlign: 'center' as const,
    lineHeight: 1.2,
    maxWidth: '100%',
    overflow: 'hidden',
  },
  propGrid: {
    display: 'grid',
    gridTemplateColumns: '70px 1fr',
    gap: '4px 8px',
    marginBottom: '8px',
  },
  propLabel: {
    fontSize: '10px',
    color: 'rgba(255,255,255,0.35)',
    fontWeight: 600,
  },
  propValue: {
    fontSize: '11px',
    color: 'rgba(255,255,255,0.8)',
  },
  deleteBtn: {
    width: '100%',
    padding: '6px',
    borderRadius: '8px',
    border: '1px solid rgba(255,80,80,0.25)',
    background: 'rgba(255,80,80,0.1)',
    color: '#ff8888',
    fontSize: '11px',
    cursor: 'pointer',
    fontWeight: 600,
    marginBottom: '6px',
  },
  hint: {
    fontSize: '10px',
    color: 'rgba(255,255,255,0.25)',
    lineHeight: 1.5,
  },
  actionRow: {
    display: 'flex',
    gap: '6px',
  },
  actionBtn: {
    flex: 1,
    padding: '7px 12px',
    borderRadius: '8px',
    border: '1px solid rgba(255,255,255,0.1)',
    background: 'linear-gradient(135deg, rgba(74,144,217,0.12), rgba(91,111,217,0.12))',
    color: '#7EB8F0',
    fontSize: '11px',
    cursor: 'pointer',
    fontWeight: 600,
    textAlign: 'center' as const,
  },
  shortcuts: {
    display: 'flex',
    gap: '10px',
    padding: '8px 14px',
    fontSize: '9px',
    color: 'rgba(255,255,255,0.2)',
    flexWrap: 'wrap' as const,
  },
  // Room editing styles
  fieldRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '8px',
  },
  fieldLabel: {
    fontSize: '10px',
    color: 'rgba(255,255,255,0.4)',
    fontWeight: 600,
    minWidth: '50px',
    flexShrink: 0,
  },
  fieldInput: {
    flex: 1,
    padding: '4px 8px',
    borderRadius: '6px',
    border: '1px solid rgba(255,255,255,0.1)',
    background: 'rgba(255,255,255,0.05)',
    color: '#fff',
    fontSize: '11px',
    outline: 'none',
    fontFamily: 'inherit',
  },
  chipRow: {
    display: 'flex',
    gap: '4px',
    flexWrap: 'wrap' as const,
  },
  chip: {
    padding: '3px 8px',
    borderRadius: '6px',
    border: '1px solid rgba(255,255,255,0.08)',
    background: 'rgba(255,255,255,0.03)',
    color: 'rgba(255,255,255,0.5)',
    fontSize: '9px',
    cursor: 'pointer',
    fontWeight: 600,
  },
  chipActive: {
    background: 'rgba(74,144,217,0.2)',
    borderColor: 'rgba(74,144,217,0.4)',
    color: '#7EB8F0',
  },
  colorChip: {
    width: '20px',
    height: '20px',
    borderRadius: '6px',
    border: '1px solid rgba(255,255,255,0.15)',
    cursor: 'pointer',
    padding: 0,
  },
};
