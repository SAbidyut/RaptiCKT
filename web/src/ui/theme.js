// Colour themes for the schematic canvas.

export const THEMES = {
  dark: {
    name: 'Midnight',
    bg: '#0b1120', grid: 'rgba(148,178,230,0.07)', gridMajor: 'rgba(148,178,230,0.14)',
    body: '#cbd6e8', fill: 'rgba(148,178,230,0.06)', text1: '#e8eef8', text2: '#b8c4d8', muted: '#7d8aa3',
    accent: '#22d3ee', accent2: '#a78bfa', select: '#22d3ee',
    pos: '#4ade80', neg: '#f87171', neutral: [125, 138, 160], posRGB: [74, 222, 128], negRGB: [248, 113, 113],
    dot: '#fbbf24', hi: '#4ade80', lo: '#475569', hiFill: 'rgba(34,197,94,0.85)', loFill: 'rgba(71,85,105,0.9)', hiRGB: '74,222,128',
    junction: '#e8eef8', vLabel: '#8fa2ff', iLabel: '#4ade80',
  },
  amoled: {
    name: 'AMOLED Black',
    bg: '#000000', grid: 'rgba(148,178,230,0.06)', gridMajor: 'rgba(148,178,230,0.12)',
    body: '#d6deea', fill: 'rgba(148,178,230,0.05)', text1: '#f1f5f9', text2: '#c1ccdb', muted: '#7d8aa3',
    accent: '#22d3ee', accent2: '#a78bfa', select: '#22d3ee',
    pos: '#4ade80', neg: '#f87171', neutral: [120, 130, 150], posRGB: [74, 222, 128], negRGB: [248, 113, 113],
    dot: '#fbbf24', hi: '#4ade80', lo: '#475569', hiFill: 'rgba(34,197,94,0.85)', loFill: 'rgba(71,85,105,0.9)', hiRGB: '74,222,128',
    junction: '#f1f5f9', vLabel: '#8fa2ff', iLabel: '#4ade80',
  },
  light: {
    name: 'Blueprint Light',
    bg: '#f6f8fc', grid: 'rgba(30,64,175,0.07)', gridMajor: 'rgba(30,64,175,0.14)',
    body: '#1e293b', fill: 'rgba(30,64,175,0.04)', text1: '#0f172a', text2: '#334155', muted: '#64748b',
    accent: '#0891b2', accent2: '#7c3aed', select: '#0891b2',
    pos: '#16a34a', neg: '#dc2626', neutral: [100, 116, 139], posRGB: [22, 163, 74], negRGB: [220, 38, 38],
    dot: '#d97706', hi: '#16a34a', lo: '#94a3b8', hiFill: 'rgba(22,163,74,0.9)', loFill: 'rgba(100,116,139,0.85)', hiRGB: '22,163,74',
    junction: '#0f172a', vLabel: '#4338ca', iLabel: '#15803d',
  },
};
