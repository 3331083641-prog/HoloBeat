import React, { useEffect, useState } from 'react';
import { getCardById } from '../../data/soundCards';
import { useHoloStore } from '../../store/useHoloStore';
import { CardArtwork } from '../artwork/CardArtwork';

/**
 * Shared-Element Flying Card Transition launched from the REAL card DOM rect
 * smoothly into the destination track slot / workspace!
 */
export const SharedCardFlightOverlay: React.FC = () => {
  const transition = useHoloStore((s) => s.sharedCardTransition);
  const [launched, setLaunched] = useState(false);

  useEffect(() => {
    if (!transition) {
      setLaunched(false);
      return;
    }
    setLaunched(false);
    const id = requestAnimationFrame(() => {
      requestAnimationFrame(() => setLaunched(true));
    });
    return () => cancelAnimationFrame(id);
  }, [transition]);

  if (!transition) return null;

  const card = getCardById(transition.cardId);
  const vw = typeof window !== 'undefined' ? window.innerWidth : 1440;
  const vh = typeof window !== 'undefined' ? window.innerHeight : 900;

  const startX = transition.sourceRect
    ? transition.sourceRect.x + transition.sourceRect.w / 2
    : vw * 0.5;
  const startY = transition.sourceRect
    ? transition.sourceRect.y + transition.sourceRect.h / 2
    : vh * 0.5;

  // Target slot geometry: 02 Beat left track slot OR 03 Pinball left sound bind list
  const targetTrackIdx = transition.targetTrackIndex ?? 0;
  const endX = transition.targetPage === 'beat' ? 118 : 118;
  const endY =
    transition.targetPage === 'beat'
      ? Math.min(vh - 120, 210 + targetTrackIdx * ((vh - 280) / 4))
      : vh * 0.52;

  const dx = endX - startX;
  const dy = endY - startY;

  return (
    <div className="fixed inset-0 z-50 pointer-events-none overflow-hidden">
      <div
        key={transition.startedAt}
        style={{
          left: startX,
          top: startY,
          transform: launched
            ? `translate(${dx - 75}px, ${dy - 105}px) scale(0.36) rotate(-5deg)`
            : 'translate(-75px, -105px) scale(0.92) rotate(3deg)',
          opacity: launched ? 0 : 1,
          transition:
            'transform 460ms cubic-bezier(0.22, 1, 0.36, 1), opacity 460ms cubic-bezier(0.4, 0, 1, 1)',
        }}
        className="fixed w-[150px] h-[210px] rounded-2xl p-[5px] border-[2.5px] border-[#1A1A1F] holo-shine-border shadow-[0_18px_38px_rgba(0,0,0,0.42)]"
      >
        <div className="w-full h-full rounded-[11px] overflow-hidden border-[2px] border-[#1A1A1F] bg-[#14151B] flex flex-col">
          <div className="flex-1 overflow-hidden">
            <CardArtwork artId={card.artId} />
          </div>
          <div className="bg-[#FFFDF8] border-t-[2px] border-[#1A1A1F] py-1 px-2 text-center">
            <span className="text-[11px] font-bold text-[#1A1A1F] block truncate">
              {card.zhTitle}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
