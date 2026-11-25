import React from 'react';
import { getCardById } from '../../data/soundCards';
import { useHoloStore } from '../../store/useHoloStore';
import { CardArtwork } from '../artwork/CardArtwork';

/**
 * Shared-Element Flying Card Transition when routing a sound card
 * from 01 GACHA directly into 02 BEAT slot or 03 PINBALL!
 */
export const SharedCardFlightOverlay: React.FC = () => {
  const transition = useHoloStore((s) => s.sharedCardTransition);
  if (!transition) return null;

  const card = getCardById(transition.cardId);

  return (
    <div className="fixed inset-0 z-50 pointer-events-none overflow-hidden">
      <div
        key={transition.startedAt}
        className="fixed left-1/2 top-1/2 w-[150px] h-[210px] rounded-2xl p-[5px] border-[2.5px] border-[#17171C] holo-shine-border shadow-[0_18px_38px_rgba(0,0,0,0.45)] animate-card-fly"
      >
        <div className="w-full h-full rounded-[11px] overflow-hidden border-[2px] border-[#17171C] bg-[#14151B] flex flex-col">
          <div className="flex-1 overflow-hidden">
            <CardArtwork artId={card.artId} />
          </div>
          <div className="bg-[#FBF9F4] border-t-[2px] border-[#17171C] py-1 px-2 text-center">
            <span className="text-[11px] font-black tracking-wide text-[#17171C] block truncate">
              {card.zhTitle}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
