import { useEffect, useState, type RefObject } from 'react';

export interface HeroCardSize {
  w: number;
  h: number;
}

/**
 * ResizeObserver-driven responsive Hero Card sizing hook.
 * Measures the actual stage container and targets ~66%–74% of stage container height
 * (respecting 5:7 aspect ratio, 3D tilt safe margin, and width constraints)
 * so the Holo Card is always the unmistakable visual centerpiece on 1920x1080, 1440x900,
 * 1366x768, and 1280x720 without wasting dark stage space!
 */
export function useHeroCardSize(
  containerRef: RefObject<HTMLElement | null>,
  opts: {
    heightRatio?: number;
    maxWidthRatio?: number;
    minH?: number;
    maxH?: number;
    aspect?: number; // width / height (~0.714)
  } = {}
): HeroCardSize {
  const {
    heightRatio = 0.88, // Inside the dedicated flex-1 card slot, fills ~88% of slot (~64–70% of full stage!)
    maxWidthRatio = 0.86,
    minH = 260,
    maxH = 560,
    aspect = 0.714,
  } = opts;

  const [size, setSize] = useState<HeroCardSize>({ w: 320, h: 448 });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const compute = () => {
      const rect = el.getBoundingClientRect();
      if (rect.width <= 20 || rect.height <= 20) return;

      const targetHFromHeight = Math.min(maxH, Math.max(minH, rect.height * heightRatio));
      const maxHFromWidth = (rect.width * maxWidthRatio) / aspect;
      const finalH = Math.round(Math.max(210, Math.min(targetHFromHeight, maxHFromWidth)));
      const finalW = Math.round(finalH * aspect);

      setSize((prev) =>
        Math.abs(prev.w - finalW) > 2 || Math.abs(prev.h - finalH) > 2
          ? { w: finalW, h: finalH }
          : prev
      );
    };

    compute();

    if (typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver(() => compute());
      ro.observe(el);
      return () => ro.disconnect();
    }

    window.addEventListener('resize', compute);
    return () => window.removeEventListener('resize', compute);
  }, [containerRef, heightRatio, maxWidthRatio, minH, maxH, aspect]);

  return size;
}
