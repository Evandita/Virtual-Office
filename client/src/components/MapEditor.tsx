import React, { useState, useCallback, useRef, useEffect } from 'react';
import type { DecorationType, FurnitureType, DecorationItem, FurnitureItem, RoomVisual } from '../game/mapConfig';
import type { OfficeScene } from '../game/OfficeScene';
import {
  exportMapConfigJSON, importMapConfigJSON,
} from '../game/mapStore';

interface MapEditorProps {
  isOpen: boolean;
  onClose: () => void;
  scene: OfficeScene | null;
}

type EditorTool = 'select' | 'place' | 'eraser' | 'room' | 'desk';
type PlaceMode = 'item' | 'room' | 'desk';

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

type PaletteTab = 'all' | 'decorations' | 'furniture' | 'tools';

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
  { value: 'left', label: 'L' },
  { value: 'right', label: 'R' },
  { value: 'top', label: 'T' },
  { value: 'bottom', label: 'B' },
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
  const [undoStack, setUndoStack] = useState<string[]>([]);
  const [redoStack, setRedoStack] = useState<string[]>([]);
  const [paletteTab, setPaletteTab] = useState<PaletteTab>('all');
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [placeMode, setPlaceMode] = useState<PlaceMode>('item');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const pushUndo = useCallback(() => {
    setUndoStack(prev => [...prev.slice(-19), exportMapConfigJSON()]);
    setRedoStack([]);
  }, []);

  useEffect(() => {
    if (!scene) return;
    scene.setEditMode(isOpen);
    if (isOpen) {
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
    if (tool === 'place' && placeMode === 'room') {
      scene.setEditorPlaceTool(null, null);
      scene.setEditorToolMode('room');
    } else if (tool === 'place' && placeMode === 'desk') {
      scene.setEditorPlaceTool(null, null);
      scene.setEditorToolMode('desk');
    } else if (tool === 'place' && selectedItem) {
      scene.setEditorPlaceTool(selectedItem.category, selectedItem.type);
      scene.setEditorToolMode('items');
    } else {
      scene.setEditorPlaceTool(null, null);
      scene.setEditorToolMode('items');
    }
  }, [tool, selectedItem, placeMode, scene, isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT') return;
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selection.index >= 0 || selectedRoom.index >= 0) {
          pushUndo();
          scene?.editorDeleteSelected();
          setSelectedRoom({ index: -1, room: null });
        }
      }
      if (e.key === 'Escape') {
        if (paletteOpen) {
          setPaletteOpen(false);
        } else if (tool === 'place') {
          setTool('select');
          setSelectedItem(null);
          setPlaceMode('item');
          setPaletteOpen(false);
        } else {
          scene?.editorDeselect();
          setSelection({ category: null, index: -1, item: null });
          setSelectedRoom({ index: -1, room: null });
        }
      }
      if (e.key === 'z' && (e.metaKey || e.ctrlKey) && !e.shiftKey) {
        handleUndo();
      }
      if ((e.key === 'z' && (e.metaKey || e.ctrlKey) && e.shiftKey) || (e.key === 'y' && (e.metaKey || e.ctrlKey))) {
        handleRedo();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, selection, selectedRoom, tool, undoStack, redoStack, scene, paletteOpen]);


  const handleSelectPaletteItem = useCallback((item: ItemDef) => {
    pushUndo();
    setSelectedItem(item);
    setPlaceMode('item');
    setTool('place');
    setPaletteOpen(false);
    scene?.editorDeselect();
    setSelection({ category: null, index: -1, item: null });
    setSelectedRoom({ index: -1, room: null });
  }, [scene, pushUndo]);

  const handleSelectPlaceTool = useCallback((mode: PlaceMode) => {
    setPlaceMode(mode);
    setSelectedItem(null);
    setTool('place');
    setPaletteOpen(false);
    scene?.editorDeselect();
    setSelection({ category: null, index: -1, item: null });
    setSelectedRoom({ index: -1, room: null });
  }, [scene]);

  const handleToolChange = useCallback((t: EditorTool) => {
    setTool(t);
    if (t === 'place') {
      setPaletteOpen(true);
      setPlaceMode('item');
    } else {
      setPaletteOpen(false);
      setSelectedItem(null);
      setPlaceMode('item');
      scene?.setEditorPlaceTool(null, null);
    }
  }, [scene]);

  const handleDeleteSelected = useCallback(() => {
    if (selection.index < 0 && selectedRoom.index < 0) return;
    pushUndo();
    scene?.editorDeleteSelected();
    setSelection({ category: null, index: -1, item: null });
    setSelectedRoom({ index: -1, room: null });
  }, [selection, selectedRoom, scene, pushUndo]);

  const handleUndo = useCallback(() => {
    if (undoStack.length === 0) return;
    setRedoStack(prev => [...prev.slice(-19), exportMapConfigJSON()]);
    const prev = undoStack[undoStack.length - 1];
    setUndoStack(s => s.slice(0, -1));
    importMapConfigJSON(prev);
    scene?.editorDeselect();
    setSelection({ category: null, index: -1, item: null });
    setSelectedRoom({ index: -1, room: null });
  }, [undoStack, scene]);

  const handleRedo = useCallback(() => {
    if (redoStack.length === 0) return;
    setUndoStack(prev => [...prev.slice(-19), exportMapConfigJSON()]);
    const next = redoStack[redoStack.length - 1];
    setRedoStack(s => s.slice(0, -1));
    importMapConfigJSON(next);
    scene?.editorDeselect();
    setSelection({ category: null, index: -1, item: null });
    setSelectedRoom({ index: -1, room: null });
  }, [redoStack, scene]);

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
    };
    reader.readAsText(file);
    e.target.value = '';
  }, [pushUndo]);

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

  const filteredItems = paletteTab === 'tools' ? []
    : paletteTab === 'all' ? ALL_ITEMS
    : paletteTab === 'decorations' ? DECORATION_ITEMS
    : FURNITURE_ITEMS;

  if (!isOpen) return null;

  const hasRoomSelected = selectedRoom.index >= 0 && selectedRoom.room;
  const hasItemSelected = selection.item !== null;
  const hasSelection = hasRoomSelected || hasItemSelected;

  return (
    <>
      {/* ── Bottom toolbar ───────────────────────────────────────── */}
      <div style={s.bottomBar} data-editor-panel>
        {/* Tool buttons */}
        <div style={s.toolGroup}>
          {([
            ['select', '\u{1F446}', 'Select (V)'],
            ['place', '\u{2795}', 'Place Item'],
            ['eraser', '\u{1F6AB}', 'Eraser'],
          ] as [EditorTool, string, string][]).map(([t, icon, label]) => (
            <button
              key={t}
              style={{ ...s.toolBtn, ...(tool === t ? s.toolBtnActive : {}) }}
              onClick={() => handleToolChange(t)}
              title={label}
            >
              <span style={{ fontSize: '16px' }}>{icon}</span>
            </button>
          ))}
        </div>

        <div style={s.divider} />

        {/* Undo / Redo */}
        <button
          style={{ ...s.toolBtn, opacity: undoStack.length ? 1 : 0.3 }}
          onClick={handleUndo}
          disabled={!undoStack.length}
          title="Undo (Ctrl+Z)"
        >
          <span style={{ fontSize: '16px' }}>&#x21A9;</span>
        </button>
        <button
          style={{ ...s.toolBtn, opacity: redoStack.length ? 1 : 0.3 }}
          onClick={handleRedo}
          disabled={!redoStack.length}
          title="Redo (Ctrl+Shift+Z)"
        >
          <span style={{ fontSize: '16px' }}>&#x21AA;</span>
        </button>

        {/* Export / Import */}
        <button style={s.toolBtn} onClick={handleExport} title="Export map">
          <span style={{ fontSize: '14px' }}>&#x1F4E5;</span>
        </button>
        <button style={s.toolBtn} onClick={handleImport} title="Import map">
          <span style={{ fontSize: '14px' }}>&#x1F4E4;</span>
        </button>
        <input ref={fileInputRef} type="file" accept=".json" style={{ display: 'none' }} onChange={handleFileChange} />

        <div style={s.divider} />

        {/* Active tool label */}
        {selectedItem && (
          <span style={s.activeLabel}>Placing: {selectedItem.label}</span>
        )}
        {tool === 'place' && placeMode === 'room' && !selectedItem && (
          <span style={s.activeLabel}>Drag to build room</span>
        )}
        {tool === 'place' && placeMode === 'desk' && !selectedItem && (
          <span style={s.activeLabel}>Click to place desk</span>
        )}

        <div style={{ flex: 1 }} />

        {/* Close */}
        <button style={s.closeBtn} onClick={onClose} title="Close editor">
          &#x2715; Close
        </button>
      </div>

      {/* ── Item palette popover (above toolbar) ─────────────────── */}
      {paletteOpen && (
        <div style={s.palettePopover} data-editor-panel>
          <div style={s.paletteHeader}>
            <div style={s.tabRow}>
              {([
                ['all', 'All'],
                ['decorations', 'Decor'],
                ['furniture', 'Furniture'],
                ['tools', 'Tools'],
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
            <button style={s.paletteCloseBtn} onClick={() => setPaletteOpen(false)}>&#x2715;</button>
          </div>
          <div style={s.paletteGrid}>
            {/* Room & Desk tools — shown in All and Tools tabs */}
            {(paletteTab === 'all' || paletteTab === 'tools') && (
              <>
                <button
                  style={{
                    ...s.paletteItem,
                    ...(placeMode === 'room' && !selectedItem ? s.paletteItemActive : {}),
                  }}
                  onClick={() => handleSelectPlaceTool('room')}
                  title="Build Room — Drag to create a room"
                >
                  <span style={{ fontSize: '20px', lineHeight: 1 }}>{'\u{1F3D7}'}</span>
                  <span style={s.paletteLabel}>Room</span>
                </button>
                <button
                  style={{
                    ...s.paletteItem,
                    ...(placeMode === 'desk' && !selectedItem ? s.paletteItemActive : {}),
                  }}
                  onClick={() => handleSelectPlaceTool('desk')}
                  title="Place Desk — Click to place a desk"
                >
                  <span style={{ fontSize: '20px', lineHeight: 1 }}>{'\u{1F4CB}'}</span>
                  <span style={s.paletteLabel}>Desk</span>
                </button>
              </>
            )}
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
                <span style={{ fontSize: '20px', lineHeight: 1 }}>{item.icon}</span>
                <span style={s.paletteLabel}>{item.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Selection / Properties panel (top-right floating) ──── */}
      {hasSelection && (
        <div style={s.propsPanel} data-editor-panel>
          {/* Room editing */}
          {hasRoomSelected && selectedRoom.room && (
            <>
              <div style={s.propsHeader}>
                <span style={s.propsTitle}>Room</span>
                <button style={s.propsCloseBtn} onClick={() => {
                  scene?.editorDeselect();
                  setSelectedRoom({ index: -1, room: null });
                }}>&#x2715;</button>
              </div>

              <div style={s.fieldRow}>
                <label style={s.fieldLabel}>Name</label>
                <input
                  style={s.fieldInput}
                  value={selectedRoom.room.name}
                  onChange={(e) => handleRoomNameChange(e.target.value)}
                />
              </div>

              <div style={s.fieldRow}>
                <label style={s.fieldLabel}>Sub</label>
                <input
                  style={s.fieldInput}
                  value={selectedRoom.room.subLabel || ''}
                  onChange={(e) => handleRoomSubLabelChange(e.target.value)}
                  placeholder="Description"
                />
              </div>

              <div style={s.fieldRow}>
                <label style={s.fieldLabel}>Type</label>
                <div style={s.chipRow}>
                  {ROOM_TYPES.map((rt) => (
                    <button
                      key={rt.value}
                      style={{ ...s.chip, ...(selectedRoom.room!.type === rt.value ? s.chipActive : {}) }}
                      onClick={() => handleRoomTypeChange(rt.value)}
                    >
                      {rt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div style={s.fieldRow}>
                <label style={s.fieldLabel}>Color</label>
                <div style={s.chipRow}>
                  {ROOM_COLOR_PRESETS.map((preset) => (
                    <button
                      key={preset.label}
                      style={{
                        ...s.colorChip,
                        background: '#' + preset.wall.face.toString(16).padStart(6, '0'),
                        boxShadow: selectedRoom.room!.wall.face === preset.wall.face ? '0 0 0 2px #7EB8F0' : 'none',
                      }}
                      onClick={() => handleRoomColorChange(preset)}
                      title={preset.label}
                    />
                  ))}
                </div>
              </div>

              <div style={s.fieldRow}>
                <label style={s.fieldLabel}>Door</label>
                <div style={s.chipRow}>
                  {DOOR_SIDES.map((ds) => (
                    <button
                      key={ds.value}
                      style={{ ...s.chip, ...(getDoorSide(selectedRoom.room!) === ds.value ? s.chipActive : {}) }}
                      onClick={() => handleDoorSideChange(ds.value)}
                    >
                      {ds.label}
                    </button>
                  ))}
                  <button
                    style={{ ...s.chip, ...(selectedRoom.room.soundIsolated ? s.chipActive : {}) }}
                    onClick={() => handleRoomSoundChange(!selectedRoom.room!.soundIsolated)}
                    title="Sound isolation"
                  >
                    {selectedRoom.room.soundIsolated ? 'Isolated' : 'Open'}
                  </button>
                </div>
              </div>

              <div style={s.propsMeta}>
                ({selectedRoom.room.walls.x},{selectedRoom.room.walls.y}) {selectedRoom.room.walls.w + 1}x{selectedRoom.room.walls.h + 1}
              </div>

              <button style={s.deleteBtn} onClick={handleDeleteSelected}>Delete Room</button>
            </>
          )}

          {/* Item properties */}
          {hasItemSelected && !hasRoomSelected && (
            <>
              <div style={s.propsHeader}>
                <span style={s.propsTitle}>{(selection.item as any).type}</span>
                <button style={s.propsCloseBtn} onClick={() => {
                  scene?.editorDeselect();
                  setSelection({ category: null, index: -1, item: null });
                }}>&#x2715;</button>
              </div>
              <div style={s.propsMeta}>
                ({selection.item!.x}, {selection.item!.y})
                {(selection.item as any).w ? ` ${(selection.item as any).w}w` : ''}
              </div>
              <button style={s.deleteBtn} onClick={handleDeleteSelected}>Delete</button>
            </>
          )}
        </div>
      )}
    </>
  );
};

// ── Styles ──────────────────────────────────────────────────────────────
const s: Record<string, React.CSSProperties> = {
  // Bottom toolbar bar
  bottomBar: {
    position: 'absolute',
    bottom: '12px',
    left: '50%',
    transform: 'translateX(-50%)',
    zIndex: 200,
    pointerEvents: 'auto',
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    padding: '6px 12px',
    background: 'rgba(10,10,22,0.92)',
    backdropFilter: 'blur(20px)',
    borderRadius: '14px',
    border: '1px solid rgba(255,255,255,0.08)',
    boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
    color: '#fff',
  },
  toolGroup: {
    display: 'flex',
    gap: '2px',
  },
  toolBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '36px',
    height: '36px',
    borderRadius: '10px',
    border: '1px solid rgba(255,255,255,0.06)',
    background: 'rgba(255,255,255,0.02)',
    color: 'rgba(255,255,255,0.6)',
    cursor: 'pointer',
    transition: 'all 0.12s',
  },
  toolBtnActive: {
    background: 'rgba(74,144,217,0.25)',
    borderColor: 'rgba(74,144,217,0.5)',
    color: '#7EB8F0',
    boxShadow: '0 0 8px rgba(74,144,217,0.2)',
  },
  divider: {
    width: '1px',
    height: '24px',
    background: 'rgba(255,255,255,0.08)',
    margin: '0 4px',
  },
  activeLabel: {
    fontSize: '11px',
    color: 'rgba(255,255,255,0.5)',
    marginLeft: '4px',
    whiteSpace: 'nowrap',
  },
  closeBtn: {
    padding: '6px 12px',
    borderRadius: '8px',
    border: '1px solid rgba(255,80,80,0.25)',
    background: 'rgba(255,80,80,0.1)',
    color: '#ff8888',
    fontSize: '11px',
    cursor: 'pointer',
    fontWeight: 600,
    whiteSpace: 'nowrap',
  },

  // Palette popover
  palettePopover: {
    position: 'absolute',
    bottom: '68px',
    left: '50%',
    transform: 'translateX(-50%)',
    zIndex: 201,
    pointerEvents: 'auto',
    width: '380px',
    maxHeight: '320px',
    background: 'rgba(10,10,22,0.95)',
    backdropFilter: 'blur(20px)',
    borderRadius: '14px',
    border: '1px solid rgba(255,255,255,0.08)',
    boxShadow: '0 8px 40px rgba(0,0,0,0.5)',
    color: '#fff',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  paletteHeader: {
    display: 'flex',
    alignItems: 'center',
    padding: '8px 10px',
    borderBottom: '1px solid rgba(255,255,255,0.06)',
    gap: '8px',
  },
  paletteCloseBtn: {
    background: 'none',
    border: 'none',
    color: 'rgba(255,255,255,0.3)',
    cursor: 'pointer',
    fontSize: '12px',
    padding: '4px',
    marginLeft: 'auto',
  },
  paletteGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(7, 1fr)',
    gap: '3px',
    padding: '8px',
    overflowY: 'auto',
    flex: 1,
  },
  paletteItem: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    gap: '2px',
    padding: '6px 2px',
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
    lineHeight: 1.1,
    maxWidth: '100%',
    overflow: 'hidden',
  },
  tabRow: {
    display: 'flex',
    gap: '4px',
  },
  tabBtn: {
    padding: '4px 10px',
    borderRadius: '6px',
    border: '1px solid rgba(255,255,255,0.06)',
    background: 'rgba(255,255,255,0.02)',
    color: 'rgba(255,255,255,0.4)',
    cursor: 'pointer',
    fontSize: '10px',
    fontWeight: 600,
  },
  tabBtnActive: {
    background: 'rgba(74,144,217,0.15)',
    borderColor: 'rgba(74,144,217,0.3)',
    color: '#7EB8F0',
  },

  // Properties panel (floating top-right)
  propsPanel: {
    position: 'absolute',
    top: '60px',
    right: '12px',
    zIndex: 200,
    pointerEvents: 'auto',
    width: '240px',
    background: 'rgba(10,10,22,0.92)',
    backdropFilter: 'blur(20px)',
    borderRadius: '12px',
    border: '1px solid rgba(255,255,255,0.08)',
    boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
    color: '#fff',
    padding: '10px 12px',
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  propsHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '2px',
  },
  propsTitle: {
    fontSize: '12px',
    fontWeight: 700,
    color: 'rgba(255,255,255,0.85)',
  },
  propsCloseBtn: {
    background: 'none',
    border: 'none',
    color: 'rgba(255,255,255,0.3)',
    cursor: 'pointer',
    fontSize: '11px',
    padding: '2px 4px',
  },
  propsMeta: {
    fontSize: '9px',
    color: 'rgba(255,255,255,0.25)',
  },
  deleteBtn: {
    width: '100%',
    padding: '5px',
    borderRadius: '6px',
    border: '1px solid rgba(255,80,80,0.25)',
    background: 'rgba(255,80,80,0.1)',
    color: '#ff8888',
    fontSize: '10px',
    cursor: 'pointer',
    fontWeight: 600,
    marginTop: '2px',
  },
  fieldRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  fieldLabel: {
    fontSize: '9px',
    color: 'rgba(255,255,255,0.35)',
    fontWeight: 600,
    minWidth: '34px',
    flexShrink: 0,
  },
  fieldInput: {
    flex: 1,
    padding: '3px 6px',
    borderRadius: '5px',
    border: '1px solid rgba(255,255,255,0.1)',
    background: 'rgba(255,255,255,0.05)',
    color: '#fff',
    fontSize: '11px',
    outline: 'none',
    fontFamily: 'inherit',
  },
  chipRow: {
    display: 'flex',
    gap: '3px',
    flexWrap: 'wrap' as const,
  },
  chip: {
    padding: '2px 6px',
    borderRadius: '5px',
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
    width: '18px',
    height: '18px',
    borderRadius: '5px',
    border: '1px solid rgba(255,255,255,0.15)',
    cursor: 'pointer',
    padding: 0,
  },
};
