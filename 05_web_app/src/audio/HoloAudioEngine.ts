import * as Tone from 'tone';
import { getCardById } from '../data/soundCards';
import { useHoloStore } from '../store/useHoloStore';
import type {
  CompositionSnapshot,
  PerformanceEvent,
  PinballQuantizePreview,
  PinballRecordedEvent,
  ScaleId,
  TrackState,
} from '../types/holo';
import {
  CHORD_PROGRESSIONS,
  defaultVelocityForStep,
  normalizeTrackState,
  resolveNoteForStep,
} from './compositionEngine';

type StepListener = (step: number) => void;

export interface TriggerOptions {
  note?: string;
  velocity?: number; // 0..1
  time?: number;
  tone?: number; // 0..1
  gain?: number; // 0..1
  stepIndex?: number;
  durationSec?: number;
  scale?: ScaleId;
}

/**
 * Pure procedural synthesis rack shared by BOTH live engine and Tone.Offline WAV renderer!
 * Voice architecture models stylized street-sound translations (受市井声景启发的程序化合成).
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
  const stepIdx = opts.stepIndex ?? 0;
  const chosenNote = opts.note ?? resolveNoteForStep(scaleId, stepIdx, tone);
  const noteDur = opts.durationSec ? Math.min(1.8, Math.max(0.06, opts.durationSec)) : undefined;

  const beatQuarter = Math.floor((stepIdx % 16) / 4);
  const chord = CHORD_PROGRESSIONS[scaleId][beatQuarter];

  const pitchShiftSemis = Math.round((tone - 0.5) * 6);
  const shiftFreq = (baseHz: number) => baseHz * Math.pow(2, pitchShiftSemis / 12);

  try {
    switch (cardId) {
      case 'card-01': {
        rack.kick.triggerAttackRelease(shiftFreq(58), '16n', now, vel * 0.96);
        rack.woodSnap.triggerAttackRelease(shiftFreq(740), '64n', now, vel * 0.44);
        rack.woodSnap.triggerAttackRelease(shiftFreq(520), '64n', now + 0.016, vel * 0.28);
        break;
      }
      case 'card-02': {
        rack.kick.triggerAttackRelease(shiftFreq(74), '16n', now, vel * 0.96);
        rack.whiteFilter.frequency.setValueAtTime(3400 + tone * 2800, now);
        rack.whiteNoise.triggerAttackRelease('64n', now, vel * 0.44);
        break;
      }
      case 'card-03': {
        rack.kick.triggerAttackRelease(shiftFreq(66), '16n', now, vel * 0.85);
        rack.whiteFilter.frequency.setValueAtTime(4800 + tone * 1400, now);
        rack.whiteNoise.triggerAttackRelease('64n', now + 0.012, vel * 0.55);
        rack.whiteNoise.triggerAttackRelease('64n', now + 0.036, vel * 0.3);
        break;
      }
      case 'card-04': {
        rack.subKick.triggerAttackRelease(shiftFreq(50), '8n', now, vel * 1.0);
        rack.woodSnap.triggerAttackRelease(shiftFreq(290), '32n', now, vel * 0.42);
        break;
      }
      case 'card-05': {
        const n1 = opts.note ?? (stepIdx % 4 === 0 ? 'G5' : 'D6');
        const f1 = Tone.Frequency(n1).toFrequency() * (0.94 + tone * 0.14);
        rack.bellPoly.triggerAttackRelease(f1, noteDur ?? '16n', now, vel * 0.52);
        rack.bellPoly.triggerAttackRelease(f1 * 1.498, '16n', now + 0.048, vel * 0.36);
        break;
      }
      case 'card-06': {
        rack.whiteFilter.frequency.setValueAtTime(5600 + tone * 2800, now);
        rack.whiteNoise.triggerAttackRelease('16n', now, vel * 0.56);
        rack.woodSnap.triggerAttackRelease(shiftFreq(1650), '64n', now, vel * 0.32);
        break;
      }
      case 'card-07': {
        rack.woodSnap.triggerAttackRelease(shiftFreq(1920), '64n', now, vel * 0.68);
        rack.woodSnap.triggerAttackRelease(shiftFreq(2460), '64n', now + 0.034, vel * 0.56);
        rack.whiteFilter.frequency.setValueAtTime(2900, now);
        rack.whiteNoise.triggerAttackRelease('64n', now, vel * 0.38);
        break;
      }
      case 'card-08': {
        rack.woodSnap.triggerAttackRelease(shiftFreq(460), '32n', now, vel * 0.72);
        rack.woodSnap.triggerAttackRelease(shiftFreq(615), '32n', now + 0.052, vel * 0.6);
        break;
      }
      case 'card-09': {
        const baseFreq = Tone.Frequency(chosenNote).toFrequency();
        rack.squareFilter.frequency.setValueAtTime(2000 + tone * 3400, now);
        rack.squarePoly.triggerAttackRelease(baseFreq, noteDur ?? '16n', now, vel * 0.54);
        rack.squarePoly.triggerAttackRelease(baseFreq * 1.498, '16n', now + 0.058, vel * 0.42);
        break;
      }
      case 'card-10': {
        rack.bellPoly.triggerAttackRelease(chosenNote, noteDur ?? '8n', now, vel * 0.62);
        break;
      }
      case 'card-11': {
        const f = Tone.Frequency(chosenNote).toFrequency();
        rack.pluckPoly.triggerAttackRelease(f, noteDur ?? '8n', now, vel * 0.76);
        rack.pluckPoly.triggerAttackRelease(f * 2, '16n', now + 0.022, vel * 0.3);
        break;
      }
      case 'card-12': {
        const f = Tone.Frequency(chosenNote).toFrequency();
        rack.bellPoly.triggerAttackRelease([f, f * 1.498], noteDur ?? '4n', now, vel * 0.52);
        break;
      }
      case 'card-13': {
        rack.pinkFilter.frequency.setValueAtTime(2200 + tone * 2400, now);
        rack.pinkNoise.triggerAttackRelease('16n', now, vel * 0.34);
        rack.padFilter.frequency.setValueAtTime(1400 + tone * 2400, now);
        rack.padPoly.triggerAttackRelease(chord, noteDur ?? '8n', now, vel * 0.56);
        break;
      }
      case 'card-14': {
        rack.pinkFilter.frequency.setValueAtTime(2400 + tone * 1600, now);
        rack.pinkNoise.triggerAttackRelease('16n', now, vel * 0.28);
        rack.pluckPoly.triggerAttackRelease(chord, noteDur ?? '4n', now, vel * 0.44);
        break;
      }
      case 'card-15': {
        rack.padFilter.frequency.setValueAtTime(1200 + tone * 3000, now);
        rack.padPoly.triggerAttackRelease(chord, noteDur ?? '4n', now, vel * 0.62);
        break;
      }
      case 'card-16': {
        const f = Tone.Frequency(chosenNote).toFrequency();
        rack.bellPoly.triggerAttackRelease([f, f * 1.498], noteDur ?? '4n', now, vel * 0.42);
        rack.padPoly.triggerAttackRelease([chord[0], chord[2]], noteDur ?? '4n', now, vel * 0.34);
        rack.pinkFilter.frequency.setValueAtTime(4600, now);
        rack.pinkNoise.triggerAttackRelease('8n', now, vel * 0.16);
        break;
      }
      default: {
        rack.pluckPoly.triggerAttackRelease(chosenNote, noteDur ?? '8n', now, vel * 0.65);
      }
    }
  } catch {
    // Prevent Tone scheduling exceptions on extreme rapid triggers
  }
}

export interface SnapshotPlaybackCallbacks {
  onEvent?: (ev: PerformanceEvent) => void;
  onComplete?: () => void;
  loop?: boolean;
  leadInMs?: number;
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
  private snapshotRack!: SynthVoiceRack;
  private snapshotBitCrusher!: Tone.BitCrusher;
  private snapshotEcho!: Tone.FeedbackDelay;

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

  // Session-guarded Frozen Snapshot & Canonical WAV Playback State
  private playbackSessionId = 0;
  private snapshotActive = false;
  private snapshotStartAudioSec = 0;
  private snapshotLeadInMs = 0;
  private snapshotDurationMs = 0;
  private snapshotTimers: number[] = [];
  private activeBufferSource: AudioBufferSourceNode | null = null;
  private mediaStreamDest: MediaStreamAudioDestinationNode | null = null;

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

    for (let i = 0; i < 4; i++) {
      const channel = new Tone.Channel(0, 0).connect(this.masterBus);
      const filter = new Tone.Filter(12000, 'lowpass').connect(channel);
      const rack = createVoiceRack(filter);
      this.trackChannels.push(channel);
      this.trackFilters.push(filter);
      this.trackRacks.push(rack);
    }

    this.previewRack = createVoiceRack(this.roomReverb);

    this.snapshotEcho = new Tone.FeedbackDelay({
      delayTime: '8n.',
      feedback: 0.42,
      wet: 0,
    }).connect(this.roomReverb);
    this.snapshotBitCrusher = new Tone.BitCrusher(4).connect(this.snapshotEcho);
    this.snapshotBitCrusher.wet.value = 0;
    this.snapshotRack = createVoiceRack(this.snapshotBitCrusher);

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
    // True 32-step cycle supporting 1-bar (0..15) OR 2-bar independent A+B (0..31)!
    const steps = Array.from({ length: 32 }, (_, i) => i);
    this.sequence = new Tone.Sequence(
      (time, rawStep) => {
        const state = useHoloStore.getState();
        const bars = state.beatBars;
        const loopMode = state.beatPhraseLoop;
        const step =
          bars === 1 || loopMode === 'A'
            ? rawStep % 16
            : loopMode === 'B'
              ? 16 + (rawStep % 16)
              : rawStep;

        const tracks = state.tracks;
        const anySolo = tracks.some((t) => t.solo);
        const stepSec = 60 / Math.max(40, state.bpm) / 4;

        tracks.forEach((rawTrack, idx) => {
          const track = normalizeTrackState(rawTrack, bars);
          const isMuted = track.mute || (anySolo && !track.solo);
          if (isMuted) return;
          if (!track.steps[step]) return;

          const rack = this.trackRacks[idx];
          if (!rack) return;

          const cell = track.stepCells?.[step];
          const isAccented = Boolean(track.accents?.[step]);
          const baseVel = cell?.velocity ?? defaultVelocityForStep(step, isAccented);
          const grooveVel = Math.min(1, isAccented ? Math.max(0.95, baseVel) : baseVel);
          const pitchOffset = cell?.pitchOffset ?? 0;
          const lenMult = cell?.lengthSteps ?? 1;
          const explicitNote =
            track.category === 'MELODY'
              ? resolveNoteForStep(state.scale, step, track.tone, pitchOffset)
              : undefined;
          const baseDurMult =
            track.category === 'VIBE' ? 2.4 : track.category === 'MELODY' ? 1.35 : 0.85;

          triggerCardOnRack(rack, track.cardId, {
            time,
            note: explicitNote,
            velocity: grooveVel,
            tone: track.tone,
            stepIndex: step,
            durationSec: stepSec * baseDurMult * lenMult,
            scale: state.scale,
          });

          if (state.liveFx.stutter) {
            const sub = stepSec * 0.5;
            triggerCardOnRack(rack, track.cardId, {
              time: time + sub,
              note: explicitNote,
              velocity: Math.max(0.35, grooveVel * 0.68),
              tone: Math.min(1, track.tone + 0.14),
              stepIndex: step,
              durationSec: stepSec * 0.45,
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

  /**
   * Returns exact continuous step position driven by Tone.Transport audio clock
   * across 0..16 (1-bar / A / B loop) or 0..32 (2-bar A+B loop).
   */
  getTransportStepFloat(): number {
    if (!this.initialized) return -1;
    const transport = Tone.getTransport();
    if (transport.state !== 'started') return -1;
    const state = useHoloStore.getState();
    const bpm = Math.max(40, transport.bpm.value || state.bpm);
    const stepSec = 60 / bpm / 4;
    const posSec = Math.max(0, transport.seconds);
    const raw32 = (posSec / stepSec) % 32;
    if (state.beatBars === 1 || state.beatPhraseLoop === 'A') return raw32 % 16;
    if (state.beatPhraseLoop === 'B') return 16 + (raw32 % 16);
    return raw32;
  }

  async togglePlay(): Promise<boolean> {
    await this.ensureStarted();
    this.stopSnapshotPlayback();
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
    this.stopSnapshotPlayback();
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

  /**
   * Stop ALL active audio streams cleanly (workspace switch, pagehide, cancel, unseal)
   */
  stopAllPlayback(): void {
    this.playbackSessionId += 1;
    this.stopTransport();
    this.stopPinballRecording();
    this.stopSnapshotPlayback();
  }

  subscribeStep(fn: StepListener): () => void {
    this.stepListeners.add(fn);
    return () => this.stepListeners.delete(fn);
  }

  getCurrentStep(): number {
    return this.currentStep;
  }

  /**
   * Play the EXACT canonical rendered WAV Blob (shared with WAV export & Motion Card!)
   * Routed through the master limiter so FFT, meter, mute, and MediaStreamCapture stay 100% live!
   */
  async playAudioBlob(
    wavBlob: Blob,
    opts: {
      onComplete?: () => void;
      onEvent?: (ev: PerformanceEvent) => void;
      events?: PerformanceEvent[];
      leadInMs?: number;
    } = {}
  ): Promise<number> {
    await this.ensureStarted();
    this.stopTransport();
    this.stopPinballRecording();
    this.stopSnapshotPlayback();

    const sessionId = ++this.playbackSessionId;
    const leadInMs = opts.leadInMs ?? 20;

    try {
      const arrayBuf = await wavBlob.arrayBuffer();
      if (sessionId !== this.playbackSessionId) return sessionId;

      const rawCtx = Tone.getContext().rawContext as AudioContext;
      const decoded = await rawCtx.decodeAudioData(arrayBuf.slice(0));
      if (sessionId !== this.playbackSessionId) return sessionId;

      const source = rawCtx.createBufferSource();
      source.buffer = decoded;
      // Connect cleanly into Tone.Limiter input node so mute, meter, and MediaStreamCapture work!
      const toneInput = (this.limiter as unknown as { input: AudioNode }).input;
      if (toneInput) {
        source.connect(toneInput);
      } else {
        source.connect(rawCtx.destination);
      }

      const startAt = rawCtx.currentTime + leadInMs / 1000;
      this.activeBufferSource = source;
      this.snapshotActive = true;
      this.snapshotLeadInMs = leadInMs;
      this.snapshotStartAudioSec = Tone.now();
      this.snapshotDurationMs = Math.round(decoded.duration * 1000);

      if (opts.events && opts.onEvent) {
        const onEv = opts.onEvent;
        opts.events.forEach((ev) => {
          const t = window.setTimeout(() => {
            if (sessionId === this.playbackSessionId && this.snapshotActive) {
              onEv(ev);
            }
          }, leadInMs + ev.timeOffsetMs);
          this.snapshotTimers.push(t);
        });
      }

      source.onended = () => {
        if (sessionId !== this.playbackSessionId) return;
        this.activeBufferSource = null;
        this.snapshotActive = false;
        this.clearSnapshotTimers();
        opts.onComplete?.();
      };

      source.start(startAt);
      return sessionId;
    } catch {
      if (sessionId === this.playbackSessionId) {
        this.snapshotActive = false;
        opts.onComplete?.();
      }
      return sessionId;
    }
  }

  /**
   * Play ANY frozen immutable CompositionSnapshot cleanly with session-guarded timing!
   * Used by Choreographed Pinball Show for deterministic note-event animation callbacks.
   */
  async playCompositionSnapshot(
    snapshot: CompositionSnapshot,
    cbs: SnapshotPlaybackCallbacks = {}
  ): Promise<void> {
    await this.ensureStarted();
    this.stopTransport();
    this.stopPinballRecording();
    this.stopSnapshotPlayback();

    const sessionId = ++this.playbackSessionId;
    const leadInMs = cbs.leadInMs ?? 60;
    const events = snapshot.events;
    if (events.length === 0) {
      cbs.onComplete?.();
      return;
    }

    const fx = snapshot.beatSnapshot?.liveFx ?? { bitcrush: false, echo: false, stutter: false };
    const stepSec = 60 / Math.max(40, snapshot.bpm) / 4;
    this.snapshotBitCrusher.wet.value = fx.bitcrush ? 0.8 : 0;
    this.snapshotEcho.delayTime.value = stepSec * 3;
    this.snapshotEcho.wet.value = fx.echo ? 0.48 : 0;

    const schedulePass = () => {
      if (sessionId !== this.playbackSessionId) return;
      this.clearSnapshotTimers();
      this.snapshotActive = true;
      this.snapshotLeadInMs = leadInMs;
      this.snapshotDurationMs = Math.max(800, snapshot.durationMs);

      const baseAudioTime = Tone.now() + 0.04;
      this.snapshotStartAudioSec = baseAudioTime;
      const tracksByIdx = snapshot.beatSnapshot?.tracks;

      events.forEach((ev) => {
        const fireTime = baseAudioTime + (leadInMs + ev.timeOffsetMs) / 1000;
        const trackVol = tracksByIdx?.[ev.trackIndex]?.volume ?? 0.85;
        const useExplicitNote =
          snapshot.sourceType === 'pinball' ||
          ev.trackCategory === 'MELODY' ||
          ev.trackCategory === 'PERC';

        triggerCardOnRack(this.snapshotRack, ev.cardId, {
          time: fireTime,
          note: useExplicitNote ? ev.pitch : undefined,
          velocity: ev.velocity,
          gain: trackVol,
          tone: ev.tone ?? 0.5,
          stepIndex: ev.stepIndex ?? 0,
          durationSec: Math.max(0.06, ev.durationMs / 1000),
          scale: snapshot.scale,
        });

        Tone.getDraw().schedule(() => {
          if (sessionId === this.playbackSessionId && this.snapshotActive) {
            cbs.onEvent?.(ev);
          }
        }, fireTime);
      });

      const tailMs = snapshot.tailMs ?? 180;
      const totalMs = leadInMs + this.snapshotDurationMs + Math.min(350, tailMs);
      const doneTimer = window.setTimeout(() => {
        if (sessionId !== this.playbackSessionId || !this.snapshotActive) return;
        if (cbs.loop) {
          schedulePass();
        } else {
          this.snapshotActive = false;
          cbs.onComplete?.();
        }
      }, totalMs);
      this.snapshotTimers.push(doneTimer);
    };

    schedulePass();
  }

  /** Audition the quantized grid preview right next to the raw pinball recording for honest A/B comparison */
  async playQuantizedPreview(preview: PinballQuantizePreview, scale: ScaleId): Promise<void> {
    await this.ensureStarted();
    this.stopPinballRecording();
    const state = useHoloStore.getState();
    const stepMs = (60 / Math.max(40, preview.bpm) / 4) * 1000;
    const totalSteps = preview.targetBars * 16;

    for (let step = 0; step < totalSteps; step++) {
      const delay = Math.round(step * stepMs);
      const timer = window.setTimeout(() => {
        preview.ghostSteps.forEach((row, tIdx) => {
          if (!row[step]) return;
          const cardId = preview.trackCardIds[tIdx] ?? state.tracks[tIdx]?.cardId ?? 'card-01';
          triggerCardOnRack(this.previewRack, cardId, {
            stepIndex: step,
            velocity: 0.82,
            scale,
          });
        });
      }, delay);
      this.pinballTimers.push(timer);
    }
  }

  getSnapshotPlaybackMs(): number {
    if (!this.initialized || !this.snapshotActive) return -1;
    const elapsedMs = (Tone.now() - this.snapshotStartAudioSec) * 1000;
    return elapsedMs - this.snapshotLeadInMs;
  }

  isSnapshotPlaying(): boolean {
    return this.snapshotActive;
  }

  private clearSnapshotTimers() {
    this.snapshotTimers.forEach((t) => window.clearTimeout(t));
    this.snapshotTimers = [];
  }

  stopSnapshotPlayback(): void {
    this.playbackSessionId += 1;
    this.snapshotActive = false;
    this.clearSnapshotTimers();

    if (this.activeBufferSource) {
      try {
        this.activeBufferSource.onended = null;
        this.activeBufferSource.stop();
        this.activeBufferSource.disconnect();
      } catch {
        // Ignore already-stopped source errors
      }
      this.activeBufferSource = null;
    }

    if (this.initialized) {
      try {
        this.snapshotRack.padPoly.releaseAll();
        this.snapshotRack.bellPoly.releaseAll();
        this.snapshotRack.pluckPoly.releaseAll();
        this.snapshotRack.squarePoly.releaseAll();
      } catch {
        // Ignore release errors
      }
    }
  }

  async getAudioCaptureStream(): Promise<MediaStream | null> {
    await this.ensureStarted();
    try {
      const rawCtx = Tone.getContext().rawContext as AudioContext;
      if (typeof rawCtx.createMediaStreamDestination !== 'function') return null;
      if (!this.mediaStreamDest) {
        this.mediaStreamDest = rawCtx.createMediaStreamDestination();
        this.limiter.connect(this.mediaStreamDest);
      }
      return this.mediaStreamDest.stream;
    } catch {
      return null;
    }
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

    if (!opts.note && card.category === 'MELODY' && opts.stepIndex === undefined) {
      const notes = [
        resolveNoteForStep(scale, 0, 0.5),
        resolveNoteForStep(scale, 2, 0.5),
        resolveNoteForStep(scale, 8, 0.5),
      ];
      triggerCardOnRack(this.previewRack, card.id, {
        note: notes[1],
        time: now + 0.14,
        scale,
        velocity: 0.74,
      });
      triggerCardOnRack(this.previewRack, card.id, {
        note: notes[2],
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
    const minOffset = events.reduce((m, e) => Math.min(m, e.timeOffsetMs), events[0].timeOffsetMs);
    let maxDelay = 0;

    events.forEach((ev) => {
      const delay = Math.max(0, ev.timeOffsetMs - minOffset);
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
          const notes = ['C5', 'G5', 'B5', 'D6'];
          notes.forEach((n, i) => {
            this.sfxPoly.triggerAttackRelease(n, '8n', now + i * 0.055, 0.65);
          });
          this.previewRack.bellPoly.triggerAttackRelease('G6', '4n', now + 0.22, 0.45);
          break;
        }
        case 'tab':
          this.sfxSynth.triggerAttackRelease('C6', '64n', now, 0.42);
          this.sfxNoise.triggerAttackRelease('64n', now, 0.28);
          break;
        case 'click':
          this.sfxSynth.triggerAttackRelease(520 + param * 420, '64n', now, 0.42);
          break;
        case 'knobTick': {
          if (now - this.lastKnobTickTime < 0.035) return;
          this.lastKnobTickTime = now;
          this.sfxSynth.triggerAttackRelease(680 + param * 640, '64n', now, 0.28);
          break;
        }
        case 'ratchet':
          [0, 0.045, 0.095, 0.15, 0.21].forEach((off, i) => {
            this.sfxSynth.triggerAttackRelease(340 + i * 75, '64n', now + off, 0.42);
          });
          break;
        case 'capsuleDrop':
          this.previewRack.kick.triggerAttackRelease(120, '32n', now, 0.48);
          this.sfxSynth.triggerAttackRelease('G5', '32n', now + 0.07, 0.46);
          this.sfxSynth.triggerAttackRelease('C6', '32n', now + 0.14, 0.52);
          break;
        case 'scratch': {
          if (now - this.lastScratchTime < 0.06) return;
          this.lastScratchTime = now;
          this.sfxNoise.triggerAttackRelease('64n', now, 0.34);
          break;
        }
        case 'cartridgeLock':
          this.sfxSynth.triggerAttackRelease('D5', '64n', now, 0.5);
          this.sfxSynth.triggerAttackRelease('A5', '32n', now + 0.045, 0.56);
          break;
        case 'cardFlip':
          this.sfxNoise.triggerAttackRelease('64n', now, 0.25);
          this.sfxSynth.triggerAttackRelease('E6', '64n', now + 0.03, 0.35);
          break;
        case 'foilPress':
          this.sfxNoise.triggerAttackRelease('16n', now, 0.3);
          this.sfxPoly.triggerAttackRelease(['C5', 'G5', 'D6'], '8n', now + 0.06, 0.52);
          break;
        case 'holoFanfare':
          ['C5', 'E5', 'G5', 'B5', 'D6'].forEach((n, i) => {
            this.sfxPoly.triggerAttackRelease(n, '8n', now + i * 0.055, 0.62);
          });
          this.previewRack.bellPoly.triggerAttackRelease('C6', '4n', now + 0.26, 0.55);
          break;
        case 'mintStamp':
          this.previewRack.kick.triggerAttackRelease(68, '16n', now, 0.85);
          this.sfxPoly.triggerAttackRelease(['C5', 'G5', 'C6'], '4n', now + 0.05, 0.65);
          break;
        case 'portalWarp':
          this.sfxSynth.triggerAttackRelease('G5', '32n', now, 0.45);
          this.sfxSynth.triggerAttackRelease('D6', '32n', now + 0.05, 0.5);
          break;
      }
    } catch {
      // Non-critical UI SFX ignore
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
    const num = Array.isArray(db) ? db[0] : db;
    if (!Number.isFinite(num)) return 0;
    return Math.min(1, Math.max(0, (num + 56) / 48));
  }
}

export const holoAudio = new HoloAudioEngine();
