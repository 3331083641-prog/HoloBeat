import React, { useState } from 'react';
import { Check, Compass, X } from 'lucide-react';
import { useHoloSfx } from '../../audio/useHoloSfx';
import { useHoloStore } from '../../store/useHoloStore';
import type { PageId } from '../../types/holo';

/**
 * Compact, zero-overlap Creative Loop Progress Pill mounted cleanly inside TopNavbar.
 * Expands into a crisp hardware checklist popover on click — never covers bottom workbench controls!
 */
export const OnboardingRibbon: React.FC = () => {
  const onboarding = useHoloStore((s) => s.onboarding);
  const dismissOnboarding = useHoloStore((s) => s.dismissOnboarding);
  const setActivePage = useHoloStore((s) => s.setActivePage);
  const playSfx = useHoloSfx();
  const [open, setOpen] = useState(false);

  const steps: { key: string; label: string; desc: string; done: boolean; page: PageId }[] = [
    { key: 'pull', label: '① 抽声卡', desc: '在盲盒机发现新市井音色', done: onboarding.pulledCard, page: 'gacha' },
    { key: 'slot', label: '② 装卡槽', desc: '将声卡装入节拍台音轨', done: onboarding.sentToBeat, page: 'gacha' },
    { key: 'beat', label: '③ 编节拍', desc: '点亮打击垫并播放律动', done: onboarding.editedOrPlayedBeat, page: 'beat' },
    { key: 'show', label: '④ 看演出', desc: '送入弹珠剧场看音画同步', done: onboarding.watchedPinballShow, page: 'pinball' },
    { key: 'mint', label: '⑤ 铸闪卡', desc: '封印声音并导出全息藏品', done: onboarding.mintedFirstCard, page: 'forge' },
  ];

  const completedCount = steps.filter((s) => s.done).length;
  if (onboarding.dismissed) return null;

  return (
    <div className="relative hidden xl:block">
      <button
        onClick={() => {
          playSfx('click', 0.65);
          setOpen((v) => !v);
        }}
        title="查看 1 分钟造物闭环进度"
        className={`brutal-pad h-[32px] px-2.5 rounded-xl text-[10.5px] font-mono-hw font-black flex items-center gap-1.5 whitespace-nowrap ${
          completedCount === steps.length
            ? 'bg-[#00D4AA] text-[#17171C]'
            : 'bg-[#F3EFE6] text-[#17171C] hover:bg-[#FFD426]'
        }`}
      >
        <Compass className="w-3.5 h-3.5 text-[#7C3AED]" strokeWidth={2.6} />
        <span>闭环 {completedCount}/5</span>
      </button>

      {open && (
        <div className="absolute left-0 top-[42px] z-50 w-[268px] rounded-2xl bg-[#FBF9F4] border-[2.5px] border-[#17171C] shadow-[5px_5px_0px_#17171C] p-3 flex flex-col gap-2 animate-card-pop">
          <div className="flex items-center justify-between">
            <span className="font-mono-hw text-[10px] font-black text-[#7C3AED] tracking-wider uppercase">
              CREATIVE LOOP GUIDE · {completedCount}/5
            </span>
            <button
              onClick={() => {
                playSfx('click', 0.3);
                setOpen(false);
                dismissOnboarding();
              }}
              title="隐藏引导徽章"
              className="p-0.5 text-[#626272] hover:text-[#17171C] cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="flex flex-col gap-1.5">
            {steps.map((st) => (
              <button
                key={st.key}
                onClick={() => {
                  playSfx('tab');
                  setActivePage(st.page);
                  setOpen(false);
                }}
                className={`w-full text-left px-2.5 py-1.5 rounded-xl border-[2px] flex items-center justify-between gap-2 cursor-pointer transition-colors ${
                  st.done
                    ? 'bg-[#00D4AA]/18 border-[#00D4AA] text-[#0F766E]'
                    : 'bg-white border-[#17171C]/20 hover:border-[#17171C] hover:bg-[#FFD426]/30 text-[#17171C]'
                }`}
              >
                <div>
                  <div className="text-[11px] font-black leading-tight">{st.label}</div>
                  <div className="text-[9.5px] font-bold opacity-70">{st.desc}</div>
                </div>
                {st.done && <Check className="w-3.5 h-3.5 shrink-0" strokeWidth={3} />}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
