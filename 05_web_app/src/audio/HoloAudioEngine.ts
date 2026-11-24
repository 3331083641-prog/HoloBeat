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
 * Curated 16-step musical hook contours (indices into scaleNotes 0..9)
 * Makes every step painted in the Beat Deck lock into a catchy, musical motif!
 */
const MELODY_CONTOUR: Record<ScaleId, number[]> = {
  PENTA_C: [5, 7, 8, 7, 5, 4, 5, 7, 8, 9, 8, 7, 5, 4, 3, 5],
  MINOR_C: [5, 6, 7, 8, 7, 6, 5, 4, 5, 7, 9, 8, 7, 6, 4, 5],
  DORIAN_C: [5, 6, 8, 7, 5, 3, 4, 6, 8, 9, 7, 6, 5, 4, 3, 5],
};

/**
 * 4-beat lush chord progressions per scale for VIBE tracks (beats 0..3 -> steps 0..15)
 */
const CHORD_PROGRESSIONS: Record<ScaleId, [string, string, string][]> = {
  PENTA_C: [
    ['C4', 'G4', 'D5'], // Csus2
    ['A3', 'E4', 'C5'], // Am7 flavor
    ['F3', 'C4', 'A4'], // Fmaj7 flavor
    ['G3', 'D4', 'A4'], // G9sus4
  ],
  MINOR_C: [
    ['C4', 'Eb4', 'Bb4'], // Cm7
    ['Ab3', 'Eb4', 'G4'], // AbMaj7
    ['F3', 'C4', 'Eb4'], // Fm7
    ['G3', 'D4', 'F4'], // G7sus
  ],
  DORIAN_C: [
    ['C4', 'Eb4', 'G4'], // Cm
    ['F3', 'A3', 'D4'], // F6 / Dm7
    ['Bb3', 'D4', 'A4'], // BbMaj7
    ['G3', 'C4', 'F4'], // G11
  ],
};

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
  squareFilter: Tone.Filter;
  pluckPoly: Tone.PolySynth<Tone.Synth>;
  padPoly: Tone.PolySynth<Tone.Synth>;
  padFilter: Tone.Filter;
  dispose: () => void;
}

export function createVoiceRack(destination: Tone.InputNode): SynthVoiceRack {
  const rackGain = new Tone.Gain(0.95).connect(destination);

  const kick = new Tone.MembraneSynth({
    pitchDecay: 0.042,
    octaves: 5.5,
    oscillator: { type: 'sine' },
    envelope: { attack: 0.002, decay: 0.24, sustain: 0.01, release: 0.14 },
  }).connect(rackGain);

  const subKick = new Tone.MembraneSynth({
    pitchDecay: 0.068,
    octaves: 4.5,
    oscillator: { type: 'triangle' },
    envelope: { attack: 0.003, decay: 0.36, sustain: 0.02, release: 0.22 },
  }).connect(rackGain);

  const woodSnap = new Tone.Synth({
    oscillator: { type: 'triangle' },
    envelope: { attack: 0.001, decay: 0.055, sustain: 0, release: 0.035 },
  }).connect(rackGain);

  const whiteFilter = new Tone.Filter(3800, 'bandpass').connect(rackGain);
  whiteFilter.Q.value = 2.6;
  const whiteNoise = new Tone.NoiseSynth({
    noise: { type: 'white' },
    envelope: { attack: 0.001, decay: 0.085, sustain: 0, release: 0.045 },
  }).connect(whiteFilter);

  const pinkFilter = new Tone.Filter(1900, 'bandpass').connect(rackGain);
  pinkFilter.Q.value = 1.2;
  const pinkNoise = new Tone.NoiseSynth({
    noise: { type: 'pink' },
    envelope: { attack: 0.008, decay: 0.22, sustain: 0.03, release: 0.14 },
  }).connect(pinkFilter);

  const bellPoly = new Tone.PolySynth(Tone.FMSynth, {
    harmonicity: 3.05,
    modulationIndex: 6.2,
    oscillator: { type: 'sine' },
    modulation: { type: 'triangle' },
    envelope: { attack: 0.002, decay: 0.34, sustain: 0.02, release: 0.42 },
    modulationEnvelope: { attack: 0.002, decay: 0.15, sustain: 0, release: 0.14 },
  }).connect(rackGain);
  bellPoly.maxPolyphony = 10;
  bellPoly.volume.value = -3;

  // Warm-filtered chiptune pulse (softened edges so 8-bit sounds nostalgic, never piercing!)
  const squareFilter = new Tone.Filter(3600, 'lowpass').connect(rackGain);
  squareFilter.Q.value = 1.2;
  const squarePoly = new Tone.PolySynth(Tone.Synth, {
    oscillator: { type: 'pulse', width: 0.28 },
    envelope: { attack: 0.003, decay: 0.15, sustain: 0.05, release: 0.16 },
  }).connect(squareFilter);
  squarePoly.maxPolyphony = 8;
  squarePoly.volume.value = -8.5;

  const pluckPoly = new Tone.PolySynth(Tone.Synth, {
    oscillator: { type: 'triangle' },
    envelope: { attack: 0.002, decay: 0.28, sustain: 0.04, release: 0.36 },
  }).connect(rackGain);
  pluckPoly.maxPolyphony = 10;
  pluckPoly.volume.value = -4;

  // Lush analog-filtered Juno-style pad synth (no harsh raw buzz!)
  const padFilter = new Tone.Filter(2100, 'lowpass').connect(rackGain);
  padFilter.Q.value = 1.4;
  const padPoly = new Tone.PolySynth(Tone.Synth, {
    oscillator: { type: 'fatsawtooth', count: 2, spread: 18 },
    envelope: { attack: 0.03, decay: 0.32, sustain: 0.16, release: 0.48 },
  }).connect(padFilter);
  padPoly.maxPolyphony = 8;
  padPoly.volume.value = -13.5;

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
    squareFilter,
    pluckPoly,
    padPoly,
    padFilter,
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
      squareFilter.dispose();
      pluckPoly.dispose();
      padPoly.dispose();
      padFilter.dispose();
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
  const stepIdx = opts.stepIndex ?? 0;

  // Musical contour note selection with gentle tone-based octave/degree lift
  const contourDeg = MELODY_CONTOUR[scaleId][stepIdx % 16];
  const toneOffset = Math.round((tone - 0.5) * 4);
  const noteIdx = Math.min(scaleNotes.length - 1, Math.max(0, contourDeg + toneOffset));
  const chosenNote = opts.note ?? scaleNotes[noteIdx];

  const beatQuarter = Math.floor((stepIdx % 16) / 4);
  const chord = CHORD_PROGRESSIONS[scaleId][beatQuarter];

  const pitchShiftSemis = Math.round((tone - 0.5) * 6);
  const shiftFreq = (baseHz: number) => baseHz * Math.pow(2, pitchShiftSemis / 12);

  try {
    switch (cardId) {
      // === BEAT ===
      case 'card-01': {
        // 弄堂竹板梆子: deep punchy 808-style thump + hollow wooden bamboo clack
        rack.kick.triggerAttackRelease(shiftFreq(58), '16n', now, vel * 0.96);
        rack.woodSnap.triggerAttackRelease(shiftFreq(740), '64n', now, vel * 0.42);
        rack.woodSnap.triggerAttackRelease(shiftFreq(520), '64n', now + 0.016, vel * 0.25);
        break;
      }
      case 'card-02': {
        // 老式街机拍键: snappy arcade punch kick + crisp microswitch click
        rack.kick.triggerAttackRelease(shiftFreq(74), '16n', now, vel * 0.96);
        rack.whiteFilter.frequency.setValueAtTime(3400 + tone * 2800, now);
        rack.whiteNoise.triggerAttackRelease('64n', now, vel * 0.44);
        break;
      }
      case 'card-03': {
        // 糖炒栗子爆壳: warm sub kick + sizzling roasted shell crackle burst
        rack.kick.triggerAttackRelease(shiftFreq(66), '16n', now, vel * 0.85);
        rack.whiteFilter.frequency.setValueAtTime(4800 + tone * 1400, now);
        rack.whiteNoise.triggerAttackRelease('64n', now + 0.012, vel * 0.55);
        rack.whiteNoise.triggerAttackRelease('64n', now + 0.036, vel * 0.3);
        break;
      }
      case 'card-04': {
        // 舞狮咚咚大鼓: resonant festival taiko drum + crisp rim knock
        rack.subKick.triggerAttackRelease(shiftFreq(50), '8n', now, vel * 1.0);
        rack.woodSnap.triggerAttackRelease(shiftFreq(290), '32n', now, vel * 0.42);
        break;
      }

      // === PERC ===
      case 'card-05': {
        // 二八大杠车铃: iconic sparkling brass double-ring bicycle bell!
        const n1 = opts.note ?? (stepIdx % 4 === 0 ? 'G5' : 'D6');
        const f1 = Tone.Frequency(n1).toFrequency() * (0.94 + tone * 0.14);
        rack.bellPoly.triggerAttackRelease(f1, '16n', now, vel * 0.52);
        rack.bellPoly.triggerAttackRelease(f1 * 1.498, '16n', now + 0.048, vel * 0.36);
        break;
      }
      case 'card-06': {
        // 冰镇汽水拉环: metallic pull-tab snap + crisp cold soda fizz hat
        rack.whiteFilter.frequency.setValueAtTime(5600 + tone * 2800, now);
        rack.whiteNoise.triggerAttackRelease('16n', now, vel * 0.56);
        rack.woodSnap.triggerAttackRelease(shiftFreq(1650), '64n', now, vel * 0.32);
        break;
      }
      case 'card-07': {
        // 麻将碰杠脆碰: unmistakable ivory mahjong tile resonant double-clack
        rack.woodSnap.triggerAttackRelease(shiftFreq(1920), '64n', now, vel * 0.68);
        rack.woodSnap.triggerAttackRelease(shiftFreq(2460), '64n', now + 0.034, vel * 0.56);
        rack.whiteFilter.frequency.setValueAtTime(2900, now);
        rack.whiteNoise.triggerAttackRelease('64n', now, vel * 0.38);
        break;
      }
      case 'card-08': {
        // 货郎拨浪鼓: playful wooden double-bead snare tap
        rack.woodSnap.triggerAttackRelease(shiftFreq(460), '32n', now, vel * 0.72);
        rack.woodSnap.triggerAttackRelease(shiftFreq(615), '32n', now + 0.052, vel * 0.6);
        break;
      }

      // === MELODY ===
      case 'card-09': {
        // 8-Bit 街机投币: iconic catchy rising chiptune coin chime (softened analog edge)
        const baseFreq = Tone.Frequency(chosenNote).toFrequency();
        rack.squareFilter.frequency.setValueAtTime(2000 + tone * 3400, now);
        rack.squarePoly.triggerAttackRelease(baseFreq, '16n', now, vel * 0.54);
        rack.squarePoly.triggerAttackRelease(baseFreq * 1.498, '16n', now + 0.058, vel * 0.42);
        break;
      }
      case 'card-10': {
        // 糖画铜勺叮当: crystalline glassy FM chime
        rack.bellPoly.triggerAttackRelease(chosenNote, '8n', now, vel * 0.62);
        break;
      }
      case 'card-11': {
        // 赛博古筝拨弦: oriental pentatonic plucked string + shimmering octave grace note
        const f = Tone.Frequency(chosenNote).toFrequency();
        rack.pluckPoly.triggerAttackRelease(f, '8n', now, vel * 0.76);
        rack.pluckPoly.triggerAttackRelease(f * 2, '16n', now + 0.022, vel * 0.3);
        break;
      }
      case 'card-12': {
        // 摩天轮八音盒: dreamy celesta music-box sparkle harmony
        const f = Tone.Frequency(chosenNote).toFrequency();
        rack.bellPoly.triggerAttackRelease([f, f * 1.498], '4n', now, vel * 0.52);
        break;
      }

      // === VIBE ===
      case 'card-13': {
        // 夜市铁板滋啦: appetizing gentle sizzle + lush neo-soul warm chord progression
        rack.pinkFilter.frequency.setValueAtTime(2200 + tone * 2400, now);
        rack.pinkNoise.triggerAttackRelease('16n', now, vel * 0.34);
        rack.padFilter.frequency.setValueAtTime(1400 + tone * 2400, now);
        rack.padPoly.triggerAttackRelease(chord, '8n', now, vel * 0.56);
        break;
      }
      case 'card-14': {
        // 梅雨铁皮雨棚: cozy raindrop patter + warm Rhodes lo-fi voicing
        rack.pinkFilter.frequency.setValueAtTime(2400 + tone * 1600, now);
        rack.pinkNoise.triggerAttackRelease('16n', now, vel * 0.28);
        rack.pluckPoly.triggerAttackRelease(chord, '4n', now, vel * 0.44);
        break;
      }
      case 'card-15': {
        // 港风霓虹电流: retro 90s vaporwave warm synth swell
        rack.padFilter.frequency.setValueAtTime(1200 + tone * 3000, now);
        rack.padPoly.triggerAttackRelease(chord, '4n', now, vel * 0.62);
        break;
      }
      case 'card-16': {
        // 晚风胡同蝉鸣: shimmering moonlit harmonics + gentle cicada breeze
        const f = Tone.Frequency(chosenNote).toFrequency();
        rack.bellPoly.triggerAttackRelease([f, f * 1.498], '4n', now, vel * 0.42);
        rack.padPoly.triggerAttackRelease([chord[0], chord[2]], '4n', now, vel * 0.34);
        rack.pinkFilter.frequency.setValueAtTime(4600, now);
        rack.pinkNoise.triggerAttackRelease('8n', now, vel * 0.16);
        break;
      }
      default: {
        rack.pluckPoly.triggerAttackRelease(chosenNote, '8n', now, vel * 0.65);
      }
    }
  } catch {
    // Prevent Tone scheduling exceptions on extreme rapid triggers
  }
}

class HoloAudioEngine {
  private initialized = false;
  private masterBus!: Tone.Gain;
  private bitCrusher!: Tone.BitCrusher;
  private streetEcho!: Tone.FeedbackDelay;
  private roomReverb!: Tone.Freeverb;
  private compressor!: Tone.Compressor;
  private limiter!: Tone.Limiter;
  private fft!: Tone.FFT;
  private waveform!: Tone.Waveform;
  private meter!: Tone.Meter;

  private trackFilters: Tone.Filter[] = [];
  private trackChannels: Tone.Channel[] = [];
  private trackRacks: SynthVoiceRack[] = [];
  private previewRack!: SynthVoiceRack;
  private sfxSynth!: Tone.Synth;
  private sfxPoly!: Tone.PolySynth<Tone.Synth>;
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
    if (Tone.getContext().state === 'running' && !useHoloStore.getState().audioUnlocked) {
      useHoloStore.getState().setAudioUnlocked(true);
    }
  }

  private initGraph() {
    if (this.initialized) return;
    this.initialized = true;

    this.limiter = new Tone.Limiter(-1).toDestination();
    this.compressor = new Tone.Compressor({
      threshold: -15,
      ratio: 3.2,
      attack: 0.008,
      release: 0.14,
    }).connect(this.limiter);

    this.roomReverb = new Tone.Freeverb({
      roomSize: 0.28,
      dampening: 4200,
      wet: 0.12,
    }).connect(this.compressor);

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
    }).connect(this.roomReverb);

    this.bitCrusher = new Tone.BitCrusher(4).connect(this.streetEcho);
    this.bitCrusher.wet.value = 0;

    this.masterBus = new Tone.Gain(0.96).connect(this.bitCrusher);

    // 4 dedicated track channels for Beat Deck
    for (let i = 0; i < 4; i++) {
      const channel = new Tone.Channel(0, 0).connect(this.masterBus);
      const filter = new Tone.Filter(12000, 'lowpass').connect(channel);
      const rack = createVoiceRack(filter);
      this.trackChannels.push(channel);
      this.trackFilters.push(filter);
      this.trackRacks.push(rack);
    }

    // Dedicated preview / pinball / forge voice rack (goes through warm room reverb!)
    this.previewRack = createVoiceRack(this.roomReverb);

    // Ultra-fast UI tactile SFX nodes
    this.sfxSynth = new Tone.Synth({
      oscillator: { type: 'triangle' },
      envelope: { attack: 0.001, decay: 0.042, sustain: 0, release: 0.028 },
    }).connect(this.limiter);
    this.sfxSynth.volume.value = -11;

    this.sfxPoly = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'triangle' },
      envelope: { attack: 0.006, decay: 0.26, sustain: 0.05, release: 0.4 },
    }).connect(this.roomReverb);
    this.sfxPoly.maxPolyphony = 6;
    this.sfxPoly.volume.value = -10;

    this.sfxNoiseFilter = new Tone.Filter(3800, 'highpass').connect(this.limiter);
    this.sfxNoise = new Tone.NoiseSynth({
      noise: { type: 'white' },
      envelope: { attack: 0.002, decay: 0.032, sustain: 0, release: 0.02 },
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

          // Subtle human velocity accent on strong downbeats (steps 0, 4, 8, 12)
          const grooveVel = step % 4 === 0 ? 0.92 : step % 2 === 0 ? 0.8 : 0.72;

          triggerCardOnRack(rack, track.cardId, {
            time,
            velocity: grooveVel,
            tone: track.tone,
            stepIndex: step,
            scale: state.scale,
          });

          // Live STUTTER DJ FX: crisp 32nd-note retrigger!
          if (state.liveFx.stutter) {
            const sub = Tone.Time('32n').toSeconds();
            triggerCardOnRack(rack, track.cardId, {
              time: time + sub,
              velocity: 0.62,
              tone: Math.min(1, track.tone + 0.14),
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

    this.bitCrusher.wet.rampTo(state.liveFx.bitcrush ? 0.8 : 0, 0.04);
    this.streetEcho.wet.rampTo(state.liveFx.echo ? 0.48 : 0, 0.05);

    const anySolo = state.tracks.some((t) => t.solo);
    state.tracks.forEach((t: TrackState, idx: number) => {
      const ch = this.trackChannels[idx];
      const filt = this.trackFilters[idx];
      if (!ch || !filt) return;
      const db = t.volume <= 0.01 ? -60 : Tone.gainToDb(t.volume);
      ch.volume.rampTo(db, 0.04);
      ch.mute = t.mute || (anySolo && !t.solo);
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

    // Joyful 3-note pentatonic phrase preview on Gacha / Drawer showcase!
    if (!opts.note && card.category === 'MELODY' && opts.stepIndex === undefined) {
      const notes = SCALE_META[scale].shortNotes;
      triggerCardOnRack(this.previewRack, card.id, {
        note: notes[2],
        time: now + 0.14,
        scale,
        velocity: 0.74,
      });
      triggerCardOnRack(this.previewRack, card.id, {
        note: notes[4],
        time: now + 0.28,
        scale,
        velocity: 0.86,
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
      | 'portalWarp'
      | 'bootChime'
      | 'cardFlip'
      | 'foilPress',
    param = 0.5
  ) {
    if (useHoloStore.getState().muted) return;
    try {
      await this.ensureStarted();
      const now = Tone.now();
      switch (kind) {
        case 'bootChime': {
          // Signature Teenage Engineering / Pocket Handheld warm analog startup chord!
          const notes = ['C5', 'G5', 'B5', 'D6'];
          notes.forEach((n, i) => {
            this.sfxPoly.triggerAttackRelease(n, '8n', now + i * 0.055, 0.65);
          });
          this.previewRack.bellPoly.triggerAttackRelease('G6', '4n', now + 0.22, 0.45);
          break;
        }
        case 'tab':
          this.sfxSynth.triggerAttackRelease('C6', '64n', now, 0.42);
          this.sfxSynth.triggerAttackRelease('G6', '64n', now + 0.024, 0.28);
          break;
        case 'click':
          this.sfxSynth.triggerAttackRelease(520 + param * 200, '64n', now, 0.4);
          break;
        case 'cardFlip':
          this.sfxNoiseFilter.frequency.setValueAtTime(2200, now);
          this.sfxNoise.triggerAttackRelease('32n', now, 0.42);
          this.sfxSynth.triggerAttackRelease('E5', '64n', now + 0.02, 0.35);
          break;
        case 'ratchet':
          for (let i = 0; i < 5; i++) {
            this.sfxSynth.triggerAttackRelease(240 + i * 85, '64n', now + i * 0.038, 0.48);
          }
          break;
        case 'capsuleDrop':
          this.sfxSynth.triggerAttackRelease(340, '32n', now, 0.56);
          this.sfxSynth.triggerAttackRelease(210, '32n', now + 0.065, 0.66);
          this.sfxSynth.triggerAttackRelease(500, '64n', now + 0.13, 0.45);
          break;
        case 'scratch': {
          const tMs = performance.now();
          if (tMs - this.lastScratchTime < 40) return;
          this.lastScratchTime = tMs;
          this.sfxNoiseFilter.frequency.setValueAtTime(3400 + Math.random() * 2400, now);
          this.sfxNoise.triggerAttackRelease('64n', now, 0.34 + param * 0.24);
          break;
        }
        case 'cartridgeLock':
          this.sfxSynth.triggerAttackRelease('E5', '64n', now, 0.5);
          this.sfxSynth.triggerAttackRelease('B5', '32n', now + 0.042, 0.64);
          break;
        case 'knobTick': {
          const tMs = performance.now();
          if (tMs - this.lastKnobTickTime < 42) return;
          this.lastKnobTickTime = tMs;
          this.sfxSynth.triggerAttackRelease(400 + param * 660, '64n', now, 0.25);
          break;
        }
        case 'holoFanfare': {
          const notes = ['C5', 'E5', 'G5', 'B5', 'D6'];
          notes.forEach((n, i) => {
            this.previewRack.bellPoly.triggerAttackRelease(n, '8n', now + i * 0.06, 0.6);
          });
          break;
        }
        case 'foilPress': {
          // Heavy hydraulic stamp impact + rising crystalline holo seal shimmer!
          this.previewRack.kick.triggerAttackRelease(54, '16n', now, 0.95);
          this.sfxNoiseFilter.frequency.setValueAtTime(1800, now);
          this.sfxNoise.triggerAttackRelease('16n', now, 0.55);
          const shimmer = ['G5', 'B5', 'D6', 'G6'];
          shimmer.forEach((n, i) => {
            this.previewRack.bellPoly.triggerAttackRelease(n, '8n', now + 0.12 + i * 0.065, 0.58);
          });
          break;
        }
        case 'mintStamp': {
          this.previewRack.kick.triggerAttackRelease(60, '16n', now, 0.88);
          const notes = ['C5', 'G5', 'C6', 'E6'];
          notes.forEach((n, i) => {
            this.previewRack.bellPoly.triggerAttackRelease(n, '8n', now + 0.055 + i * 0.068, 0.6);
          });
          break;
        }
        case 'portalWarp':
          this.sfxSynth.triggerAttackRelease('G5', '32n', now, 0.42);
          this.sfxSynth.triggerAttackRelease('D6', '16n', now + 0.038, 0.45);
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
