import * as Tone from 'tone';
import { SCALE_META, getCardById } from '../data/soundCards';
import { useHoloStore } from '../store/useHoloStore';
import type { PinballRecordedEvent, ScaleId, TrackState } from '../types/holo';

type StepListener = (step: number) => void;

export interface TriggerOptions {
  note?: string;
  velocity?: number; // 0..1
  time?: number;
  tone?: number; // 0..1
  gain?: number; // 0..1
  stepIndex?: number;
  scale?: ScaleId;
}

/**
 * Pure procedural synthesis helper shared by BOTH live engine and Tone.Offline WAV renderer!
 */
export interface SynthVoiceRack {
  kick: Tone.MembraneSynth;
  subKick: Tone.MembraneSynth;
  woodSnap: Tone.Synth;
  whiteNoise: Tone.NoiseSynth;
  whiteFilter: Tone.Filter;
  pinkNoise: Tone.NoiseSynth;
  pinkFilter: Tone.Filter;
  bellPoly: Tone.PolySynth<Tone.FMSynth>;
  squarePoly: Tone.PolySynth<Tone.Synth>;
  pluckPoly: Tone.PolySynth<Tone.Synth>;
  padPoly: Tone.PolySynth<Tone.Synth>;
  dispose: () => void;
}

export function createVoiceRack(destination: Tone.InputNode): SynthVoiceRack {
  const rackGain = new Tone.Gain(0.95).connect(destination);

  const kick = new Tone.MembraneSynth({
    pitchDecay: 0.045,
    octaves: 5,
    oscillator: { type: 'sine' },
    envelope: { attack: 0.002, decay: 0.22, sustain: 0.01, release: 0.14 },
  }).connect(rackGain);

  const subKick = new Tone.MembraneSynth({
    pitchDecay: 0.07,
    octaves: 4,
    oscillator: { type: 'triangle' },
    envelope: { attack: 0.003, decay: 0.34, sustain: 0.02, release: 0.22 },
  }).connect(rackGain);

  const woodSnap = new Tone.Synth({
    oscillator: { type: 'triangle' },
    envelope: { attack: 0.001, decay: 0.06, sustain: 0, release: 0.04 },
  }).connect(rackGain);

  const whiteFilter = new Tone.Filter(3600, 'bandpass').connect(rackGain);
  whiteFilter.Q.value = 2.4;
  const whiteNoise = new Tone.NoiseSynth({
    noise: { type: 'white' },
    envelope: { attack: 0.001, decay: 0.09, sustain: 0, release: 0.05 },
  }).connect(whiteFilter);

  const pinkFilter = new Tone.Filter(1800, 'bandpass').connect(rackGain);
  pinkFilter.Q.value = 1.1;
  const pinkNoise = new Tone.NoiseSynth({
    noise: { type: 'pink' },
    envelope: { attack: 0.01, decay: 0.24, sustain: 0.04, release: 0.16 },
  }).connect(pinkFilter);

  const bellPoly = new Tone.PolySynth(Tone.FMSynth, {
    harmonicity: 3.1,
    modulationIndex: 7,
    oscillator: { type: 'sine' },
    modulation: { type: 'triangle' },
    envelope: { attack: 0.002, decay: 0.36, sustain: 0.02, release: 0.45 },
    modulationEnvelope: { attack: 0.002, decay: 0.16, sustain: 0, release: 0.15 },
  }).connect(rackGain);
  bellPoly.maxPolyphony = 8;

  const squarePoly = new Tone.PolySynth(Tone.Synth, {
    oscillator: { type: 'square' },
    envelope: { attack: 0.004, decay: 0.16, sustain: 0.06, release: 0.18 },
  }).connect(rackGain);
  squarePoly.maxPolyphony = 8;
  squarePoly.volume.value = -8;

  const pluckPoly = new Tone.PolySynth(Tone.Synth, {
    oscillator: { type: 'triangle' },
    envelope: { attack: 0.002, decay: 0.28, sustain: 0.04, release: 0.35 },
  }).connect(rackGain);
  pluckPoly.maxPolyphony = 8;
  pluckPoly.volume.value = -4;

  const padPoly = new Tone.PolySynth(Tone.Synth, {
    oscillator: { type: 'sawtooth' },
    envelope: { attack: 0.04, decay: 0.28, sustain: 0.18, release: 0.45 },
  }).connect(rackGain);
  padPoly.maxPolyphony = 6;
  padPoly.volume.value = -13;

  return {
    kick,
    subKick,
    woodSnap,
    whiteNoise,
    whiteFilter,
    pinkNoise,
    pinkFilter,
    bellPoly,
    squarePoly,
    pluckPoly,
    padPoly,
    dispose: () => {
      kick.dispose();
      subKick.dispose();
      woodSnap.dispose();
      whiteNoise.dispose();
      whiteFilter.dispose();
      pinkNoise.dispose();
      pinkFilter.dispose();
      bellPoly.dispose();
      squarePoly.dispose();
      pluckPoly.dispose();
      padPoly.dispose();
      rackGain.dispose();
    },
  };
}

export function triggerCardOnRack(
  rack: SynthVoiceRack,
  cardId: string,
  opts: TriggerOptions = {}
) {
  const now = opts.time ?? Tone.now();
  const vel = Math.min(1, Math.max(0.15, (opts.velocity ?? 0.82) * (opts.gain ?? 1)));
  const tone = opts.tone ?? 0.5;
  const scaleId = opts.scale ?? 'PENTA_C';
  const scaleNotes = SCALE_META[scaleId].notes;
  const stepIdx = opts.stepIndex ?? Math.floor(Math.random() * 8);
  const chosenNote =
    opts.note ?? scaleNotes[(stepIdx * 2 + Math.round(tone * 4)) % scaleNotes.length];

  const pitchShiftSemis = Math.round((tone - 0.5) * 7);
  const shiftFreq = (baseHz: number) => baseHz * Math.pow(2, pitchShiftSemis / 12);

  try {
    switch (cardId) {
      // === BEAT ===
      case 'card-01': {
        // 弄堂竹板梆子: snappy punch kick + woody bamboo clack
        rack.kick.triggerAttackRelease(shiftFreq(68), '16n', now, vel * 0.9);
        rack.woodSnap.triggerAttackRelease(shiftFreq(620), '32n', now, vel * 0.55);
        break;
      }
      case 'card-02': {
        // 老式街机拍键: punchy arcade kick + crisp microswitch click
        rack.kick.triggerAttackRelease(shiftFreq(92), '16n', now, vel * 0.95);
        rack.whiteFilter.frequency.setValueAtTime(3400 + tone * 2600, now);
        rack.whiteNoise.triggerAttackRelease('64n', now, vel * 0.5);
        break;
      }
      case 'card-03': {
        // 糖炒栗子爆壳: warm kick + crackling pop
        rack.kick.triggerAttackRelease(shiftFreq(78), '16n', now, vel * 0.8);
        rack.whiteFilter.frequency.setValueAtTime(4800, now);
        rack.whiteNoise.triggerAttackRelease('32n', now + 0.012, vel * 0.65);
        break;
      }
      case 'card-04': {
        // 舞狮咚咚大鼓: deep resonant lion dance drum + bright rim
        rack.subKick.triggerAttackRelease(shiftFreq(54), '8n', now, vel * 1.0);
        rack.woodSnap.triggerAttackRelease(shiftFreq(260), '32n', now, vel * 0.45);
        break;
      }

      // === PERC ===
      case 'card-05': {
        // 二八大杠车铃: iconic bright double metallic bicycle bell ring!
        const n1 = opts.note ?? 'E6';
        const f1 = Tone.Frequency(n1).toFrequency() * (0.9 + tone * 0.25);
        rack.bellPoly.triggerAttackRelease(f1, '8n', now, vel * 0.65);
        rack.bellPoly.triggerAttackRelease(f1 * 1.5, '16n', now + 0.045, vel * 0.48);
        break;
      }
      case 'card-06': {
        // 冰镇汽水拉环: metallic tab click + fizzy hi-hat burst
        rack.whiteFilter.frequency.setValueAtTime(5200 + tone * 3000, now);
        rack.whiteNoise.triggerAttackRelease('16n', now, vel * 0.65);
        rack.woodSnap.triggerAttackRelease(shiftFreq(1400), '64n', now, vel * 0.35);
        break;
      }
      case 'card-07': {
        // 麻将碰杠脆碰: crisp ivory tile double-clack
        rack.woodSnap.triggerAttackRelease(shiftFreq(1850), '64n', now, vel * 0.72);
        rack.woodSnap.triggerAttackRelease(shiftFreq(2320), '64n', now + 0.032, vel * 0.58);
        rack.whiteFilter.frequency.setValueAtTime(2800, now);
        rack.whiteNoise.triggerAttackRelease('64n', now, vel * 0.45);
        break;
      }
      case 'card-08': {
        // 货郎拨浪鼓: alternating woody double-tap
        rack.woodSnap.triggerAttackRelease(shiftFreq(480), '32n', now, vel * 0.72);
        rack.woodSnap.triggerAttackRelease(shiftFreq(640), '32n', now + 0.055, vel * 0.62);
        break;
      }

      // === MELODY ===
      case 'card-09': {
        // 8-Bit 街机投币: iconic arcade rising coin two-note chime
        const baseFreq = Tone.Frequency(chosenNote).toFrequency();
        rack.squarePoly.triggerAttackRelease(baseFreq, '16n', now, vel * 0.62);
        rack.squarePoly.triggerAttackRelease(baseFreq * 1.498, '8n', now + 0.055, vel * 0.52);
        break;
      }
      case 'card-10': {
        // 糖画铜勺叮当: delicate glassy FM chime
        rack.bellPoly.triggerAttackRelease(chosenNote, '8n', now, vel * 0.65);
        break;
      }
      case 'card-11': {
        // 赛博古筝拨弦: pentatonic bright plucked string + harmonic octave
        const f = Tone.Frequency(chosenNote).toFrequency();
        rack.pluckPoly.triggerAttackRelease(f, '8n', now, vel * 0.75);
        rack.pluckPoly.triggerAttackRelease(f * 2, '16n', now + 0.015, vel * 0.28);
        break;
      }
      case 'card-12': {
        // 摩天轮八音盒: dreamy music-box sparkling harmony
        const f = Tone.Frequency(chosenNote).toFrequency();
        rack.bellPoly.triggerAttackRelease([f, f * 1.5], '4n', now, vel * 0.55);
        break;
      }

      // === VIBE ===
      case 'card-13': {
        // 夜市铁板滋啦: sizzling filtered pink noise + warm pentatonic chord stab
        rack.pinkFilter.frequency.setValueAtTime(1600 + tone * 2600, now);
        rack.pinkNoise.triggerAttackRelease('8n', now, vel * 0.52);
        const root = scaleNotes[stepIdx % 5];
        const fifth = scaleNotes[(stepIdx % 5) + 2];
        rack.padPoly.triggerAttackRelease([root, fifth], '8n', now, vel * 0.42);
        break;
      }
      case 'card-14': {
        // 梅雨铁皮雨棚: gentle patter + cozy lo-fi chord
        rack.pinkFilter.frequency.setValueAtTime(2200 + tone * 1800, now);
        rack.pinkNoise.triggerAttackRelease('16n', now, vel * 0.35);
        const nA = scaleNotes[stepIdx % 5];
        const nB = scaleNotes[(stepIdx % 5) + 3];
        rack.pluckPoly.triggerAttackRelease([nA, nB], '4n', now, vel * 0.4);
        break;
      }
      case 'card-15': {
        // 港风霓虹电流: retro vapor synth chord swell
        const nA = scaleNotes[stepIdx % 5];
        const nB = scaleNotes[(stepIdx % 5) + 2];
        const nC = scaleNotes[(stepIdx % 5) + 4];
        rack.padPoly.triggerAttackRelease([nA, nB, nC], '4n', now, vel * 0.5);
        break;
      }
      case 'card-16': {
        // 晚风胡同蝉鸣: shimmering airy summer harmonics
        const f = Tone.Frequency(chosenNote).toFrequency();
        rack.bellPoly.triggerAttackRelease([f * 2, f * 1.5], '4n', now, vel * 0.42);
        rack.pinkFilter.frequency.setValueAtTime(4200, now);
        rack.pinkNoise.triggerAttackRelease('8n', now, vel * 0.22);
        break;
      }
      default: {
        rack.pluckPoly.triggerAttackRelease(chosenNote, '8n', now, vel * 0.65);
      }
    }
  } catch {
    // Prevent Tone scheduling exceptions on extreme spam clicks
  }
}

class HoloAudioEngine {
  private initialized = false;
  private masterBus!: Tone.Gain;
  private bitCrusher!: Tone.BitCrusher;
  private streetEcho!: Tone.FeedbackDelay;
  private limiter!: Tone.Limiter;
  private fft!: Tone.FFT;
  private waveform!: Tone.Waveform;
  private meter!: Tone.Meter;

  private trackFilters: Tone.Filter[] = [];
  private trackChannels: Tone.Channel[] = [];
  private trackRacks: SynthVoiceRack[] = [];
  private previewRack!: SynthVoiceRack;
  private sfxSynth!: Tone.Synth;
  private sfxNoise!: Tone.NoiseSynth;
  private sfxNoiseFilter!: Tone.Filter;

  private sequence: Tone.Sequence<number> | null = null;
  private stepListeners = new Set<StepListener>();
  private currentStep = -1;
  private lastScratchTime = 0;
  private lastKnobTickTime = 0;
  private pinballTimers: number[] = [];

  async ensureStarted(): Promise<void> {
    if (Tone.getContext().state !== 'running') {
      await Tone.start();
    }
    if (!this.initialized) {
      this.initGraph();
    }
  }

  private initGraph() {
    if (this.initialized) return;
    this.initialized = true;

    this.limiter = new Tone.Limiter(-1).toDestination();
    this.fft = new Tone.FFT(32);
    this.waveform = new Tone.Waveform(128);
    this.meter = new Tone.Meter({ smoothing: 0.78 });

    this.limiter.connect(this.fft);
    this.limiter.connect(this.waveform);
    this.limiter.connect(this.meter);

    this.streetEcho = new Tone.FeedbackDelay({
      delayTime: '8n.',
      feedback: 0.42,
      wet: 0,
    }).connect(this.limiter);

    this.bitCrusher = new Tone.BitCrusher(4).connect(this.streetEcho);
    this.bitCrusher.wet.value = 0;

    this.masterBus = new Tone.Gain(0.95).connect(this.bitCrusher);

    // 4 dedicated track channels for Beat Deck
    for (let i = 0; i < 4; i++) {
      const channel = new Tone.Channel(0, 0).connect(this.masterBus);
      const filter = new Tone.Filter(12000, 'lowpass').connect(channel);
      const rack = createVoiceRack(filter);
      this.trackChannels.push(channel);
      this.trackFilters.push(filter);
      this.trackRacks.push(rack);
    }

    // Dedicated preview / pinball / forge voice rack
    this.previewRack = createVoiceRack(this.limiter);

    // Ultra-fast UI tactile SFX nodes
    this.sfxSynth = new Tone.Synth({
      oscillator: { type: 'triangle' },
      envelope: { attack: 0.001, decay: 0.045, sustain: 0, release: 0.03 },
    }).connect(this.limiter);
    this.sfxSynth.volume.value = -11;

    this.sfxNoiseFilter = new Tone.Filter(3800, 'highpass').connect(this.limiter);
    this.sfxNoise = new Tone.NoiseSynth({
      noise: { type: 'white' },
      envelope: { attack: 0.002, decay: 0.035, sustain: 0, release: 0.02 },
    }).connect(this.sfxNoiseFilter);
    this.sfxNoise.volume.value = -18;

    this.setupSequencer();
    this.syncFromStore();
  }

  private setupSequencer() {
    const steps = Array.from({ length: 16 }, (_, i) => i);
    this.sequence = new Tone.Sequence(
      (time, step) => {
        const state = useHoloStore.getState();
        const tracks = state.tracks;
        const anySolo = tracks.some((t) => t.solo);

        tracks.forEach((track, idx) => {
          const isMuted = track.mute || (anySolo && !track.solo);
          if (isMuted) return;
          if (!track.steps[step]) return;

          const rack = this.trackRacks[idx];
          if (!rack) return;

          triggerCardOnRack(rack, track.cardId, {
            time,
            velocity: 0.85,
            tone: track.tone,
            stepIndex: step,
            scale: state.scale,
          });

          // Live STUTTER DJ FX: rapid 32nd-note retrigger!
          if (state.liveFx.stutter) {
            const sub = Tone.Time('32n').toSeconds();
            triggerCardOnRack(rack, track.cardId, {
              time: time + sub,
              velocity: 0.62,
              tone: Math.min(1, track.tone + 0.15),
              stepIndex: step,
              scale: state.scale,
            });
          }
        });

        Tone.getDraw().schedule(() => {
          this.currentStep = step;
          this.stepListeners.forEach((fn) => fn(step));
        }, time);
      },
      steps,
      '16n'
    );
    this.sequence.start(0);
  }

  syncFromStore() {
    if (!this.initialized) return;
    const state = useHoloStore.getState();
    Tone.getDestination().mute = state.muted;
    Tone.getTransport().bpm.rampTo(state.bpm, 0.05);
    Tone.getTransport().swing = state.swing;
    Tone.getTransport().swingSubdivision = '16n';

    this.bitCrusher.wet.rampTo(state.liveFx.bitcrush ? 0.82 : 0, 0.04);
    this.streetEcho.wet.rampTo(state.liveFx.echo ? 0.52 : 0, 0.05);

    const anySolo = state.tracks.some((t) => t.solo);
    state.tracks.forEach((t: TrackState, idx: number) => {
      const ch = this.trackChannels[idx];
      const filt = this.trackFilters[idx];
      if (!ch || !filt) return;
      const db = t.volume <= 0.01 ? -60 : Tone.gainToDb(t.volume);
      ch.volume.rampTo(db, 0.04);
      ch.mute = t.mute || (anySolo && !t.solo);
      // Map tone 0..1 to exponential cutoff 650Hz..14000Hz
      const freq = 650 * Math.pow(21.5, t.tone);
      filt.frequency.rampTo(freq, 0.04);
    });
  }

  async togglePlay(): Promise<boolean> {
    await this.ensureStarted();
    this.syncFromStore();
    const transport = Tone.getTransport();
    if (transport.state === 'started') {
      transport.pause();
      useHoloStore.getState().setIsPlaying(false);
      return false;
    } else {
      transport.start();
      useHoloStore.getState().setIsPlaying(true);
      return true;
    }
  }

  async startTransport(): Promise<void> {
    await this.ensureStarted();
    this.syncFromStore();
    if (Tone.getTransport().state !== 'started') {
      Tone.getTransport().start();
      useHoloStore.getState().setIsPlaying(true);
    }
  }

  stopTransport(): void {
    if (!this.initialized) return;
    Tone.getTransport().stop();
    this.currentStep = -1;
    this.stepListeners.forEach((fn) => fn(-1));
    useHoloStore.getState().setIsPlaying(false);
  }

  subscribeStep(fn: StepListener): () => void {
    this.stepListeners.add(fn);
    return () => this.stepListeners.delete(fn);
  }

  getCurrentStep(): number {
    return this.currentStep;
  }

  async previewCard(cardId: string, opts: TriggerOptions = {}): Promise<void> {
    await this.ensureStarted();
    this.syncFromStore();
    const card = getCardById(cardId);
    const scale = opts.scale ?? useHoloStore.getState().scale;
    const now = Tone.now() + 0.01;

    triggerCardOnRack(this.previewRack, card.id, {
      ...opts,
      time: now,
      scale,
      velocity: opts.velocity ?? 0.88,
    });

    // For melody showcase preview on Gacha page (when no specific note forced), play a tiny joyful motif!
    if (!opts.note && card.category === 'MELODY' && opts.stepIndex === undefined) {
      const notes = SCALE_META[scale].shortNotes;
      triggerCardOnRack(this.previewRack, card.id, {
        note: notes[2],
        time: now + 0.14,
        scale,
        velocity: 0.72,
      });
      triggerCardOnRack(this.previewRack, card.id, {
        note: notes[4],
        time: now + 0.28,
        scale,
        velocity: 0.85,
      });
    }
  }

  async playPinballRecording(
    events: PinballRecordedEvent[],
    onEvent?: (ev: PinballRecordedEvent) => void,
    onComplete?: () => void
  ): Promise<void> {
    await this.ensureStarted();
    this.stopPinballRecording();
    if (!events.length) {
      onComplete?.();
      return;
    }

    const scale = useHoloStore.getState().scale;
    let maxDelay = 0;

    events.forEach((ev) => {
      const delay = Math.max(0, ev.timeOffsetMs);
      if (delay > maxDelay) maxDelay = delay;
      const timer = window.setTimeout(() => {
        triggerCardOnRack(this.previewRack, ev.cardId, {
          note: ev.note,
          velocity: ev.velocity,
          scale,
        });
        onEvent?.(ev);
      }, delay);
      this.pinballTimers.push(timer);
    });

    const endTimer = window.setTimeout(() => {
      onComplete?.();
    }, maxDelay + 500);
    this.pinballTimers.push(endTimer);
  }

  stopPinballRecording() {
    this.pinballTimers.forEach((t) => window.clearTimeout(t));
    this.pinballTimers = [];
  }

  /**
   * Zero-asset procedural UI tactile micro-SFX (<2ms latency)
   */
  async playSfx(
    kind:
      | 'tab'
      | 'click'
      | 'ratchet'
      | 'capsuleDrop'
      | 'scratch'
      | 'cartridgeLock'
      | 'knobTick'
      | 'holoFanfare'
      | 'mintStamp'
      | 'portalWarp',
    param = 0.5
  ) {
    if (useHoloStore.getState().muted) return;
    try {
      await this.ensureStarted();
      const now = Tone.now();
      switch (kind) {
        case 'tab':
          this.sfxSynth.triggerAttackRelease('C6', '64n', now, 0.45);
          this.sfxSynth.triggerAttackRelease('G6', '64n', now + 0.025, 0.3);
          break;
        case 'click':
          this.sfxSynth.triggerAttackRelease(540 + param * 180, '64n', now, 0.42);
          break;
        case 'ratchet':
          for (let i = 0; i < 4; i++) {
            this.sfxSynth.triggerAttackRelease(280 + i * 95, '64n', now + i * 0.042, 0.45);
          }
          break;
        case 'capsuleDrop':
          this.sfxSynth.triggerAttackRelease(340, '32n', now, 0.55);
          this.sfxSynth.triggerAttackRelease(220, '32n', now + 0.07, 0.65);
          this.sfxSynth.triggerAttackRelease(480, '64n', now + 0.14, 0.45);
          break;
        case 'scratch': {
          const tMs = performance.now();
          if (tMs - this.lastScratchTime < 42) return;
          this.lastScratchTime = tMs;
          this.sfxNoiseFilter.frequency.setValueAtTime(3400 + Math.random() * 2400, now);
          this.sfxNoise.triggerAttackRelease('64n', now, 0.35 + param * 0.25);
          break;
        }
        case 'cartridgeLock':
          this.sfxSynth.triggerAttackRelease('E5', '64n', now, 0.5);
          this.sfxSynth.triggerAttackRelease('B5', '32n', now + 0.045, 0.65);
          break;
        case 'knobTick': {
          const tMs = performance.now();
          if (tMs - this.lastKnobTickTime < 45) return;
          this.lastKnobTickTime = tMs;
          this.sfxSynth.triggerAttackRelease(420 + param * 640, '64n', now, 0.28);
          break;
        }
        case 'holoFanfare': {
          const notes = ['C5', 'E5', 'G5', 'A5', 'C6'];
          notes.forEach((n, i) => {
            this.previewRack.bellPoly.triggerAttackRelease(n, '8n', now + i * 0.065, 0.62);
          });
          break;
        }
        case 'mintStamp': {
          this.previewRack.kick.triggerAttackRelease(62, '16n', now, 0.9);
          const notes = ['C5', 'G5', 'C6', 'E6'];
          notes.forEach((n, i) => {
            this.previewRack.bellPoly.triggerAttackRelease(n, '8n', now + 0.06 + i * 0.07, 0.65);
          });
          break;
        }
        case 'portalWarp':
          this.sfxSynth.triggerAttackRelease('G5', '32n', now, 0.42);
          this.sfxSynth.triggerAttackRelease('D6', '16n', now + 0.04, 0.45);
          break;
      }
    } catch {
      // Safe fallback before audio gesture
    }
  }

  getFftData(): Float32Array {
    if (!this.initialized) return new Float32Array(32).fill(-100);
    return this.fft.getValue() as Float32Array;
  }

  getWaveformData(): Float32Array {
    if (!this.initialized) return new Float32Array(128).fill(0);
    return this.waveform.getValue() as Float32Array;
  }

  getMeterLevel(): number {
    if (!this.initialized) return 0;
    const db = this.meter.getValue();
    const val = Array.isArray(db) ? db[0] : db;
    if (!Number.isFinite(val)) return 0;
    return Math.min(1, Math.max(0, (val + 54) / 50));
  }
}

export const holoAudio = new HoloAudioEngine();
