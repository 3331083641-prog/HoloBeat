import { getStandaloneArtworkSvg } from '../components/artwork/CardArtwork';
import { RARITY_META } from '../data/soundCards';
import { getStickerById } from '../data/stickers';
import type { ForgeRarity, HoloFoilType, PlacedSticker } from '../types/holo';

export interface ExportHoloPngOptions {
  title: string;
  code: string;
  rarity: ForgeRarity;
  foil: HoloFoilType;
  artId: string;
  stickers: PlacedSticker[];
  waveformBars: number[];
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

/**
 * 100% Offline Native Canvas 2D Dual-Pass 3x Ultra-HD (960x1344) Holographic Card Renderer
 * Preserves true 'color-dodge' / 'overlay' / 'screen' iridescent foil sheen with ZERO CORS issues!
 */
export async function renderHoloCardToPngBlob(opts: ExportHoloPngOptions): Promise<Blob> {
  const W = 960;
  const H = 1344;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D unavailable');

  // 1. Outer Rounded Card Clip & Holographic Metallic Frame
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(12, 12, W - 24, H - 24, 52);
  ctx.clip();

  const frameGrad = ctx.createLinearGradient(0, 0, W, H);
  if (opts.foil === 'gold') {
    frameGrad.addColorStop(0, '#FEF08A');
    frameGrad.addColorStop(0.35, '#F59E0B');
    frameGrad.addColorStop(0.6, '#FFFBEB');
    frameGrad.addColorStop(1, '#EA580C');
  } else if (opts.foil === 'cyber') {
    frameGrad.addColorStop(0, '#00F5D4');
    frameGrad.addColorStop(0.4, '#7C3AED');
    frameGrad.addColorStop(0.75, '#38BDF8');
    frameGrad.addColorStop(1, '#FF3D9A');
  } else if (opts.foil === 'chrome') {
    frameGrad.addColorStop(0, '#F8FAFC');
    frameGrad.addColorStop(0.35, '#7DD3FC');
    frameGrad.addColorStop(0.65, '#334155');
    frameGrad.addColorStop(1, '#C084FC');
  } else if (opts.foil === 'spark') {
    frameGrad.addColorStop(0, '#E2E8F0');
    frameGrad.addColorStop(0.35, '#BAE6FD');
    frameGrad.addColorStop(0.7, '#F5D0FE');
    frameGrad.addColorStop(1, '#FEF9C3');
  } else {
    frameGrad.addColorStop(0, '#FF3D9A');
    frameGrad.addColorStop(0.24, '#FFD60A');
    frameGrad.addColorStop(0.48, '#00D4AA');
    frameGrad.addColorStop(0.72, '#38BDF8');
    frameGrad.addColorStop(1, '#7C3AED');
  }
  ctx.fillStyle = frameGrad;
  ctx.fillRect(0, 0, W, H);

  // 2. Inner Card Panel Clip
  const pad = 34;
  const innerW = W - pad * 2;
  const innerH = H - pad * 2;
  const ribbonH = 166;
  const artH = innerH - ribbonH;

  ctx.save();
  ctx.beginPath();
  ctx.roundRect(pad, pad, innerW, innerH, 36);
  ctx.clip();

  // 3. Draw 3x Vector Street-Toy Mascot Artwork
  const artImg = await loadSvgImage(getStandaloneArtworkSvg(opts.artId));
  ctx.drawImage(artImg, pad, pad, innerW, artH);

  // 4. Draw Placed Interactive Stickers
  for (const stk of opts.stickers) {
    const def = getStickerById(stk.stickerId);
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="240" height="240">${def.svgInner}</svg>`;
    const sImg = await loadSvgImage(svg);
    const sx = pad + (stk.x / 100) * innerW;
    const sy = pad + (stk.y / 100) * artH;
    const sSize = 156 * stk.scale;
    ctx.save();
    ctx.translate(sx, sy);
    ctx.rotate((stk.rotation * Math.PI) / 180);
    ctx.drawImage(sImg, -sSize / 2, -sSize / 2, sSize, sSize);
    ctx.restore();
  }

  // 5. Embedded Audio Fingerprint Pill Strip
  const fpX = pad + 42;
  const fpY = pad + artH - 110;
  const fpW = innerW - 84;
  const fpH = 82;
  ctx.fillStyle = 'rgba(24, 24, 32, 0.94)';
  ctx.strokeStyle = '#1A1A1F';
  ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.roundRect(fpX, fpY, fpW, fpH, 41);
  ctx.fill();
  ctx.stroke();

  const barColors = ['#7C3AED', '#FF3D9A', '#FF5C2B', '#FFD60A', '#00D4AA', '#38BDF8'];
  const count = opts.waveformBars.length || 24;
  const bGap = 8;
  const bW = (fpW - 60 - bGap * (count - 1)) / count;
  for (let i = 0; i < count; i++) {
    const v = opts.waveformBars[i] ?? 0.4;
    const bh = Math.max(12, v * (fpH - 26));
    ctx.fillStyle = barColors[Math.floor((i / count) * barColors.length)];
    ctx.beginPath();
    ctx.roundRect(fpX + 30 + i * (bW + bGap), fpY + (fpH - bh) / 2, bW, bh, 5);
    ctx.fill();
  }

  // 6. Top-Left Rarity Badge & Top-Right Serial ID Pill
  const rar = RARITY_META[opts.rarity];
  ctx.save();
  ctx.translate(pad + 98, pad + 72);
  ctx.rotate(-0.11);
  ctx.fillStyle = '#1A1A1F';
  ctx.beginPath();
  ctx.roundRect(-64, -32, 138, 72, 18);
  ctx.fill();
  ctx.fillStyle = rar.bg;
  ctx.strokeStyle = '#1A1A1F';
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.roundRect(-72, -40, 138, 72, 18);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = rar.text;
  ctx.font = '900 42px "Space Grotesk", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(opts.rarity === 'UR' ? '✦ UR' : rar.label, -3, -2);
  ctx.restore();

  // Top-right Code Pill
  ctx.fillStyle = '#1A1A1F';
  ctx.beginPath();
  ctx.roundRect(pad + innerW - 216, pad + 38, 182, 64, 32);
  ctx.fill();
  ctx.fillStyle = '#FFFDF8';
  ctx.strokeStyle = '#1A1A1F';
  ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.roundRect(pad + innerW - 222, pad + 32, 182, 64, 32);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#1A1A1F';
  ctx.font = '900 32px "JetBrains Mono", monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(opts.code, pad + innerW - 131, pad + 66);

  // 7. Bottom Title Ribbon
  ctx.fillStyle = '#FFFDF8';
  ctx.fillRect(pad, pad + artH, innerW, ribbonH);
  ctx.strokeStyle = '#1A1A1F';
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.moveTo(pad, pad + artH);
  ctx.lineTo(pad + innerW, pad + artH);
  ctx.stroke();

  ctx.fillStyle = '#1A1A1F';
  ctx.font = 'italic 900 62px "Space Grotesk", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(`✦ ${opts.title.toUpperCase()} ✦`, W / 2, pad + artH + ribbonH / 2 - 4);

  // 8. Dual-Pass Native Canvas Iridescent Holographic Foil Overlay ('color-dodge' + 'screen')!
  ctx.save();
  ctx.globalCompositeOperation = 'color-dodge';
  ctx.globalAlpha = 0.46;

  if (opts.foil === 'prism') {
    const g = ctx.createLinearGradient(0, 0, W, H);
    g.addColorStop(0.0, '#FF3D9A');
    g.addColorStop(0.22, '#FFD60A');
    g.addColorStop(0.45, '#00D4AA');
    g.addColorStop(0.68, '#38BDF8');
    g.addColorStop(0.88, '#7C3AED');
    g.addColorStop(1.0, '#FF3D9A');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  } else if (opts.foil === 'gold') {
    const g = ctx.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, '#FEF08A');
    g.addColorStop(0.4, '#F59E0B');
    g.addColorStop(0.62, '#FFFBEB');
    g.addColorStop(1, '#EA580C');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  } else if (opts.foil === 'cyber') {
    ctx.fillStyle = '#00F5D4';
    for (let x = -H; x < W + H; x += 28) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x + H, H);
      ctx.lineWidth = 10;
      ctx.strokeStyle = x % 56 === 0 ? 'rgba(0,245,212,0.85)' : 'rgba(155,93,229,0.85)';
      ctx.stroke();
    }
  } else if (opts.foil === 'chrome') {
    const g = ctx.createLinearGradient(0, H, W, 0);
    g.addColorStop(0, '#F8FAFC');
    g.addColorStop(0.3, '#7DD3FC');
    g.addColorStop(0.55, '#334155');
    g.addColorStop(0.8, '#C084FC');
    g.addColorStop(1, '#F8FAFC');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  } else {
    // Spark stardust glitter
    const g = ctx.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, '#E2E8F0');
    g.addColorStop(0.5, '#BAE6FD');
    g.addColorStop(1, '#F5D0FE');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'screen';
    ctx.globalAlpha = 0.85;
    for (let s = 0; s < 140; s++) {
      const sx = ((s * 173) % (W - 80)) + 40;
      const sy = ((s * 293) % (H - 80)) + 40;
      const sr = (s % 4) * 3 + 3;
      ctx.fillStyle = s % 3 === 0 ? '#FFFFFF' : '#FEF08A';
      ctx.beginPath();
      ctx.arc(sx, sy, sr, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();

  // Diagonal Specular Glare Sheen
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  const glare = ctx.createLinearGradient(W * 0.1, 0, W * 0.9, H);
  glare.addColorStop(0, 'rgba(255,255,255,0)');
  glare.addColorStop(0.38, 'rgba(255,255,255,0.42)');
  glare.addColorStop(0.46, 'rgba(255,255,255,0.12)');
  glare.addColorStop(0.7, 'rgba(255,255,255,0.28)');
  glare.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = glare;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();

  // Peeled Silver Foil Corner Accent (Bottom-Right)
  ctx.save();
  const px = pad + innerW;
  const py = pad + innerH;
  ctx.fillStyle = '#181820';
  ctx.beginPath();
  ctx.moveTo(px, py - 108);
  ctx.lineTo(px, py);
  ctx.lineTo(px - 108, py);
  ctx.closePath();
  ctx.fill();
  const pGrad = ctx.createLinearGradient(px - 108, py - 108, px, py);
  pGrad.addColorStop(0, '#FFFFFF');
  pGrad.addColorStop(0.5, '#CBD5E1');
  pGrad.addColorStop(1, '#475569');
  ctx.fillStyle = pGrad;
  ctx.strokeStyle = '#1A1A1F';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(px, py - 108);
  ctx.quadraticCurveTo(px - 42, py - 42, px - 108, py);
  ctx.quadraticCurveTo(px - 28, py - 24, px, py - 108);
  ctx.fill();
  ctx.stroke();
  ctx.restore();

  ctx.restore(); // inner clip

  // Crisp Inner & Outer Neo-Brutalist Borders
  ctx.strokeStyle = '#1A1A1F';
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.roundRect(pad, pad, innerW, innerH, 36);
  ctx.stroke();

  ctx.restore(); // outer clip

  ctx.strokeStyle = '#1A1A1F';
  ctx.lineWidth = 14;
  ctx.beginPath();
  ctx.roundRect(12, 12, W - 24, H - 24, 52);
  ctx.stroke();

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('Failed to export PNG blob'));
    }, 'image/png');
  });
}
