import { ASSET_VERSION } from '../audio/compositionEngine';

export interface AssetManifestEntry {
  id: string;
  usage: 'card-character' | 'sticker' | 'stage-backdrop' | 'sound-icon';
  sourceFile: string | null;
  runtimeFile: string;
  fallbackMode: 'svg-inline';
  dimensions: { width: number; height: number };
  safeAreaPct: number;
  version: string;
  promptRef?: string;
  origin: 'original-vector-svg' | 'external-raster-pending';
  manualEdits: string;
  license: string;
}

/**
 * Shared runtime asset registry used consistently by Web UI, PNG Poster Export,
 * and Motion Card WebM Export. Currently powered by high-craft original vector SVGs
 * with clean drop-in slots prepared under D:\HoloBeat\08_assets\ for future PNG renders.
 */
export const RUNTIME_ASSET_MANIFEST: {
  manifestVersion: string;
  entries: AssetManifestEntry[];
} = {
  manifestVersion: ASSET_VERSION,
  entries: [
    {
      id: 'bamboo-cat',
      usage: 'card-character',
      sourceFile: '08_assets/source/cards/01_bamboo_clapper.png',
      runtimeFile: 'svg:CardArtwork#bamboo-cat',
      fallbackMode: 'svg-inline',
      dimensions: { width: 260, height: 320 },
      safeAreaPct: 12,
      version: ASSET_VERSION,
      promptRef: '08_assets/prompts/character_prompts.md#1-竹板梆子',
      origin: 'original-vector-svg',
      manualEdits: '重构为双片竹节+红绳结核心轮廓，移除旧版 DJ 猫与黑胶唱盘',
      license: 'Project Original (MIT)',
    },
    {
      id: 'street-bell',
      usage: 'card-character',
      sourceFile: '08_assets/source/cards/05_street_bell.png',
      runtimeFile: 'svg:CardArtwork#street-bell',
      fallbackMode: 'svg-inline',
      dimensions: { width: 260, height: 320 },
      safeAreaPct: 12,
      version: ASSET_VERSION,
      promptRef: '08_assets/prompts/character_prompts.md#2-二八车铃',
      origin: 'original-vector-svg',
      manualEdits: '重构为半球铜铃罩+拇指拨杆+车把夹具核心轮廓，移除旧版硬币脸人物',
      license: 'Project Original (MIT)',
    },
    {
      id: 'lucky-coin',
      usage: 'card-character',
      sourceFile: '08_assets/source/cards/09_arcade_coin.png',
      runtimeFile: 'svg:CardArtwork#lucky-coin',
      fallbackMode: 'svg-inline',
      dimensions: { width: 260, height: 320 },
      safeAreaPct: 12,
      version: ASSET_VERSION,
      promptRef: '08_assets/prompts/character_prompts.md#3-街机投币',
      origin: 'original-vector-svg',
      manualEdits: '重构为圆币+薄荷投币槽+像素落槽瞬间，移除旧版招财猫造型',
      license: 'Project Original (MIT)',
    },
    {
      id: 'night-sizzle',
      usage: 'card-character',
      sourceFile: '08_assets/source/cards/13_night_sizzle.png',
      runtimeFile: 'svg:CardArtwork#night-sizzle',
      fallbackMode: 'svg-inline',
      dimensions: { width: 260, height: 320 },
      safeAreaPct: 12,
      version: ASSET_VERSION,
      promptRef: '08_assets/prompts/character_prompts.md#4-夜市铁板',
      origin: 'original-vector-svg',
      manualEdits: '重构为深色铁板+橙色炉体+双铲子臂+三条蒸汽曲线，移除旧版龙首面具',
      license: 'Project Original (MIT)',
    },
    {
      id: 'sugar-spoon',
      usage: 'card-character',
      sourceFile: '08_assets/source/cards/10_sugar_spoon.png',
      runtimeFile: 'svg:CardArtwork#sugar-spoon',
      fallbackMode: 'svg-inline',
      dimensions: { width: 260, height: 320 },
      safeAreaPct: 12,
      version: ASSET_VERSION,
      promptRef: '08_assets/prompts/character_prompts.md#糖画铜勺',
      origin: 'original-vector-svg',
      manualEdits: '强化倾斜黄铜浇勺与石板拉丝琥珀糖龙的动态关系',
      license: 'Project Original (MIT)',
    },
  ],
};

export function getAssetManifestEntry(id: string): AssetManifestEntry | undefined {
  return RUNTIME_ASSET_MANIFEST.entries.find((e) => e.id === id);
}
