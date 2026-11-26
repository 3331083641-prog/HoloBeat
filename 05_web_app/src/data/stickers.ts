export interface StickerDef {
  id: string;
  label: string;
  zhLabel: string;
  group: 'sound-source' | 'accent';
  rasterUrl: string;
  svgInner: string; // Fallback vector inside viewBox="0 0 64 64"
}

/**
 * 12 Matte Silkscreen Collector Stickers (8 Chinese Street Sound-Source Motifs + 4 Rhythm Accents).
 * Shared identically by Forge live overlay, 1200x1600 PNG export, and WebM Motion Card export.
 */
export const STICKER_PACK: StickerDef[] = [
  // === 声源母题贴纸 (Sound-Source Motifs) ===
  {
    id: 'clapper',
    label: '竹板',
    zhLabel: '双片竹板',
    group: 'sound-source',
    rasterUrl: '/assets/stickers/clapper.webp',
    svgInner: `
      <g transform="rotate(-14 26 34)">
        <rect x="14" y="10" width="16" height="44" rx="5" fill="#7C3AED" stroke="#1A1A1F" stroke-width="3.6"/>
        <line x1="14" y1="24" x2="30" y2="24" stroke="#1A1A1F" stroke-width="2.6"/>
        <line x1="14" y1="39" x2="30" y2="39" stroke="#1A1A1F" stroke-width="2.6"/>
      </g>
      <g transform="rotate(14 38 34)">
        <rect x="33" y="10" width="16" height="44" rx="5" fill="#FFFDF8" stroke="#1A1A1F" stroke-width="3.6"/>
        <line x1="33" y1="24" x2="49" y2="24" stroke="#1A1A1F" stroke-width="2.6"/>
        <line x1="33" y1="39" x2="49" y2="39" stroke="#1A1A1F" stroke-width="2.6"/>
      </g>
      <circle cx="32" cy="18" r="5" fill="#FF5C2B" stroke="#1A1A1F" stroke-width="2.8"/>
    `,
  },
  {
    id: 'bell',
    label: '车铃',
    zhLabel: '二八车铃',
    group: 'sound-source',
    rasterUrl: '/assets/stickers/bell.webp',
    svgInner: `
      <path d="M12 40 A20 20 0 0 1 52 40 Z" fill="#FFD60A" stroke="#1A1A1F" stroke-width="3.8" stroke-linejoin="round"/>
      <path d="M22 26 A12 12 0 0 1 32 23" fill="none" stroke="#FFFDF8" stroke-width="3.2" stroke-linecap="round"/>
      <rect x="8" y="40" width="48" height="8" rx="4" fill="#FF5C2B" stroke="#1A1A1F" stroke-width="3.4"/>
      <path d="M46 42 L56 34" stroke="#1A1A1F" stroke-width="4" stroke-linecap="round"/>
      <circle cx="56" cy="34" r="4.5" fill="#00D4AA" stroke="#1A1A1F" stroke-width="2.6"/>
      <circle cx="32" cy="16" r="4" fill="#FFFDF8" stroke="#1A1A1F" stroke-width="2.8"/>
    `,
  },
  {
    id: 'coin',
    label: '街机币',
    zhLabel: '像素街机币',
    group: 'sound-source',
    rasterUrl: '/assets/stickers/coin.webp',
    svgInner: `
      <circle cx="32" cy="32" r="23" fill="#FFD60A" stroke="#1A1A1F" stroke-width="4"/>
      <circle cx="32" cy="32" r="16" fill="none" stroke="#1A1A1F" stroke-width="2.4" stroke-dasharray="5 3"/>
      <rect x="25" y="25" width="14" height="14" rx="2" fill="#00D4AA" stroke="#1A1A1F" stroke-width="3"/>
    `,
  },
  {
    id: 'spoon',
    label: '铜勺',
    zhLabel: '糖画铜勺',
    group: 'sound-source',
    rasterUrl: '/assets/stickers/spoon.webp',
    svgInner: `
      <line x1="12" y1="50" x2="38" y2="24" stroke="#1A1A1F" stroke-width="6" stroke-linecap="round"/>
      <line x1="12" y1="50" x2="38" y2="24" stroke="#FFD60A" stroke-width="2.6" stroke-linecap="round"/>
      <ellipse cx="44" cy="19" rx="12" ry="9" transform="rotate(-35 44 19)" fill="#FF5C2B" stroke="#1A1A1F" stroke-width="3.5"/>
      <path d="M46 28 Q54 38 42 46 Q34 52 46 56" fill="none" stroke="#FFD60A" stroke-width="4" stroke-linecap="round"/>
    `,
  },
  {
    id: 'spatula',
    label: '铁板铲',
    zhLabel: '夜市铁板铲',
    group: 'sound-source',
    rasterUrl: '/assets/stickers/spatula.webp',
    svgInner: `
      <g transform="rotate(-25 32 32)">
        <rect x="26" y="34" width="12" height="22" rx="5" fill="#FF5C2B" stroke="#1A1A1F" stroke-width="3.5"/>
        <path d="M18 10 H46 L42 35 H22 Z" fill="#FFFDF8" stroke="#1A1A1F" stroke-width="3.6" stroke-linejoin="round"/>
        <line x1="25" y1="16" x2="39" y2="16" stroke="#1A1A1F" stroke-width="2.5" stroke-linecap="round"/>
      </g>
      <path d="M46 14 Q52 10 48 6" fill="none" stroke="#FFD60A" stroke-width="3.2" stroke-linecap="round"/>
    `,
  },
  {
    id: 'cassette',
    label: '磁带',
    zhLabel: '霓虹磁带轮',
    group: 'sound-source',
    rasterUrl: '/assets/stickers/cassette.webp',
    svgInner: `
      <rect x="6" y="14" width="52" height="36" rx="6" fill="#7C3AED" stroke="#1A1A1F" stroke-width="3.8"/>
      <rect x="12" y="20" width="40" height="16" rx="3" fill="#FFFDF8" stroke="#1A1A1F" stroke-width="2.8"/>
      <circle cx="23" cy="28" r="4.5" fill="#1A1A1F"/>
      <circle cx="23" cy="28" r="1.8" fill="#FFD60A"/>
      <circle cx="41" cy="28" r="4.5" fill="#1A1A1F"/>
      <circle cx="41" cy="28" r="1.8" fill="#00D4AA"/>
      <line x1="28" y1="28" x2="36" y2="28" stroke="#1A1A1F" stroke-width="2.8"/>
      <polygon points="18,50 22,42 42,42 46,50" fill="#1A1A1F"/>
    `,
  },
  {
    id: 'raindrop',
    label: '雨滴',
    zhLabel: '雨棚水滴',
    group: 'sound-source',
    rasterUrl: '/assets/stickers/raindrop.webp',
    svgInner: `
      <path d="M32 8 C32 8, 52 28, 52 40 C52 51, 43 58, 32 58 C21 58, 12 51, 12 40 C12 28, 32 8, 32 8 Z" fill="#00D4AA" stroke="#1A1A1F" stroke-width="3.8" stroke-linejoin="round"/>
      <path d="M24 38 C24 33, 27 28, 30 24" fill="none" stroke="#FFFDF8" stroke-width="3.2" stroke-linecap="round"/>
      <circle cx="25" cy="46" r="2.2" fill="#FFFDF8"/>
    `,
  },
  {
    id: 'cicada',
    label: '蝉翼',
    zhLabel: '晚风蝉翼',
    group: 'sound-source',
    rasterUrl: '/assets/stickers/cicada.webp',
    svgInner: `
      <ellipse cx="22" cy="34" rx="16" ry="9" transform="rotate(-32 22 34)" fill="#00D4AA" stroke="#1A1A1F" stroke-width="3.4"/>
      <ellipse cx="42" cy="34" rx="16" ry="9" transform="rotate(32 42 34)" fill="#7C3AED" stroke="#1A1A1F" stroke-width="3.4"/>
      <ellipse cx="32" cy="36" rx="8" ry="15" fill="#FFD60A" stroke="#1A1A1F" stroke-width="3.4"/>
      <circle cx="28" cy="25" r="2.2" fill="#1A1A1F"/>
      <circle cx="36" cy="25" r="2.2" fill="#1A1A1F"/>
    `,
  },

  // === 节奏情绪贴纸 (Rhythm Accents) ===
  {
    id: 'bolt',
    label: '闪电',
    zhLabel: '律动闪电',
    group: 'accent',
    rasterUrl: '/assets/stickers/bolt.webp',
    svgInner: `
      <polygon points="36,4 12,35 29,35 23,60 52,27 34,27" fill="#FFD60A" stroke="#1A1A1F" stroke-width="3.8" stroke-linejoin="round"/>
      <polygon points="33,12 20,31 30,31" fill="#FFFDF8" opacity="0.72"/>
    `,
  },
  {
    id: 'note',
    label: '音符',
    zhLabel: '双连音符',
    group: 'accent',
    rasterUrl: '/assets/stickers/note.webp',
    svgInner: `
      <path d="M24 44 V14 L50 10 V38" fill="none" stroke="#1A1A1F" stroke-width="4.2" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M24 14 L50 10 L50 21 L24 25 Z" fill="#00D4AA" stroke="#1A1A1F" stroke-width="3.4" stroke-linejoin="round"/>
      <ellipse cx="18" cy="46" rx="9.5" ry="7.5" fill="#00D4AA" stroke="#1A1A1F" stroke-width="3.4"/>
      <ellipse cx="44" cy="40" rx="9.5" ry="7.5" fill="#00D4AA" stroke="#1A1A1F" stroke-width="3.4"/>
    `,
  },
  {
    id: 'starburst',
    label: '星芒',
    zhLabel: '全息星芒',
    group: 'accent',
    rasterUrl: '/assets/stickers/starburst.webp',
    svgInner: `
      <polygon points="32,5 39,22 57,15 47,30 59,40 42,43 46,58 32,48 18,58 22,43 5,40 17,30 7,15 25,22" fill="#FFD60A" stroke="#1A1A1F" stroke-width="3.4" stroke-linejoin="round"/>
      <circle cx="32" cy="33" r="6" fill="#FFFDF8"/>
    `,
  },
  {
    id: 'crown',
    label: '皇冠',
    zhLabel: '典藏皇冠',
    group: 'accent',
    rasterUrl: '/assets/stickers/crown.webp',
    svgInner: `
      <polygon points="8,48 12,18 24,31 32,12 40,31 52,18 56,48" fill="#FFD60A" stroke="#1A1A1F" stroke-width="3.8" stroke-linejoin="round"/>
      <rect x="8" y="45" width="48" height="8" rx="3" fill="#FF5C2B" stroke="#1A1A1F" stroke-width="3.2"/>
      <circle cx="12" cy="15" r="3.2" fill="#FFFDF8" stroke="#1A1A1F" stroke-width="2.4"/>
      <circle cx="32" cy="10" r="3.6" fill="#FFFDF8" stroke="#1A1A1F" stroke-width="2.4"/>
      <circle cx="52" cy="15" r="3.2" fill="#FFFDF8" stroke="#1A1A1F" stroke-width="2.4"/>
    `,
  },
];

// Legacy sticker aliases so older v2 project files restore gracefully!
const LEGACY_STICKER_MAP: Record<string, string> = {
  heart: 'starburst',
  lantern: 'bell',
  flame: 'spatula',
};

export function getStickerById(id: string): StickerDef {
  const mapped = LEGACY_STICKER_MAP[id] ?? id;
  return STICKER_PACK.find((s) => s.id === mapped) ?? STICKER_PACK[0];
}

export function getStickerRasterUrl(id: string): string {
  const def = getStickerById(id);
  return def.rasterUrl;
}

/**
 * Shared loader for PNG Poster & WebM Motion Card exporters.
 * Loads the real die-cut matte WebP sticker first and falls back smoothly to inline SVG.
 */
export function loadStickerImage(id: string): Promise<HTMLImageElement> {
  const def = getStickerById(id);
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => {
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="240" height="240">${def.svgInner}</svg>`;
      const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const fb = new Image();
      fb.onload = () => {
        URL.revokeObjectURL(url);
        resolve(fb);
      };
      fb.onerror = (err) => {
        URL.revokeObjectURL(url);
        reject(err);
      };
      fb.src = url;
    };
    img.src = def.rasterUrl;
  });
}
