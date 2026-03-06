import React, { useState, useCallback, useRef, useEffect } from 'react';
import type { DecorationType, FurnitureType, DecorationItem, FurnitureItem } from '../game/mapConfig';
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

type EditorTool = 'select' | 'place' | 'eraser';

// ── Item definitions with emoji icons ──────────────────────────────────
interface ItemDef {
  category: 'decoration' | 'furniture';
  type: string;
  label: string;
  icon: string;
  desc: string;
}

const ITEMS: ItemDef[] = [
  // Decorations
  { category: 'decoration', type: 'plant', label: 'Plant', icon: '\u{1F331}', desc: 'Potted plant' },
  { category: 'decoration', type: 'lamp', label: 'Lamp', icon: '\u{1F4A1}', desc: 'Floor lamp' },
  { category: 'decoration', type: 'bookshelf', label: 'Bookshelf', icon: '\u{1F4DA}', desc: '4-tile bookshelf' },
  { category: 'decoration', type: 'whiteboard', label: 'Whiteboard', icon: '\u{1F4CB}', desc: '3-tile whiteboard' },
  { category: 'decoration', type: 'tv-screen', label: 'TV Screen', icon: '\u{1F4FA}', desc: '3-tile TV display' },
  { category: 'decoration', type: 'water-cooler', label: 'Water Cooler', icon: '\u{1F4A7}', desc: 'Water dispenser' },
  { category: 'decoration', type: 'bulletin-board', label: 'Bulletin Board', icon: '\u{1F4CC}', desc: '2-tile board' },
  { category: 'decoration', type: 'clock', label: 'Clock', icon: '\u{1F570}', desc: 'Wall clock' },
  { category: 'decoration', type: 'printer', label: 'Printer', icon: '\u{1F5A8}', desc: 'Office printer' },
  { category: 'decoration', type: 'trash-bin', label: 'Trash Bin', icon: '\u{1F5D1}', desc: 'Waste bin' },
  { category: 'decoration', type: 'rug-round', label: 'Round Rug', icon: '\u{2B55}', desc: 'Decorative rug' },
  { category: 'decoration', type: 'wall-art', label: 'Wall Art', icon: '\u{1F5BC}', desc: 'Framed picture' },
  // Furniture
  { category: 'furniture', type: 'couch', label: 'Couch', icon: '\u{1F6CB}', desc: '4-tile sofa' },
  { category: 'furniture', type: 'coffee-table', label: 'Coffee Table', icon: '\u{2615}', desc: '2-tile table' },
  { category: 'furniture', type: 'meeting-table', label: 'Meeting Table', icon: '\u{1F4BC}', desc: '3x2 table with chairs' },
  { category: 'furniture', type: 'focus-desk', label: 'Focus Desk', icon: '\u{1F4BB}', desc: '2-tile desk with monitor' },
];

export const MapEditor: React.FC<MapEditorProps> = ({ isOpen, onClose, scene }) => {
  const [tool, setTool] = useState<EditorTool>('select');
  const [selectedItem, setSelectedItem] = useState<ItemDef | null>(null);
  const [selection, setSelection] = useState<{
    category: 'decoration' | 'furniture' | null;
    index: number;
    item: DecorationItem | FurnitureItem | null;
  }>({ category: null, index: -1, item: null });
  const [itemCount, setItemCount] = useState(0);
  const [undoStack, setUndoStack] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Save snapshot for undo
  const pushUndo = useCallback(() => {
    setUndoStack(prev => [...prev.slice(-19), exportMapConfigJSON()]);
  }, []);

  // Toggle edit mode on scene
  useEffect(() => {
    if (!scene) return;
    scene.setEditMode(isOpen);
    if (isOpen) {
      const cfg = getMapConfig();
      setItemCount(cfg.decorations.length + cfg.furniture.length);
      // Register selection callback
      scene.onEditorSelect = (category, index, item) => {
        setSelection({ category, index, item });
      };
    }
    return () => {
      if (scene.editMode) scene.setEditMode(false);
      scene.onEditorSelect = undefined;
    };
  }, [isOpen, scene]);

  // Update scene placement tool when tool/item changes
  useEffect(() => {
    if (!scene || !isOpen) return;
    if (tool === 'place' && selectedItem) {
      scene.setEditorPlaceTool(selectedItem.category, selectedItem.type);
    } else {
      scene.setEditorPlaceTool(null, null);
    }
  }, [tool, selectedItem, scene, isOpen]);

  // Keyboard shortcuts
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT') return;
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selection.index >= 0) {
          pushUndo();
          scene?.editorDeleteSelected();
          refreshCount();
        }
      }
      if (e.key === 'Escape') {
        if (tool === 'place') {
          setTool('select');
          setSelectedItem(null);
        } else {
          scene?.editorDeselect();
          setSelection({ category: null, index: -1, item: null });
        }
      }
      if (e.key === 'z' && (e.metaKey || e.ctrlKey)) {
        handleUndo();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, selection, tool, undoStack, scene]);

  const refreshCount = useCallback(() => {
    const cfg = getMapConfig();
    setItemCount(cfg.decorations.length + cfg.furniture.length);
  }, []);

  // Listen for map config changes to refresh count
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
  }, [scene, pushUndo]);

  const handleToolChange = useCallback((t: EditorTool) => {
    setTool(t);
    if (t !== 'place') {
      setSelectedItem(null);
      scene?.setEditorPlaceTool(null, null);
    }
    if (t === 'eraser') {
      // In eraser mode, clicking selects + immediately deletes
    }
  }, [scene]);

  const handleDeleteSelected = useCallback(() => {
    if (selection.index < 0) return;
    pushUndo();
    scene?.editorDeleteSelected();
    setSelection({ category: null, index: -1, item: null });
    refreshCount();
  }, [selection, scene, pushUndo, refreshCount]);

  const handleUndo = useCallback(() => {
    if (undoStack.length === 0) return;
    const prev = undoStack[undoStack.length - 1];
    setUndoStack(s => s.slice(0, -1));
    importMapConfigJSON(prev);
    refreshCount();
    scene?.editorDeselect();
    setSelection({ category: null, index: -1, item: null });
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

  if (!isOpen) return null;

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
            ['select', '\u{1F446}', 'Select & Move'],
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
              <span style={{ fontSize: '10px' }}>{label}</span>
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

        {/* Item Palette (visible when Place tool active, or always as compact) */}
        <div style={s.section}>
          <div style={s.sectionTitle}>
            {tool === 'place' ? 'Click an item, then click on the map to place' : 'Items'}
          </div>
          <div style={s.palette}>
            {ITEMS.map((item) => (
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

        {/* Selected item properties */}
        {selection.item && (
          <div style={s.section}>
            <div style={s.sectionTitle}>Selected Item</div>
            <div style={s.propGrid}>
              <span style={s.propLabel}>Type</span>
              <span style={s.propValue}>{(selection.item as any).type}</span>
              <span style={s.propLabel}>Position</span>
              <span style={s.propValue}>
                ({selection.item.x}, {selection.item.y})
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
        {tool === 'select' && !selection.item && (
          <div style={s.section}>
            <div style={s.hint}>
              Click items on the map to select them.<br />
              Drag to reposition. Scroll to zoom.<br />
              Press Delete to remove selected items.
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
    gap: '4px',
    padding: '8px 12px',
    borderBottom: '1px solid rgba(255,255,255,0.04)',
    alignItems: 'center',
  },
  toolBtn: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    gap: '2px',
    padding: '6px 10px',
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
  palette: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: '4px',
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
    fontSize: '8px',
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
    gap: '12px',
    padding: '8px 14px',
    fontSize: '9px',
    color: 'rgba(255,255,255,0.2)',
    flexWrap: 'wrap' as const,
  },
};
