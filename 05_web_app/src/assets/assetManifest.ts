import { ASSET_VERSION } from '../audio/compositionEngine';
import { SOUND_CARD_ART_BRIEFS } from '../data/artBriefs';

export interface AssetManifestEntry {
  id: string;
  cardId?: string;
  usage: 'card-character' | 'sticker' | 'stage-backdrop' | 'sound-icon';
  sourceFile: string | null;
  runtimeFile: string;
  fallbackMode: 'svg-inline';
  dimensions: { width: number; height: number };
  safeAreaPct: number;
  version: string;
  promptRef?: string;
  origin: 'gpt-image-2-raster' | 'original-vector-svg';
  manualEdits: string;
  license: string;
}

/**
 * Shared runtime asset registry used consistently by Web UI (CardArtwork),
 * 1200x1600 HD PNG Gallery Poster (exportHoloPng), and Motion Card WebM (exportMotionCard).
 * All 16 street sound-card heroes now run on archived & optically framed GPT Image 2 RGBA WebP assets
 * with SVG studio backdrops and instant vector fallback.
 */
export const RUNTIME_ASSET_MANIFEST: {
  manifestVersion: string;
  entries: AssetManifestEntry[];
} = {
  manifestVersion: ASSET_VERSION,
  entries: SOUND_CARD_ART_BRIEFS.map((brief) => ({
    id: brief.artId,
    cardId: brief.cardId,
    usage: 'card-character' as const,
    sourceFile: `08_assets/source/cards/${brief.artId}.png`,
    runtimeFile: `/assets/cards/${brief.artId}.webp`,
    fallbackMode: 'svg-inline' as const,
    dimensions: { width: 780, height: 960 },
    safeAreaPct: 14,
    version: ASSET_VERSION,
    promptRef: `08_assets/prompts/gpt_image_2_pack.md#${brief.artId}`,
    origin: 'gpt-image-2-raster' as const,
    manualEdits: 'Alpha 透明边缘紧致裁切 + 780x960 光学居中对齐 + 留足顶部角标/底部声纹安全区 + WebP 压缩优化',
    license: 'Project Original Asset',
  })),
};

export function getAssetManifestEntry(id: string): AssetManifestEntry | undefined {
  return RUNTIME_ASSET_MANIFEST.entries.find((e) => e.id === id);
}
