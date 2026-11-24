import React, { useMemo, useState } from 'react';
import { Download, Eraser, Music, Pause, Play, Sparkles, Stamp, Trash2 } from 'lucide-react';
import { holoAudio } from '../audio/HoloAudioEngine';
import { useHoloSfx } from '../audio/useHoloSfx';
import {
  renderBeatMixToWav,
  renderPinballToWav,
  triggerBlobDownload,
} from '../audio/wavExporter';
import { CardArtwork } from '../components/artwork/CardArtwork';
import { HoloCard } from '../components/holo/HoloCard';
import { HOLO_FOIL_LIST, RARITY_META, SCALE_META, SOUND_CARDS, getCardById } from '../data/soundCards';
import { STICKER_PACK } from '../data/stickers';
import { computeWaveformFingerprint, useHoloStore } from '../store/useHoloStore';
import type { ForgeRarity } from '../types/holo';
import { fireHoloConfetti } from '../utils/confetti';
import { renderHoloCardToPngBlob } from '../utils/exportHoloPng';

export const ForgePage: React.FC = () => {
  const forgeSource = useHoloStore((s) => s.forgeSource);
  const forgeTitle = useHoloStore((s) => s.forgeTitle);
  const forgeRarity = useHoloStore((s) => s.forgeRarity);
  const forgeFoil = useHoloStore((s) => s.forgeFoil);
  const forgeArtId = useHoloStore((s) => s.forgeArtId);
  const forgeStickers = useHoloStore((s) => s.forgeStickers);
  const activeMintedId = useHoloStore((s) => s.activeMintedId);

  const tracks = useHoloStore((s) => s.tracks);
  const bpm = useHoloStore((s) => s.bpm);
  const swing = useHoloStore((s) => s.swing);
  const scale = useHoloStore((s) => s.scale);
  const isPlayingBeat = useHoloStore((s) => s.isPlaying);
  const pinballEvents = useHoloStore((s) => s.pinballRecordedEvents);
  const collection = useHoloStore((s) => s.collection);
  const mintedCards = useHoloStore((s) => s.mintedCards);

  const setForgeSource = useHoloStore((s) => s.setForgeSource);
  const setForgeTitle = useHoloStore((s) => s.setForgeTitle);
  const setForgeRarity = useHoloStore((s) => s.setForgeRarity);
  const setForgeFoil = useHoloStore((s) => s.setForgeFoil);
  const setForgeArtId = useHoloStore((s) => s.setForgeArtId);
  const addForgeSticker = useHoloStore((s) => s.addForgeSticker);
  const updateForgeSticker = useHoloStore((s) => s.updateForgeSticker);
  const removeForgeSticker = useHoloStore((s) => s.removeForgeSticker);
  const mintCurrentCard = useHoloStore((s) => s.mintCurrentCard);
  const loadMintedCardIntoForge = useHoloStore((s) => s.loadMintedCardIntoForge);
  const loadGachaCardIntoForge = useHoloStore((s) => s.loadGachaCardIntoForge);
  const deleteMintedCard = useHoloStore((s) => s.deleteMintedCard);
  const pushToast = useHoloStore((s) => s.pushToast);

  const playSfx = useHoloSfx();
  const [binderFilter, setBinderFilter] = useState<'ALL' | 'GACHA' | 'MINTED'>('ALL');
  const [playingPinball, setPlayingPinball] = useState(false);
  const [exportingPng, setExportingPng] = useState(false);
  const [exportingWav, setExportingWav] = useState(false);
  const [mintCeremonyKey, setMintCeremonyKey] = useState(0);
  const [minting, setMinting] = useState(false);

  const activeMinted = useMemo(
    () => mintedCards.find((m) => m.id === activeMintedId) ?? null,
    [mintedCards, activeMintedId]
  );

  const waveformBars = useMemo(() => {
    if (activeMinted) return activeMinted.waveformBars;
    return computeWaveformFingerprint(forgeSource, tracks, pinballEvents);
  }, [activeMinted, forgeSource, tracks, pinballEvents]);

  const displayCode = activeMinted
    ? activeMinted.code
    : `#MY-${String(mintedCards.length + 1).padStart(2, '0')}`;

  const isPreviewPlaying = forgeSource === 'beat' ? isPlayingBeat : playingPinball;
  const foilMeta = HOLO_FOIL_LIST.find((f) => f.id === forgeFoil) ?? HOLO_FOIL_LIST[0];

  const artOptions = useMemo(() => {
    const unlockedArts = collection.map((id) => getCardById(id).artId);
    return ['neon-dj', ...unlockedArts];
  }, [collection]);

  const handleTogglePlay = async () => {
    if (forgeSource === 'beat') {
      holoAudio.stopPinballRecording();
      setPlayingPinball(false);
      await holoAudio.togglePlay();
    } else {
      if (playingPinball) {
        holoAudio.stopPinballRecording();
        setPlayingPinball(false);
      } else {
        holoAudio.stopTransport();
        const eventsToPlay = activeMinted?.pinballEvents ?? pinballEvents;
        setPlayingPinball(true);
        await holoAudio.playPinballRecording(eventsToPlay, undefined, () => {
          setPlayingPinball(false);
        });
      }
    }
  };

  const handleMint = () => {
    playSfx('foilPress');
    setMinting(true);
    setMintCeremonyKey((k) => k + 1);
    window.setTimeout(() => {
      fireHoloConfetti('high');
      mintCurrentCard();
    }, 280);
    window.setTimeout(() => {
      setMinting(false);
    }, 1050);
  };

  const handleClearStickers = () => {
    if (forgeStickers.length === 0) return;
    playSfx('click', 0.25);
    forgeStickers.forEach((st) => removeForgeSticker(st.uid));
  };

  const handleExportPng = async () => {
    if (exportingPng) return;
    setExportingPng(true);
    playSfx('click', 0.85);
    try {
      const blob = await renderHoloCardToPngBlob({
        title: forgeTitle.trim() || 'HOLO MIX',
        code: displayCode,
        rarity: forgeRarity,
        foil: forgeFoil,
        artId: forgeArtId,
        stickers: forgeStickers,
        waveformBars,
        sourceType: forgeSource,
        bpm,
        scaleLabel: SCALE_META[scale].label,
      });
      const safeName = (forgeTitle.trim() || 'holobeat-card')
        .toLowerCase()
        .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-');
      triggerBlobDownload(blob, `${safeName}-gallery-poster.png`);
      fireHoloConfetti('normal');
      pushToast({
        text: `✦ 已导出展板级 3× 超清藏品海报 PNG (1200×1600)！`,
        accent: '#00D4AA',
      });
    } catch {
      pushToast({ text: 'PNG 导出遇到问题，请重试', accent: '#FF5526' });
    } finally {
      setExportingPng(false);
    }
  };

  const handleExportWav = async () => {
    if (exportingWav) return;
    setExportingWav(true);
    playSfx('click', 0.85);
    try {
      const safeName = (forgeTitle.trim() || 'holobeat-audio')
        .toLowerCase()
        .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-');
      let blob: Blob;
      if (forgeSource === 'beat') {
        const snap = activeMinted?.beatSnapshot ?? { bpm, swing, scale, tracks };
        blob = await renderBeatMixToWav(snap, 2);
      } else {
        const evs = activeMinted?.pinballEvents ?? pinballEvents;
        blob = await renderPinballToWav(evs, scale);
      }
      triggerBlobDownload(blob, `${safeName}.wav`);
      pushToast({
        text: `♪ 已离线渲染并导出 16-bit PCM 音频 WAV！`,
        accent: '#7C3AED',
      });
    } catch {
      pushToast({ text: 'WAV 离屏渲染遇到问题，请重试', accent: '#FF5526' });
    } finally {
      setExportingWav(false);
    }
  };

  const binderItems = useMemo(() => {
    const mintedEntries = mintedCards.map((m) => ({
      kind: 'minted' as const,
      id: m.id,
      title: m.title,
      shortTitle: m.title,
      rarity: m.rarity,
      artId: m.artId,
      foil: m.foil,
      code: m.code,
      rawMinted: m,
    }));
    const gachaEntries = SOUND_CARDS.filter((c) => collection.includes(c.id)).map((c) => ({
      kind: 'gacha' as const,
      id: c.id,
      title: c.title,
      shortTitle: c.shortTitle,
      rarity: c.rarity,
      artId: c.artId,
      foil: c.foil,
      code: c.code,
      rawCard: c,
    }));

    if (binderFilter === 'MINTED') return mintedEntries;
    if (binderFilter === 'GACHA') return gachaEntries;
    return [...mintedEntries, ...gachaEntries];
  }, [binderFilter, mintedCards, collection]);

  return (
    <div className="w-full h-full p-3.5 grid grid-cols-[minmax(300px,31.5%)_1fr_minmax(285px,29.5%)] gap-4 overflow-hidden">
      {/* ================= LEFT COLUMN: CUSTOMIZATION CONSOLE ================= */}
      <section className="flex flex-col gap-2.5 min-h-0 overflow-y-auto holo-scroll pr-0.5">
        {/* Block 1: AUDIO SOURCE */}
        <div className="brutal-panel-sm p-3 shrink-0">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-[12.5px] font-black tracking-wide uppercase text-[#17171C]">
              AUDIO SOURCE
            </h2>
            <span className="hw-silkscreen !text-[8px]">UNIT 04 // FOIL PRESS</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                playSfx('click', 0.7);
                setForgeSource('beat');
              }}
              className={`brutal-btn px-3 py-1.5 rounded-xl text-xs font-black tracking-wide whitespace-nowrap ${
                forgeSource === 'beat'
                  ? 'bg-[#FF5526] text-[#17171C]'
                  : 'bg-[#FBF9F4] text-[#17171C]'
              }`}
            >
              BEAT MIX
            </button>
            <button
              onClick={() => {
                playSfx('click', 0.7);
                setForgeSource('pinball');
              }}
              className={`brutal-btn px-3 py-1.5 rounded-xl text-xs font-black tracking-wide whitespace-nowrap ${
                forgeSource === 'pinball'
                  ? 'bg-[#00D4AA] text-[#17171C]'
                  : 'bg-[#FBF9F4] text-[#17171C]'
              }`}
            >
              PINBALL
            </button>

            <div className="flex-1 h-[34px] rounded-xl bg-[#14151B] border-[2px] border-[#17171C] px-2 py-1.5 flex items-center justify-between gap-[2px] overflow-hidden">
              {waveformBars.slice(0, 16).map((v, i) => {
                const colors = ['#7C3AED', '#FF3D9A', '#00D4AA', '#FFD426', '#FF5526'];
                return (
                  <span
                    key={i}
                    className={`flex-1 rounded-full ${isPreviewPlaying ? 'animate-pulse' : ''}`}
                    style={{
                      height: `${Math.round(v * 100)}%`,
                      backgroundColor: colors[i % colors.length],
                    }}
                  />
                );
              })}
            </div>
          </div>
        </div>

        {/* Block 2: CARD TITLE & RARITY TAGS */}
        <div className="brutal-panel-sm p-3 shrink-0">
          <div className="flex items-center justify-between mb-1.5">
            <h2 className="text-[12.5px] font-black tracking-wide uppercase text-[#17171C]">
              CARD TITLE
            </h2>
            <button
              onClick={() => {
                playSfx('click', 0.8);
                const next = artOptions[(artOptions.indexOf(forgeArtId) + 1) % artOptions.length];
                setForgeArtId(next);
              }}
              title="切换卡面主视觉潮玩角色"
              className="text-[10px] font-black px-2 py-0.5 rounded-full bg-[#E7E1D3] border-[1.5px] border-[#17171C] hover:bg-[#FFD426] cursor-pointer flex items-center gap-1 transition-colors"
            >
              <Sparkles className="w-3 h-3" /> 换主角插画
            </button>
          </div>
          <input
            type="text"
            value={forgeTitle}
            onChange={(e) => setForgeTitle(e.target.value)}
            maxLength={18}
            placeholder="NEON NIGHT"
            className="w-full px-3 py-1.5 rounded-xl bg-[#FBF9F4] border-[2.5px] border-[#17171C] text-[15px] font-black tracking-wide uppercase text-[#17171C] focus:outline-none focus:ring-2 focus:ring-[#7C3AED]"
          />

          <div className="grid grid-cols-3 gap-2 mt-2">
            {(['SSR', 'UR', 'LTD'] as ForgeRarity[]).map((rar) => {
              const active = forgeRarity === rar;
              return (
                <button
                  key={rar}
                  onClick={() => {
                    playSfx('click', 0.78);
                    setForgeRarity(rar);
                  }}
                  className={`brutal-pad py-1.5 rounded-xl text-xs font-black tracking-wider ${
                    active
                      ? rar === 'UR'
                        ? 'bg-[#FF3D9A] text-white ring-2 ring-[#FFD426]'
                        : rar === 'SSR'
                          ? 'bg-[#FFD426] text-[#17171C]'
                          : 'bg-[#14151B] text-[#FFD426] ring-1 ring-[#FFD426]'
                      : 'bg-[#FBF9F4] text-[#17171C]'
                  }`}
                >
                  {rar === 'UR' ? '✦ UR ✦' : rar === 'LTD' ? '◆ LTD' : '★ SSR'}
                </button>
              );
            })}
          </div>
        </div>

        {/* Block 3: HOLO FOIL (5) Material Swatches */}
        <div className="brutal-panel-sm p-3 shrink-0">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-[12.5px] font-black tracking-wide uppercase text-[#17171C]">
              HOLO FOIL (5)
            </h2>
            <span className="font-mono-hw text-[10px] font-bold text-[#626272]">
              {foilMeta.zhLabel}
            </span>
          </div>
          <div className="grid grid-cols-5 gap-1.5">
            {HOLO_FOIL_LIST.map((f) => {
              const active = forgeFoil === f.id;
              return (
                <button
                  key={f.id}
                  onClick={() => {
                    playSfx('click', 0.85);
                    setForgeFoil(f.id);
                  }}
                  title={f.zhLabel}
                  className={`flex flex-col items-center gap-1 p-1 rounded-xl border-[2px] transition-all cursor-pointer ${
                    active
                      ? 'bg-[#FFD426] border-[#17171C] shadow-[2px_2px_0px_0px_#17171C] -translate-y-0.5'
                      : 'bg-transparent border-transparent hover:bg-[#E7E1D3]'
                  }`}
                >
                  <span
                    className="w-full aspect-square rounded-lg border-[2px] border-[#17171C] block shadow-[inset_0_0_8px_rgba(255,255,255,0.45)]"
                    style={{ background: f.swatchStyle }}
                  />
                  <span className="font-mono-hw text-[9px] font-black text-[#17171C] leading-none">
                    {f.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Block 4: STICKER PACK (Crisp Square-ish Proportions — Zero Vertical Stretching!) */}
        <div className="brutal-panel-sm p-3 flex flex-col gap-2 shrink-0">
          <div className="flex items-center justify-between">
            <h2 className="text-[12.5px] font-black tracking-wide uppercase text-[#17171C]">
              STICKER PACK
            </h2>
            {forgeStickers.length > 0 ? (
              <button
                onClick={handleClearStickers}
                className="text-[10px] font-black px-2 py-0.5 rounded-full bg-[#FBF9F4] border-[1.5px] border-[#17171C] hover:bg-[#FF5526] hover:text-white flex items-center gap-1 cursor-pointer transition-colors"
                title="一键清空卡面上所有贴纸"
              >
                <Eraser className="w-3 h-3" /> 清空 ({forgeStickers.length})
              </button>
            ) : (
              <span className="text-[10px] font-bold text-[#626272]">点击贴上 · 可拖拽缩放</span>
            )}
          </div>

          <div className="grid grid-cols-4 gap-2">
            {STICKER_PACK.map((stk) => (
              <button
                key={stk.id}
                onClick={() => {
                  playSfx('cartridgeLock');
                  addForgeSticker(stk.id);
                }}
                title={`添加「${stk.zhLabel}」贴纸到闪卡`}
                className="brutal-pad h-[54px] rounded-xl bg-[#FBF9F4] hover:bg-[#FEF9C3] p-1.5 flex items-center justify-center group"
              >
                <svg
                  viewBox="0 0 64 64"
                  className="w-9 h-9 group-hover:scale-110 transition-transform duration-150"
                  dangerouslySetInnerHTML={{ __html: stk.svgInner }}
                />
              </button>
            ))}
          </div>

          <p className="text-[10px] font-bold text-[#626272] text-center leading-tight">
            卡面贴纸支持拖拽位移 · 点击调大小旋转 · 双击快速移除
          </p>
        </div>
      </section>

      {/* ================= CENTER COLUMN: HOLO CARD FORGE PRESS ================= */}
      <section className="flex flex-col gap-2.5 min-h-0">
        {/* Deep Charcoal Forge Vault with Subtle Golden Blueprint Grid & Laser Lamination */}
        <div
          className={`brutal-oled relative flex-1 flex flex-col items-center justify-between p-4 overflow-hidden min-h-0 transition-shadow duration-300 ${
            minting ? 'ring-4 ring-[#FFD426]' : ''
          }`}
          style={{
            backgroundImage:
              'radial-gradient(circle at 50% 48%, rgba(255, 212, 38, 0.08) 0%, transparent 62%), linear-gradient(to right, rgba(255,212,38,0.07) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,212,38,0.07) 1px, transparent 1px)',
            backgroundSize: '100% 100%, 26px 26px, 26px 26px',
          }}
        >
          {/* Top Forge Coordinate Strip */}
          <div className="w-full flex items-center justify-between text-white/55 font-mono-hw text-[10px] tracking-[0.14em] shrink-0 z-10">
            <span>+ PRESS // {displayCode}</span>
            <span className="text-[#FFD426] font-bold">
              {forgeRarity} · {foilMeta.label} FOIL +
            </span>
          </div>

          {/* Center Oversized Live Custom 3D Holographic Card */}
          <div className="flex-1 flex items-center justify-center relative z-10 py-1">
            <HoloCard
              title={forgeTitle.trim() || 'NEON NIGHT'}
              code={displayCode}
              rarity={forgeRarity}
              specLabel={forgeSource === 'beat' ? 'BEAT MIX' : 'PINBALL'}
              foil={forgeFoil}
              artId={forgeArtId}
              waveformBars={waveformBars}
              waveformActive={isPreviewPlaying}
              stickers={forgeStickers}
              editableStickers
              onUpdateSticker={updateForgeSticker}
              onRemoveSticker={removeForgeSticker}
              showAura
              idleShimmer
              width={310}
              height={434}
            />

            {/* Ceremonial Laser Lamination Scan Bar + Steel Collector Stamp Overlay */}
            {minting && (
              <div
                key={mintCeremonyKey}
                className="absolute inset-0 z-40 pointer-events-none flex items-center justify-center overflow-hidden rounded-2xl"
              >
                <div className="absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-transparent via-[#00D4AA]/75 to-transparent shadow-[0_0_28px_#00D4AA] animate-forge-laser" />
                <div className="px-5 py-2.5 rounded-2xl bg-[#14151B]/95 border-[3px] border-[#FFD426] shadow-[0_0_30px_rgba(255,212,38,0.75)] animate-forge-stamp">
                  <div className="font-black italic text-xl tracking-wider text-[#FFD426] whitespace-nowrap">
                    ★ MINTED · 封印完成 ★
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Bottom Technical Alignment Strip */}
          <div className="w-full flex items-center justify-between text-white/45 font-mono-hw text-[9.5px] tracking-[0.14em] shrink-0 z-10">
            <span>+ 3X ARCHIVE POSTER READY</span>
            <span>1200×1600 HD +</span>
          </div>
        </div>

        {/* Bottom Primary CTA + Export Row */}
        <div className="flex flex-col gap-2 shrink-0">
          <button
            onClick={handleMint}
            className="brutal-btn-lg w-full py-2.5 rounded-2xl bg-[#FF5526] text-[#17171C] text-[19px] font-black tracking-wide uppercase flex items-center justify-center gap-2"
          >
            <Stamp className="w-5 h-5" strokeWidth={2.8} />
            <span>MINT TO BINDER · 压印封印</span>
          </button>

          <div className="grid grid-cols-3 gap-2">
            <button
              onClick={() => void handleExportPng()}
              disabled={exportingPng}
              className="brutal-btn py-2 px-2 rounded-xl bg-[#00D4AA] text-[#17171C] text-[12.5px] font-black tracking-wide uppercase flex items-center justify-center gap-1 disabled:opacity-60"
            >
              <Download className="w-3.5 h-3.5" strokeWidth={3} />
              <span>{exportingPng ? 'EXPORTING...' : 'EXPORT PNG'}</span>
            </button>

            <button
              onClick={() => void handleExportWav()}
              disabled={exportingWav}
              className="brutal-btn py-2 px-2 rounded-xl bg-[#7C3AED] text-white text-[12.5px] font-black tracking-wide uppercase flex items-center justify-center gap-1 disabled:opacity-60"
            >
              <Music className="w-3.5 h-3.5" strokeWidth={3} />
              <span>{exportingWav ? 'RENDERING...' : 'EXPORT WAV'}</span>
            </button>

            <button
              onClick={() => void handleTogglePlay()}
              className={`brutal-btn py-2 px-2 rounded-xl text-[12.5px] font-black tracking-wide uppercase flex items-center justify-center gap-1 ${
                isPreviewPlaying ? 'bg-[#FFD426] text-[#17171C]' : 'bg-[#FBF9F4] text-[#17171C]'
              }`}
            >
              {isPreviewPlaying ? (
                <>
                  <Pause className="w-3.5 h-3.5 fill-current" /> STOP
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 fill-current" /> PLAY
                </>
              )}
            </button>
          </div>
        </div>
      </section>

      {/* ================= RIGHT COLUMN: COLLECTOR BINDER SLEEVE ================= */}
      <section className="brutal-panel p-3.5 flex flex-col gap-2.5 min-h-0 overflow-hidden">
        <div className="shrink-0">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-[17px] font-black tracking-wide uppercase text-[#17171C] leading-none">
              MY BINDER
            </h2>
            <span className="font-mono-hw text-xs font-bold text-[#626272]">
              {binderItems.length} CARDS
            </span>
          </div>

          <div className="grid grid-cols-3 gap-1.5">
            {(['ALL', 'GACHA', 'MINTED'] as const).map((tab) => {
              const active = binderFilter === tab;
              return (
                <button
                  key={tab}
                  onClick={() => {
                    playSfx('click', 0.6);
                    setBinderFilter(tab);
                  }}
                  className={`brutal-pad py-1 rounded-xl text-xs font-black tracking-wider ${
                    active ? 'bg-[#FFD426] text-[#17171C]' : 'bg-[#FBF9F4] text-[#17171C]'
                  }`}
                >
                  {tab}
                </button>
              );
            })}
          </div>
        </div>

        {/* Translucent Plastic Collectible Binder Sleeve Page */}
        <div className="flex-1 rounded-2xl bg-[#E7E1D3] border-[2.5px] border-[#17171C] p-2.5 overflow-y-auto holo-scroll shadow-[inset_0_2px_6px_rgba(0,0,0,0.12)]">
          <div className="grid grid-cols-2 gap-2.5">
            {binderItems.map((item) => {
              const rar = RARITY_META[item.rarity];
              const isSelected =
                (item.kind === 'minted' && activeMintedId === item.id) ||
                (item.kind === 'gacha' && activeMintedId === null && forgeArtId === item.artId);

              const thumbFrame =
                item.rarity === 'UR'
                  ? 'holo-shine-border'
                  : item.rarity === 'LTD'
                    ? 'bg-gradient-to-br from-[#17171C] via-[#FFD426] to-[#17171C]'
                    : item.rarity === 'SSR'
                      ? 'bg-gradient-to-br from-[#FEF08A] via-[#FF5526] to-[#FF3D9A]'
                      : item.rarity === 'SR'
                        ? 'bg-gradient-to-br from-[#7C3AED] via-[#38BDF8] to-[#00D4AA]'
                        : item.rarity === 'R'
                          ? 'bg-gradient-to-br from-[#F1F5F9] via-[#94A3B8] to-[#CBD5E1]'
                          : 'bg-[#DFD6C3]';

              return (
                <div
                  key={`${item.kind}-${item.id}`}
                  onClick={() => {
                    playSfx('click', 0.8);
                    if (item.kind === 'minted') {
                      loadMintedCardIntoForge(item.id);
                    } else {
                      loadGachaCardIntoForge(item.id);
                      void holoAudio.previewCard(item.id);
                    }
                  }}
                  className={`group relative rounded-xl p-1.5 bg-white/55 border-[2px] border-white/85 shadow-[inset_0_0_0_1px_rgba(23,23,28,0.14)] cursor-pointer transition-transform hover:-translate-y-0.5 ${
                    isSelected ? 'ring-[2.5px] ring-[#FF5526]' : ''
                  }`}
                >
                  <div
                    className={`relative aspect-[5/6.2] rounded-[10px] p-[2.5px] border-[2px] border-[#17171C] holo-thumb-sheen overflow-hidden shadow-[2px_2px_0px_0px_#17171C] ${thumbFrame}`}
                  >
                    <div className="relative w-full h-full rounded-[7px] overflow-hidden border border-[#17171C] bg-[#14151B] flex flex-col">
                      <div className="relative flex-1 overflow-hidden">
                        <CardArtwork artId={item.artId} />
                        <span
                          className="absolute top-1 left-1 px-1.5 py-[0.5px] rounded text-[8.5px] font-black border border-[#17171C] -rotate-3"
                          style={{ backgroundColor: rar.bg, color: rar.text }}
                        >
                          {rar.label}
                        </span>
                        {item.kind === 'minted' && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              playSfx('click', 0.25);
                              deleteMintedCard(item.id);
                            }}
                            title="删除此自铸闪卡"
                            className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 p-1 rounded-md bg-[#14151B]/90 text-[#FF5526] hover:bg-[#FF5526] hover:text-white transition-opacity cursor-pointer"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                      <div
                        className={`border-t-[1.5px] border-[#17171C] py-0.5 px-1 text-center ${
                          item.rarity === 'LTD'
                            ? 'bg-[#14151B] text-[#FEF08A]'
                            : 'bg-[#FBF9F4] text-[#17171C]'
                        }`}
                      >
                        <span className="block text-[9.5px] font-black italic tracking-tight truncate uppercase">
                          {item.shortTitle}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>
    </div>
  );
};
