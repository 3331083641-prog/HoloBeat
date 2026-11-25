import * as Tone from 'tone';
import { createVoiceRack, triggerCardOnRack } from './HoloAudioEngine';
import { extractRealWaveformBars } from './compositionEngine';
import { holoDb } from '../storage/holoDb';
import type { BeatSnapshot, CompositionSnapshot, PinballRecordedEvent, ScaleId } from '../types/holo';

export interface RenderedAudioResult {
  wavBlob: Blob;
  waveformBars: number[];
  durationSec: number;
}

export function audioBufferToWavBlob(buffer: AudioBuffer): Blob {
  const numChannels = Math.min(2, buffer.numberOfChannels);
  const sampleRate = buffer.sampleRate;
  const numFrames = buffer.length;
  const bytesPerSample = 2; // 16-bit PCM
  const blockAlign = numChannels * bytesPerSample;
  const dataSize = numFrames * blockAlign;
  const arrayBuffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(arrayBuffer);

  const writeStr = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true);
  writeStr(36, 'data');
  view.setUint32(40, dataSize, true);

  const channels: Float32Array[] = [];
  for (let c = 0; c < numChannels; c++) {
    channels.push(buffer.getChannelData(c));
  }

  let offset = 44;
  for (let i = 0; i < numFrames; i++) {
    for (let c = 0; c < numChannels; c++) {
      const sample = Math.max(-1, Math.min(1, channels[c][i]));
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
      offset += 2;
    }
  }

  return new Blob([arrayBuffer], { type: 'audio/wav' });
}

/**
 * Render a frozen BeatSnapshot with 100% parity to live HoloAudioEngine:
 * identical VoiceRack, Swing, Accents, Mute/Solo, BitCrusher, Street Echo, Stutter, Freeverb, Compressor & Limiter!
 */
export async function renderBeatMixToAudioResult(
  snapshot: BeatSnapshot,
  barsOverride?: number
): Promise<RenderedAudioResult> {
  const bars = Math.max(1, barsOverride ?? snapshot.bars ?? 2);
  const stepSec = 60 / snapshot.bpm / 4;
  const totalSteps = 16 * bars;
  const tailSec = snapshot.liveFx.echo ? 1.45 : 0.9;
  const durationSec = totalSteps * stepSec + tailSec;

  const toneBuffer = await Tone.Offline(({ destination }) => {
    const limiter = new Tone.Limiter(-1).connect(destination);
    const compressor = new Tone.Compressor({
      threshold: -15,
      ratio: 3.2,
      attack: 0.008,
      release: 0.14,
    }).connect(limiter);
    const reverb = new Tone.Freeverb({
      roomSize: 0.28,
      dampening: 4200,
      wet: 0.12,
    }).connect(compressor);

    const echo = new Tone.FeedbackDelay({
      delayTime: stepSec * 3, // exact dotted 8th at snapshot BPM
      feedback: 0.42,
      wet: snapshot.liveFx.echo ? 0.48 : 0,
    }).connect(reverb);

    const bitCrusher = new Tone.BitCrusher(4).connect(echo);
    bitCrusher.wet.value = snapshot.liveFx.bitcrush ? 0.8 : 0;

    const masterBus = new Tone.Gain(0.96).connect(bitCrusher);
    const anySolo = snapshot.tracks.some((t) => t.solo);

    snapshot.tracks.forEach((track) => {
      const isMuted = track.mute || (anySolo && !track.solo);
      if (isMuted) return;

      const ch = new Tone.Channel(
        track.volume <= 0.01 ? -60 : Tone.gainToDb(track.volume),
        0
      ).connect(masterBus);
      const filt = new Tone.Filter(650 * Math.pow(21.5, track.tone), 'lowpass').connect(ch);
      const rack = createVoiceRack(filt);

      for (let i = 0; i < totalSteps; i++) {
        const step = i % 16;
        if (!track.steps[step]) continue;
        const swingOffset = step % 2 === 1 ? snapshot.swing * stepSec * 0.5 : 0;
        const time = 0.04 + i * stepSec + swingOffset;
        const isAccented = Boolean(track.accents?.[step]);
        const baseVel = step % 4 === 0 ? 0.92 : step % 2 === 0 ? 0.8 : 0.72;
        const vel = Math.min(1, isAccented ? Math.max(0.95, baseVel + 0.14) : baseVel);

        triggerCardOnRack(rack, track.cardId, {
          time,
          velocity: vel,
          tone: track.tone,
          stepIndex: step,
          scale: snapshot.scale,
        });

        if (snapshot.liveFx.stutter) {
          triggerCardOnRack(rack, track.cardId, {
            time: time + stepSec * 0.5,
            velocity: Math.max(0.35, vel * 0.68),
            tone: Math.min(1, track.tone + 0.14),
            stepIndex: step,
            scale: snapshot.scale,
          });
        }
      }
    });
  }, durationSec);

  const audioBuffer = toneBuffer.get() as AudioBuffer;
  return {
    wavBlob: audioBufferToWavBlob(audioBuffer),
    waveformBars: extractRealWaveformBars(audioBuffer, 28),
    durationSec,
  };
}

export async function renderPinballToAudioResult(
  events: PinballRecordedEvent[],
  scale: ScaleId
): Promise<RenderedAudioResult> {
  const maxMs = events.reduce((m, e) => Math.max(m, e.timeOffsetMs), 1200);
  const durationSec = Math.min(12, Math.max(2.0, maxMs / 1000 + 1.1));

  const toneBuffer = await Tone.Offline(({ destination }) => {
    const limiter = new Tone.Limiter(-1).connect(destination);
    const compressor = new Tone.Compressor({
      threshold: -15,
      ratio: 3.2,
      attack: 0.008,
      release: 0.14,
    }).connect(limiter);
    const reverb = new Tone.Freeverb({
      roomSize: 0.3,
      dampening: 4400,
      wet: 0.14,
    }).connect(compressor);
    const rack = createVoiceRack(reverb);

    events.forEach((ev) => {
      const time = 0.05 + ev.timeOffsetMs / 1000;
      if (time < durationSec - 0.12) {
        triggerCardOnRack(rack, ev.cardId, {
          time,
          note: ev.note,
          velocity: ev.velocity,
          scale,
        });
      }
    });
  }, durationSec);

  const audioBuffer = toneBuffer.get() as AudioBuffer;
  return {
    wavBlob: audioBufferToWavBlob(audioBuffer),
    waveformBars: extractRealWaveformBars(audioBuffer, 28),
    durationSec,
  };
}

/**
 * Canonical Snapshot Renderer with IndexedDB Audio Cache!
 * Ensures Forge audition, real PCM waveform fingerprint, and WAV export all use the EXACT
 * same frozen audio artifact for any minted/captured CompositionSnapshot.
 */
export async function renderCompositionSnapshotCached(
  snapshot: CompositionSnapshot,
  forceRerender = false
): Promise<RenderedAudioResult> {
  if (!forceRerender) {
    const cached = await holoDb.getAudioCache(snapshot.id);
    if (cached && cached.wavBlob.size > 44) {
      return {
        wavBlob: cached.wavBlob,
        waveformBars: cached.waveformBars,
        durationSec: cached.durationSec,
      };
    }
  }

  let result: RenderedAudioResult;
  if (snapshot.sourceType === 'beat' && snapshot.beatSnapshot) {
    result = await renderBeatMixToAudioResult(
      snapshot.beatSnapshot,
      Math.max(2, snapshot.beatSnapshot.bars || 2)
    );
  } else {
    const evs = snapshot.pinballEvents ?? [];
    result = await renderPinballToAudioResult(evs, snapshot.scale);
  }

  await holoDb.saveAudioCache({
    snapshotId: snapshot.id,
    wavBlob: result.wavBlob,
    waveformBars: result.waveformBars,
    durationSec: result.durationSec,
    cachedAt: Date.now(),
  });

  return result;
}

export async function renderBeatMixToWav(snapshot: BeatSnapshot, bars = 2): Promise<Blob> {
  const res = await renderBeatMixToAudioResult(snapshot, bars);
  return res.wavBlob;
}

export async function renderPinballToWav(
  events: PinballRecordedEvent[],
  scale: ScaleId
): Promise<Blob> {
  const res = await renderPinballToAudioResult(events, scale);
  return res.wavBlob;
}

export function triggerBlobDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.setTimeout(() => URL.revokeObjectURL(url), 4000);
}
