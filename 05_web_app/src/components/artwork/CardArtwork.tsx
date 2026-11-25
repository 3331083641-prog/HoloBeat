import React from 'react';

export interface ArtLayers {
  bg: string;
  mid: string;
  hero: string;
}

/**
 * 17 original Neo-Brutalist Chinese Urban Street-Toy SVG Mascots
 * ViewBox: 0 0 260 320
 * Split into 3 distinct Z-depth layers (bg, mid, hero) for 3D parallax + offscreen PNG export!
 */
export const ARTWORK_LAYERS: Record<string, ArtLayers> = {
  // #05 二八大杠车铃 — Benchmark #2: Hemispherical Brass Bell Dome + Thumb Lever + Handlebar Clamp
  'street-bell': {
    bg: `
      <defs>
        <linearGradient id="sb-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#FFF4E6"/>
          <stop offset="55%" stop-color="#FFE1CC"/>
          <stop offset="100%" stop-color="#FF5C2B"/>
        </linearGradient>
      </defs>
      <rect width="260" height="320" fill="url(#sb-sky)"/>
      <!-- Subtle Alley Brick Arch Silhouette -->
      <path d="M18 290 V135 A112 112 0 0 1 242 135 V290 Z" fill="#FFFDF8" opacity="0.55" stroke="#1A1A1F" stroke-width="3"/>
      <ellipse cx="130" cy="264" rx="92" ry="18" fill="#1A1A1F" opacity="0.14"/>
    `,
    mid: `
      <!-- Crisp Acoustic Ring Waves around Bell Dome -->
      <path d="M38 118 A98 98 0 0 1 78 52" fill="none" stroke="#FF5C2B" stroke-width="4.5" stroke-linecap="round"/>
      <path d="M222 118 A98 98 0 0 0 182 52" fill="none" stroke="#00D4AA" stroke-width="4.5" stroke-linecap="round"/>
      <circle cx="48" cy="72" r="6" fill="#FFD60A" stroke="#1A1A1F" stroke-width="2.5"/>
      <circle cx="212" cy="74" r="5.5" fill="#00D4AA" stroke="#1A1A1F" stroke-width="2.5"/>
    `,
    hero: `
      <!-- Curved Vintage Bicycle Handlebar Tube & Rubber Grips -->
      <path d="M22 232 Q130 202 238 232" fill="none" stroke="#1A1A1F" stroke-width="22" stroke-linecap="round"/>
      <path d="M22 232 Q130 202 238 232" fill="none" stroke="#E2E8F0" stroke-width="13" stroke-linecap="round"/>
      <path d="M20 232 Q42 225 60 221" fill="none" stroke="#1A1A1F" stroke-width="24" stroke-linecap="round"/>
      <path d="M240 232 Q218 225 200 221" fill="none" stroke="#1A1A1F" stroke-width="24" stroke-linecap="round"/>
      <!-- Steel Handlebar Clamp Collar & Bolts -->
      <rect x="104" y="196" width="52" height="44" rx="12" fill="#94A3B8" stroke="#1A1A1F" stroke-width="4.5"/>
      <circle cx="116" cy="218" r="4.5" fill="#FFFDF8" stroke="#1A1A1F" stroke-width="2.5"/>
      <circle cx="144" cy="218" r="4.5" fill="#FFFDF8" stroke="#1A1A1F" stroke-width="2.5"/>
      <!-- Spring Thumb Striker Lever (Right Side — Key Sounding Action!) -->
      <path d="M188 182 L226 154" stroke="#1A1A1F" stroke-width="12" stroke-linecap="round"/>
      <path d="M188 182 L226 154" stroke="#CBD5E1" stroke-width="5" stroke-linecap="round"/>
      <circle cx="228" cy="152" r="14" fill="#00D4AA" stroke="#1A1A1F" stroke-width="4"/>
      <circle cx="224" cy="148" r="4" fill="#FFFDF8"/>
      <!-- Bell Lower Base Collar -->
      <rect x="52" y="176" width="156" height="24" rx="12" fill="#FF5C2B" stroke="#1A1A1F" stroke-width="4.5"/>
      <line x1="72" y1="188" x2="188" y2="188" stroke="#FFFDF8" stroke-width="3" stroke-linecap="round" opacity="0.5"/>
      <!-- Hemispherical Brass Bell Dome Character -->
      <path d="M56 176 A74 74 0 0 1 204 176 Z" fill="#FFD60A" stroke="#1A1A1F" stroke-width="5" stroke-linejoin="round"/>
      <!-- Crisp Hard-Edge Specular Arc -->
      <path d="M84 128 A52 52 0 0 1 132 108" fill="none" stroke="#FFFDF8" stroke-width="8" stroke-linecap="round" opacity="0.85"/>
      <!-- Top Finial Cap Nut -->
      <rect x="116" y="88" width="28" height="16" rx="8" fill="#FF5C2B" stroke="#1A1A1F" stroke-width="4"/>
      <circle cx="130" cy="94" r="4" fill="#FFFDF8"/>
      <!-- Witty Restrained Toy Expression Embedded on Dome -->
      <ellipse cx="106" cy="146" rx="7" ry="8.5" fill="#1A1A1F"/>
      <ellipse cx="154" cy="146" rx="7" ry="8.5" fill="#1A1A1F"/>
      <circle cx="103.5" cy="143" r="2.6" fill="#FFFDF8"/>
      <circle cx="151.5" cy="143" r="2.6" fill="#FFFDF8"/>
      <circle cx="88" cy="158" r="7" fill="#FF5C2B" opacity="0.45"/>
      <circle cx="172" cy="158" r="7" fill="#FF5C2B" opacity="0.45"/>
      <path d="M118 158 Q130 168 142 158" fill="none" stroke="#1A1A1F" stroke-width="4.2" stroke-linecap="round"/>
    `,
  },

  // #01 弄堂竹板梆子 — Benchmark #1: Twin Bamboo Clapper Slats + Nodes + Red Cord Knot
  'bamboo-cat': {
    bg: `
      <defs>
        <linearGradient id="bc-bg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#F5F0FF"/>
          <stop offset="55%" stop-color="#DDD6FE"/>
          <stop offset="100%" stop-color="#7C3AED"/>
        </linearGradient>
      </defs>
      <rect width="260" height="320" fill="url(#bc-bg)"/>
      <!-- Subtle Alley Window Lattice Backdrop -->
      <rect x="26" y="34" width="208" height="232" rx="22" fill="#FFFDF8" opacity="0.52" stroke="#1A1A1F" stroke-width="3"/>
      <line x1="130" y1="34" x2="130" y2="266" stroke="#7C3AED" stroke-width="2" opacity="0.22"/>
      <ellipse cx="130" cy="268" rx="78" ry="14" fill="#1A1A1F" opacity="0.14"/>
    `,
    mid: `
      <!-- Rhythmic Clapping Impact Sparks -->
      <path d="M126 172 L106 164 M134 172 L154 164" stroke="#FFD60A" stroke-width="5" stroke-linecap="round"/>
      <polygon points="44,86 49,96 60,98 51,104 54,114 44,108 34,114 37,104 28,98 39,96" fill="#FFD60A" stroke="#1A1A1F" stroke-width="2.5"/>
      <rect x="200" y="92" width="16" height="16" rx="4" fill="#00D4AA" stroke="#1A1A1F" stroke-width="2.5" transform="rotate(18 208 100)"/>
    `,
    hero: `
      <!-- Back Bamboo Clapper Slat (Angled Right in Clapping Stance) -->
      <g transform="translate(148, 168) rotate(16)">
        <rect x="-28" y="-96" width="56" height="192" rx="18" fill="#7C3AED" stroke="#1A1A1F" stroke-width="5"/>
        <!-- Bamboo Node Rings -->
        <rect x="-32" y="-36" width="64" height="11" rx="5.5" fill="#A78BFA" stroke="#1A1A1F" stroke-width="3.5"/>
        <rect x="-32" y="34" width="64" height="11" rx="5.5" fill="#A78BFA" stroke="#1A1A1F" stroke-width="3.5"/>
        <!-- Hard-edge highlight -->
        <line x1="14" y1="-80" x2="14" y2="78" stroke="#FFFDF8" stroke-width="5" stroke-linecap="round" opacity="0.35"/>
      </g>
      <!-- Front Bamboo Clapper Slat (Angled Left with Character Expression) -->
      <g transform="translate(110, 166) rotate(-13)">
        <rect x="-30" y="-100" width="60" height="200" rx="18" fill="#FFFDF8" stroke="#1A1A1F" stroke-width="5"/>
        <!-- Warm Bamboo Grain Band -->
        <rect x="-24" y="-92" width="14" height="184" rx="7" fill="#EDE7D9"/>
        <!-- Distinct Bamboo Nodes -->
        <rect x="-34" y="-32" width="68" height="12" rx="6" fill="#00D4AA" stroke="#1A1A1F" stroke-width="3.8"/>
        <rect x="-34" y="36" width="68" height="12" rx="6" fill="#FFD60A" stroke="#1A1A1F" stroke-width="3.8"/>
        <!-- Cord Eyelet Hole -->
        <circle cx="0" cy="-76" r="7" fill="#1A1A1F"/>
        <!-- Witty Toy Expression in Upper Bamboo Segment -->
        <circle cx="-11" cy="-54" r="5.5" fill="#1A1A1F"/>
        <circle cx="13" cy="-54" r="5.5" fill="#1A1A1F"/>
        <circle cx="-13" cy="-56" r="2" fill="#FFFDF8"/>
        <circle cx="11" cy="-56" r="2" fill="#FFFDF8"/>
        <path d="M-7 -42 Q1 -35 9 -42" fill="none" stroke="#1A1A1F" stroke-width="3.8" stroke-linecap="round"/>
      </g>
      <!-- Red Traditional Cord & Decorative Knot Binding the Twin Slats -->
      <path d="M94 90 Q128 60 156 88" fill="none" stroke="#FF5C2B" stroke-width="8" stroke-linecap="round"/>
      <path d="M94 90 Q128 60 156 88" fill="none" stroke="#1A1A1F" stroke-width="2.5" stroke-linecap="round"/>
      <circle cx="128" cy="70" r="11" fill="#FF5C2B" stroke="#1A1A1F" stroke-width="3.8"/>
      <path d="M122 59 Q114 42 128 46 Q142 42 134 59" fill="none" stroke="#FF5C2B" stroke-width="5.5" stroke-linecap="round"/>
      <path d="M122 59 Q114 42 128 46 Q142 42 134 59" fill="none" stroke="#1A1A1F" stroke-width="2" stroke-linecap="round"/>
      <!-- Crisp Clack Action Accent Lines -->
      <path d="M132 198 L146 194 M130 212 L148 214" stroke="#FFD60A" stroke-width="4.5" stroke-linecap="round"/>
    `,
  },

  // #02 老式街机拍键 — Concave Mechanical Arcade Push-Button Character
  'arcade-bot': {
    bg: `
      <defs>
        <linearGradient id="ab-bg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#1E1B4B"/>
          <stop offset="60%" stop-color="#4C1D95"/>
          <stop offset="100%" stop-color="#7C3AED"/>
        </linearGradient>
      </defs>
      <rect width="260" height="320" fill="url(#ab-bg)"/>
      <g stroke="#00D4AA" stroke-width="1.5" opacity="0.28">
        <line x1="0" y1="226" x2="260" y2="226"/>
        <line x1="0" y1="256" x2="260" y2="256"/>
        <line x1="65" y1="200" x2="20" y2="320"/>
        <line x1="130" y1="200" x2="130" y2="320"/>
        <line x1="195" y1="200" x2="240" y2="320"/>
      </g>
    `,
    mid: `
      <polygon points="40,68 46,78 56,80 47,86 49,96 40,90 31,96 33,86 24,80 34,78" fill="#FFD60A" stroke="#1A1A1F" stroke-width="2.5"/>
      <rect x="202" y="76" width="20" height="20" rx="4" fill="#00D4AA" stroke="#1A1A1F" stroke-width="3" transform="rotate(14 212 86)"/>
    `,
    hero: `
      <!-- Microswitch Plinth Base -->
      <rect x="78" y="212" width="104" height="54" rx="12" fill="#EDE7D9" stroke="#1A1A1F" stroke-width="4.5"/>
      <rect x="102" y="248" width="12" height="24" rx="3" fill="#FFD60A" stroke="#1A1A1F" stroke-width="3.5"/>
      <rect x="146" y="248" width="12" height="24" rx="3" fill="#FFD60A" stroke="#1A1A1F" stroke-width="3.5"/>
      <!-- Stepped Bezel Collar -->
      <ellipse cx="130" cy="204" rx="88" ry="28" fill="#1A1A1F"/>
      <ellipse cx="130" cy="196" rx="86" ry="26" fill="#FFFDF8" stroke="#1A1A1F" stroke-width="4.5"/>
      <!-- Tall Cylindrical Concave Arcade Button Cap -->
      <path d="M58 134 V188 A72 22 0 0 0 202 188 V134 Z" fill="#7C3AED" stroke="#1A1A1F" stroke-width="5" stroke-linejoin="round"/>
      <ellipse cx="130" cy="134" rx="72" ry="24" fill="#A78BFA" stroke="#1A1A1F" stroke-width="5"/>
      <ellipse cx="130" cy="134" rx="54" ry="15" fill="#00D4AA" stroke="#1A1A1F" stroke-width="3.5"/>
      <!-- Pixel Eyes on Button Skirt -->
      <rect x="94" y="160" width="16" height="16" rx="3" fill="#FFFDF8" stroke="#1A1A1F" stroke-width="3"/>
      <rect x="150" y="160" width="16" height="16" rx="3" fill="#FFFDF8" stroke="#1A1A1F" stroke-width="3"/>
      <rect x="100" y="165" width="7" height="7" fill="#1A1A1F"/>
      <rect x="156" y="165" width="7" height="7" fill="#1A1A1F"/>
      <path d="M118 184 Q130 193 142 184" fill="none" stroke="#FFD60A" stroke-width="4.5" stroke-linecap="round"/>
    `,
  },

  // #03 CHESTNUT POP — Roasted Street Chestnut Kid
  'chestnut-pop': {
    bg: `
      <defs>
        <linearGradient id="cp-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#FF5C2B"/>
          <stop offset="55%" stop-color="#F59E0B"/>
          <stop offset="100%" stop-color="#7C3AED"/>
        </linearGradient>
      </defs>
      <rect width="260" height="320" fill="url(#cp-bg)"/>
      <circle cx="130" cy="170" r="105" fill="#FFD60A" opacity="0.22"/>
    `,
    mid: `
      <path d="M40 245 Q130 220 220 245" fill="none" stroke="#1A1A1F" stroke-width="6"/>
      <polygon points="48,72 56,92 36,82 58,82 40,94" fill="#FFFDF8" opacity="0.8"/>
      <polygon points="212,86 220,106 200,96 222,96 204,108" fill="#FFD60A"/>
    `,
    hero: `
      <!-- Iron Wok Pan -->
      <path d="M32 214 Q130 296 228 214 Z" fill="#181820" stroke="#1A1A1F" stroke-width="4.5"/>
      <ellipse cx="130" cy="214" rx="98" ry="18" fill="#3F3F46" stroke="#1A1A1F" stroke-width="4"/>
      <!-- Flame Aura -->
      <path d="M72 194 C60 140, 100 105, 130 62 C160 105, 200 140, 188 194 Z" fill="#FF3B30" stroke="#1A1A1F" stroke-width="4"/>
      <!-- Chestnut Mascot -->
      <path d="M130 78 C176 112, 188 164, 174 206 C158 220, 102 220, 86 206 C72 164, 84 112, 130 78 Z" fill="#92400E" stroke="#1A1A1F" stroke-width="4.5" stroke-linejoin="round"/>
      <path d="M88 188 Q130 174 172 188 L170 208 Q130 220 90 208 Z" fill="#FDE68A" stroke="#1A1A1F" stroke-width="3.5"/>
      <!-- Pop Crack & Cool Eyes -->
      <path d="M126 88 L118 110 L134 114 L126 130" fill="none" stroke="#FFD60A" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
      <circle cx="110" cy="150" r="7" fill="#1A1A1F"/>
      <circle cx="150" cy="150" r="7" fill="#1A1A1F"/>
      <circle cx="108" cy="147" r="2.5" fill="#FFFDF8"/>
      <circle cx="148" cy="147" r="2.5" fill="#FFFDF8"/>
      <path d="M116 168 Q130 182 144 168" fill="none" stroke="#1A1A1F" stroke-width="4" stroke-linecap="round"/>
    `,
  },

  // #04 LION DRUM — Chinese Street Dancing Lion Head
  'lion-drum': {
    bg: `
      <defs>
        <linearGradient id="ld-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#FF3B30"/>
          <stop offset="50%" stop-color="#FFD60A"/>
          <stop offset="100%" stop-color="#00D4AA"/>
        </linearGradient>
      </defs>
      <rect width="260" height="320" fill="url(#ld-bg)"/>
      <circle cx="130" cy="155" r="102" fill="#FFFDF8" opacity="0.24"/>
    `,
    mid: `
      <path d="M14 140 Q36 122 58 140 Q36 158 14 140 Z" fill="#FFD60A" stroke="#1A1A1F" stroke-width="3"/>
      <path d="M202 140 Q224 122 246 140 Q224 158 202 140 Z" fill="#FFD60A" stroke="#1A1A1F" stroke-width="3"/>
    `,
    hero: `
      <!-- Mane Puffs -->
      <g fill="#FFFDF8" stroke="#1A1A1F" stroke-width="4">
        <circle cx="62" cy="126" r="24"/>
        <circle cx="198" cy="126" r="24"/>
        <circle cx="66" cy="176" r="24"/>
        <circle cx="194" cy="176" r="24"/>
        <circle cx="130" cy="76" r="24"/>
      </g>
      <!-- Horn -->
      <polygon points="130,44 114,88 146,88" fill="#FFD60A" stroke="#1A1A1F" stroke-width="4" stroke-linejoin="round"/>
      <!-- Lion Face -->
      <rect x="66" y="84" width="128" height="114" rx="44" fill="#FF3B30" stroke="#1A1A1F" stroke-width="4.5"/>
      <!-- Forehead Mirror -->
      <circle cx="130" cy="108" r="14" fill="#00D4AA" stroke="#1A1A1F" stroke-width="3.5"/>
      <!-- Big Expressive Eyes -->
      <circle cx="96" cy="142" r="20" fill="#FFFDF8" stroke="#1A1A1F" stroke-width="4"/>
      <circle cx="164" cy="142" r="20" fill="#FFFDF8" stroke="#1A1A1F" stroke-width="4"/>
      <circle cx="100" cy="142" r="9" fill="#1A1A1F"/>
      <circle cx="160" cy="142" r="9" fill="#1A1A1F"/>
      <circle cx="97" cy="138" r="3.5" fill="#FFFDF8"/>
      <circle cx="157" cy="138" r="3.5" fill="#FFFDF8"/>
      <!-- Nose & Roaring Mouth -->
      <ellipse cx="130" cy="164" rx="18" ry="12" fill="#00D4AA" stroke="#1A1A1F" stroke-width="3.5"/>
      <path d="M84 186 Q130 226 176 186 Z" fill="#181820" stroke="#1A1A1F" stroke-width="4"/>
      <rect x="98" y="186" width="14" height="12" rx="2" fill="#FFFDF8" stroke="#1A1A1F" stroke-width="2.5"/>
      <rect x="148" y="186" width="14" height="12" rx="2" fill="#FFFDF8" stroke="#1A1A1F" stroke-width="2.5"/>
      <ellipse cx="130" cy="204" rx="16" ry="8" fill="#FF3D9A"/>
      <!-- Street Drum Underneath -->
      <ellipse cx="130" cy="250" rx="68" ry="24" fill="#FFD60A" stroke="#1A1A1F" stroke-width="4"/>
      <path d="M62 250 L68 274 Q130 290 192 274 L198 250 Z" fill="#FF5C2B" stroke="#1A1A1F" stroke-width="4"/>
    `,
  },

  // #06 SODA FROG — Street Graffiti Soda Frog
  'soda-frog': {
    bg: `
      <defs>
        <linearGradient id="sf-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#00D4AA"/>
          <stop offset="55%" stop-color="#38BDF8"/>
          <stop offset="100%" stop-color="#7C3AED"/>
        </linearGradient>
      </defs>
      <rect width="260" height="320" fill="url(#sf-bg)"/>
      <circle cx="48" cy="96" r="20" fill="#FFFDF8" opacity="0.35"/>
      <circle cx="212" cy="76" r="14" fill="#FFFDF8" opacity="0.35"/>
      <circle cx="198" cy="128" r="9" fill="#FFD60A" opacity="0.5"/>
    `,
    mid: `
      <circle cx="52" cy="212" r="10" fill="#FFD60A" stroke="#1A1A1F" stroke-width="2.5"/>
      <circle cx="218" cy="198" r="12" fill="#FF3D9A" stroke="#1A1A1F" stroke-width="2.5"/>
    `,
    hero: `
      <!-- Frog Eyes on Top -->
      <circle cx="94" cy="94" r="28" fill="#00D4AA" stroke="#1A1A1F" stroke-width="4.5"/>
      <circle cx="166" cy="94" r="28" fill="#00D4AA" stroke="#1A1A1F" stroke-width="4.5"/>
      <circle cx="94" cy="94" r="17" fill="#FFFDF8" stroke="#1A1A1F" stroke-width="3.5"/>
      <circle cx="166" cy="94" r="17" fill="#FFFDF8" stroke="#1A1A1F" stroke-width="3.5"/>
      <circle cx="98" cy="94" r="8" fill="#1A1A1F"/>
      <circle cx="162" cy="94" r="8" fill="#1A1A1F"/>
      <!-- Frog Head & Chubby Body -->
      <ellipse cx="130" cy="154" rx="74" ry="54" fill="#00D4AA" stroke="#1A1A1F" stroke-width="4.5"/>
      <ellipse cx="130" cy="176" rx="54" ry="30" fill="#FEF9C3" stroke="#1A1A1F" stroke-width="3"/>
      <path d="M90 154 Q130 176 170 154" fill="none" stroke="#1A1A1F" stroke-width="4.5" stroke-linecap="round"/>
      <!-- Hoodie -->
      <path d="M62 198 C62 186, 198 186, 198 198 L206 270 L54 270 Z" fill="#7C3AED" stroke="#1A1A1F" stroke-width="4.5"/>
      <!-- Soda Can Held in Right Hand -->
      <g transform="translate(154, 174) rotate(12)">
        <rect x="0" y="10" width="44" height="68" rx="8" fill="#FF5C2B" stroke="#1A1A1F" stroke-width="4"/>
        <rect x="0" y="28" width="44" height="22" fill="#FFD60A" stroke="#1A1A1F" stroke-width="3"/>
        <ellipse cx="22" cy="10" rx="22" ry="7" fill="#E2E8F0" stroke="#1A1A1F" stroke-width="3.5"/>
        <text x="22" y="44" text-anchor="middle" font-size="13" font-weight="900" fill="#1A1A1F">POP</text>
      </g>
    `,
  },

  // #07 MAHJONG FOX — Street Kitsune Mask with Folding Fan, Robe & Jade Mahjong Tile
  'mahjong-fox': {
    bg: `
      <defs>
        <linearGradient id="mf-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#3B0764"/>
          <stop offset="50%" stop-color="#BE185D"/>
          <stop offset="100%" stop-color="#F59E0B"/>
        </linearGradient>
      </defs>
      <rect width="260" height="320" fill="url(#mf-bg)"/>
      <!-- Radial Sunburst & Comic Dots -->
      <circle cx="130" cy="146" r="98" fill="#FFD426" opacity="0.22"/>
      <circle cx="130" cy="146" r="68" fill="#FFFDF8" opacity="0.16"/>
      <g fill="#17171C" opacity="0.18">
        <circle cx="28" cy="240" r="4"/><circle cx="42" cy="240" r="4"/><circle cx="35" cy="252" r="4"/>
        <circle cx="222" cy="70" r="4"/><circle cx="236" cy="70" r="4"/><circle cx="229" cy="82" r="4"/>
      </g>
    `,
    mid: `
      <!-- Twin Folding Fans Behind -->
      <path d="M130 206 L246 128 A128 128 0 0 1 240 232 Z" fill="#FFD426" stroke="#17171C" stroke-width="4" stroke-linejoin="round"/>
      <line x1="130" y1="206" x2="244" y2="158" stroke="#FF5526" stroke-width="3"/>
      <line x1="130" y1="206" x2="243" y2="194" stroke="#FF5526" stroke-width="3"/>
      <path d="M130 206 L16 140 A110 110 0 0 0 24 230 Z" fill="#00D4AA" stroke="#17171C" stroke-width="4" stroke-linejoin="round"/>
      <line x1="130" y1="206" x2="19" y2="180" stroke="#17171C" stroke-width="2.5"/>
      <polygon points="36,78 41,88 52,90 43,96 46,106 36,100 26,106 29,96 20,90 31,88" fill="#FFD426" stroke="#17171C" stroke-width="2.5"/>
    `,
    hero: `
      <!-- Street Haori Jacket Shoulders -->
      <path d="M54 218 C60 184, 200 184, 206 218 L216 284 L44 284 Z" fill="#181820" stroke="#17171C" stroke-width="4.5" stroke-linejoin="round"/>
      <path d="M84 196 L130 232 L176 196" fill="none" stroke="#FF3D9A" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>
      <!-- Fox Ears with Inner Shadow -->
      <polygon points="72,110 56,42 114,84" fill="#FFFDF8" stroke="#17171C" stroke-width="4.5" stroke-linejoin="round"/>
      <polygon points="78,98 70,62 102,86" fill="#FF3B30" stroke="#17171C" stroke-width="2"/>
      <polygon points="188,110 204,42 146,84" fill="#FFFDF8" stroke="#17171C" stroke-width="4.5" stroke-linejoin="round"/>
      <polygon points="182,98 190,62 158,86" fill="#FF3B30" stroke="#17171C" stroke-width="2"/>
      <!-- Red Rope Tassels -->
      <circle cx="58" cy="144" r="9" fill="#FF3B30" stroke="#17171C" stroke-width="3"/>
      <circle cx="202" cy="144" r="9" fill="#FF3B30" stroke="#17171C" stroke-width="3"/>
      <!-- Kitsune Mask Face -->
      <path d="M58 118 C58 76, 202 76, 202 118 C202 162, 160 196, 130 204 C100 196, 58 162, 58 118 Z" fill="#FFFDF8" stroke="#17171C" stroke-width="4.5" stroke-linejoin="round"/>
      <!-- Cheek Shading -->
      <path d="M64 134 C72 164, 102 188, 130 198 C158 188, 188 164, 196 134 C180 156, 152 174, 130 180 C108 174, 80 156, 64 134 Z" fill="#E2E8F0" opacity="0.55"/>
      <!-- Sharp Expressive Kitsune Eyes & Crimson Markings -->
      <path d="M78 122 L114 136 L82 144 Z" fill="#17171C"/>
      <path d="M84 127 L106 135 L86 140 Z" fill="#FFD426"/>
      <path d="M182 122 L146 136 L178 144 Z" fill="#17171C"/>
      <path d="M176 127 L154 135 L174 140 Z" fill="#FFD426"/>
      <path d="M74 150 Q88 158 102 154" fill="none" stroke="#FF3B30" stroke-width="3.5" stroke-linecap="round"/>
      <path d="M186 150 Q172 158 158 154" fill="none" stroke="#FF3B30" stroke-width="3.5" stroke-linecap="round"/>
      <polygon points="130,86 140,104 130,118 120,104" fill="#FF3B30" stroke="#17171C" stroke-width="2.5"/>
      <!-- Smirk -->
      <path d="M116 168 Q130 178 144 168" fill="none" stroke="#17171C" stroke-width="4" stroke-linecap="round"/>
      <!-- 3D Chunky Jade-Back Mahjong Tile 中 -->
      <g transform="translate(84, 198) rotate(-4 46 38)">
        <rect x="4" y="6" width="84" height="72" rx="12" fill="#059669" stroke="#17171C" stroke-width="4"/>
        <rect x="0" y="0" width="84" height="72" rx="12" fill="#00D4AA" stroke="#17171C" stroke-width="4"/>
        <rect x="7" y="6" width="70" height="58" rx="8" fill="#FFFDF8" stroke="#17171C" stroke-width="3"/>
        <text x="42" y="48" text-anchor="middle" font-size="34" font-weight="900" fill="#FF3B30" font-family="sans-serif">中</text>
      </g>
    `,
  },

  // #08 STREET RATTLE — Peddler Drum Toy
  'street-rattle': {
    bg: `
      <defs>
        <linearGradient id="sr-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#FF5C2B"/>
          <stop offset="50%" stop-color="#FFD60A"/>
          <stop offset="100%" stop-color="#FF3D9A"/>
        </linearGradient>
      </defs>
      <rect width="260" height="320" fill="url(#sr-bg)"/>
    `,
    mid: `
      <path d="M36 140 Q18 118 36 96" fill="none" stroke="#FFFDF8" stroke-width="5" stroke-linecap="round"/>
      <path d="M224 140 Q242 118 224 96" fill="none" stroke="#FFFDF8" stroke-width="5" stroke-linecap="round"/>
    `,
    hero: `
      <!-- Wooden Handle -->
      <rect x="118" y="186" width="24" height="92" rx="10" fill="#D97706" stroke="#1A1A1F" stroke-width="4.5"/>
      <!-- Swinging Beads -->
      <path d="M68 134 Q36 154 44 176" fill="none" stroke="#1A1A1F" stroke-width="4"/>
      <circle cx="44" cy="180" r="14" fill="#00D4AA" stroke="#1A1A1F" stroke-width="4"/>
      <path d="M192 134 Q224 154 216 176" fill="none" stroke="#1A1A1F" stroke-width="4"/>
      <circle cx="216" cy="180" r="14" fill="#7C3AED" stroke="#1A1A1F" stroke-width="4"/>
      <!-- Main Rattle Drum -->
      <circle cx="130" cy="134" r="64" fill="#FF3B30" stroke="#1A1A1F" stroke-width="5"/>
      <circle cx="130" cy="134" r="50" fill="#FFFDF8" stroke="#1A1A1F" stroke-width="3.5"/>
      <!-- Cute Drum Face -->
      <circle cx="110" cy="126" r="8" fill="#1A1A1F"/>
      <circle cx="150" cy="126" r="8" fill="#1A1A1F"/>
      <circle cx="96" cy="142" r="8" fill="#FF3D9A" opacity="0.6"/>
      <circle cx="164" cy="142" r="8" fill="#FF3D9A" opacity="0.6"/>
      <path d="M114 146 Q130 162 146 146" fill="none" stroke="#1A1A1F" stroke-width="4.5" stroke-linecap="round"/>
    `,
  },

  // #09 像素街机投币 — Benchmark #3: Round Golden Arcade Coin Dropping Into Mint Slot
  'lucky-coin': {
    bg: `
      <defs>
        <linearGradient id="lc-bg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#E6FFF8"/>
          <stop offset="56%" stop-color="#99F6E4"/>
          <stop offset="100%" stop-color="#00D4AA"/>
        </linearGradient>
      </defs>
      <rect width="260" height="320" fill="url(#lc-bg)"/>
      <!-- Pixel Grid Arcade Frame -->
      <rect x="24" y="34" width="212" height="236" rx="20" fill="#FFFDF8" opacity="0.58" stroke="#1A1A1F" stroke-width="3"/>
      <g fill="#00D4AA" opacity="0.35">
        <rect x="38" y="48" width="10" height="10"/>
        <rect x="52" y="48" width="10" height="10"/>
        <rect x="200" y="48" width="10" height="10"/>
        <rect x="214" y="48" width="10" height="10"/>
      </g>
    `,
    mid: `
      <!-- Pixel Sparkle Diamonds & Entry Chevrons -->
      <path d="M118 188 L130 198 L142 188" fill="none" stroke="#FF5C2B" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"/>
      <rect x="36" y="106" width="14" height="14" rx="2" fill="#7C3AED" stroke="#1A1A1F" stroke-width="2.5"/>
      <rect x="210" y="122" width="14" height="14" rx="2" fill="#FFD60A" stroke="#1A1A1F" stroke-width="2.5"/>
    `,
    hero: `
      <!-- Mint Arcade Coin-Slot Bezel Plate (Bottom Hero Anchor!) -->
      <rect x="46" y="198" width="168" height="72" rx="16" fill="#00D4AA" stroke="#1A1A1F" stroke-width="5"/>
      <rect x="58" y="210" width="144" height="48" rx="10" fill="#FFFDF8" stroke="#1A1A1F" stroke-width="3.5"/>
      <!-- Corner Mounting Screws -->
      <circle cx="70" cy="222" r="4" fill="#1A1A1F"/>
      <circle cx="190" cy="222" r="4" fill="#1A1A1F"/>
      <circle cx="70" cy="246" r="4" fill="#1A1A1F"/>
      <circle cx="190" cy="246" r="4" fill="#1A1A1F"/>
      <!-- Vertical Glowing Coin Slot Entry -->
      <rect x="86" y="226" width="88" height="16" rx="8" fill="#1A1A1F"/>
      <rect x="94" y="231" width="72" height="6" rx="3" fill="#7C3AED"/>
      <!-- Round Golden Arcade Coin Character Poised to Drop In! -->
      <g transform="translate(130, 122) rotate(-7)">
        <!-- Coin Edge Thickness -->
        <circle cx="-6" cy="4" r="62" fill="#D97706" stroke="#1A1A1F" stroke-width="5"/>
        <!-- Main Coin Face -->
        <circle cx="2" cy="0" r="62" fill="#FFD60A" stroke="#1A1A1F" stroke-width="5"/>
        <circle cx="2" cy="0" r="48" fill="none" stroke="#1A1A1F" stroke-width="3" stroke-dasharray="10 6"/>
        <!-- Hard-edge Specular Crescent -->
        <path d="M-28 -32 A40 40 0 0 1 12 -40" fill="none" stroke="#FFFDF8" stroke-width="6" stroke-linecap="round" opacity="0.85"/>
        <!-- Square Center Coin-Hole Motif + Playful Pixel Eyes -->
        <rect x="-12" y="-12" width="24" height="24" rx="4" fill="#00D4AA" stroke="#1A1A1F" stroke-width="3.5"/>
        <rect x="-32" y="-14" width="11" height="14" rx="3" fill="#1A1A1F"/>
        <rect x="25" y="-14" width="11" height="14" rx="3" fill="#1A1A1F"/>
        <rect x="-30" y="-11" width="4" height="4" fill="#FFFDF8"/>
        <rect x="27" y="-11" width="4" height="4" fill="#FFFDF8"/>
        <path d="M-12 24 Q2 34 16 24" fill="none" stroke="#1A1A1F" stroke-width="4.2" stroke-linecap="round"/>
      </g>
    `,
  },

  // #10 糖画铜勺叮当 — Tilted Brass Pouring Spoon & Flowing Amber Sugar Swirl
  'sugar-spoon': {
    bg: `
      <defs>
        <linearGradient id="ss-bg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#FFFBEB"/>
          <stop offset="55%" stop-color="#FDE68A"/>
          <stop offset="100%" stop-color="#00D4AA"/>
        </linearGradient>
      </defs>
      <rect width="260" height="320" fill="url(#ss-bg)"/>
      <!-- Marble Sugar-Painting Slab -->
      <path d="M24 226 L236 226 L248 286 L12 286 Z" fill="#FFFDF8" stroke="#1A1A1F" stroke-width="4" stroke-linejoin="round"/>
    `,
    mid: `
      <circle cx="48" cy="76" r="7" fill="#00D4AA" stroke="#1A1A1F" stroke-width="2.5"/>
      <polygon points="214,68 219,78 230,80 221,86 224,96 214,90 204,96 207,86 198,80 209,78" fill="#FFD60A" stroke="#1A1A1F" stroke-width="2.5"/>
    `,
    hero: `
      <!-- Bamboo Skewer Resting on Marble Slab -->
      <line x1="60" y1="258" x2="210" y2="258" stroke="#B45309" stroke-width="8" stroke-linecap="round"/>
      <line x1="60" y1="258" x2="210" y2="258" stroke="#1A1A1F" stroke-width="2.5" stroke-linecap="round"/>
      <!-- Flowing Amber Sugar Swirl Drawn on Marble Slab -->
      <path d="M126 154 C126 194, 184 188, 178 228 C172 260, 82 264, 78 226 C75 196, 134 196, 140 226 C144 242, 114 246, 112 232" fill="none" stroke="#1A1A1F" stroke-width="17" stroke-linecap="round"/>
      <path d="M126 154 C126 194, 184 188, 178 228 C172 260, 82 264, 78 226 C75 196, 134 196, 140 226 C144 242, 114 246, 112 232" fill="none" stroke="#F59E0B" stroke-width="10" stroke-linecap="round"/>
      <path d="M126 154 C126 194, 184 188, 178 228" fill="none" stroke="#FEF08A" stroke-width="3.5" stroke-linecap="round"/>
      <!-- Tilted Long-Handled Brass Copper Ladle (Hero Sound Object!) -->
      <g transform="translate(132, 108) rotate(-26)">
        <!-- Copper Handle -->
        <rect x="26" y="-8" width="96" height="16" rx="8" fill="#FF5C2B" stroke="#1A1A1F" stroke-width="4.5"/>
        <circle cx="110" cy="0" r="4" fill="#FFFDF8" stroke="#1A1A1F" stroke-width="2"/>
        <!-- Ladle Pouring Bowl -->
        <path d="M-54 -14 C-54 -36, 36 -36, 36 -14 C36 22, 14 42, -10 42 C-34 42, -54 22, -54 -14 Z" fill="#FFD60A" stroke="#1A1A1F" stroke-width="5" stroke-linejoin="round"/>
        <!-- Glowing Molten Sugar Inside Bowl -->
        <ellipse cx="-10" cy="-14" rx="34" ry="12" fill="#FF5C2B" stroke="#1A1A1F" stroke-width="3.5"/>
        <!-- Cute Ladle Eyes -->
        <circle cx="-22" cy="12" r="5" fill="#1A1A1F"/>
        <circle cx="4" cy="12" r="5" fill="#1A1A1F"/>
        <circle cx="-23.5" cy="10" r="1.8" fill="#FFFDF8"/>
        <circle cx="2.5" cy="10" r="1.8" fill="#FFFDF8"/>
        <path d="M-15 23 Q-9 29 -3 23" fill="none" stroke="#1A1A1F" stroke-width="3.2" stroke-linecap="round"/>
      </g>
    `,
  },

  // #11 CYBER ZITHER — Neon Cyber Guzheng Phoenix
  'cyber-zither': {
    bg: `
      <defs>
        <linearGradient id="cz-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#0F172A"/>
          <stop offset="50%" stop-color="#7C3AED"/>
          <stop offset="100%" stop-color="#00D4AA"/>
        </linearGradient>
      </defs>
      <rect width="260" height="320" fill="url(#cz-bg)"/>
      <g stroke="#00D4AA" stroke-width="2" opacity="0.5">
        <line x1="20" y1="40" x2="240" y2="260"/>
        <line x1="40" y1="20" x2="260" y2="240"/>
        <line x1="0" y1="60" x2="220" y2="280"/>
      </g>
    `,
    mid: `
      <circle cx="130" cy="152" r="84" fill="none" stroke="#FFD60A" stroke-width="4" stroke-dasharray="14 8"/>
    `,
    hero: `
      <!-- Cyber Zither Body -->
      <g transform="rotate(-18 130 164)">
        <rect x="34" y="122" width="192" height="84" rx="22" fill="#FF3D9A" stroke="#1A1A1F" stroke-width="5"/>
        <rect x="46" y="134" width="168" height="60" rx="14" fill="#181820" stroke="#1A1A1F" stroke-width="3.5"/>
        <line x1="54" y1="146" x2="206" y2="146" stroke="#00D4AA" stroke-width="3"/>
        <line x1="54" y1="158" x2="206" y2="158" stroke="#FFD60A" stroke-width="3"/>
        <line x1="54" y1="170" x2="206" y2="170" stroke="#38BDF8" stroke-width="3"/>
        <line x1="54" y1="182" x2="206" y2="182" stroke="#C084FC" stroke-width="3"/>
        <!-- Zither Bridges -->
        <polygon points="88,140 96,154 80,154" fill="#FFD60A" stroke="#1A1A1F" stroke-width="2"/>
        <polygon points="126,154 134,168 118,168" fill="#00D4AA" stroke="#1A1A1F" stroke-width="2"/>
        <polygon points="164,168 172,182 156,182" fill="#FF5C2B" stroke="#1A1A1F" stroke-width="2"/>
      </g>
      <!-- Neon Spark Core -->
      <polygon points="130,68 142,96 170,104 142,114 130,142 118,114 90,104 118,96" fill="#FFD60A" stroke="#1A1A1F" stroke-width="3.5"/>
    `,
  },

  // #12 FERRIS BOX — Hologram Ferris Wheel Music Box (UR)
  'ferris-box': {
    bg: `
      <defs>
        <linearGradient id="fb-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#0F172A"/>
          <stop offset="48%" stop-color="#4C1D95"/>
          <stop offset="82%" stop-color="#DB2777"/>
          <stop offset="100%" stop-color="#0D9488"/>
        </linearGradient>
      </defs>
      <rect width="260" height="320" fill="url(#fb-bg)"/>
      <!-- Dreamy Starry Night Sky & Glowing City Silhouettes -->
      <circle cx="130" cy="146" r="106" fill="#FF3D9A" opacity="0.18"/>
      <rect x="8" y="222" width="44" height="98" fill="#1E1B4B" stroke="#17171C" stroke-width="3"/>
      <rect x="208" y="210" width="46" height="110" fill="#1E1B4B" stroke="#17171C" stroke-width="3"/>
      <circle cx="52" cy="64" r="5" fill="#FFD426"/>
      <circle cx="206" cy="72" r="7" fill="#00D4AA"/>
      <circle cx="192" cy="242" r="4" fill="#FFFDF8"/>
    `,
    mid: `
      <path d="M84 276 L130 146 L176 276" fill="none" stroke="#17171C" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M84 276 L130 146 L176 276" fill="none" stroke="#FFFDF8" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>
      <!-- Glowing Spokes -->
      <g stroke="#FFFDF8" stroke-width="2.2" opacity="0.65">
        <line x1="130" y1="68" x2="130" y2="224"/>
        <line x1="52" y1="146" x2="208" y2="146"/>
        <line x1="75" y1="91" x2="185" y2="201"/>
        <line x1="185" y1="91" x2="75" y2="201"/>
      </g>
    `,
    hero: `
      <!-- Ferris Rim -->
      <circle cx="130" cy="146" r="78" fill="none" stroke="#17171C" stroke-width="13"/>
      <circle cx="130" cy="146" r="78" fill="none" stroke="#FFD426" stroke-width="5.5"/>
      <circle cx="130" cy="146" r="48" fill="none" stroke="#00D4AA" stroke-width="3.5" stroke-dasharray="10 8"/>
      <!-- 8 Glowing Gondolas -->
      <circle cx="130" cy="68" r="15" fill="#FF3D9A" stroke="#17171C" stroke-width="3.5"/>
      <circle cx="208" cy="146" r="15" fill="#00D4AA" stroke="#17171C" stroke-width="3.5"/>
      <circle cx="130" cy="224" r="15" fill="#7C3AED" stroke="#17171C" stroke-width="3.5"/>
      <circle cx="52" cy="146" r="15" fill="#FF5526" stroke="#17171C" stroke-width="3.5"/>
      <circle cx="185" cy="91" r="11" fill="#38BDF8" stroke="#17171C" stroke-width="3"/>
      <circle cx="75" cy="91" r="11" fill="#FFD426" stroke="#17171C" stroke-width="3"/>
      <circle cx="185" cy="201" r="11" fill="#FFD426" stroke="#17171C" stroke-width="3"/>
      <circle cx="75" cy="201" r="11" fill="#38BDF8" stroke="#17171C" stroke-width="3"/>
      <!-- Music Box Wind-Up Base -->
      <rect x="64" y="254" width="132" height="28" rx="10" fill="#181820" stroke="#17171C" stroke-width="4"/>
      <rect x="78" y="262" width="104" height="10" rx="5" fill="#FFD426"/>
      <!-- Center Star Hub -->
      <circle cx="130" cy="146" r="28" fill="#FFFDF8" stroke="#17171C" stroke-width="4.5"/>
      <polygon points="130,126 136,140 151,142 140,152 143,166 130,159 117,166 120,152 109,142 124,140" fill="#FFD426" stroke="#17171C" stroke-width="2.5"/>
    `,
  },

  // #13 夜市铁板滋啦 — Benchmark #4: Cast-Iron Teppan Griddle + Orange Stove + Twin Spatula Arms + 3 Steam Ribbons
  'night-sizzle': {
    bg: `
      <defs>
        <linearGradient id="ns-bg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#FFFBEB"/>
          <stop offset="52%" stop-color="#FFE4B5"/>
          <stop offset="100%" stop-color="#FF5C2B"/>
        </linearGradient>
      </defs>
      <rect width="260" height="320" fill="url(#ns-bg)"/>
      <!-- Subtle Night Market Awning Header -->
      <g opacity="0.22" fill="#FF5C2B">
        <rect x="0" y="0" width="32" height="36"/>
        <rect x="64" y="0" width="32" height="36"/>
        <rect x="128" y="0" width="32" height="36"/>
        <rect x="192" y="0" width="32" height="36"/>
      </g>
      <ellipse cx="130" cy="268" rx="94" ry="16" fill="#1A1A1F" opacity="0.14"/>
    `,
    mid: `
      <!-- 3 Clean Stylized Steam Ribbons Rising Above Griddle -->
      <path d="M84 128 C74 106, 98 94, 86 70" fill="none" stroke="#FFFDF8" stroke-width="9" stroke-linecap="round"/>
      <path d="M84 128 C74 106, 98 94, 86 70" fill="none" stroke="#1A1A1F" stroke-width="3" stroke-linecap="round"/>
      <path d="M130 120 C118 94, 144 82, 130 52" fill="none" stroke="#FFD60A" stroke-width="10" stroke-linecap="round"/>
      <path d="M130 120 C118 94, 144 82, 130 52" fill="none" stroke="#1A1A1F" stroke-width="3" stroke-linecap="round"/>
      <path d="M176 128 C166 106, 190 94, 178 70" fill="none" stroke="#FFFDF8" stroke-width="9" stroke-linecap="round"/>
      <path d="M176 128 C166 106, 190 94, 178 70" fill="none" stroke="#1A1A1F" stroke-width="3" stroke-linecap="round"/>
    `,
    hero: `
      <!-- Left Spatula Arm -->
      <g transform="translate(46, 178) rotate(-32)">
        <rect x="-6" y="-22" width="12" height="44" rx="5" fill="#1A1A1F"/>
        <path d="M-16 -52 H16 L12 -20 H-12 Z" fill="#FFFDF8" stroke="#1A1A1F" stroke-width="4" stroke-linejoin="round"/>
        <line x1="-8" y1="-44" x2="8" y2="-44" stroke="#1A1A1F" stroke-width="2.5" stroke-linecap="round"/>
      </g>
      <!-- Right Spatula Arm -->
      <g transform="translate(214, 178) rotate(32)">
        <rect x="-6" y="-22" width="12" height="44" rx="5" fill="#1A1A1F"/>
        <path d="M-16 -52 H16 L12 -20 H-12 Z" fill="#FFFDF8" stroke="#1A1A1F" stroke-width="4" stroke-linejoin="round"/>
        <line x1="-8" y1="-44" x2="8" y2="-44" stroke="#1A1A1F" stroke-width="2.5" stroke-linecap="round"/>
      </g>
      <!-- Orange Stove Chassis Body (Character Face Integrated Cleanly!) -->
      <rect x="54" y="168" width="152" height="84" rx="18" fill="#FF5C2B" stroke="#1A1A1F" stroke-width="5"/>
      <!-- Stove Feet -->
      <rect x="70" y="250" width="24" height="16" rx="6" fill="#1A1A1F"/>
      <rect x="166" y="250" width="24" height="16" rx="6" fill="#1A1A1F"/>
      <!-- Stove Control Dial & Expressive Toy Face -->
      <circle cx="96" cy="204" r="7.5" fill="#1A1A1F"/>
      <circle cx="164" cy="204" r="7.5" fill="#1A1A1F"/>
      <circle cx="93.5" cy="201.5" r="2.6" fill="#FFFDF8"/>
      <circle cx="161.5" cy="201.5" r="2.6" fill="#FFFDF8"/>
      <path d="M116 218 Q130 232 144 218" fill="none" stroke="#1A1A1F" stroke-width="4.5" stroke-linecap="round"/>
      <!-- Flame Gauge Knobs -->
      <circle cx="74" cy="232" r="8" fill="#FFD60A" stroke="#1A1A1F" stroke-width="3"/>
      <circle cx="186" cy="232" r="8" fill="#00D4AA" stroke="#1A1A1F" stroke-width="3"/>
      <!-- Heavy Dark Cast-Iron Griddle Plate with Raised Bevel Rim -->
      <path d="M32 142 H228 L220 174 H40 Z" fill="#1E202B" stroke="#1A1A1F" stroke-width="5" stroke-linejoin="round"/>
      <rect x="44" y="148" width="172" height="8" rx="4" fill="#475569"/>
      <!-- Sizzling Golden & Mint Sparks on Griddle -->
      <circle cx="92" cy="136" r="6" fill="#FFD60A" stroke="#1A1A1F" stroke-width="2.5"/>
      <circle cx="168" cy="136" r="5" fill="#00D4AA" stroke="#1A1A1F" stroke-width="2.5"/>
    `,
  },

  // #14 梅雨铁皮雨棚 — Corrugated Striped Tin Awning + Mint Raindrops + Warm Window Glow
  'rain-cloud': {
    bg: `
      <defs>
        <linearGradient id="rc-bg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#E0F2FE"/>
          <stop offset="55%" stop-color="#C4B5FD"/>
          <stop offset="100%" stop-color="#7C3AED"/>
        </linearGradient>
      </defs>
      <rect width="260" height="320" fill="url(#rc-bg)"/>
      <!-- Cozy Alley Window Behind Awning -->
      <rect x="60" y="156" width="140" height="114" rx="12" fill="#FFFDF8" stroke="#1A1A1F" stroke-width="4.5"/>
      <rect x="74" y="170" width="112" height="86" rx="8" fill="#FFD60A" opacity="0.45" stroke="#1A1A1F" stroke-width="3"/>
    `,
    mid: `
      <!-- Falling Mint Raindrops -->
      <g fill="#00D4AA" stroke="#1A1A1F" stroke-width="2.5">
        <path d="M56 218 Q62 232 56 240 Q50 232 56 218 Z"/>
        <path d="M104 234 Q110 248 104 256 Q98 248 104 234 Z"/>
        <path d="M158 232 Q164 246 158 254 Q152 246 158 232 Z"/>
        <path d="M204 216 Q210 230 204 238 Q198 230 204 216 Z"/>
      </g>
    `,
    hero: `
      <!-- Soft Cloud Resting Above Tin Roof -->
      <g fill="#FFFDF8" stroke="#1A1A1F" stroke-width="4.5" stroke-linejoin="round">
        <circle cx="96" cy="94" r="24"/>
        <circle cx="132" cy="82" r="30"/>
        <circle cx="168" cy="96" r="22"/>
      </g>
      <!-- Corrugated Striped Tin Awning Roof Character -->
      <path d="M36 168 L58 108 H202 L224 168 Z" fill="#7C3AED" stroke="#1A1A1F" stroke-width="5" stroke-linejoin="round"/>
      <!-- Corrugation Rib Stripes -->
      <path d="M84 108 L74 168 H106 L112 108 Z" fill="#FFFDF8" stroke="#1A1A1F" stroke-width="3"/>
      <path d="M148 108 L154 168 H186 L176 108 Z" fill="#FFFDF8" stroke="#1A1A1F" stroke-width="3"/>
      <!-- Scalloped Front Valance with Cozy Sleeping Eyes -->
      <rect x="34" y="166" width="192" height="34" rx="10" fill="#00D4AA" stroke="#1A1A1F" stroke-width="4.5"/>
      <path d="M86 182 Q96 190 106 182" fill="none" stroke="#1A1A1F" stroke-width="4" stroke-linecap="round"/>
      <path d="M154 182 Q164 190 174 182" fill="none" stroke="#1A1A1F" stroke-width="4" stroke-linecap="round"/>
      <path d="M122 188 Q130 194 138 188" fill="none" stroke="#1A1A1F" stroke-width="3.5" stroke-linecap="round"/>
    `,
  },

  // #15 NEON TAPE — Retro HK Neon Cassette Spirit
  'neon-tape': {
    bg: `
      <defs>
        <linearGradient id="nt-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#181820"/>
          <stop offset="50%" stop-color="#7C3AED"/>
          <stop offset="100%" stop-color="#FF3D9A"/>
        </linearGradient>
      </defs>
      <rect width="260" height="320" fill="url(#nt-bg)"/>
      <rect x="20" y="34" width="220" height="252" rx="16" fill="none" stroke="#00D4AA" stroke-width="3" stroke-dasharray="10 6"/>
    `,
    mid: `
      <text x="130" y="88" text-anchor="middle" font-size="22" font-weight="900" fill="#FFD60A" font-family="sans-serif">NEON 90s</text>
    `,
    hero: `
      <g transform="rotate(-6 130 176)">
        <rect x="34" y="112" width="192" height="128" rx="18" fill="#FF3D9A" stroke="#1A1A1F" stroke-width="5"/>
        <rect x="52" y="128" width="156" height="66" rx="10" fill="#FFFDF8" stroke="#1A1A1F" stroke-width="4"/>
        <rect x="64" y="138" width="132" height="44" rx="6" fill="#181820"/>
        <circle cx="96" cy="160" r="16" fill="#FFD60A" stroke="#1A1A1F" stroke-width="3"/>
        <circle cx="96" cy="160" r="6" fill="#181820"/>
        <circle cx="164" cy="160" r="16" fill="#00D4AA" stroke="#1A1A1F" stroke-width="3"/>
        <circle cx="164" cy="160" r="6" fill="#181820"/>
        <polygon points="74,240 88,210 172,210 186,240" fill="#181820" stroke="#1A1A1F" stroke-width="3.5"/>
      </g>
    `,
  },

  // #16 CICADA MOON — Moonlit Lantern Summer Cicada (UR)
  'cicada-moon': {
    bg: `
      <defs>
        <linearGradient id="cm-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#090D1E"/>
          <stop offset="48%" stop-color="#2E1065"/>
          <stop offset="100%" stop-color="#0D9488"/>
        </linearGradient>
      </defs>
      <rect width="260" height="320" fill="url(#cm-bg)"/>
      <!-- Glowing Crescent Moon + Halos -->
      <circle cx="192" cy="82" r="52" fill="#FFD426" opacity="0.14"/>
      <circle cx="192" cy="82" r="34" fill="#FFD426"/>
      <circle cx="177" cy="73" r="28" fill="#1E1548"/>
      <!-- Traditional Alley Eaves Silhouette -->
      <path d="M0 248 Q68 232 130 256 Q192 232 260 248 L260 320 L0 320 Z" fill="#0F172A" stroke="#17171C" stroke-width="3"/>
    `,
    mid: `
      <!-- Firefly Sparks & Musical Wave Rings -->
      <circle cx="130" cy="168" r="78" fill="none" stroke="#00D4AA" stroke-width="2.5" stroke-dasharray="8 8" opacity="0.55"/>
      <circle cx="52" cy="76" r="5" fill="#FFFDF8"/>
      <circle cx="88" cy="54" r="4" fill="#FFD426"/>
      <circle cx="222" cy="156" r="5" fill="#00D4AA"/>
      <circle cx="42" cy="212" r="4" fill="#FFD426"/>
    `,
    hero: `
      <!-- Iridescent Translucent Wings with Vein Detail -->
      <g>
        <ellipse cx="76" cy="168" rx="56" ry="26" transform="rotate(-28 76 168)" fill="#00D4AA" fill-opacity="0.86" stroke="#17171C" stroke-width="4.5"/>
        <path d="M36 184 Q74 166 114 156" fill="none" stroke="#FFFDF8" stroke-width="2.5" opacity="0.7"/>
        <ellipse cx="184" cy="168" rx="56" ry="26" transform="rotate(28 184 168)" fill="#C084FC" fill-opacity="0.86" stroke="#17171C" stroke-width="4.5"/>
        <path d="M224 184 Q186 166 146 156" fill="none" stroke="#FFFDF8" stroke-width="2.5" opacity="0.7"/>
      </g>
      <!-- Golden Jade-Trimmed Cicada Body -->
      <ellipse cx="130" cy="180" rx="40" ry="64" fill="#FFD426" stroke="#17171C" stroke-width="4.5"/>
      <path d="M98 168 H162 M96 186 H164 M102 204 H158" stroke="#D97706" stroke-width="4" stroke-linecap="round"/>
      <ellipse cx="130" cy="126" rx="46" ry="30" fill="#FF5526" stroke="#17171C" stroke-width="4.5"/>
      <!-- Mini Crown & Headphones -->
      <polygon points="116,102 120,88 130,96 140,88 144,102" fill="#FFD426" stroke="#17171C" stroke-width="2.8" stroke-linejoin="round"/>
      <!-- Glowing Cyan Eyes -->
      <circle cx="92" cy="122" r="15" fill="#00D4AA" stroke="#17171C" stroke-width="4"/>
      <circle cx="168" cy="122" r="15" fill="#00D4AA" stroke="#17171C" stroke-width="4"/>
      <circle cx="94" cy="122" r="6" fill="#17171C"/>
      <circle cx="166" cy="122" r="6" fill="#17171C"/>
      <circle cx="90" cy="118" r="3" fill="#FFFDF8"/>
      <circle cx="162" cy="118" r="3" fill="#FFFDF8"/>
      <!-- Happy Sound Wave Smile -->
      <path d="M114 138 Q130 148 146 138" fill="none" stroke="#17171C" stroke-width="3.8" stroke-linecap="round"/>
      <!-- Glowing Sound Ripples Below -->
      <path d="M94 224 Q130 242 166 224" fill="none" stroke="#00D4AA" stroke-width="4.5" stroke-linecap="round"/>
    `,
  },

  // #MY-01 NEON DJ — Exclusive Forge Showcase Mascot (Mockup 4!)
  'neon-dj': {
    bg: `
      <defs>
        <linearGradient id="nd-sky" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#1E1B4B"/>
          <stop offset="45%" stop-color="#7C3AED"/>
          <stop offset="80%" stop-color="#FF3D9A"/>
          <stop offset="100%" stop-color="#FFD60A"/>
        </linearGradient>
      </defs>
      <rect width="260" height="320" fill="url(#nd-sky)"/>
      <!-- City Skyline -->
      <rect x="6" y="106" width="46" height="160" fill="#1E1B4B" stroke="#1A1A1F" stroke-width="3"/>
      <rect x="16" y="122" width="10" height="10" fill="#00D4AA"/>
      <rect x="32" y="122" width="10" height="10" fill="#FFD60A"/>
      <rect x="16" y="142" width="10" height="10" fill="#FF3D9A"/>
      <rect x="204" y="88" width="48" height="178" fill="#1E1B4B" stroke="#1A1A1F" stroke-width="3"/>
      <rect x="210" y="106" width="34" height="44" rx="4" fill="#FF3D9A" stroke="#1A1A1F" stroke-width="2.5"/>
      <text x="227" y="136" text-anchor="middle" font-size="22" font-weight="900" fill="#FFFDF8" font-family="sans-serif">音</text>
      <!-- Crescent Moon -->
      <circle cx="196" cy="60" r="24" fill="#FFD60A"/>
      <circle cx="186" cy="54" r="20" fill="#4C1D95"/>
    `,
    mid: `
      <path d="M0 246 Q130 228 260 246 L260 320 L0 320 Z" fill="#181820" opacity="0.5"/>
      <circle cx="48" cy="74" r="4" fill="#FFD60A"/>
      <circle cx="152" cy="46" r="4" fill="#00D4AA"/>
      <circle cx="236" cy="66" r="3" fill="#FFFDF8"/>
    `,
    hero: `
      <!-- Sneakers -->
      <path d="M56 246 C56 232, 82 228, 100 236 L110 258 L54 258 Z" fill="#FF3B30" stroke="#1A1A1F" stroke-width="4" stroke-linejoin="round"/>
      <rect x="54" y="252" width="58" height="9" rx="4" fill="#FFFDF8" stroke="#1A1A1F" stroke-width="3"/>
      <path d="M150 258 L164 236 C182 228, 206 234, 206 248 L206 258 Z" fill="#7C3AED" stroke="#1A1A1F" stroke-width="4" stroke-linejoin="round"/>
      <rect x="148" y="252" width="60" height="9" rx="4" fill="#FFFDF8" stroke="#1A1A1F" stroke-width="3"/>
      <!-- Pants -->
      <path d="M84 186 L176 186 L188 238 L146 240 L130 218 L114 240 L72 238 Z" fill="#312E81" stroke="#1A1A1F" stroke-width="4" stroke-linejoin="round"/>
      <!-- Purple/Pink Street Jacket + Gold Chain -->
      <path d="M68 148 C68 130, 192 130, 192 148 L184 198 L76 198 Z" fill="#7C3AED" stroke="#1A1A1F" stroke-width="4" stroke-linejoin="round"/>
      <path d="M104 148 L156 148 L150 198 L110 198 Z" fill="#FF3D9A" stroke="#1A1A1F" stroke-width="3"/>
      <path d="M108 152 Q130 182 152 152" fill="none" stroke="#FFD60A" stroke-width="6" stroke-linecap="round"/>
      <!-- Vinyl Record Held in Right Hand -->
      <g transform="translate(154, 134)">
        <circle cx="34" cy="36" r="34" fill="#181820" stroke="#1A1A1F" stroke-width="4"/>
        <circle cx="34" cy="36" r="24" fill="none" stroke="#C084FC" stroke-width="2.5"/>
        <circle cx="34" cy="36" r="12" fill="#FF3D9A" stroke="#1A1A1F" stroke-width="2.5"/>
        <circle cx="34" cy="36" r="4" fill="#FFD60A"/>
      </g>
      <!-- Pointing Left Hand -->
      <path d="M40 162 C30 156, 32 142, 42 140 L52 126 C56 120, 64 124, 62 134 L60 144 L72 144 C78 144, 80 154, 70 158 C72 166, 56 172, 40 162 Z" fill="#FFFDF8" stroke="#1A1A1F" stroke-width="4" stroke-linejoin="round"/>
      <!-- Star Headphones Band -->
      <path d="M74 114 C74 52, 186 52, 186 114" fill="none" stroke="#FFD60A" stroke-width="10"/>
      <!-- Golden Coin DJ Head -->
      <circle cx="130" cy="112" r="42" fill="#F59E0B" stroke="#1A1A1F" stroke-width="4.5"/>
      <circle cx="134" cy="112" r="36" fill="#FFD60A" stroke="#1A1A1F" stroke-width="3.5"/>
      <!-- Star Headphone Ear Cups -->
      <circle cx="80" cy="116" r="20" fill="#7C3AED" stroke="#1A1A1F" stroke-width="4"/>
      <polygon points="80,104 84,112 92,113 86,118 87,126 80,122 73,126 74,118 68,113 76,112" fill="#FFD60A"/>
      <circle cx="180" cy="116" r="18" fill="#7C3AED" stroke="#1A1A1F" stroke-width="4"/>
      <!-- Cap -->
      <path d="M90 82 C92 50, 166 50, 170 82 Z" fill="#FF5C2B" stroke="#1A1A1F" stroke-width="4"/>
      <path d="M76 84 C98 72, 164 74, 180 88 C160 94, 94 94, 76 84 Z" fill="#FF3B30" stroke="#1A1A1F" stroke-width="4"/>
      <polygon points="122,72 124,62 130,67 136,59 142,67 148,62 150,72" fill="#FFD60A" stroke="#1A1A1F" stroke-width="2"/>
      <!-- Face -->
      <path d="M114 98 L128 105 M154 98 L142 105" stroke="#1A1A1F" stroke-width="4" stroke-linecap="round"/>
      <ellipse cx="124" cy="112" rx="4" ry="5.5" fill="#1A1A1F"/>
      <ellipse cx="148" cy="112" rx="4" ry="5.5" fill="#1A1A1F"/>
      <path d="M124 124 Q136 120 148 124 Q146 142 136 142 Q124 142 124 124 Z" fill="#1A1A1F"/>
      <path d="M129 135 Q136 131 143 135 Q139 141 132 141 Z" fill="#FF3D9A"/>
    `,
  },
};

export function getArtworkLayers(artId: string): ArtLayers {
  return ARTWORK_LAYERS[artId] ?? ARTWORK_LAYERS['street-bell'];
}

export function getStandaloneArtworkSvg(artId: string): string {
  const layers = getArtworkLayers(artId);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 260 320" width="520" height="640">${layers.bg}${layers.mid}${layers.hero}</svg>`;
}

interface CardArtworkProps {
  artId: string;
  parallax?: boolean;
  className?: string;
}

export const CardArtwork: React.FC<CardArtworkProps> = React.memo(
  ({ artId, parallax = false, className = '' }) => {
    const layers = getArtworkLayers(artId);

    if (!parallax) {
      return (
        <svg
          viewBox="0 0 260 320"
          preserveAspectRatio="xMidYMid slice"
          className={`w-full h-full block select-none pointer-events-none ${className}`}
          dangerouslySetInnerHTML={{ __html: `${layers.bg}${layers.mid}${layers.hero}` }}
        />
      );
    }

    return (
      <div className={`relative w-full h-full overflow-hidden select-none pointer-events-none ${className}`}>
        {/* Layer 0: Background */}
        <svg
          viewBox="0 0 260 320"
          preserveAspectRatio="xMidYMid slice"
          className="absolute inset-0 w-full h-full holo-layer-bg"
          dangerouslySetInnerHTML={{ __html: layers.bg }}
        />
        {/* Layer 1: Midground accents */}
        <svg
          viewBox="0 0 260 320"
          preserveAspectRatio="xMidYMid slice"
          className="absolute inset-0 w-full h-full holo-layer-mid"
          dangerouslySetInnerHTML={{ __html: layers.mid }}
        />
        {/* Layer 2: Floating Hero Street-Toy Mascot */}
        <svg
          viewBox="0 0 260 320"
          preserveAspectRatio="xMidYMid slice"
          className="absolute inset-0 w-full h-full holo-layer-hero"
          dangerouslySetInnerHTML={{ __html: layers.hero }}
        />
      </div>
    );
  }
);

CardArtwork.displayName = 'CardArtwork';
