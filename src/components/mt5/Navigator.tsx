'use client';

// Navigator — MT5 tree with accounts, indicators, expert advisors, scripts.

import { useState } from 'react';
import { useApp } from '@/stores/app';
import { useTrading } from '@/stores/trading';
import { IconTreeFolder, IconIndicatorItem, IconMT5 } from './icons';

interface TreeNode {
  label: string;
  hint?: string;
  children?: TreeNode[];
  leafIcon?: 'indicator' | 'terminal';
  onDoubleClick?: () => void;
}

const INDICATORS = [
  'Accelerator Oscillator', 'Accumulation/Distribution', 'ADX', 'Alligator',
  'Awesome Oscillator', 'Bollinger Bands', 'Envelopes', 'Fractals',
  'Ichimoku Kinko Hyo', 'MACD', 'Moving Average', 'RSI', 'Standard Deviation',
  'Stochastic Oscillator',
];

const EXPERTS = ['MACD Sample', 'Moving Average', 'ExpertMailBox'];
const SCRIPTS = ['Period Converter', 'Trade Calculator', 'Chart Rotate'];

export function Navigator() {
  const app = useApp();
  const trading = useTrading();
  const [open, setOpen] = useState<Record<string, boolean>>({
    Accounts: true,
    Indicators: false,
    'Expert Advisors': false,
    Scripts: false,
  });

  const notAvailable = (name: string) => () =>
    trading.log(`'${name}' requires a full build and is disabled in this demo`);

  const tree: TreeNode[] = [
    {
      label: 'Accounts',
      children: [
        {
          label: 'MetaQuotes-Demo',
          leafIcon: 'terminal',
          children: [
            {
              label: `${trading.account}`,
              hint: 'Demo 10 000 USD',
              leafIcon: 'terminal',
              onDoubleClick: () => trading.log(`account ${trading.account} already connected (demo)`),
            },
          ],
        },
      ],
    },
    {
      label: 'Indicators',
      children: INDICATORS.map((name) => ({
        label: name,
        leafIcon: 'indicator' as const,
        onDoubleClick:
          name === 'Moving Average'
            ? () => app.openDialog('indicators')
            : () => trading.log(`study '${name}' is not available in this demo build`),
      })),
    },
    {
      label: 'Expert Advisors',
      children: EXPERTS.map((name) => ({
        label: name,
        leafIcon: 'indicator' as const,
        onDoubleClick: notAvailable(name),
      })),
    },
    {
      label: 'Scripts',
      children: SCRIPTS.map((name) => ({
        label: name,
        leafIcon: 'indicator' as const,
        onDoubleClick: notAvailable(name),
      })),
    },
  ];

  const renderNodes = (nodes: TreeNode[], depth: number) =>
    nodes.map((n, i) => {
      const isOpen = open[`${depth}-${n.label}`] ?? false;
      const hasChildren = !!n.children;
      return (
        <div key={`${depth}-${n.label}-${i}`}>
          <div
            className="nav-row"
            style={{ paddingLeft: 6 + depth * 14 }}
            onDoubleClick={() => {
              if (hasChildren) return;
              n.onDoubleClick?.();
            }}
            onClick={() => {
              if (hasChildren) setOpen((o) => ({ ...o, [`${depth}-${n.label}`]: !isOpen }));
            }}
            title={n.hint}
          >
            {hasChildren ? (
              <span className={`nav-caret ${isOpen ? 'nav-caret-open' : ''}`}>▸</span>
            ) : (
              <span className="nav-caret" />
            )}
            {hasChildren ? (
              <IconTreeFolder open={isOpen} />
            ) : n.leafIcon === 'terminal' ? (
              <IconMT5 size={13} />
            ) : (
              <IconIndicatorItem />
            )}
            <span className="nav-label">{n.label}</span>
            {n.hint && <span className="nav-hint">{n.hint}</span>}
          </div>
          {hasChildren && isOpen && n.children && renderNodes(n.children, depth + 1)}
        </div>
      );
    });

  return (
    <div className="mt-panel nav-panel">
      <div className="mt-panel-title">
        <span>Navigator</span>
      </div>
      <div className="nav-tree">{renderNodes(tree, 0)}</div>
    </div>
  );
}
