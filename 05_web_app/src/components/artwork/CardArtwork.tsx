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
  // #05 STREET BELL — Iconic Coin-Head Street Kid with Red Cap, Giant Brass Bell & Red 鐘 Lantern
  'street-bell': {
    bg: `
      <defs>
        <linearGradient id="sb-sky" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#38BDF8"/>
          <stop offset="45%" stop-color="#C084FC"/>
          <stop offset="100%" stop-color="#FF5C2B"/>
        </linearGradient>
      </defs>
      <rect width="260" height="320" fill="url(#sb-sky)"/>
      <rect x="8" y="48" width="52" height="190" fill="#1E1B4B" stroke="#1A1A1F" stroke-width="3"/>
      <rect x="16" y="76" width="32" height="34" rx="4" fill="#7C3AED" stroke="#1A1A1F" stroke-width="2.5"/>
      <rect x="23" y="84" width="18" height="14" rx="2" fill="#FFFDF8"/>
      <rect x="26" y="88" width="4" height="4" fill="#1A1A1F"/>
      <rect x="34" y="88" width="4" height="4" fill="#1A1A1F"/>
      <rect x="195" y="130" width="58" height="140" fill="#312E81" stroke="#1A1A1F" stroke-width="3"/>
      <ellipse cx="130" cy="272" rx="115" ry="26" fill="#EDE7D9" stroke="#1A1A1F" stroke-width="3"/>
    `,
    mid: `
      <g opacity="0.9">
        <path d="M130 155 L20 20 M130 155 L245 30 M130 155 L255 180 M130 155 L5 190" stroke="#FFFDF8" stroke-width="4" opacity="0.45"/>
        <polygon points="35,165 40,175 50,177 41,183 43,193 35,187 27,193 29,183 20,177 30,175" fill="#FFD60A" stroke="#1A1A1F" stroke-width="2.5"/>
        <polygon points="222,202 227,214 238,216 228,223 231,234 222,227 213,234 216,223 206,216 217,214" fill="#00D4AA" stroke="#1A1A1F" stroke-width="2.5"/>
      </g>
      <!-- Hanging Red Chinese Bell Lantern (top-right) -->
      <g transform="translate(182, 54)">
        <line x1="28" y1="-20" x2="28" y2="8" stroke="#1A1A1F" stroke-width="4"/>
        <rect x="16" y="6" width="24" height="9" rx="3" fill="#FFD60A" stroke="#1A1A1F" stroke-width="3"/>
        <ellipse cx="28" cy="40" rx="26" ry="28" fill="#FF3B30" stroke="#1A1A1F" stroke-width="3.5"/>
        <ellipse cx="28" cy="40" rx="13" ry="28" fill="none" stroke="#1A1A1F" stroke-width="2.2"/>
        <rect x="16" y="66" width="24" height="8" rx="3" fill="#FFD60A" stroke="#1A1A1F" stroke-width="3"/>
        <line x1="28" y1="74" x2="28" y2="95" stroke="#FF3B30" stroke-width="5" stroke-linecap="round"/>
        <text x="28" y="48" text-anchor="middle" font-size="22" font-weight="900" fill="#FFFDF8" font-family="sans-serif">鐘</text>
      </g>
    `,
    hero: `
      <!-- Sneakers -->
      <g>
        <path d="M46 254 C46 238, 76 232, 95 238 L108 258 L104 274 L44 274 Z" fill="#FF3B30" stroke="#1A1A1F" stroke-width="4" stroke-linejoin="round"/>
        <rect x="44" y="266" width="64" height="10" rx="4" fill="#FFFDF8" stroke="#1A1A1F" stroke-width="3.5"/>
        <path d="M150 258 L168 238 C186 232, 214 240, 214 256 L214 274 L152 274 Z" fill="#FF3B30" stroke="#1A1A1F" stroke-width="4" stroke-linejoin="round"/>
        <rect x="150" y="266" width="66" height="10" rx="4" fill="#FFFDF8" stroke="#1A1A1F" stroke-width="3.5"/>
      </g>
      <!-- Baggy Street Pants -->
      <path d="M74 188 L184 188 L196 244 L148 248 L130 222 L110 248 L64 244 Z" fill="#2E294E" stroke="#1A1A1F" stroke-width="4" stroke-linejoin="round"/>
      <!-- Orange Street Jacket -->
      <path d="M62 150 C62 132, 198 132, 198 150 L192 204 L68 204 Z" fill="#FF5C2B" stroke="#1A1A1F" stroke-width="4" stroke-linejoin="round"/>
      <rect x="104" y="148" width="52" height="56" fill="#FFFDF8" stroke="#1A1A1F" stroke-width="3.5"/>
      <!-- Left Peace Hand -->
      <g transform="translate(22, 128)">
        <path d="M22 44 C10 42, 8 24, 18 18 L24 4 C27 -2, 36 0, 35 10 L33 22 L46 20 C54 20, 56 30, 48 34 L50 42 C54 48, 44 56, 22 44 Z" fill="#FFFDF8" stroke="#1A1A1F" stroke-width="4" stroke-linejoin="round"/>
      </g>
      <!-- Golden Coin Head -->
      <circle cx="132" cy="116" r="46" fill="#F59E0B" stroke="#1A1A1F" stroke-width="4.5"/>
      <circle cx="136" cy="116" r="40" fill="#FFD60A" stroke="#1A1A1F" stroke-width="3.5"/>
      <circle cx="136" cy="116" r="32" fill="none" stroke="#D97706" stroke-width="2.5" stroke-dasharray="6 4"/>
      <!-- Expressive Face -->
      <path d="M114 98 L131 106 M158 98 L143 106" stroke="#1A1A1F" stroke-width="4.5" stroke-linecap="round"/>
      <ellipse cx="124" cy="112" rx="4.5" ry="6" fill="#1A1A1F"/>
      <ellipse cx="150" cy="112" rx="4.5" ry="6" fill="#1A1A1F"/>
      <circle cx="122.5" cy="110" r="1.8" fill="#FFFDF8"/>
      <circle cx="148.5" cy="110" r="1.8" fill="#FFFDF8"/>
      <path d="M124 124 Q137 120 148 124 Q148 144 136 144 Q124 144 124 124 Z" fill="#1A1A1F"/>
      <path d="M128 136 Q136 131 144 136 Q140 142 132 142 Z" fill="#FF3D9A"/>
      <!-- Red Street Cap with Crown -->
      <path d="M88 86 C90 50, 168 48, 174 86 Z" fill="#FF3B30" stroke="#1A1A1F" stroke-width="4" stroke-linejoin="round"/>
      <path d="M74 86 C96 72, 168 74, 186 92 C164 98, 92 98, 74 86 Z" fill="#FF5C2B" stroke="#1A1A1F" stroke-width="4" stroke-linejoin="round"/>
      <polygon points="124,74 126,62 133,68 139,59 145,68 152,62 154,74" fill="#FFD60A" stroke="#1A1A1F" stroke-width="2.5" stroke-linejoin="round"/>
      <!-- Giant Brass Street Bell & Red Tassel Knot -->
      <g transform="translate(110, 152) rotate(-14)">
        <path d="M16 14 C16 2, 48 2, 48 14 L62 64 C66 74, -2 74, 2 64 Z" fill="#FFD60A" stroke="#1A1A1F" stroke-width="4" stroke-linejoin="round"/>
        <path d="M22 18 L14 58" stroke="#FFFBEB" stroke-width="5" stroke-linecap="round" opacity="0.75"/>
        <ellipse cx="32" cy="68" rx="30" ry="11" fill="#92400E" stroke="#1A1A1F" stroke-width="3.5"/>
        <circle cx="32" cy="72" r="9" fill="#F59E0B" stroke="#1A1A1F" stroke-width="3.5"/>
      </g>
      <!-- Red Chinese Knot -->
      <circle cx="134" cy="158" r="10" fill="#FF3B30" stroke="#1A1A1F" stroke-width="3.5"/>
      <ellipse cx="116" cy="156" rx="11" ry="7" fill="#FF3B30" stroke="#1A1A1F" stroke-width="3"/>
      <ellipse cx="152" cy="158" rx="11" ry="7" fill="#FF3B30" stroke="#1A1A1F" stroke-width="3"/>
    `,
  },

  // #01 BAMBOO BEAT — DJ Cat with Cool Shades & Vinyl Turntable
  'bamboo-cat': {
    bg: `
      <defs>
        <linearGradient id="bc-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#7C3AED"/>
          <stop offset="55%" stop-color="#C084FC"/>
          <stop offset="100%" stop-color="#38BDF8"/>
        </linearGradient>
      </defs>
      <rect width="260" height="320" fill="url(#bc-bg)"/>
      <!-- Bamboo Silhouettes -->
      <g stroke="#1A1A1F" stroke-width="3" fill="#00D4AA" opacity="0.55">
        <rect x="18" y="20" width="18" height="240" rx="6"/>
        <rect x="224" y="30" width="18" height="230" rx="6"/>
      </g>
      <circle cx="130" cy="155" r="95" fill="#EDE9FE" opacity="0.22"/>
    `,
    mid: `
      <polygon points="36,80 42,92 54,94 44,101 47,112 36,105 25,112 28,101 18,94 30,92" fill="#FFD60A" stroke="#1A1A1F" stroke-width="2.5"/>
      <polygon points="218,88 223,98 234,100 225,106 228,116 218,110 208,116 211,106 202,100 213,98" fill="#FF3D9A" stroke="#1A1A1F" stroke-width="2.5"/>
      <path d="M26 196 Q60 176 92 196" fill="none" stroke="#FFD60A" stroke-width="4" stroke-linecap="round"/>
      <path d="M174 196 Q204 176 236 196" fill="none" stroke="#00D4AA" stroke-width="4" stroke-linecap="round"/>
    `,
    hero: `
      <!-- Headphones Band -->
      <path d="M58 132 C58 58, 202 58, 202 132" fill="none" stroke="#7C3AED" stroke-width="14" stroke-linecap="round"/>
      <path d="M58 132 C58 58, 202 58, 202 132" fill="none" stroke="#1A1A1F" stroke-width="4" stroke-linecap="round"/>
      <!-- Cat Ears -->
      <polygon points="74,98 68,54 110,80" fill="#FFFDF8" stroke="#1A1A1F" stroke-width="4" stroke-linejoin="round"/>
      <polygon points="78,90 76,66 100,82" fill="#FF3D9A"/>
      <polygon points="186,98 192,54 150,80" fill="#FFFDF8" stroke="#1A1A1F" stroke-width="4" stroke-linejoin="round"/>
      <polygon points="182,90 184,66 160,82" fill="#FF3D9A"/>
      <!-- Cat Head -->
      <ellipse cx="130" cy="132" rx="64" ry="54" fill="#FFFDF8" stroke="#1A1A1F" stroke-width="4.5"/>
      <!-- Headphone Cups -->
      <rect x="46" y="106" width="24" height="48" rx="11" fill="#FFD60A" stroke="#1A1A1F" stroke-width="4"/>
      <rect x="190" y="106" width="24" height="48" rx="11" fill="#FFD60A" stroke="#1A1A1F" stroke-width="4"/>
      <!-- Cool Shades -->
      <path d="M74 116 H186 L176 146 H139 L130 132 L121 146 H84 Z" fill="#181820" stroke="#1A1A1F" stroke-width="3.5" stroke-linejoin="round"/>
      <line x1="86" y1="124" x2="108" y2="140" stroke="#00D4AA" stroke-width="5" stroke-linecap="round"/>
      <line x1="146" y1="124" x2="168" y2="140" stroke="#FF3D9A" stroke-width="5" stroke-linecap="round"/>
      <!-- Cute Cat Mouth -->
      <path d="M120 154 Q125 162 130 155 Q135 162 140 154" fill="none" stroke="#1A1A1F" stroke-width="3.5" stroke-linecap="round"/>
      <!-- Hoodie Body -->
      <path d="M72 180 C72 168, 188 168, 188 180 L198 228 L62 228 Z" fill="#7C3AED" stroke="#1A1A1F" stroke-width="4"/>
      <!-- DJ Vinyl Turntable Deck -->
      <rect x="28" y="206" width="204" height="68" rx="14" fill="#181820" stroke="#1A1A1F" stroke-width="4"/>
      <ellipse cx="96" cy="240" rx="46" ry="22" fill="#312E81" stroke="#00D4AA" stroke-width="3"/>
      <ellipse cx="96" cy="240" rx="14" ry="7" fill="#FFD60A" stroke="#1A1A1F" stroke-width="2.5"/>
      <rect x="158" y="220" width="58" height="40" rx="6" fill="#2E294E" stroke="#FFFDF8" stroke-width="2"/>
      <rect x="166" y="228" width="14" height="12" rx="2" fill="#FF5C2B"/>
      <rect x="184" y="228" width="14" height="12" rx="2" fill="#00D4AA"/>
      <rect x="166" y="244" width="14" height="10" rx="2" fill="#FFD60A"/>
      <rect x="184" y="244" width="14" height="10" rx="2" fill="#FF3D9A"/>
      <!-- Cat Paws Scratching -->
      <ellipse cx="82" cy="216" rx="18" ry="12" fill="#FFFDF8" stroke="#1A1A1F" stroke-width="3.5"/>
      <ellipse cx="176" cy="214" rx="18" ry="12" fill="#FFFDF8" stroke="#1A1A1F" stroke-width="3.5"/>
    `,
  },

  // #02 ARCADE BOT — Retro CRT Pixel TV Robot
  'arcade-bot': {
    bg: `
      <defs>
        <linearGradient id="ab-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#1E1B4B"/>
          <stop offset="55%" stop-color="#4F46E5"/>
          <stop offset="100%" stop-color="#06B6D4"/>
        </linearGradient>
      </defs>
      <rect width="260" height="320" fill="url(#ab-bg)"/>
      <g stroke="#00D4AA" stroke-width="1.5" opacity="0.3">
        <line x1="0" y1="220" x2="260" y2="220"/>
        <line x1="0" y1="250" x2="260" y2="250"/>
        <line x1="0" y1="280" x2="260" y2="280"/>
        <line x1="65" y1="200" x2="20" y2="320"/>
        <line x1="130" y1="200" x2="130" y2="320"/>
        <line x1="195" y1="200" x2="240" y2="320"/>
      </g>
    `,
    mid: `
      <polygon points="36,64 42,74 52,76 43,82 45,92 36,86 27,92 29,82 20,76 30,74" fill="#FFD60A" stroke="#1A1A1F" stroke-width="2"/>
      <rect x="206" y="72" width="24" height="24" rx="4" fill="#FF3D9A" stroke="#1A1A1F" stroke-width="3" transform="rotate(14 218 84)"/>
    `,
    hero: `
      <!-- Antenna -->
      <line x1="130" y1="54" x2="130" y2="82" stroke="#1A1A1F" stroke-width="5"/>
      <circle cx="130" cy="48" r="11" fill="#FFD60A" stroke="#1A1A1F" stroke-width="3.5"/>
      <!-- CRT Head -->
      <rect x="52" y="78" width="156" height="118" rx="22" fill="#EDE9FE" stroke="#1A1A1F" stroke-width="5"/>
      <rect x="68" y="94" width="124" height="86" rx="12" fill="#181820" stroke="#1A1A1F" stroke-width="4"/>
      <!-- Glowing Pixel Face -->
      <rect x="92" y="114" width="18" height="18" rx="3" fill="#00D4AA"/>
      <rect x="150" y="114" width="18" height="18" rx="3" fill="#00D4AA"/>
      <path d="M98 148 Q130 172 162 148" fill="none" stroke="#00D4AA" stroke-width="7" stroke-linecap="round"/>
      <!-- Ear Phones -->
      <rect x="34" y="112" width="20" height="48" rx="9" fill="#FFD60A" stroke="#1A1A1F" stroke-width="4"/>
      <rect x="206" y="112" width="20" height="48" rx="9" fill="#FFD60A" stroke="#1A1A1F" stroke-width="4"/>
      <!-- Arcade Body with Buttons -->
      <rect x="74" y="198" width="112" height="72" rx="16" fill="#7C3AED" stroke="#1A1A1F" stroke-width="4.5"/>
      <circle cx="106" cy="232" r="15" fill="#FF5C2B" stroke="#1A1A1F" stroke-width="3.5"/>
      <circle cx="144" cy="224" r="10" fill="#00D4AA" stroke="#1A1A1F" stroke-width="3"/>
      <circle cx="164" cy="242" r="10" fill="#FFD60A" stroke="#1A1A1F" stroke-width="3"/>
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

  // #09 LUCKY COIN — Lucky Fortune Cat / Frog holding Giant Gold Coin
  'lucky-coin': {
    bg: `
      <defs>
        <linearGradient id="lc-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#00D4AA"/>
          <stop offset="50%" stop-color="#38BDF8"/>
          <stop offset="100%" stop-color="#FFD60A"/>
        </linearGradient>
      </defs>
      <rect width="260" height="320" fill="url(#lc-bg)"/>
      <circle cx="130" cy="160" r="96" fill="#FFFDF8" opacity="0.22"/>
    `,
    mid: `
      <polygon points="40,70 46,84 60,86 48,94 52,108 40,99 28,108 32,94 20,86 34,84" fill="#FFD60A" stroke="#1A1A1F" stroke-width="2.5"/>
      <polygon points="218,86 223,96 234,98 225,104 228,114 218,108 208,114 211,104 202,98 213,96" fill="#FF3D9A" stroke="#1A1A1F" stroke-width="2.5"/>
    `,
    hero: `
      <!-- Fortune Cat Ears -->
      <polygon points="74,104 66,54 114,84" fill="#FFFDF8" stroke="#1A1A1F" stroke-width="4.5" stroke-linejoin="round"/>
      <polygon points="80,94 76,68 102,86" fill="#FF5C2B"/>
      <polygon points="186,104 194,54 146,84" fill="#FFFDF8" stroke="#1A1A1F" stroke-width="4.5" stroke-linejoin="round"/>
      <polygon points="180,94 184,68 158,86" fill="#FF5C2B"/>
      <!-- Cat Head -->
      <ellipse cx="130" cy="136" rx="64" ry="52" fill="#FFFDF8" stroke="#1A1A1F" stroke-width="4.5"/>
      <!-- Headphones -->
      <rect x="52" y="114" width="20" height="42" rx="9" fill="#FF3D9A" stroke="#1A1A1F" stroke-width="4"/>
      <rect x="188" y="114" width="20" height="42" rx="9" fill="#FF3D9A" stroke="#1A1A1F" stroke-width="4"/>
      <!-- Happy Arcade Eyes -->
      <path d="M92 132 Q104 118 116 132" fill="none" stroke="#1A1A1F" stroke-width="5" stroke-linecap="round"/>
      <path d="M144 132 Q156 118 168 132" fill="none" stroke="#1A1A1F" stroke-width="5" stroke-linecap="round"/>
      <circle cx="88" cy="148" r="9" fill="#FF3D9A" opacity="0.5"/>
      <circle cx="172" cy="148" r="9" fill="#FF3D9A" opacity="0.5"/>
      <path d="M120 150 Q130 160 140 150" fill="none" stroke="#1A1A1F" stroke-width="4" stroke-linecap="round"/>
      <!-- Body + Red Collar -->
      <rect x="76" y="184" width="108" height="80" rx="26" fill="#FFFDF8" stroke="#1A1A1F" stroke-width="4.5"/>
      <rect x="82" y="182" width="96" height="16" rx="8" fill="#FF3B30" stroke="#1A1A1F" stroke-width="3.5"/>
      <!-- Giant 8-Bit Gold Coin -->
      <circle cx="164" cy="232" r="42" fill="#FFD60A" stroke="#1A1A1F" stroke-width="4.5"/>
      <circle cx="164" cy="232" r="32" fill="none" stroke="#D97706" stroke-width="3.5"/>
      <rect x="152" y="220" width="24" height="24" rx="3" fill="#FFFDF8" stroke="#1A1A1F" stroke-width="3.5"/>
    `,
  },

  // #10 SUGAR SPOON — Golden Sugar Dragon Art
  'sugar-spoon': {
    bg: `
      <defs>
        <linearGradient id="ss-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#F59E0B"/>
          <stop offset="50%" stop-color="#FFD60A"/>
          <stop offset="100%" stop-color="#00D4AA"/>
        </linearGradient>
      </defs>
      <rect width="260" height="320" fill="url(#ss-bg)"/>
    `,
    mid: `
      <path d="M36 90 Q130 40 224 90" fill="none" stroke="#FFFBEB" stroke-width="6" stroke-linecap="round" opacity="0.6"/>
    `,
    hero: `
      <!-- Bamboo Stick -->
      <line x1="130" y1="190" x2="130" y2="286" stroke="#D97706" stroke-width="10" stroke-linecap="round"/>
      <line x1="130" y1="190" x2="130" y2="286" stroke="#1A1A1F" stroke-width="3"/>
      <!-- Golden Amber Sugar Swirl Dragon -->
      <path d="M130 68 C186 68, 212 118, 190 162 C168 206, 86 210, 68 164 C52 120, 82 68, 130 68 Z" fill="#F59E0B" stroke="#1A1A1F" stroke-width="5"/>
      <path d="M90 120 C110 90, 165 95, 168 134 C170 168, 118 182, 102 156 C90 138, 118 118, 138 134" fill="none" stroke="#FEF08A" stroke-width="10" stroke-linecap="round"/>
      <circle cx="110" cy="128" r="8" fill="#1A1A1F"/>
      <circle cx="150" cy="128" r="8" fill="#1A1A1F"/>
      <path d="M116 154 Q130 168 144 154" fill="none" stroke="#1A1A1F" stroke-width="4" stroke-linecap="round"/>
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

  // #13 NIGHT SIZZLE — Blazing Night Market Dragon Chef with Sizzle Grill & Flame Crest
  'night-sizzle': {
    bg: `
      <defs>
        <linearGradient id="ns-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#450A0A"/>
          <stop offset="48%" stop-color="#EA580C"/>
          <stop offset="100%" stop-color="#7C3AED"/>
        </linearGradient>
      </defs>
      <rect width="260" height="320" fill="url(#ns-bg)"/>
      <!-- Night Market Canopy Stripes -->
      <g opacity="0.22" fill="#FFD426">
        <rect x="0" y="0" width="32" height="44"/>
        <rect x="64" y="0" width="32" height="44"/>
        <rect x="128" y="0" width="32" height="44"/>
        <rect x="192" y="0" width="32" height="44"/>
      </g>
      <circle cx="130" cy="148" r="96" fill="#FFD426" opacity="0.22"/>
    `,
    mid: `
      <!-- Dramatic Blazing Flame Halo -->
      <path d="M32 232 C16 146, 56 98, 86 78 C78 106, 94 114, 102 90 C112 66, 124 44, 130 36 C138 46, 148 66, 158 90 C166 114, 182 106, 174 78 C204 98, 244 146, 228 232 Z" fill="#FF3B30" stroke="#17171C" stroke-width="4.5" stroke-linejoin="round"/>
      <path d="M54 224 C44 156, 86 106, 130 68 C174 106, 216 156, 206 224 Z" fill="#FF7A00" opacity="0.85"/>
      <polygon points="34,74 39,84 50,86 41,92 44,102 34,96 24,102 27,92 18,86 29,84" fill="#FFD426" stroke="#17171C" stroke-width="2.2"/>
      <polygon points="226,86 230,94 239,96 232,101 234,110 226,105 218,110 220,101 213,96 222,94" fill="#00D4AA" stroke="#17171C" stroke-width="2.2"/>
    `,
    hero: `
      <!-- Dragon Teal Horns with Highlights -->
      <path d="M84 98 L58 50 L110 82 Z" fill="#00D4AA" stroke="#17171C" stroke-width="4.5" stroke-linejoin="round"/>
      <path d="M176 98 L202 50 L150 82 Z" fill="#00D4AA" stroke="#17171C" stroke-width="4.5" stroke-linejoin="round"/>
      <!-- Chef Street Headband -->
      <path d="M68 112 C94 94, 166 94, 192 112" fill="none" stroke="#FF3B30" stroke-width="14" stroke-linecap="round"/>
      <!-- Dragon Head -->
      <path d="M66 128 C66 80, 194 80, 194 128 C194 186, 168 214, 130 214 C92 214, 66 186, 66 128 Z" fill="#FFD426" stroke="#17171C" stroke-width="4.5"/>
      <!-- Inner Warm Shading -->
      <path d="M74 158 C84 192, 108 208, 130 208 C152 208, 176 192, 186 158" fill="none" stroke="#F59E0B" stroke-width="8" stroke-linecap="round" opacity="0.6"/>
      <!-- Street Aviator Goggles -->
      <rect x="64" y="122" width="132" height="14" rx="6" fill="#17171C"/>
      <circle cx="99" cy="130" r="24" fill="#00D4AA" stroke="#17171C" stroke-width="4.5"/>
      <circle cx="161" cy="130" r="24" fill="#00D4AA" stroke="#17171C" stroke-width="4.5"/>
      <circle cx="99" cy="130" r="13" fill="#14151B"/>
      <circle cx="161" cy="130" r="13" fill="#14151B"/>
      <circle cx="94" cy="125" r="4" fill="#FFFDF8"/>
      <circle cx="156" cy="125" r="4" fill="#FFFDF8"/>
      <!-- Fierce Grin with Fangs -->
      <path d="M88 172 Q130 206 172 172 Z" fill="#14151B" stroke="#17171C" stroke-width="4"/>
      <polygon points="98,173 108,173 103,186" fill="#FFFDF8"/>
      <polygon points="152,173 162,173 157,186" fill="#FFFDF8"/>
      <path d="M114 188 Q130 181 146 188 Q138 197 122 197 Z" fill="#FF3D9A"/>
      <!-- Street Sizzle Iron Grill Deck -->
      <rect x="44" y="222" width="172" height="44" rx="14" fill="#181820" stroke="#17171C" stroke-width="4.5"/>
      <line x1="56" y1="234" x2="204" y2="234" stroke="#52525B" stroke-width="3" stroke-linecap="round"/>
      <circle cx="82" cy="248" r="10" fill="#FF5526" stroke="#17171C" stroke-width="2.5"/>
      <circle cx="130" cy="248" r="10" fill="#FFD426" stroke="#17171C" stroke-width="2.5"/>
      <circle cx="178" cy="248" r="10" fill="#00D4AA" stroke="#17171C" stroke-width="2.5"/>
    `,
  },

  // #14 RAIN CLOUD — Star-Shades Purple Cloud Vibe
  'rain-cloud': {
    bg: `
      <defs>
        <linearGradient id="rc-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#38BDF8"/>
          <stop offset="55%" stop-color="#7C3AED"/>
          <stop offset="100%" stop-color="#1E1B4B"/>
        </linearGradient>
      </defs>
      <rect width="260" height="320" fill="url(#rc-bg)"/>
    `,
    mid: `
      <!-- Neon Rain Drops -->
      <g fill="#00D4AA" stroke="#1A1A1F" stroke-width="2.5">
        <path d="M64 222 Q70 236 64 244 Q58 236 64 222 Z"/>
        <path d="M108 236 Q114 250 108 258 Q102 250 108 236 Z"/>
        <path d="M156 232 Q162 246 156 254 Q150 246 156 232 Z"/>
        <path d="M198 218 Q204 232 198 240 Q192 232 198 218 Z"/>
      </g>
    `,
    hero: `
      <!-- Fluffy Purple Cloud Character -->
      <g fill="#A78BFA" stroke="#1A1A1F" stroke-width="4.5" stroke-linejoin="round">
        <circle cx="82" cy="148" r="40"/>
        <circle cx="130" cy="116" r="48"/>
        <circle cx="178" cy="148" r="40"/>
        <rect x="74" y="138" width="112" height="52" rx="22" stroke="none"/>
      </g>
      <path d="M74 188 H186" stroke="#1A1A1F" stroke-width="4.5" stroke-linecap="round"/>
      <!-- Star Sunglasses -->
      <polygon points="96,120 103,134 118,136 107,146 110,161 96,154 82,161 85,146 74,136 89,134" fill="#FFD60A" stroke="#1A1A1F" stroke-width="3.5" stroke-linejoin="round"/>
      <polygon points="164,120 171,134 186,136 175,146 178,161 164,154 150,161 153,146 142,136 157,134" fill="#FFD60A" stroke="#1A1A1F" stroke-width="3.5" stroke-linejoin="round"/>
      <line x1="116" y1="142" x2="144" y2="142" stroke="#1A1A1F" stroke-width="4.5"/>
      <path d="M118 172 Q130 182 142 172" fill="none" stroke="#1A1A1F" stroke-width="4" stroke-linecap="round"/>
      <!-- Tiny Lightning Bolt -->
      <polygon points="136,204 116,238 132,238 124,268 152,228 136,228" fill="#FFD60A" stroke="#1A1A1F" stroke-width="3.5" stroke-linejoin="round"/>
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
