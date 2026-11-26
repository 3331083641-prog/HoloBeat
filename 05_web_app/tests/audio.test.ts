import test from 'node:test';
import { useHoloStore } from '../src/store/useHoloStore.ts';
import { audioBufferToWavBlob } from '../src/audio/pcm.ts';
import { evaluateSequencerTrackOrb } from '../src/motion/holoMotion.ts';
import assert from 'node:assert/strict';
import { buildAudioCacheKey, compositionRenderSeconds, createBeatCompositionSnapshot,
  createPinballCompositionSnapshot, extractRealWaveformBars, quantizePinballToBeatPreview,
  resolveNoteForStep, RENDERER_VERSION } from '../src/audio/compositionEngine.ts';
import type { BeatSnapshot, PinballRecordedEvent } from '../src/types/holo.ts';

function beat(): BeatSnapshot {
  return { bars:2, activePhraseLoop:'AB', bpm:80, swing:0.4, scale:'PENTA_C',
    liveFx:{bitcrush:false, echo:true, stutter:false}, tracks:[{
      category:'VIBE', cardId:'card-15', tone:0.5, volume:0.7, mute:false, solo:false,
      steps:Array.from({length:32},(_,s)=> s===3 || s===31),
      stepCells:Array.from({length:32},(_,s)=>({on:s===3 || s===31,velocity:1,lengthSteps:4,pitchOffset:0})),
    }] };
}
test('A, B and AB select independent musical events; long final voice and feedback decay completely', () => {
  for (const phrase of ['A','B','AB'] as const) {
    const snap = createBeatCompositionSnapshot({...beat(),activePhraseLoop:phrase});
    const steps = phrase === 'A' ? [3] : phrase === 'B' ? [31] : [3,31];
    assert.deepEqual(snap.events.map(e=>e.stepIndex),steps);
    assert.equal(snap.durationMs, phrase === 'AB' ? 6000 : 3000);
    const last = snap.events.at(-1)!;
    assert.ok(compositionRenderSeconds(snap)*1000 >= last.timeOffsetMs + last.durationMs + 1500 + 450000/80);
    assert.ok(Math.abs((compositionRenderSeconds(snap)*1000) - (snap.durationMs+snap.tailMs!))<1);
  }
});
test('missing bars use one pass; imported renderer version never selects the active cache version', () => {
  const snap = createBeatCompositionSnapshot({...beat(),bars:NaN as 1});
  assert.equal(snap.bars,1);
  assert.deepEqual(snap.events.map(e=>e.stepIndex),[3]);
  assert.equal(buildAudioCacheKey({...snap,rendererVersion:'obsolete'}), RENDERER_VERSION+'::'+snap.id);
});
test('long pinball timing survives past 20 seconds and quantization preserves invalid raw values', () => {
  const base:PinballRecordedEvent = {cardId:'card-10',timeOffsetMs:0,velocity:0.91,color:'#abcdef',note:'C4'};
  const events = [base,{...base,timeOffsetMs:22000,durationMs:1100}];
  const snap = createPinballCompositionSnapshot(events,{ toys:[],scale:'PENTA_C',bounce:1,gravity:1,
    dropRate:1,dropperX:400 },120);
  assert.ok(compositionRenderSeconds(snap)>23);
  const raw = [...events,{...base,timeOffsetMs:NaN},{...base,velocity:Infinity,note:'?'},{...base}];
  const preview = quantizePinballToBeatPreview(raw,NaN,{targetBars:2,startMs:NaN,endMs:Infinity});
  assert.equal(preview.totalSourceEvents,5);
  assert.equal(preview.invalidEvents,1);
  assert.equal(preview.selectedSourceEvents,4);
  assert.equal(preview.mergedCollisions+preview.mappedCount,4);
  assert.deepEqual(preview.sourceEvents,raw);
});
test('waveform bins retain true silence', () => {
  const ch = new Float32Array(1024);
  const buffer = {numberOfChannels:1,getChannelData:()=>ch} as unknown as AudioBuffer;
  assert.deepEqual(extractRealWaveformBars(buffer,4),[0,0,0,0]);
  ch.fill(0.7,256,512);
  assert.deepEqual(extractRealWaveformBars(buffer,4),[0,1,0,0]);
});

test('swung A/B orb touches the same active pad on repeated loops and after tempo changes', () => {
  const steps = Array.from({length:32}, (_,i)=>i===17 || i===23);
  for (const bpm of [60,120,180]) {
    const pose = (stepFloat:number) => evaluateSequencerTrackOrb({ steps, category:'VIBE', stepFloat,
      swing:0.5,bpm,phraseOffset:16,baseArcHeight:45,getPadCenter:i=>({x:i*30,y:100}) });
    assert.equal(pose(17)!.x,30);
    assert.equal(pose(17)!.y,100);
    assert.deepEqual(pose(33),pose(17));
    assert.ok(pose(20)!.y<100);
  }
});

test('PCM16 clipping, quantization, stereo and the last frame agree exactly with the exported waveform and peak', async () => {
  const left = new Float32Array(1027);
  const right = new Float32Array(left.length);
  left.fill(1.9, 0, 160);
  right.fill(-2.4, 200, 500);
  right.fill(0.000001, 555, 700);
  left[1026] = -1.3;
  const source = { length: left.length, numberOfChannels: 2, sampleRate: 48000,
    getChannelData: (ch: number) => ch === 0 ? left : right } as AudioBuffer;
  const { blob, peakAmplitude, waveformBars } = audioBufferToWavBlob(source);
  const bytes = new DataView(await blob.arrayBuffer());
  const channels = [new Float32Array(left.length), new Float32Array(left.length)];
  let measuredPeak = 0;
  for (let i = 0; i < left.length; i++) {
    for (const ch of [0, 1]) {
      const pcm = bytes.getInt16(44 + i * 4 + ch * 2, true);
      measuredPeak = Math.max(Math.abs(pcm), measuredPeak);
      channels[ch][i] = pcm / 32768;
    }
  }
  assert.equal(bytes.getInt16(44, true), 32767);
  assert.equal(bytes.getInt16(44 + 4 * 200 + 2, true), -32768);
  assert.equal(measuredPeak, 32768);
  assert.equal(measuredPeak, peakAmplitude);
  assert.equal(channels[1][600], 0);
  assert.deepEqual(waveformBars, extractRealWaveformBars({ ...source, getChannelData: ch => channels[ch] }));
  assert.ok(waveformBars.at(-1)! > 0, 'last frame contributes to the last bar');
  assert.notDeepEqual(waveformBars, extractRealWaveformBars(source));
});

test('real quantize actions preserve expressive cells on merge/replace, count losses, and keep the raw recording', () => {
  const initial = useHoloStore.getInitialState();
  const tracks = initial.tracks.map(track => ({
    ...track, volume: 0.8, tone: 0.5, solo: false, mute: false,
    steps: Array.from({ length: 32 }, (_, step) => step === 12),
    accents: Array.from({ length: 32 }, (_, step) => step === 0),
  }));
  const raw: PinballRecordedEvent[] = [{
    id: 'winner', cardId: 'card-10', note: resolveNoteForStep('PENTA_C', 0, 0.5, 2),
    velocity: 0.77, color: '#abcabc', durationMs: 675, timeOffsetMs: 0,
  }];
  raw.push({ ...raw[0], id: 'merged', note: 'C0', velocity: 0.4, durationMs: 170 });
  raw.push({ ...raw[0], id: 'later', timeOffsetMs: 183, velocity: 0.1, durationMs: 169,
    note: resolveNoteForStep('PENTA_C', 1, 0.5) });
  raw.push({ ...raw[0], id: 'bad-time', timeOffsetMs: NaN });
  const original = structuredClone(raw);
  for (const mode of ['merge', 'replace'] as const) {
    useHoloStore.setState({ ...initial, tracks, collection: ['card-10'], beatBars: 2,
      swing: 0.4, scale: 'PENTA_C', bpm: 120,
      liveFx: { echo: false, stutter: false, bitcrush: false } }, true);
    const actions = useHoloStore.getState();
    assert.equal(actions.sendPinballToBeatQuantize(raw), true);
    const preview = useHoloStore.getState().pinballQuantizePreview!;
    assert.equal(preview.grid, '1/16');
    assert.equal(preview.mappedCount, 2);
    assert.equal(preview.mergedCollisions, 1);
    assert.equal(preview.movedCount, 1);
    assert.equal(preview.velocityChangedCount, 2);
    assert.equal(preview.pitchMappedCount, 1);
    assert.equal(preview.lengthChangedCount, 1);
    assert.equal(preview.invalidEvents, 1);
    actions.applyPinballQuantize(mode);
    const applied = useHoloStore.getState();
    assert.deepEqual(applied.pinballRecordedEvents, original);
    assert.equal(applied.tracks[2].steps[12], mode === 'merge');
    assert.equal(applied.tracks[2].accents![0], false);
    const snapshot = createBeatCompositionSnapshot({ ...applied, bars: applied.beatBars,
      activePhraseLoop: applied.beatPhraseLoop });
    const hits = snapshot.events.filter(e => e.cardId === 'card-10');
    assert.equal(hits[0].pitch, raw[0].note);
    assert.equal(hits[0].velocity, 0.77);
    assert.equal(hits[0].durationMs, 675);
    assert.equal(hits[1].timeOffsetMs, 150);
    assert.equal(hits[1].velocity, 0.35);
    assert.match(applied.toasts.at(-1)!.text, /移动 1.*力度调整 2.*音高映射 1/);
  }
  useHoloStore.setState(initial, true);
});
