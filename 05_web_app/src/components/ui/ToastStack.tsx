import React from 'react';
import { X } from 'lucide-react';
import { useHoloStore } from '../../store/useHoloStore';
import { useHoloSfx } from '../../audio/useHoloSfx';

export const ToastStack: React.FC = () => {
  const toasts = useHoloStore((s) => s.toasts);
  const dismissToast = useHoloStore((s) => s.dismissToast);
  const setActivePage = useHoloStore((s) => s.setActivePage);
  const playSfx = useHoloSfx();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-[68px] right-4 z-50 flex flex-col gap-2 max-w-[330px] pointer-events-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          className="pointer-events-auto flex items-center gap-2.5 bg-[#FFFDF8] border-[2.5px] border-[#1A1A1F] rounded-xl px-3.5 py-2.5 shadow-[4px_4px_0px_0px_#1A1A1F] animate-card-pop"
        >
          <span
            className="w-3 h-3 rounded-full border-2 border-[#1A1A1F] shrink-0"
            style={{ backgroundColor: t.accent ?? '#FFD60A' }}
          />
          <p className="text-xs font-extrabold text-[#1A1A1F] leading-snug flex-1">{t.text}</p>
          {t.actionLabel && t.actionPage && (
            <button
              onClick={() => {
                playSfx('tab');
                setActivePage(t.actionPage!);
                dismissToast(t.id);
              }}
              className="brutal-btn px-2 py-1 rounded-lg bg-[#FFD60A] text-[#1A1A1F] text-[11px] font-black shrink-0"
            >
              {t.actionLabel}
            </button>
          )}
          <button
            onClick={() => dismissToast(t.id)}
            className="p-0.5 text-[#5C5C6B] hover:text-[#1A1A1F] cursor-pointer"
            aria-label="关闭提示"
          >
            <X className="w-3.5 h-3.5" strokeWidth={2.75} />
          </button>
        </div>
      ))}
    </div>
  );
};
