'use client';

// Hand-drawn SVG replicas of the MetaTrader 5 toolbar icons (16×16).

export function IconNewOrder({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16">
      <rect x="1.5" y="2.5" width="13" height="11" fill="#2d5f8a" stroke="#1b3d59" />
      <rect x="3" y="4" width="6" height="1.4" fill="#ffd24d" />
      <rect x="3" y="6.6" width="10" height="1" fill="#9fc5e8" />
      <rect x="3" y="8.6" width="10" height="1" fill="#9fc5e8" />
      <path d="M12.5 9.5v2h-2v1.5h2v2H14v-2h2v-1.5h-2v-2z" fill="#3fa142" transform="translate(-1.2 -1) scale(0.85)" />
    </svg>
  );
}

export function IconBars({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16">
      <g stroke="#00c853" strokeWidth="1.2">
        <line x1="3" y1="2" x2="3" y2="12" />
        <line x1="1.5" y1="4" x2="3" y2="4" />
        <line x1="3" y1="9.5" x2="4.5" y2="9.5" />
      </g>
      <g stroke="#ff5252" strokeWidth="1.2">
        <line x1="8" y1="4" x2="8" y2="14" />
        <line x1="6.5" y1="6" x2="8" y2="6" />
        <line x1="8" y1="12" x2="9.5" y2="12" />
      </g>
      <g stroke="#00c853" strokeWidth="1.2">
        <line x1="13" y1="3" x2="13" y2="11" />
        <line x1="11.5" y1="5" x2="13" y2="5" />
        <line x1="13" y1="9" x2="14.5" y2="9" />
      </g>
    </svg>
  );
}

export function IconCandles({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16">
      <rect x="2" y="5" width="3" height="6" fill="#ff5252" />
      <line x1="3.5" y1="2" x2="3.5" y2="14" stroke="#ff5252" strokeWidth="1" />
      <rect x="6.5" y="4" width="3" height="5" fill="none" stroke="#00c853" strokeWidth="1" />
      <line x1="8" y1="1" x2="8" y2="13" stroke="#00c853" strokeWidth="1" />
      <rect x="11" y="6" width="3" height="6" fill="#ff5252" />
      <line x1="12.5" y1="3" x2="12.5" y2="15" stroke="#ff5252" strokeWidth="1" />
    </svg>
  );
}

export function IconLine({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16">
      <polyline points="1,12 4,7 7,9.5 10,4 15,6" fill="none" stroke="#ffd24d" strokeWidth="1.4" />
    </svg>
  );
}

export function IconZoom({ size = 16, out = false }: { size?: number; out?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16">
      <circle cx="7" cy="7" r="4.4" fill="none" stroke="#b0b0b0" strokeWidth="1.3" />
      <line x1="10.4" y1="10.4" x2="14.2" y2="14.2" stroke="#b0b0b0" strokeWidth="1.6" />
      <line x1="5" y1="7" x2="9" y2="7" stroke="#e0e0e0" strokeWidth="1.3" />
      {!out && <line x1="7" y1="5" x2="7" y2="9" stroke="#e0e0e0" strokeWidth="1.3" />}
    </svg>
  );
}

export function IconIndicators({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16">
      <text x="8" y="12.5" textAnchor="middle" fontFamily="Georgia, serif" fontSize="13" fontStyle="italic" fill="#8bc34a">
        f
      </text>
      <text x="12" y="7" textAnchor="middle" fontFamily="Tahoma" fontSize="7" fill="#b0b0b0">
        (x)
      </text>
    </svg>
  );
}

export function IconGrid({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16">
      <rect x="1.5" y="1.5" width="13" height="13" fill="none" stroke="#8a8a8a" />
      <line x1="1.5" y1="6" x2="14.5" y2="6" stroke="#8a8a8a" strokeWidth="0.7" />
      <line x1="1.5" y1="10.5" x2="14.5" y2="10.5" stroke="#8a8a8a" strokeWidth="0.7" />
      <line x1="6" y1="1.5" x2="6" y2="14.5" stroke="#8a8a8a" strokeWidth="0.7" />
      <line x1="10.5" y1="1.5" x2="10.5" y2="14.5" stroke="#8a8a8a" strokeWidth="0.7" />
    </svg>
  );
}

export function IconSeparator({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16">
      <line x1="8" y1="1" x2="8" y2="15" stroke="#c8642d" strokeWidth="1.2" strokeDasharray="3 2" />
      <line x1="2" y1="2" x2="14" y2="2" stroke="#5a5a5a" strokeWidth="0.6" />
      <line x1="2" y1="14" x2="14" y2="14" stroke="#5a5a5a" strokeWidth="0.6" />
    </svg>
  );
}

export function IconProperties({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16">
      <circle cx="8" cy="8" r="6.5" fill="none" stroke="#8a8a8a" />
      <circle cx="5" cy="6" r="1.6" fill="#f44336" />
      <circle cx="9.5" cy="4.5" r="1.6" fill="#ffc107" />
      <circle cx="11" cy="9" r="1.6" fill="#4caf50" />
      <circle cx="6" cy="10.5" r="1.6" fill="#2196f3" />
    </svg>
  );
}

export function IconCross({ size = 16, color = '#c8c8c8' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16">
      <line x1="3" y1="3" x2="13" y2="13" stroke={color} strokeWidth="1.3" />
      <line x1="13" y1="3" x2="3" y2="13" stroke={color} strokeWidth="1.3" />
    </svg>
  );
}

export function IconPin({ size = 12, pinned = false }: { size?: number; pinned?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 12 12">
      <path
        d="M7 1l4 4-2 0.8-2.4 2.4L6 10 4.2 8.2 1.8 10.6 1.4 10.2 3.8 7.8 2 6l1.8-.6L6.2 3z"
        fill={pinned ? '#4fa3e0' : '#8a8a8a'}
      />
    </svg>
  );
}

export function IconTreeFolder({ size = 15, open = false }: { size?: number; open?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16">
      <path d="M1.5 3.5h4l1.4 1.8h7.6v8.2h-13z" fill={open ? '#e8b23c' : '#e0b13e'} stroke="#a87f24" strokeWidth="0.8" />
      {open && <path d="M1.5 6.5h13l-1.6 7h-13z" fill="#ffd75e" stroke="#a87f24" strokeWidth="0.8" />}
    </svg>
  );
}

export function IconIndicatorItem({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16">
      <path d="M1 12l3-5 3 3 4-7 4 4" fill="none" stroke="#5ba3d9" strokeWidth="1.4" />
    </svg>
  );
}

export function IconTerminalGreen({ size = 12 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 12 12">
      <rect x="0.5" y="1.5" width="11" height="7.5" rx="1" fill="none" stroke="#57a857" strokeWidth="1.1" />
      <rect x="4" y="10" width="4" height="1.2" fill="#57a857" />
    </svg>
  );
}

export function IconMT5({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16">
      <rect width="16" height="16" rx="2" fill="#0d0d0d" />
      <path d="M2 12l4-7 3 4 5-6" fill="none" stroke="#e8b23c" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="14" cy="3" r="1.4" fill="#c62828" />
    </svg>
  );
}
