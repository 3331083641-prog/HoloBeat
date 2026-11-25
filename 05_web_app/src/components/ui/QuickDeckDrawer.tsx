import React from 'react';
import { Lock, Play, Sparkles, X } from 'lucide-react';
import { holoAudio } from '../../audio/HoloAudioEngine';
import { useHoloSfx } from '../../audio/useHoloSfx';
import { CATEGORY_META, RARITY_META, SOUND_CARDS } from '../../data/soundCards';
import { useHoloStore } from '../../store/useHoloStore';
import { CardArtwork } from '../artwork/CardArtwork';

export const QuickDeckDrawer: React.FC = () => {
  const open = useHoloStore((s) => s.drawerOpen);
  const setOpen = useHoloStore((s) => s.setDrawerOpen);
  const collection = useHoloStore((s) => s.collection);
  const selectGachaCard = useHoloStore((s) => s.selectGachaCard);
  const setActivePage = useHoloStore((s) => s.setActivePage);
  const sendCardToBeat = useHoloStore((s) => s.sendCardToBeat);
  const playSfx = useHoloSfx();

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-black/45 backdrop-blur-[1px]"
      onClick={() => setOpen(false)}
    >
      <aside
        onClick={(e) => e.stopPropagation()}
        className="w-[420px] max-w-[92vw] h-full bg-[#FBF9F4] border-l-[2.5px] border-[#17171C] flex flex-col shadow-[-8px_0_0_#17171C]"
      >
        <div className="p-4 border-b-[2.5px] border-[#17171C] flex items-center justify-between bg-[#FFD426]">
          <div>
            <h2 className="text-lg font-black tracking-wide text-[#17171C]">
              全息声卡图鉴
            </h2>
            <p className="text-xs font-bold text-[#17171C]/80">
              已收集 {collection.length} / {SOUND_CARDS.length} 张市井全息声卡
            </p>
          </div>
          <button
            onClick={() => {
              playSfx('click');
              setOpen(false);
            }}
            aria-label="关闭图鉴"
            className="brutal-btn w-9 h-9 rounded-xl bg-[#FBF9F4] flex items-center justify-center"
          >
            <X className="w-5 h-5" strokeWidth={2.8} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto holo-scroll p-4 grid grid-cols-2 gap-3 bg-[#F3EFE6]">
          {SOUND_CARDS.map((card) => {
            const unlocked = collection.includes(card.id);
            const cat = CATEGORY_META[card.category];
            const rar = RARITY_META[card.rarity];

            return (
              <div
                key={card.id}
                className={`rounded-xl border-[2.5px] border-[#1A1A1F] p-2 flex flex-col gap-1.5 ${
                  unlocked
                    ? 'bg-[#FFFDF8] shadow-[3px_3px_0px_0px_#1A1A1F]'
                    : 'bg-[#EDE7D9] opacity-75'
                }`}
              >
                <div
                  className={`relative h-28 rounded-lg border-2 border-[#1A1A1F] overflow-hidden ${
                    unlocked ? 'holo-thumb-sheen cursor-pointer' : 'bg-[#181820]'
                  }`}
                  onClick={() => {
                    if (!unlocked) return;
                    void holoAudio.previewCard(card.id);
                    selectGachaCard(card.id);
                  }}
                >
                  {unlocked ? (
                    <>
                      <CardArtwork artId={card.artId} />
                      <span
                        className="absolute top-1 left-1 px-1.5 py-0.5 text-[10px] font-black rounded border border-[#1A1A1F]"
                        style={{ backgroundColor: rar.bg, color: rar.text }}
                      >
                        {rar.label}
                      </span>
                      <span className="absolute top-1 right-1 px-1.5 py-0.5 text-[10px] font-mono-hw font-black rounded bg-[#FFFDF8] border border-[#1A1A1F]">
                        {card.code}
                      </span>
                    </>
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-white/45 gap-1">
                      <Lock className="w-5 h-5" />
                      <span className="font-mono-hw text-[10px] font-bold">{card.code} 未解锁</span>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between gap-1">
                  <div className="min-w-0">
                    <div className="text-xs font-black truncate text-[#1A1A1F]">
                      {unlocked ? card.zhTitle : '盲盒未解锁'}
                    </div>
                    <div className="text-[10px] font-bold text-[#5C5C6B] truncate">
                      {unlocked ? cat.zhLabel : `${cat.zhLabel} · 前往盲盒机解锁`}
                    </div>
                  </div>
                </div>

                {unlocked ? (
                  <div className="flex gap-1.5 mt-0.5">
                    <button
                      onClick={() => void holoAudio.previewCard(card.id)}
                      className="brutal-pad flex-1 py-1 rounded-lg bg-[#00D4AA] text-[10px] font-black flex items-center justify-center gap-1 whitespace-nowrap"
                    >
                      <Play className="w-3 h-3 fill-current" /> 试听
                    </button>
                    <button
                      onClick={() => {
                        playSfx('cartridgeLock');
                        setOpen(false);
                        sendCardToBeat(card.id);
                      }}
                      className="brutal-pad flex-1 py-1 rounded-lg bg-[#7C3AED] text-white text-[10px] font-black whitespace-nowrap"
                    >
                      装入节拍
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => {
                      playSfx('tab');
                      setActivePage('gacha');
                      setOpen(false);
                    }}
                    className="brutal-pad w-full py-1 rounded-lg bg-[#FFD60A] text-[10px] font-black flex items-center justify-center gap-1 whitespace-nowrap"
                  >
                    <Sparkles className="w-3 h-3" /> 去扭盲盒
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </aside>
    </div>
  );
};
