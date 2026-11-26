import { getStepTimeMs } from '../audio/compositionEngine.ts';
import type { MotionShapeMotif, TrackCategory } from '../types/holo';

/**
 * Holo Motion · 声音生命运动系统 (Sound Life Kinematics Engine)
 *
 * Inspired by the parabolic musical-time jumping-ball principle of Dancing Notes
 * (https://github.com/SyanChen7/dancing-notes, MIT), re-engineered for HoloBeat's
 * 4 distinct Chinese street sound families with swing-exact millisecond timing
 * and shape-coded motion grammar (color + form recognition).
 */

export interface TrackMotionProfile {
  color: string;
  glowColor: string;
  shape: MotionShapeMotif;
  arcMultiplier: number; // Parabolic apex height multiplier
  radius: number;
  squashStrength: number; // Impact squash & stretch factor
  trailLength: number;
  style: 'punch' | 'crisp' | 'fluid' | 'float';
  zhMotifLabel: string;
}

export const TRACK_MOTION_PROFILES: Record<TrackCategory, TrackMotionProfile> = {
  BEAT: {
    color: '#7C3AED',
    glowColor: 'rgba(124, 58, 237, 0.65)',
    shape: 'rounded-square',
    arcMultiplier: 0.68,
    radius: 8.5,
    squashStrength: 0.4,
    trailLength: 5,
    style: 'punch',
    zhMotifLabel: '鼓槌方印 · 短促下压',
  },
  PERC: {
    color: '#FF5C2B',
    glowColor: 'rgba(255, 92, 43, 0.65)',
    shape: 'ring',
    arcMultiplier: 0.88,
    radius: 7.5,
    squashStrength: 0.24,
    trailLength: 6,
    style: 'crisp',
    zhMotifLabel: '铜铃双环 · 清脆弹跳',
  },
  MELODY: {
    color: '#00D4AA',
    glowColor: 'rgba(0, 212, 170, 0.7)',
    shape: 'diamond-star',
    arcMultiplier: 1.28,
    radius: 8,
    squashStrength: 0.2,
    trailLength: 10,
    style: 'fluid',
    zhMotifLabel: '星芒弦光 · 音高抛物',
  },
  VIBE: {
    color: '#FFD60A',
    glowColor: 'rgba(255, 214, 10, 0.65)',
    shape: 'cloud-wave',
    arcMultiplier: 1.02,
    radius: 9.5,
    squashStrength: 0.14,
    trailLength: 9,
    style: 'float',
    zhMotifLabel: '烟火云波 · 缓慢扩散',
  },
};

export interface ParabolicOrbPose {
  x: number;
  y: number;
  /** Progress 0..1 from previous note onset to next note onset */
  phase: number;
  /** 1 right at landing impact, decays smoothly to 0 */
  impact: number;
  /** Velocity-scaled stretch for organic bounce squash/stretch */
  scaleX: number;
  scaleY: number;
  active: boolean;
  /** Whether orb is wrapping around from end of loop back to start */
  wrapping: boolean;
  /** Velocity of target/active hit for amplitude-scaled visual intensity */
  velocity: number;
}

/**
 * Pure parabolic interpolation between two timed anchor points:
 *   x(p) = lerp(x0, x1, p)
 *   y(p) = lerp(y0, y1, p) - 4 * apexHeight * p * (1 - p)
 *
 * At p = 0 -> (x0, y0) and at p = 1 -> (x1, y1), ensuring touchdown occurs at
 * the exact millisecond of every swung or unswung note onset!
 */
export function evaluateParabolicJump(params: {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  phase: number; // 0..1
  baseHeight: number;
  profile: TrackMotionProfile;
  velocity?: number;
  wrapping?: boolean;
}): ParabolicOrbPose {
  const { x0, y0, x1, y1, baseHeight, profile, velocity = 0.85, wrapping = false } = params;
  const p = Math.min(1, Math.max(0, params.phase));

  // Velocity scales bounce amplitude cleanly
  const apex = baseHeight * profile.arcMultiplier * (0.65 + velocity * 0.5);
  const arcLift = 4 * apex * p * (1 - p);

  // VIBE cloud-wave adds slow buoyant float near apex
  const floatBoost = profile.style === 'float' ? Math.sin(p * Math.PI) * 7 : 0;

  const x = x0 + (x1 - x0) * p;
  const y = y0 + (y1 - y0) * p - arcLift - floatBoost;

  const distToEdge = Math.min(p, 1 - p);
  const impact = distToEdge < 0.14 ? 1 - distToEdge / 0.14 : 0;

  const squash = impact * profile.squashStrength * (0.75 + velocity * 0.35);
  const airStretch = Math.sin(p * Math.PI) * 0.1;
  const scaleX = 1 + squash - airStretch * 0.4;
  const scaleY = 1 - squash + airStretch;

  return {
    x,
    y,
    phase: p,
    impact,
    scaleX,
    scaleY,
    active: true,
    wrapping,
    velocity,
  };
}

/**
 * Evaluate a track's bouncing motif across a 16-step phrase window (with optional swing!).
 * Consumes EXACT swung onset times in ms (`getStepTimeMs`), fixing Swing desync cleanly!
 */
export function evaluateSequencerTrackOrb(params: {
  steps: boolean[];
  accents?: boolean[];
  velocities?: number[];
  category: TrackCategory;
  /** Continuous step clock in [0, totalSteps) — used directly when swing=0 or converted to ms with bpm */
  stepFloat: number;
  /** Optional explicit BPM & swing (0..0.6) for swing-exact touchdown alignment */
  bpm?: number;
  swing?: number;
  /** Transport reports fractional progress between swung pads. Uniform input is in sixteenth-note units. */
  clock?: "grid" | "uniform";
  /** Offset into track.steps (0 for Phrase A, 16 for Phrase B) */
  phraseOffset?: number;
  getPadCenter: (localStepIdx: number) => { x: number; y: number };
  baseArcHeight: number;
}): ParabolicOrbPose | null {
  const {
    steps,
    accents,
    velocities,
    category,
    stepFloat,
    bpm = 120,
    swing = 0,
    phraseOffset = 0,
    getPadCenter,
    baseArcHeight,
  } = params;

  const activeIndices: number[] = [];
  for (let i = 0; i < 16; i++) {
    if (steps[phraseOffset + i]) activeIndices.push(i);
  }
  if (activeIndices.length === 0) return null;

  const profile = TRACK_MOTION_PROFILES[category];
  const stepMs = (60 / Math.max(40, bpm) / 4) * 1000;
  const loopMs = stepMs * 16;

  // Convert fractional stepFloat into exact current loop millisecond
  const localStepFloat = ((stepFloat % 16) + 16) % 16;
  const localStep = Math.floor(localStepFloat);
  const startMs = getStepTimeMs(localStep, bpm, swing);
  const endMs = getStepTimeMs(localStep + 1, bpm, swing);
  const currentMs = params.clock === 'uniform' ? localStepFloat * stepMs
    : startMs + (endMs - startMs) * (localStepFloat - localStep);

  // Compute exact swung onset times for every active pad in this 16-step phrase
  const timedSteps = activeIndices.map((idx) => ({
    idx,
    timeMs: getStepTimeMs(idx, bpm, swing),
    velocity: velocities?.[phraseOffset + idx] ?? (accents?.[phraseOffset + idx] ? 1 : 0.84),
  }));

  if (timedSteps.length === 1) {
    const only = timedSteps[0];
    const pt = getPadCenter(only.idx);
    const elapsed = (((currentMs - only.timeMs) % loopMs) + loopMs) % loopMs;
    const phase = elapsed / loopMs;
    return evaluateParabolicJump({
      x0: pt.x,
      y0: pt.y,
      x1: pt.x,
      y1: pt.y,
      phase,
      baseHeight: baseArcHeight * 0.95,
      profile,
      velocity: only.velocity,
    });
  }

  // Find surrounding active timed onsets (prev <= currentMs < next modulo loopMs)
  let prev = timedSteps[timedSteps.length - 1];
  let next = timedSteps[0];
  let wrapping = true;

  for (let i = 0; i < timedSteps.length; i++) {
    if (timedSteps[i].timeMs <= currentMs) {
      prev = timedSteps[i];
      if (i + 1 < timedSteps.length) {
        next = timedSteps[i + 1];
        wrapping = false;
      } else {
        next = timedSteps[0];
        wrapping = true;
      }
    }
  }

  const spanMs = wrapping ? loopMs - prev.timeMs + next.timeMs : next.timeMs - prev.timeMs;
  const elapsedMs =
    currentMs >= prev.timeMs ? currentMs - prev.timeMs : loopMs - prev.timeMs + currentMs;
  const phase = spanMs > 0 ? Math.min(1, Math.max(0, elapsedMs / spanMs)) : 0;

  const p0 = getPadCenter(prev.idx);
  const p1 = getPadCenter(next.idx);
  const spanSteps = spanMs / stepMs;
  const intervalScale = Math.min(1.45, 0.72 + spanSteps * 0.14);

  return evaluateParabolicJump({
    x0: p0.x,
    y0: p0.y,
    x1: p1.x,
    y1: p1.y,
    phase,
    baseHeight: baseArcHeight * intervalScale,
    profile,
    velocity: next.velocity,
    wrapping,
  });
}

export interface TimedAnchor {
  id: string;
  timeMs: number;
  x: number;
  y: number;
  velocity: number;
  pitch: string;
  color: string;
  durationMs?: number;
}

export function evaluateChoreographedLaneOrb(params: {
  anchors: TimedAnchor[];
  category: TrackCategory;
  currentTimeMs: number;
  leadInMs?: number;
  baseArcHeight?: number;
}): ParabolicOrbPose | null {
  const { anchors, category, currentTimeMs, leadInMs = 420, baseArcHeight = 76 } = params;
  if (anchors.length === 0) return null;

  const profile = TRACK_MOTION_PROFILES[category];
  const first = anchors[0];
  const last = anchors[anchors.length - 1];

  if (currentTimeMs < first.timeMs) {
    const startMs = first.timeMs - leadInMs;
    if (currentTimeMs < startMs) return null;
    const p = (currentTimeMs - startMs) / Math.max(1, leadInMs);
    return evaluateParabolicJump({
      x0: first.x,
      y0: 76,
      x1: first.x,
      y1: first.y,
      phase: p,
      baseHeight: 28,
      profile,
      velocity: first.velocity,
    });
  }

  if (currentTimeMs > last.timeMs) {
    const after = currentTimeMs - last.timeMs;
    if (after > 650) return null;
    const p = after / 650;
    return evaluateParabolicJump({
      x0: last.x,
      y0: last.y,
      x1: last.x,
      y1: last.y + 42,
      phase: p,
      baseHeight: 36,
      profile,
      velocity: 0.55,
    });
  }

  let idx = 0;
  for (let i = 0; i < anchors.length - 1; i++) {
    if (anchors[i].timeMs <= currentTimeMs && currentTimeMs <= anchors[i + 1].timeMs) {
      idx = i;
      break;
    }
  }

  const a0 = anchors[idx];
  const a1 = anchors[Math.min(anchors.length - 1, idx + 1)];
  const spanMs = Math.max(1, a1.timeMs - a0.timeMs);
  const phase = (currentTimeMs - a0.timeMs) / spanMs;
  const distScale = Math.min(1.55, 0.68 + Math.hypot(a1.x - a0.x, a1.y - a0.y) / 380);

  return evaluateParabolicJump({
    x0: a0.x,
    y0: a0.y,
    x1: a1.x,
    y1: a1.y,
    phase,
    baseHeight: baseArcHeight * distScale,
    profile,
    velocity: a1.velocity,
  });
}

/**
 * Draw the 4 distinct shape-coded sound motifs on Canvas 2D so BEAT / PERC / MELODY / VIBE
 * are instantaneously recognizable by BOTH form and color!
 */
export function drawTrackMotifShape(
  ctx: CanvasRenderingContext2D,
  shape: MotionShapeMotif,
  radius: number,
  fillColor: string,
  strokeColor = '#1A1A1F',
  impact = 0
) {
  ctx.fillStyle = fillColor;
  ctx.strokeStyle = strokeColor;
  ctx.lineWidth = 2.4;

  if (shape === 'rounded-square') {
    // BEAT: Rounded drum-mallet square stamp
    const r = radius * 1.05;
    ctx.beginPath();
    ctx.roundRect(-r, -r, r * 2, r * 2, 4.5);
    ctx.fill();
    ctx.stroke();
    // Crisp top specular dash
    ctx.fillStyle = '#FFFDF8';
    ctx.beginPath();
    ctx.roundRect(-r * 0.55, -r * 0.58, r * 1.1, 2.5, 1.5);
    ctx.fill();
    return;
  }

  if (shape === 'ring') {
    // PERC: Concentric bell ring + solid striker core
    ctx.beginPath();
    ctx.arc(0, 0, radius * 1.08, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#FFFDF8';
    ctx.beginPath();
    ctx.arc(0, 0, radius * (0.42 + impact * 0.14), 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = 1.6;
    ctx.stroke();
    return;
  }

  if (shape === 'diamond-star') {
    // MELODY: 4-point luminous diamond star
    const outer = radius * 1.32;
    const inner = radius * 0.46;
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const r = i % 2 === 0 ? outer : inner;
      const a = (i * Math.PI) / 4 - Math.PI / 2;
      const px = Math.cos(a) * r;
      const py = Math.sin(a) * r;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#FFFDF8';
    ctx.beginPath();
    ctx.arc(0, 0, radius * 0.28, 0, Math.PI * 2);
    ctx.fill();
    return;
  }

  // VIBE: Floating 3-lobe cloud wave capsule
  const w = radius * 1.35;
  const h = radius * 0.85;
  ctx.beginPath();
  ctx.arc(-w * 0.42, h * 0.08, h * 0.62, 0, Math.PI * 2);
  ctx.arc(0, -h * 0.18, h * 0.78, 0, Math.PI * 2);
  ctx.arc(w * 0.42, h * 0.08, h * 0.62, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#FFFDF8';
  ctx.beginPath();
  ctx.arc(-w * 0.18, -h * 0.25, radius * 0.22, 0, Math.PI * 2);
  ctx.fill();
}
