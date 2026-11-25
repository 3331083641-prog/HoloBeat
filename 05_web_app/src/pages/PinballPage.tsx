import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Matter from 'matter-js';
import {
  ChevronDown,
  Maximize2,
  Minimize2,
  Music,
  Play,
  Redo2,
  RotateCcw,
  RotateCw,
  Sparkles,
  Square,
  Trash2,
  Undo2,
  Wand2,
} from 'lucide-react';
import { holoAudio } from '../audio/HoloAudioEngine';
import { buildSoundSigilData } from '../audio/compositionEngine';
import { useHoloSfx } from '../audio/useHoloSfx';
import { CardArtwork } from '../components/artwork/CardArtwork';
import { SoundSigil } from '../components/holo/SoundSigil';
import { BrutalKnob } from '../components/ui/BrutalKnob';
import { BrutalSlider } from '../components/ui/BrutalSlider';
import {
  CATEGORY_META,
  RARITY_META,
  SCALE_META,
  SOUND_CARDS,
  getCardById,
} from '../data/soundCards';
import {
  TRACK_MOTION_PROFILES,
  evaluateChoreographedLaneOrb,
  type TimedAnchor,
} from '../motion/holoMotion';
import { useHoloStore } from '../store/useHoloStore';
import type {
  CompositionSnapshot,
  PinballRecordedEvent,
  PinballToy,
  PinballToyType,
  TrackCategory,
} from '../types/holo';

const ARENA_W = 800;
const ARENA_H = 680;
const MAX_BALLS = 24;
const FIXED_DT = 1000 / 60;
const RECORDING_WINDOW_MS = 8000;
const MARBLE_COLORS = ['#FF5526', '#7C3AED', '#00D4AA', '#FFD426', '#FF3D9A'];
const TRACK_CATEGORIES: TrackCategory[] = ['BEAT', 'PERC', 'MELODY', 'VIBE'];

interface VfxSlot {
  active: boolean;
  x: number;
  y: number;
  color: string;
  age: number;
  maxAge: number;
  note: string;
  kind: 'hit' | 'warp' | 'chord';
  category: TrackCategory;
}

interface HitDot {
  id: number;
  color: string;
  note: string;
}

interface MarbleRecord {
  body: Matter.Body;
  color: string;
  lastWarp: number;
  trail: { x: number; y: number }[];
  squash: number;
}

interface ShowPlatform extends TimedAnchor {
  trackIndex: number;
  category: TrackCategory;
  cardId: string;
  width: number;
  flash: number;
}

const NOTE_PITCH_MAP: Record<string, number> = {
  C: 0,
  D: 2,
  Eb: 3,
  E: 4,
  F: 5,
  G: 7,
  Ab: 8,
  A: 9,
  Bb: 10,
  B: 11,
};

function pitchToHeightFactor(note: string): number {
  const m = /^([A-G][b#]?)(\d)$/.exec(note.trim());
  if (!m) return 0.5;
  const semi = NOTE_PITCH_MAP[m[1]] ?? 0;
  const oct = parseInt(m[2], 10);
  const midi = oct * 12 + semi;
  // Map typical C4(60) .. E6(88) cleanly into 0..1
  return Math.min(1, Math.max(0, (midi - 58) / 28));
}

function buildChoreographyData(snapshot: CompositionSnapshot | null): {
  platforms: ShowPlatform[];
  laneAnchors: Record<TrackCategory, TimedAnchor[]>;
} {
  const laneAnchors: Record<TrackCategory, TimedAnchor[]> = {
    BEAT: [],
    PERC: [],
    MELODY: [],
    VIBE: [],
  };
  if (!snapshot || snapshot.events.length === 0) {
    return { platforms: [], laneAnchors };
  }

  const dur = Math.max(1200, snapshot.durationMs);
  const bandRanges: Record<TrackCategory, [number, number]> = {
    VIBE: [130, 215],
    MELODY: [230, 365],
    PERC: [390, 485],
    BEAT: [525, 585],
  };

  const platforms: ShowPlatform[] = snapshot.events.map((ev, i) => {
    const frac = Math.min(0.98, Math.max(0.02, ev.timeOffsetMs / dur));
    const x = 76 + frac * (ARENA_W - 152);
    const [yTop, yBot] = bandRanges[ev.trackCategory];
    const pf = pitchToHeightFactor(ev.pitch);
    const y =
      ev.trackCategory === 'MELODY'
        ? yBot - pf * (yBot - yTop)
        : yTop + ((i * 37) % 100) / 100 * (yBot - yTop) * 0.65 + (yBot - yTop) * 0.18;

    const anchor: ShowPlatform = {
      id: ev.id,
      timeMs: ev.timeOffsetMs,
      x,
      y,
      velocity: ev.velocity,
      pitch: ev.pitch,
      color: TRACK_MOTION_PROFILES[ev.trackCategory].color,
      trackIndex: ev.trackIndex,
      category: ev.trackCategory,
      cardId: ev.cardId,
      width: ev.trackCategory === 'BEAT' ? 54 : ev.trackCategory === 'VIBE' ? 62 : 44,
      flash: 0,
    };
    laneAnchors[ev.trackCategory].push(anchor);
    return anchor;
  });

  TRACK_CATEGORIES.forEach((cat) => {
    laneAnchors[cat].sort((a, b) => a.timeMs - b.timeMs);
  });

  return { platforms, laneAnchors };
}

export const PinballPage: React.FC = () => {
  const pinballMode = useHoloStore((s) => s.pinballMode);
  const pinballShowSnapshot = useHoloStore((s) => s.pinballShowSnapshot);
  const toys = useHoloStore((s) => s.pinballToys);
  const pinballUndoCount = useHoloStore((s) => s.pinballUndoStack.length);
  const pinballRedoCount = useHoloStore((s) => s.pinballRedoStack.length);
  const selectedTool = useHoloStore((s) => s.pinballTool);
  const bindCardId = useHoloStore((s) => s.pinballBindCardId);
  const dropperX = useHoloStore((s) => s.pinballDropperX);
  const autoDrop = useHoloStore((s) => s.pinballAutoDrop);
  const gravity = useHoloStore((s) => s.pinballGravity);
  const dropRate = useHoloStore((s) => s.pinballDropRate);
  const bounce = useHoloStore((s) => s.pinballBounce);
  const scale = useHoloStore((s) => s.scale);
  const collection = useHoloStore((s) => s.collection);
  const storedPinballEvents = useHoloStore((s) => s.pinballRecordedEvents);
  const pinballRemixOrigin = useHoloStore((s) => s.pinballRemixOrigin);

  const setPinballMode = useHoloStore((s) => s.setPinballMode);
  const setPinballTool = useHoloStore((s) => s.setPinballTool);
  const setPinballBindCardId = useHoloStore((s) => s.setPinballBindCardId);
  const setPinballDropperX = useHoloStore((s) => s.setPinballDropperX);
  const setPinballAutoDrop = useHoloStore((s) => s.setPinballAutoDrop);
  const setPinballGravity = useHoloStore((s) => s.setPinballGravity);
  const setPinballDropRate = useHoloStore((s) => s.setPinballDropRate);
  const setPinballBounce = useHoloStore((s) => s.setPinballBounce);
  const undoPinball = useHoloStore((s) => s.undoPinball);
  const redoPinball = useHoloStore((s) => s.redoPinball);
  const cycleScale = useHoloStore((s) => s.cycleScale);
  const addPinballToy = useHoloStore((s) => s.addPinballToy);
  const updatePinballToy = useHoloStore((s) => s.updatePinballToy);
  const removePinballToy = useHoloStore((s) => s.removePinballToy);
  const applyPinballPreset = useHoloStore((s) => s.applyPinballPreset);
  const setPinballRecordedEvents = useHoloStore((s) => s.setPinballRecordedEvents);
  const sendPinballToForge = useHoloStore((s) => s.sendPinballToForge);
  const sendPinballToBeatQuantize = useHoloStore((s) => s.sendPinballToBeatQuantize);
  const performBeatInPinball = useHoloStore((s) => s.performBeatInPinball);
  const sendBeatToForge = useHoloStore((s) => s.sendBeatToForge);

  const playSfx = useHoloSfx();

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const viewTransformRef = useRef({ scale: 1, offsetX: 0, offsetY: 0, cssW: ARENA_W, cssH: ARENA_H });
  const engineRef = useRef<Matter.Engine | null>(null);
  const ballsRef = useRef<MarbleRecord[]>([]);
  const dropperRecoilRef = useRef(0);
  const stagePulseRef = useRef(0);
  const toyBodyMapRef = useRef<
    Map<string, { body: Matter.Body; constraint?: Matter.Constraint; hitFlash: number; type: PinballToyType }>
  >(new Map());
  const cooldownMapRef = useRef<Map<string, number>>(new Map());
  const vfxPoolRef = useRef<VfxSlot[]>(
    Array.from({ length: 72 }, () => ({
      active: false,
      x: 0,
      y: 0,
      color: '#FFD426',
      age: 0,
      maxAge: 30,
      note: 'C5',
      kind: 'hit',
      category: 'MELODY',
    }))
  );
  const recordedBufferRef = useRef<(PinballRecordedEvent & { absTime: number })[]>([]);

  const [selectedToyId, setSelectedToyId] = useState<string | null>(null);
  const [combo, setCombo] = useState(0);
  const comboRef = useRef(0);
  const [hitDots, setHitDots] = useState<HitDot[]>([]);
  const [timelineEvents, setTimelineEvents] = useState<PinballRecordedEvent[]>(storedPinballEvents);
  const [playingRec, setPlayingRec] = useState(false);

  // Choreographed Show mode state
  const [showPlaying, setShowPlaying] = useState(false);
  const [showFinaleBloom, setShowFinaleBloom] = useState(0);
  const showFinaleRef = useRef(0);
  const [theaterMode, setTheaterMode] = useState(false);
  const showTrailsRef = useRef<Record<TrackCategory, { x: number; y: number }[]>>({
    BEAT: [],
    PERC: [],
    MELODY: [],
    VIBE: [],
  });

  const choreography = useMemo(
    () => buildChoreographyData(pinballShowSnapshot),
    [pinballShowSnapshot]
  );
  const choreographyRef = useRef(choreography);
  choreographyRef.current = choreography;

  const showSigil = useMemo(
    () => (pinballShowSnapshot ? buildSoundSigilData(pinballShowSnapshot) : null),
    [pinballShowSnapshot]
  );
  const showSigilRef = useRef(showSigil);
  showSigilRef.current = showSigil;

  // Hydrate recordedBufferRef when unsealing a Pinball card with restored events
  useEffect(() => {
    if (storedPinballEvents.length > 0 && recordedBufferRef.current.length === 0) {
      const now = performance.now();
      const maxOff = storedPinballEvents.reduce((m, e) => Math.max(m, e.timeOffsetMs), 0);
      const base = now - maxOff;
      recordedBufferRef.current = storedPinballEvents.map((ev) => ({
        ...ev,
        absTime: base + ev.timeOffsetMs,
      }));
      setTimelineEvents(storedPinballEvents);
    }
  }, [storedPinballEvents]);

  const dragStateRef = useRef<{
    mode: 'none' | 'dropper' | 'toy';
    toyId?: string;
    moved: boolean;
    undoPushed: boolean;
    startX: number;
    startY: number;
  }>({ mode: 'none', moved: false, undoPushed: false, startX: 0, startY: 0 });

  const spawnVfx = useCallback(
    (
      x: number,
      y: number,
      color: string,
      note: string,
      kind: 'hit' | 'warp' | 'chord' = 'hit',
      category: TrackCategory = 'MELODY'
    ) => {
      const pool = vfxPoolRef.current;
      for (let i = 0; i < pool.length; i++) {
        if (!pool[i].active) {
          pool[i].active = true;
          pool[i].x = x;
          pool[i].y = y;
          pool[i].color = color;
          pool[i].age = 0;
          pool[i].maxAge = kind === 'warp' ? 24 : kind === 'chord' ? 38 : 30;
          pool[i].note = note;
          pool[i].kind = kind;
          pool[i].category = category;
          return;
        }
      }
    },
    []
  );

  const getNormalizedRecording = useCallback((): PinballRecordedEvent[] => {
    const raw = recordedBufferRef.current;
    if (raw.length === 0) return [];
    const start = raw[0].absTime;
    return raw.map((ev) => ({
      timeOffsetMs: Math.max(0, Math.round(ev.absTime - start)),
      cardId: ev.cardId,
      note: ev.note,
      velocity: ev.velocity,
      color: ev.color,
    }));
  }, []);

  const dropSingleBall = useCallback((silent = false) => {
    const engine = engineRef.current;
    if (!engine) return;
    const state = useHoloStore.getState();
    if (state.pinballMode !== 'free') return;

    if (ballsRef.current.length >= MAX_BALLS) {
      const oldest = ballsRef.current.shift();
      if (oldest) Matter.Composite.remove(engine.world, oldest.body);
    }

    const jitterX = (Math.random() - 0.5) * 14;
    const ball = Matter.Bodies.circle(state.pinballDropperX + jitterX, 82, 14, {
      restitution: state.pinballBounce,
      friction: 0.008,
      frictionAir: 0.002,
      density: 0.004,
      label: 'marble',
    });
    Matter.Body.setVelocity(ball, { x: (Math.random() - 0.5) * 2.4, y: 1.8 });
    Matter.Composite.add(engine.world, ball);

    const color = MARBLE_COLORS[Math.floor(Math.random() * MARBLE_COLORS.length)];
    ballsRef.current.push({ body: ball, color, lastWarp: 0, trail: [], squash: 0.35 });
    dropperRecoilRef.current = 1;
    if (!silent) {
      void holoAudio.playSfx('click', 0.78);
    }
  }, []);

  /**
   * Incremental body sync: only adds/removes changed toys or rebuilds when bounce changes.
   * Dragging or rotating a toy updates Matter.Body in-place with ZERO world teardown!
   */
  const syncToyBodies = useCallback((forceRebuild = false) => {
    const engine = engineRef.current;
    if (!engine) return;
    const state = useHoloStore.getState();
    const map = toyBodyMapRef.current;

    if (forceRebuild) {
      map.forEach(({ body, constraint }) => {
        Matter.Composite.remove(engine.world, body);
        if (constraint) Matter.Composite.remove(engine.world, constraint);
      });
      map.clear();
    }

    const currentIds = new Set(state.pinballToys.map((t) => t.id));
    // Remove deleted toys
    map.forEach((entry, id) => {
      if (!currentIds.has(id)) {
        Matter.Composite.remove(engine.world, entry.body);
        if (entry.constraint) Matter.Composite.remove(engine.world, entry.constraint);
        map.delete(id);
      }
    });

    // Add new or update existing toys incrementally
    state.pinballToys.forEach((toy) => {
      const existing = map.get(toy.id);
      if (existing && existing.type === toy.type) {
        if (toy.type === 'spinner') {
          if (existing.constraint) {
            existing.constraint.pointA = { x: toy.x, y: toy.y };
          }
          if (Math.hypot(existing.body.position.x - toy.x, existing.body.position.y - toy.y) > 1) {
            Matter.Body.setPosition(existing.body, { x: toy.x, y: toy.y });
          }
        } else {
          Matter.Body.setPosition(existing.body, { x: toy.x, y: toy.y });
          Matter.Body.setAngle(existing.body, toy.angle);
        }
        return;
      }

      if (existing) {
        Matter.Composite.remove(engine.world, existing.body);
        if (existing.constraint) Matter.Composite.remove(engine.world, existing.constraint);
        map.delete(toy.id);
      }

      if (toy.type === 'block') {
        const body = Matter.Bodies.rectangle(toy.x, toy.y, 138, 34, {
          isStatic: true,
          angle: toy.angle,
          restitution: state.pinballBounce * 1.05,
          chamfer: { radius: 10 },
          label: `toy:${toy.id}`,
        });
        Matter.Composite.add(engine.world, body);
        map.set(toy.id, { body, hitFlash: 0, type: 'block' });
      } else if (toy.type === 'bumper') {
        const body = Matter.Bodies.circle(toy.x, toy.y, 32, {
          isStatic: true,
          restitution: Math.min(1.55, state.pinballBounce * 1.38),
          label: `toy:${toy.id}`,
        });
        Matter.Composite.add(engine.world, body);
        map.set(toy.id, { body, hitFlash: 0, type: 'bumper' });
      } else if (toy.type === 'spinner') {
        const bladeA = Matter.Bodies.rectangle(toy.x, toy.y, 120, 20, {
          chamfer: { radius: 9 },
        });
        const bladeB = Matter.Bodies.rectangle(toy.x, toy.y, 20, 120, {
          chamfer: { radius: 9 },
        });
        const body = Matter.Body.create({
          parts: [bladeA, bladeB],
          frictionAir: 0.015,
          restitution: state.pinballBounce,
          label: `toy:${toy.id}`,
        });
        const constraint = Matter.Constraint.create({
          pointA: { x: toy.x, y: toy.y },
          bodyB: body,
          pointB: { x: 0, y: 0 },
          stiffness: 1,
          length: 0,
        });
        Matter.Composite.add(engine.world, [body, constraint]);
        map.set(toy.id, { body, constraint, hitFlash: 0, type: 'spinner' });
      } else if (toy.type === 'portal') {
        const body = Matter.Bodies.rectangle(toy.x, toy.y, 118, 26, {
          isStatic: true,
          isSensor: true,
          label: `toy:${toy.id}`,
        });
        Matter.Composite.add(engine.world, body);
        map.set(toy.id, { body, hitFlash: 0, type: 'portal' });
      }
    });
  }, []);

  // Choreographed Show playback starter
  const startChoreographedShow = useCallback(async () => {
    const snap = useHoloStore.getState().pinballShowSnapshot;
    if (!snap || snap.events.length === 0) return;

    showTrailsRef.current = { BEAT: [], PERC: [], MELODY: [], VIBE: [] };
    choreographyRef.current.platforms.forEach((p) => {
      p.flash = 0;
    });
    showFinaleRef.current = 0;
    setShowFinaleBloom(0);
    setShowPlaying(true);

    await holoAudio.playCompositionSnapshot(snap, {
      leadInMs: 420,
      loop: false,
      onEvent: (ev) => {
        const plat = choreographyRef.current.platforms.find((p) => p.id === ev.id);
        if (plat) {
          plat.flash = 1;
          stagePulseRef.current = ev.trackCategory === 'BEAT' ? 0.85 : 0.32;
          spawnVfx(
            plat.x,
            plat.y,
            plat.color,
            ev.pitch,
            ev.trackCategory === 'VIBE' ? 'chord' : 'hit',
            ev.trackCategory
          );
        }
      },
      onComplete: () => {
        setShowPlaying(false);
        showFinaleRef.current = 1;
        setShowFinaleBloom(1);
      },
    });
  }, [spawnVfx]);

  const stopChoreographedShow = useCallback(() => {
    holoAudio.stopSnapshotPlayback();
    setShowPlaying(false);
  }, []);

  // Stop show playback when leaving show mode
  useEffect(() => {
    if (pinballMode !== 'show') {
      holoAudio.stopSnapshotPlayback();
      setShowPlaying(false);
      setTheaterMode(false);
    } else {
      // Auto-launch show seamlessly when arriving from BeatDeck if audio is already unlocked!
      if (useHoloStore.getState().audioUnlocked && pinballShowSnapshot) {
        void startChoreographedShow();
      }
    }
  }, [pinballMode, pinballShowSnapshot, startChoreographedShow]);

  // Keyboard shortcuts for Undo/Redo in Free Jam
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) {
        e.preventDefault();
        undoPinball();
      } else if (
        (e.ctrlKey || e.metaKey) &&
        (e.key.toLowerCase() === 'y' || (e.shiftKey && e.key.toLowerCase() === 'z'))
      ) {
        e.preventDefault();
        redoPinball();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [undoPinball, redoPinball]);

  // Main Engine + Unified Dual-Mode Canvas Loop
  useEffect(() => {
    const engine = Matter.Engine.create({
      gravity: { x: 0, y: useHoloStore.getState().pinballGravity, scale: 0.001 },
    });
    engineRef.current = engine;

    const wallLeft = Matter.Bodies.rectangle(-16, ARENA_H / 2, 36, ARENA_H * 2, {
      isStatic: true,
      restitution: 0.92,
      label: 'wall',
    });
    const wallRight = Matter.Bodies.rectangle(ARENA_W + 16, ARENA_H / 2, 36, ARENA_H * 2, {
      isStatic: true,
      restitution: 0.92,
      label: 'wall',
    });
    Matter.Composite.add(engine.world, [wallLeft, wallRight]);

    syncToyBodies(true);

    Matter.Events.on(engine, 'collisionStart', (event) => {
      const state = useHoloStore.getState();
      // STRICT GUARD: never fire Matter.js physics sounds during Choreographed Show mode!
      if (state.pinballMode !== 'free') return;

      const nowMs = performance.now();

      event.pairs.forEach((pair) => {
        const bodyA = pair.bodyA.parent ?? pair.bodyA;
        const bodyB = pair.bodyB.parent ?? pair.bodyB;

        const isAMarble = bodyA.label === 'marble';
        const isBMarble = bodyB.label === 'marble';
        if (!isAMarble && !isBMarble) return;

        const marble = isAMarble ? bodyA : bodyB;
        const other = isAMarble ? bodyB : bodyA;
        if (!other.label.startsWith('toy:')) return;

        const toyId = other.label.slice(4);
        const toy = state.pinballToys.find((t) => t.id === toyId);
        if (!toy) return;

        const entry = toyBodyMapRef.current.get(toyId);
        const ballRec = ballsRef.current.find((b) => b.body === marble);

        if (toy.type === 'portal') {
          if (ballRec && nowMs - ballRec.lastWarp > 450) {
            ballRec.lastWarp = nowMs;
            ballRec.trail = [];
            if (entry) entry.hitFlash = 1;
            spawnVfx(marble.position.x, marble.position.y, '#7C3AED', 'WARP', 'warp', 'VIBE');
            Matter.Body.setPosition(marble, {
              x: state.pinballDropperX + (Math.random() - 0.5) * 16,
              y: 82,
            });
            Matter.Body.setVelocity(marble, { x: (Math.random() - 0.5) * 2.4, y: 1.8 });
            spawnVfx(state.pinballDropperX, 82, '#00D4AA', '↺', 'warp', 'VIBE');
            dropperRecoilRef.current = 0.7;
            void holoAudio.playSfx('portalWarp');
          }
          return;
        }

        const pairKey = `${marble.id}-${toyId}`;
        const prevTime = cooldownMapRef.current.get(pairKey) ?? 0;
        if (nowMs - prevTime < 90) return;

        const dvx = marble.velocity.x - other.velocity.x;
        const dvy = marble.velocity.y - other.velocity.y;
        const impactSpeed = Math.hypot(dvx, dvy);
        if (impactSpeed < 1.2) return;

        cooldownMapRef.current.set(pairKey, nowMs);

        if (toy.type === 'bumper') {
          const angle = Math.atan2(
            marble.position.y - other.position.y,
            marble.position.x - other.position.x
          );
          const boost = Math.min(13.5, Math.max(7.8, impactSpeed * state.pinballBounce * 1.18));
          Matter.Body.setVelocity(marble, {
            x: Math.cos(angle) * boost,
            y: Math.sin(angle) * boost,
          });
        }

        if (entry) entry.hitFlash = 1;
        if (ballRec) ballRec.squash = Math.min(1, 0.45 + impactSpeed * 0.05);

        const card = getCardById(toy.cardId);
        const vel = Math.min(1, Math.max(0.28, impactSpeed / 12));
        const contactX = pair.collision.supports[0]?.x ?? marble.position.x;
        const contactY = pair.collision.supports[0]?.y ?? marble.position.y;

        if (card.category === 'BEAT') {
          stagePulseRef.current = 0.65;
        }
        spawnVfx(contactX, contactY, card.accentColor, toy.note, 'hit', card.category);

        void holoAudio.previewCard(toy.cardId, {
          note: toy.note,
          velocity: vel,
          scale: state.scale,
        });

        recordedBufferRef.current.push({
          absTime: nowMs,
          timeOffsetMs: 0,
          cardId: toy.cardId,
          note: toy.note,
          velocity: vel,
          color: card.accentColor,
        });
        const cutoff = nowMs - RECORDING_WINDOW_MS;
        recordedBufferRef.current = recordedBufferRef.current.filter((e) => e.absTime >= cutoff);

        const firstT = recordedBufferRef.current[0]?.absTime ?? nowMs;
        const normalizedSnap: PinballRecordedEvent[] = recordedBufferRef.current.map((e) => ({
          timeOffsetMs: Math.max(0, Math.round(e.absTime - firstT)),
          cardId: e.cardId,
          note: e.note,
          velocity: e.velocity,
          color: e.color,
        }));
        setTimelineEvents(normalizedSnap);

        comboRef.current += 1;
        setCombo(comboRef.current);
        setHitDots((prev) => [
          ...prev.slice(-8),
          {
            id: Math.round(nowMs * 10 + Math.random() * 99),
            color: card.accentColor,
            note: toy.note,
          },
        ]);
      });
    });

    const initialDropTimer = window.setTimeout(() => {
      if (useHoloStore.getState().pinballMode === 'free') {
        dropSingleBall(true);
      }
    }, 150);

    let raf = 0;
    let lastTs = performance.now();
    let accumulator = 0;

    const loop = (ts: number) => {
      const rawDt = Math.min(64, Math.max(0, ts - lastTs));
      lastTs = ts;

      const state = useHoloStore.getState();
      const hidden = typeof document !== 'undefined' && document.hidden;

      stagePulseRef.current = Math.max(0, stagePulseRef.current * 0.9 - 0.01);
      showFinaleRef.current = Math.max(0, showFinaleRef.current * 0.985 - 0.002);

      // Fixed-timestep physics strictly in FREE JAM when tab is visible
      if (state.pinballMode === 'free' && !hidden) {
        engine.gravity.y = state.pinballGravity;
        accumulator += rawDt;
        let substeps = 0;
        while (accumulator >= FIXED_DT && substeps < 3) {
          Matter.Engine.update(engine, FIXED_DT);
          accumulator -= FIXED_DT;
          substeps++;
        }

        dropperRecoilRef.current = Math.max(0, dropperRecoilRef.current * 0.86 - 0.01);

        for (let i = ballsRef.current.length - 1; i >= 0; i--) {
          const b = ballsRef.current[i];
          b.squash = Math.max(0, b.squash * 0.84 - 0.01);
          b.trail.push({ x: b.body.position.x, y: b.body.position.y });
          if (b.trail.length > 9) b.trail.shift();

          if (b.body.position.y > ARENA_H + 55) {
            Matter.Composite.remove(engine.world, b.body);
            ballsRef.current.splice(i, 1);
          }
        }
      }

      const canvas = canvasRef.current;
      if (canvas) {
        const dpr = Math.min(2, window.devicePixelRatio || 1);
        const cssW = Math.max(100, canvas.clientWidth);
        const cssH = Math.max(100, canvas.clientHeight);
        const targetW = Math.round(cssW * dpr);
        const targetH = Math.round(cssH * dpr);
        if (canvas.width !== targetW || canvas.height !== targetH) {
          canvas.width = targetW;
          canvas.height = targetH;
        }
        const scaleFit = Math.min(cssW / ARENA_W, cssH / ARENA_H);
        const offsetX = (cssW - ARENA_W * scaleFit) / 2;
        const offsetY = (cssH - ARENA_H * scaleFit) / 2;
        viewTransformRef.current = { scale: scaleFit, offsetX, offsetY, cssW, cssH };

        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.save();
          ctx.scale(dpr, dpr);

          if (state.pinballMode === 'show') {
            drawShowBackdrop(ctx, cssW, cssH);
            ctx.translate(offsetX, offsetY);
            ctx.scale(scaleFit, scaleFit);
            drawChoreographedStage(ctx, ts, state.pinballShowSnapshot);
          } else {
            drawFreeJamBackdrop(ctx, cssW, cssH);
            ctx.translate(offsetX, offsetY);
            ctx.scale(scaleFit, scaleFit);
            drawFreeJamArena(ctx, ts, state.pinballToys, state.pinballDropperX);
          }

          drawVfxPool(ctx);
          ctx.restore();
        }
      }

      raf = requestAnimationFrame(loop);
    };

    const drawFreeJamBackdrop = (ctx: CanvasRenderingContext2D, cssW: number, cssH: number) => {
      ctx.fillStyle = '#E7E1D3';
      ctx.fillRect(0, 0, cssW, cssH);
      ctx.fillStyle = 'rgba(23, 23, 28, 0.13)';
      for (let gx = 16; gx < cssW; gx += 20) {
        for (let gy = 16; gy < cssH; gy += 20) {
          ctx.beginPath();
          ctx.arc(gx, gy, 1.15, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    };

    const drawShowBackdrop = (ctx: CanvasRenderingContext2D, cssW: number, cssH: number) => {
      ctx.fillStyle = '#121319';
      ctx.fillRect(0, 0, cssW, cssH);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.045)';
      ctx.lineWidth = 1;
      for (let gx = 24; gx < cssW; gx += 28) {
        ctx.beginPath();
        ctx.moveTo(gx, 0);
        ctx.lineTo(gx, cssH);
        ctx.stroke();
      }
      for (let gy = 24; gy < cssH; gy += 28) {
        ctx.beginPath();
        ctx.moveTo(0, gy);
        ctx.lineTo(cssW, gy);
        ctx.stroke();
      }
    };

    const drawChoreographedStage = (
      ctx: CanvasRenderingContext2D,
      t: number,
      snap: CompositionSnapshot | null
    ) => {
      const currMs = holoAudio.getSnapshotPlaybackMs();
      const isLive = holoAudio.isSnapshotPlaying();
      const { platforms, laneAnchors } = choreographyRef.current;
      const dur = Math.max(1200, snap?.durationMs ?? 4000);
      const prog = isLive && currMs >= 0 ? Math.min(1, currMs / dur) : 0;

      // Ambient Stage Spotlight Pulse synced to Beat impact + progress crescendo
      const glowAlpha = 0.08 + stagePulseRef.current * 0.18 + prog * 0.1;
      const rad = ctx.createRadialGradient(
        ARENA_W / 2,
        ARENA_H * 0.5,
        40,
        ARENA_W / 2,
        ARENA_H * 0.5,
        390
      );
      rad.addColorStop(0, `rgba(124, 58, 237, ${glowAlpha})`);
      rad.addColorStop(0.5, `rgba(0, 212, 170, ${glowAlpha * 0.65})`);
      rad.addColorStop(1, 'rgba(18, 19, 25, 0)');
      ctx.fillStyle = rad;
      ctx.fillRect(0, 0, ARENA_W, ARENA_H);

      // Architectural Concert Track Lanes
      const laneLabels: { cat: TrackCategory; y: number; name: string }[] = [
        { cat: 'VIBE', y: 175, name: 'VIBE · 氛围' },
        { cat: 'MELODY', y: 300, name: 'MELODY · 旋律' },
        { cat: 'PERC', y: 440, name: 'PERC · 打击' },
        { cat: 'BEAT', y: 558, name: 'BEAT · 低鼓' },
      ];

      laneLabels.forEach((l) => {
        const prof = TRACK_MOTION_PROFILES[l.cat];
        ctx.strokeStyle = 'rgba(255,255,255,0.08)';
        ctx.lineWidth = 1.2;
        ctx.setLineDash([4, 8]);
        ctx.beginPath();
        ctx.moveTo(46, l.y);
        ctx.lineTo(ARENA_W - 46, l.y);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.fillStyle = prof.color;
        ctx.font = '800 10px "JetBrains Mono", monospace';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'bottom';
        ctx.fillText(l.name, 22, l.y - 6);
      });

      // Vertical Audio-Clock Playhead Scanline
      if (isLive && currMs >= 0) {
        const px = 76 + prog * (ARENA_W - 152);
        const scanGrad = ctx.createLinearGradient(px - 22, 0, px + 6, 0);
        scanGrad.addColorStop(0, 'rgba(0, 212, 170, 0)');
        scanGrad.addColorStop(1, 'rgba(0, 212, 170, 0.25)');
        ctx.fillStyle = scanGrad;
        ctx.fillRect(px - 22, 74, 28, ARENA_H - 130);

        ctx.strokeStyle = '#00D4AA';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(px, 74);
        ctx.lineTo(px, ARENA_H - 56);
        ctx.stroke();
      }

      // Draw Faint Parabolic Preview Arcs between consecutive anchors in each lane
      TRACK_CATEGORIES.forEach((cat) => {
        const anchors = laneAnchors[cat];
        if (anchors.length < 2) return;
        const prof = TRACK_MOTION_PROFILES[cat];
        ctx.save();
        ctx.strokeStyle = prof.color;
        ctx.globalAlpha = 0.16;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        for (let i = 0; i < anchors.length - 1; i++) {
          const a = anchors[i];
          const b = anchors[i + 1];
          const midX = (a.x + b.x) / 2;
          const midY = (a.y + b.y) / 2 - 48 * prof.arcMultiplier;
          ctx.moveTo(a.x, a.y);
          ctx.quadraticCurveTo(midX, midY, b.x, b.y);
        }
        ctx.stroke();
        ctx.restore();
      });

      // Draw Deterministic Musical Platforms
      platforms.forEach((plat) => {
        plat.flash = Math.max(0, plat.flash - 0.045);
        const passed = isLive && currMs >= plat.timeMs;
        const f = plat.flash;

        ctx.save();
        ctx.translate(plat.x, plat.y);

        if (f > 0.05) {
          ctx.fillStyle = plat.color;
          ctx.globalAlpha = f * 0.42;
          ctx.beginPath();
          ctx.roundRect(-plat.width / 2 - 8, -14, plat.width + 16, 28, 12);
          ctx.fill();
          ctx.globalAlpha = 1;
        }

        ctx.fillStyle = f > 0.35 ? '#FFFDF8' : passed ? plat.color : '#1E202B';
        ctx.strokeStyle = plat.color;
        ctx.lineWidth = f > 0.2 ? 3 : 2;
        ctx.beginPath();
        ctx.roundRect(-plat.width / 2, -8, plat.width, 16, 7);
        ctx.fill();
        ctx.stroke();

        // Tiny pitch caption on Melody & Beat platforms
        if (plat.category === 'MELODY' || f > 0.25) {
          ctx.fillStyle = f > 0.35 ? '#17171C' : '#FBF9F4';
          ctx.font = '800 9px "JetBrains Mono", monospace';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(plat.pitch, 0, 0.5);
        }
        ctx.restore();
      });

      // Evaluate & Render the 4 Holo Motion Choreographed Sound Orbs!
      TRACK_CATEGORIES.forEach((cat) => {
        const anchors = laneAnchors[cat];
        const prof = TRACK_MOTION_PROFILES[cat];
        const trail = showTrailsRef.current[cat];

        if (!isLive || anchors.length === 0) {
          // Idle resting orb hovering softly above first platform
          if (anchors.length > 0) {
            const first = anchors[0];
            const hoverY = first.y - 20 + Math.sin(t * 0.004 + first.x) * 4;
            ctx.save();
            ctx.fillStyle = prof.color;
            ctx.shadowColor = prof.color;
            ctx.shadowBlur = 14;
            ctx.beginPath();
            ctx.arc(first.x, hoverY, prof.radius + 1, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
          }
          return;
        }

        const pose = evaluateChoreographedLaneOrb({
          anchors,
          category: cat,
          currentTimeMs: currMs,
          leadInMs: 420,
          baseArcHeight: 68,
        });

        if (!pose) return;

        trail.push({ x: pose.x, y: pose.y });
        if (trail.length > prof.trailLength + 5) trail.shift();

        // Luminous Comet Ribbon
        for (let ti = 1; ti < trail.length; ti++) {
          const p0 = trail[ti - 1];
          const p1 = trail[ti];
          const frac = ti / trail.length;
          ctx.save();
          ctx.globalAlpha = frac * 0.52;
          ctx.strokeStyle = prof.color;
          ctx.lineWidth = 2 + frac * (prof.radius * 1.4);
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(p0.x, p0.y);
          ctx.lineTo(p1.x, p1.y);
          ctx.stroke();
          ctx.restore();
        }

        ctx.save();
        ctx.translate(pose.x, pose.y);
        ctx.scale(pose.scaleX, pose.scaleY);

        ctx.shadowColor = prof.color;
        ctx.shadowBlur = 16 + pose.impact * 16;
        ctx.fillStyle = prof.color;
        ctx.strokeStyle = '#FFFDF8';
        ctx.lineWidth = 2.4;
        ctx.beginPath();
        ctx.arc(0, 0, prof.radius + 2.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.shadowBlur = 0;
        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        ctx.beginPath();
        ctx.arc(-2.5, -2.5, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      });

      // Finale Generative Sound Sigil Bloom when the Show Completes!
      if (showFinaleRef.current > 0.04 && showSigilRef.current) {
        const alpha = Math.min(1, showFinaleRef.current);
        const sigil = showSigilRef.current;
        ctx.save();
        ctx.translate(ARENA_W / 2, ARENA_H / 2 - 10);
        ctx.globalAlpha = alpha * 0.92;
        const scaleB = 0.85 + (1 - alpha) * 0.35;
        ctx.scale(scaleB, scaleB);

        ctx.fillStyle = 'rgba(20, 21, 27, 0.82)';
        ctx.strokeStyle = '#FFD426';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(0, 0, 124, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        sigil.spokes.forEach((sp) => {
          const r1 = 26;
          const r2 = r1 + sp.length * 86;
          ctx.strokeStyle = sp.color;
          ctx.lineWidth = sp.dot ? 3.5 : 1.5;
          ctx.beginPath();
          ctx.moveTo(Math.cos(sp.angle) * r1, Math.sin(sp.angle) * r1);
          ctx.lineTo(Math.cos(sp.angle) * r2, Math.sin(sp.angle) * r2);
          ctx.stroke();
        });

        ctx.fillStyle = '#FFD426';
        ctx.font = '900 14px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('✦ SHOW FINALE · SOUND SIGIL ✦', 0, 148);
        ctx.restore();
      }
    };

    const drawFreeJamArena = (
      ctx: CanvasRenderingContext2D,
      t: number,
      currentToys: PinballToy[],
      currDropperX: number
    ) => {
      ctx.save();
      ctx.strokeStyle = 'rgba(23, 23, 28, 0.08)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(14, 12, ARENA_W - 28, ARENA_H - 24, 16);
      ctx.stroke();

      ctx.setLineDash([4, 10]);
      ctx.strokeStyle = 'rgba(23, 23, 28, 0.07)';
      [185, 365, 535].forEach((ly) => {
        ctx.beginPath();
        ctx.moveTo(28, ly);
        ctx.lineTo(ARENA_W - 28, ly);
        ctx.stroke();
      });
      ctx.restore();

      if (comboRef.current >= 8 || stagePulseRef.current > 0.1) {
        const heatAlpha = Math.min(
          0.18,
          Math.max(0, (comboRef.current - 6) * 0.007) + stagePulseRef.current * 0.12
        );
        const rad = ctx.createRadialGradient(
          ARENA_W / 2,
          ARENA_H * 0.52,
          40,
          ARENA_W / 2,
          ARENA_H * 0.52,
          340
        );
        rad.addColorStop(0, `rgba(0, 212, 170, ${heatAlpha})`);
        rad.addColorStop(0.55, `rgba(124, 58, 237, ${heatAlpha * 0.7})`);
        rad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = rad;
        ctx.fillRect(0, 0, ARENA_W, ARENA_H);
      }

      // Aim Dashed Guide
      ctx.save();
      ctx.setLineDash([6, 6]);
      ctx.strokeStyle = 'rgba(23, 23, 28, 0.18)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(currDropperX, 80);
      ctx.lineTo(currDropperX, ARENA_H - 60);
      ctx.stroke();
      ctx.restore();

      // Top Horizontal Rail
      ctx.fillStyle = '#94A3B8';
      ctx.strokeStyle = '#17171C';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.roundRect(38, 34, ARENA_W - 76, 14, 6);
      ctx.fill();
      ctx.stroke();

      [26, ARENA_W - 56].forEach((ex) => {
        ctx.fillStyle = '#FFD426';
        ctx.beginPath();
        ctx.roundRect(ex, 20, 30, 42, 8);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#17171C';
        ctx.beginPath();
        ctx.arc(ex + 15, 32, 2.5, 0, Math.PI * 2);
        ctx.arc(ex + 15, 50, 2.5, 0, Math.PI * 2);
        ctx.fill();
      });

      // Sliding DROPPER
      const recoilY = -dropperRecoilRef.current * 5.5;
      ctx.save();
      ctx.translate(currDropperX, 42 + recoilY);

      if (dropperRecoilRef.current > 0.2) {
        ctx.fillStyle = `rgba(0, 212, 170, ${dropperRecoilRef.current * 0.55})`;
        ctx.beginPath();
        ctx.arc(0, 36, 16 + (1 - dropperRecoilRef.current) * 14, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.fillStyle = '#FFD426';
      ctx.strokeStyle = '#17171C';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.roundRect(-20, 14, 40, 22, 6);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#14151B';
      ctx.beginPath();
      ctx.ellipse(0, 34, 15, 5, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#17171C';
      ctx.beginPath();
      ctx.roundRect(-59, -22, 124, 44, 12);
      ctx.fill();

      ctx.fillStyle = '#FFD426';
      ctx.beginPath();
      ctx.roundRect(-62, -26, 124, 44, 12);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = 'rgba(255,255,255,0.45)';
      ctx.beginPath();
      ctx.roundRect(-54, -21, 108, 7, 4);
      ctx.fill();

      ctx.fillStyle = '#17171C';
      ctx.font = '900 15px "Space Grotesk", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('DROPPER', 0, -2);
      ctx.restore();

      // Draw All Placed Musical Physics Toys
      currentToys.forEach((toy) => {
        const entry = toyBodyMapRef.current.get(toy.id);
        if (!entry) return;
        entry.hitFlash = Math.max(0, entry.hitFlash - 0.055);
        const flash = entry.hitFlash;
        const scalePop = 1 + flash * 0.13;
        const card = getCardById(toy.cardId);

        ctx.save();
        ctx.translate(entry.body.position.x, entry.body.position.y);
        ctx.rotate(entry.body.angle);
        ctx.scale(scalePop, scalePop);

        if (toy.type === 'block') {
          ctx.fillStyle = '#17171C';
          ctx.beginPath();
          ctx.roundRect(-66, -12, 138, 34, 10);
          ctx.fill();

          const shift = Math.sin(t * 0.0022 + toy.x * 0.01) * 28;
          const holoGrad = ctx.createLinearGradient(-72 + shift, -22, 72 + shift, 22);
          holoGrad.addColorStop(0, card.accentColor);
          holoGrad.addColorStop(0.45, '#FFD426');
          holoGrad.addColorStop(0.75, '#00D4AA');
          holoGrad.addColorStop(1, card.accentColor);

          ctx.fillStyle = flash > 0.35 ? '#FBF9F4' : holoGrad;
          ctx.strokeStyle = '#17171C';
          ctx.lineWidth = 3.2;
          ctx.beginPath();
          ctx.roundRect(-69, -17, 138, 34, 10);
          ctx.fill();
          ctx.stroke();

          ctx.fillStyle = 'rgba(255,255,255,0.42)';
          ctx.beginPath();
          ctx.roundRect(-63, -13, 126, 7, 4);
          ctx.fill();

          ctx.fillStyle = '#17171C';
          [-58, 58].forEach((sx) => {
            ctx.beginPath();
            ctx.arc(sx, 0, 2.5, 0, Math.PI * 2);
            ctx.fill();
          });

          ctx.fillStyle = '#FBF9F4';
          ctx.strokeStyle = '#17171C';
          ctx.lineWidth = 2.4;
          ctx.beginPath();
          ctx.roundRect(-25, -12, 50, 24, 6);
          ctx.fill();
          ctx.stroke();

          ctx.fillStyle = '#17171C';
          ctx.font = '900 13.5px "JetBrains Mono", monospace';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(toy.note, 0, 1);
        } else if (toy.type === 'bumper') {
          const compress = flash * 6;
          ctx.fillStyle = card.accentColor;
          ctx.strokeStyle = '#17171C';
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.ellipse(0, 26, 25, 10, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();

          ctx.fillStyle = '#CBD5E1';
          ctx.beginPath();
          ctx.roundRect(-14, 8 + compress * 0.5, 28, 18 - compress * 0.5, 4);
          ctx.fill();
          ctx.stroke();

          ctx.fillStyle = flash > 0.3 ? '#FBF9F4' : card.accentColor;
          ctx.beginPath();
          ctx.arc(0, -4 + compress, 31, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();

          ctx.strokeStyle = '#FBF9F4';
          ctx.lineWidth = 3.5;
          ctx.beginPath();
          ctx.arc(0, -4 + compress, 19, 0, Math.PI * 2);
          ctx.stroke();
          ctx.fillStyle = '#FBF9F4';
          ctx.beginPath();
          ctx.arc(0, -4 + compress, 8, 0, Math.PI * 2);
          ctx.fill();
        } else if (toy.type === 'spinner') {
          ctx.fillStyle = flash > 0.3 ? '#FFD426' : card.accentColor;
          ctx.strokeStyle = '#17171C';
          ctx.lineWidth = 3.2;
          for (let b = 0; b < 4; b++) {
            ctx.save();
            ctx.rotate((b * Math.PI) / 2);
            ctx.beginPath();
            ctx.roundRect(-11, -59, 22, 50, 11);
            ctx.fill();
            ctx.stroke();
            ctx.restore();
          }
          ctx.fillStyle = '#FBF9F4';
          ctx.beginPath();
          ctx.arc(0, 0, 13, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
          ctx.fillStyle = '#17171C';
          ctx.beginPath();
          ctx.arc(0, 0, 4.5, 0, Math.PI * 2);
          ctx.fill();
        } else if (toy.type === 'portal') {
          const pulse = 0.55 + Math.sin(t * 0.008) * 0.35;
          ctx.strokeStyle = `rgba(0, 212, 170, ${pulse})`;
          ctx.lineWidth = 3.5;
          ctx.lineCap = 'round';
          [-46, -24, 0, 24, 46].forEach((bx, bi) => {
            const h = 16 + (bi % 2) * 12 + Math.sin(t * 0.01 + bi) * 4;
            ctx.beginPath();
            ctx.moveTo(bx, -14);
            ctx.lineTo(bx, -14 - h);
            ctx.stroke();
          });

          ctx.fillStyle = '#7C3AED';
          ctx.strokeStyle = '#17171C';
          ctx.lineWidth = 3.2;
          ctx.beginPath();
          ctx.ellipse(0, 4, 60, 18, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();

          ctx.fillStyle = '#14151B';
          ctx.beginPath();
          ctx.ellipse(0, 0, 46, 12, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = '#00D4AA';
          ctx.lineWidth = 2.8;
          ctx.stroke();
        }

        ctx.restore();
      });

      // Marbles
      ballsRef.current.forEach(({ body, color, trail, squash }) => {
        const { x, y } = body.position;
        const speed = Math.hypot(body.velocity.x, body.velocity.y);

        if (trail.length > 2) {
          for (let ti = 1; ti < trail.length; ti++) {
            const p0 = trail[ti - 1];
            const p1 = trail[ti];
            const frac = ti / trail.length;
            ctx.save();
            ctx.globalAlpha = frac * 0.36;
            ctx.strokeStyle = color;
            ctx.lineWidth = 3 + frac * 14;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(p0.x, p0.y);
            ctx.lineTo(p1.x, p1.y);
            ctx.stroke();
            ctx.restore();
          }
        }

        ctx.save();
        ctx.translate(x, y);
        const moveAng = Math.atan2(body.velocity.y, body.velocity.x);
        const stretch = 1 + Math.min(0.18, speed * 0.012) - squash * 0.16;
        const squish = 1 / stretch;
        ctx.rotate(moveAng);
        ctx.scale(stretch, squish);

        ctx.fillStyle = color;
        ctx.strokeStyle = '#17171C';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(0, 0, 14, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = 'rgba(255,255,255,0.82)';
        ctx.beginPath();
        ctx.ellipse(-4.5, -5, 4.8, 3, -0.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      });
    };

    const drawVfxPool = (ctx: CanvasRenderingContext2D) => {
      const pool = vfxPoolRef.current;
      for (let i = 0; i < pool.length; i++) {
        const v = pool[i];
        if (!v.active) continue;
        v.age++;
        if (v.age >= v.maxAge) {
          v.active = false;
          continue;
        }
        const p = v.age / v.maxAge;
        const easeOut = 1 - Math.pow(1 - p, 3);
        const alpha = 1 - p;

        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.translate(v.x, v.y);

        // Sound-family differentiated visual collision expressions!
        if (v.category === 'BEAT') {
          // Heavy Bass Dual Seismic Shockwave
          const r = 16 + easeOut * 66;
          ctx.strokeStyle = v.color;
          ctx.lineWidth = 6 * (1 - p * 0.6);
          ctx.beginPath();
          ctx.arc(0, 0, r, 0, Math.PI * 2);
          ctx.stroke();

          ctx.strokeStyle = '#FFD426';
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.arc(0, 0, r * 0.68, 0, Math.PI * 2);
          ctx.stroke();
        } else if (v.category === 'VIBE' || v.kind === 'chord') {
          // Luminous Atmospheric Prism Halo Bloom
          const rad = ctx.createRadialGradient(0, 0, 4, 0, 0, 26 + easeOut * 58);
          rad.addColorStop(0, v.color);
          rad.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.fillStyle = rad;
          ctx.globalAlpha = alpha * 0.58;
          ctx.beginPath();
          ctx.arc(0, 0, 26 + easeOut * 58, 0, Math.PI * 2);
          ctx.fill();
          ctx.globalAlpha = alpha;
        } else if (v.category === 'PERC') {
          // Crisp Geometric Spark Shards
          ctx.strokeStyle = v.color;
          ctx.lineWidth = 3;
          for (let ray = 0; ray < 8; ray++) {
            const ang = (ray * Math.PI) / 4 + p * 0.35;
            const r1 = 12 + easeOut * 22;
            const r2 = 24 + easeOut * 36;
            ctx.beginPath();
            ctx.moveTo(Math.cos(ang) * r1, Math.sin(ang) * r1);
            ctx.lineTo(Math.cos(ang) * r2, Math.sin(ang) * r2);
            ctx.stroke();
          }
        } else {
          // Melody Concentric Bell Ripples
          const r = 12 + easeOut * 52;
          ctx.strokeStyle = v.color;
          ctx.lineWidth = 3.5 * (1 - p * 0.5);
          ctx.beginPath();
          ctx.arc(0, 0, r, 0, Math.PI * 2);
          ctx.stroke();
          ctx.globalAlpha = alpha * 0.5;
          ctx.beginPath();
          ctx.arc(0, 0, r * 0.62, 0, Math.PI * 2);
          ctx.stroke();
          ctx.globalAlpha = alpha;
        }

        // Floating Pitch Badge Pill
        const floatY = -20 - easeOut * 30;
        ctx.fillStyle = '#14151B';
        ctx.strokeStyle = v.color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect(-22, floatY - 10, 44, 20, 10);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#FBF9F4';
        ctx.font = '900 10.5px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(v.kind === 'warp' ? '✦ WARP' : `♪ ${v.note}`, 0, floatY + 0.5);

        ctx.restore();
      }
    };

    raf = requestAnimationFrame(loop);

    return () => {
      window.clearTimeout(initialDropTimer);
      cancelAnimationFrame(raf);
      holoAudio.stopSnapshotPlayback();
      holoAudio.stopPinballRecording();
      Matter.World.clear(engine.world, false);
      Matter.Engine.clear(engine);
      engineRef.current = null;
      ballsRef.current = [];
    };
  }, [syncToyBodies, spawnVfx, dropSingleBall]);

  // Incremental toy body sync when toys change (fast single-body transform, zero jitter!)
  useEffect(() => {
    syncToyBodies(false);
  }, [toys, syncToyBodies]);

  // Full restitution sync only when bounce knob changes
  useEffect(() => {
    syncToyBodies(true);
  }, [bounce, syncToyBodies]);

  // Auto-Dropper strictly in FREE JAM mode
  useEffect(() => {
    if (!autoDrop || pinballMode !== 'free') return;
    const intervalMs = Math.round(1600 - dropRate * 1260);
    const id = window.setInterval(() => {
      if (!document.hidden) dropSingleBall(true);
    }, intervalMs);
    return () => window.clearInterval(id);
  }, [autoDrop, dropRate, pinballMode, dropSingleBall]);

  const toArenaCoords = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 400, y: 340 };
    const rect = canvas.getBoundingClientRect();
    const { scale: s, offsetX, offsetY } = viewTransformRef.current;
    return {
      x: (clientX - rect.left - offsetX) / s,
      y: (clientY - rect.top - offsetY) / s,
    };
  };

  const hitTestToy = (x: number, y: number): PinballToy | null => {
    for (let i = toys.length - 1; i >= 0; i--) {
      const t = toys[i];
      const dx = x - t.x;
      const dy = y - t.y;
      const radius =
        t.type === 'block' ? 70 : t.type === 'spinner' ? 60 : t.type === 'portal' ? 60 : 38;
      if (Math.hypot(dx, dy) <= radius) return t;
    }
    return null;
  };

  const handleCanvasPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (pinballMode !== 'free' || e.button === 2) return;
    const { x, y } = toArenaCoords(e.clientX, e.clientY);
    e.currentTarget.setPointerCapture(e.pointerId);

    if (y <= 84 && Math.abs(x - dropperX) <= 74) {
      dragStateRef.current = {
        mode: 'dropper',
        moved: false,
        undoPushed: false,
        startX: x,
        startY: y,
      };
      return;
    }

    const hit = hitTestToy(x, y);
    if (hit) {
      setSelectedToyId(hit.id);
      dragStateRef.current = {
        mode: 'toy',
        toyId: hit.id,
        moved: false,
        undoPushed: false,
        startX: x,
        startY: y,
      };
      playSfx('click', 0.65);
      return;
    }

    if (y > 96 && y < ARENA_H - 58) {
      const scaleNotes = SCALE_META[scale].shortNotes;
      const note = scaleNotes[toys.length % scaleNotes.length];
      const angle = selectedTool === 'block' ? (x < ARENA_W / 2 ? 0.22 : -0.22) : 0;
      const newId = addPinballToy({
        type: selectedTool,
        x: Math.round(x),
        y: Math.round(y),
        angle,
        cardId: bindCardId,
        note,
      });
      setSelectedToyId(newId);
      playSfx('cartridgeLock');
      void holoAudio.previewCard(bindCardId, { note, velocity: 0.72 });
    }
  };

  const handleCanvasPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (pinballMode !== 'free') return;
    const drag = dragStateRef.current;
    if (drag.mode === 'none') return;
    const { x, y } = toArenaCoords(e.clientX, e.clientY);

    if (drag.mode === 'dropper') {
      setPinballDropperX(Math.round(x));
      drag.moved = true;
    } else if (drag.mode === 'toy' && drag.toyId) {
      if (Math.hypot(x - drag.startX, y - drag.startY) > 4) {
        drag.moved = true;
        const shouldRecord = !drag.undoPushed;
        drag.undoPushed = true;
        updatePinballToy(
          drag.toyId,
          {
            x: Math.round(Math.min(ARENA_W - 55, Math.max(55, x))),
            y: Math.round(Math.min(ARENA_H - 64, Math.max(96, y))),
          },
          shouldRecord
        );
      }
    }
  };

  const handleCanvasPointerUp = () => {
    dragStateRef.current.mode = 'none';
  };

  const handleContextMenu = (e: React.MouseEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    if (pinballMode !== 'free') return;
    const { x, y } = toArenaCoords(e.clientX, e.clientY);
    const hit = hitTestToy(x, y);
    if (hit) {
      removePinballToy(hit.id);
      if (selectedToyId === hit.id) setSelectedToyId(null);
      playSfx('click', 0.25);
    }
  };

  const handlePlayRecording = async () => {
    if (playingRec) {
      holoAudio.stopPinballRecording();
      setPlayingRec(false);
      return;
    }
    const evs = timelineEvents.length > 0 ? timelineEvents : getNormalizedRecording();
    if (evs.length === 0) return;
    setPlayingRec(true);
    await holoAudio.playPinballRecording(evs, undefined, () => setPlayingRec(false));
  };

  const handleClearRecording = () => {
    recordedBufferRef.current = [];
    setTimelineEvents([]);
    setPinballRecordedEvents([]);
    holoAudio.stopPinballRecording();
    setPlayingRec(false);
    playSfx('click', 0.3);
  };

  const handleRecToForge = () => {
    const evs = timelineEvents.length > 0 ? timelineEvents : getNormalizedRecording();
    const ok = sendPinballToForge(evs);
    if (ok) playSfx('mintStamp');
  };

  const handleSendToBeatQuantize = () => {
    const evs = timelineEvents.length > 0 ? timelineEvents : getNormalizedRecording();
    const ok = sendPinballToBeatQuantize(evs);
    if (ok) playSfx('cartridgeLock');
  };

  const selectedToy = toys.find((t) => t.id === selectedToyId) ?? null;
  const unlockedCards = SOUND_CARDS.filter((c) => collection.includes(c.id));
  const recDurationSec =
    timelineEvents.length > 0
      ? (timelineEvents[timelineEvents.length - 1].timeOffsetMs / 1000).toFixed(1)
      : '0.0';

  const comboTitle =
    combo >= 30 ? 'SYMPHONY!' : combo >= 15 ? 'ON FIRE!' : combo >= 6 ? 'GROOVING' : 'LIVE HIT';

  const TOOL_ITEMS: { id: PinballToyType; label: string; icon: React.ReactNode }[] = [
    {
      id: 'block',
      label: 'BLOCK',
      icon: (
        <svg viewBox="0 0 36 28" className="w-8 h-6">
          <rect x="4" y="16" width="6" height="10" rx="1.5" fill="#17171C" />
          <rect x="13" y="10" width="6" height="16" rx="1.5" fill="#17171C" />
          <rect x="22" y="4" width="7" height="22" rx="1.5" fill="#17171C" />
        </svg>
      ),
    },
    {
      id: 'bumper',
      label: 'BUMPER',
      icon: (
        <svg viewBox="0 0 36 30" className="w-8 h-6">
          <rect
            x="11"
            y="16"
            width="14"
            height="10"
            rx="3"
            fill="#CBD5E1"
            stroke="#17171C"
            strokeWidth="2.5"
          />
          <ellipse
            cx="18"
            cy="11"
            rx="13"
            ry="8"
            fill="#FF5526"
            stroke="#17171C"
            strokeWidth="2.5"
          />
          <ellipse cx="18" cy="9" rx="5" ry="2.5" fill="#FBF9F4" />
        </svg>
      ),
    },
    {
      id: 'spinner',
      label: 'SPINNER',
      icon: (
        <svg viewBox="0 0 36 32" className="w-8 h-6">
          <g transform="translate(18,16)">
            <ellipse
              cx="0"
              cy="-8"
              rx="4"
              ry="7"
              fill="#7C3AED"
              stroke="#17171C"
              strokeWidth="2.2"
            />
            <ellipse
              cx="0"
              cy="8"
              rx="4"
              ry="7"
              fill="#7C3AED"
              stroke="#17171C"
              strokeWidth="2.2"
            />
            <ellipse
              cx="-8"
              cy="0"
              rx="7"
              ry="4"
              fill="#7C3AED"
              stroke="#17171C"
              strokeWidth="2.2"
            />
            <ellipse
              cx="8"
              cy="0"
              rx="7"
              ry="4"
              fill="#7C3AED"
              stroke="#17171C"
              strokeWidth="2.2"
            />
            <circle cx="0" cy="0" r="3.5" fill="#FBF9F4" stroke="#17171C" strokeWidth="2" />
          </g>
        </svg>
      ),
    },
    {
      id: 'portal',
      label: 'PORTAL',
      icon: (
        <svg viewBox="0 0 40 28" className="w-9 h-6">
          <line
            x1="12"
            y1="10"
            x2="12"
            y2="3"
            stroke="#00D4AA"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
          <line
            x1="20"
            y1="8"
            x2="20"
            y2="1"
            stroke="#00D4AA"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
          <line
            x1="28"
            y1="10"
            x2="28"
            y2="3"
            stroke="#00D4AA"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
          <ellipse
            cx="20"
            cy="19"
            rx="16"
            ry="7"
            fill="#7C3AED"
            stroke="#17171C"
            strokeWidth="2.5"
          />
          <ellipse
            cx="20"
            cy="18"
            rx="10"
            ry="3.5"
            fill="#00D4AA"
            stroke="#17171C"
            strokeWidth="1.8"
          />
        </svg>
      ),
    },
  ];

  return (
    <div
      className={`w-full h-full p-3 grid gap-3 overflow-hidden ${
        theaterMode
          ? 'grid-cols-1'
          : 'grid-cols-[minmax(215px,21.5%)_1fr_minmax(226px,22.5%)]'
      }`}
    >
      {/* ================= LEFT TOOLBELT PANEL ================= */}
      {!theaterMode && (
        <section className="brutal-panel p-3 flex flex-col justify-between gap-2 min-h-0 overflow-hidden">
          {pinballMode === 'free' ? (
            <>
              {/* BLOCKS 2x2 Grid */}
              <div className="shrink-0">
                <div className="flex items-center justify-between mb-1.5">
                  <h2 className="text-[13px] font-black tracking-wide uppercase text-[#17171C]">
                    BLOCKS
                  </h2>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => {
                        playSfx('click', 0.4);
                        undoPinball();
                      }}
                      disabled={pinballUndoCount === 0}
                      title="撤销机关操作 (Ctrl+Z)"
                      className="brutal-pad p-1 rounded-lg bg-[#FBF9F4] disabled:opacity-35"
                    >
                      <Undo2 className="w-3 h-3" />
                    </button>
                    <button
                      onClick={() => {
                        playSfx('click', 0.6);
                        redoPinball();
                      }}
                      disabled={pinballRedoCount === 0}
                      title="重做机关操作 (Ctrl+Y)"
                      className="brutal-pad p-1 rounded-lg bg-[#FBF9F4] disabled:opacity-35"
                    >
                      <Redo2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  {TOOL_ITEMS.map((item) => {
                    const active = selectedTool === item.id;
                    return (
                      <button
                        key={item.id}
                        onClick={() => {
                          playSfx('click', 0.72);
                          setPinballTool(item.id);
                        }}
                        className={`brutal-btn py-1.5 px-1 rounded-xl flex flex-col items-center justify-center gap-0.5 ${
                          active ? 'bg-[#00D4AA] text-[#17171C]' : 'bg-[#FBF9F4] text-[#17171C]'
                        }`}
                      >
                        {item.icon}
                        <span className="text-[10px] font-black tracking-wider">{item.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* BIND CARD Stack */}
              <div className="flex-1 flex flex-col min-h-0">
                <div className="flex items-center justify-between mb-1 shrink-0">
                  <h2 className="text-[12.5px] font-black tracking-wide uppercase text-[#17171C]">
                    BIND CARD
                  </h2>
                  <span className="hw-silkscreen !text-[8px]">绑定碰撞音色</span>
                </div>
                <div className="flex-1 overflow-y-auto holo-scroll pr-0.5 flex flex-col gap-1.5">
                  {unlockedCards.map((c) => {
                    const isBound = bindCardId === c.id;
                    const rar = RARITY_META[c.rarity];
                    const cat = CATEGORY_META[c.category];
                    return (
                      <button
                        key={c.id}
                        onClick={() => {
                          playSfx('cartridgeLock');
                          setPinballBindCardId(c.id);
                          if (selectedToyId) {
                            updatePinballToy(selectedToyId, { cardId: c.id }, true);
                          }
                          void holoAudio.previewCard(c.id);
                        }}
                        className={`relative h-[50px] shrink-0 rounded-xl border-[2.5px] border-[#17171C] overflow-hidden cursor-pointer transition-all flex items-stretch text-left ${
                          isBound
                            ? 'bg-[#14151B] text-[#FBF9F4] ring-2 ring-[#00D4AA] shadow-[3px_3px_0px_0px_#17171C] -translate-y-0.5'
                            : 'bg-[#FBF9F4] text-[#17171C] hover:bg-[#F3EFE6] shadow-[2px_2px_0px_0px_#17171C]'
                        }`}
                      >
                        <div className="w-1.5 shrink-0" style={{ backgroundColor: cat.color }} />
                        <div className="w-10 h-full shrink-0 border-r-[2px] border-[#17171C] holo-thumb-sheen">
                          <CardArtwork artId={c.artId} />
                        </div>
                        <div className="flex-1 px-2 py-1 flex flex-col justify-between min-w-0">
                          <div className="flex items-center justify-between gap-1">
                            <span
                              className="px-1.5 py-[0.5px] rounded text-[8px] font-black border border-[#17171C]"
                              style={{ backgroundColor: rar.bg, color: rar.text }}
                            >
                              {rar.label}
                            </span>
                            <span
                              className={`font-mono-hw text-[9px] font-bold ${
                                isBound ? 'text-[#00D4AA]' : 'text-[#626272]'
                              }`}
                            >
                              {c.code}
                            </span>
                          </div>
                          <div className="flex items-baseline justify-between gap-1 min-w-0">
                            <span className="text-[11.5px] font-black italic tracking-tight shrink-0 leading-none">
                              {c.shortTitle}
                            </span>
                            <span
                              className={`text-[9px] font-bold truncate hidden xl:inline ${
                                isBound ? 'text-white/60' : 'text-[#626272]'
                              }`}
                            >
                              {c.zhTitle}
                            </span>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* PRESETS Row */}
              <div className="shrink-0 pt-0.5">
                <h2 className="text-[12px] font-black tracking-wide uppercase text-[#17171C] mb-1">
                  PRESETS
                </h2>
                <div className="grid grid-cols-3 gap-1.5">
                  {(['LOOP', 'CASCADE', 'CLEAR'] as const).map((preset) => (
                    <button
                      key={preset}
                      onClick={() => {
                        playSfx(preset === 'CLEAR' ? 'click' : 'cartridgeLock');
                        applyPinballPreset(preset);
                        setSelectedToyId(null);
                      }}
                      className={`brutal-pad py-1.5 rounded-lg text-[10px] font-black tracking-wide ${
                        preset === 'CLEAR'
                          ? 'bg-[#FBF9F4] hover:bg-[#FF5526] hover:text-white'
                          : 'bg-[#FBF9F4] hover:bg-[#FFD426]'
                      }`}
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>
            </>
          ) : (
            /* CHOREOGRAPHED SHOW INFO PANEL */
            <div className="flex flex-col justify-between h-full gap-2.5">
              <div>
                <span className="hw-silkscreen !text-[8.5px]">HOLO MOTION THEATRE</span>
                <h2 className="text-base font-black uppercase text-[#17171C] mt-0.5">
                  编曲剧场演出
                </h2>
                <p className="text-[11px] font-bold text-[#626272] mt-1 leading-relaxed">
                  由 02 BEAT 冻结的真实音符时间轴驱动，4 轨光球按真实音乐时钟沿抛物线精准落点，零物理杂音。
                </p>
              </div>

              {pinballShowSnapshot && (
                <div className="rounded-xl bg-[#14151B] text-[#FBF9F4] border-[2px] border-[#17171C] p-2.5 flex flex-col gap-1.5 font-mono-hw text-[10.5px]">
                  <div className="flex justify-between">
                    <span className="text-white/55">EVENTS</span>
                    <span className="text-[#00D4AA] font-bold">
                      {pinballShowSnapshot.events.length} NOTES
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-white/55">TEMPO</span>
                    <span className="text-[#FFD426] font-bold">{pinballShowSnapshot.bpm} BPM</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-white/55">DURATION</span>
                    <span className="font-bold">
                      {(pinballShowSnapshot.durationMs / 1000).toFixed(1)} s
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-white/55">SCALE</span>
                    <span className="font-bold">{SCALE_META[pinballShowSnapshot.scale].label}</span>
                  </div>
                </div>
              )}

              <div className="flex flex-col gap-1.5">
                {TRACK_CATEGORIES.map((cat) => (
                  <div
                    key={cat}
                    className="flex items-center justify-between px-2.5 py-1.5 rounded-xl bg-[#FBF9F4] border-[2px] border-[#17171C] text-[10.5px] font-black"
                  >
                    <span className="flex items-center gap-1.5">
                      <span
                        className="w-2.5 h-2.5 rounded-full border border-[#17171C]"
                        style={{ backgroundColor: TRACK_MOTION_PROFILES[cat].color }}
                      />
                      {cat}
                    </span>
                    <span className="font-mono-hw text-[#626272]">
                      {choreography.laneAnchors[cat].length} hits
                    </span>
                  </div>
                ))}
              </div>

              <button
                onClick={() => {
                  playSfx('cartridgeLock');
                  performBeatInPinball();
                }}
                className="brutal-btn py-2 px-2.5 rounded-xl bg-[#FBF9F4] hover:bg-[#FFD426] text-[11px] font-black flex items-center justify-center gap-1.5"
              >
                <Wand2 className="w-3.5 h-3.5" />
                <span>同步最新节拍台编曲</span>
              </button>
            </div>
          )}
        </section>
      )}

      {/* ================= CENTER DUAL-MODE PINBALL / SHOW STAGE ================= */}
      <section
        className={`relative rounded-[18px] border-[2.5px] border-[#17171C] shadow-[inset_0_2px_8px_rgba(23,23,28,0.12),4px_4px_0px_0px_#17171C] overflow-hidden flex flex-col min-h-0 ${
          pinballMode === 'show' ? 'bg-[#121319]' : 'bg-[#E7E1D3]'
        }`}
      >
        {/* Top Floating Mode Switcher & Stage Utility Bar */}
        <div className="absolute top-2.5 left-3 right-3 z-20 flex items-center justify-between gap-2 pointer-events-none">
          <div className="pointer-events-auto flex items-center gap-1 bg-[#14151B]/92 p-1 rounded-xl border-[2px] border-[#17171C] shadow-[2px_2px_0px_#17171C]">
            <button
              onClick={() => {
                playSfx('tab');
                setPinballMode('free');
              }}
              className={`px-2.5 py-1 rounded-lg text-[10.5px] font-black tracking-wide transition-colors cursor-pointer ${
                pinballMode === 'free'
                  ? 'bg-[#00D4AA] text-[#17171C]'
                  : 'text-white/75 hover:text-white'
              }`}
            >
              FREE JAM · 自由弹珠
            </button>
            <button
              onClick={() => {
                playSfx('tab');
                setPinballMode('show');
              }}
              className={`px-2.5 py-1 rounded-lg text-[10.5px] font-black tracking-wide transition-colors cursor-pointer flex items-center gap-1 ${
                pinballMode === 'show'
                  ? 'bg-[#FFD426] text-[#17171C]'
                  : 'text-white/75 hover:text-white'
              }`}
            >
              <Sparkles className="w-3 h-3" />
              <span>SHOW · 编曲演出</span>
            </button>
          </div>

          <div className="pointer-events-auto flex items-center gap-1.5">
            {pinballRemixOrigin && pinballMode === 'free' && (
              <span className="px-2 py-1 rounded-lg bg-[#7C3AED] text-white border-[2px] border-[#17171C] font-mono-hw text-[10px] font-black">
                REMIX OF {pinballRemixOrigin.parentCode} · GEN {pinballRemixOrigin.lineageDepth}
              </span>
            )}
            {pinballMode === 'show' && (
              <button
                onClick={() => {
                  playSfx('click', 0.7);
                  setTheaterMode((v) => !v);
                }}
                title={theaterMode ? '退出剧场沉浸视图' : '展开剧场沉浸视图'}
                className="brutal-pad px-2.5 py-1 rounded-lg bg-[#14151B] text-[#FFD426] border-[#FFD426] text-[10.5px] font-black flex items-center gap-1"
              >
                {theaterMode ? (
                  <>
                    <Minimize2 className="w-3 h-3" /> 退出剧场
                  </>
                ) : (
                  <>
                    <Maximize2 className="w-3 h-3" /> 剧场模式
                  </>
                )}
              </button>
            )}
          </div>
        </div>

        <canvas
          ref={canvasRef}
          onPointerDown={handleCanvasPointerDown}
          onPointerMove={handleCanvasPointerMove}
          onPointerUp={handleCanvasPointerUp}
          onPointerCancel={handleCanvasPointerUp}
          onContextMenu={handleContextMenu}
          className={`w-full h-full block touch-none ${
            pinballMode === 'free' ? 'cursor-crosshair' : 'cursor-default'
          }`}
        />

        {/* Selected Toy Floating Micro-Toolbar (FREE JAM) */}
        {pinballMode === 'free' && selectedToy && (
          <div className="absolute bottom-[56px] left-1/2 -translate-x-1/2 z-20 flex items-center gap-1.5 bg-[#14151B] text-[#FBF9F4] border-[2px] border-[#FFD426] rounded-2xl px-3 py-1.5 shadow-[0_8px_20px_rgba(0,0,0,0.4),3px_3px_0px_0px_#17171C]">
            <span className="font-mono-hw text-[11px] font-black text-[#FFD426] uppercase">
              {selectedToy.type}
            </span>
            <span className="text-white/25">|</span>
            {selectedToy.type === 'block' && (
              <>
                <button
                  onClick={() => {
                    playSfx('knobTick', 0.4);
                    updatePinballToy(
                      selectedToy.id,
                      { angle: selectedToy.angle - Math.PI / 12 },
                      true
                    );
                  }}
                  className="p-1 rounded-lg bg-white/10 hover:bg-[#00D4AA] hover:text-[#17171C] cursor-pointer"
                  title="逆时针旋转 15°"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => {
                    playSfx('knobTick', 0.7);
                    updatePinballToy(
                      selectedToy.id,
                      { angle: selectedToy.angle + Math.PI / 12 },
                      true
                    );
                  }}
                  className="p-1 rounded-lg bg-white/10 hover:bg-[#00D4AA] hover:text-[#17171C] cursor-pointer"
                  title="顺时针旋转 15°"
                >
                  <RotateCw className="w-3.5 h-3.5" />
                </button>
              </>
            )}
            <button
              onClick={() => {
                const notes = SCALE_META[scale].notes;
                const next = notes[(notes.indexOf(selectedToy.note) + 1) % notes.length];
                updatePinballToy(selectedToy.id, { note: next }, true);
                void holoAudio.previewCard(selectedToy.cardId, { note: next });
              }}
              className="px-2 py-0.5 rounded-lg bg-[#7C3AED] font-mono-hw text-xs font-black cursor-pointer hover:brightness-110"
              title="切换音阶音高"
            >
              ♪ {selectedToy.note}
            </button>
            <button
              onClick={() => {
                playSfx('click', 0.2);
                removePinballToy(selectedToy.id);
                setSelectedToyId(null);
              }}
              className="p-1 rounded-lg bg-[#FF5526] text-white cursor-pointer hover:brightness-110"
              title="删除机关（或右键点击机关）"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Visible 8-Second Rolling Recording Timeline Bar (FREE JAM) */}
        {pinballMode === 'free' && (
          <div className="absolute bottom-2.5 left-3 right-3 z-20 flex items-center gap-2 bg-[#14151B]/95 text-[#FBF9F4] border-[2px] border-[#17171C] rounded-xl px-2.5 py-1.5 shadow-[0_6px_16px_rgba(0,0,0,0.3)]">
            <div className="flex items-center gap-1.5 shrink-0">
              <span
                className={`w-2 h-2 rounded-full ${
                  timelineEvents.length > 0 ? 'bg-[#FF5526] animate-pulse' : 'bg-white/25'
                }`}
              />
              <span className="font-mono-hw text-[10px] font-bold text-[#FFD426] whitespace-nowrap">
                8S REC · {timelineEvents.length} 音符 ({recDurationSec}s)
              </span>
            </div>

            {/* Event Tick Track */}
            <div className="flex-1 h-5 rounded-md bg-white/[0.06] border border-white/10 relative overflow-hidden">
              {timelineEvents.length === 0 ? (
                <span className="absolute inset-0 flex items-center justify-center text-[9.5px] font-bold text-white/40">
                  投放弹珠撞击音块后，碰撞音符将自动记录到此时间轴
                </span>
              ) : (
                timelineEvents.map((ev, i) => {
                  const pct = Math.min(98, (ev.timeOffsetMs / RECORDING_WINDOW_MS) * 100);
                  return (
                    <span
                      key={i}
                      style={{ left: `${pct}%`, backgroundColor: ev.color }}
                      title={`${ev.note} @ ${(ev.timeOffsetMs / 1000).toFixed(2)}s`}
                      className="absolute top-1 bottom-1 w-[4px] rounded-full shadow-[0_0_5px_currentColor]"
                    />
                  );
                })
              )}
            </div>

            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={() => void handlePlayRecording()}
                disabled={timelineEvents.length === 0}
                title="试听当前录制的弹珠片段"
                className="px-2 py-1 rounded-lg bg-[#00D4AA] text-[#17171C] text-[10px] font-black disabled:opacity-35 cursor-pointer flex items-center gap-1"
              >
                {playingRec ? (
                  <>
                    <Square className="w-2.5 h-2.5 fill-current" /> 停
                  </>
                ) : (
                  <>
                    <Play className="w-2.5 h-2.5 fill-current" /> 试听
                  </>
                )}
              </button>
              <button
                onClick={handleSendToBeatQuantize}
                disabled={timelineEvents.length === 0}
                title="送回 02 节拍台进行幽灵量化预览"
                className="px-2 py-1 rounded-lg bg-[#7C3AED] text-white text-[10px] font-black disabled:opacity-35 cursor-pointer flex items-center gap-1"
              >
                <Music className="w-2.5 h-2.5" /> 送节拍台
              </button>
              <button
                onClick={handleClearRecording}
                disabled={timelineEvents.length === 0}
                title="清空当前录音缓冲"
                className="p-1 rounded-lg bg-white/10 text-white/75 hover:bg-[#FF5526] hover:text-white disabled:opacity-30 cursor-pointer"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          </div>
        )}

        {/* Choreographed Show Bottom Transport Strip */}
        {pinballMode === 'show' && (
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 bg-[#14151B]/95 border-[2px] border-[#FFD426] rounded-2xl px-3.5 py-2 shadow-[0_10px_28px_rgba(0,0,0,0.55)]">
            <button
              onClick={() =>
                showPlaying ? stopChoreographedShow() : void startChoreographedShow()
              }
              className={`brutal-btn px-4 py-1.5 rounded-xl text-xs font-black tracking-wide flex items-center gap-1.5 ${
                showPlaying ? 'bg-[#FF5526] text-white' : 'bg-[#00D4AA] text-[#17171C]'
              }`}
            >
              {showPlaying ? (
                <>
                  <Square className="w-3.5 h-3.5 fill-current" /> STOP SHOW
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 fill-current" />{' '}
                  {showFinaleBloom > 0 ? 'REPLAY SHOW' : 'PLAY CHOREOGRAPHED SHOW'}
                </>
              )}
            </button>
            <button
              onClick={() => {
                playSfx('mintStamp');
                stopChoreographedShow();
                sendBeatToForge();
              }}
              className="brutal-btn px-3 py-1.5 rounded-xl bg-[#FFD426] text-[#17171C] text-xs font-black flex items-center gap-1"
            >
              <span>去铸造屋封存</span>
              <span>→</span>
            </button>
          </div>
        )}
      </section>

      {/* ================= RIGHT CONTROL & RECORDING POD ================= */}
      {!theaterMode && (
        <section className="brutal-panel p-3 flex flex-col justify-between gap-2 min-h-0">
          {pinballMode === 'free' ? (
            <>
              <div className="grid grid-cols-[1.45fr_1fr] gap-2 shrink-0">
                <button
                  onClick={() => dropSingleBall(false)}
                  className="brutal-btn py-2.5 px-2 rounded-xl bg-[#00D4AA] text-[#17171C] text-sm font-black tracking-wide flex items-center justify-center gap-1"
                >
                  <Play className="w-4 h-4 fill-current" />
                  <span>DROP BALL</span>
                </button>
                <button
                  onClick={() => {
                    playSfx('click', autoDrop ? 0.35 : 0.85);
                    setPinballAutoDrop(!autoDrop);
                  }}
                  className={`brutal-btn py-2 px-2 rounded-xl text-xs font-black leading-tight flex items-center justify-center gap-1.5 ${
                    autoDrop ? 'bg-[#FF5526] text-[#17171C]' : 'bg-[#FBF9F4] text-[#17171C]'
                  }`}
                >
                  <span
                    className={`w-3 h-3 rounded-full border-2 border-[#17171C] shrink-0 ${
                      autoDrop ? 'bg-[#FBF9F4] animate-pulse' : 'bg-[#E7E1D3]'
                    }`}
                  />
                  <span>
                    AUTO
                    <br />
                    {autoDrop ? 'ON' : 'OFF'}
                  </span>
                </button>
              </div>

              <div className="flex flex-col gap-3 py-0.5">
                <BrutalSlider
                  label="GRAVITY"
                  value={(gravity - 0.25) / 1.95}
                  onChange={(v) => setPinballGravity(0.25 + v * 1.95)}
                  color="#7C3AED"
                  height={13}
                />
                <BrutalSlider
                  label="DROP RATE"
                  value={(dropRate - 0.1) / 0.9}
                  onChange={(v) => setPinballDropRate(0.1 + v * 0.9)}
                  color="#FF5526"
                  height={13}
                />
              </div>

              <div className="flex items-center justify-between gap-2 py-1.5 border-y-[1.5px] border-[#17171C]/12">
                <BrutalKnob
                  value={(bounce - 0.5) / 0.85}
                  onChange={(v) => setPinballBounce(0.5 + v * 0.85)}
                  color="#FFD426"
                  size={40}
                  label="BOUNCE"
                  title="上下拖拽或滚轮调节弹珠全局弹性"
                />
                <div className="h-10 w-[1.5px] bg-[#17171C]/18" />
                <button
                  onClick={() => {
                    playSfx('click', 0.75);
                    cycleScale();
                  }}
                  title={`调式锁定：${SCALE_META[scale].zhLabel}`}
                  className="brutal-btn flex-1 py-2 px-2 rounded-xl bg-[#FBF9F4] font-mono-hw text-xs font-black flex items-center justify-center gap-1"
                >
                  <span>{SCALE_META[scale].label}</span>
                  <ChevronDown className="w-3.5 h-3.5" strokeWidth={3} />
                </button>
              </div>

              <div className="relative oled-scanlines rounded-2xl bg-[#14151B] border-[2.5px] border-[#17171C] shadow-[inset_0_3px_10px_rgba(0,0,0,0.65)] p-2.5 flex flex-col justify-between gap-1.5 h-[128px] shrink-0">
                <div className="flex items-center justify-between">
                  <span className="font-mono-hw text-[10px] font-bold tracking-[0.14em] text-white/75">
                    {comboTitle}
                  </span>
                  <span className="font-mono-hw text-[10px] font-bold text-[#FFD426]">
                    {toys.length} TOYS
                  </span>
                </div>

                <div className="flex items-center justify-center gap-1.5">
                  <span className="text-[#FFD426] font-black text-sm">ミ</span>
                  <span
                    className={`font-black text-[21px] tracking-tight leading-none ${
                      combo >= 15 ? 'text-[#FFD426]' : 'text-[#00D4AA]'
                    }`}
                  >
                    COMBO x{combo}
                  </span>
                  <span className="text-[#FFD426] font-black text-sm">彡</span>
                </div>

                <div className="h-6 rounded-full bg-white/[0.07] px-2 flex items-center justify-center gap-1.5 overflow-hidden">
                  {hitDots.length === 0 ? (
                    <span className="font-mono-hw text-[9px] text-white/40">WAITING HITS...</span>
                  ) : (
                    hitDots.slice(-9).map((dot) => (
                      <span
                        key={dot.id}
                        title={dot.note}
                        style={{ backgroundColor: dot.color }}
                        className="w-3.5 h-3.5 rounded-full border border-black/50 shrink-0 shadow-[0_0_7px_rgba(255,255,255,0.35)]"
                      />
                    ))
                  )}
                </div>
              </div>

              <button
                onClick={handleRecToForge}
                className={`brutal-btn-lg w-full py-2.5 rounded-2xl text-[13.5px] font-black tracking-wide uppercase flex items-center justify-center gap-1.5 shrink-0 ${
                  timelineEvents.length > 0
                    ? 'bg-[#FFD426] text-[#17171C]'
                    : 'bg-[#E7E1D3] text-[#626272]'
                }`}
              >
                <span>
                  {timelineEvents.length > 0
                    ? `CAPTURE ${timelineEvents.length} NOTES`
                    : 'REC TO FORGE'}
                </span>
                <span className="text-base leading-none">→</span>
              </button>
            </>
          ) : (
            /* RIGHT POD IN CHOREOGRAPHED SHOW MODE */
            <div className="flex flex-col gap-2.5 h-full">
              <div className="rounded-2xl bg-[#14151B] text-[#FBF9F4] border-[2.5px] border-[#17171C] p-3 flex flex-col gap-2 shrink-0">
                <div className="flex items-center justify-between">
                  <span className="font-mono-hw text-[10px] font-bold text-[#00D4AA]">
                    SHOW DIRECTOR
                  </span>
                  <span
                    className={`w-2 h-2 rounded-full ${
                      showPlaying ? 'bg-[#00D4AA] animate-ping' : 'bg-[#FFD426]'
                    }`}
                  />
                </div>
                <p className="text-[11px] font-bold text-white/75 leading-relaxed">
                  观察 4 条声部光球如何在同一音乐时钟下弹跳、触发和弦涟漪，并在终场绽放作品专属「声音纹章」。
                </p>
              </div>

              {pinballShowSnapshot && (
                <div className="flex-1 rounded-2xl bg-[#14151B] text-[#FBF9F4] border-[2.5px] border-[#17171C] p-3 flex flex-col items-center justify-center gap-2 min-h-0">
                  <span className="font-mono-hw text-[9px] font-bold tracking-[0.16em] text-[#FFD426] uppercase">
                    FINALE SOUND SIGIL PREVIEW
                  </span>
                  <SoundSigil snapshot={pinballShowSnapshot} size={116} />
                  <span className="text-[10px] font-bold text-white/60 text-center">
                    终场将随作品声学结构自动绽放
                  </span>
                </div>
              )}

              <div className="flex flex-col gap-2 shrink-0">
                <button
                  onClick={() =>
                    showPlaying ? stopChoreographedShow() : void startChoreographedShow()
                  }
                  className={`brutal-btn-lg py-2.5 rounded-2xl text-sm font-black tracking-wide uppercase flex items-center justify-center gap-1.5 ${
                    showPlaying ? 'bg-[#FF5526] text-white' : 'bg-[#00D4AA] text-[#17171C]'
                  }`}
                >
                  {showPlaying ? (
                    <>
                      <Square className="w-4 h-4 fill-current" /> STOP SHOW
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4 fill-current" /> PLAY SHOW
                    </>
                  )}
                </button>

                <button
                  onClick={() => {
                    playSfx('tab');
                    setPinballMode('free');
                  }}
                  className="brutal-btn py-2 rounded-xl bg-[#FBF9F4] text-[#17171C] text-xs font-black"
                >
                  切回自由物理弹珠实验
                </button>

                <button
                  onClick={() => {
                    playSfx('mintStamp');
                    stopChoreographedShow();
                    sendBeatToForge();
                  }}
                  className="brutal-btn-lg w-full py-2.5 rounded-2xl bg-[#FFD426] text-[#17171C] text-[13px] font-black tracking-wide uppercase flex items-center justify-center gap-1.5"
                >
                  <span>送去闪卡铸造屋</span>
                  <span className="text-base leading-none">→</span>
                </button>
              </div>
            </div>
          )}
        </section>
      )}
    </div>
  );
};
