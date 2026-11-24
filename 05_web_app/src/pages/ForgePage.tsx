import React, { useMemo, useState } from 'react';
import { Download, Music, Pause, Play, Sparkles, Trash2 } from 'lucide-react';
import { holoAudio } from '../audio/HoloAudioEngine';
import { useHoloSfx } from '../audio/useHoloSfx';
import {
  renderBeatMixToWav,
  renderPinballToWav,
  triggerBlobDownload,
} from '../audio/wavExporter';
import { CardArtwork } from '../components/artwork/CardArtwork';
import { HoloCard } from '../components/holo/HoloCard';
import { HOLO_FOIL_LIST, RARITY_META, SOUND_CARDS, getCardById } from '../data/soundCards';
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
  const [mintFlash, setMintFlash] = useState(false);

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

  // Cycle hero artwork among NEON DJ + unlocked cards
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
    playSfx('mintStamp');
    fireHoloConfetti('high');
    setMintFlash(true);
    window.setTimeout(() => setMintFlash(false), 450);
    mintCurrentCard();
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
      });
      const safeName = (forgeTitle.trim() || 'holobeat-card')
        .toLowerCase()
        .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-');
      triggerBlobDownload(blob, `${safeName}-holo-3x.png`);
      fireHoloConfetti('normal');
      pushToast({
        text: `已导出 3× 超清全息闪卡 PNG (960×1344)！`,
        accent: '#00D4AA',
      });
    } catch {
      pushToast({ text: 'PNG 导出遇到问题，请重试', accent: '#FF5C2B' });
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
        text: `已离线渲染并导出 16-bit PCM 音频 WAV！`,
        accent: '#7C3AED',
      });
    } catch {
      pushToast({ text: 'WAV 离屏渲染遇到问题，请重试', accent: '#FF5C2B' });
    } finally {
      setExportingWav(false);
    }
  };

  // Build Binder Cards list according to ALL / GACHA / MINTED tabs
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
    return [...gachaEntries, ...mintedEntries];
  }, [binderFilter, mintedCards, collection]);

  return (
    <div className="w-full h-full p-3.5 grid grid-cols-[minmax(300px,31.5%)_1fr_minmax(285px,30%)] gap-4 overflow-hidden">
      {/* ================= LEFT COLUMN: CUSTOMIZATION CONSOLE ================= */}
      <section className="flex flex-col gap-2.5 min-h-0 overflow-y-auto holo-scroll pr-0.5">
        {/* Block 1: AUDIO SOURCE */}
        <div className="brutal-panel-sm p-3 shrink-0">
          <h2 className="text-[13px] font-black tracking-wide uppercase text-[#1A1A1F] mb-2">
            AUDIO SOURCE
          </h2>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                playSfx('click', 0.7);
                setForgeSource('beat');
              }}
              className={`brutal-btn px-3 py-2 rounded-xl text-xs font-black tracking-wide whitespace-nowrap ${
                forgeSource === 'beat'
                  ? 'bg-[#FF5C2B] text-[#1A1A1F]'
                  : 'bg-[#FFFDF8] text-[#1A1A1F]'
              }`}
            >
              BEAT MIX
            </button>
            <button
              onClick={() => {
                playSfx('click', 0.7);
                setForgeSource('pinball');
              }}
              className={`brutal-btn px-3 py-2 rounded-xl text-xs font-black tracking-wide whitespace-nowrap ${
                forgeSource === 'pinball'
                  ? 'bg-[#00D4AA] text-[#1A1A1F]'
                  : 'bg-[#FFFDF8] text-[#1A1A1F]'
              }`}
            >
              PINBALL
            </button>

            {/* Tiny Dark OLED Audio Fingerprint Strip */}
            <div className="flex-1 h-[36px] rounded-xl bg-[#181820] border-[2px] border-[#1A1A1F] px-2 py-1.5 flex items-center justify-between gap-[2px] overflow-hidden">
              {waveformBars.slice(0, 16).map((v, i) => {
                const colors = ['#7C3AED', '#FF3D9A', '#00D4AA', '#FFD60A', '#FF5C2B'];
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
            <h2 className="text-[13px] font-black tracking-wide uppercase text-[#1A1A1F]">
              CARD TITLE
            </h2>
            <button
              onClick={() => {
                playSfx('click', 0.8);
                const next = artOptions[(artOptions.indexOf(forgeArtId) + 1) % artOptions.length];
                setForgeArtId(next);
              }}
              title="切换卡面主视觉潮玩角色"
              className="text-[10px] font-black px-2 py-0.5 rounded-full bg-[#EDE7D9] border-[1.5px] border-[#1A1A1F] hover:bg-[#FFD60A] cursor-pointer flex items-center gap-1"
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
            className="w-full px-3 py-2 rounded-xl bg-[#FFFDF8] border-[2.5px] border-[#1A1A1F] text-[15px] font-black tracking-wide uppercase text-[#1A1A1F] focus:outline-none focus:ring-2 focus:ring-[#7C3AED]"
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
                        ? 'bg-[#FF3D9A] text-white ring-2 ring-[#FFD60A]'
                        : rar === 'SSR'
                          ? 'bg-[#FFD60A] text-[#1A1A1F]'
                          : 'bg-[#181820] text-[#FFD60A]'
                      : 'bg-[#FFFDF8] text-[#1A1A1F]'
                  }`}
                >
                  {rar === 'UR' ? '✦ UR ✦' : rar}
                </button>
              );
            })}
          </div>
        </div>

        {/* Block 3: HOLO FOIL (5) Material Swatches */}
        <div className="brutal-panel-sm p-3 shrink-0">
          <h2 className="text-[13px] font-black tracking-wide uppercase text-[#1A1A1F] mb-2">
            HOLO FOIL (5)
          </h2>
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
                      ? 'bg-[#FFD60A] border-[#1A1A1F] shadow-[2px_2px_0px_0px_#1A1A1F] -translate-y-0.5'
                      : 'bg-transparent border-transparent hover:bg-[#EDE7D9]'
                  }`}
                >
                  <span
                    className="w-full aspect-square rounded-lg border-[2px] border-[#1A1A1F] block shadow-[inset_0_0_8px_rgba(255,255,255,0.45)]"
                    style={{ background: f.swatchStyle }}
                  />
                  <span className="font-mono-hw text-[9px] font-black text-[#1A1A1F] leading-none">
                    {f.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Block 4: STICKER PACK 4x2 Grid */}
        <div className="brutal-panel-sm p-3 flex-1 flex flex-col min-h-[135px]">
          <div className="flex items-center justify-between mb-1.5">
            <h2 className="text-[13px] font-black tracking-wide uppercase text-[#1A1A1F]">
              STICKER PACK
            </h2>
            <span className="text-[10px] font-bold text-[#5C5C6B]">
              点击贴上 · 卡面可拖拽/缩放
            </span>
          </div>
          <div className="grid grid-cols-4 grid-rows-2 gap-1.5 flex-1">
            {STICKER_PACK.map((stk) => (
              <button
                key={stk.id}
                onClick={() => {
                  playSfx('cartridgeLock');
                  addForgeSticker(stk.id);
                }}
                title={`添加「${stk.zhLabel}」贴纸到闪卡`}
                className="brutal-pad rounded-xl bg-[#FFFDF8] hover:bg-[#FEF9C3] p-1.5 flex items-center justify-center"
              >
                <svg
                  viewBox="0 0 64 64"
                  className="w-11 h-11"
                  dangerouslySetInnerHTML={{ __html: stk.svgInner }}
                />
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* ================= CENTER COLUMN: HOLO CARD FORGE STAGE ================= */}
      <section className="flex flex-col gap-2.5 min-h-0">
        {/* Dark Charcoal Forge Vault with Subtle Golden Blueprint Grid */}
        <div
          className={`brutal-oled relative flex-1 flex items-center justify-center p-4 overflow-hidden min-h-0 ${
            mintFlash ? 'ring-4 ring-[#FFD60A]' : ''
          }`}
          style={{
            backgroundImage:
              'linear-gradient(to right, rgba(255,214,10,0.09) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,214,10,0.09) 1px, transparent 1px)',
            backgroundSize: '28px 28px',
          }}
        >
          {/* Technical Alignment Corner Crosshairs (+) */}
          <span className="absolute top-3 left-3.5 text-white/50 font-mono-hw text-lg leading-none pointer-events-none">
            +
          </span>
          <span className="absolute top-3 right-3.5 text-white/50 font-mono-hw text-lg leading-none pointer-events-none">
            +
          </span>
          <span className="absolute bottom-3 left-3.5 text-white/50 font-mono-hw text-lg leading-none pointer-events-none">
            +
          </span>
          <span className="absolute bottom-3 right-3.5 text-white/50 font-mono-hw text-lg leading-none pointer-events-none">
            +
          </span>

          {/* Oversized Live Custom 3D Holographic Card */}
          <HoloCard
            title={forgeTitle.trim() || 'NEON NIGHT'}
            code={displayCode}
            rarity={forgeRarity}
            foil={forgeFoil}
            artId={forgeArtId}
            waveformBars={waveformBars}
            waveformActive={isPreviewPlaying}
            stickers={forgeStickers}
            editableStickers
            onUpdateSticker={updateForgeSticker}
            onRemoveSticker={removeForgeSticker}
            width={316}
            height={442}
          />
        </div>

        {/* Bottom Primary CTA + Secondary Export Row */}
        <div className="flex flex-col gap-2 shrink-0">
          <button
            onClick={handleMint}
            className="brutal-btn-lg w-full py-3 rounded-2xl bg-[#FF5C2B] text-[#1A1A1F] text-[20px] font-black tracking-wide uppercase"
          >
            MINT TO BINDER
          </button>

          <div className="grid grid-cols-3 gap-2">
            <button
              onClick={() => void handleExportPng()}
              disabled={exportingPng}
              className="brutal-btn py-2.5 px-2 rounded-xl bg-[#00D4AA] text-[#1A1A1F] text-[13px] font-black tracking-wide uppercase flex items-center justify-center gap-1 disabled:opacity-60"
            >
              <Download className="w-3.5 h-3.5" strokeWidth={3} />
              <span>{exportingPng ? 'EXPORTING...' : 'EXPORT PNG'}</span>
            </button>

            <button
              onClick={() => void handleExportWav()}
              disabled={exportingWav}
              className="brutal-btn py-2.5 px-2 rounded-xl bg-[#7C3AED] text-white text-[13px] font-black tracking-wide uppercase flex items-center justify-center gap-1 disabled:opacity-60"
            >
              <Music className="w-3.5 h-3.5" strokeWidth={3} />
              <span>{exportingWav ? 'RENDERING...' : 'EXPORT WAV'}</span>
            </button>

            <button
              onClick={() => void handleTogglePlay()}
              className={`brutal-btn py-2.5 px-2 rounded-xl text-[13px] font-black tracking-wide uppercase flex items-center justify-center gap-1 ${
                isPreviewPlaying ? 'bg-[#FFD60A] text-[#1A1A1F]' : 'bg-[#FFFDF8] text-[#1A1A1F]'
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

      {/* ================= RIGHT COLUMN: MY BINDER ================= */}
      <section className="brutal-panel p-3.5 flex flex-col gap-2.5 min-h-0 overflow-hidden">
        <div className="shrink-0">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-[18px] font-black tracking-wide uppercase text-[#1A1A1F] leading-none">
              MY BINDER
            </h2>
            <span className="font-mono-hw text-xs font-bold text-[#5C5C6B]">
              {binderItems.length} CARDS
            </span>
          </div>

          {/* Filter Pills: ALL / GACHA / MINTED */}
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
                    active ? 'bg-[#FFD60A] text-[#1A1A1F]' : 'bg-[#FFFDF8] text-[#1A1A1F]'
                  }`}
                >
                  {tab}
                </button>
              );
            })}
          </div>
        </div>

        {/* Translucent Plastic Collectible Binder Sleeve Page (2-Column Grid) */}
        <div className="flex-1 rounded-2xl bg-[#EDE7D9] border-[2.5px] border-[#1A1A1F] p-2.5 overflow-y-auto holo-scroll shadow-[inset_0_2px_6px_rgba(0,0,0,0.12)]">
          <div className="grid grid-cols-2 gap-2.5">
            {binderItems.map((item) => {
              const rar = RARITY_META[item.rarity];
              const isSelected =
                (item.kind === 'minted' && activeMintedId === item.id) ||
                (item.kind === 'gacha' && activeMintedId === null && forgeArtId === item.artId);

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
                  className={`group relative rounded-xl p-1.5 bg-white/55 border-[2px] border-white/80 shadow-[inset_0_0_0_1px_rgba(26,26,31,0.15)] cursor-pointer transition-transform hover:-translate-y-0.5 ${
                    isSelected ? 'ring-[2.5px] ring-[#FF5C2B]' : ''
                  }`}
                >
                  {/* Mini Holographic Card inside Translucent Sleeve */}
                  <div className="relative aspect-[5/6.2] rounded-[10px] p-[2.5px] border-[2px] border-[#1A1A1F] holo-thumb-sheen bg-gradient-to-br from-[#FF3D9A] via-[#FFD60A] to-[#00D4AA] overflow-hidden shadow-[2px_2px_0px_0px_#1A1A1F]">
                    <div className="relative w-full h-full rounded-[7px] overflow-hidden border border-[#1A1A1F] bg-[#181820] flex flex-col">
                      <div className="relative flex-1 overflow-hidden">
                        <CardArtwork artId={item.artId} />
                        <span
                          className="absolute top-1 left-1 px-1.5 py-[1px] rounded text-[9px] font-black border border-[#1A1A1F] -rotate-3"
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
                            className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 p-1 rounded-md bg-[#181820]/85 text-[#FF5C2B] hover:bg-[#FF5C2B] hover:text-white transition-opacity cursor-pointer"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                      <div className="bg-[#FFFDF8] border-t-[1.5px] border-[#1A1A1F] py-0.5 px-1 text-center">
                        <span className="block text-[10px] font-black italic tracking-tight text-[#1A1A1F] truncate uppercase">
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
