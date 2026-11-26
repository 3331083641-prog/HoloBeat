import { assetUrl } from '../utils/assetUrl.ts';
import { ASSET_VERSION } from '../audio/compositionEngine';
import { SOUND_CARD_ART_BRIEFS } from '../data/artBriefs';
import { STICKER_PACK } from '../data/stickers';

export interface AssetManifestEntry {
  id: string;
  cardId?: string;
  usage: 'card-character' | 'sticker' | 'stage-backdrop' | 'sound-icon';
  sourceFile: string | null;
  runtimeFile: string;
  fallbackMode: 'svg-inline' | 'canvas-procedural';
  dimensions: { width: number; height: number };
  safeAreaPct: number;
  version: string;
  promptRef?: string;
  origin: 'gpt-image-2-raster' | 'original-vector-svg';
  manualEdits: string;
  license: string;
}

/**
 * Shared runtime asset registry used consistently by Web UI (CardArtwork / HoloCard / PinballPage),
 * 1200x1600 HD PNG Gallery Poster (exportHoloPng), and Motion Card WebM (exportMotionCard).
 * ALL 29 custom GPT Image 2 assets (16 card heroes + 12 die-cut matte stickers + 1 stage backdrop)
 * are archived, alpha-normalized, WebP-compressed, and live in runtime with instant fallback.
 */
export const RUNTIME_ASSET_MANIFEST: {
  manifestVersion: string;
  entries: AssetManifestEntry[];
} = {
  manifestVersion: ASSET_VERSION,
  entries: [
    ...SOUND_CARD_ART_BRIEFS.map((brief) => ({
      id: brief.artId,
      cardId: brief.cardId,
      usage: 'card-character' as const,
      sourceFile: `08_assets/source/cards/${brief.artId}.png`,
      runtimeFile: assetUrl(`/assets/cards/${brief.artId}.webp`),
      fallbackMode: 'svg-inline' as const,
      dimensions: { width: 780, height: 960 },
      safeAreaPct: 14,
      version: ASSET_VERSION,
      promptRef: `08_assets/prompts/gpt_image_2_pack.md#${brief.artId}`,
      origin: 'gpt-image-2-raster' as const,
      manualEdits: 'Alpha 透明边缘紧致裁切 + 780x960 光学居中对齐 + WebP 压缩优化',
      license: 'Project Original Asset',
    })),
    ...STICKER_PACK.map((stk) => ({
      id: `sticker-${stk.id}`,
      usage: 'sticker' as const,
      sourceFile: `08_assets/source/stickers/${stk.id}.png`,
      runtimeFile: stk.rasterUrl,
      fallbackMode: 'svg-inline' as const,
      dimensions: { width: 256, height: 256 },
      safeAreaPct: 4,
      version: ASSET_VERSION,
      promptRef: `08_assets/prompts/gpt_image_2_pack.md#${stk.id}`,
      origin: 'gpt-image-2-raster' as const,
      manualEdits:
        stk.id === 'spoon' || stk.id === 'coin'
          ? '外缘纯黑底 BFS 泛洪去背 + 白边抗锯齿柔化 + 256x256 居中 WebP 压缩'
          : '透明包围盒紧致裁切 + 256x256 居中 WebP 压缩',
      license: 'Project Original Asset',
    })),
    {
      id: 'pinball-stage-bg',
      usage: 'stage-backdrop',
      sourceFile: '08_assets/source/scenes/pinball_stage_bg.jpg',
      runtimeFile: assetUrl('/assets/scenes/pinball_stage_bg.webp'),
      fallbackMode: 'canvas-procedural',
      dimensions: { width: 1024, height: 682 },
      safeAreaPct: 65,
      version: ASSET_VERSION,
      promptRef: '08_assets/prompts/gpt_image_2_pack.md#stage',
      origin: 'gpt-image-2-raster',
      manualEdits: '保留边缘雨棚/车铃柱/16格竹板地砖与中央深炭黑低干扰区，WebP 质量90压缩',
      license: 'Project Original Asset',
    },
  ],
};

export function getAssetManifestEntry(id: string): AssetManifestEntry | undefined {
  return RUNTIME_ASSET_MANIFEST.entries.find((e) => e.id === id);
}
