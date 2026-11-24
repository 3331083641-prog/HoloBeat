import React, { useEffect, useRef } from 'react';
import { Layers, Volume2, VolumeX } from 'lucide-react';
import { holoAudio } from '../../audio/HoloAudioEngine';
import { useHoloSfx } from '../../audio/useHoloSfx';
import { SOUND_CARDS } from '../../data/soundCards';
import { useHoloStore } from '../../store/useHoloStore';
import type { PageId } from '../../types/holo';

const NAV_TABS: {
  id: PageId;
  num: string;
  label: string;
  zhLabel: string;
  activeBg: string;
  activeText: string;
  dotColor: string;
}[] = [
  { id: 'gacha', num: '01', label: 'GACHA', zhLabel: '盲盒抽卡', activeBg: '#7C3AED', activeText: '#FFFFFF', dotColor: '#FFD426' },
  { id: 'beat', num: '02', label: 'BEAT', zhLabel: '插卡节拍', activeBg: '#FF5526', activeText: '#FFFFFF', dotColor: '#FFD426' },
  { id: 'pinball', num: '03', label: 'PINBALL', zhLabel: '物理弹珠', activeBg: '#00D4AA', activeText: '#17171C', dotColor: '#17171C' },
  { id: 'forge', num: '04', label: 'FORGE', zhLabel: '闪卡铸造', activeBg: '#FFD426', activeText: '#17171C', dotColor: '#FF5526' },
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
  const isPlaying = useHoloStore((s) => s.isPlaying);
  const setDrawerOpen = useHoloStore((s) => s.setDrawerOpen);
  const playSfx = useHoloSfx();

  const barsRef = useRef<(HTMLSpanElement | null)[]>([]);

  // Live 5-bar Mint Cyan OLED equalizer synced to real Tone.js output
  useEffect(() => {
    let raf = 0;
    const heights = [0.24, 0.42, 0.58, 0.74, 0.92];
    const render = (t: number) => {
      const level = holoAudio.getMeterLevel();
      const playing = useHoloStore.getState().isPlaying;
      const isMuted = useHoloStore.getState().muted;

      barsRef.current.forEach((bar, idx) => {
        if (!bar) return;
        let h = heights[idx];
        if (isMuted) {
          h = 0.14;
        } else if (level > 0.03) {
          const jitter = Math.abs(Math.sin(t * 0.015 + idx * 1.4));
          h = Math.min(1, Math.max(0.22, level * 0.96 + jitter * 0.34));
        } else if (playing) {
          h = 0.25 + Math.abs(Math.sin(t * 0.01 + idx * 0.9)) * 0.72;
        } else {
          h = heights[idx] * (0.72 + Math.sin(t * 0.0028 + idx * 0.75) * 0.18);
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
    <header className="h-[60px] w-full bg-[#FBF9F4] border-b-[2.5px] border-[#17171C] shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_2px_0_rgba(23,23,28,0.06)] px-4 flex items-center justify-between gap-3 shrink-0 z-40 select-none">
      {/* Left: Tilted Mini Holographic Card Logo + HOLOBEAT Hardware Silkscreen */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => {
            playSfx('tab');
            setActivePage('gacha');
          }}
          className="flex items-center gap-2.5 group cursor-pointer"
          title="回到 01 盲盒抽卡机 · 声卡造物局"
        >
          <div className="relative w-7 h-9 rounded-[6px] border-[2.5px] border-[#17171C] shadow-[2px_2px_0px_0px_#17171C] rotate-[10deg] group-hover:rotate-[3deg] group-hover:scale-105 transition-transform duration-200 overflow-hidden holo-shine-border flex items-center justify-center">
            <svg viewBox="0 0 24 24" className="w-4 h-4 drop-shadow-[0_1px_1px_rgba(0,0,0,0.45)]">
              <path
                d="M12 2 L14.4 9.6 L22 12 L14.4 14.4 L12 22 L9.6 14.4 L2 12 L9.6 9.6 Z"
                fill="#FBF9F4"
                stroke="#17171C"
                strokeWidth="1.4"
              />
            </svg>
          </div>
          <div className="flex flex-col items-start">
            <span className="text-[20px] font-black tracking-tight leading-none text-[#17171C]">
              HOLOBEAT
            </span>
            <span className="hw-silkscreen !text-[8.5px] mt-0.5 leading-none">
              HB-04 · 声卡造物局
            </span>
          </div>
        </button>

        <div className="h-6 w-[1.5px] bg-[#17171C]/18 hidden lg:block" />
      </div>

      {/* Center: Recessed Hardware 4-Module Segmented Rail */}
      <nav
        aria-label="主工作台切换"
        className="flex items-center gap-1.5 bg-[#E7E1D3] border-[2.5px] border-[#17171C] rounded-2xl p-1 shadow-[inset_0_2px_4px_rgba(23,23,28,0.12)]"
      >
        {NAV_TABS.map((tab) => {
          const isActive = activePage === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => {
                playSfx('tab');
                setActivePage(tab.id);
              }}
              title={`${tab.num} ${tab.zhLabel}`}
              style={{
                backgroundColor: isActive ? tab.activeBg : '#FBF9F4',
                color: isActive ? tab.activeText : '#17171C',
              }}
              className={`px-3 py-1.5 rounded-xl border-[2px] border-[#17171C] text-[12.5px] font-black tracking-wide transition-all duration-150 cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                isActive
                  ? 'shadow-[2px_2px_0px_0px_#17171C] -translate-y-[1px]'
                  : 'hover:bg-[#F3EFE6] shadow-[1px_1px_0px_0px_rgba(23,23,28,0.2)]'
              }`}
            >
              {isActive && (
                <span
                  className="w-1.5 h-1.5 rounded-full shrink-0 animate-led-soft"
                  style={{ backgroundColor: tab.dotColor }}
                />
              )}
              <span className="font-mono-hw text-[11px] opacity-75">{tab.num}</span>
              <span>{tab.label}</span>
              <span className="hidden xl:inline text-[10px] font-bold opacity-75 ml-0.5">
                {tab.zhLabel}
              </span>
            </button>
          );
        })}
      </nav>

      {/* Right: Deck Drawer Pill + OLED BPM/DSP Status + Mute Button */}
      <div className="flex items-center gap-2">
        <div className="h-6 w-[1.5px] bg-[#17171C]/18 hidden lg:block" />

        {/* Collection Counter Pill */}
        <button
          onClick={() => {
            playSfx('click', 0.6);
            setDrawerOpen(true);
          }}
          title="展开全局声卡图鉴抽屉"
          className="brutal-btn h-[36px] px-2.5 rounded-xl bg-[#FBF9F4] flex items-center gap-1.5 font-mono-hw text-[13px] font-black text-[#17171C]"
        >
          <Layers className="w-3.5 h-3.5 text-[#7C3AED]" strokeWidth={2.6} />
          <span>{String(collectionCount).padStart(2, '0')}</span>
          <span className="text-[#626272]">/{SOUND_CARDS.length}</span>
        </button>

        {/* Recessed Obsidian OLED BPM + Audio DSP LED + 5 Mint EQ Bars */}
        <button
          onClick={cycleQuickBpm}
          title="点击快速切换全局 BPM (92 / 116 / 126 / 140)"
          className="h-[36px] px-3 rounded-xl bg-[#14151B] border-[2.5px] border-[#17171C] shadow-[inset_0_2px_5px_rgba(0,0,0,0.6),2px_2px_0px_0px_#17171C] flex items-center gap-2 cursor-pointer hover:brightness-115 transition-all"
        >
          <span
            className={`w-2 h-2 rounded-full shrink-0 ${
              muted
                ? 'bg-[#FF5526]'
                : audioUnlocked
                  ? 'bg-[#00D4AA] shadow-[0_0_6px_#00D4AA]'
                  : 'bg-[#FFD426] animate-led-soft'
            }`}
            title={muted ? '已静音' : audioUnlocked ? 'DSP 音频引擎在线' : '音频引擎待机'}
          />
          <span className="font-mono-hw text-[12.5px] font-bold text-[#FBF9F4] tracking-wide whitespace-nowrap">
            BPM {bpm}
          </span>
          <div className="flex items-end gap-[2.5px] h-[16px]">
            {[0, 1, 2, 3, 4].map((idx) => (
              <span
                key={idx}
                ref={(el) => {
                  barsRef.current[idx] = el;
                }}
                style={{ transformOrigin: 'bottom center' }}
                className={`w-[4.5px] h-full rounded-[1.5px] transition-transform duration-75 ${
                  muted
                    ? 'bg-white/25'
                    : isPlaying
                      ? 'bg-[#00D4AA] shadow-[0_0_6px_#00D4AA]'
                      : 'bg-[#00D4AA]/90'
                }`}
              />
            ))}
          </div>
        </button>

        {/* Tactile Speaker Mute Switch */}
        <button
          onClick={() => {
            toggleMute();
            holoAudio.syncFromStore();
            if (muted) playSfx('click', 0.85);
          }}
          aria-label={muted ? '取消静音' : '全局静音'}
          title={muted ? '当前已静音，点击恢复声音' : '点击一键全局静音'}
          className={`brutal-btn w-[36px] h-[36px] rounded-xl flex items-center justify-center ${
            muted ? 'bg-[#FF5526] text-white' : 'bg-[#FBF9F4] text-[#17171C]'
          }`}
        >
          {muted ? (
            <VolumeX className="w-4.5 h-4.5" strokeWidth={2.75} />
          ) : (
            <Volume2 className="w-4.5 h-4.5" strokeWidth={2.75} />
          )}
        </button>
      </div>
    </header>
  );
};
