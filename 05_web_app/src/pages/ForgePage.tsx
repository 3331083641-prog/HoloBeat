import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  Download,
  Eraser,
  FileJson,
  Film,
  FolderOpen,
  GitBranch,
  Music,
  Pause,
  Play,
  Redo2,
  RotateCcw,
  Share2,
  Sparkles,
  Stamp,
  Trash2,
  Undo2,
  Unlock,
} from 'lucide-react';
import { holoAudio } from '../audio/HoloAudioEngine';
import { computeEventWaveformBars } from '../audio/compositionEngine';
import { useHoloSfx } from '../audio/useHoloSfx';
import {
  renderCompositionSnapshotCached,
  triggerBlobDownload,
} from '../audio/wavExporter';
import { CardArtwork } from '../components/artwork/CardArtwork';
import { HoloCard } from '../components/holo/HoloCard';
import { SoundSigil } from '../components/holo/SoundSigil';
import {
  HOLO_FOIL_LIST,
  RARITY_META,
  SCALE_META,
  SOUND_CARDS,
  getCardById,
} from '../data/soundCards';
import { STICKER_PACK } from '../data/stickers';
import { useHoloStore } from '../store/useHoloStore';
import type { ForgeRarity, HoloBeatProjectFile } from '../types/holo';
import { syncCardToBackend } from '../utils/backendClient';
import { fireHoloConfetti } from '../utils/confetti';
import { renderHoloCardToPngBlob } from '../utils/exportHoloPng';
import { recordMotionCardWebm } from '../utils/exportMotionCard';

const MINT_STAGES = [
  '01/07 锁定作品音频快照...',
  '02/07 离线渲染 16-bit PCM 声轨...',
  '03/07 提取真实声纹振幅图谱...',
  '04/07 演算专属几何声音纹章...',
  '05/07 高温压印全息折射箔层...',
  '06/07 永久写入本地档案馆...',
  '07/07 ★ MINTED · 封印完成 ★',
];

export const ForgePage: React.FC = () => {
  const forgeDraft = useHoloStore((s) => s.forgeDraft);
  const inspectMintedId = useHoloStore((s) => s.inspectMintedId);
  const mintedCards = useHoloStore((s) => s.mintedCards);
  const nextMintSerial = useHoloStore((s) => s.nextMintSerial);
  const mintInFlight = useHoloStore((s) => s.mintInFlight);
  const stickerUndoCount = useHoloStore((s) => s.stickerUndoStack.length);
  const stickerRedoCount = useHoloStore((s) => s.stickerRedoStack.length);
  const collection = useHoloStore((s) => s.collection);

  const setForgeSource = useHoloStore((s) => s.setForgeSource);
  const setForgeTitle = useHoloStore((s) => s.setForgeTitle);
  const setForgeRarity = useHoloStore((s) => s.setForgeRarity);
  const setForgeFoil = useHoloStore((s) => s.setForgeFoil);
  const setForgeArtId = useHoloStore((s) => s.setForgeArtId);
  const addForgeSticker = useHoloStore((s) => s.addForgeSticker);
  const updateForgeSticker = useHoloStore((s) => s.updateForgeSticker);
  const bringStickerToFront = useHoloStore((s) => s.bringStickerToFront);
  const removeForgeSticker = useHoloStore((s) => s.removeForgeSticker);
  const clearForgeStickers = useHoloStore((s) => s.clearForgeStickers);
  const undoForgeStickers = useHoloStore((s) => s.undoForgeStickers);
  const redoForgeStickers = useHoloStore((s) => s.redoForgeStickers);
  const inspectMintedCard = useHoloStore((s) => s.inspectMintedCard);
  const returnToForgeDraft = useHoloStore((s) => s.returnToForgeDraft);
  const loadGachaCardIntoForgeDraft = useHoloStore((s) => s.loadGachaCardIntoForgeDraft);
  const updateMintedCardWaveform = useHoloStore((s) => s.updateMintedCardWaveform);
  const mintCurrentCard = useHoloStore((s) => s.mintCurrentCard);
  const unsealAndRemixCard = useHoloStore((s) => s.unsealAndRemixCard);
  const deleteMintedCard = useHoloStore((s) => s.deleteMintedCard);
  const importProjectFile = useHoloStore((s) => s.importProjectFile);
  const pushToast = useHoloStore((s) => s.pushToast);

  const playSfx = useHoloSfx();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [binderFilter, setBinderFilter] = useState<'ALL' | 'GACHA' | 'MINTED'>('ALL');
  const [flippedCard, setFlippedCard] = useState(false);
  const [isPlayingSnapshot, setIsPlayingSnapshot] = useState(false);
  const [waveformProgress, setWaveformProgress] = useState(-1);

  const [realWaveformMap, setRealWaveformMap] = useState<Record<string, number[]>>({});
  const [exportingPng, setExportingPng] = useState(false);
  const [exportingWav, setExportingWav] = useState(false);
  const [exportingMotion, setExportingMotion] = useState(false);
  const [motionProgress, setMotionProgress] = useState(0);
  const [syncingShare, setSyncingShare] = useState(false);

  const [mintStageIdx, setMintStageIdx] = useState<number | null>(null);
  const [mintCeremonyKey, setMintCeremonyKey] = useState(0);

  // Responsive card dimensions for 1280x720 / 1366x768 vs 1440x900 / 1920x1080
  const [cardDims, setCardDims] = useState({ w: 298, h: 416 });
  useEffect(() => {
    const updateDims = () => {
      const vh = window.innerHeight;
      if (vh < 740) setCardDims({ w: 238, h: 332 });
      else if (vh < 820) setCardDims({ w: 266, h: 372 });
      else if (vh < 940) setCardDims({ w: 288, h: 402 });
      else setCardDims({ w: 310, h: 434 });
    };
    updateDims();
    window.addEventListener('resize', updateDims);
    return () => window.removeEventListener('resize', updateDims);
  }, []);

  const inspectedCard = useMemo(
    () => mintedCards.find((m) => m.id === inspectMintedId) ?? null,
    [mintedCards, inspectMintedId]
  );

  const isInspectMode = inspectedCard !== null;
  const activeSnapshot = inspectedCard ? inspectedCard.snapshot : forgeDraft.snapshot;
  const activeTitle = inspectedCard ? inspectedCard.title : forgeDraft.title;
  const activeRarity = inspectedCard ? inspectedCard.rarity : forgeDraft.rarity;
  const activeFoil = inspectedCard ? inspectedCard.foil : forgeDraft.foil;
  const activeArtId = inspectedCard ? inspectedCard.artId : forgeDraft.artId;
  const activeStickers = inspectedCard ? inspectedCard.stickers : forgeDraft.stickers;
  const activeSourceType = inspectedCard ? inspectedCard.sourceType : forgeDraft.sourceType;
  const displayCode = inspectedCard
    ? inspectedCard.code
    : `#MY-${String(nextMintSerial).padStart(2, '0')}`;

  const lineageLabel = useMemo(() => {
    if (inspectedCard) {
      if (inspectedCard.isDemo) return 'DEMO SAMPLE · 官方示范';
      if (inspectedCard.parentCode) {
        return `REMIX OF ${inspectedCard.parentCode} · GEN ${inspectedCard.lineageDepth}`;
      }
      return 'ORIGINAL ARCHIVE · 原创首版';
    }
    if (forgeDraft.remixOrigin) {
      return `REMIX OF ${forgeDraft.remixOrigin.parentCode} · GEN ${forgeDraft.remixOrigin.lineageDepth}`;
    }
    return undefined;
  }, [inspectedCard, forgeDraft.remixOrigin]);

  // Asynchronously compute & cache REAL 16-bit PCM waveform for the active snapshot!
  useEffect(() => {
    if (!activeSnapshot || activeSnapshot.events.length === 0) return;
    const snapId = activeSnapshot.id;
    if (realWaveformMap[snapId]) return;
    if (inspectedCard?.waveformIsRealPcm && inspectedCard.waveformBars.length > 0) {
      setRealWaveformMap((prev) => ({ ...prev, [snapId]: inspectedCard.waveformBars }));
      return;
    }

    let cancelled = false;
    void renderCompositionSnapshotCached(activeSnapshot)
      .then((res) => {
        if (cancelled) return;
        setRealWaveformMap((prev) => ({ ...prev, [snapId]: res.waveformBars }));
        if (inspectedCard && !inspectedCard.waveformIsRealPcm) {
          updateMintedCardWaveform(inspectedCard.id, res.waveformBars, true);
        }
      })
      .catch(() => {
        // Fallback smoothly to event envelope
      });

    return () => {
      cancelled = true;
    };
  }, [activeSnapshot, inspectedCard, realWaveformMap, updateMintedCardWaveform]);

  const waveformBars = useMemo(() => {
    if (activeSnapshot && realWaveformMap[activeSnapshot.id]) {
      return realWaveformMap[activeSnapshot.id];
    }
    if (inspectedCard && inspectedCard.waveformBars.length > 0) {
      return inspectedCard.waveformBars;
    }
    if (activeSnapshot) {
      return computeEventWaveformBars(activeSnapshot.events, activeSnapshot.durationMs);
    }
    return Array<number>(24).fill(0.35);
  }, [activeSnapshot, realWaveformMap, inspectedCard]);

  const isRealPcm = Boolean(
    (activeSnapshot && realWaveformMap[activeSnapshot.id]) || inspectedCard?.waveformIsRealPcm
  );

  // Stop audition when switching inspected card or unmounting
  useEffect(() => {
    holoAudio.stopSnapshotPlayback();
    setIsPlayingSnapshot(false);
    setWaveformProgress(-1);
    return () => {
      holoAudio.stopSnapshotPlayback();
    };
  }, [inspectMintedId, activeSnapshot?.id]);

  // Live waveform playhead sweep loop during snapshot audition
  useEffect(() => {
    if (!isPlayingSnapshot || !activeSnapshot) {
      setWaveformProgress(-1);
      return;
    }
    let raf = 0;
    const tick = () => {
      const ms = holoAudio.getSnapshotPlaybackMs();
      if (ms >= 0 && holoAudio.isSnapshotPlaying()) {
        setWaveformProgress(Math.min(1, ms / Math.max(800, activeSnapshot.durationMs)));
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [isPlayingSnapshot, activeSnapshot]);

  const foilMeta = HOLO_FOIL_LIST.find((f) => f.id === activeFoil) ?? HOLO_FOIL_LIST[0];

  const artOptions = useMemo(() => {
    const unlockedArts = collection.map((id) => getCardById(id).artId);
    return ['neon-dj', ...unlockedArts];
  }, [collection]);

  const handleTogglePlay = async () => {
    if (!activeSnapshot || activeSnapshot.events.length === 0) {
      pushToast({ text: '当前作品暂无可试听的音符事件', accent: '#FF5C2B' });
      return;
    }
    if (isPlayingSnapshot) {
      holoAudio.stopSnapshotPlayback();
      setIsPlayingSnapshot(false);
      setWaveformProgress(-1);
      return;
    }
    setIsPlayingSnapshot(true);
    await holoAudio.playCompositionSnapshot(activeSnapshot, {
      leadInMs: 50,
      loop: false,
      onComplete: () => {
        setIsPlayingSnapshot(false);
        setWaveformProgress(-1);
      },
    });
  };

  /**
   * 7-Stage Artisanal Minting Ceremony strictly gated by real PCM render + IndexedDB persistence!
   */
  const handleMint = async () => {
    if (mintInFlight || mintStageIdx !== null || isInspectMode) return;
    if (!forgeDraft.snapshot || forgeDraft.snapshot.events.length === 0) {
      pushToast({
        text: '当前草稿尚未包含有效音符，请先在 02 BEAT 或 03 PINBALL 创作声音！',
        accent: '#FF5C2B',
      });
      return;
    }

    playSfx('foilPress');
    setMintCeremonyKey((k) => k + 1);
    setMintStageIdx(0);

    const wait = (ms: number) => new Promise((r) => window.setTimeout(r, ms));
    try {
      await wait(140);
      setMintStageIdx(1);
      const rendered = await renderCompositionSnapshotCached(forgeDraft.snapshot);
      setRealWaveformMap((prev) => ({
        ...prev,
        [forgeDraft.snapshot!.id]: rendered.waveformBars,
      }));
      setMintStageIdx(2);
      await wait(130);
      setMintStageIdx(3);
      await wait(130);
      setMintStageIdx(4);
      await wait(150);
      setMintStageIdx(5);

      const minted = await mintCurrentCard(rendered.waveformBars);
      if (!minted) {
        setMintStageIdx(null);
        return;
      }

      setMintStageIdx(6);
      fireHoloConfetti('high');
      await wait(780);
      setMintStageIdx(null);
    } catch {
      setMintStageIdx(null);
      pushToast({ text: '铸造流程中断，草稿已安全保留', accent: '#FF5C2B' });
    }
  };

  const handleExportPng = async () => {
    if (exportingPng) return;
    setExportingPng(true);
    playSfx('click', 0.85);
    try {
      const blob = await renderHoloCardToPngBlob({
        title: activeTitle.trim() || 'HOLO MIX',
        code: displayCode,
        rarity: activeRarity,
        foil: activeFoil,
        artId: activeArtId,
        stickers: activeStickers,
        waveformBars,
        waveformIsRealPcm: isRealPcm,
        sourceType: activeSourceType,
        bpm: activeSnapshot?.bpm ?? 116,
        scaleLabel: SCALE_META[activeSnapshot?.scale ?? 'PENTA_C'].label,
        isDemo: inspectedCard?.isDemo,
        lineageLabel,
        sigilSnapshot: activeSnapshot,
      });
      const safeName = (activeTitle.trim() || 'holobeat-card')
        .toLowerCase()
        .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-');
      triggerBlobDownload(blob, `${safeName}-gallery-poster.png`);
      fireHoloConfetti('normal');
      pushToast({
        text: `✦ 已导出展板级 3× 超清藏品海报 PNG (1200×1600 · 含声音纹章)！`,
        accent: '#00D4AA',
      });
    } catch {
      pushToast({ text: 'PNG 导出遇到问题，请重试', accent: '#FF5526' });
    } finally {
      setExportingPng(false);
    }
  };

  const handleExportWav = async () => {
    if (exportingWav || !activeSnapshot) return;
    setExportingWav(true);
    playSfx('click', 0.85);
    try {
      const safeName = (activeTitle.trim() || 'holobeat-audio')
        .toLowerCase()
        .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-');
      const res = await renderCompositionSnapshotCached(activeSnapshot);
      setRealWaveformMap((prev) => ({ ...prev, [activeSnapshot.id]: res.waveformBars }));
      triggerBlobDownload(res.wavBlob, `${safeName}.wav`);
      pushToast({
        text: `♪ 已导出 16-bit PCM 音频 WAV（与试听/声纹 100% 一致）！`,
        accent: '#7C3AED',
      });
    } catch {
      pushToast({ text: 'WAV 离屏渲染遇到问题，请重试', accent: '#FF5526' });
    } finally {
      setExportingWav(false);
    }
  };

  const handleExportMotionCard = async () => {
    if (exportingMotion || !activeSnapshot) return;
    setExportingMotion(true);
    setMotionProgress(0);
    playSfx('click', 0.85);
    try {
      const blob = await recordMotionCardWebm({
        title: activeTitle.trim() || 'HOLO MIX',
        code: displayCode,
        rarity: activeRarity,
        foil: activeFoil,
        artId: activeArtId,
        stickers: activeStickers,
        waveformBars,
        snapshot: activeSnapshot,
        onProgress: (p) => setMotionProgress(p),
      });
      const safeName = (activeTitle.trim() || 'holobeat-motion')
        .toLowerCase()
        .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-');
      triggerBlobDownload(blob, `${safeName}-motion-card.webm`);
      fireHoloConfetti('normal');
      pushToast({
        text: `✦ 已录制并导出含原声全息动态卡 (.webm)！`,
        accent: '#00D4AA',
      });
    } catch (err) {
      pushToast({
        text: err instanceof Error ? err.message : '动态卡录制失败，请重试',
        accent: '#FF5C2B',
      });
    } finally {
      setExportingMotion(false);
      setMotionProgress(0);
    }
  };

  const handleExportProjectJson = () => {
    playSfx('click', 0.8);
    const payload: HoloBeatProjectFile = inspectedCard
      ? {
          schema: 'holobeat.project.v2',
          exportedAt: Date.now(),
          kind: 'minted-card',
          card: inspectedCard,
        }
      : {
          schema: 'holobeat.project.v2',
          exportedAt: Date.now(),
          kind: 'forge-draft',
          draft: forgeDraft,
        };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const safeName = (activeTitle.trim() || 'holobeat-project')
      .toLowerCase()
      .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-');
    triggerBlobDownload(blob, `${safeName}.holobeat.json`);
    pushToast({
      text: `✦ 已导出可重混工程文件 ${safeName}.holobeat.json！`,
      accent: '#FFD426',
    });
  };

  const handleImportProjectJson = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as HoloBeatProjectFile;
      await importProjectFile(parsed);
    } catch {
      pushToast({ text: '读取 .holobeat.json 失败，请检查文件格式', accent: '#FF5C2B' });
    }
  };

  const handleBackendShare = async () => {
    if (!inspectedCard || syncingShare) return;
    setSyncingShare(true);
    playSfx('click', 0.8);
    const res = await syncCardToBackend(inspectedCard);
    setSyncingShare(false);
    if (res.ok && res.share) {
      try {
        await navigator.clipboard.writeText(res.share.shareUrl);
        pushToast({
          text: `✦ 已同步至本地档案馆并复制只读分享链接：${res.share.shareUrl}`,
          accent: '#00D4AA',
        });
      } catch {
        pushToast({
          text: `✦ 已同步至本地档案馆！分享令牌：${res.share.token}`,
          accent: '#00D4AA',
        });
      }
    } else if (res.ok) {
      pushToast({ text: '✦ 已同步至本地归档后端！', accent: '#00D4AA' });
    } else {
      pushToast({ text: res.error ?? '本地归档服务未启动', accent: '#FFD426' });
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
      isDemo: m.isDemo,
      lineageDepth: m.lineageDepth,
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
      isDemo: false,
      lineageDepth: 0,
      rawCard: c,
    }));

    if (binderFilter === 'MINTED') return mintedEntries;
    if (binderFilter === 'GACHA') return gachaEntries;
    return [...mintedEntries, ...gachaEntries];
  }, [binderFilter, mintedCards, collection]);

  return (
    <div className="w-full h-full p-3 grid grid-cols-[minmax(295px,31.5%)_1fr_minmax(280px,29.5%)] gap-3.5 overflow-hidden">
      {/* Hidden Project Import Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".json,.holobeat.json"
        onChange={(e) => void handleImportProjectJson(e)}
        className="hidden"
      />

      {/* ================= LEFT COLUMN: CUSTOMIZATION CONSOLE OR ARCHIVE INSPECTOR ================= */}
      <section className="flex flex-col gap-2 min-h-0 overflow-y-auto holo-scroll pr-0.5">
        {/* Mode Status Bar: DRAFT vs. ARCHIVE INSPECT */}
        <div
          className={`rounded-2xl border-[2.5px] border-[#17171C] px-3 py-2 flex items-center justify-between gap-2 shrink-0 shadow-[3px_3px_0px_#17171C] ${
            isInspectMode ? 'bg-[#14151B] text-[#FBF9F4]' : 'bg-[#FFD426] text-[#17171C]'
          }`}
        >
          <div className="min-w-0">
            <div className="font-mono-hw text-[9.5px] font-bold tracking-[0.14em] opacity-80 uppercase">
              {isInspectMode ? 'READ-ONLY ARCHIVE INSPECTOR' : 'LIVE FORGE DRAFT WORKBENCH'}
            </div>
            <div className="text-xs font-black truncate">
              {isInspectMode
                ? `正在鉴赏 ${inspectedCard.code} · 草稿已安全隔离`
                : `草稿编辑模式 · 下张编号 ${displayCode}`}
            </div>
          </div>

          {isInspectMode ? (
            <button
              onClick={() => {
                playSfx('tab');
                returnToForgeDraft();
              }}
              className="brutal-pad px-2.5 py-1 rounded-xl bg-[#FFD426] text-[#17171C] text-[10.5px] font-black flex items-center gap-1 shrink-0"
            >
              <ArrowLeft className="w-3 h-3" /> 返回草稿
            </button>
          ) : (
            <button
              onClick={() => fileInputRef.current?.click()}
              title="导入 .holobeat.json 工程文件"
              className="brutal-pad px-2.5 py-1 rounded-xl bg-[#FBF9F4] text-[#17171C] text-[10px] font-black flex items-center gap-1 shrink-0"
            >
              <FolderOpen className="w-3 h-3" /> 导入工程
            </button>
          )}
        </div>

        {/* Sound Sigil + Real PCM Acoustic Specimen Card (Obsidian High-Contrast) */}
        {activeSnapshot && (
          <div className="rounded-2xl border-[2.5px] border-[#17171C] shadow-[3px_3px_0px_#17171C] p-2.5 shrink-0 flex items-center gap-3 bg-[#14151B] text-[#FBF9F4]">
            <SoundSigil snapshot={activeSnapshot} size={74} />
            <div className="flex-1 min-w-0 flex flex-col gap-1">
              <div className="flex items-center justify-between gap-1">
                <span className="font-mono-hw text-[9.5px] font-bold text-[#FFD426] tracking-wider uppercase">
                  SOUND SIGIL · 声音纹章
                </span>
                <span
                  className={`px-1.5 py-0.5 rounded font-mono-hw text-[8.5px] font-black ${
                    isRealPcm
                      ? 'bg-[#00D4AA] text-[#17171C]'
                      : 'bg-white/15 text-white/85'
                  }`}
                >
                  {isRealPcm ? 'REAL PCM' : 'RENDERING...'}
                </span>
              </div>
              <div className="font-mono-hw text-[11px] font-bold text-[#FBF9F4]">
                {activeSourceType.toUpperCase()} · {activeSnapshot.bpm} BPM ·{' '}
                {activeSnapshot.events.length} 音符
              </div>
              <div className="text-[10px] font-bold text-white/65 truncate flex items-center gap-1">
                <GitBranch className="w-3 h-3 text-[#00D4AA] shrink-0" />
                <span>{lineageLabel ?? 'ORIGINAL DRAFT · 原创首发'}</span>
              </div>
            </div>
          </div>
        )}

        {isInspectMode ? (
          /* ================= INSPECT ARCHIVE SPECIMEN CONTROLS ================= */
          <div className="brutal-panel-sm p-3 flex flex-col gap-2.5 shrink-0">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-black uppercase tracking-wide text-[#17171C]">
                ARCHIVE SPEC · 藏品档案
              </h2>
              <span className="font-mono-hw text-[10px] font-bold text-[#626272]">
                {inspectedCard.code}
              </span>
            </div>

            <p className="text-[11px] font-bold text-[#626272] leading-relaxed">
              此藏品已永久封存原始音频快照与全息外观。点击下方「拆封重混」可将它的编曲或弹珠场景载入工作台创作第{' '}
              {inspectedCard.lineageDepth + 1} 代变奏，原藏品保持 100% 完好！
            </p>

            <button
              onClick={() => {
                playSfx('cartridgeLock');
                unsealAndRemixCard(inspectedCard.id);
              }}
              className="brutal-btn-lg w-full py-2.5 rounded-xl bg-[#7C3AED] text-white text-xs font-black tracking-wide uppercase flex items-center justify-center gap-1.5"
            >
              <Unlock className="w-4 h-4" />
              <span>UNSEAL & REMIX · 拆封重混创作</span>
            </button>

            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={handleExportProjectJson}
                className="brutal-btn py-2 px-2 rounded-xl bg-[#FBF9F4] text-[#17171C] text-[11px] font-black flex items-center justify-center gap-1"
              >
                <FileJson className="w-3.5 h-3.5 text-[#7C3AED]" />
                <span>导出工程 JSON</span>
              </button>
              <button
                onClick={() => void handleBackendShare()}
                disabled={syncingShare}
                title="可选：若已启动本地 06_backend 服务，可同步并生成只读分享链接"
                className="brutal-btn py-2 px-2 rounded-xl bg-[#FBF9F4] text-[#17171C] text-[11px] font-black flex items-center justify-center gap-1 disabled:opacity-50"
              >
                <Share2 className="w-3.5 h-3.5 text-[#00D4AA]" />
                <span>{syncingShare ? '同步中...' : '同步 / 分享'}</span>
              </button>
            </div>

            {/* Technical Archive Specimen Sheet for vertical balance & curatorial depth */}
            <div className="mt-1 rounded-xl bg-[#F3EFE6] border-[2px] border-[#17171C]/20 p-2.5 flex flex-col gap-1.5 font-mono-hw text-[10px]">
              <div className="text-[9px] font-black tracking-widest text-[#626272] uppercase border-b border-[#17171C]/12 pb-1">
                ACOUSTIC SPECIMEN LOG · 声学存证
              </div>
              <div className="flex justify-between">
                <span className="text-[#626272]">SOURCE</span>
                <span className="font-black text-[#17171C]">{inspectedCard.sourceType.toUpperCase()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#626272]">FOIL / RARITY</span>
                <span className="font-black text-[#17171C]">
                  {foilMeta.label} · {inspectedCard.rarity}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#626272]">SCALE / BPM</span>
                <span className="font-black text-[#17171C]">
                  {SCALE_META[inspectedCard.snapshot.scale].label} · {inspectedCard.snapshot.bpm}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#626272]">LINEAGE</span>
                <span className="font-black text-[#7C3AED]">
                  {inspectedCard.parentCode
                    ? `${inspectedCard.parentCode} → GEN ${inspectedCard.lineageDepth}`
                    : 'GEN 0 · ORIGINAL'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#626272]">SEALED AT</span>
                <span className="font-bold text-[#17171C]">
                  {new Date(inspectedCard.createdAt).toLocaleDateString()}
                </span>
              </div>
            </div>
          </div>
        ) : (
          /* ================= DRAFT CUSTOMIZATION CONTROLS ================= */
          <>
            {/* Block 1: AUDIO SOURCE */}
            <div className="brutal-panel-sm p-2.5 shrink-0">
              <div className="flex items-center justify-between mb-1.5">
                <h2 className="text-[12px] font-black tracking-wide uppercase text-[#17171C]">
                  AUDIO SOURCE
                </h2>
                <span className="hw-silkscreen !text-[8px]">FROZEN SNAPSHOT</span>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => {
                    playSfx('click', 0.7);
                    setForgeSource('beat');
                  }}
                  className={`brutal-btn px-2.5 py-1.5 rounded-xl text-[11px] font-black tracking-wide whitespace-nowrap ${
                    forgeDraft.sourceType === 'beat'
                      ? 'bg-[#FF5526] text-[#17171C]'
                      : 'bg-[#FBF9F4] text-[#17171C]'
                  }`}
                >
                  捕获节拍
                </button>
                <button
                  onClick={() => {
                    playSfx('click', 0.7);
                    setForgeSource('pinball');
                  }}
                  className={`brutal-btn px-2.5 py-1.5 rounded-xl text-[11px] font-black tracking-wide whitespace-nowrap ${
                    forgeDraft.sourceType === 'pinball'
                      ? 'bg-[#00D4AA] text-[#17171C]'
                      : 'bg-[#FBF9F4] text-[#17171C]'
                  }`}
                >
                  捕获弹珠
                </button>
                <button
                  onClick={handleExportProjectJson}
                  title="导出当前草稿为 .holobeat.json"
                  className="brutal-btn ml-auto px-2.5 py-1.5 rounded-xl bg-[#FBF9F4] text-[10.5px] font-black flex items-center gap-1"
                >
                  <FileJson className="w-3.5 h-3.5 text-[#7C3AED]" />
                  <span>JSON</span>
                </button>
              </div>
            </div>

            {/* Block 2: CARD TITLE & RARITY */}
            <div className="brutal-panel-sm p-2.5 shrink-0">
              <div className="flex items-center justify-between mb-1.5">
                <h2 className="text-[12px] font-black tracking-wide uppercase text-[#17171C]">
                  CARD TITLE
                </h2>
                <button
                  onClick={() => {
                    playSfx('click', 0.8);
                    const next =
                      artOptions[(artOptions.indexOf(forgeDraft.artId) + 1) % artOptions.length];
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
                value={forgeDraft.title}
                onChange={(e) => setForgeTitle(e.target.value)}
                maxLength={18}
                placeholder="NEON NIGHT"
                className="w-full px-3 py-1.5 rounded-xl bg-[#FBF9F4] border-[2.5px] border-[#17171C] text-[14px] font-black tracking-wide uppercase text-[#17171C] focus:outline-none focus:ring-2 focus:ring-[#7C3AED]"
              />

              <div className="grid grid-cols-3 gap-1.5 mt-2">
                {(['SSR', 'UR', 'LTD'] as ForgeRarity[]).map((rar) => {
                  const active = forgeDraft.rarity === rar;
                  return (
                    <button
                      key={rar}
                      onClick={() => {
                        playSfx('click', 0.78);
                        setForgeRarity(rar);
                      }}
                      className={`brutal-pad py-1 rounded-xl text-[11px] font-black tracking-wider ${
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

            {/* Block 3: HOLO FOIL (5) */}
            <div className="brutal-panel-sm p-2.5 shrink-0">
              <div className="flex items-center justify-between mb-1.5">
                <h2 className="text-[12px] font-black tracking-wide uppercase text-[#17171C]">
                  HOLO FOIL (5)
                </h2>
                <span className="font-mono-hw text-[9.5px] font-bold text-[#626272]">
                  {foilMeta.zhLabel}
                </span>
              </div>
              <div className="grid grid-cols-5 gap-1.5">
                {HOLO_FOIL_LIST.map((f) => {
                  const active = forgeDraft.foil === f.id;
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
                      <span className="font-mono-hw text-[8.5px] font-black text-[#17171C] leading-none">
                        {f.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Block 4: STICKER PACK with Undo/Redo */}
            <div className="brutal-panel-sm p-2.5 flex flex-col gap-1.5 shrink-0">
              <div className="flex items-center justify-between">
                <h2 className="text-[12px] font-black tracking-wide uppercase text-[#17171C]">
                  STICKER PACK
                </h2>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => {
                      playSfx('click', 0.4);
                      undoForgeStickers();
                    }}
                    disabled={stickerUndoCount === 0}
                    title="撤销贴纸"
                    className="brutal-pad p-1 rounded-lg bg-[#FBF9F4] disabled:opacity-35"
                  >
                    <Undo2 className="w-3 h-3" />
                  </button>
                  <button
                    onClick={() => {
                      playSfx('click', 0.6);
                      redoForgeStickers();
                    }}
                    disabled={stickerRedoCount === 0}
                    title="重做贴纸"
                    className="brutal-pad p-1 rounded-lg bg-[#FBF9F4] disabled:opacity-35"
                  >
                    <Redo2 className="w-3 h-3" />
                  </button>
                  {forgeDraft.stickers.length > 0 && (
                    <button
                      onClick={() => {
                        playSfx('click', 0.25);
                        clearForgeStickers();
                      }}
                      className="text-[9.5px] font-black px-1.5 py-0.5 rounded-lg bg-[#FBF9F4] border-[1.5px] border-[#17171C] hover:bg-[#FF5526] hover:text-white flex items-center gap-0.5 cursor-pointer"
                    >
                      <Eraser className="w-2.5 h-2.5" /> 清空
                    </button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-4 gap-1.5">
                {STICKER_PACK.map((stk) => (
                  <button
                    key={stk.id}
                    onClick={() => {
                      playSfx('cartridgeLock');
                      addForgeSticker(stk.id);
                    }}
                    title={`添加「${stk.zhLabel}」贴纸`}
                    className="brutal-pad h-[48px] rounded-xl bg-[#FBF9F4] hover:bg-[#FEF9C3] p-1 flex items-center justify-center group"
                  >
                    <svg
                      viewBox="0 0 64 64"
                      className="w-8 h-8 group-hover:scale-110 transition-transform duration-150"
                      dangerouslySetInnerHTML={{ __html: stk.svgInner }}
                    />
                  </button>
                ))}
              </div>
              <p className="text-[9.5px] font-bold text-[#626272] text-center leading-tight">
                拖拽自带中线吸附 · 点击置顶/缩放/旋转 · 双击移除
              </p>
            </div>
          </>
        )}
      </section>

      {/* ================= CENTER COLUMN: HOLO CARD FORGE PRESS ================= */}
      <section className="flex flex-col gap-2 min-h-0">
        <div
          className={`brutal-oled relative flex-1 flex flex-col items-center justify-between p-3 overflow-hidden min-h-0 transition-shadow duration-300 ${
            mintStageIdx !== null ? 'ring-4 ring-[#FFD426]' : ''
          }`}
          style={{
            backgroundImage:
              'radial-gradient(circle at 50% 48%, rgba(255, 212, 38, 0.08) 0%, transparent 62%), linear-gradient(to right, rgba(255,212,38,0.06) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,212,38,0.06) 1px, transparent 1px)',
            backgroundSize: '100% 100%, 26px 26px, 26px 26px',
          }}
        >
          {/* Top Forge Coordinate Strip + Card Flip Button */}
          <div className="w-full flex items-center justify-between text-white/60 font-mono-hw text-[10px] tracking-[0.12em] shrink-0 z-10">
            <span>
              + {isInspectMode ? 'ARCHIVE VAULT' : 'FOIL PRESS'} // {displayCode}
            </span>
            <div className="flex items-center gap-2">
              <span className="text-[#FFD426] font-bold">
                {activeRarity} · {foilMeta.label}
              </span>
              <button
                onClick={() => {
                  playSfx('cardFlip');
                  setFlippedCard((f) => !f);
                }}
                title="翻转查看卡背声音纹章与创作谱系"
                className="px-2 py-0.5 rounded-lg bg-white/10 hover:bg-[#FFD426] hover:text-[#17171C] text-white text-[9.5px] font-black cursor-pointer flex items-center gap-1 transition-colors"
              >
                <RotateCcw className="w-3 h-3" /> {flippedCard ? '看正面' : '翻看卡背'}
              </button>
            </div>
          </div>

          {/* Center Oversized Live 3D Holographic Card */}
          <div className="flex-1 flex items-center justify-center relative z-10 py-1 min-h-0">
            <HoloCard
              title={activeTitle.trim() || 'NEON NIGHT'}
              code={displayCode}
              rarity={activeRarity}
              specLabel={activeSourceType === 'beat' ? 'BEAT MIX' : 'PINBALL'}
              foil={activeFoil}
              artId={activeArtId}
              recommendedBpm={activeSnapshot?.bpm ?? 116}
              isDemo={inspectedCard?.isDemo}
              lineageLabel={lineageLabel}
              sigilSnapshot={activeSnapshot}
              flipped={flippedCard}
              waveformBars={waveformBars}
              waveformActive={isPlayingSnapshot}
              waveformProgress={waveformProgress}
              stickers={activeStickers}
              editableStickers={!isInspectMode && !flippedCard}
              onUpdateSticker={updateForgeSticker}
              onBringStickerFront={bringStickerToFront}
              onRemoveSticker={removeForgeSticker}
              showAura
              idleShimmer
              width={cardDims.w}
              height={cardDims.h}
            />

            {/* 7-Stage Artisanal Laser Lamination Mint Ceremony Overlay */}
            {mintStageIdx !== null && (
              <div
                key={mintCeremonyKey}
                className="absolute inset-0 z-40 pointer-events-none flex items-center justify-center overflow-hidden rounded-2xl bg-[#14151B]/35"
              >
                <div className="absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-transparent via-[#00D4AA]/75 to-transparent shadow-[0_0_28px_#00D4AA] animate-forge-laser" />
                <div className="px-5 py-3 rounded-2xl bg-[#14151B]/95 border-[3px] border-[#FFD426] shadow-[0_0_32px_rgba(255,212,38,0.72)] animate-forge-stamp text-center">
                  <div className="font-mono-hw text-[10px] font-bold text-[#00D4AA] tracking-[0.16em] mb-1">
                    HOLOBEAT PRESS CEREMONY
                  </div>
                  <div className="font-black italic text-base tracking-wide text-[#FFD426] whitespace-nowrap">
                    {MINT_STAGES[mintStageIdx]}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Bottom Technical Alignment Strip */}
          <div className="w-full flex items-center justify-between text-white/45 font-mono-hw text-[9.5px] tracking-[0.12em] shrink-0 z-10">
            <span>+ 3X GALLERY POSTER · 16-BIT WAV · WEBM MOTION</span>
            <span>{isRealPcm ? 'PCM VERIFIED +' : '1200×1600 HD +'}</span>
          </div>
        </div>

        {/* Bottom Primary CTA + Multi-Format Export Row */}
        <div className="flex flex-col gap-2 shrink-0">
          {isInspectMode ? (
            <button
              onClick={() => {
                playSfx('cartridgeLock');
                unsealAndRemixCard(inspectedCard.id);
              }}
              className="brutal-btn-lg w-full py-2.5 rounded-2xl bg-[#7C3AED] text-white text-[17px] font-black tracking-wide uppercase flex items-center justify-center gap-2"
            >
              <Unlock className="w-5 h-5" strokeWidth={2.6} />
              <span>UNSEAL & REMIX · 拆封进入再创作</span>
            </button>
          ) : (
            <button
              onClick={() => void handleMint()}
              disabled={mintInFlight || mintStageIdx !== null}
              className="brutal-btn-lg w-full py-2.5 rounded-2xl bg-[#FF5526] text-[#17171C] text-[17px] font-black tracking-wide uppercase flex items-center justify-center gap-2 disabled:opacity-65"
            >
              <Stamp className="w-5 h-5" strokeWidth={2.8} />
              <span>
                {mintStageIdx !== null ? MINT_STAGES[mintStageIdx] : 'MINT TO BINDER · 压印封印'}
              </span>
            </button>
          )}

          <div className="grid grid-cols-4 gap-1.5">
            <button
              onClick={() => void handleExportPng()}
              disabled={exportingPng}
              className="brutal-btn py-2 px-1.5 rounded-xl bg-[#00D4AA] text-[#17171C] text-[11px] font-black tracking-wide uppercase flex items-center justify-center gap-1 disabled:opacity-60"
            >
              <Download className="w-3.5 h-3.5 shrink-0" strokeWidth={2.8} />
              <span>{exportingPng ? '导出中...' : 'PNG 海报'}</span>
            </button>

            <button
              onClick={() => void handleExportWav()}
              disabled={exportingWav}
              className="brutal-btn py-2 px-1.5 rounded-xl bg-[#7C3AED] text-white text-[11px] font-black tracking-wide uppercase flex items-center justify-center gap-1 disabled:opacity-60"
            >
              <Music className="w-3.5 h-3.5 shrink-0" strokeWidth={2.8} />
              <span>{exportingWav ? '渲染中...' : 'WAV 音频'}</span>
            </button>

            <button
              onClick={() => void handleExportMotionCard()}
              disabled={exportingMotion}
              title="录制含原声全息动态卡 (.webm)"
              className="brutal-btn py-2 px-1.5 rounded-xl bg-[#14151B] text-[#FFD426] text-[11px] font-black tracking-wide uppercase flex items-center justify-center gap-1 disabled:opacity-60"
            >
              <Film className="w-3.5 h-3.5 shrink-0" strokeWidth={2.6} />
              <span>{exportingMotion ? `${motionProgress}%` : '动态卡'}</span>
            </button>

            <button
              onClick={() => void handleTogglePlay()}
              className={`brutal-btn py-2 px-1.5 rounded-xl text-[11px] font-black tracking-wide uppercase flex items-center justify-center gap-1 ${
                isPlayingSnapshot ? 'bg-[#FFD426] text-[#17171C]' : 'bg-[#FBF9F4] text-[#17171C]'
              }`}
            >
              {isPlayingSnapshot ? (
                <>
                  <Pause className="w-3.5 h-3.5 fill-current" /> 停止
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 fill-current" /> 试听
                </>
              )}
            </button>
          </div>
        </div>
      </section>

      {/* ================= RIGHT COLUMN: COLLECTOR BINDER SLEEVE ================= */}
      <section className="brutal-panel p-3 flex flex-col gap-2 min-h-0 overflow-hidden">
        <div className="shrink-0">
          <div className="flex items-center justify-between mb-1.5">
            <h2 className="text-[16px] font-black tracking-wide uppercase text-[#17171C] leading-none">
              MY BINDER
            </h2>
            <span className="font-mono-hw text-xs font-bold text-[#626272]">
              {binderItems.length} CARDS
            </span>
          </div>

          <div className="grid grid-cols-3 gap-1.5">
            {(['ALL', 'MINTED', 'GACHA'] as const).map((tab) => {
              const active = binderFilter === tab;
              return (
                <button
                  key={tab}
                  onClick={() => {
                    playSfx('click', 0.6);
                    setBinderFilter(tab);
                  }}
                  className={`brutal-pad py-1 rounded-xl text-[11px] font-black tracking-wider ${
                    active ? 'bg-[#FFD426] text-[#17171C]' : 'bg-[#FBF9F4] text-[#17171C]'
                  }`}
                >
                  {tab}
                </button>
              );
            })}
          </div>
        </div>

        {/* Translucent Collectible Binder Sleeve Page */}
        <div className="flex-1 rounded-2xl bg-[#E7E1D3] border-[2.5px] border-[#17171C] p-2 overflow-y-auto holo-scroll shadow-[inset_0_2px_6px_rgba(0,0,0,0.12)]">
          <div className="grid grid-cols-2 gap-2">
            {binderItems.map((item) => {
              const rar = RARITY_META[item.rarity];
              const isSelected =
                (item.kind === 'minted' && inspectMintedId === item.id) ||
                (item.kind === 'gacha' &&
                  inspectMintedId === null &&
                  forgeDraft.artId === item.artId);

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
                    setFlippedCard(false);
                    if (item.kind === 'minted') {
                      inspectMintedCard(item.id);
                    } else {
                      loadGachaCardIntoForgeDraft(item.id);
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
                          className="absolute top-1 left-1 px-1.5 py-[0.5px] rounded text-[8px] font-black border border-[#17171C] -rotate-3"
                          style={{ backgroundColor: rar.bg, color: rar.text }}
                        >
                          {rar.label}
                        </span>
                        {item.isDemo && (
                          <span className="absolute bottom-1 left-1 px-1 py-[0.5px] rounded bg-[#14151B]/90 text-[#FFD426] font-mono-hw text-[7.5px] font-black border border-[#FFD426]/60">
                            DEMO
                          </span>
                        )}
                        {item.lineageDepth > 0 && (
                          <span className="absolute bottom-1 left-1 px-1 py-[0.5px] rounded bg-[#7C3AED]/95 text-white font-mono-hw text-[7.5px] font-black">
                            G{item.lineageDepth}
                          </span>
                        )}
                        {item.kind === 'minted' && (
                          <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 flex flex-col gap-1 transition-opacity">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                playSfx('cartridgeLock');
                                unsealAndRemixCard(item.id);
                              }}
                              title="拆封重混此藏品"
                              className="p-1 rounded-md bg-[#7C3AED] text-white hover:brightness-110 cursor-pointer"
                            >
                              <Unlock className="w-2.5 h-2.5" />
                            </button>
                            {!item.isDemo && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  playSfx('click', 0.25);
                                  void deleteMintedCard(item.id);
                                }}
                                title="删除此自铸闪卡"
                                className="p-1 rounded-md bg-[#14151B]/90 text-[#FF5526] hover:bg-[#FF5526] hover:text-white cursor-pointer"
                              >
                                <Trash2 className="w-2.5 h-2.5" />
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                      <div
                        className={`border-t-[1.5px] border-[#17171C] py-0.5 px-1 text-center ${
                          item.rarity === 'LTD'
                            ? 'bg-[#14151B] text-[#FEF08A]'
                            : 'bg-[#FBF9F4] text-[#17171C]'
                        }`}
                      >
                        <span className="block text-[9px] font-black italic tracking-tight truncate uppercase">
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
