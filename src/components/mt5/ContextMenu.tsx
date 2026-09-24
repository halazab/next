'use client';

// Global MT5-styled context menu + dropdown menu primitives.

import { useEffect, useRef } from 'react';
import { useApp, type MenuItemDef } from '@/stores/app';

function MenuList({ items, onClose, depth = 0 }: { items: MenuItemDef[]; onClose: () => void; depth?: number }) {
  return (
    <div className="mt-menu-list" style={{ minWidth: 168 }}>
      {items.map((item, i) => {
        if (item.separator) return <div key={i} className="mt-menu-sep" />;
        const hasSub = !!item.submenu && item.submenu.length > 0;
        return (
          <div
            key={i}
            className={`mt-menu-item ${item.disabled ? 'mt-menu-disabled' : ''}`}
            onClick={(e) => {
              e.stopPropagation();
              if (item.disabled || hasSub) return;
              item.onClick?.();
              onClose();
            }}
          >
            {item.checked && <span className="mt-menu-check">✓</span>}
            {!item.checked && <span className="mt-menu-check" />}
            <span className="mt-menu-label">{item.label}</span>
            {item.shortcut && <span className="mt-menu-shortcut">{item.shortcut}</span>}
            {hasSub && <span className="mt-menu-arrow">▸</span>}
            {hasSub && (
              <div className={`mt-menu-sub ${depth > 0 ? 'mt-menu-sub-nested' : ''}`}>
                <MenuList items={item.submenu!} onClose={onClose} depth={depth + 1} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/** The global context menu portal (driven by useApp().contextMenu) */
export function GlobalContextMenu() {
  const cm = useApp((s) => s.contextMenu);
  const close = useApp((s) => s.closeContextMenu);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!cm.open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    window.addEventListener('mousedown', onDown, true);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('mousedown', onDown, true);
      window.removeEventListener('keydown', onKey);
    };
  }, [cm.open, close]);

  if (!cm.open) return null;

  const x = Math.min(cm.x, window.innerWidth - 200);
  const y = Math.min(cm.y, window.innerHeight - (cm.items.length * 24 + 12));

  return (
    <div ref={ref} className="mt-menu mt-context" style={{ left: x, top: y }} onContextMenu={(e) => e.preventDefault()}>
      <MenuList items={cm.items} onClose={close} />
    </div>
  );
}
