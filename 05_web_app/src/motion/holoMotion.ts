import type { TrackCategory } from '../types/holo';

/**
 * Holo Motion · 声音生命运动系统 (Sound Life Kinematics Engine)
 *
 * Inspired by the parabolic musical-time jumping-ball principle of Dancing Notes
 * (SyanChen7/dancing-notes), re-engineered cleanly as an original 4-track
 * real-time audio-clock trajectory engine for HoloBeat.
 *
 * Every orb position is computed deterministically from real musical time (tMs / loopPos),
 * ensuring 100% accuracy across pause, resume, BPM changes, Mute/Solo, and looping.
 */

export interface TrackMotionProfile {
  color: string;
  glowColor: string;
  arcMultiplier: number; // Parabolic apex height multiplier
  radius: number;
  squashStrength: number; // Impact squash & stretch factor
  trailLength: number;
  style: 'punch' | 'crisp' | 'fluid' | 'float';
}

export const TRACK_MOTION_PROFILES: Record<TrackCategory, TrackMotionProfile> = {
  BEAT: {
    color: '#7C3AED',
    glowColor: 'rgba(124, 58, 237, 0.65)',
    arcMultiplier: 0.72,
    radius: 8.5,
    squashStrength: 0.36,
    trailLength: 6,
    style: 'punch',
  },
  PERC: {
    color: '#FF5C2B',
    glowColor: 'rgba(255, 92, 43, 0.65)',
    arcMultiplier: 0.88,
    radius: 6.5,
    squashStrength: 0.24,
    trailLength: 7,
    style: 'crisp',
  },
  MELODY: {
    color: '#00D4AA',
    glowColor: 'rgba(0, 212, 170, 0.7)',
    arcMultiplier: 1.28,
    radius: 7.5,
    squashStrength: 0.2,
    trailLength: 10,
    style: 'fluid',
  },
  VIBE: {
    color: '#FFD60A',
    glowColor: 'rgba(255, 214, 10, 0.65)',
    arcMultiplier: 1.05,
    radius: 9.5,
    squashStrength: 0.14,
    trailLength: 8,
    style: 'float',
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
  /** Whether orb is wrapping around from end of bar back to start */
  wrapping: boolean;
}

/**
 * Pure parabolic interpolation between two timed anchor points:
 *   x(p) = lerp(x0, x1, p)
 *   y(p) = lerp(y0, y1, p) - 4 * apexHeight * p * (1 - p)
 *
 * Notice at p = 0 -> (x0, y0) and at p = 1 -> (x1, y1), so the orb touches down
 * at the EXACT millisecond of every note onset!
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

  // Parabolic elevation curve: peaks cleanly at p = 0.5 with exact zero elevation at 0 and 1
  const apex = baseHeight * profile.arcMultiplier * (0.72 + velocity * 0.42);
  const arcLift = 4 * apex * p * (1 - p);

  // Float style adds a gentle harmonic hover feel near apex
  const floatBoost =
    profile.style === 'float' ? Math.sin(p * Math.PI) * 6 : 0;

  const x = x0 + (x1 - x0) * p;
  const y = y0 + (y1 - y0) * p - arcLift - floatBoost;

  // Impact impulse near touchdown (p near 0 or p near 1)
  const distToEdge = Math.min(p, 1 - p);
  const impact = distToEdge < 0.14 ? 1 - distToEdge / 0.14 : 0;

  // Squash horizontally at landing, stretch vertically mid-flight
  const squash = impact * profile.squashStrength;
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
  };
}

/**
 * Evaluate a track's bouncing orb across a 16-step cyclic sequencer grid
 * given exact fractional step position `stepFloat` in [0, 16).
 */
export function evaluateSequencerTrackOrb(params: {
  steps: boolean[];
  accents?: boolean[];
  category: TrackCategory;
  stepFloat: number; // Continuous 0..16 driven by Tone.Transport
  getPadCenter: (stepIdx: number) => { x: number; y: number };
  baseArcHeight: number;
}): ParabolicOrbPose | null {
  const { steps, accents, category, stepFloat, getPadCenter, baseArcHeight } = params;
  const activeIndices: number[] = [];
  for (let i = 0; i < 16; i++) {
    if (steps[i]) activeIndices.push(i);
  }
  if (activeIndices.length === 0) return null;

  const profile = TRACK_MOTION_PROFILES[category];
  const t = ((stepFloat % 16) + 16) % 16;

  // Single active step in track: bounces cleanly in place on every loop cycle!
  if (activeIndices.length === 1) {
    const idx = activeIndices[0];
    const pt = getPadCenter(idx);
    const phase = (((t - idx) % 16) + 16) % 16 / 16;
    return evaluateParabolicJump({
      x0: pt.x,
      y0: pt.y,
      x1: pt.x,
      y1: pt.y,
      phase,
      baseHeight: baseArcHeight * 0.95,
      profile,
      velocity: accents?.[idx] ? 1 : 0.82,
    });
  }

  // Find surrounding active note indices (prevIdx <= t < nextIdx modulo 16)
  let prevIdx = activeIndices[activeIndices.length - 1];
  let nextIdx = activeIndices[0];
  let wrapping = true;

  for (let i = 0; i < activeIndices.length; i++) {
    if (activeIndices[i] <= t) {
      prevIdx = activeIndices[i];
      if (i + 1 < activeIndices.length) {
        nextIdx = activeIndices[i + 1];
        wrapping = false;
      } else {
        nextIdx = activeIndices[0];
        wrapping = true;
      }
    }
  }

  const span = wrapping ? 16 - prevIdx + nextIdx : nextIdx - prevIdx;
  const elapsed = t >= prevIdx ? t - prevIdx : 16 - prevIdx + t;
  const phase = span > 0 ? elapsed / span : 0;

  const p0 = getPadCenter(prevIdx);
  const p1 = getPadCenter(nextIdx);
  // Longer step intervals naturally jump slightly higher (capped for visual harmony)
  const intervalScale = Math.min(1.45, 0.72 + span * 0.14);

  return evaluateParabolicJump({
    x0: p0.x,
    y0: p0.y,
    x1: p1.x,
    y1: p1.y,
    phase,
    baseHeight: baseArcHeight * intervalScale,
    profile,
    velocity: accents?.[nextIdx] ? 1.0 : 0.84,
    wrapping,
  });
}

/**
 * Evaluate a deterministic non-cyclic choreographed timeline event track
 * (used by 03 PINBALL CHOREOGRAPHED SHOW mode!).
 */
export interface TimedAnchor {
  id: string;
  timeMs: number;
  x: number;
  y: number;
  velocity: number;
  pitch: string;
  color: string;
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

  // Lead-in entrance drop from top rail right onto the very first note onset!
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

  // Gentle exit settle after final note
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

  // Binary / linear scan for surrounding pair (anchors are sorted by timeMs)
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
