/** Use every frame so waveform peaks survive sample-rate conversion and bin boundaries. */
function waveformFromFrames(frames: number, barCount: number, levelAt: (frame: number) => number): number[] {
  const levels: number[] = [];
  let loudest = 0.001;
  for (let bar = 0; bar < barCount; bar++) {
    const start = Math.floor(bar * frames / barCount);
    const end = Math.floor((bar + 1) * frames / barCount);
    let sumSquares = 0;
    let peak = 0;
    for (let frame = start; frame < end; frame++) {
      const sample = levelAt(frame);
      sumSquares += sample * sample;
      peak = Math.max(peak, sample);
    }
    const rms = Math.sqrt(sumSquares / Math.max(1, end - start));
    const level = rms * 0.55 + peak * 0.45;
    loudest = Math.max(loudest, level);
    levels.push(level);
  }
  return levels.map(level => Number((level / loudest).toFixed(3)));
}

export function extractRealWaveformBars(buffer: AudioBuffer, barCount = 28): number[] {
  const left = buffer.getChannelData(0);
  const right = buffer.numberOfChannels > 1 ? buffer.getChannelData(1) : left;
  return waveformFromFrames(left.length, barCount, frame =>
    (Math.abs(left[frame]) + Math.abs(right[frame])) * 0.5);
}

export function audioBufferToWavBlob(buffer: AudioBuffer, barCount = 28) {
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
  let peakAbs = 0;
  for (let i = 0; i < numFrames; i++) {
    for (let c = 0; c < numChannels; c++) {
      const sample = Math.max(-1, Math.min(1, channels[c][i]));
      const pcm = Math.trunc(sample < 0 ? sample * 32768 : sample * 32767);
      peakAbs = Math.max(peakAbs, Math.abs(pcm));
      view.setInt16(offset, pcm, true);
      offset += 2;
    }
  }

  return {
    blob: new Blob([arrayBuffer], { type: 'audio/wav' }),
    peakAmplitude: peakAbs,
    waveformBars: waveformFromFrames(numFrames, barCount, (frame) => {
      const left = 44 + frame * blockAlign;
      const right = numChannels > 1 ? left + 2 : left;
      return (Math.abs(view.getInt16(left, true)) + Math.abs(view.getInt16(right, true))) / 65536;
    }),
  };
}
