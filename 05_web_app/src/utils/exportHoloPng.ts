import { buildSoundSigilData } from '../audio/compositionEngine';
import { getStandaloneArtworkSvg } from '../components/artwork/CardArtwork';
import { HOLO_FOIL_LIST, RARITY_META } from '../data/soundCards';
import { getStickerById } from '../data/stickers';
import type {
  CompositionSnapshot,
  ForgeRarity,
  HoloFoilType,
  PlacedSticker,
} from '../types/holo';

export interface ExportHoloPngOptions {
  title: string;
  code: string;
  rarity: ForgeRarity;
  foil: HoloFoilType;
  artId: string;
  stickers: PlacedSticker[];
  waveformBars: number[];
  waveformIsRealPcm?: boolean;
  sourceType?: 'beat' | 'pinball';
  bpm?: number;
  scaleLabel?: string;
  isDemo?: boolean;
  lineageLabel?: string;
  sigilSnapshot?: CompositionSnapshot | null;
}

function loadSvgImage(svgMarkup: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const blob = new Blob([svgMarkup], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = (err) => {
      URL.revokeObjectURL(url);
      reject(err);
    };
    img.src = url;
  });
}

function drawSoundSigilOnCanvas(
  ctx: CanvasRenderingContext2D,
  snapshot: CompositionSnapshot,
  cx: number,
  cy: number,
  radius: number
) {
  const sigil = buildSoundSigilData(snapshot);
  ctx.save();
  ctx.translate(cx, cy);

  ctx.fillStyle = '#14151B';
  ctx.strokeStyle = 'rgba(255, 214, 10, 0.45)';
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  const maxR = radius * 0.84;
  sigil.rings.forEach((ratio, idx) => {
    ctx.strokeStyle = idx === 2 ? 'rgba(255, 214, 10, 0.34)' : 'rgba(255, 255, 255, 0.16)';
    ctx.lineWidth = idx === 2 ? 1.5 : 1.1;
    ctx.setLineDash(idx === 1 ? [4, 4] : []);
    ctx.beginPath();
    ctx.arc(0, 0, maxR * ratio, 0, Math.PI * 2);
    ctx.stroke();
  });
  ctx.setLineDash([]);

  const innerR = radius * 0.24;
  sigil.spokes.forEach((sp) => {
    const outerR = innerR + sp.length * (maxR - innerR);
    const x1 = Math.cos(sp.angle) * innerR;
    const y1 = Math.sin(sp.angle) * innerR;
    const x2 = Math.cos(sp.angle) * outerR;
    const y2 = Math.sin(sp.angle) * outerR;
    ctx.strokeStyle = sp.color;
    ctx.lineWidth = sp.dot ? 2.8 : 1.4;
    ctx.globalAlpha = sp.dot ? 0.96 : 0.35;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();

    if (sp.dot) {
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#FFFDF8';
      ctx.beginPath();
      ctx.arc(x2, y2, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  });

  ctx.globalAlpha = 1;
  ctx.fillStyle = '#181820';
  ctx.strokeStyle = '#FFD60A';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, 0, radius * 0.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#FFD60A';
  const s = radius * 0.12;
  ctx.beginPath();
  ctx.moveTo(0, -s);
  ctx.lineTo(s * 0.32, -s * 0.32);
  ctx.lineTo(s, 0);
  ctx.lineTo(s * 0.32, s * 0.32);
  ctx.lineTo(0, s);
  ctx.lineTo(-s * 0.32, s * 0.32);
  ctx.lineTo(-s, 0);
  ctx.lineTo(-s * 0.32, -s * 0.32);
  ctx.closePath();
  ctx.fill();

  ctx.restore();
}

/**
 * 100% Offline Native Canvas 2D Gallery-Grade Art Collector Poster Renderer (1200x1600 3:4 HD)
 * Includes:
 * - Obsidian exhibition drafting mat + corner registration crosshairs + ambient foil spotlight
 * - Centered 3x HD holographic card with black-valley diffraction foil, stickers & waveform strip
 * - Deterministic Generative Sound Sigil + Remix Lineage + PCM Audio Spec Plate
 * - Strictly 100% anonymous competition-safe metadata
 */
const ZH_SANS = '"Noto Sans SC", "HarmonyOS Sans SC", "PingFang SC", "Microsoft YaHei", sans-serif';
const HW_MONO = '"JetBrains Mono", "Noto Sans SC", "PingFang SC", monospace';

export async function renderHoloCardToPngBlob(opts: ExportHoloPngOptions): Promise<Blob> {
  if (typeof document !== 'undefined' && document.fonts?.ready) {
    try {
      await document.fonts.ready;
    } catch {
      // Continue safely with fallback fonts
    }
  }

  const PW = 1200;
  const PH = 1600;
  const canvas = document.createElement('canvas');
  canvas.width = PW;
  canvas.height = PH;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D unavailable');

  const foilMeta = HOLO_FOIL_LIST.find((f) => f.id === opts.foil) ?? HOLO_FOIL_LIST[0];
  const rar = RARITY_META[opts.rarity];

  // 1. Exhibition Gallery Mat Backdrop
  ctx.fillStyle = '#121319';
  ctx.fillRect(0, 0, PW, PH);

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
  ctx.lineWidth = 1.5;
  for (let gx = 40; gx < PW; gx += 40) {
    ctx.beginPath();
    ctx.moveTo(gx, 0);
    ctx.lineTo(gx, PH);
    ctx.stroke();
  }
  for (let gy = 40; gy < PH; gy += 40) {
    ctx.beginPath();
    ctx.moveTo(0, gy);
    ctx.lineTo(PW, gy);
    ctx.stroke();
  }

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.14)';
  ctx.lineWidth = 2;
  ctx.strokeRect(36, 36, PW - 72, PH - 72);

  const drawCrosshair = (cx: number, cy: number) => {
    ctx.strokeStyle = 'rgba(255, 212, 38, 0.65)';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(cx - 10, cy);
    ctx.lineTo(cx + 10, cy);
    ctx.moveTo(cx, cy - 10);
    ctx.lineTo(cx, cy + 10);
    ctx.stroke();
  };
  drawCrosshair(64, 64);
  drawCrosshair(PW - 64, 64);
  drawCrosshair(64, PH - 64);
  drawCrosshair(PW - 64, PH - 64);

  ctx.fillStyle = 'rgba(251, 249, 244, 0.8)';
  ctx.font = `700 22px ${ZH_SANS}`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText('HOLOBEAT · 声卡造物局', 92, 72);

  ctx.fillStyle = '#FFD426';
  ctx.font = `700 20px ${HW_MONO}`;
  ctx.textAlign = 'right';
  ctx.fillText(
    `${opts.isDemo ? '示例版' : '典藏版'} · ${opts.code}`,
    PW - 92,
    72
  );

  // 2. Ambient Holographic Spotlight Aura
  const auraColorA =
    opts.rarity === 'LTD' || opts.foil === 'gold'
      ? 'rgba(255, 212, 38, 0.34)'
      : opts.foil === 'cyber'
        ? 'rgba(0, 245, 212, 0.32)'
        : opts.foil === 'chrome'
          ? 'rgba(125, 211, 252, 0.3)'
          : 'rgba(124, 58, 237, 0.35)';
  const auraColorB =
    opts.rarity === 'LTD' || opts.foil === 'gold'
      ? 'rgba(234, 88, 12, 0.18)'
      : 'rgba(255, 61, 154, 0.24)';

  const spotlight = ctx.createRadialGradient(PW / 2, 710, 80, PW / 2, 710, 560);
  spotlight.addColorStop(0, auraColorA);
  spotlight.addColorStop(0.55, auraColorB);
  spotlight.addColorStop(1, 'rgba(18, 19, 25, 0)');
  ctx.fillStyle = spotlight;
  ctx.fillRect(0, 120, PW, 1180);

  // 3. Centered 3x HD Holographic Card (800 x 1120)
  const W = 800;
  const H = 1120;
  const cardX = (PW - W) / 2;
  const cardY = 144;

  ctx.save();
  ctx.shadowColor = 'rgba(0, 0, 0, 0.72)';
  ctx.shadowBlur = 64;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 32;
  ctx.fillStyle = '#0B0C10';
  ctx.beginPath();
  ctx.roundRect(cardX + 4, cardY + 4, W - 8, H - 8, 46);
  ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.translate(cardX, cardY);

  ctx.save();
  ctx.beginPath();
  ctx.roundRect(0, 0, W, H, 46);
  ctx.clip();

  const frameGrad = ctx.createLinearGradient(0, 0, W, H);
  if (opts.rarity === 'LTD') {
    frameGrad.addColorStop(0, '#17171C');
    frameGrad.addColorStop(0.28, '#451A03');
    frameGrad.addColorStop(0.5, '#FEF08A');
    frameGrad.addColorStop(0.68, '#17171C');
    frameGrad.addColorStop(1, '#F59E0B');
  } else if (opts.foil === 'gold') {
    frameGrad.addColorStop(0, '#FEF08A');
    frameGrad.addColorStop(0.35, '#F59E0B');
    frameGrad.addColorStop(0.6, '#FFFBEB');
    frameGrad.addColorStop(1, '#EA580C');
  } else if (opts.foil === 'cyber') {
    frameGrad.addColorStop(0, '#00F5D4');
    frameGrad.addColorStop(0.38, '#7C3AED');
    frameGrad.addColorStop(0.72, '#38BDF8');
    frameGrad.addColorStop(1, '#FF3D9A');
  } else if (opts.foil === 'chrome') {
    frameGrad.addColorStop(0, '#F8FAFC');
    frameGrad.addColorStop(0.32, '#7DD3FC');
    frameGrad.addColorStop(0.62, '#1E293B');
    frameGrad.addColorStop(1, '#C084FC');
  } else if (opts.foil === 'spark') {
    frameGrad.addColorStop(0, '#E2E8F0');
    frameGrad.addColorStop(0.35, '#BAE6FD');
    frameGrad.addColorStop(0.7, '#F5D0FE');
    frameGrad.addColorStop(1, '#FEF9C3');
  } else {
    frameGrad.addColorStop(0, '#FF3D9A');
    frameGrad.addColorStop(0.24, '#FFD426');
    frameGrad.addColorStop(0.48, '#00D4AA');
    frameGrad.addColorStop(0.72, '#38BDF8');
    frameGrad.addColorStop(1, '#7C3AED');
  }
  ctx.fillStyle = frameGrad;
  ctx.fillRect(0, 0, W, H);

  const pad = 26;
  const innerW = W - pad * 2;
  const innerH = H - pad * 2;
  const ribbonH = 152;
  const artH = innerH - ribbonH;

  ctx.save();
  ctx.beginPath();
  ctx.roundRect(pad, pad, innerW, innerH, 32);
  ctx.clip();

  const artImg = await loadSvgImage(getStandaloneArtworkSvg(opts.artId));
  ctx.drawImage(artImg, pad, pad, innerW, artH);

  // Stickers sorted by zIndex
  const sortedStickers = [...opts.stickers].sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0));
  for (const stk of sortedStickers) {
    const def = getStickerById(stk.stickerId);
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="240" height="240">${def.svgInner}</svg>`;
    const sImg = await loadSvgImage(svg);
    const sx = pad + (stk.x / 100) * innerW;
    const sy = pad + (stk.y / 100) * artH;
    const sSize = 132 * stk.scale;
    ctx.save();
    ctx.translate(sx, sy);
    ctx.rotate((stk.rotation * Math.PI) / 180);
    ctx.drawImage(sImg, -sSize / 2, -sSize / 2, sSize, sSize);
    ctx.restore();
  }

  // Embedded Audio Fingerprint Strip
  const fpX = pad + 34;
  const fpY = pad + artH - 96;
  const fpW = innerW - 68;
  const fpH = 72;
  ctx.fillStyle = 'rgba(20, 21, 27, 0.95)';
  ctx.strokeStyle = '#17171C';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.roundRect(fpX, fpY, fpW, fpH, 36);
  ctx.fill();
  ctx.stroke();

  const barColors = ['#7C3AED', '#FF3D9A', '#FF5526', '#FFD426', '#00D4AA', '#38BDF8'];
  const count = opts.waveformBars.length || 24;
  const bGap = 7;
  const bW = (fpW - 54 - bGap * (count - 1)) / count;
  for (let i = 0; i < count; i++) {
    const v = opts.waveformBars[i] ?? 0.4;
    const bh = Math.max(10, v * (fpH - 22));
    ctx.fillStyle = barColors[Math.floor((i / count) * barColors.length)];
    ctx.beginPath();
    ctx.roundRect(fpX + 27 + i * (bW + bGap), fpY + (fpH - bh) / 2, bW, bh, 4);
    ctx.fill();
  }

  // Top-Left Rarity Badge
  ctx.save();
  ctx.translate(pad + 86, pad + 64);
  ctx.rotate(-0.1);
  ctx.fillStyle = '#17171C';
  ctx.beginPath();
  ctx.roundRect(-56, -28, 124, 62, 16);
  ctx.fill();
  ctx.fillStyle = rar.bg;
  ctx.strokeStyle = '#17171C';
  ctx.lineWidth = 6.5;
  ctx.beginPath();
  ctx.roundRect(-62, -34, 124, 62, 16);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = rar.text;
  ctx.font = '900 34px "Space Grotesk", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const badgeText =
    opts.rarity === 'UR' ? '✦ UR' : opts.rarity === 'LTD' ? '◆ LTD' : '★ SSR';
  ctx.fillText(badgeText, 0, -1);
  ctx.restore();

  // Top-Right Serial ID Pill
  const codePillW = Math.max(164, opts.code.length * 18 + 38);
  ctx.fillStyle = '#17171C';
  ctx.beginPath();
  ctx.roundRect(pad + innerW - codePillW - 30, pad + 34, codePillW, 54, 27);
  ctx.fill();
  ctx.fillStyle = '#FBF9F4';
  ctx.strokeStyle = '#17171C';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.roundRect(pad + innerW - codePillW - 36, pad + 28, codePillW, 54, 27);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#17171C';
  ctx.font = '900 24px "JetBrains Mono", monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(opts.code, pad + innerW - codePillW / 2 - 36, pad + 56);

  // Bottom Precision Collector Nameplate
  const isLtd = opts.rarity === 'LTD';
  ctx.fillStyle = isLtd ? '#14151B' : '#FBF9F4';
  ctx.fillRect(pad, pad + artH, innerW, ribbonH);
  ctx.strokeStyle = '#17171C';
  ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.moveTo(pad, pad + artH);
  ctx.lineTo(pad + innerW, pad + artH);
  ctx.stroke();

  ctx.fillStyle = isLtd ? 'rgba(254, 240, 138, 0.68)' : 'rgba(98, 98, 114, 0.85)';
  ctx.font = `700 20px ${ZH_SANS}`;
  ctx.textAlign = 'left';
  ctx.fillText(
    `${opts.sourceType === 'pinball' ? '弹珠作品' : '节拍作品'} · ${foilMeta.zhLabel}`,
    pad + 34,
    pad + artH + 34
  );
  ctx.textAlign = 'right';
  ctx.fillText(
    opts.lineageLabel ? opts.lineageLabel : '原创首发',
    pad + innerW - 34,
    pad + artH + 34
  );

  ctx.fillStyle = isLtd ? '#FEF08A' : '#17171C';
  ctx.font = `900 50px ${ZH_SANS}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(`✦ ${opts.title} ✦`, W / 2, pad + artH + ribbonH / 2 + 16, innerW - 72);

  // Black-Valley Holographic Diffraction Pass — clipped STRICTLY to artwork area (protects badges, text & waveform!)
  ctx.save();
  ctx.beginPath();
  ctx.rect(pad, pad, innerW, artH);
  ctx.clip();
  ctx.globalCompositeOperation = 'color-dodge';
  ctx.globalAlpha = opts.rarity === 'UR' ? 0.34 : 0.28;

  if (opts.foil === 'prism') {
    const g = ctx.createLinearGradient(0, 0, W, H);
    g.addColorStop(0.0, '#000000');
    g.addColorStop(0.18, '#FF3D9A');
    g.addColorStop(0.32, '#FFD426');
    g.addColorStop(0.46, '#00D4AA');
    g.addColorStop(0.6, '#38BDF8');
    g.addColorStop(0.74, '#7C3AED');
    g.addColorStop(0.86, '#000000');
    g.addColorStop(1.0, '#FF3D9A');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  } else if (opts.foil === 'gold') {
    const g = ctx.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, '#000000');
    g.addColorStop(0.28, '#D97706');
    g.addColorStop(0.46, '#FEF08A');
    g.addColorStop(0.56, '#FFFBEB');
    g.addColorStop(0.72, '#000000');
    g.addColorStop(0.92, '#F59E0B');
    g.addColorStop(1, '#000000');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  } else if (opts.foil === 'cyber') {
    for (let x = -H; x < W + H; x += 26) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x + H, H);
      ctx.lineWidth = 7;
      ctx.strokeStyle = x % 52 === 0 ? 'rgba(0,245,212,0.8)' : 'rgba(139,92,246,0.75)';
      ctx.stroke();
    }
  } else if (opts.foil === 'chrome') {
    const g = ctx.createLinearGradient(0, H, W, 0);
    g.addColorStop(0, '#000000');
    g.addColorStop(0.26, '#E0F2FE');
    g.addColorStop(0.44, '#000000');
    g.addColorStop(0.68, '#C084FC');
    g.addColorStop(0.84, '#F8FAFC');
    g.addColorStop(1, '#000000');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  } else {
    const g = ctx.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, '#000000');
    g.addColorStop(0.32, '#7DD3FC');
    g.addColorStop(0.54, '#F5D0FE');
    g.addColorStop(0.78, '#000000');
    g.addColorStop(1, '#FEF08A');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }
  ctx.restore();

  if (opts.rarity === 'UR' || opts.foil === 'spark' || opts.rarity === 'SSR') {
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    const starCount = opts.rarity === 'UR' || opts.foil === 'spark' ? 46 : 22;
    for (let s = 0; s < starCount; s++) {
      const sx = ((s * 179 + 61) % (W - 90)) + 45;
      const sy = ((s * 283 + 47) % (artH - 40)) + pad + 20;
      const r = (s % 3) * 4 + 6;
      ctx.fillStyle = s % 3 === 0 ? '#FFFFFF' : s % 3 === 1 ? '#FEF08A' : '#7DD3FC';
      ctx.globalAlpha = 0.55 + (s % 4) * 0.1;
      ctx.beginPath();
      ctx.moveTo(sx, sy - r);
      ctx.lineTo(sx + r * 0.24, sy - r * 0.24);
      ctx.lineTo(sx + r, sy);
      ctx.lineTo(sx + r * 0.24, sy + r * 0.24);
      ctx.lineTo(sx, sy + r);
      ctx.lineTo(sx - r * 0.24, sy + r * 0.24);
      ctx.lineTo(sx - r, sy);
      ctx.lineTo(sx - r * 0.24, sy - r * 0.24);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  // Diagonal Specular Light Shaft
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  const glare = ctx.createLinearGradient(W * 0.08, 0, W * 0.92, H);
  glare.addColorStop(0, 'rgba(255,255,255,0)');
  glare.addColorStop(0.36, 'rgba(255,255,255,0.28)');
  glare.addColorStop(0.42, 'rgba(255,255,255,0.06)');
  glare.addColorStop(0.68, 'rgba(255,255,255,0.18)');
  glare.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = glare;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();

  // Peeled Foil Corner
  ctx.save();
  const px = pad + innerW;
  const py = pad + innerH;
  ctx.fillStyle = '#14151B';
  ctx.beginPath();
  ctx.moveTo(px, py - 84);
  ctx.lineTo(px, py);
  ctx.lineTo(px - 84, py);
  ctx.closePath();
  ctx.fill();
  const pGrad = ctx.createLinearGradient(px - 84, py - 84, px, py);
  pGrad.addColorStop(0, '#FFFFFF');
  pGrad.addColorStop(0.5, isLtd ? '#FEF08A' : '#CBD5E1');
  pGrad.addColorStop(1, isLtd ? '#B45309' : '#475569');
  ctx.fillStyle = pGrad;
  ctx.strokeStyle = '#17171C';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(px, py - 84);
  ctx.quadraticCurveTo(px - 34, py - 34, px - 84, py);
  ctx.quadraticCurveTo(px - 22, py - 20, px, py - 84);
  ctx.fill();
  ctx.stroke();
  ctx.restore();

  ctx.restore(); // inner clip

  ctx.strokeStyle = '#17171C';
  ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.roundRect(pad, pad, innerW, innerH, 32);
  ctx.stroke();

  ctx.restore(); // outer clip

  ctx.strokeStyle = '#17171C';
  ctx.lineWidth = 10;
  ctx.beginPath();
  ctx.roundRect(0, 0, W, H, 46);
  ctx.stroke();

  ctx.restore(); // card translate

  // 4. Bottom Exhibition Collector Spec Plate with Deterministic Sound Sigil!
  const plateX = 96;
  const plateY = 1316;
  const plateW = PW - 192;
  const plateH = 200;

  ctx.fillStyle = 'rgba(255, 255, 255, 0.045)';
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.16)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(plateX, plateY, plateW, plateH, 24);
  ctx.fill();
  ctx.stroke();

  // Left: Deterministic Sound Sigil Emblem (if snapshot available)
  let textStartX = plateX + 34;
  if (opts.sigilSnapshot) {
    drawSoundSigilOnCanvas(ctx, opts.sigilSnapshot, plateX + 98, plateY + plateH / 2, 66);
    textStartX = plateX + 188;
  }

  ctx.fillStyle = '#FBF9F4';
  ctx.font = `900 40px ${ZH_SANS}`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText(opts.title, textStartX, plateY + 26, plateW - 410);

  const sourceDesc =
    opts.sourceType === 'pinball'
      ? `弹珠作品 · ${opts.scaleLabel ?? 'C 五声'}`
      : `节拍作品 · ${opts.bpm ?? 116} BPM · ${opts.scaleLabel ?? 'C 五声'}`;

  ctx.fillStyle = '#00D4AA';
  ctx.font = `700 21px ${HW_MONO}`;
  ctx.fillText(sourceDesc, textStartX, plateY + 86, plateW - 420);

  const shortLineage = opts.isDemo
    ? '示例作品'
    : opts.lineageLabel
      ? opts.lineageLabel
      : '原创首发';

  ctx.fillStyle = 'rgba(251, 249, 244, 0.6)';
  ctx.font = `700 17px ${ZH_SANS}`;
  ctx.fillText(
    `材质：${foilMeta.zhLabel} · ${shortLineage} · ${
      opts.waveformIsRealPcm ? '真实声纹' : '声学图谱'
    }`,
    textStartX,
    plateY + 136,
    plateW - 410
  );

  // Right: Collector Serial Stamp + Micro-Waveform
  ctx.fillStyle = '#FFD426';
  ctx.font = `900 28px ${HW_MONO}`;
  ctx.textAlign = 'right';
  ctx.fillText(opts.code, plateX + plateW - 34, plateY + 30);

  const mwW = 180;
  const mwX = plateX + plateW - 34 - mwW;
  const mwY = plateY + 86;
  const mwCount = 16;
  const mwGap = 5;
  const mwBw = (mwW - mwGap * (mwCount - 1)) / mwCount;
  for (let i = 0; i < mwCount; i++) {
    const v = opts.waveformBars[i] ?? 0.45;
    const bh = Math.max(8, v * 44);
    ctx.fillStyle = barColors[i % barColors.length];
    ctx.beginPath();
    ctx.roundRect(mwX + i * (mwBw + mwGap), mwY + (44 - bh) / 2, mwBw, bh, 3);
    ctx.fill();
  }

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('Failed to export PNG blob'));
    }, 'image/png');
  });
}
