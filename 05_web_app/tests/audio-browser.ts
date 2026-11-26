import { buildAudioCacheKey, compositionRenderSeconds, createBeatCompositionSnapshot, extractRealWaveformBars } from '../src/audio/compositionEngine';
import { holoAudio } from '../src/audio/HoloAudioEngine';
import { renderCompositionSnapshotCached } from '../src/audio/wavExporter';
import { recordMotionCardWebm } from '../src/utils/exportMotionCard';
import type { CompositionSnapshot } from '../src/types/holo';
import { useHoloStore } from '../src/store/useHoloStore';
import { holoDb } from '../src/storage/holoDb';

/** Executed by Playwright in an isolated Chromium profile after audio unlock. */
export async function verifyAudioLifecycle() {
  const snapshot = createBeatCompositionSnapshot({
    bars: 1, bpm: 120, swing: 0, liveFx: { echo:false, bitcrush:false, stutter:false }, scale:'PENTA_C',
    tracks:[{ category:'MELODY', cardId:'card-10', mute:false, solo:false, volume:0.8, tone:0.5,
      steps:Array.from({length:16},(_,i)=> i === 0 || i === 1) }],
  });
  const check = (condition: boolean, name: string) => { if (!condition) throw Error(name); };
  const render = (force = false) => renderCompositionSnapshotCached(snapshot, force);
  const result: Record<string, boolean> = {};
  const record = (key: string, pass: boolean) => { check(pass, key); result[key] = true; };
  try {
    record('cold', (await render()).cacheStatus === 'stored');
    record('hit', (await render()).cacheStatus === 'hit');
    snapshot.events[0].velocity *= 0.5;
    record('contentChanged', (await render()).cacheStatus === 'stored');
    for (const field of ['rendererVersion','audioAssetVersion','fxVersion'] as const) {
      const cached = (await holoDb.getAudioCache(buildAudioCacheKey(snapshot)))!;
      await holoDb.saveAudioCache({ ...cached, [field]: 'obsolete' });
      record(field, (await render()).cacheStatus === 'stored');
    }
    const entry = (await holoDb.getAudioCache(buildAudioCacheKey(snapshot)))!;
    const bytes = new Uint8Array(await entry.wavBlob.arrayBuffer());
    bytes[0] ^= 255;
    await holoDb.saveAudioCache({ ...entry, wavBlob: new Blob([bytes]) });
    record('damagedPcm', (await render()).cacheStatus === 'stored');
    record('forceRender', (await render(true)).cacheStatus === 'stored');
    const save = holoDb.saveAudioCache;
    holoDb.saveAudioCache = async () => false;
    try {
      const unavailable = await render(true);
      record('cacheWriteFailure', unavailable.cacheStatus === 'unavailable' && unavailable.wavBlob.size > 44);
    } finally { holoDb.saveAudioCache = save; }

    let obsoleteCalls = 0;
    const pending = holoAudio.playCompositionSnapshot(snapshot, { onEvent: () => obsoleteCalls++ });
    holoAudio.stopSnapshotPlayback();
    await pending;
    record('pendingSessionCancelled', !holoAudio.isSnapshotPlaying() && !obsoleteCalls);
    await holoAudio.playCompositionSnapshot(snapshot, { leadInMs:0 });
    record('retryPlayback', holoAudio.isSnapshotPlaying());
    window.dispatchEvent(new PageTransitionEvent('pagehide'));
    record('pageHideStopsPlayback', !holoAudio.isSnapshotPlaying());
    async function waitForAdvance(position: number) {
      const deadline = performance.now() + 3000;
      while (holoAudio.getTransportStepFloat() <= position && performance.now() < deadline) {
        await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
      }
    }
    await holoAudio.startTransport();
    await waitForAdvance(0.2);
    const first = holoAudio.getTransportStepFloat();
    await holoAudio.togglePlay();
    const paused = holoAudio.getTransportStepFloat();
    await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
    record('pauseFreezesTransport', first >= 0 && Math.abs(holoAudio.getTransportStepFloat() - paused) < 1);
    await holoAudio.togglePlay();
    await waitForAdvance(paused);
    record('resumeContinues', holoAudio.getTransportStepFloat() > paused);
    holoAudio.stopTransport();
    holoAudio.stopSnapshotPlayback();
    holoAudio.stopSnapshotPlayback();
    record('repeatStop', !holoAudio.isSnapshotPlaying());
    record('phraseWavMatrix', (await verifyPhrases()).length === 4);
    Object.assign(result, await verifySilence());
    Object.assign(result, await verifyRecorderCleanup(snapshot));
    return result;
  } finally {
    holoAudio.stopSnapshotPlayback();
    await holoDb.deleteAudioCacheIfUnused(buildAudioCacheKey(snapshot), [], null);
  }
}

async function verifyRecorderCleanup(snapshot: CompositionSnapshot) {
  const contexts: AudioContext[] = [];
  const tracks: MediaStreamTrack[] = [];
  const recorders: MediaRecorder[] = [];
  const actual = {
    supports: MediaRecorder.isTypeSupported,
    start: MediaRecorder.prototype.start,
    capture: HTMLCanvasElement.prototype.captureStream,
    destination: AudioContext.prototype.createMediaStreamDestination,
  };
  let fault = '';
  let frames = 0;
  const results: Record<string, boolean> = {};
  try {
    MediaRecorder.isTypeSupported = function(type) {
      return fault !== 'unsupportedMime' && actual.supports.call(MediaRecorder, type);
    };
    AudioContext.prototype.createMediaStreamDestination = function() {
      contexts.push(this);
      const destination = actual.destination.call(this);
      const audio = destination.stream.getAudioTracks();
      tracks.push(...audio);
      if (fault === 'noAudioTrack') {
        // Simulate a browser returning a capture stream without an audio track.
        audio.forEach(track => { destination.stream.removeTrack(track); track.stop(); });
      }
      return destination;
    };
    HTMLCanvasElement.prototype.captureStream = function(rate) {
      if (fault === 'captureFailure') throw Error('injected capture failure');
      const stream = actual.capture.call(this, rate);
      tracks.push(...stream.getTracks());
      return stream;
    };
    MediaRecorder.prototype.start = function(timeslice) {
      recorders.push(this);
      actual.start.call(this, timeslice);
      if (fault === 'encoderFailure') queueMicrotask(() => this.dispatchEvent(new Event('error')));
    };
    const run = (signal?: AbortSignal) => recordMotionCardWebm({
      snapshot, title:'Audio verification', code:'#TEST', rarity:'UR', foil:'prism', artId:'neon-dj',
      stickers:[], waveformBars:[], signal, onProgress() {
        frames++;
        if (fault === 'drawFailure' && frames === 3) throw Error('injected draw failure');
        if (fault === 'pageHideDuringCapture' && frames === 3) window.dispatchEvent(new PageTransitionEvent('pagehide'));
      },
    });
    const read = holoDb.getAudioCache;
    const originalCount = recorders.length;
    let started!: () => void;
    let release!: () => void;
    const began = new Promise<void>(resolve => { started = resolve; });
    const pending = new Promise<void>(resolve => { release = resolve; });
    holoDb.getAudioCache = async (...args) => { started(); await pending; return read(...args); };
    try {
      const exportJob = run();
      await began;
      window.dispatchEvent(new PageTransitionEvent('pagehide'));
      let cancelled = false;
      try { await exportJob; } catch (error) { cancelled = error instanceof Error && error.message.includes('已取消'); }
      if (!cancelled || recorders.length !== originalCount) throw Error('Capture survived pagehide during preparation');
      results.cancelDuringPreparation = true;
    } finally {
      release();
      holoDb.getAudioCache = read;
    }
    for (const [name, message] of [
      ['unsupportedMime','WebM'], ['captureFailure','injected capture failure'], ['noAudioTrack','有效'],
      ['encoderFailure','编码器'], ['drawFailure','injected draw failure'], ['pageHideDuringCapture','已取消'],
      ['completeRetry',''],
    ]) {
      fault = name;
      frames = 0;
      let failed = false;
      try {
        const { blob } = await run();
        if (message || !blob.size || !blob.type.includes('video/webm')) throw Error('invalid output');
      } catch (error) {
        if (!message || !(error instanceof Error) || !error.message.includes(message)) throw error;
        failed = true;
      }
      if (Boolean(message) !== failed) throw Error('missing failure: ' + name);
      const finalFrames = frames;
      await new Promise<void>(ok => requestAnimationFrame(() => requestAnimationFrame(() => ok())));
      if (frames !== finalFrames || contexts.some(ctx => ctx.state !== 'closed') ||
          tracks.some(track => track.readyState !== 'ended') ||
          recorders.some(rec => rec.state !== 'inactive' || rec.onerror || rec.onstop || rec.ondataavailable)) {
        throw Error('orphaned capture resource: ' + name);
      }
      results[name] = true;
    }
    return results;
  } finally {
    MediaRecorder.isTypeSupported = actual.supports;
    MediaRecorder.prototype.start = actual.start;
    HTMLCanvasElement.prototype.captureStream = actual.capture;
    AudioContext.prototype.createMediaStreamDestination = actual.destination;
  }
}

export async function verifySilence() {
  const { tracks, liveFx, muted } = useHoloStore.getState();
  const renderFrame = () => new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
  const peak = () => Math.max(...Array.from(holoAudio.getWaveformData(), Math.abs));
  async function waitForSignal() {
    const deadline = performance.now() + 3000;
    while (peak() < 0.001 && performance.now() < deadline) await renderFrame();
    if (peak() < 0.001) throw Error('No audio detected before stop');
  }
  // Allow the output device its already submitted render quanta, then sample
  // the actual master-bus analyser for delayed or queued notes across 350 ms.
  async function checkSilence(stage: string) {
    let until = performance.now() + 75;
    while (performance.now() < until) await renderFrame();
    until = performance.now() + 350;
    let maximum = 0;
    while (performance.now() < until) {
      maximum = Math.max(maximum, peak());
      await renderFrame();
    }
    if (maximum > 0.00001) throw Error('Unexpected audio during ' + stage + ': ' + maximum);
    return true;
  }
  try {
    const sounding = tracks.map(track => ({...track, solo:false, mute:false, volume:1,
      steps:Array<boolean>(16).fill(true)}));
    useHoloStore.setState({tracks:sounding, muted:false, liveFx:{ ...liveFx, echo:true }});
    await holoAudio.startTransport();
    await waitForSignal();
    holoAudio.stopTransport();
    const stopTail = await checkSilence('stopTail');

    useHoloStore.setState({tracks:sounding.map(t => ({...t, volume:0}))});
    await holoAudio.startTransport();
    const zeroVolume = await checkSilence('zeroVolume');
    holoAudio.stopTransport();

    await Promise.all([holoAudio.previewCard('card-10'), holoAudio.previewCard('card-11')]);
    await waitForSignal();
    holoAudio.stopPinballRecording();
    const stopOverlappingPreview = await checkSilence('stopOverlappingPreview');
    return { stopTail, zeroVolume, stopOverlappingPreview };
  } finally {
    holoAudio.stopAllPlayback();
    useHoloStore.setState({tracks,liveFx,muted});
    holoAudio.syncFromStore();
  }
}

/** Decode native exported PCM, including distinct 32-cell phrase A and B patterns. */
export async function verifyPhrases() {
  const cases = [
    { bars:1, phrase:'A', bpm:120, swing:0, fx:false, steps:[3,15] },
    { bars:2, phrase:'B', bpm:90, swing:0.4, fx:false, steps:[16,29,31] },
    { bars:2, phrase:'AB', bpm:60, swing:0.6, fx:true, steps:[3,3,15,15,16,16,29,29,31,31] },
    { bars:2, phrase:'A', bpm:180, swing:0.1, fx:false, steps:[3,15] },
  ] as const;
  const rows = [];
  for (const item of cases) {
    const { bars, phrase, bpm, swing, fx, steps } = item;
    const snap = createBeatCompositionSnapshot({ bars, activePhraseLoop:phrase, bpm, swing,
      scale:'PENTA_C', liveFx:{bitcrush:fx,echo:fx,stutter:fx},
      tracks:[{cardId:'card-10',category:'MELODY',volume:0.9,tone:0.5,mute:false,solo:false,
        steps:Array.from({length:32},(_,i) => [3,15,16,29,31].includes(i))}] });
    if (JSON.stringify(snap.events.map(ev => ev.stepIndex)) !== JSON.stringify(steps)) throw Error('A/B steps');
    const wav = await renderCompositionSnapshotCached(snap,true);
    const bytes = await wav.wavBlob.arrayBuffer();
    const v = new DataView(bytes);
    const ascii = (at: number) => String.fromCharCode(...new Uint8Array(bytes,at,4));
    const dataSize = v.getUint32(40,true);
    if (ascii(0)!=='RIFF' || ascii(8)!=='WAVE' || ascii(36)!=='data' || v.getUint32(4,true)!==bytes.byteLength-8 ||
        v.getUint32(24,true)!==48000 || v.getUint16(22,true)!==2 || v.getUint16(34,true)!==16 ||
        dataSize !== bytes.byteLength-44) throw Error('invalid PCM header');
    const pcm = new Int16Array(bytes,44);
    const peakIn = (from: number, end: number) => {
      let peak = 0;
      for (let i = Math.max(0,from); i < Math.min(end,pcm.length); i++) peak = Math.max(peak,Math.abs(pcm[i]));
      return peak;
    };
    const peak = peakIn(0,pcm.length);
    const final10msPeak = peakIn(pcm.length-960,pcm.length);
    const durationSec = dataSize / (48000*4);
    const lastOn = snap.events[snap.events.length-1].timeOffsetMs / 1000;
    const decoded = await new OfflineAudioContext(2,1,48000).decodeAudioData(bytes.slice(0));
    const waveform = extractRealWaveformBars(decoded);
    if (Math.max(...waveform.map((x,i)=>Math.abs(x-wav.waveformBars[i]))) > 0.005 ||
        Math.abs(durationSec-compositionRenderSeconds(snap)) > 0.001 ||
        snap.durationMs!==Math.round(240000 / bpm * (phrase==='AB'?2:1)) ||
        final10msPeak > 40 || peak < 100 || peakIn(Math.floor(lastOn*96000), Math.floor((lastOn+.15)*96000)) < 20) {
      throw Error('PCM duration, waveform or tail mismatch: '+phrase);
    }
    rows.push({phrase,bars,bpm,swing,fx,steps,durationSec,dataSize,peak,final10msPeak,
      sampleRate:decoded.sampleRate, channelCount:decoded.numberOfChannels, bitDepth:16});
    await holoDb.deleteAudioCacheIfUnused(wav.cacheKey,[],null);
  }
  return rows;
}
