// Colour themes for the schematic canvas (the RAPTI website palette).

export const THEMES = {
  light: {
    name: 'RAPTI Day',
    bg: '#fffaf0', grid: 'rgba(29,75,255,0.08)', gridMajor: 'rgba(29,75,255,0.17)',
    body: '#0b1026', fill: 'rgba(29,75,255,0.05)', text1: '#0b1026', text2: '#3b4266', muted: '#5a6183',
    accent: '#1d4bff', accent2: '#c2360f', select: '#1d4bff',
    pos: '#0b8f6b', neg: '#d6401d', neutral: [110, 117, 150], posRGB: [11, 143, 107], negRGB: [214, 64, 29],
    dot: '#e89a00', hi: '#0b8f6b', lo: '#a3a9c4', hiFill: 'rgba(11,143,107,0.9)', loFill: 'rgba(110,117,150,0.85)', hiRGB: '11,143,107',
    junction: '#0b1026', vLabel: '#1438e0', iLabel: '#0b7a5c',
  },
  dark: {
    name: 'RAPTI Night',
    bg: '#0b1026', grid: 'rgba(170,185,255,0.07)', gridMajor: 'rgba(170,185,255,0.15)',
    body: '#d5dbf7', fill: 'rgba(170,185,255,0.07)', text1: '#f4f6ff', text2: '#c5cbee', muted: '#8f98c8',
    accent: '#ffd92e', accent2: '#6d8cff', select: '#ffd92e',
    pos: '#3ddc97', neg: '#ff7a5f', neutral: [143, 152, 200], posRGB: [61, 220, 151], negRGB: [255, 122, 95],
    dot: '#ffd92e', hi: '#3ddc97', lo: '#4a5386', hiFill: 'rgba(20,199,150,0.85)', loFill: 'rgba(74,83,134,0.9)', hiRGB: '61,220,151',
    junction: '#f4f6ff', vLabel: '#9db1ff', iLabel: '#3ddc97',
  },
  amoled: {
    name: 'Black',
    bg: '#000000', grid: 'rgba(170,185,255,0.06)', gridMajor: 'rgba(170,185,255,0.13)',
    body: '#dfe4f8', fill: 'rgba(170,185,255,0.05)', text1: '#f4f6ff', text2: '#c5cbee', muted: '#8f98c8',
    accent: '#ffd92e', accent2: '#6d8cff', select: '#ffd92e',
    pos: '#3ddc97', neg: '#ff7a5f', neutral: [135, 144, 190], posRGB: [61, 220, 151], negRGB: [255, 122, 95],
    dot: '#ffd92e', hi: '#3ddc97', lo: '#4a5386', hiFill: 'rgba(20,199,150,0.85)', loFill: 'rgba(74,83,134,0.9)', hiRGB: '61,220,151',
    junction: '#f4f6ff', vLabel: '#9db1ff', iLabel: '#3ddc97',
  },
};
