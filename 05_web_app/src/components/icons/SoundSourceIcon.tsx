import React from 'react';

interface SoundSourceIconProps {
  cardId: string;
  size?: number;
  className?: string;
}

/**
 * 16 Recognizable Street Sound-Source Small Icons (24/32/48px safe).
 * Uniform 2.2px #1A1A1F stroke, rounded joins, crisp optical center of gravity.
 * Used across Card Backs, Track Slots, Pinball Toys, and Soundscape Cards!
 */
export const SOUND_SOURCE_ICON_SVG: Record<string, { label: string; inner: string }> = {
  // #01 竹板
  'card-01': {
    label: '竹板图标',
    inner: `
      <rect x="6" y="4" width="7" height="22" rx="2.5" transform="rotate(-12 9.5 15)" fill="#7C3AED" stroke="#1A1A1F" stroke-width="2.2"/>
      <rect x="18" y="4" width="7" height="22" rx="2.5" transform="rotate(12 21.5 15)" fill="#FFFDF8" stroke="#1A1A1F" stroke-width="2.2"/>
      <line x1="7" y1="13" x2="13" y2="12" stroke="#1A1A1F" stroke-width="1.8"/>
      <line x1="19" y1="12" x2="25" y2="13" stroke="#1A1A1F" stroke-width="1.8"/>
      <circle cx="16" cy="9" r="2.6" fill="#FF5C2B" stroke="#1A1A1F" stroke-width="1.8"/>
    `,
  },
  // #02 街机键
  'card-02': {
    label: '街机键图标',
    inner: `
      <rect x="4" y="19" width="24" height="8" rx="3" fill="#EDE7D9" stroke="#1A1A1F" stroke-width="2.2"/>
      <path d="M8 19 V12 C8 8.5 24 8.5 24 12 V19 Z" fill="#7C3AED" stroke="#1A1A1F" stroke-width="2.2" stroke-linejoin="round"/>
      <ellipse cx="16" cy="11.5" rx="6" ry="2.2" fill="#00D4AA" stroke="#1A1A1F" stroke-width="1.6"/>
    `,
  },
  // #03 栗子
  'card-03': {
    label: '糖炒栗子图标',
    inner: `
      <path d="M16 4 C23 9 26 16 24 23 C21 26 11 26 8 23 C6 16 9 9 16 4 Z" fill="#B45309" stroke="#1A1A1F" stroke-width="2.2" stroke-linejoin="round"/>
      <path d="M9 21 Q16 18 23 21 L22 25 Q16 27 10 25 Z" fill="#FFD60A" stroke="#1A1A1F" stroke-width="1.8"/>
      <path d="M15 8 L13 13 L18 14 L15 18" fill="none" stroke="#FFD60A" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    `,
  },
  // #04 狮鼓
  'card-04': {
    label: '狮鼓图标',
    inner: `
      <ellipse cx="16" cy="17" rx="11" ry="8.5" fill="#FF5C2B" stroke="#1A1A1F" stroke-width="2.2"/>
      <ellipse cx="16" cy="14" rx="10" ry="5.5" fill="#FFD60A" stroke="#1A1A1F" stroke-width="2.2"/>
      <line x1="7" y1="6" x2="14" y2="13" stroke="#1A1A1F" stroke-width="2.2" stroke-linecap="round"/>
      <line x1="25" y1="6" x2="18" y2="13" stroke="#1A1A1F" stroke-width="2.2" stroke-linecap="round"/>
    `,
  },
  // #05 车铃
  'card-05': {
    label: '车铃图标',
    inner: `
      <path d="M6 20 A10 10 0 0 1 26 20 Z" fill="#FFD60A" stroke="#1A1A1F" stroke-width="2.2" stroke-linejoin="round"/>
      <rect x="4" y="20" width="24" height="4.5" rx="2.2" fill="#FF5C2B" stroke="#1A1A1F" stroke-width="2"/>
      <line x1="23" y1="21" x2="28" y2="16" stroke="#1A1A1F" stroke-width="2.2" stroke-linecap="round"/>
      <circle cx="28" cy="16" r="2" fill="#00D4AA" stroke="#1A1A1F" stroke-width="1.5"/>
    `,
  },
  // #06 汽水拉环
  'card-06': {
    label: '汽水拉环图标',
    inner: `
      <rect x="9" y="10" width="14" height="17" rx="3" fill="#FF5C2B" stroke="#1A1A1F" stroke-width="2.2"/>
      <ellipse cx="16" cy="10" rx="7" ry="2.5" fill="#FFFDF8" stroke="#1A1A1F" stroke-width="2"/>
      <path d="M16 10 L21 4.5 A2.6 2.6 0 1 1 24.5 8 L19 10" fill="none" stroke="#1A1A1F" stroke-width="2" stroke-linecap="round"/>
      <circle cx="7" cy="7" r="1.8" fill="#00D4AA"/>
    `,
  },
  // #07 麻将
  'card-07': {
    label: '麻将牌图标',
    inner: `
      <rect x="8" y="6" width="16" height="20" rx="3" fill="#00D4AA" stroke="#1A1A1F" stroke-width="2.2"/>
      <rect x="6" y="4" width="16" height="20" rx="3" fill="#FFFDF8" stroke="#1A1A1F" stroke-width="2.2"/>
      <rect x="10" y="10" width="8" height="6" rx="1" fill="none" stroke="#FF5C2B" stroke-width="2"/>
      <line x1="14" y1="7" x2="14" y2="21" stroke="#FF5C2B" stroke-width="2" stroke-linecap="round"/>
    `,
  },
  // #08 拨浪鼓
  'card-08': {
    label: '拨浪鼓图标',
    inner: `
      <line x1="16" y1="19" x2="16" y2="28" stroke="#1A1A1F" stroke-width="3" stroke-linecap="round"/>
      <circle cx="16" cy="12" r="7.5" fill="#FF5C2B" stroke="#1A1A1F" stroke-width="2.2"/>
      <circle cx="16" cy="12" r="4.5" fill="#FFFDF8" stroke="#1A1A1F" stroke-width="1.6"/>
      <path d="M8.5 12 Q4.5 14 5.5 18" fill="none" stroke="#1A1A1F" stroke-width="1.8"/>
      <circle cx="5.5" cy="18.5" r="2.2" fill="#FFD60A" stroke="#1A1A1F" stroke-width="1.6"/>
      <path d="M23.5 12 Q27.5 14 26.5 18" fill="none" stroke="#1A1A1F" stroke-width="1.8"/>
      <circle cx="26.5" cy="18.5" r="2.2" fill="#00D4AA" stroke="#1A1A1F" stroke-width="1.6"/>
    `,
  },
  // #09 街机币
  'card-09': {
    label: '街机投币图标',
    inner: `
      <circle cx="16" cy="14" r="9" fill="#FFD60A" stroke="#1A1A1F" stroke-width="2.2"/>
      <rect x="13" y="11" width="6" height="6" rx="1" fill="#00D4AA" stroke="#1A1A1F" stroke-width="1.8"/>
      <rect x="6" y="24" width="20" height="4" rx="2" fill="#00D4AA" stroke="#1A1A1F" stroke-width="2"/>
    `,
  },
  // #10 铜勺
  'card-10': {
    label: '糖画铜勺图标',
    inner: `
      <line x1="6" y1="24" x2="18" y2="12" stroke="#1A1A1F" stroke-width="2.8" stroke-linecap="round"/>
      <ellipse cx="22" cy="9" rx="5.5" ry="4" transform="rotate(-35 22 9)" fill="#FFD60A" stroke="#1A1A1F" stroke-width="2.2"/>
      <path d="M22 14 Q27 19 20 23 Q15 26 22 28" fill="none" stroke="#FF5C2B" stroke-width="2.2" stroke-linecap="round"/>
    `,
  },
  // #11 古筝
  'card-11': {
    label: '赛博古筝图标',
    inner: `
      <rect x="4" y="10" width="24" height="12" rx="4" transform="rotate(-18 16 16)" fill="#00D4AA" stroke="#1A1A1F" stroke-width="2.2"/>
      <line x1="7" y1="16" x2="25" y2="10" stroke="#1A1A1F" stroke-width="1.6"/>
      <line x1="8" y1="20" x2="26" y2="14" stroke="#1A1A1F" stroke-width="1.6"/>
      <polygon points="15,12 18,17 12,17" fill="#FFD60A" stroke="#1A1A1F" stroke-width="1.4"/>
    `,
  },
  // #12 八音盒
  'card-12': {
    label: '摩天轮八音盒图标',
    inner: `
      <circle cx="16" cy="14" r="9" fill="none" stroke="#1A1A1F" stroke-width="2.4"/>
      <circle cx="16" cy="14" r="3" fill="#FFD60A" stroke="#1A1A1F" stroke-width="1.8"/>
      <circle cx="16" cy="5" r="2.3" fill="#00D4AA" stroke="#1A1A1F" stroke-width="1.6"/>
      <circle cx="25" cy="14" r="2.3" fill="#7C3AED" stroke="#1A1A1F" stroke-width="1.6"/>
      <circle cx="7" cy="14" r="2.3" fill="#FF5C2B" stroke="#1A1A1F" stroke-width="1.6"/>
      <path d="M10 27 L16 17 L22 27 Z" fill="none" stroke="#1A1A1F" stroke-width="2.2" stroke-linejoin="round"/>
    `,
  },
  // #13 铁板
  'card-13': {
    label: '夜市铁板图标',
    inner: `
      <rect x="4" y="16" width="24" height="5" rx="2" fill="#1A1A1F"/>
      <rect x="7" y="21" width="18" height="6" rx="2" fill="#FF5C2B" stroke="#1A1A1F" stroke-width="2"/>
      <path d="M10 12 Q8 8 11 5" fill="none" stroke="#FFD60A" stroke-width="2.2" stroke-linecap="round"/>
      <path d="M16 12 Q14 8 17 5" fill="none" stroke="#FFD60A" stroke-width="2.2" stroke-linecap="round"/>
      <path d="M22 12 Q20 8 23 5" fill="none" stroke="#FFD60A" stroke-width="2.2" stroke-linecap="round"/>
    `,
  },
  // #14 雨棚
  'card-14': {
    label: '铁皮雨棚图标',
    inner: `
      <path d="M4 15 L8 8 H24 L28 15 Z" fill="#7C3AED" stroke="#1A1A1F" stroke-width="2.2" stroke-linejoin="round"/>
      <line x1="12" y1="8" x2="10" y2="15" stroke="#FFFDF8" stroke-width="1.6"/>
      <line x1="16" y1="8" x2="16" y2="15" stroke="#FFFDF8" stroke-width="1.6"/>
      <line x1="20" y1="8" x2="22" y2="15" stroke="#FFFDF8" stroke-width="1.6"/>
      <circle cx="10" cy="22" r="2" fill="#00D4AA" stroke="#1A1A1F" stroke-width="1.4"/>
      <circle cx="16" cy="25" r="2" fill="#00D4AA" stroke="#1A1A1F" stroke-width="1.4"/>
      <circle cx="22" cy="21" r="2" fill="#00D4AA" stroke="#1A1A1F" stroke-width="1.4"/>
    `,
  },
  // #15 磁带
  'card-15': {
    label: '复古磁带图标',
    inner: `
      <rect x="4" y="8" width="24" height="16" rx="3" fill="#7C3AED" stroke="#1A1A1F" stroke-width="2.2"/>
      <rect x="7" y="11" width="18" height="7" rx="1.5" fill="#FFFDF8" stroke="#1A1A1F" stroke-width="1.6"/>
      <circle cx="12" cy="14.5" r="2" fill="#FFD60A" stroke="#1A1A1F" stroke-width="1.4"/>
      <circle cx="20" cy="14.5" r="2" fill="#00D4AA" stroke="#1A1A1F" stroke-width="1.4"/>
    `,
  },
  // #16 蝉
  'card-16': {
    label: '晚风蝉鸣图标',
    inner: `
      <ellipse cx="11" cy="16" rx="7" ry="4" transform="rotate(-30 11 16)" fill="#00D4AA" stroke="#1A1A1F" stroke-width="2"/>
      <ellipse cx="21" cy="16" rx="7" ry="4" transform="rotate(30 21 16)" fill="#7C3AED" stroke="#1A1A1F" stroke-width="2"/>
      <ellipse cx="16" cy="17" rx="4" ry="8" fill="#FFD60A" stroke="#1A1A1F" stroke-width="2"/>
    `,
  },
};

export const SoundSourceIcon: React.FC<SoundSourceIconProps> = ({
  cardId,
  size = 24,
  className = '',
}) => {
  const def = SOUND_SOURCE_ICON_SVG[cardId] ?? SOUND_SOURCE_ICON_SVG['card-01'];
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      role="img"
      aria-label={def.label}
      className={`shrink-0 block ${className}`}
      dangerouslySetInnerHTML={{ __html: def.inner }}
    />
  );
};
