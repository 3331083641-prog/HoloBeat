import React, { useState } from 'react';
import { Play, Power, Sparkles, X } from 'lucide-react';
import { holoAudio } from '../../audio/HoloAudioEngine';
import { useHoloStore } from '../../store/useHoloStore';

/**
 * Non-intrusive hardware power-on dock that floats crisply at top-center
 * until the user unlocks browser Web Audio.
 */
export const AudioBootBanner: React.FC = () => {
  const audioUnlocked = useHoloStore((s) => s.audioUnlocked);
  const setActivePage = useHoloStore((s) => s.setActivePage);
  const applyBeatPreset = useHoloStore((s) => s.applyBeatPreset);
  const selectedGachaCardId = useHoloStore((s) => s.selectedGachaCardId);
  const pushToast = useHoloStore((s) => s.pushToast);
  const [dismissed, setDismissed] = useState(false);

  if (audioUnlocked || dismissed) return null;

  const handlePowerOn = async () => {
    await holoAudio.ensureStarted();
    await holoAudio.playSfx('bootChime');
    window.setTimeout(() => {
      void holoAudio.previewCard(selectedGachaCardId);
    }, 340);
    pushToast({
      text: '离线声音引擎已启动，扭动摇杆或点开插卡编曲台即可开玩',
      accent: '#00D4AA',
    });
  };

  const handleInstantJam = async () => {
    await holoAudio.ensureStarted();
    await holoAudio.playSfx('bootChime');
    applyBeatPreset('MARKET');
    setActivePage('beat');
    window.setTimeout(() => {
      void holoAudio.startTransport();
    }, 220);
    pushToast({
      text: '正在演奏「胡同早市律动」示例，试试随手涂抹发光打击垫',
      accent: '#FFD426',
    });
  };

  return (
    <div className="fixed top-[68px] left-1/2 -translate-x-1/2 z-40 max-w-[94vw] pointer-events-auto animate-card-pop">
      <div className="flex items-center gap-3 bg-[#14151B] text-[#FBF9F4] border-[2.5px] border-[#17171C] ring-2 ring-[#FFD426]/85 rounded-2xl px-3.5 py-2.5 shadow-[0_12px_32px_rgba(0,0,0,0.45),4px_4px_0px_#17171C]">
        <div className="flex items-center gap-2.5 pr-1">
          <span className="relative flex h-3 w-3 shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#FFD426] opacity-75" />
            <span className="relative inline-flex rounded-full h-3 w-3 bg-[#FFD426] border border-[#17171C]" />
          </span>
          <div className="flex flex-col leading-tight">
            <span className="text-[10.5px] font-black tracking-wide text-[#FFD426]">
              离线声音引擎待机中
            </span>
            <span className="text-xs font-extrabold text-[#FBF9F4] whitespace-nowrap">
              唤醒掌机音频引擎，解锁全息声卡与街头律动
            </span>
          </div>
        </div>

        <button
          onClick={() => void handlePowerOn()}
          className="brutal-btn px-3.5 py-1.5 rounded-xl bg-[#FF5526] text-[#17171C] text-xs font-black tracking-wide flex items-center gap-1.5 whitespace-nowrap shrink-0"
        >
          <Power className="w-3.5 h-3.5" strokeWidth={3} />
          <span>启动声音</span>
        </button>

        <button
          onClick={() => void handleInstantJam()}
          className="brutal-btn px-3 py-1.5 rounded-xl bg-[#00D4AA] text-[#17171C] text-xs font-black tracking-wide flex items-center gap-1 whitespace-nowrap shrink-0"
        >
          <Play className="w-3.5 h-3.5 fill-current" />
          <span>一键试听</span>
          <Sparkles className="w-3 h-3" />
        </button>

        <button
          onClick={() => setDismissed(true)}
          aria-label="收起提示"
          title="稍后点击任意控件也可自动开启声音"
          className="p-1 text-white/45 hover:text-white transition-colors cursor-pointer shrink-0"
        >
          <X className="w-4 h-4" strokeWidth={2.5} />
        </button>
      </div>
    </div>
  );
};
