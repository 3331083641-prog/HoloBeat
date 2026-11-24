import React, { useCallback, useEffect, useRef, useState } from 'react';
import Matter from 'matter-js';
import { ChevronDown, Play, RotateCcw, RotateCw, Trash2 } from 'lucide-react';
import { holoAudio } from '../audio/HoloAudioEngine';
import { useHoloSfx } from '../audio/useHoloSfx';
import { CardArtwork } from '../components/artwork/CardArtwork';
import { BrutalKnob } from '../components/ui/BrutalKnob';
import { BrutalSlider } from '../components/ui/BrutalSlider';
import {
  CATEGORY_META,
  RARITY_META,
  SCALE_META,
  SOUND_CARDS,
  getCardById,
} from '../data/soundCards';
import { useHoloStore } from '../store/useHoloStore';
import type { PinballRecordedEvent, PinballToy, PinballToyType } from '../types/holo';

const ARENA_W = 800;
const ARENA_H = 520;
const MAX_BALLS = 24;
const MARBLE_COLORS = ['#FF5C2B', '#7C3AED', '#00D4AA', '#FFD60A', '#FF3D9A'];

interface VfxSlot {
  active: boolean;
  x: number;
  y: number;
  color: string;
  age: number;
  maxAge: number;
  note: string;
  kind: 'hit' | 'warp';
}

interface HitDot {
  id: number;
  color: string;
  note: string;
}

export const PinballPage: React.FC = () => {
  const toys = useHoloStore((s) => s.pinballToys);
  const selectedTool = useHoloStore((s) => s.pinballTool);
  const bindCardId = useHoloStore((s) => s.pinballBindCardId);
  const dropperX = useHoloStore((s) => s.pinballDropperX);
  const autoDrop = useHoloStore((s) => s.pinballAutoDrop);
  const gravity = useHoloStore((s) => s.pinballGravity);
  const dropRate = useHoloStore((s) => s.pinballDropRate);
  const bounce = useHoloStore((s) => s.pinballBounce);
  const scale = useHoloStore((s) => s.scale);
  const collection = useHoloStore((s) => s.collection);

  const setPinballTool = useHoloStore((s) => s.setPinballTool);
  const setPinballBindCardId = useHoloStore((s) => s.setPinballBindCardId);
  const setPinballDropperX = useHoloStore((s) => s.setPinballDropperX);
  const setPinballAutoDrop = useHoloStore((s) => s.setPinballAutoDrop);
  const setPinballGravity = useHoloStore((s) => s.setPinballGravity);
  const setPinballDropRate = useHoloStore((s) => s.setPinballDropRate);
  const setPinballBounce = useHoloStore((s) => s.setPinballBounce);
  const cycleScale = useHoloStore((s) => s.cycleScale);
  const addPinballToy = useHoloStore((s) => s.addPinballToy);
  const updatePinballToy = useHoloStore((s) => s.updatePinballToy);
  const removePinballToy = useHoloStore((s) => s.removePinballToy);
  const applyPinballPreset = useHoloStore((s) => s.applyPinballPreset);
  const sendPinballToForge = useHoloStore((s) => s.sendPinballToForge);

  const playSfx = useHoloSfx();

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const viewTransformRef = useRef({ scale: 1, offsetX: 0, offsetY: 0, cssW: ARENA_W, cssH: ARENA_H });
  const engineRef = useRef<Matter.Engine | null>(null);
  const ballsRef = useRef<{ body: Matter.Body; color: string; lastWarp: number }[]>([]);
  const toyBodyMapRef = useRef<
    Map<string, { body: Matter.Body; constraint?: Matter.Constraint; hitFlash: number }>
  >(new Map());
  const cooldownMapRef = useRef<Map<string, number>>(new Map());
  const vfxPoolRef = useRef<VfxSlot[]>(
    Array.from({ length: 64 }, () => ({
      active: false,
      x: 0,
      y: 0,
      color: '#FFD60A',
      age: 0,
      maxAge: 28,
      note: 'C5',
      kind: 'hit',
    }))
  );
  const recordedBufferRef = useRef<(PinballRecordedEvent & { absTime: number })[]>([]);

  const [selectedToyId, setSelectedToyId] = useState<string | null>(null);
  const [combo, setCombo] = useState(0);
  const [hitDots, setHitDots] = useState<HitDot[]>([
    { id: 1, color: '#7C3AED', note: 'C5' },
    { id: 2, color: '#FF5C2B', note: 'D5' },
    { id: 3, color: '#00D4AA', note: 'E5' },
    { id: 4, color: '#FFD60A', note: 'G5' },
    { id: 5, color: '#7C3AED', note: 'A5' },
    { id: 6, color: '#00D4AA', note: 'C5' },
    { id: 7, color: '#FF5C2B', note: 'D5' },
    { id: 8, color: '#7C3AED', note: 'G5' },
    { id: 9, color: '#FFD60A', note: 'A5' },
  ]);

  const dragStateRef = useRef<{
    mode: 'none' | 'dropper' | 'toy';
    toyId?: string;
    moved: boolean;
    startX: number;
    startY: number;
  }>({ mode: 'none', moved: false, startX: 0, startY: 0 });

  const spawnVfx = useCallback(
    (x: number, y: number, color: string, note: string, kind: 'hit' | 'warp' = 'hit') => {
      const pool = vfxPoolRef.current;
      for (let i = 0; i < pool.length; i++) {
        if (!pool[i].active) {
          pool[i].active = true;
          pool[i].x = x;
          pool[i].y = y;
          pool[i].color = color;
          pool[i].age = 0;
          pool[i].maxAge = kind === 'warp' ? 24 : 30;
          pool[i].note = note;
          pool[i].kind = kind;
          return;
        }
      }
    },
    []
  );

  const dropSingleBall = useCallback((silent = false) => {
    const engine = engineRef.current;
    if (!engine) return;
    const state = useHoloStore.getState();

    // Recycle oldest ball if over limit
    if (ballsRef.current.length >= MAX_BALLS) {
      const oldest = ballsRef.current.shift();
      if (oldest) Matter.Composite.remove(engine.world, oldest.body);
    }

    const jitterX = (Math.random() - 0.5) * 14;
    const ball = Matter.Bodies.circle(state.pinballDropperX + jitterX, 74, 14, {
      restitution: state.pinballBounce,
      friction: 0.008,
      frictionAir: 0.002,
      density: 0.004,
      label: 'marble',
    });
    Matter.Body.setVelocity(ball, { x: (Math.random() - 0.5) * 2.2, y: 1.5 });
    Matter.Composite.add(engine.world, ball);

    const color = MARBLE_COLORS[Math.floor(Math.random() * MARBLE_COLORS.length)];
    ballsRef.current.push({ body: ball, color, lastWarp: 0 });
    if (!silent) {
      void holoAudio.playSfx('click', 0.78);
    }
  }, []);

  // Build / sync Matter.js Toy Bodies cleanly whenever `toys` or `bounce` updates
  const rebuildToyBodies = useCallback(() => {
    const engine = engineRef.current;
    if (!engine) return;
    const state = useHoloStore.getState();

    // Remove previous toy bodies & constraints
    toyBodyMapRef.current.forEach(({ body, constraint }) => {
      Matter.Composite.remove(engine.world, body);
      if (constraint) Matter.Composite.remove(engine.world, constraint);
    });
    toyBodyMapRef.current.clear();

    // Add current toys
    state.pinballToys.forEach((toy) => {
      if (toy.type === 'block') {
        const body = Matter.Bodies.rectangle(toy.x, toy.y, 134, 34, {
          isStatic: true,
          angle: toy.angle,
          restitution: state.pinballBounce * 1.05,
          chamfer: { radius: 10 },
          label: `toy:${toy.id}`,
        });
        Matter.Composite.add(engine.world, body);
        toyBodyMapRef.current.set(toy.id, { body, hitFlash: 0 });
      } else if (toy.type === 'bumper') {
        const body = Matter.Bodies.circle(toy.x, toy.y, 31, {
          isStatic: true,
          restitution: Math.min(1.55, state.pinballBounce * 1.38),
          label: `toy:${toy.id}`,
        });
        Matter.Composite.add(engine.world, body);
        toyBodyMapRef.current.set(toy.id, { body, hitFlash: 0 });
      } else if (toy.type === 'spinner') {
        const bladeA = Matter.Bodies.rectangle(toy.x, toy.y, 114, 20, {
          chamfer: { radius: 9 },
        });
        const bladeB = Matter.Bodies.rectangle(toy.x, toy.y, 20, 114, {
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
        toyBodyMapRef.current.set(toy.id, { body, constraint, hitFlash: 0 });
      } else if (toy.type === 'portal') {
        const body = Matter.Bodies.rectangle(toy.x, toy.y, 112, 26, {
          isStatic: true,
          isSensor: true,
          label: `toy:${toy.id}`,
        });
        Matter.Composite.add(engine.world, body);
        toyBodyMapRef.current.set(toy.id, { body, hitFlash: 0 });
      }
    });
  }, []);

  // Initialize Matter.js Engine + Custom Retina Canvas 2D Render Loop
  useEffect(() => {
    const engine = Matter.Engine.create({
      gravity: { x: 0, y: useHoloStore.getState().pinballGravity, scale: 0.001 },
    });
    engineRef.current = engine;

    // Arena left/right walls + top ceiling
    const wallLeft = Matter.Bodies.rectangle(-18, ARENA_H / 2, 36, ARENA_H * 2, {
      isStatic: true,
      restitution: 0.9,
      label: 'wall',
    });
    const wallRight = Matter.Bodies.rectangle(ARENA_W + 18, ARENA_H / 2, 36, ARENA_H * 2, {
      isStatic: true,
      restitution: 0.9,
      label: 'wall',
    });
    Matter.Composite.add(engine.world, [wallLeft, wallRight]);

    rebuildToyBodies();

    // Collision audio & VFX listener (with 90ms per-pair cooldown & min velocity filter!)
    Matter.Events.on(engine, 'collisionStart', (event) => {
      const nowMs = performance.now();
      const state = useHoloStore.getState();

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

        // Portal Teleportation!
        if (toy.type === 'portal') {
          const ballRec = ballsRef.current.find((b) => b.body === marble);
          if (ballRec && nowMs - ballRec.lastWarp > 450) {
            ballRec.lastWarp = nowMs;
            if (entry) entry.hitFlash = 1;
            spawnVfx(marble.position.x, marble.position.y, '#7C3AED', 'WARP', 'warp');
            Matter.Body.setPosition(marble, {
              x: state.pinballDropperX + (Math.random() - 0.5) * 16,
              y: 74,
            });
            Matter.Body.setVelocity(marble, { x: (Math.random() - 0.5) * 2.4, y: 1.8 });
            spawnVfx(state.pinballDropperX, 74, '#00D4AA', '↺', 'warp');
            void holoAudio.playSfx('portalWarp');
          }
          return;
        }

        // 90ms Cooldown per (marble, toy) pair to eliminate machine-gun rattle
        const pairKey = `${marble.id}-${toyId}`;
        const prevTime = cooldownMapRef.current.get(pairKey) ?? 0;
        if (nowMs - prevTime < 90) return;

        // Relative velocity check (ignore slow rolling)
        const dvx = marble.velocity.x - other.velocity.x;
        const dvy = marble.velocity.y - other.velocity.y;
        const impactSpeed = Math.hypot(dvx, dvy);
        if (impactSpeed < 1.2) return;

        cooldownMapRef.current.set(pairKey, nowMs);

        // Give bumpers an energetic upward boost!
        if (toy.type === 'bumper') {
          const angle = Math.atan2(
            marble.position.y - other.position.y,
            marble.position.x - other.position.x
          );
          const boost = Math.min(13, Math.max(7.5, impactSpeed * state.pinballBounce * 1.15));
          Matter.Body.setVelocity(marble, {
            x: Math.cos(angle) * boost,
            y: Math.sin(angle) * boost,
          });
        }

        if (entry) entry.hitFlash = 1;

        const card = getCardById(toy.cardId);
        const vel = Math.min(1, Math.max(0.28, impactSpeed / 12));
        const contactX = pair.collision.supports[0]?.x ?? marble.position.x;
        const contactY = pair.collision.supports[0]?.y ?? marble.position.y;

        spawnVfx(contactX, contactY, card.accentColor, toy.note, 'hit');

        // Trigger Tone.js procedural voice!
        void holoAudio.previewCard(toy.cardId, {
          note: toy.note,
          velocity: vel,
          scale: state.scale,
        });

        // Append to rolling 8s recording buffer
        recordedBufferRef.current.push({
          absTime: nowMs,
          timeOffsetMs: 0,
          cardId: toy.cardId,
          note: toy.note,
          velocity: vel,
          color: card.accentColor,
        });
        const cutoff = nowMs - 8000;
        recordedBufferRef.current = recordedBufferRef.current.filter((e) => e.absTime >= cutoff);

        setCombo((c) => c + 1);
        setHitDots((prev) => [
          ...prev.slice(-8),
          { id: Math.round(nowMs * 10 + Math.random() * 99), color: card.accentColor, note: toy.note },
        ]);
      });
    });

    // Drop 2 starter marbles immediately so the stage comes alive!
    window.setTimeout(() => dropSingleBall(true), 120);

    // Custom 60fps High-DPI Canvas 2D Render Loop
    let raf = 0;
    let lastTs = performance.now();

    const loop = (ts: number) => {
      const dt = Math.min(32, ts - lastTs);
      lastTs = ts;

      const state = useHoloStore.getState();
      engine.gravity.y = state.pinballGravity;
      Matter.Engine.update(engine, dt);

      // Clean out-of-bounds fallen marbles
      for (let i = ballsRef.current.length - 1; i >= 0; i--) {
        const b = ballsRef.current[i];
        if (b.body.position.y > ARENA_H + 55) {
          Matter.Composite.remove(engine.world, b.body);
          ballsRef.current.splice(i, 1);
        }
      }

      // Render Canvas with True 1:1 Isotropic Scaling (Zero Aspect Ratio Distortion!)
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
          // Fill entire container with seamless oatmeal dot-grid
          ctx.fillStyle = '#EDE7D9';
          ctx.fillRect(0, 0, cssW, cssH);
          ctx.fillStyle = '#C9C0AE';
          for (let gx = 16; gx < cssW; gx += 20) {
            for (let gy = 16; gy < cssH; gy += 20) {
              ctx.beginPath();
              ctx.arc(gx, gy, 1.3, 0, Math.PI * 2);
              ctx.fill();
            }
          }
          ctx.translate(offsetX, offsetY);
          ctx.scale(scaleFit, scaleFit);
          drawArena(ctx, ts, state.pinballToys, state.pinballDropperX);
          ctx.restore();
        }
      }

      raf = requestAnimationFrame(loop);
    };

    const drawArena = (
      ctx: CanvasRenderingContext2D,
      t: number,
      currentToys: PinballToy[],
      currDropperX: number
    ) => {
      // Vertical Aim Dashed Guide from Dropper
      ctx.save();
      ctx.setLineDash([6, 6]);
      ctx.strokeStyle = 'rgba(26, 26, 31, 0.18)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(currDropperX, 74);
      ctx.lineTo(currDropperX, ARENA_H - 18);
      ctx.stroke();
      ctx.restore();

      // Top Horizontal Metallic Rail + Yellow End Brackets (1:1 Mockup 3!)
      ctx.fillStyle = '#94A3B8';
      ctx.strokeStyle = '#1A1A1F';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.roundRect(38, 30, ARENA_W - 76, 14, 6);
      ctx.fill();
      ctx.stroke();

      // End Caps
      [26, ARENA_W - 56].forEach((ex) => {
        ctx.fillStyle = '#FFD60A';
        ctx.beginPath();
        ctx.roundRect(ex, 16, 30, 42, 8);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#1A1A1F';
        ctx.beginPath();
        ctx.arc(ex + 15, 28, 2.5, 0, Math.PI * 2);
        ctx.arc(ex + 15, 46, 2.5, 0, Math.PI * 2);
        ctx.fill();
      });

      // Sliding Mechanical Yellow DROPPER Box
      ctx.save();
      ctx.translate(currDropperX, 38);
      // Nozzle neck
      ctx.fillStyle = '#FFD60A';
      ctx.strokeStyle = '#1A1A1F';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.roundRect(-20, 14, 40, 22, 6);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#181820';
      ctx.beginPath();
      ctx.ellipse(0, 34, 15, 5, 0, 0, Math.PI * 2);
      ctx.fill();
      // Main box
      ctx.fillStyle = '#FFD60A';
      ctx.beginPath();
      ctx.roundRect(-62, -26, 124, 44, 12);
      ctx.fill();
      ctx.stroke();
      // DROPPER Label
      ctx.fillStyle = '#1A1A1F';
      ctx.font = '900 15px "Space Grotesk", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('DROPPER', 0, -4);
      ctx.restore();

      // Draw All Placed Musical Physics Toys
      currentToys.forEach((toy) => {
        const entry = toyBodyMapRef.current.get(toy.id);
        if (!entry) return;
        entry.hitFlash = Math.max(0, entry.hitFlash - 0.06);
        const flash = entry.hitFlash;
        const scalePop = 1 + flash * 0.12;
        const card = getCardById(toy.cardId);

        ctx.save();
        ctx.translate(entry.body.position.x, entry.body.position.y);
        ctx.rotate(entry.body.angle);
        ctx.scale(scalePop, scalePop);

        if (toy.type === 'block') {
          // Hard Drop Shadow
          ctx.fillStyle = '#1A1A1F';
          ctx.beginPath();
          ctx.roundRect(-64, -12, 134, 34, 10);
          ctx.fill();

          // Iridescent Holographic Prism Fill!
          const shift = Math.sin(t * 0.002 + toy.x * 0.01) * 28;
          const holoGrad = ctx.createLinearGradient(-70 + shift, -22, 70 + shift, 22);
          holoGrad.addColorStop(0, '#FF3D9A');
          holoGrad.addColorStop(0.24, '#FFD60A');
          holoGrad.addColorStop(0.5, '#00D4AA');
          holoGrad.addColorStop(0.76, '#38BDF8');
          holoGrad.addColorStop(1, '#7C3AED');

          ctx.fillStyle = flash > 0.35 ? '#FFFDF8' : holoGrad;
          ctx.strokeStyle = '#1A1A1F';
          ctx.lineWidth = 3.2;
          ctx.beginPath();
          ctx.roundRect(-67, -17, 134, 34, 10);
          ctx.fill();
          ctx.stroke();

          // Gloss Highlight Strip
          ctx.fillStyle = 'rgba(255,255,255,0.4)';
          ctx.beginPath();
          ctx.roundRect(-61, -13, 122, 8, 4);
          ctx.fill();

          // Corner Screw Dots
          ctx.fillStyle = '#1A1A1F';
          [-56, 56].forEach((sx) => {
            ctx.beginPath();
            ctx.arc(sx, 0, 2.5, 0, Math.PI * 2);
            ctx.fill();
          });

          // Crisp White Note Badge Pill ("C5", "D5", "G5", "A5")
          ctx.fillStyle = '#FFFDF8';
          ctx.strokeStyle = '#1A1A1F';
          ctx.lineWidth = 2.4;
          ctx.beginPath();
          ctx.roundRect(-24, -12, 48, 24, 6);
          ctx.fill();
          ctx.stroke();

          ctx.fillStyle = '#1A1A1F';
          ctx.font = '900 14px "JetBrains Mono", monospace';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(toy.note, 0, 1);
        } else if (toy.type === 'bumper') {
          // 3D Cartoon Spring Base (like Mockup 3!)
          ctx.fillStyle = card.accentColor;
          ctx.strokeStyle = '#1A1A1F';
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.ellipse(0, 24, 24, 10, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();

          // Spring Coils
          ctx.fillStyle = '#CBD5E1';
          ctx.beginPath();
          ctx.roundRect(-14, 6, 28, 18, 4);
          ctx.fill();
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(-14, 12);
          ctx.lineTo(14, 12);
          ctx.moveTo(-14, 18);
          ctx.lineTo(14, 18);
          ctx.stroke();

          // Glossy Mushroom Cap
          ctx.fillStyle = flash > 0.35 ? '#FFFDF8' : card.accentColor;
          ctx.beginPath();
          ctx.arc(0, -4, 30, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();

          // Concentric White Target Rings
          ctx.strokeStyle = '#FFFDF8';
          ctx.lineWidth = 3.5;
          ctx.beginPath();
          ctx.arc(0, -4, 19, 0, Math.PI * 2);
          ctx.stroke();
          ctx.fillStyle = '#FFFDF8';
          ctx.beginPath();
          ctx.arc(0, -4, 8, 0, Math.PI * 2);
          ctx.fill();
        } else if (toy.type === 'spinner') {
          // 4-Blade Mint/Accent Cartoon Pinwheel
          ctx.fillStyle = flash > 0.35 ? '#FFD60A' : card.accentColor;
          ctx.strokeStyle = '#1A1A1F';
          ctx.lineWidth = 3.2;
          for (let b = 0; b < 4; b++) {
            ctx.save();
            ctx.rotate((b * Math.PI) / 2);
            ctx.beginPath();
            ctx.roundRect(-11, -56, 22, 48, 11);
            ctx.fill();
            ctx.stroke();
            ctx.restore();
          }
          // Center Axle Cap
          ctx.fillStyle = '#FFFDF8';
          ctx.beginPath();
          ctx.arc(0, 0, 12, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
          ctx.fillStyle = '#1A1A1F';
          ctx.beginPath();
          ctx.arc(0, 0, 4, 0, Math.PI * 2);
          ctx.fill();
        } else if (toy.type === 'portal') {
          // Rising Neon Warp Beams
          const pulse = 0.55 + Math.sin(t * 0.008) * 0.35;
          ctx.strokeStyle = `rgba(0, 212, 170, ${pulse})`;
          ctx.lineWidth = 3.5;
          ctx.lineCap = 'round';
          [-44, -24, 24, 44].forEach((bx, bi) => {
            const h = 16 + ((bi % 2) * 10);
            ctx.beginPath();
            ctx.moveTo(bx, -14);
            ctx.lineTo(bx, -14 - h);
            ctx.stroke();
          });

          // Purple-Mint Glowing Portal Pad
          ctx.fillStyle = '#7C3AED';
          ctx.strokeStyle = '#1A1A1F';
          ctx.lineWidth = 3.2;
          ctx.beginPath();
          ctx.ellipse(0, 4, 58, 18, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();

          ctx.fillStyle = '#181820';
          ctx.beginPath();
          ctx.ellipse(0, 0, 44, 12, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = '#00D4AA';
          ctx.lineWidth = 2.8;
          ctx.stroke();

          ctx.beginPath();
          ctx.ellipse(0, 0, 26, 6, 0, 0, Math.PI * 2);
          ctx.stroke();
        }

        ctx.restore();
      });

      // Draw Falling Glossy Marbles with Cartoon Speed Trails
      ballsRef.current.forEach(({ body, color }) => {
        const { x, y } = body.position;
        const speed = Math.hypot(body.velocity.x, body.velocity.y);

        if (speed > 2.2) {
          ctx.save();
          ctx.strokeStyle = 'rgba(26, 26, 31, 0.55)';
          ctx.lineWidth = 2.2;
          ctx.lineCap = 'round';
          const nx = -body.velocity.x / speed;
          const ny = -body.velocity.y / speed;
          ctx.beginPath();
          ctx.moveTo(x + nx * 16 - 4, y + ny * 16);
          ctx.lineTo(x + nx * (18 + speed * 2.2) - 4, y + ny * (18 + speed * 2.2));
          ctx.moveTo(x + nx * 16 + 4, y + ny * 16);
          ctx.lineTo(x + nx * (16 + speed * 1.6) + 4, y + ny * (16 + speed * 1.6));
          ctx.stroke();
          ctx.restore();
        }

        ctx.save();
        ctx.translate(x, y);
        ctx.fillStyle = color;
        ctx.strokeStyle = '#1A1A1F';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(0, 0, 14, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Specular highlight dot
        ctx.fillStyle = 'rgba(255,255,255,0.75)';
        ctx.beginPath();
        ctx.ellipse(-4.5, -5, 4.5, 3, -0.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      });

      // Draw Pre-Allocated 64-Slot Mikutap Geometric Collision VFX Pool
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
        const alpha = 1 - p;

        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.translate(v.x, v.y);

        // Expanding Thick-Outlined Concentric Ring
        const r = 14 + p * 46;
        ctx.strokeStyle = v.color;
        ctx.lineWidth = 4 * (1 - p * 0.5);
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.stroke();

        // Comic Starburst Rays
        ctx.strokeStyle = '#1A1A1F';
        ctx.lineWidth = 2.5;
        for (let ray = 0; ray < 6; ray++) {
          const ang = (ray * Math.PI) / 3 + p * 0.5;
          const r1 = 16 + p * 18;
          const r2 = 28 + p * 26;
          ctx.beginPath();
          ctx.moveTo(Math.cos(ang) * r1, Math.sin(ang) * r1);
          ctx.lineTo(Math.cos(ang) * r2, Math.sin(ang) * r2);
          ctx.stroke();
        }

        // Floating Musical Note Glyph
        ctx.fillStyle = '#1A1A1F';
        ctx.font = '900 18px "Space Grotesk", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(v.kind === 'warp' ? '✦' : '♪', 14 * p, -16 - p * 28);
        ctx.fillStyle = v.color;
        ctx.fillText(v.kind === 'warp' ? '✦' : '♫', -14 * p, -20 - p * 34);

        ctx.restore();
      }
    };

    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      Matter.World.clear(engine.world, false);
      Matter.Engine.clear(engine);
      engineRef.current = null;
      ballsRef.current = [];
    };
  }, [rebuildToyBodies, spawnVfx, dropSingleBall]);

  // Rebuild Matter bodies when toys array or bounce parameter changes
  useEffect(() => {
    rebuildToyBodies();
  }, [toys, bounce, rebuildToyBodies]);

  // Auto-Dropper Timer synchronized with RATE slider
  useEffect(() => {
    if (!autoDrop) return;
    // Map dropRate 0.1..1.0 -> 1500ms..320ms
    const intervalMs = Math.round(1600 - dropRate * 1260);
    const id = window.setInterval(() => {
      dropSingleBall(true);
    }, intervalMs);
    return () => window.clearInterval(id);
  }, [autoDrop, dropRate, dropSingleBall]);

  // Convert DOM pointer event to 800x520 isotropic logical arena coordinates
  const toArenaCoords = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 400, y: 260 };
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
      const radius = t.type === 'block' ? 68 : t.type === 'spinner' ? 56 : t.type === 'portal' ? 58 : 36;
      if (Math.hypot(dx, dy) <= radius) return t;
    }
    return null;
  };

  const handleCanvasPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (e.button === 2) return; // Right-click handled by contextMenu
    const { x, y } = toArenaCoords(e.clientX, e.clientY);
    e.currentTarget.setPointerCapture(e.pointerId);

    // Check Dropper rail hit
    if (y <= 78 && Math.abs(x - dropperX) <= 72) {
      dragStateRef.current = { mode: 'dropper', moved: false, startX: x, startY: y };
      return;
    }

    // Check existing Toy hit
    const hit = hitTestToy(x, y);
    if (hit) {
      setSelectedToyId(hit.id);
      dragStateRef.current = { mode: 'toy', toyId: hit.id, moved: false, startX: x, startY: y };
      playSfx('click', 0.65);
      return;
    }

    // Place a new musical toy on empty canvas!
    if (y > 90 && y < ARENA_H - 20) {
      const scaleNotes = SCALE_META[scale].shortNotes;
      const note = scaleNotes[toys.length % scaleNotes.length];
      const angle =
        selectedTool === 'block' ? (x < ARENA_W / 2 ? 0.22 : -0.22) : 0;
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
    const drag = dragStateRef.current;
    if (drag.mode === 'none') return;
    const { x, y } = toArenaCoords(e.clientX, e.clientY);

    if (drag.mode === 'dropper') {
      setPinballDropperX(Math.round(x));
      drag.moved = true;
    } else if (drag.mode === 'toy' && drag.toyId) {
      if (Math.hypot(x - drag.startX, y - drag.startY) > 4) {
        drag.moved = true;
        updatePinballToy(drag.toyId, {
          x: Math.round(Math.min(ARENA_W - 55, Math.max(55, x))),
          y: Math.round(Math.min(ARENA_H - 25, Math.max(92, y))),
        });
      }
    }
  };

  const handleCanvasPointerUp = () => {
    dragStateRef.current.mode = 'none';
  };

  const handleContextMenu = (e: React.MouseEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const { x, y } = toArenaCoords(e.clientX, e.clientY);
    const hit = hitTestToy(x, y);
    if (hit) {
      removePinballToy(hit.id);
      if (selectedToyId === hit.id) setSelectedToyId(null);
      playSfx('click', 0.25);
    }
  };

  const handleRecToForge = () => {
    playSfx('mintStamp');
    const raw = recordedBufferRef.current;
    if (raw.length > 0) {
      const start = raw[0].absTime;
      const normalized: PinballRecordedEvent[] = raw.map((ev) => ({
        timeOffsetMs: Math.round(ev.absTime - start),
        cardId: ev.cardId,
        note: ev.note,
        velocity: ev.velocity,
        color: ev.color,
      }));
      sendPinballToForge(normalized);
    } else {
      sendPinballToForge([]);
    }
  };

  const selectedToy = toys.find((t) => t.id === selectedToyId) ?? null;
  const unlockedCards = SOUND_CARDS.filter((c) => collection.includes(c.id));

  const TOOL_ITEMS: { id: PinballToyType; label: string; icon: React.ReactNode }[] = [
    {
      id: 'block',
      label: 'BLOCK',
      icon: (
        <svg viewBox="0 0 36 28" className="w-8 h-6">
          <rect x="4" y="16" width="6" height="10" rx="1.5" fill="#1A1A1F" />
          <rect x="13" y="10" width="6" height="16" rx="1.5" fill="#1A1A1F" />
          <rect x="22" y="4" width="7" height="22" rx="1.5" fill="#1A1A1F" />
        </svg>
      ),
    },
    {
      id: 'bumper',
      label: 'BUMPER',
      icon: (
        <svg viewBox="0 0 36 30" className="w-8 h-6">
          <rect x="11" y="16" width="14" height="10" rx="3" fill="#CBD5E1" stroke="#1A1A1F" strokeWidth="2.5" />
          <ellipse cx="18" cy="11" rx="13" ry="8" fill="#FF5C2B" stroke="#1A1A1F" strokeWidth="2.5" />
          <ellipse cx="18" cy="9" rx="5" ry="2.5" fill="#FFFDF8" />
        </svg>
      ),
    },
    {
      id: 'spinner',
      label: 'SPINNER',
      icon: (
        <svg viewBox="0 0 36 32" className="w-8 h-6">
          <g transform="translate(18,16)">
            <ellipse cx="0" cy="-8" rx="4" ry="7" fill="#7C3AED" stroke="#1A1A1F" strokeWidth="2.2" />
            <ellipse cx="0" cy="8" rx="4" ry="7" fill="#7C3AED" stroke="#1A1A1F" strokeWidth="2.2" />
            <ellipse cx="-8" cy="0" rx="7" ry="4" fill="#7C3AED" stroke="#1A1A1F" strokeWidth="2.2" />
            <ellipse cx="8" cy="0" rx="7" ry="4" fill="#7C3AED" stroke="#1A1A1F" strokeWidth="2.2" />
            <circle cx="0" cy="0" r="3.5" fill="#FFFDF8" stroke="#1A1A1F" strokeWidth="2" />
          </g>
        </svg>
      ),
    },
    {
      id: 'portal',
      label: 'PORTAL',
      icon: (
        <svg viewBox="0 0 40 28" className="w-9 h-6">
          <line x1="12" y1="10" x2="12" y2="3" stroke="#00D4AA" strokeWidth="2.5" strokeLinecap="round" />
          <line x1="20" y1="8" x2="20" y2="1" stroke="#00D4AA" strokeWidth="2.5" strokeLinecap="round" />
          <line x1="28" y1="10" x2="28" y2="3" stroke="#00D4AA" strokeWidth="2.5" strokeLinecap="round" />
          <ellipse cx="20" cy="19" rx="16" ry="7" fill="#7C3AED" stroke="#1A1A1F" strokeWidth="2.5" />
          <ellipse cx="20" cy="18" rx="10" ry="3.5" fill="#00D4AA" stroke="#1A1A1F" strokeWidth="1.8" />
        </svg>
      ),
    },
  ];

  return (
    <div className="w-full h-full p-3.5 grid grid-cols-[minmax(215px,21%)_1fr_minmax(225px,22%)] gap-3.5 overflow-hidden">
      {/* ================= LEFT TOOLBELT PANEL ================= */}
      <section className="brutal-panel p-3 flex flex-col justify-between gap-2.5 min-h-0 overflow-hidden">
        {/* BLOCKS 2x2 Grid */}
        <div className="shrink-0">
          <h2 className="text-[14px] font-black tracking-wide uppercase text-[#1A1A1F] mb-2">
            BLOCKS
          </h2>
          <div className="grid grid-cols-2 gap-2">
            {TOOL_ITEMS.map((item) => {
              const active = selectedTool === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    playSfx('click', 0.72);
                    setPinballTool(item.id);
                  }}
                  className={`brutal-btn py-2 px-1 rounded-xl flex flex-col items-center justify-center gap-1 ${
                    active ? 'bg-[#00D4AA] text-[#1A1A1F]' : 'bg-[#FFFDF8] text-[#1A1A1F]'
                  }`}
                >
                  {item.icon}
                  <span className="text-[11px] font-black tracking-wider">{item.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* BIND CARD Stack */}
        <div className="flex-1 flex flex-col min-h-0">
          <h2 className="text-[14px] font-black tracking-wide uppercase text-[#1A1A1F] mb-1.5 shrink-0">
            BIND CARD
          </h2>
          <div className="flex-1 overflow-y-auto holo-scroll pr-0.5 flex flex-col gap-2">
            {unlockedCards.map((c) => {
              const isBound = bindCardId === c.id;
              const rar = RARITY_META[c.rarity];
              return (
                <button
                  key={c.id}
                  onClick={() => {
                    playSfx('cartridgeLock');
                    setPinballBindCardId(c.id);
                    if (selectedToyId) {
                      updatePinballToy(selectedToyId, { cardId: c.id });
                    }
                    void holoAudio.previewCard(c.id);
                  }}
                  className={`relative h-[54px] shrink-0 rounded-xl p-[2.5px] border-[2.5px] border-[#1A1A1F] holo-thumb-sheen cursor-pointer transition-all ${
                    isBound
                      ? 'holo-shine-border ring-[3px] ring-[#00D4AA] shadow-[0_0_12px_rgba(0,212,170,0.7)]'
                      : 'bg-gradient-to-r from-[#FF3D9A] via-[#FFD60A] to-[#38BDF8] shadow-[2px_2px_0px_0px_#1A1A1F]'
                  }`}
                >
                  <div
                    className="w-full h-full rounded-[8px] overflow-hidden border-[1.5px] border-[#1A1A1F] flex items-center"
                    style={{
                      background:
                        'linear-gradient(120deg, #E9D5FF 0%, #BAE6FD 34%, #FEF08A 66%, #FBCFE8 100%)',
                    }}
                  >
                    <div className="w-12 h-full shrink-0 border-r-[1.5px] border-[#1A1A1F]">
                      <CardArtwork artId={c.artId} />
                    </div>
                    <div className="flex-1 px-2 py-0.5 flex flex-col justify-between h-full text-left">
                      <div className="flex items-center justify-between">
                        <span
                          className="px-1.5 py-[1px] rounded text-[9px] font-black border border-[#1A1A1F]"
                          style={{ backgroundColor: rar.bg, color: rar.text }}
                        >
                          {rar.label}
                        </span>
                        <span className="font-mono-hw text-[10px] font-black text-[#1A1A1F] bg-[#FFFDF8]/90 px-1 rounded border border-[#1A1A1F]/40">
                          {c.code}
                        </span>
                      </div>
                      <span className="text-[13px] font-black italic tracking-tight text-[#1A1A1F] truncate leading-none drop-shadow-[0_1px_0_rgba(255,255,255,0.85)]">
                        {c.shortTitle}
                      </span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* PRESETS Row */}
        <div className="shrink-0 pt-1">
          <h2 className="text-[13px] font-black tracking-wide uppercase text-[#1A1A1F] mb-1.5">
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
                    ? 'bg-[#FFFDF8] hover:bg-[#FF5C2B] hover:text-white'
                    : 'bg-[#FFFDF8] hover:bg-[#FFD60A]'
                }`}
              >
                {preset}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* ================= CENTER 2D PHYSICS STAGE ================= */}
      <section className="relative rounded-[18px] border-[3.5px] border-[#1A1A1F] shadow-[6px_6px_0px_0px_#1A1A1F] bg-[#EDE7D9] overflow-hidden flex items-center justify-center min-h-0">
        <canvas
          ref={canvasRef}
          onPointerDown={handleCanvasPointerDown}
          onPointerMove={handleCanvasPointerMove}
          onPointerUp={handleCanvasPointerUp}
          onPointerCancel={handleCanvasPointerUp}
          onContextMenu={handleContextMenu}
          className="w-full h-full block cursor-crosshair touch-none"
        />

        {/* Selected Toy Floating Micro-Toolbar */}
        {selectedToy && (
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1.5 bg-[#181820] text-[#FFFDF8] border-[2.5px] border-[#FFD60A] rounded-2xl px-3 py-1.5 shadow-[4px_4px_0px_0px_#1A1A1F]">
            <span className="font-mono-hw text-[11px] font-black text-[#FFD60A] uppercase">
              {selectedToy.type}
            </span>
            <span className="text-white/30">|</span>
            {selectedToy.type === 'block' && (
              <>
                <button
                  onClick={() => {
                    playSfx('knobTick', 0.4);
                    updatePinballToy(selectedToy.id, { angle: selectedToy.angle - Math.PI / 12 });
                  }}
                  className="p-1 rounded-lg bg-white/10 hover:bg-[#00D4AA] hover:text-[#1A1A1F] cursor-pointer"
                  title="逆时针旋转 15°"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => {
                    playSfx('knobTick', 0.7);
                    updatePinballToy(selectedToy.id, { angle: selectedToy.angle + Math.PI / 12 });
                  }}
                  className="p-1 rounded-lg bg-white/10 hover:bg-[#00D4AA] hover:text-[#1A1A1F] cursor-pointer"
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
                updatePinballToy(selectedToy.id, { note: next });
                void holoAudio.previewCard(selectedToy.cardId, { note: next });
              }}
              className="px-2 py-0.5 rounded-lg bg-[#7C3AED] font-mono-hw text-xs font-black cursor-pointer hover:brightness-110"
              title="切换五声音阶音高"
            >
              ♪ {selectedToy.note}
            </button>
            <button
              onClick={() => {
                playSfx('click', 0.2);
                removePinballToy(selectedToy.id);
                setSelectedToyId(null);
              }}
              className="p-1 rounded-lg bg-[#FF5C2B] text-white cursor-pointer hover:brightness-110"
              title="删除机关（或右键点击机关）"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Subtle Top-Right Interaction Hint */}
        <div className="absolute bottom-2 right-3 text-[10px] font-bold text-[#1A1A1F]/55 pointer-events-none select-none">
          点击空白放置机关 · 拖拽移动/调发射口 · 右键删除
        </div>
      </section>

      {/* ================= RIGHT CONTROL & RECORDING POD ================= */}
      <section className="brutal-panel p-3 flex flex-col justify-between gap-2.5 min-h-0">
        {/* Top Action Buttons: DROP BALL & AUTO ON */}
        <div className="grid grid-cols-[1.45fr_1fr] gap-2 shrink-0">
          <button
            onClick={() => dropSingleBall(false)}
            className="brutal-btn py-2.5 px-2 rounded-xl bg-[#00D4AA] text-[#1A1A1F] text-sm font-black tracking-wide flex items-center justify-center gap-1"
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
              autoDrop ? 'bg-[#FF5C2B] text-[#1A1A1F]' : 'bg-[#FFFDF8] text-[#1A1A1F]'
            }`}
          >
            <span
              className={`w-3.5 h-3.5 rounded-full border-2 border-[#1A1A1F] shrink-0 ${
                autoDrop ? 'bg-[#FFFDF8] animate-pulse' : 'bg-[#EDE7D9]'
              }`}
            />
            <span>
              AUTO
              <br />
              {autoDrop ? 'ON' : 'OFF'}
            </span>
          </button>
        </div>

        {/* Sliders: GRAVITY & RATE */}
        <div className="flex flex-col gap-4 py-1">
          <BrutalSlider
            label="GRAVITY"
            value={(gravity - 0.25) / 1.95}
            onChange={(v) => setPinballGravity(0.25 + v * 1.95)}
            color="#7C3AED"
            height={14}
          />
          <BrutalSlider
            label="RATE"
            value={(dropRate - 0.1) / 0.9}
            onChange={(v) => setPinballDropRate(0.1 + v * 0.9)}
            color="#FF5C2B"
            height={14}
          />
        </div>

        {/* BOUNCE Knob + PENTA C Scale Selector */}
        <div className="flex items-center justify-between gap-2 py-1 border-y-[1.5px] border-[#1A1A1F]/15">
          <BrutalKnob
            value={(bounce - 0.5) / 0.85}
            onChange={(v) => setPinballBounce(0.5 + v * 0.85)}
            color="#FFD60A"
            size={46}
            label="BOUNCE"
            title="上下拖拽调节弹珠全局弹性系数"
          />
          <div className="h-12 w-[2px] bg-[#1A1A1F]/25" />
          <button
            onClick={() => {
              playSfx('click', 0.75);
              cycleScale();
            }}
            title={`调式锁定：${SCALE_META[scale].zhLabel}`}
            className="brutal-btn flex-1 py-2 px-2.5 rounded-xl bg-[#FFFDF8] font-mono-hw text-xs font-black flex items-center justify-center gap-1"
          >
            <span>{SCALE_META[scale].label}</span>
            <ChevronDown className="w-3.5 h-3.5" strokeWidth={3} />
          </button>
        </div>

        {/* Dark Charcoal OLED HIT LOG + COMBO */}
        <div className="rounded-2xl bg-[#181820] border-[2.5px] border-[#1A1A1F] p-3 flex flex-col justify-between gap-2.5 h-[132px] shrink-0">
          <div className="flex items-center justify-between">
            <span className="font-mono-hw text-[11px] font-black tracking-wider text-white/85">
              HIT LOG
            </span>
            <span className="font-mono-hw text-[10px] font-bold text-[#FFD60A]">
              {toys.length} TOYS
            </span>
          </div>

          <div className="flex items-center justify-center gap-1.5">
            <span className="text-[#FFD60A] font-black text-sm">ミ</span>
            <span className="font-black text-[22px] tracking-tight text-[#00D4AA] leading-none">
              COMBO x{combo}
            </span>
            <span className="text-[#FFD60A] font-black text-sm">彡</span>
          </div>

          {/* Scrolling Colorful Hit Note Dots */}
          <div className="h-6 rounded-full bg-white/8 px-2 flex items-center justify-center gap-1.5 overflow-hidden">
            {hitDots.slice(-9).map((dot) => (
              <span
                key={dot.id}
                title={dot.note}
                style={{ backgroundColor: dot.color }}
                className="w-3.5 h-3.5 rounded-full border border-black/50 shrink-0 shadow-[0_0_6px_rgba(255,255,255,0.3)]"
              />
            ))}
          </div>
        </div>

        {/* Bottom CTA: REC TO FORGE -> */}
        <button
          onClick={handleRecToForge}
          className="brutal-btn-lg w-full py-3 rounded-2xl bg-[#FFD60A] text-[#1A1A1F] text-[15px] font-black tracking-wide uppercase flex items-center justify-center gap-1.5 shrink-0"
        >
          <span>REC TO FORGE</span>
          <span className="text-lg leading-none">→</span>
        </button>
      </section>
    </div>
  );
};
