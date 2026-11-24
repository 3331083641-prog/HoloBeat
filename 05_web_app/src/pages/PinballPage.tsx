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
const ARENA_H = 680;
const MAX_BALLS = 24;
const MARBLE_COLORS = ['#FF5526', '#7C3AED', '#00D4AA', '#FFD426', '#FF3D9A'];

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

interface MarbleRecord {
  body: Matter.Body;
  color: string;
  lastWarp: number;
  trail: { x: number; y: number }[];
  squash: number;
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
  const ballsRef = useRef<MarbleRecord[]>([]);
  const dropperRecoilRef = useRef(0);
  const toyBodyMapRef = useRef<
    Map<string, { body: Matter.Body; constraint?: Matter.Constraint; hitFlash: number }>
  >(new Map());
  const cooldownMapRef = useRef<Map<string, number>>(new Map());
  const vfxPoolRef = useRef<VfxSlot[]>(
    Array.from({ length: 64 }, () => ({
      active: false,
      x: 0,
      y: 0,
      color: '#FFD426',
      age: 0,
      maxAge: 30,
      note: 'C5',
      kind: 'hit',
    }))
  );
  const recordedBufferRef = useRef<(PinballRecordedEvent & { absTime: number })[]>([]);

  const [selectedToyId, setSelectedToyId] = useState<string | null>(null);
  const [combo, setCombo] = useState(0);
  const comboRef = useRef(0);
  const [hitDots, setHitDots] = useState<HitDot[]>([
    { id: 1, color: '#7C3AED', note: 'C5' },
    { id: 2, color: '#FF5526', note: 'D5' },
    { id: 3, color: '#00D4AA', note: 'E5' },
    { id: 4, color: '#FFD426', note: 'G5' },
    { id: 5, color: '#7C3AED', note: 'A5' },
    { id: 6, color: '#00D4AA', note: 'C5' },
    { id: 7, color: '#FF5526', note: 'D5' },
    { id: 8, color: '#7C3AED', note: 'G5' },
    { id: 9, color: '#FFD426', note: 'A5' },
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
          pool[i].maxAge = kind === 'warp' ? 24 : 32;
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

  const rebuildToyBodies = useCallback(() => {
    const engine = engineRef.current;
    if (!engine) return;
    const state = useHoloStore.getState();

    toyBodyMapRef.current.forEach(({ body, constraint }) => {
      Matter.Composite.remove(engine.world, body);
      if (constraint) Matter.Composite.remove(engine.world, constraint);
    });
    toyBodyMapRef.current.clear();

    state.pinballToys.forEach((toy) => {
      if (toy.type === 'block') {
        const body = Matter.Bodies.rectangle(toy.x, toy.y, 138, 34, {
          isStatic: true,
          angle: toy.angle,
          restitution: state.pinballBounce * 1.05,
          chamfer: { radius: 10 },
          label: `toy:${toy.id}`,
        });
        Matter.Composite.add(engine.world, body);
        toyBodyMapRef.current.set(toy.id, { body, hitFlash: 0 });
      } else if (toy.type === 'bumper') {
        const body = Matter.Bodies.circle(toy.x, toy.y, 32, {
          isStatic: true,
          restitution: Math.min(1.55, state.pinballBounce * 1.38),
          label: `toy:${toy.id}`,
        });
        Matter.Composite.add(engine.world, body);
        toyBodyMapRef.current.set(toy.id, { body, hitFlash: 0 });
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
        toyBodyMapRef.current.set(toy.id, { body, constraint, hitFlash: 0 });
      } else if (toy.type === 'portal') {
        const body = Matter.Bodies.rectangle(toy.x, toy.y, 118, 26, {
          isStatic: true,
          isSensor: true,
          label: `toy:${toy.id}`,
        });
        Matter.Composite.add(engine.world, body);
        toyBodyMapRef.current.set(toy.id, { body, hitFlash: 0 });
      }
    });
  }, []);

  useEffect(() => {
    const engine = Matter.Engine.create({
      gravity: { x: 0, y: useHoloStore.getState().pinballGravity, scale: 0.001 },
    });
    engineRef.current = engine;

    // Arena left/right walls + gentle corner deflectors so marbles stay lively
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

    rebuildToyBodies();

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
        const ballRec = ballsRef.current.find((b) => b.body === marble);

        // Portal Teleportation!
        if (toy.type === 'portal') {
          if (ballRec && nowMs - ballRec.lastWarp > 450) {
            ballRec.lastWarp = nowMs;
            ballRec.trail = [];
            if (entry) entry.hitFlash = 1;
            spawnVfx(marble.position.x, marble.position.y, '#7C3AED', 'WARP', 'warp');
            Matter.Body.setPosition(marble, {
              x: state.pinballDropperX + (Math.random() - 0.5) * 16,
              y: 82,
            });
            Matter.Body.setVelocity(marble, { x: (Math.random() - 0.5) * 2.4, y: 1.8 });
            spawnVfx(state.pinballDropperX, 82, '#00D4AA', '↺', 'warp');
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

        spawnVfx(contactX, contactY, card.accentColor, toy.note, 'hit');

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
        const cutoff = nowMs - 8000;
        recordedBufferRef.current = recordedBufferRef.current.filter((e) => e.absTime >= cutoff);

        comboRef.current += 1;
        setCombo(comboRef.current);
        setHitDots((prev) => [
          ...prev.slice(-8),
          { id: Math.round(nowMs * 10 + Math.random() * 99), color: card.accentColor, note: toy.note },
        ]);
      });
    });

    window.setTimeout(() => dropSingleBall(true), 120);

    let raf = 0;
    let lastTs = performance.now();

    const loop = (ts: number) => {
      const dt = Math.min(32, ts - lastTs);
      lastTs = ts;

      const state = useHoloStore.getState();
      engine.gravity.y = state.pinballGravity;
      Matter.Engine.update(engine, dt);

      dropperRecoilRef.current = Math.max(0, dropperRecoilRef.current * 0.86 - 0.01);

      // Update marble trails, squash recovery & clean out-of-bounds fallen marbles
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

          // Recessed Oatmeal Cabinet Dot-Grid Backdrop
          ctx.fillStyle = '#E7E1D3';
          ctx.fillRect(0, 0, cssW, cssH);
          ctx.fillStyle = 'rgba(23, 23, 28, 0.14)';
          for (let gx = 16; gx < cssW; gx += 20) {
            for (let gy = 16; gy < cssH; gy += 20) {
              ctx.beginPath();
              ctx.arc(gx, gy, 1.2, 0, Math.PI * 2);
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
      // Subtle Playfield Blueprint Guides & Corner Calibration Crosshairs
      ctx.save();
      ctx.strokeStyle = 'rgba(23, 23, 28, 0.08)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(14, 12, ARENA_W - 28, ARENA_H - 24, 16);
      ctx.stroke();

      // Subtle Horizontal Musical Staff Guides
      ctx.setLineDash([4, 10]);
      ctx.strokeStyle = 'rgba(23, 23, 28, 0.07)';
      [185, 365, 535].forEach((ly) => {
        ctx.beginPath();
        ctx.moveTo(28, ly);
        ctx.lineTo(ARENA_W - 28, ly);
        ctx.stroke();
      });
      ctx.restore();

      // Ambient Combo Heat Glow at High Combos
      if (comboRef.current >= 8) {
        const heatAlpha = Math.min(0.16, (comboRef.current - 6) * 0.008);
        const rad = ctx.createRadialGradient(ARENA_W / 2, ARENA_H * 0.52, 40, ARENA_W / 2, ARENA_H * 0.52, 340);
        rad.addColorStop(0, `rgba(0, 212, 170, ${heatAlpha})`);
        rad.addColorStop(0.55, `rgba(124, 58, 237, ${heatAlpha * 0.7})`);
        rad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = rad;
        ctx.fillRect(0, 0, ARENA_W, ARENA_H);
      }

      // Vertical Aim Dashed Guide from Dropper
      ctx.save();
      ctx.setLineDash([6, 6]);
      ctx.strokeStyle = 'rgba(23, 23, 28, 0.18)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(currDropperX, 80);
      ctx.lineTo(currDropperX, ARENA_H - 22);
      ctx.stroke();
      ctx.restore();

      // Top Horizontal Metallic Rail + Yellow End Brackets
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

      // Sliding Mechanical Yellow DROPPER Box with Recoil Kick!
      const recoilY = -dropperRecoilRef.current * 5.5;
      ctx.save();
      ctx.translate(currDropperX, 42 + recoilY);

      // Muzzle emission glow flash
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

      // Hard Drop Shadow for Dropper
      ctx.fillStyle = '#17171C';
      ctx.beginPath();
      ctx.roundRect(-59, -22, 124, 44, 12);
      ctx.fill();

      ctx.fillStyle = '#FFD426';
      ctx.beginPath();
      ctx.roundRect(-62, -26, 124, 44, 12);
      ctx.fill();
      ctx.stroke();

      // Subtle glossy highlight bar on Dropper
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

          const shift = Math.sin(t * 0.0022 + toy.x * 0.01) * 32;
          const holoGrad = ctx.createLinearGradient(-72 + shift, -22, 72 + shift, 22);
          holoGrad.addColorStop(0, '#FF3D9A');
          holoGrad.addColorStop(0.25, '#FFD426');
          holoGrad.addColorStop(0.5, '#00D4AA');
          holoGrad.addColorStop(0.75, '#38BDF8');
          holoGrad.addColorStop(1, '#7C3AED');

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
          // Real Spring Compression Recoil on Hit!
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
          ctx.beginPath();
          ctx.moveTo(-14, 13 + compress * 0.4);
          ctx.lineTo(14, 13 + compress * 0.4);
          ctx.moveTo(-14, 19 + compress * 0.2);
          ctx.lineTo(14, 19 + compress * 0.2);
          ctx.stroke();

          // Glossy Mushroom Cap
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
            ctx.fillStyle = 'rgba(255,255,255,0.3)';
            ctx.beginPath();
            ctx.roundRect(-5, -52, 4, 24, 2);
            ctx.fill();
            ctx.fillStyle = flash > 0.3 ? '#FFD426' : card.accentColor;
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
            const h = 16 + ((bi % 2) * 12) + Math.sin(t * 0.01 + bi) * 4;
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

          ctx.beginPath();
          ctx.ellipse(0, 0, 26, 6, 0, 0, Math.PI * 2);
          ctx.stroke();
        }

        ctx.restore();
      });

      // Draw Falling Glossy Marbles with Luminous Comet Trails + Squash & Stretch!
      ballsRef.current.forEach(({ body, color, trail, squash }) => {
        const { x, y } = body.position;
        const speed = Math.hypot(body.velocity.x, body.velocity.y);

        // Luminous Comet Ribbon Trail
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

        // Crisp Glossy Specular Highlight
        ctx.fillStyle = 'rgba(255,255,255,0.82)';
        ctx.beginPath();
        ctx.ellipse(-4.5, -5, 4.8, 3, -0.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      });

      // Draw Pre-Allocated 64-Slot Multi-Layer Collision VFX Pool
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

        // Soft Radial Light Halo Flash
        if (p < 0.45) {
          ctx.fillStyle = v.color;
          ctx.globalAlpha = (1 - p / 0.45) * 0.35;
          ctx.beginPath();
          ctx.arc(0, 0, 16 + easeOut * 38, 0, Math.PI * 2);
          ctx.fill();
          ctx.globalAlpha = alpha;
        }

        // Expanding Shockwave Ring
        const r = 14 + easeOut * 54;
        ctx.strokeStyle = v.color;
        ctx.lineWidth = 4.5 * (1 - p * 0.6);
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.stroke();

        // Crisp Comic Starburst Rays
        ctx.strokeStyle = '#17171C';
        ctx.lineWidth = 2.4;
        for (let ray = 0; ray < 6; ray++) {
          const ang = (ray * Math.PI) / 3 + p * 0.45;
          const r1 = 16 + easeOut * 20;
          const r2 = 28 + easeOut * 30;
          ctx.beginPath();
          ctx.moveTo(Math.cos(ang) * r1, Math.sin(ang) * r1);
          ctx.lineTo(Math.cos(ang) * r2, Math.sin(ang) * r2);
          ctx.stroke();
        }

        // Floating Pitch Badge Pill (e.g., "♪ G5")
        const floatY = -20 - easeOut * 34;
        ctx.fillStyle = '#14151B';
        ctx.strokeStyle = v.color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect(-22, floatY - 10, 44, 20, 10);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#FBF9F4';
        ctx.font = '900 11px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(v.kind === 'warp' ? '✦ WARP' : `♪ ${v.note}`, 0, floatY + 0.5);

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

  useEffect(() => {
    rebuildToyBodies();
  }, [toys, bounce, rebuildToyBodies]);

  useEffect(() => {
    if (!autoDrop) return;
    const intervalMs = Math.round(1600 - dropRate * 1260);
    const id = window.setInterval(() => {
      dropSingleBall(true);
    }, intervalMs);
    return () => window.clearInterval(id);
  }, [autoDrop, dropRate, dropSingleBall]);

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
      const radius = t.type === 'block' ? 70 : t.type === 'spinner' ? 60 : t.type === 'portal' ? 60 : 38;
      if (Math.hypot(dx, dy) <= radius) return t;
    }
    return null;
  };

  const handleCanvasPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (e.button === 2) return;
    const { x, y } = toArenaCoords(e.clientX, e.clientY);
    e.currentTarget.setPointerCapture(e.pointerId);

    if (y <= 84 && Math.abs(x - dropperX) <= 74) {
      dragStateRef.current = { mode: 'dropper', moved: false, startX: x, startY: y };
      return;
    }

    const hit = hitTestToy(x, y);
    if (hit) {
      setSelectedToyId(hit.id);
      dragStateRef.current = { mode: 'toy', toyId: hit.id, moved: false, startX: x, startY: y };
      playSfx('click', 0.65);
      return;
    }

    if (y > 96 && y < ARENA_H - 22) {
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
          y: Math.round(Math.min(ARENA_H - 28, Math.max(96, y))),
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
          <rect x="11" y="16" width="14" height="10" rx="3" fill="#CBD5E1" stroke="#17171C" strokeWidth="2.5" />
          <ellipse cx="18" cy="11" rx="13" ry="8" fill="#FF5526" stroke="#17171C" strokeWidth="2.5" />
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
            <ellipse cx="0" cy="-8" rx="4" ry="7" fill="#7C3AED" stroke="#17171C" strokeWidth="2.2" />
            <ellipse cx="0" cy="8" rx="4" ry="7" fill="#7C3AED" stroke="#17171C" strokeWidth="2.2" />
            <ellipse cx="-8" cy="0" rx="7" ry="4" fill="#7C3AED" stroke="#17171C" strokeWidth="2.2" />
            <ellipse cx="8" cy="0" rx="7" ry="4" fill="#7C3AED" stroke="#17171C" strokeWidth="2.2" />
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
          <line x1="12" y1="10" x2="12" y2="3" stroke="#00D4AA" strokeWidth="2.5" strokeLinecap="round" />
          <line x1="20" y1="8" x2="20" y2="1" stroke="#00D4AA" strokeWidth="2.5" strokeLinecap="round" />
          <line x1="28" y1="10" x2="28" y2="3" stroke="#00D4AA" strokeWidth="2.5" strokeLinecap="round" />
          <ellipse cx="20" cy="19" rx="16" ry="7" fill="#7C3AED" stroke="#17171C" strokeWidth="2.5" />
          <ellipse cx="20" cy="18" rx="10" ry="3.5" fill="#00D4AA" stroke="#17171C" strokeWidth="1.8" />
        </svg>
      ),
    },
  ];

  return (
    <div className="w-full h-full p-3.5 grid grid-cols-[minmax(220px,22%)_1fr_minmax(228px,22.5%)] gap-3.5 overflow-hidden">
      {/* ================= LEFT TOOLBELT PANEL ================= */}
      <section className="brutal-panel p-3 flex flex-col justify-between gap-2.5 min-h-0 overflow-hidden">
        {/* BLOCKS 2x2 Grid */}
        <div className="shrink-0">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-[13.5px] font-black tracking-wide uppercase text-[#17171C]">
              BLOCKS
            </h2>
            <span className="hw-silkscreen !text-[8px]">UNIT 03</span>
          </div>
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
                    active ? 'bg-[#00D4AA] text-[#17171C]' : 'bg-[#FBF9F4] text-[#17171C]'
                  }`}
                >
                  {item.icon}
                  <span className="text-[10.5px] font-black tracking-wider">{item.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* BIND CARD Stack (Category-Accented High-Contrast Cartridges!) */}
        <div className="flex-1 flex flex-col min-h-0">
          <div className="flex items-center justify-between mb-1.5 shrink-0">
            <h2 className="text-[13.5px] font-black tracking-wide uppercase text-[#17171C]">
              BIND CARD
            </h2>
            <span className="hw-silkscreen !text-[8.5px]">绑定碰撞音色</span>
          </div>
          <div className="flex-1 overflow-y-auto holo-scroll pr-0.5 flex flex-col gap-2">
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
                      updatePinballToy(selectedToyId, { cardId: c.id });
                    }
                    void holoAudio.previewCard(c.id);
                  }}
                  className={`relative h-[54px] shrink-0 rounded-xl border-[2.5px] border-[#17171C] overflow-hidden cursor-pointer transition-all flex items-stretch text-left ${
                    isBound
                      ? 'bg-[#14151B] text-[#FBF9F4] ring-2 ring-[#00D4AA] shadow-[3px_3px_0px_0px_#17171C] -translate-y-0.5'
                      : 'bg-[#FBF9F4] text-[#17171C] hover:bg-[#F3EFE6] shadow-[2px_2px_0px_0px_#17171C]'
                  }`}
                >
                  {/* Category Color Side Rail */}
                  <div className="w-1.5 shrink-0" style={{ backgroundColor: cat.color }} />
                  {/* Card Artwork Thumb */}
                  <div className="w-11 h-full shrink-0 border-r-[2px] border-[#17171C] holo-thumb-sheen">
                    <CardArtwork artId={c.artId} />
                  </div>
                  {/* Card Info */}
                  <div className="flex-1 px-2 py-1 flex flex-col justify-between min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <span
                        className="px-1.5 py-[0.5px] rounded text-[8.5px] font-black border border-[#17171C]"
                        style={{ backgroundColor: rar.bg, color: rar.text }}
                      >
                        {rar.label}
                      </span>
                      <span
                        className={`font-mono-hw text-[9.5px] font-bold ${
                          isBound ? 'text-[#00D4AA]' : 'text-[#626272]'
                        }`}
                      >
                        {c.code}
                      </span>
                    </div>
                    <div className="flex items-baseline justify-between gap-1.5 min-w-0">
                      <span className="text-[12px] font-black italic tracking-tight shrink-0 leading-none">
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
        <div className="shrink-0 pt-1">
          <h2 className="text-[12.5px] font-black tracking-wide uppercase text-[#17171C] mb-1.5">
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
      </section>

      {/* ================= CENTER 2D KINETIC PINBALL CABINET ================= */}
      <section className="relative rounded-[18px] border-[2.5px] border-[#17171C] shadow-[inset_0_2px_8px_rgba(23,23,28,0.12),4px_4px_0px_0px_#17171C] bg-[#E7E1D3] overflow-hidden flex items-center justify-center min-h-0">
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
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1.5 bg-[#14151B] text-[#FBF9F4] border-[2px] border-[#FFD426] rounded-2xl px-3 py-1.5 shadow-[0_8px_20px_rgba(0,0,0,0.4),3px_3px_0px_0px_#17171C]">
            <span className="font-mono-hw text-[11px] font-black text-[#FFD426] uppercase">
              {selectedToy.type}
            </span>
            <span className="text-white/25">|</span>
            {selectedToy.type === 'block' && (
              <>
                <button
                  onClick={() => {
                    playSfx('knobTick', 0.4);
                    updatePinballToy(selectedToy.id, { angle: selectedToy.angle - Math.PI / 12 });
                  }}
                  className="p-1 rounded-lg bg-white/10 hover:bg-[#00D4AA] hover:text-[#17171C] cursor-pointer"
                  title="逆时针旋转 15°"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => {
                    playSfx('knobTick', 0.7);
                    updatePinballToy(selectedToy.id, { angle: selectedToy.angle + Math.PI / 12 });
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
                updatePinballToy(selectedToy.id, { note: next });
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

        <div className="absolute bottom-2 right-3 text-[10px] font-bold text-[#17171C]/50 pointer-events-none select-none">
          点击空白放置机关 · 拖拽移动/调发射口 · 右键删除
        </div>
      </section>

      {/* ================= RIGHT CONTROL & RECORDING POD ================= */}
      <section className="brutal-panel p-3 flex flex-col justify-between gap-2.5 min-h-0">
        {/* Top Action Buttons: DROP BALL & AUTO ON */}
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

        {/* Sliders: GRAVITY & RATE */}
        <div className="flex flex-col gap-3.5 py-1">
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

        {/* BOUNCE Calibrated Knob + Scale Selector */}
        <div className="flex items-center justify-between gap-2 py-1.5 border-y-[1.5px] border-[#17171C]/12">
          <BrutalKnob
            value={(bounce - 0.5) / 0.85}
            onChange={(v) => setPinballBounce(0.5 + v * 0.85)}
            color="#FFD426"
            size={42}
            label="BOUNCE"
            title="上下拖拽或滚轮调节弹珠全局弹性"
          />
          <div className="h-11 w-[1.5px] bg-[#17171C]/18" />
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

        {/* Deep Obsidian OLED HIT LOG + COMBO HEAT */}
        <div className="relative oled-scanlines rounded-2xl bg-[#14151B] border-[2.5px] border-[#17171C] shadow-[inset_0_3px_10px_rgba(0,0,0,0.65)] p-3 flex flex-col justify-between gap-2 h-[136px] shrink-0">
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
              className={`font-black text-[22px] tracking-tight leading-none ${
                combo >= 15 ? 'text-[#FFD426]' : 'text-[#00D4AA]'
              }`}
            >
              COMBO x{combo}
            </span>
            <span className="text-[#FFD426] font-black text-sm">彡</span>
          </div>

          {/* Scrolling Colorful Hit Note Dots */}
          <div className="h-6 rounded-full bg-white/[0.07] px-2 flex items-center justify-center gap-1.5 overflow-hidden">
            {hitDots.slice(-9).map((dot) => (
              <span
                key={dot.id}
                title={dot.note}
                style={{ backgroundColor: dot.color }}
                className="w-3.5 h-3.5 rounded-full border border-black/50 shrink-0 shadow-[0_0_7px_rgba(255,255,255,0.35)]"
              />
            ))}
          </div>
        </div>

        {/* Bottom CTA: REC TO FORGE -> */}
        <button
          onClick={handleRecToForge}
          className="brutal-btn-lg w-full py-2.5 rounded-2xl bg-[#FFD426] text-[#17171C] text-[14.5px] font-black tracking-wide uppercase flex items-center justify-center gap-1.5 shrink-0"
        >
          <span>REC TO FORGE</span>
          <span className="text-lg leading-none">→</span>
        </button>
      </section>
    </div>
  );
};
