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
  compileBeatToEvents, getStepTimeMs, applyQuantizedTracks, createBeatCompositionSnapshot,
  refreshQuantizePreview, normalizePinballEvents,
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

export function createVoiceRack(destination: Tone.InputNode, context = Tone.getContext()): SynthVoiceRack {
  const rackGain = new Tone.Gain({context, gain: 0.95}).connect(destination);

  const kick = new Tone.MembraneSynth({
    context,
    pitchDecay: 0.042,
    octaves: 5.5,
    oscillator: { type: 'sine' },
    envelope: { attack: 0.002, decay: 0.24, sustain: 0.01, release: 0.14 },
  }).connect(rackGain);

  const subKick = new Tone.MembraneSynth({
    context,
    pitchDecay: 0.068,
    octaves: 4.5,
    oscillator: { type: 'triangle' },
    envelope: { attack: 0.003, decay: 0.36, sustain: 0.02, release: 0.22 },
  }).connect(rackGain);

  const woodSnap = new Tone.Synth({
    context,
    oscillator: { type: 'triangle' },
    envelope: { attack: 0.001, decay: 0.055, sustain: 0, release: 0.035 },
  }).connect(rackGain);

  const whiteFilter = new Tone.Filter({ context, frequency: 3800, type: 'bandpass' }).connect(rackGain);
  whiteFilter.Q.value = 2.6;
  const whiteNoise = new Tone.NoiseSynth({
    context,
    noise: { type: 'white' },
    envelope: { attack: 0.001, decay: 0.085, sustain: 0, release: 0.045 },
  }).connect(whiteFilter);

  const pinkFilter = new Tone.Filter({ context, frequency: 1900, type: 'bandpass' }).connect(rackGain);
  pinkFilter.Q.value = 1.2;
  const pinkNoise = new Tone.NoiseSynth({
    context,
    noise: { type: 'pink' },
    envelope: { attack: 0.008, decay: 0.22, sustain: 0.03, release: 0.14 },
  }).connect(pinkFilter);

  const bellPoly = new Tone.PolySynth<Tone.FMSynth>({ context, voice: Tone.FMSynth, options: {
    harmonicity: 3.05,
    modulationIndex: 6.2,
    oscillator: { type: 'sine' },
    modulation: { type: 'triangle' },
    envelope: { attack: 0.002, decay: 0.34, sustain: 0.02, release: 0.42 },
    modulationEnvelope: { attack: 0.002, decay: 0.15, sustain: 0, release: 0.14 },
  } }).connect(rackGain);
  bellPoly.maxPolyphony = 10;
  bellPoly.volume.value = -3;

  const squareFilter = new Tone.Filter({ context, frequency: 3600, type: 'lowpass' }).connect(rackGain);
  squareFilter.Q.value = 1.2;
  const squarePoly = new Tone.PolySynth<Tone.Synth>({ context, voice: Tone.Synth, options: {
    oscillator: { type: 'pulse', width: 0.28 },
    envelope: { attack: 0.003, decay: 0.15, sustain: 0.05, release: 0.16 },
  } }).connect(squareFilter);
  squarePoly.maxPolyphony = 8;
  squarePoly.volume.value = -8.5;

  const pluckPoly = new Tone.PolySynth<Tone.Synth>({ context, voice: Tone.Synth, options: {
    oscillator: { type: 'triangle' },
    envelope: { attack: 0.002, decay: 0.28, sustain: 0.04, release: 0.36 },
  } }).connect(rackGain);
  pluckPoly.maxPolyphony = 10;
  pluckPoly.volume.value = -4;

  const padFilter = new Tone.Filter({ context, frequency: 2100, type: 'lowpass' }).connect(rackGain);
  padFilter.Q.value = 1.4;
  const padPoly = new Tone.PolySynth<Tone.Synth>({ context, voice: Tone.Synth, options: {
    oscillator: { type: 'fatsawtooth', count: 2, spread: 18 },
    envelope: { attack: 0.03, decay: 0.32, sustain: 0.16, release: 0.48 },
  } }).connect(padFilter);
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
  const vel = Math.min(1, Math.max(0, (opts.velocity ?? 0.82) * (opts.gain ?? 1)));
  const tone = opts.tone ?? 0.5;
  const scaleId = opts.scale ?? 'PENTA_C';
  const stepIdx = opts.stepIndex ?? 0;
  const chosenNote = opts.note ?? resolveNoteForStep(scaleId, stepIdx, tone);
  const noteDur = opts.durationSec;

  const beatQuarter = Math.floor((stepIdx % 16) / 4);
  const chord = CHORD_PROGRESSIONS[scaleId][beatQuarter];

  const pitchShiftSemis = Math.round((tone - 0.5) * 6);
  const shiftFreq = (baseHz: number) => baseHz * Math.pow(2, pitchShiftSemis / 12);

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
  private previewReverb!: Tone.Freeverb;
  private transportOutput!: Tone.Gain;
  private previewOutput!: Tone.Gain;
  private compressor!: Tone.Compressor;
  private limiter!: Tone.Limiter;
  private fft!: Tone.FFT;
  private waveform!: Tone.Waveform;
  private meter!: Tone.Meter;

  private trackFilters: Tone.Filter[] = [];
  private trackChannels: Tone.Gain[] = [];
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
  private pinballSession = 0;
  private previewSession = 0;
  private lastPreviewAudioTime = 0;
  private overlapRacks = new Map<SynthVoiceRack, number>();
  private repeatRacks: SynthVoiceRack[] = [];
  private transportSession = 0;
  private transportStartSec = 0;
  private snapshotFrame = 0;

  // Session-guarded Frozen Snapshot & Canonical WAV Playback State
  private playbackSessionId = 0;
  private snapshotActive = false;
  private snapshotStartAudioSec = 0;
  private snapshotDurationMs = 0;
  private activeBufferSource: AudioBufferSourceNode | null = null;

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

    this.limiter = new Tone.Limiter(-1).toDestination();
    this.compressor = new Tone.Compressor({
      threshold: -15,
      ratio: 3.2,
      attack: 0.008,
      release: 0.14,
    }).connect(this.limiter);

    this.transportOutput = new Tone.Gain(0).connect(this.compressor);
    this.previewOutput = new Tone.Gain(1).connect(this.compressor);
    this.roomReverb = this.createRoom(this.transportOutput);
    this.previewReverb = this.createRoom(this.previewOutput);

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
      const channel = new Tone.Gain(1).connect(this.masterBus);
      const filter = new Tone.Filter(12000, 'lowpass').connect(channel);
      const rack = createVoiceRack(filter);
      this.trackChannels.push(channel);
      this.trackFilters.push(filter);
      this.trackRacks.push(rack);
    }

    this.previewRack = createVoiceRack(this.previewReverb);
    this.initSfx();
    this.initialized = true;
    this.setupSequencer();
    this.syncFromStore();
    document.addEventListener('visibilitychange', () => { if (document.hidden) this.stopAllPlayback(); });
    useHoloStore.subscribe((state, previous) => {
      if (state.activePage !== previous.activePage) this.stopAllPlayback();
    });
  }

  private createRoom(output: Tone.Gain) {
    return new Tone.Freeverb({ roomSize: 0.28, dampening: 4200, wet: 0.12 }).connect(output);
  }

  private initSfx() {
    this.sfxSynth = new Tone.Synth({
      oscillator: { type: 'triangle' },
      envelope: { attack: 0.001, decay: 0.042, sustain: 0, release: 0.028 },
    }).connect(this.limiter);
    this.sfxSynth.volume.value = -11;

    this.sfxPoly = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'triangle' },
      envelope: { attack: 0.006, decay: 0.26, sustain: 0.05, release: 0.4 },
    }).connect(this.compressor);
    this.sfxPoly.maxPolyphony = 6;
    this.sfxPoly.volume.value = -10;

    this.sfxNoiseFilter = new Tone.Filter(3800, 'highpass').connect(this.limiter);
    this.sfxNoise = new Tone.NoiseSynth({
      noise: { type: 'white' },
      envelope: { attack: 0.002, decay: 0.032, sustain: 0, release: 0.02 },
    }).connect(this.sfxNoiseFilter);
    this.sfxNoise.volume.value = -18;

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

        const events = compileBeatToEvents({ ...state, bars, activePhraseLoop: loopMode });
        const relative = bars === 2 && loopMode === 'AB' ? step : step % 16;
        const straightMs = relative * 15000 / state.bpm;
        const hitTime = time + (getStepTimeMs(relative, state.bpm, state.swing) - straightMs) / 1000;
        const session = this.transportSession;
        for (const ev of events) {
          if (ev.stepIndex !== step) continue;
          const rack = ev.id.endsWith('-stut')
            ? (this.repeatRacks[ev.trackIndex] ??= createVoiceRack(this.trackFilters[ev.trackIndex]))
            : this.trackRacks[ev.trackIndex];
          const onset = Math.max(time, time + (ev.timeOffsetMs - straightMs) / 1000);
          if (document.documentElement.dataset.measureMotion === 'true') {
            performance.mark('holobeat-live-note', { detail: { id: ev.id, trackIndex: ev.trackIndex,
              stepIndex: ev.stepIndex, clockMs: onset * 1000 } });
          }
          triggerCardOnRack(rack, ev.cardId, { time: onset,
            note: ev.pitch, velocity: ev.velocity, tone: ev.tone, stepIndex: step, durationSec: ev.durationMs / 1000,
            scale: state.scale });
        }

        Tone.getDraw().schedule(() => {
          if (session !== this.transportSession) return;
          this.currentStep = step;
          this.stepListeners.forEach((fn) => fn(step));
        }, hitTime);
      },
      steps,
      '16n'
    );
    this.sequence.start(0);
  }

  private enableTransportOutput(enabled: boolean) {
    const {tracks} = useHoloStore.getState();
    const solo = tracks.some(track => track.solo);
    const audible = tracks.some(track => !track.mute && track.volume > 0 && (!solo || track.solo));
    this.transportOutput.gain.setValueAtTime(enabled && audible ? 1 : 0, Tone.immediate());
  }

  syncFromStore() {
    if (!this.initialized) return;
    const state = useHoloStore.getState();
    Tone.getDestination().mute = state.muted;
    this.enableTransportOutput(Tone.getTransport().state === 'started');
    Tone.getTransport().bpm.value = state.bpm;
    this.streetEcho.delayTime.value = 45 / state.bpm;
    Tone.getTransport().swing = 0;
    Tone.getTransport().swingSubdivision = '16n';

    this.bitCrusher.wet.rampTo(state.liveFx.bitcrush ? 0.8 : 0, 0.04);
    this.streetEcho.wet.rampTo(state.liveFx.echo ? 0.48 : 0, 0.05);

    const anySolo = state.tracks.some((t) => t.solo);
    state.tracks.forEach((t: TrackState, idx: number) => {
      const ch = this.trackChannels[idx];
      const filt = this.trackFilters[idx];
      if (!ch || !filt) return;
      const gain = t.mute || (anySolo && !t.solo) ? 0 : t.volume;
      if (gain === 0) {
        ch.gain.cancelScheduledValues(Tone.immediate());
        ch.gain.setValueAtTime(0, Tone.immediate());
      } else if (ch.gain.value !== gain) {
        ch.gain.rampTo(gain, 0.04);
      }
      const freq = 650 * Math.pow(21.5, t.tone);
      filt.frequency.rampTo(freq, 0.04);
    });
  }

  /**
   * Returns exact continuous step position driven by Tone.Transport audio clock
   * across 0..16 (1-bar / A / B loop) or 0..32 (2-bar A+B loop).
   */
  getAudioClockMs(): number { return Tone.immediate() * 1000; }

  getTransportStepFloat(): number {
    if (!this.initialized) return -1;
    const transport = Tone.getTransport();
    if (transport.state !== 'started') return -1;
    const state = useHoloStore.getState();
    const now = Tone.immediate();
    if (now < this.transportStartSec) return -1;
    const ticks = transport.getTicksAtTime(now);
    const raw = (ticks / (transport.PPQ / 4)) % 32;
    const ms = raw * 15000 / state.bpm;
    let step = Math.floor(raw);
    if (ms < getStepTimeMs(step, state.bpm, state.swing)) step = Math.max(0, step - 1);
    const start = getStepTimeMs(step, state.bpm, state.swing);
    const end = getStepTimeMs(step + 1, state.bpm, state.swing);
    const raw32 = step + (ms - start) / (end - start);
    if (state.beatBars === 1 || state.beatPhraseLoop === 'A') return raw32 % 16;
    if (state.beatPhraseLoop === 'B') return 16 + (raw32 % 16);
    return raw32;
  }

  async togglePlay(): Promise<boolean> {
    const session = ++this.transportSession;
    await this.ensureStarted();
    if (session !== this.transportSession || document.hidden) return false;
    this.stopSnapshotPlayback();
    this.syncFromStore();
    const transport = Tone.getTransport();
    if (transport.state === 'started') {
      transport.pause(Tone.immediate());
      this.silenceTransport();
      useHoloStore.getState().setIsPlaying(false);
      return false;
    } else {
      this.enableTransportOutput(true);
      this.transportStartSec = Tone.now();
      transport.start(this.transportStartSec);
      useHoloStore.getState().setIsPlaying(true);
      return true;
    }
  }

  async startTransport(): Promise<void> {
    const session = ++this.transportSession;
    await this.ensureStarted();
    if (session !== this.transportSession || document.hidden) return;
    this.stopSnapshotPlayback();
    this.syncFromStore();
    if (Tone.getTransport().state !== 'started') {
      this.enableTransportOutput(true);
      this.transportStartSec = Tone.now();
      Tone.getTransport().start(this.transportStartSec);
      useHoloStore.getState().setIsPlaying(true);
    }
  }

  stopTransport(): void {
    ++this.transportSession;
    if (!this.initialized) return;
    this.transportOutput.gain.setValueAtTime(0, Tone.immediate());
    if (Tone.getTransport().state !== "stopped") this.silenceTransport();
    Tone.getTransport().stop(Tone.immediate());
    this.currentStep = -1;
    this.stepListeners.forEach((fn) => fn(-1));
    useHoloStore.getState().setIsPlaying(false);
  }

  /**
   * Stop ALL active audio streams cleanly (used on workspace switch / page close / unseal)
   */
  private silenceTransport() {
    this.transportOutput.gain.setValueAtTime(0, Tone.immediate());
    this.repeatRacks.forEach(rack => rack.dispose());
    this.repeatRacks = [];
    this.trackRacks.forEach((rack, index) => {
      rack.dispose();
      this.trackRacks[index] = createVoiceRack(this.trackFilters[index]);
    });
    // Disconnect the previous delay line so echoes cannot bleed into the next session.
    this.transportOutput.disconnect();
    this.transportOutput.dispose();
    this.transportOutput = new Tone.Gain(0).connect(this.compressor);
    this.masterBus.disconnect();
    this.bitCrusher.dispose();
    this.streetEcho.dispose();
    this.roomReverb.dispose();
    this.roomReverb = this.createRoom(this.transportOutput);
    this.streetEcho = new Tone.FeedbackDelay({ delayTime: 45 / useHoloStore.getState().bpm,
      feedback: 0.42, wet: useHoloStore.getState().liveFx.echo ? 0.48 : 0 }).connect(this.roomReverb);
    this.bitCrusher = new Tone.BitCrusher(4).connect(this.streetEcho);
    this.bitCrusher.wet.value = useHoloStore.getState().liveFx.bitcrush ? 0.8 : 0;
    this.masterBus.connect(this.bitCrusher);
  }

  stopAllPlayback(): void {
    this.stopTransport();
    this.stopPinballRecording();
    this.stopSnapshotPlayback();
    if (this.initialized) {
      this.sfxSynth.dispose();
      this.sfxPoly.dispose();
      this.sfxNoise.dispose();
      this.sfxNoiseFilter.dispose();
      this.initSfx();
    }
  }

  private silencePreview() {
    ++this.previewSession;
    for (const [rack, timer] of this.overlapRacks) {
      window.clearTimeout(timer);
      rack.dispose();
    }
    this.overlapRacks.clear();
    if (this.initialized) {
      this.previewOutput.gain.setValueAtTime(0, Tone.immediate());
      this.previewRack.dispose();
      this.previewReverb.dispose();
      this.previewReverb = this.createRoom(this.previewOutput);
      this.previewRack = createVoiceRack(this.previewReverb);
      this.lastPreviewAudioTime = 0;
    }
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
    this.stopSnapshotPlayback();
    return this.startAudioBlob(wavBlob, opts, this.playbackSessionId);
  }

  private async startAudioBlob(wavBlob: Blob, opts: SnapshotPlaybackCallbacks & {
    events?: PerformanceEvent[], loopMs?: number }, session: number): Promise<number> {
    await this.ensureStarted();
    if (session !== this.playbackSessionId || document.hidden) return session;
    this.stopTransport();
    this.stopPinballRecording();
    const ctx = Tone.getContext().rawContext as AudioContext;
    const buffer = await ctx.decodeAudioData(await wavBlob.arrayBuffer());
    if (session !== this.playbackSessionId || document.hidden) return session;
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = Boolean(opts.loop);
    if (source.loop) source.loopEnd = (opts.loopMs ?? buffer.duration * 1000) / 1000;
    Tone.connect(source, this.limiter);
    this.activeBufferSource = source;
    this.snapshotActive = true;
    this.snapshotStartAudioSec = ctx.currentTime + (opts.leadInMs ?? 20) / 1000;
    this.snapshotDurationMs = source.loop ? source.loopEnd * 1000 : 0;
    let i = 0;
    let previous = -Infinity;
    const events = opts.events ?? [];
    const tick = () => {
      if (session !== this.playbackSessionId) return;
      const ms = this.getSnapshotPlaybackMs();
      if (ms < previous) i = 0;
      previous = ms;
      while (i < events.length && events[i].timeOffsetMs <= ms) opts.onEvent?.(events[i++]);
      this.snapshotFrame = requestAnimationFrame(tick);
    };
    source.onended = () => {
      if (session !== this.playbackSessionId) return;
      this.stopSnapshotPlayback();
      opts.onComplete?.();
    };
    source.start(this.snapshotStartAudioSec);
    if (opts.onEvent) this.snapshotFrame = requestAnimationFrame(tick);
    return session;
  }

  async playCompositionSnapshot(snapshot: CompositionSnapshot, cbs: SnapshotPlaybackCallbacks = {}) {
    this.stopSnapshotPlayback();
    const session = this.playbackSessionId;
    if (!snapshot.events.length) { cbs.onComplete?.(); return; }
    try {
      const { renderCompositionSnapshotCached } = await import('./wavExporter');
      const artifact = await renderCompositionSnapshotCached(snapshot);
      if (session !== this.playbackSessionId) return;
      await this.startAudioBlob(artifact.wavBlob, { ...cbs, events: snapshot.events, loopMs: snapshot.durationMs }, session);
    } catch (error) {
      if (session === this.playbackSessionId) {
        this.stopSnapshotPlayback();
        cbs.onComplete?.();
        useHoloStore.getState().pushToast({ text: '作品音频播放失败，请重试。' });
        console.warn('Snapshot playback failed',error);
      }
    }
  }

  /** Audition the quantized grid preview right next to the raw pinball recording for honest A/B comparison */
  async playQuantizedPreview(preview: PinballQuantizePreview, scale: ScaleId): Promise<void> {
    const state = useHoloStore.getState();
    preview = refreshQuantizePreview(preview, { ...state, scale });
    const tracks = applyQuantizedTracks(state.tracks, state.collection, preview, 'replace');
    const snap = createBeatCompositionSnapshot({ bars:preview.targetBars,bpm:preview.bpm,swing:state.swing,
      activePhraseLoop:preview.targetBars === 2 ? 'AB' : 'A', scale,liveFx:state.liveFx,tracks });
    await this.playCompositionSnapshot(snap);
  }

  getSnapshotPlaybackMs(): number {
    if (!this.initialized || !this.snapshotActive) return -1;
    const elapsed = (Tone.immediate() - this.snapshotStartAudioSec) * 1000;
    return elapsed >= 0 && this.snapshotDurationMs > 0 ? elapsed % this.snapshotDurationMs : elapsed;
  }

  isSnapshotPlaying(): boolean {
    return this.snapshotActive;
  }

  stopSnapshotPlayback(): void {
    this.playbackSessionId += 1;
    this.snapshotActive = false;
    cancelAnimationFrame(this.snapshotFrame);

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

  }

  async previewCard(cardId: string, opts: TriggerOptions = {}): Promise<void> {
    const session = this.previewSession;
    await this.ensureStarted();
    if (session !== this.previewSession || document.hidden) return;
    this.syncFromStore();
    this.previewOutput.gain.setValueAtTime(1, Tone.immediate());
    const card = getCardById(cardId);
    const scale = opts.scale ?? useHoloStore.getState().scale;
    const now = Tone.now() + 0.01;
    // Rapid physical collisions can overlap the same monophonic multi-strike instrument.
    // Keep the second collision on a separate rack without moving its timestamp.
    const overlapping = now < this.lastPreviewAudioTime;
    const rack = overlapping ? createVoiceRack(this.previewReverb) : this.previewRack;
    if (overlapping) {
      this.overlapRacks.set(rack, window.setTimeout(() => {
        rack.dispose();
        this.overlapRacks.delete(rack);
      }, 1400));
    }
    this.lastPreviewAudioTime = now + 0.06;

    triggerCardOnRack(rack, card.id, {
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
      triggerCardOnRack(rack, card.id, {
        note: notes[1],
        time: now + 0.14,
        scale,
        velocity: 0.74,
      });
      triggerCardOnRack(rack, card.id, {
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
    this.stopPinballRecording();
    const session = this.pinballSession;
    await this.ensureStarted();
    if (session !== this.pinballSession || document.hidden) return;
    const playable = normalizePinballEvents(events);
    if (!playable.length) {
      onComplete?.();
      return;
    }

    const scale = useHoloStore.getState().scale;
    let endMs = 0;
    for (const hit of playable) {
      endMs = Math.max(endMs, hit.timeOffsetMs + hit.durationMs);
      const timer = window.setTimeout(() => {
        if (session !== this.pinballSession) return;
        void this.previewCard(hit.cardId, {
          note: hit.pitch, velocity: hit.velocity, durationSec: hit.durationMs / 1000, scale,
        });
        onEvent?.({ ...hit, note: hit.pitch });
      }, hit.timeOffsetMs);
      this.pinballTimers.push(timer);
    }
    const endTimer = window.setTimeout(() => {
      if (session === this.pinballSession) onComplete?.();
    }, endMs + 1500);
    this.pinballTimers.push(endTimer);
  }

  stopPinballRecording() {
    ++this.pinballSession;
    this.pinballTimers.forEach((t) => window.clearTimeout(t));
    this.pinballTimers = [];
    this.silencePreview();
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
    const session = this.previewSession;
    try {
      await this.ensureStarted();
      if (session !== this.previewSession || document.hidden) return;
      const now = Tone.now();
      this.previewOutput.gain.setValueAtTime(1, Tone.immediate());
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
