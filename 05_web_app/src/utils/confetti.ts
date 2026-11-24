import confetti from 'canvas-confetti';

let cachedShapes: confetti.Shape[] | null = null;

function getCustomShapes(): confetti.Shape[] {
  if (cachedShapes) return cachedShapes;
  try {
    const starShape = confetti.shapeFromPath({
      path: 'M12 0 L15 9 L24 12 L15 15 L12 24 L9 15 L0 12 L9 9 Z',
    });
    const noteShape = confetti.shapeFromPath({
      path: 'M9 3 V16 A4 4 0 1 1 6 12.5 V6 L18 3 V14 A4 4 0 1 1 15 10.5 V6.5 Z',
    });
    const boltShape = confetti.shapeFromPath({
      path: 'M13 0 L2 13 H10 L7 24 L19 10 H11 Z',
    });
    cachedShapes = [starShape, noteShape, boltShape, 'circle'];
  } catch {
    cachedShapes = ['circle', 'square'];
  }
  return cachedShapes;
}

const HOLO_COLORS = ['#7C3AED', '#FF5C2B', '#00D4AA', '#FFD60A', '#FF3D9A'];

export function fireHoloConfetti(intensity: 'normal' | 'high' = 'normal') {
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
  const shapes = getCustomShapes();
  const count = intensity === 'high' ? 68 : 40;

  confetti({
    particleCount: Math.round(count * 0.55),
    angle: 62,
    spread: 58,
    origin: { x: 0.36, y: 0.58 },
    colors: HOLO_COLORS,
    shapes,
    scalar: 1.15,
    ticks: 130,
  });

  confetti({
    particleCount: Math.round(count * 0.45),
    angle: 118,
    spread: 58,
    origin: { x: 0.64, y: 0.58 },
    colors: HOLO_COLORS,
    shapes,
    scalar: 1.15,
    ticks: 130,
  });
}
