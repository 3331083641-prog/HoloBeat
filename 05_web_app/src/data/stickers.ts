export interface StickerDef {
  id: string;
  label: string;
  zhLabel: string;
  svgInner: string; // inside viewBox="0 0 64 64"
}

export const STICKER_PACK: StickerDef[] = [
  {
    id: 'bolt',
    label: '闪电',
    zhLabel: '闪电',
    svgInner: `
      <polygon points="36,4 12,35 29,35 23,60 52,27 34,27" fill="#FFD60A" stroke="#1A1A1F" stroke-width="4" stroke-linejoin="round"/>
      <polygon points="33,12 20,31 30,31" fill="#FFFBEB" opacity="0.7"/>
    `,
  },
  {
    id: 'note',
    label: '音符',
    zhLabel: '笑脸音符',
    svgInner: `
      <path d="M26 44 V14 L52 10 V38" fill="none" stroke="#1A1A1F" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M26 14 L52 10 L52 21 L26 25 Z" fill="#00D4AA" stroke="#1A1A1F" stroke-width="3.5" stroke-linejoin="round"/>
      <ellipse cx="19" cy="46" rx="10" ry="8" fill="#00D4AA" stroke="#1A1A1F" stroke-width="3.5"/>
      <ellipse cx="45" cy="40" rx="10" ry="8" fill="#00D4AA" stroke="#1A1A1F" stroke-width="3.5"/>
      <circle cx="16" cy="44" r="1.6" fill="#1A1A1F"/>
      <circle cx="22" cy="44" r="1.6" fill="#1A1A1F"/>
      <path d="M16 48 Q19 51 22 48" fill="none" stroke="#1A1A1F" stroke-width="2" stroke-linecap="round"/>
    `,
  },
  {
    id: 'cassette',
    label: '磁带',
    zhLabel: '复古磁带',
    svgInner: `
      <rect x="6" y="14" width="52" height="36" rx="6" fill="#C084FC" stroke="#1A1A1F" stroke-width="4"/>
      <rect x="12" y="20" width="40" height="16" rx="3" fill="#FFFDF8" stroke="#1A1A1F" stroke-width="3"/>
      <circle cx="23" cy="28" r="4.5" fill="#1A1A1F"/>
      <circle cx="23" cy="28" r="1.8" fill="#FFD60A"/>
      <circle cx="41" cy="28" r="4.5" fill="#1A1A1F"/>
      <circle cx="41" cy="28" r="1.8" fill="#FFD60A"/>
      <line x1="28" y1="28" x2="36" y2="28" stroke="#1A1A1F" stroke-width="3"/>
      <polygon points="18,50 22,42 42,42 46,50" fill="#181820" stroke="#1A1A1F" stroke-width="2.5"/>
    `,
  },
  {
    id: 'starburst',
    label: '星芒',
    zhLabel: '星芒',
    svgInner: `
      <polygon points="32,4 39,20 56,12 46,28 60,38 43,42 48,59 32,48 16,59 21,42 4,38 18,28 8,12 25,20" fill="#FFD60A" stroke="#1A1A1F" stroke-width="3.5" stroke-linejoin="round"/>
      <circle cx="32" cy="33" r="6" fill="#FFFDF8" opacity="0.8"/>
    `,
  },
  {
    id: 'heart',
    label: '爱心',
    zhLabel: '像素爱心',
    svgInner: `
      <path d="M16 12 H26 V18 H38 V12 H48 V18 H54 V32 H48 V38 H42 V44 H36 V50 H28 V44 H22 V38 H16 V32 H10 V18 H16 Z" fill="#FF3D9A" stroke="#1A1A1F" stroke-width="4" stroke-linejoin="miter"/>
      <rect x="16" y="20" width="6" height="6" fill="#FFFDF8"/>
    `,
  },
  {
    id: 'lantern',
    label: '灯笼',
    zhLabel: '市井灯笼',
    svgInner: `
      <rect x="24" y="6" width="16" height="7" rx="2" fill="#FFD60A" stroke="#1A1A1F" stroke-width="3"/>
      <ellipse cx="32" cy="31" rx="20" ry="18" fill="#FF5C2B" stroke="#1A1A1F" stroke-width="4"/>
      <ellipse cx="32" cy="31" rx="11" ry="18" fill="none" stroke="#1A1A1F" stroke-width="2.5"/>
      <rect x="24" y="48" width="16" height="6" rx="2" fill="#FFD60A" stroke="#1A1A1F" stroke-width="3"/>
      <line x1="32" y1="54" x2="32" y2="61" stroke="#FF5C2B" stroke-width="4" stroke-linecap="round"/>
      <text x="32" y="36" text-anchor="middle" font-size="16" font-weight="900" fill="#FFFDF8" font-family="sans-serif">音</text>
    `,
  },
  {
    id: 'flame',
    label: '火焰',
    zhLabel: '火焰',
    svgInner: `
      <path d="M34 5 C37 18, 52 22, 51 39 C50 51, 42 58, 32 58 C20 58, 12 49, 13 37 C14 27, 21 22, 23 14 C26 20, 29 22, 31 19 C31 13, 32 8, 34 5 Z" fill="#FF5C2B" stroke="#1A1A1F" stroke-width="4" stroke-linejoin="round"/>
      <path d="M33 28 C37 35, 42 38, 41 46 C40 52, 36 55, 32 55 C27 55, 23 51, 24 44 C25 38, 30 35, 33 28 Z" fill="#FFD60A" stroke="#1A1A1F" stroke-width="2.5"/>
    `,
  },
  {
    id: 'crown',
    label: '皇冠',
    zhLabel: '潮玩皇冠',
    svgInner: `
      <polygon points="8,48 12,18 24,31 32,12 40,31 52,18 56,48" fill="#FFD60A" stroke="#1A1A1F" stroke-width="4" stroke-linejoin="round"/>
      <rect x="8" y="45" width="48" height="8" rx="3" fill="#FF5C2B" stroke="#1A1A1F" stroke-width="3.5"/>
      <circle cx="12" cy="15" r="3.5" fill="#FFFDF8" stroke="#1A1A1F" stroke-width="2.5"/>
      <circle cx="32" cy="10" r="4" fill="#FFFDF8" stroke="#1A1A1F" stroke-width="2.5"/>
      <circle cx="52" cy="15" r="3.5" fill="#FFFDF8" stroke="#1A1A1F" stroke-width="2.5"/>
    `,
  },
];

export function getStickerById(id: string): StickerDef {
  return STICKER_PACK.find((s) => s.id === id) ?? STICKER_PACK[0];
}
