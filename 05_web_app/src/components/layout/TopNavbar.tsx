import React, { useEffect, useRef } from 'react';
import { Layers, Sparkles, Volume2, VolumeX } from 'lucide-react';
import { holoAudio } from '../../audio/HoloAudioEngine';
import { useHoloSfx } from '../../audio/useHoloSfx';
import { SOUND_CARDS } from '../../data/soundCards';
import { useHoloStore } from '../../store/useHoloStore';
import type { PageId } from '../../types/holo';
import { OnboardingRibbon } from '../ui/OnboardingRibbon';

const NAV_TABS: {
  id: PageId;
  num: string;
  zhLabel: string;
  activeBg: string;
  activeText: string;
  dotColor: string;
}[] = [
  { id: 'gacha', num: '01', zhLabel: '声卡盲盒', activeBg: '#7C3AED', activeText: '#FFFFFF', dotColor: '#FFD60A' },
  { id: 'beat', num: '02', zhLabel: '插卡编曲', activeBg: '#FF5C2B', activeText: '#FFFFFF', dotColor: '#FFD60A' },
  { id: 'pinball', num: '03', zhLabel: '弹珠剧场', activeBg: '#00D4AA', activeText: '#1A1A1F', dotColor: '#1A1A1F' },
  { id: 'forge', num: '04', zhLabel: '闪卡铸造', activeBg: '#FFD60A', activeText: '#1A1A1F', dotColor: '#FF5C2B' },
];

const QUICK_BPMS = [92, 116, 126, 140];

export const TopNavbar: React.FC = () => {
  const activePage = useHoloStore((s) => s.activePage);
  const setActivePage = useHoloStore((s) => s.setActivePage);
  const audioUnlocked = useHoloStore((s) => s.audioUnlocked);
  const collectionCount = useHoloStore((s) => s.collection.length);
  const bpm = useHoloStore((s) => s.bpm);
  const setBpm = useHoloStore((s) => s.setBpm);
  const muted = useHoloStore((s) => s.muted);
  const toggleMute = useHoloStore((s) => s.toggleMute);
  const reducedMotion = useHoloStore((s) => s.reducedMotion);
  const setReducedMotion = useHoloStore((s) => s.setReducedMotion);
  const isPlaying = useHoloStore((s) => s.isPlaying);
  const setDrawerOpen = useHoloStore((s) => s.setDrawerOpen);
  const playSfx = useHoloSfx();

  const barsRef = useRef<(HTMLSpanElement | null)[]>([]);

  useEffect(() => {
    let raf = 0;
    const heights = [0.24, 0.42, 0.58, 0.74, 0.92];
    const render = (t: number) => {
      const level = holoAudio.getMeterLevel();
      const playing = useHoloStore.getState().isPlaying;
      const isMuted = useHoloStore.getState().muted;
      const reduced = useHoloStore.getState().reducedMotion;

      barsRef.current.forEach((bar, idx) => {
        if (!bar) return;
        let h = heights[idx];
        if (isMuted) {
          h = 0.14;
        } else if (level > 0.03) {
          const jitter = reduced ? 0.2 : Math.abs(Math.sin(t * 0.015 + idx * 1.4));
          h = Math.min(1, Math.max(0.22, level * 0.96 + jitter * 0.34));
        } else if (playing) {
          h = reduced ? 0.55 : 0.25 + Math.abs(Math.sin(t * 0.01 + idx * 0.9)) * 0.72;
        } else {
          h = reduced
            ? heights[idx] * 0.65
            : heights[idx] * (0.72 + Math.sin(t * 0.0028 + idx * 0.75) * 0.18);
        }
        bar.style.transform = `scaleY(${h.toFixed(2)})`;
      });
      raf = requestAnimationFrame(render);
    };
    raf = requestAnimationFrame(render);
    return () => cancelAnimationFrame(raf);
  }, []);

  const cycleQuickBpm = () => {
    const nextIdx = (QUICK_BPMS.indexOf(bpm) + 1) % QUICK_BPMS.length;
    const nextBpm = QUICK_BPMS[nextIdx] ?? 116;
    setBpm(nextBpm);
    holoAudio.syncFromStore();
    playSfx('click', 0.7);
  };

  return (
    <header className="h-[62px] w-full bg-[#FFFDF8] border-b-[2.5px] border-[#1A1A1F] shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_2px_0_rgba(26,26,31,0.06)] px-4 flex items-center justify-between gap-3 shrink-0 z-40 select-none">
      {/* Brand + Creative Loop Progress */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => {
            playSfx('tab');
            setActivePage('gacha');
          }}
          className="flex items-center gap-2.5 group cursor-pointer"
          title="回到 01 声卡盲盒 · 声卡造物局"
        >
          <div className="relative w-7 h-9 rounded-[6px] border-[2px] border-[#1A1A1F] shadow-[2px_2px_0px_0px_#1A1A1F] rotate-[8deg] group-hover:rotate-[2deg] group-hover:scale-105 transition-transform duration-200 overflow-hidden holo-shine-border flex items-center justify-center">
            <svg viewBox="0 0 24 24" className="w-4 h-4 drop-shadow-[0_1px_1px_rgba(0,0,0,0.45)]">
              <path
                d="M12 2 L14.4 9.6 L22 12 L14.4 14.4 L12 22 L9.6 14.4 L2 12 L9.6 9.6 Z"
                fill="#FFFDF8"
                stroke="#1A1A1F"
                strokeWidth="1.4"
              />
            </svg>
          </div>
          <div className="flex flex-col items-start">
            <span className="text-[19px] zh-display tracking-tight leading-none text-[#1A1A1F]">
              HOLOBEAT
            </span>
            <span className="text-[11px] font-bold tracking-[0.1em] text-[#5E5E6E] mt-0.5 leading-none">
              声卡造物局
            </span>
          </div>
        </button>

        <div className="h-6 w-[1.5px] bg-[#1A1A1F]/16 hidden lg:block" />
        <OnboardingRibbon />
      </div>

      {/* 4-Workbench Primary Navigation Rail */}
      <nav
        aria-label="主工作台切换"
        className="flex items-center gap-1.5 bg-[#EDE7D9] border-[2.5px] border-[#1A1A1F] rounded-2xl p-1 shadow-[inset_0_2px_4px_rgba(26,26,31,0.1)]"
      >
        {NAV_TABS.map((tab) => {
          const isActive = activePage === tab.id;
          return (
            <button
              key={tab.id}
              data-testid={`nav-${tab.id}`}
              aria-current={isActive ? 'page' : undefined}
              onClick={() => {
                playSfx('tab');
                setActivePage(tab.id);
              }}
              title={`${tab.num} ${tab.zhLabel}`}
              style={{
                backgroundColor: isActive ? tab.activeBg : '#FFFDF8',
                color: isActive ? tab.activeText : '#1A1A1F',
              }}
              className={`px-3.5 py-1.5 rounded-xl border-[2px] border-[#1A1A1F] text-[14px] transition-all duration-150 cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                isActive
                  ? 'shadow-[2px_2px_0px_0px_#1A1A1F] -translate-y-[1px] zh-heading'
                  : 'hover:bg-[#F7F3E9] shadow-[1px_1px_0px_0px_rgba(26,26,31,0.16)] font-bold'
              }`}
            >
              {isActive && (
                <span
                  className="w-1.5 h-1.5 rounded-full shrink-0 animate-led-soft"
                  style={{ backgroundColor: tab.dotColor }}
                />
              )}
              <span className="font-mono-hw text-[11px] opacity-75">{tab.num}</span>
              <span>{tab.zhLabel}</span>
            </button>
          );
        })}
      </nav>

      {/* Right Utility Controls: Collection, BPM, Reduced Motion, Mute */}
      <div className="flex items-center gap-2">
        <button
          data-testid="open-deck-drawer"
          onClick={() => {
            playSfx('click', 0.6);
            setDrawerOpen(true);
          }}
          title="展开全息声卡图鉴抽屉"
          className="brutal-btn h-[36px] px-2.5 rounded-xl bg-[#FFFDF8] flex items-center gap-1.5 font-mono-hw text-[13px] font-bold text-[#1A1A1F]"
        >
          <Layers className="w-3.5 h-3.5 text-[#7C3AED]" strokeWidth={2.5} />
          <span>{String(collectionCount).padStart(2, '0')}</span>
          <span className="text-[#5E5E6E]">/{SOUND_CARDS.length}</span>
        </button>

        <button
          onClick={cycleQuickBpm}
          title="点击快速切换全局 BPM (92 / 116 / 126 / 140)"
          className="h-[36px] px-3 rounded-xl bg-[#14151B] border-[2px] border-[#1A1A1F] shadow-[inset_0_2px_5px_rgba(0,0,0,0.6),2px_2px_0px_0px_#1A1A1F] flex items-center gap-2 cursor-pointer hover:brightness-110 transition-all"
        >
          <span
            className={`w-2 h-2 rounded-full shrink-0 ${
              muted
                ? 'bg-[#FF5C2B]'
                : audioUnlocked
                  ? 'bg-[#00D4AA] shadow-[0_0_6px_#00D4AA]'
                  : 'bg-[#FFD60A] animate-led-soft'
            }`}
          />
          <span className="font-mono-hw text-[12.5px] font-bold text-[#FFFDF8] tracking-wide whitespace-nowrap">
            BPM {bpm}
          </span>
          <div className="flex items-end gap-[2.5px] h-[15px]">
            {[0, 1, 2, 3, 4].map((idx) => (
              <span
                key={idx}
                ref={(el) => {
                  barsRef.current[idx] = el;
                }}
                style={{ transformOrigin: 'bottom center' }}
                className={`w-[4px] h-full rounded-[1.5px] transition-transform duration-75 ${
                  muted ? 'bg-white/25' : 'bg-[#00D4AA]'
                }`}
              />
            ))}
          </div>
        </button>

        {/* Reduced Motion Accessibility Toggle */}
        <button
          data-testid="toggle-reduced-motion"
          aria-pressed={reducedMotion}
          onClick={() => {
            playSfx('click', 0.5);
            setReducedMotion(!reducedMotion);
          }}
          title={reducedMotion ? '当前为精简动效模式，点击恢复完整动效' : '切换精简动效模式（保留关键节奏与状态反馈）'}
          className={`brutal-btn h-[36px] px-2.5 rounded-xl flex items-center gap-1 text-[12px] font-bold whitespace-nowrap ${
            reducedMotion ? 'bg-[#FFD60A] text-[#1A1A1F]' : 'bg-[#FFFDF8] text-[#5E5E6E]'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5 shrink-0" strokeWidth={2.4} />
          <span className="hidden 2xl:inline">{reducedMotion ? '精简中' : '精简动效'}</span>
        </button>

        <button
          data-testid="global-mute-btn"
          onClick={() => {
            toggleMute();
            holoAudio.syncFromStore();
            if (muted) playSfx('click', 0.85);
          }}
          aria-label={muted ? '取消静音' : '全局静音'}
          title={muted ? '当前已静音，点击恢复声音' : '点击一键全局静音'}
          className={`brutal-btn w-[36px] h-[36px] rounded-xl flex items-center justify-center ${
            muted ? 'bg-[#FF5C2B] text-white' : 'bg-[#FFFDF8] text-[#1A1A1F]'
          }`}
        >
          {muted ? (
            <VolumeX className="w-4.5 h-4.5" strokeWidth={2.6} />
          ) : (
            <Volume2 className="w-4.5 h-4.5" strokeWidth={2.6} />
          )}
        </button>
      </div>
    </header>
  );
};
