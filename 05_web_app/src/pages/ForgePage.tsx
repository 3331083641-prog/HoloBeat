import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  Download,
  Eraser,
  FileJson,
  Film,
  FolderOpen,
  GitBranch,
  HardDrive,
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
  X,
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
import { useHeroCardSize } from '../hooks/useHeroCardSize';
import { useHoloStore } from '../store/useHoloStore';
import type { ForgeRarity, HoloBeatProjectFile } from '../types/holo';
import { syncCardToBackend } from '../utils/backendClient';
import { fireHoloConfetti } from '../utils/confetti';
import { renderHoloCardToPngBlob } from '../utils/exportHoloPng';
import { recordMotionCardWebm } from '../utils/exportMotionCard';

const MINT_STAGES = [
  '01/05 锁定草稿与音符快照...',
  '02/05 离屏渲染无损声轨...',
  '03/05 提取真实 PCM 波形...',
  '04/05 写入本设备持久化卡册...',
  '05/05 ★ 压印完成 ★',
];

const BENCHMARK_ARTS = ['bamboo-cat', 'street-bell', 'lucky-coin', 'night-sizzle', 'sugar-spoon', 'neon-dj'];

export const ForgePage: React.FC = () => {
  const forgeDraft = useHoloStore((s) => s.forgeDraft);
  const inspectMintedId = useHoloStore((s) => s.inspectMintedId);
  const lastMintedCardId = useHoloStore((s) => s.lastMintedCardId);
  const lastStorageError = useHoloStore((s) => s.lastStorageError);
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
  const createMintRequest = useHoloStore((s) => s.createMintRequest);
  const commitMintRequest = useHoloStore((s) => s.commitMintRequest);
  const unsealAndRemixCard = useHoloStore((s) => s.unsealAndRemixCard);
  const deleteMintedCard = useHoloStore((s) => s.deleteMintedCard);
  const importProjectFile = useHoloStore((s) => s.importProjectFile);
  const pushToast = useHoloStore((s) => s.pushToast);

  const playSfx = useHoloSfx();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const heroStageRef = useRef<HTMLDivElement>(null);
  const motionAbortRef = useRef<AbortController | null>(null);

  // ResizeObserver-driven Hero Card fills ~66–74% of center stage height across all viewports
  const cardDims = useHeroCardSize(heroStageRef, {
    heightRatio: 0.9,
    maxWidthRatio: 0.88,
    minH: 250,
    maxH: 540,
  });

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
      if (inspectedCard.isDemo) return '示例作品';
      if (inspectedCard.parentCode) {
        return `拆封重混 · 第 ${inspectedCard.lineageDepth} 代`;
      }
      return '原创首发';
    }
    if (forgeDraft.remixOrigin) {
      return `拆封重混 · 第 ${forgeDraft.remixOrigin.lineageDepth} 代`;
    }
    return undefined;
  }, [inspectedCard, forgeDraft.remixOrigin]);

  // Asynchronously compute & cache REAL 16-bit PCM waveform for the active snapshot
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

  const auditionRef = useRef<number | null>(null);
  const cancelAudition = () => {
    const request = auditionRef.current;
    auditionRef.current = null;
    if (request !== null) holoAudio.cancelSnapshotRequest(request);
  };
  useEffect(() => {
    cancelAudition();
    setIsPlayingSnapshot(false);
    setWaveformProgress(-1);
    const hidden = () => {
      if (document.hidden) {
        cancelAudition();
        setIsPlayingSnapshot(false);
        setWaveformProgress(-1);
      }
    };
    document.addEventListener('visibilitychange', hidden);
    return () => {
      cancelAudition();
      document.removeEventListener('visibilitychange', hidden);
      motionAbortRef.current?.abort();
    };
  }, [inspectMintedId, activeSnapshot?.id]);

  // Live waveform playhead sweep loop during canonical WAV audition
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
    return Array.from(new Set([...BENCHMARK_ARTS, ...unlockedArts]));
  }, [collection]);

  /**
   * FIX #5: Audition plays the EXACT canonical rendered WAV Blob (identical to exported WAV!)
   */
  const handleTogglePlay = async () => {
    if (!activeSnapshot || activeSnapshot.events.length === 0) {
      pushToast({ text: '当前作品暂无可试听的音符事件', accent: '#FF5C2B' });
      return;
    }
    if (auditionRef.current !== null) {
      cancelAudition();
      setIsPlayingSnapshot(false);
      setWaveformProgress(-1);
      return;
    }
    const request = holoAudio.beginSnapshotRequest();
    auditionRef.current = request;
    const current = () => auditionRef.current === request && holoAudio.isSnapshotRequestCurrent(request);
    setIsPlayingSnapshot(true);
    try {
      const artifact = await renderCompositionSnapshotCached(activeSnapshot);
      if (!current()) return;
      setRealWaveformMap((prev) => ({ ...prev, [activeSnapshot.id]: artifact.waveformBars }));
      await holoAudio.playAudioBlob(artifact.wavBlob, {
        leadInMs: 40,
        requestSession: request,
        onComplete: () => {
          if (auditionRef.current !== request) return;
          auditionRef.current = null;
          setIsPlayingSnapshot(false);
          setWaveformProgress(-1);
        },
      });
    } catch {
      if (!current()) return;
      cancelAudition();
      setIsPlayingSnapshot(false);
      setWaveformProgress(-1);
      pushToast({ text: '试听渲染遇到问题，请重试', accent: '#FF5C2B' });
    }
  };

  /**
   * FIX #1 & #2: Freeze MintRequest immediately -> render canonical PCM -> persistence-gated commit!
   * Zero fake success or serial increment if storage fails!
   */
  const handleMint = async () => {
    if (mintInFlight || mintStageIdx !== null || isInspectMode) return;
    const req = createMintRequest();
    if (!req) return;

    playSfx('foilPress');
    setMintCeremonyKey((k) => k + 1);
    setMintStageIdx(0);

    const wait = (ms: number) => new Promise((r) => window.setTimeout(r, ms));
    try {
      await wait(120);
      setMintStageIdx(1);
      const rendered = await renderCompositionSnapshotCached(req.snapshot);
      setRealWaveformMap((prev) => ({
        ...prev,
        [req.snapshot.id]: rendered.waveformBars,
      }));
      setMintStageIdx(2);
      await wait(110);
      setMintStageIdx(3);

      const res = await commitMintRequest(req, rendered.waveformBars);
      if (!res.card || res.saveResult.status === 'failed') {
        setMintStageIdx(null);
        return;
      }

      setMintStageIdx(4);
      if (!res.duplicate) {
        fireHoloConfetti('high');
      }
      await wait(650);
      setMintStageIdx(null);
    } catch {
      setMintStageIdx(null);
      pushToast({ text: '压印流程中断，草稿与贴纸已安全保留', accent: '#FF5C2B' });
    }
  };

  const handleExportPng = async () => {
    if (exportingPng) return;
    setExportingPng(true);
    playSfx('click', 0.85);
    try {
      const blob = await renderHoloCardToPngBlob({
        title: activeTitle.trim() || '胡同放克',
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
      triggerBlobDownload(blob, `${safeName}-展板海报.png`);
      fireHoloConfetti('normal');
      pushToast({
        text: `✦ 已导出高清展板海报 PNG (1200×1600 · 含声音纹章)`,
        accent: '#00D4AA',
      });
    } catch {
      pushToast({ text: 'PNG 导出遇到问题，请重试', accent: '#FF5C2B' });
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
        text: `♪ 已导出无损音频 WAV（${res.durationSec.toFixed(1)}s · 与试听及声纹完全一致）`,
        accent: '#7C3AED',
      });
    } catch {
      pushToast({ text: 'WAV 离屏渲染遇到问题，请重试', accent: '#FF5C2B' });
    } finally {
      setExportingWav(false);
    }
  };

  /**
   * FIX #7: Real-duration Motion Card (.webm) with AbortSignal cancellation & clean teardown
   */
  const handleExportMotionCard = async () => {
    if (exportingMotion || !activeSnapshot) return;
    const controller = new AbortController();
    motionAbortRef.current = controller;
    setExportingMotion(true);
    setMotionProgress(0);
    playSfx('click', 0.85);
    try {
      const result = await recordMotionCardWebm({
        title: activeTitle.trim() || '胡同放克',
        code: displayCode,
        rarity: activeRarity,
        foil: activeFoil,
        artId: activeArtId,
        stickers: activeStickers,
        waveformBars,
        snapshot: activeSnapshot,
        signal: controller.signal,
        onProgress: (p) => setMotionProgress(p),
      });
      const safeName = (activeTitle.trim() || 'holobeat-motion')
        .toLowerCase()
        .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-');
      triggerBlobDownload(result.blob, `${safeName}-动态卡.webm`);
      fireHoloConfetti('normal');
      pushToast({
        text: `✦ 已导出完整动态闪卡 WebM（${(result.durationMs / 1000).toFixed(1)}s${
          result.hasAudioTrack ? ' · 含原声音轨' : ' · 纯画面轨'
        }）`,
        accent: '#00D4AA',
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : '动态卡录制失败，请重试';
      pushToast({
        text: msg,
        accent: msg.includes('取消') ? '#FFD60A' : '#FF5C2B',
      });
    } finally {
      motionAbortRef.current = null;
      setExportingMotion(false);
      setMotionProgress(0);
    }
  };

  const handleCancelMotionExport = () => {
    motionAbortRef.current?.abort();
  };

  const handleExportProjectJson = () => {
    playSfx('click', 0.8);
    const payload: HoloBeatProjectFile = inspectedCard
      ? {
          schema: 'holobeat.project.v3',
          exportedAt: Date.now(),
          kind: 'minted-card',
          card: inspectedCard,
        }
      : {
          schema: 'holobeat.project.v3',
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
      text: `✦ 已导出可重混工程文件 ${safeName}.holobeat.json`,
      accent: '#FFD60A',
    });
  };

  const handleImportProjectJson = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      await importProjectFile(parsed);
    } catch {
      pushToast({ text: '读取 .holobeat.json 失败：文件不是合法 JSON，现有作品未受影响', accent: '#FF5C2B' });
    }
  };

  const handleBackendShare = async () => {
    if (!inspectedCard || syncingShare) return;
    setSyncingShare(true);
    playSfx('click', 0.8);
    const res = await syncCardToBackend(inspectedCard, { ancestors: mintedCards });
    setSyncingShare(false);
    if (res.ok && res.share) {
      try {
        await navigator.clipboard.writeText(res.share.shareUrl);
        pushToast({
          text: `✦ 已同步至本地归档并复制只读展页链接：${res.share.shareUrl}`,
          accent: '#00D4AA',
        });
      } catch {
        pushToast({
          text: `✦ 已生成只读展页链接：${res.share.shareUrl}`,
          accent: '#00D4AA',
        });
      }
    } else if (res.ok) {
      pushToast({ text: '✦ 已同步至本地归档服务', accent: '#00D4AA' });
    } else {
      pushToast({ text: res.error ?? '本地归档服务未启动（离线模式正常使用）', accent: '#FFD60A' });
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

  // Determine current 4-stage indicator cleanly
  const activeStage = isInspectMode ? 3 : mintStageIdx !== null ? 2 : 1;

  return (
    <div className="w-full h-full p-3 grid grid-cols-[minmax(280px,28%)_1fr_minmax(272px,28%)] gap-3.5 overflow-hidden">
      <input
        ref={fileInputRef}
        type="file"
        accept=".json,.holobeat.json"
        onChange={(e) => void handleImportProjectJson(e)}
        className="hidden"
      />

      {/* ================= LEFT COLUMN (28%): CUSTOMIZATION CONSOLE OR ARCHIVE INSPECTOR ================= */}
      <section className="flex flex-col gap-2 min-h-0 overflow-y-auto holo-scroll pr-0.5">
        {/* 4-Stage Clear Strip: 声音来源 → 卡面设计 → 压印保存 → 鉴赏导出 */}
        <div className="rounded-xl bg-[#EDE7D9] border-[2px] border-[#1A1A1F] px-2 py-1 grid grid-cols-4 gap-1 shrink-0">
          {['声音来源', '卡面设计', '压印保存', '鉴赏导出'].map((label, idx) => (
            <div
              key={label}
              className={`text-center py-0.5 rounded-lg text-[9.5px] font-black transition-colors whitespace-nowrap ${
                idx === activeStage
                  ? 'bg-[#14151B] text-[#FFD60A]'
                  : idx < activeStage
                    ? 'bg-[#00D4AA]/30 text-[#1A1A1F]'
                    : 'text-[#646474]'
              }`}
            >
              {idx + 1}.{label}
            </div>
          ))}
        </div>

        {/* Persistence Error Recovery Banner (FIX #1) */}
        {lastStorageError && (
          <div
            data-testid="forge-storage-error"
            className="rounded-xl border-[2.5px] border-[#1A1A1F] bg-[#FF5C2B] text-white p-2.5 flex flex-col gap-1.5 shrink-0 shadow-[3px_3px_0px_#1A1A1F]"
          >
            <div className="flex items-center gap-1.5 text-[11px] font-black">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>本地写入失败，草稿已安全保留</span>
            </div>
            <p className="text-[10px] font-bold text-white/90 leading-snug">{lastStorageError}</p>
            <div className="flex items-center gap-1.5">
              <button
                data-testid="forge-retry-mint"
                onClick={() => void handleMint()}
                className="brutal-pad px-2.5 py-1 rounded-lg bg-[#FFD60A] text-[#1A1A1F] text-[10px] font-black"
              >
                重试压印
              </button>
              <button
                onClick={handleExportProjectJson}
                className="brutal-pad px-2.5 py-1 rounded-lg bg-[#FFFDF8] text-[#1A1A1F] text-[10px] font-black"
              >
                导出 JSON 备份
              </button>
            </div>
          </div>
        )}

        {/* Mode Status Bar */}
        <div
          className={`rounded-2xl border-[2.5px] border-[#1A1A1F] px-3 py-1.5 flex items-center justify-between gap-2 shrink-0 shadow-[3px_3px_0px_#1A1A1F] ${
            isInspectMode ? 'bg-[#14151B] text-[#FFFDF8]' : 'bg-[#FFD60A] text-[#1A1A1F]'
          }`}
        >
          <div className="min-w-0">
            <div className="text-xs font-black truncate">
              {isInspectMode
                ? `藏品鉴赏 · ${inspectedCard.code}`
                : `草稿编辑 · 下张编号 ${displayCode}`}
            </div>
          </div>

          {isInspectMode ? (
            <button
              onClick={() => {
                playSfx('tab');
                returnToForgeDraft();
              }}
              className="brutal-pad px-2.5 py-1 rounded-xl bg-[#FFD60A] text-[#1A1A1F] text-[10.5px] font-black flex items-center gap-1 shrink-0 whitespace-nowrap"
            >
              <ArrowLeft className="w-3 h-3" /> 返回草稿
            </button>
          ) : (
            <button
              onClick={() => fileInputRef.current?.click()}
              title="导入 JSON 工程文件"
              className="brutal-pad px-2.5 py-1 rounded-xl bg-[#FFFDF8] text-[#1A1A1F] text-[10.5px] font-black flex items-center gap-1 shrink-0 whitespace-nowrap"
            >
              <FolderOpen className="w-3 h-3" /> 导入工程
            </button>
          )}
        </div>

        {/* Sound Sigil + Real PCM Waveform Specimen Card */}
        {activeSnapshot && (
          <div className="rounded-2xl border-[2.5px] border-[#1A1A1F] shadow-[3px_3px_0px_#1A1A1F] p-2.5 shrink-0 flex items-center gap-2.5 bg-[#14151B] text-[#FFFDF8]">
            <SoundSigil snapshot={activeSnapshot} size={68} />
            <div className="flex-1 min-w-0 flex flex-col gap-1">
              <div className="flex items-center justify-between gap-1">
                <span className="text-[11px] font-black text-[#FFD60A] tracking-wide">
                  声音纹章 · 视觉编码
                </span>
                <span
                  data-testid="forge-pcm-badge"
                  className={`px-1.5 py-0.5 rounded text-[9px] font-black whitespace-nowrap ${
                    isRealPcm ? 'bg-[#00D4AA] text-[#1A1A1F]' : 'bg-white/15 text-white/85'
                  }`}
                >
                  {isRealPcm ? '真实 PCM 声纹' : '渲染提取中...'}
                </span>
              </div>
              <div className="font-mono-hw text-[10.5px] font-bold text-[#FFFDF8]">
                {activeSourceType === 'beat' ? '节拍作品' : '弹珠作品'} · {activeSnapshot.bpm} BPM ·{' '}
                {activeSnapshot.events.length} 音符
              </div>
              <div className="text-[10px] font-bold text-white/65 truncate flex items-center gap-1">
                <GitBranch className="w-3 h-3 text-[#00D4AA] shrink-0" />
                <span>{lineageLabel ?? '原创首发'}</span>
                <span className="ml-auto flex items-center gap-0.5 text-white/45 shrink-0">
                  <HardDrive className="w-2.5 h-2.5" /> 本设备
                </span>
              </div>
            </div>
          </div>
        )}

        {isInspectMode ? (
          /* ================= INSPECT ARCHIVE SPECIMEN CONTROLS ================= */
          <div className="brutal-panel-sm p-3 flex flex-col gap-2.5 shrink-0">
            <div className="flex items-center justify-between">
              <h2 className="text-xs zh-display text-[#1A1A1F]">藏品档案</h2>
              <span className="font-mono-hw text-[10.5px] font-bold text-[#646474]">
                {inspectedCard.code}
              </span>
            </div>

            <p className="text-[11px] font-bold text-[#646474] leading-relaxed">
              此藏品已永久保存至此设备卡册，封存原始音符快照与卡面配置。点击「拆封重混」可载入工作台创作第{' '}
              {inspectedCard.lineageDepth + 1} 代变奏，原藏品保持完好。
            </p>

            <button
              data-testid="forge-unseal-btn"
              onClick={() => {
                playSfx('cartridgeLock');
                unsealAndRemixCard(inspectedCard.id);
              }}
              className="brutal-btn-lg w-full py-2.5 rounded-xl bg-[#7C3AED] text-white text-xs zh-display flex items-center justify-center gap-1.5 whitespace-nowrap"
            >
              <Unlock className="w-4 h-4 shrink-0" />
              <span>拆封重混创作</span>
            </button>

            <div className="grid grid-cols-2 gap-2">
              <button
                data-testid="forge-export-json"
                onClick={handleExportProjectJson}
                className="brutal-btn py-2 px-2 rounded-xl bg-[#FFFDF8] text-[#1A1A1F] text-[11px] font-black flex items-center justify-center gap-1 whitespace-nowrap"
              >
                <FileJson className="w-3.5 h-3.5 text-[#7C3AED] shrink-0" />
                <span>导出工程</span>
              </button>
              <button
                onClick={() => void handleBackendShare()}
                disabled={syncingShare}
                title="可选：若已启动本地归档服务，可同步并生成只读展页链接"
                className="brutal-btn py-2 px-2 rounded-xl bg-[#FFFDF8] text-[#1A1A1F] text-[11px] font-black flex items-center justify-center gap-1 disabled:opacity-50 whitespace-nowrap"
              >
                <Share2 className="w-3.5 h-3.5 text-[#00D4AA] shrink-0" />
                <span>{syncingShare ? '同步中...' : '只读分享'}</span>
              </button>
            </div>

            <div className="mt-1 rounded-xl bg-[#EDE7D9] border-[2px] border-[#1A1A1F]/20 p-2.5 flex flex-col gap-1.5 text-[10.5px]">
              <div className="text-[10px] font-black tracking-wide text-[#646474] border-b border-[#1A1A1F]/12 pb-1">
                作品规格记录（已保存至此设备）
              </div>
              <div className="flex justify-between">
                <span className="text-[#646474] font-bold">作品来源</span>
                <span className="font-black text-[#1A1A1F]">
                  {inspectedCard.sourceType === 'beat' ? '节拍编曲' : '弹珠录制'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#646474] font-bold">箔面稀有</span>
                <span className="font-black text-[#1A1A1F]">
                  {foilMeta.zhLabel} · {inspectedCard.rarity}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#646474] font-bold">调式速度</span>
                <span className="font-mono-hw font-black text-[#1A1A1F]">
                  {SCALE_META[inspectedCard.snapshot.scale].label} · {inspectedCard.snapshot.bpm} BPM
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#646474] font-bold">创作谱系</span>
                <span className="font-black text-[#7C3AED]">
                  {inspectedCard.parentCode
                    ? `${inspectedCard.parentCode} → 第 ${inspectedCard.lineageDepth} 代`
                    : '原创首发'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#646474] font-bold">封存日期</span>
                <span className="font-mono-hw font-bold text-[#1A1A1F]">
                  {new Date(inspectedCard.createdAt).toLocaleDateString('zh-CN')}
                </span>
              </div>
            </div>
          </div>
        ) : (
          /* ================= DRAFT CUSTOMIZATION CONTROLS ================= */
          <>
            {/* Block 1: 声音来源 */}
            <div className="brutal-panel-sm p-2.5 shrink-0">
              <div className="flex items-center justify-between mb-1.5">
                <h2 className="text-[12px] zh-display text-[#1A1A1F]">声音来源</h2>
                <span className="text-[10px] font-bold text-[#646474]">
                  {activeSnapshot ? `${activeSnapshot.bars} 小节 · 快照已冻结` : '待捕获'}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => {
                    playSfx('click', 0.7);
                    setForgeSource('beat');
                  }}
                  className={`brutal-btn px-2.5 py-1.5 rounded-xl text-[11px] font-black whitespace-nowrap ${
                    forgeDraft.sourceType === 'beat'
                      ? 'bg-[#FF5C2B] text-white'
                      : 'bg-[#FFFDF8] text-[#1A1A1F]'
                  }`}
                >
                  捕获节拍
                </button>
                <button
                  onClick={() => {
                    playSfx('click', 0.7);
                    setForgeSource('pinball');
                  }}
                  className={`brutal-btn px-2.5 py-1.5 rounded-xl text-[11px] font-black whitespace-nowrap ${
                    forgeDraft.sourceType === 'pinball'
                      ? 'bg-[#00D4AA] text-[#1A1A1F]'
                      : 'bg-[#FFFDF8] text-[#1A1A1F]'
                  }`}
                >
                  捕获弹珠
                </button>
                <button
                  data-testid="forge-export-json"
                  onClick={handleExportProjectJson}
                  title="导出可重混 .holobeat.json 工程文件"
                  className="brutal-btn ml-auto px-2 py-1.5 rounded-xl bg-[#FFFDF8] text-[10.5px] font-black flex items-center gap-1 whitespace-nowrap"
                >
                  <FileJson className="w-3.5 h-3.5 text-[#7C3AED] shrink-0" />
                  <span>导出工程</span>
                </button>
              </div>
            </div>

            {/* Block 2: 卡片名称 & 稀有度 */}
            <div className="brutal-panel-sm p-2.5 shrink-0">
              <div className="flex items-center justify-between mb-1.5">
                <h2 className="text-[12px] zh-display text-[#1A1A1F]">卡片名称</h2>
                <button
                  onClick={() => {
                    playSfx('click', 0.8);
                    const next =
                      artOptions[(artOptions.indexOf(forgeDraft.artId) + 1) % artOptions.length];
                    setForgeArtId(next);
                  }}
                  title="切换卡面主视觉潮玩角色"
                  className="text-[10px] font-black px-2 py-0.5 rounded-full bg-[#EDE7D9] border-[1.5px] border-[#1A1A1F] hover:bg-[#FFD60A] cursor-pointer flex items-center gap-1 transition-colors whitespace-nowrap"
                >
                  <Sparkles className="w-3 h-3 shrink-0" /> 换主角插画
                </button>
              </div>
              <input
                data-testid="forge-title-input"
                type="text"
                value={forgeDraft.title}
                onChange={(e) => setForgeTitle(e.target.value)}
                maxLength={18}
                placeholder="胡同放克"
                className="w-full px-3 py-1.5 rounded-xl bg-[#FFFDF8] border-[2.5px] border-[#1A1A1F] text-[13.5px] font-black tracking-wide text-[#1A1A1F] focus:outline-none focus:ring-2 focus:ring-[#7C3AED]"
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
                      className={`brutal-pad py-1 rounded-xl text-[11px] font-black tracking-wider whitespace-nowrap ${
                        active
                          ? rar === 'UR'
                            ? 'bg-[#FF3D9A] text-white ring-2 ring-[#FFD60A]'
                            : rar === 'SSR'
                              ? 'bg-[#FFD60A] text-[#1A1A1F]'
                              : 'bg-[#14151B] text-[#FFD60A] ring-1 ring-[#FFD60A]'
                          : 'bg-[#FFFDF8] text-[#1A1A1F]'
                      }`}
                    >
                      {rar === 'UR' ? '✦ UR ✦' : rar === 'LTD' ? '◆ LTD' : '★ SSR'}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Block 3: 全息材质 (5) */}
            <div className="brutal-panel-sm p-2.5 shrink-0">
              <div className="flex items-center justify-between mb-1.5">
                <h2 className="text-[12px] zh-display text-[#1A1A1F]">全息材质 (5)</h2>
                <span className="text-[10.5px] font-bold text-[#646474]">{foilMeta.zhLabel}</span>
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
                          ? 'bg-[#FFD60A] border-[#1A1A1F] shadow-[2px_2px_0px_0px_#1A1A1F] -translate-y-0.5'
                          : 'bg-transparent border-transparent hover:bg-[#EDE7D9]'
                      }`}
                    >
                      <span
                        className="w-full aspect-square rounded-lg border-[2px] border-[#1A1A1F] block"
                        style={{ background: f.swatchStyle }}
                      />
                      <span className="text-[9.5px] font-black text-[#1A1A1F] leading-none whitespace-nowrap">
                        {f.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Block 4: 卡面贴纸 (12 市井主题哑光贴纸) */}
            <div className="brutal-panel-sm p-2.5 flex flex-col gap-1.5 shrink-0">
              <div className="flex items-center justify-between">
                <h2 className="text-[12px] zh-display text-[#1A1A1F]">市井贴纸 ({STICKER_PACK.length})</h2>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => {
                      playSfx('click', 0.4);
                      undoForgeStickers();
                    }}
                    disabled={stickerUndoCount === 0}
                    title="撤销贴纸"
                    className="brutal-pad p-1 rounded-lg bg-[#FFFDF8] disabled:opacity-35"
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
                    className="brutal-pad p-1 rounded-lg bg-[#FFFDF8] disabled:opacity-35"
                  >
                    <Redo2 className="w-3 h-3" />
                  </button>
                  {forgeDraft.stickers.length > 0 && (
                    <button
                      onClick={() => {
                        playSfx('click', 0.25);
                        clearForgeStickers();
                      }}
                      className="text-[10px] font-black px-1.5 py-0.5 rounded-lg bg-[#FFFDF8] border-[1.5px] border-[#1A1A1F] hover:bg-[#FF5C2B] hover:text-white flex items-center gap-0.5 cursor-pointer whitespace-nowrap"
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
                    data-testid={`forge-sticker-${stk.id}`}
                    onClick={() => {
                      playSfx('cartridgeLock');
                      addForgeSticker(stk.id);
                    }}
                    title={`添加「${stk.zhLabel}」贴纸`}
                    className="brutal-pad h-[46px] rounded-xl bg-[#FFFDF8] hover:bg-[#FEF9C3] p-1 flex items-center justify-center group"
                  >
                    <img
                      src={stk.rasterUrl}
                      alt={stk.zhLabel}
                      draggable={false}
                      decoding="async"
                      className="w-9 h-9 object-contain drop-shadow-[0_1.5px_2px_rgba(26,26,31,0.25)] group-hover:scale-110 transition-transform duration-150"
                    />
                  </button>
                ))}
              </div>
              <p className="text-[9.5px] font-bold text-[#646474] text-center leading-tight">
                拖拽吸附中线 · 点选置顶/缩放/旋转 · 双击移除（改贴纸会生成新版本）
              </p>
            </div>
          </>
        )}
      </section>

      {/* ================= CENTER COLUMN (44%): HOLO CARD FORGE PRESS ================= */}
      <section className="flex flex-col gap-2 min-h-0">
        <div
          data-testid="forge-stage-container"
          className={`brutal-oled relative flex-1 flex flex-col items-center justify-between p-3 overflow-hidden min-h-0 transition-shadow duration-300 ${
            mintStageIdx !== null ? 'ring-4 ring-[#FFD60A]' : ''
          }`}
          style={{
            backgroundImage:
              'radial-gradient(circle at 50% 48%, rgba(255, 214, 10, 0.08) 0%, transparent 62%), linear-gradient(to right, rgba(255,214,10,0.05) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,214,10,0.05) 1px, transparent 1px)',
            backgroundSize: '100% 100%, 26px 26px, 26px 26px',
          }}
        >
          {/* Top Coordinate Strip + Card Flip */}
          <div className="w-full flex items-center justify-between text-white/65 text-[11px] font-bold tracking-wide shrink-0 z-10">
            <span className="font-mono-hw whitespace-nowrap">
              {isInspectMode ? '藏品赏析' : '压印预览'} · {displayCode}
            </span>
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-[#FFD60A] font-bold whitespace-nowrap">
                {activeRarity} · {foilMeta.zhLabel}
              </span>
              <button
                onClick={() => {
                  playSfx('cardFlip');
                  setFlippedCard((f) => !f);
                }}
                title="翻转查看卡背声音纹章与创作谱系"
                className="px-2 py-0.5 rounded-lg bg-white/10 hover:bg-[#FFD60A] hover:text-[#1A1A1F] text-white text-[10px] font-black cursor-pointer flex items-center gap-1 transition-colors whitespace-nowrap"
              >
                <RotateCcw className="w-3 h-3 shrink-0" /> {flippedCard ? '看正面' : '翻看卡背'}
              </button>
            </div>
          </div>

          {/* ResizeObserver-Driven Hero Card Slot */}
          <div
            ref={heroStageRef}
            data-testid="forge-hero-card-wrap"
            className="w-full flex-1 flex items-center justify-center relative z-10 py-1 min-h-0"
          >
            <HoloCard
              title={activeTitle.trim() || '胡同放克'}
              code={displayCode}
              rarity={activeRarity}
              specLabel={activeSourceType === 'beat' ? '节拍作品' : '弹珠作品'}
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

            {/* Persistence-Gated Mint Ceremony Overlay */}
            {mintStageIdx !== null && (
              <div
                key={mintCeremonyKey}
                className="absolute inset-0 z-40 pointer-events-none flex items-center justify-center overflow-hidden rounded-2xl bg-[#14151B]/35"
              >
                <div className="absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-transparent via-[#00D4AA]/75 to-transparent shadow-[0_0_28px_#00D4AA] animate-forge-laser" />
                <div className="px-5 py-3 rounded-2xl bg-[#14151B]/95 border-[3px] border-[#FFD60A] shadow-[0_0_32px_rgba(255,214,10,0.7)] animate-forge-stamp text-center">
                  <div className="text-[10.5px] font-bold text-[#00D4AA] tracking-widest mb-1">
                    全息压印仪式
                  </div>
                  <div className="zh-display text-base text-[#FFD60A] whitespace-nowrap">
                    {MINT_STAGES[mintStageIdx]}
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="w-full flex items-center justify-center text-white/50 text-[10px] font-bold tracking-wider shrink-0 z-10">
            <span>试听与 WAV 导出同源 · 1200×1600 展板海报 · 完整时长动态卡 WebM</span>
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
              className="brutal-btn-lg w-full py-2.5 rounded-2xl bg-[#7C3AED] text-white text-[16px] zh-display flex items-center justify-center gap-2 whitespace-nowrap"
            >
              <Unlock className="w-5 h-5 shrink-0" strokeWidth={2.6} />
              <span>拆封进入再创作</span>
            </button>
          ) : (
            <button
              data-testid="forge-mint-btn"
              onClick={() => void handleMint()}
              disabled={mintInFlight || mintStageIdx !== null}
              className="brutal-btn-lg w-full py-2.5 rounded-2xl bg-[#FF5C2B] text-white text-[16px] zh-display flex items-center justify-center gap-2 disabled:opacity-65 whitespace-nowrap"
            >
              <Stamp className="w-5 h-5 shrink-0" strokeWidth={2.8} />
              <span>{mintStageIdx !== null ? MINT_STAGES[mintStageIdx] : '压印入册'}</span>
            </button>
          )}

          <div className="grid grid-cols-4 gap-1.5">
            <button
              data-testid="forge-export-png"
              onClick={() => void handleExportPng()}
              disabled={exportingPng}
              className="brutal-btn py-2 px-1.5 rounded-xl bg-[#00D4AA] text-[#1A1A1F] text-[11px] font-black flex items-center justify-center gap-1 disabled:opacity-60 whitespace-nowrap"
            >
              <Download className="w-3.5 h-3.5 shrink-0" strokeWidth={2.8} />
              <span>{exportingPng ? '导出中...' : 'PNG 海报'}</span>
            </button>

            <button
              data-testid="forge-export-wav"
              onClick={() => void handleExportWav()}
              disabled={exportingWav}
              className="brutal-btn py-2 px-1.5 rounded-xl bg-[#7C3AED] text-white text-[11px] font-black flex items-center justify-center gap-1 disabled:opacity-60 whitespace-nowrap"
            >
              <Music className="w-3.5 h-3.5 shrink-0" strokeWidth={2.8} />
              <span>{exportingWav ? '渲染中...' : 'WAV 音频'}</span>
            </button>

            {exportingMotion ? (
              <button
                data-testid="forge-cancel-motion"
                onClick={handleCancelMotionExport}
                title="取消正在录制的动态卡"
                className="brutal-btn py-2 px-1.5 rounded-xl bg-[#FF5C2B] text-white text-[11px] font-black flex items-center justify-center gap-1 whitespace-nowrap"
              >
                <X className="w-3.5 h-3.5 shrink-0" strokeWidth={2.8} />
                <span>取消 {motionProgress}%</span>
              </button>
            ) : (
              <button
                data-testid="forge-export-motion"
                onClick={() => void handleExportMotionCard()}
                title="按真实作品时长录制含原声动态卡 WebM"
                className="brutal-btn py-2 px-1.5 rounded-xl bg-[#14151B] text-[#FFD60A] text-[11px] font-black flex items-center justify-center gap-1 whitespace-nowrap"
              >
                <Film className="w-3.5 h-3.5 shrink-0" strokeWidth={2.6} />
                <span>动态卡 WebM</span>
              </button>
            )}

            <button
              data-testid="forge-play-btn"
              onClick={() => void handleTogglePlay()}
              className={`brutal-btn py-2 px-1.5 rounded-xl text-[11px] font-black flex items-center justify-center gap-1 whitespace-nowrap ${
                isPlayingSnapshot ? 'bg-[#FFD60A] text-[#1A1A1F]' : 'bg-[#FFFDF8] text-[#1A1A1F]'
              }`}
            >
              {isPlayingSnapshot ? (
                <>
                  <Pause className="w-3.5 h-3.5 fill-current shrink-0" /> 停止
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 fill-current shrink-0" /> 原声试听
                </>
              )}
            </button>
          </div>
        </div>
      </section>

      {/* ================= RIGHT COLUMN (28%): CALM MATTE COLLECTOR BINDER ================= */}
      <section className="brutal-panel p-3 flex flex-col gap-2 min-h-0 overflow-hidden">
        <div className="shrink-0">
          <div className="flex items-center justify-between mb-1.5">
            <h2 className="text-[15.5px] zh-display text-[#1A1A1F] leading-none">我的卡册</h2>
            <span className="font-mono-hw text-[11px] font-bold text-[#646474]">
              已存本设备 · {binderItems.length} 张
            </span>
          </div>

          <div className="grid grid-cols-3 gap-1.5">
            {(
              [
                { id: 'ALL' as const, label: '全部' },
                { id: 'MINTED' as const, label: '自制' },
                { id: 'GACHA' as const, label: '声源' },
              ] as const
            ).map((tab) => {
              const active = binderFilter === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => {
                    playSfx('click', 0.6);
                    setBinderFilter(tab.id);
                  }}
                  className={`brutal-pad py-1 rounded-xl text-[11px] font-black whitespace-nowrap ${
                    active ? 'bg-[#FFD60A] text-[#1A1A1F]' : 'bg-[#FFFDF8] text-[#1A1A1F]'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Calm Matte Binder Sleeve with bottom scroll-fade hint */}
        <div className="relative flex-1 min-h-0 rounded-2xl bg-[#EDE7D9] border-[2.5px] border-[#1A1A1F] overflow-hidden shadow-[inset_0_2px_6px_rgba(0,0,0,0.08)]">
          <div className="h-full p-2 pb-7 overflow-y-auto holo-scroll">
            <div className="grid grid-cols-2 gap-2">
              {binderItems.map((item) => {
                const rar = RARITY_META[item.rarity];
                const isSelected =
                  (item.kind === 'minted' && inspectMintedId === item.id) ||
                  (item.kind === 'gacha' &&
                    inspectMintedId === null &&
                    forgeDraft.artId === item.artId);
                const isFreshArrival = item.kind === 'minted' && lastMintedCardId === item.id;

                return (
                  <div
                    key={`${item.kind}-${item.id}`}
                    data-testid={`binder-item-${item.kind}-${item.id}`}
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
                    className={`group relative rounded-xl p-1.5 bg-[#FFFDF8] border-[2px] border-[#1A1A1F]/18 cursor-pointer transition-transform hover:-translate-y-0.5 ${
                      isSelected ? 'ring-[2.5px] ring-[#FF5C2B] border-[#1A1A1F]' : ''
                    } ${isFreshArrival ? 'animate-binder-arrive' : ''}`}
                  >
                    {/* Calm matte frame so binder thumbnails never overpower center Hero Card */}
                    <div className="relative aspect-[5/6.2] rounded-[9px] border-[2px] border-[#1A1A1F] overflow-hidden bg-[#14151B] flex flex-col shadow-[2px_2px_0px_0px_#1A1A1F]">
                      <div className="relative flex-1 overflow-hidden">
                        <CardArtwork artId={item.artId} />
                        <span
                          className="absolute top-1 left-1 px-1.5 py-[0.5px] rounded text-[8px] font-black border border-[#1A1A1F]"
                          style={{ backgroundColor: rar.bg, color: rar.text }}
                        >
                          {rar.label}
                        </span>
                        {item.isDemo && (
                          <span className="absolute bottom-1 left-1 px-1.5 py-[0.5px] rounded bg-[#14151B]/90 text-[#FFD60A] text-[8.5px] font-black border border-[#FFD60A]/60">
                            示例
                          </span>
                        )}
                        {item.lineageDepth > 0 && (
                          <span className="absolute bottom-1 left-1 px-1.5 py-[0.5px] rounded bg-[#7C3AED]/95 text-white text-[8.5px] font-black">
                            第{item.lineageDepth}代
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
                                className="p-1 rounded-md bg-[#14151B]/90 text-[#FF5C2B] hover:bg-[#FF5C2B] hover:text-white cursor-pointer"
                              >
                                <Trash2 className="w-2.5 h-2.5" />
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                      <div
                        className={`border-t-[1.5px] border-[#1A1A1F] py-0.5 px-1 text-center ${
                          item.rarity === 'LTD'
                            ? 'bg-[#14151B] text-[#FFD60A]'
                            : 'bg-[#FFFDF8] text-[#1A1A1F]'
                        }`}
                      >
                        <span className="block text-[9.5px] font-black truncate">
                          {item.shortTitle}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Bottom soft scroll-fade hint so the last row never looks abruptly clipped */}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-7 bg-gradient-to-t from-[#EDE7D9] via-[#EDE7D9]/80 to-transparent flex items-end justify-center pb-0.5">
            <span className="text-[9px] font-bold text-[#646474]/75">向下滚动浏览更多藏品</span>
          </div>
        </div>
      </section>
    </div>
  );
};
