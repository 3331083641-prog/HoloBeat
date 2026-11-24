import * as Tone from 'tone';
import { createVoiceRack, triggerCardOnRack } from './HoloAudioEngine';
import type { BeatSnapshot, PinballRecordedEvent, ScaleId } from '../types/holo';

function audioBufferToWavBlob(buffer: AudioBuffer): Blob {
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
  view.setUint32(16, 16, true); // PCM chunk length
  view.setUint16(20, 1, true); // PCM format
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true); // bits per sample
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

export async function renderBeatMixToWav(snapshot: BeatSnapshot, bars = 2): Promise<Blob> {
  const stepSec = 60 / snapshot.bpm / 4; // 16th note duration
  const totalSteps = 16 * bars;
  const durationSec = totalSteps * stepSec + 0.85;

  const toneBuffer = await Tone.Offline(({ destination }) => {
    const limiter = new Tone.Limiter(-1).connect(destination);
    const reverb = new Tone.Freeverb({ roomSize: 0.28, dampening: 4200, wet: 0.12 }).connect(limiter);
    const anySolo = snapshot.tracks.some((t) => t.solo);

    snapshot.tracks.forEach((track) => {
      const isMuted = track.mute || (anySolo && !track.solo);
      if (isMuted) return;

      const ch = new Tone.Channel(
        track.volume <= 0.01 ? -60 : Tone.gainToDb(track.volume),
        0
      ).connect(reverb);
      const filt = new Tone.Filter(650 * Math.pow(21.5, track.tone), 'lowpass').connect(ch);
      const rack = createVoiceRack(filt);

      for (let i = 0; i < totalSteps; i++) {
        const step = i % 16;
        if (!track.steps[step]) continue;
        const swingOffset = step % 2 === 1 ? snapshot.swing * stepSec * 0.5 : 0;
        const time = 0.04 + i * stepSec + swingOffset;
        const grooveVel = step % 4 === 0 ? 0.92 : step % 2 === 0 ? 0.8 : 0.72;
        triggerCardOnRack(rack, track.cardId, {
          time,
          velocity: grooveVel,
          tone: track.tone,
          stepIndex: step,
          scale: snapshot.scale,
        });
      }
    });
  }, durationSec);

  return audioBufferToWavBlob(toneBuffer.get() as AudioBuffer);
}

export async function renderPinballToWav(
  events: PinballRecordedEvent[],
  scale: ScaleId
): Promise<Blob> {
  const maxMs = events.reduce((m, e) => Math.max(m, e.timeOffsetMs), 1800);
  const durationSec = Math.min(12, Math.max(2.5, maxMs / 1000 + 1.1));

  const toneBuffer = await Tone.Offline(({ destination }) => {
    const limiter = new Tone.Limiter(-1).connect(destination);
    const reverb = new Tone.Freeverb({ roomSize: 0.3, dampening: 4400, wet: 0.14 }).connect(limiter);
    const rack = createVoiceRack(reverb);

    events.forEach((ev) => {
      const time = 0.05 + ev.timeOffsetMs / 1000;
      if (time < durationSec - 0.15) {
        triggerCardOnRack(rack, ev.cardId, {
          time,
          note: ev.note,
          velocity: ev.velocity,
          scale,
        });
      }
    });
  }, durationSec);

  return audioBufferToWavBlob(toneBuffer.get() as AudioBuffer);
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
