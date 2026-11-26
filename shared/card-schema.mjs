// The browser importer and archive API validate the same versioned work format.
export function createSchemas(z) {
  const range = (lo, hi) => z.number().finite().min(lo).max(hi);
  const int = (lo, hi) => range(lo, hi).int();
  const id = z.string().min(1).max(128).regex(/^[a-zA-Z0-9_.:-]+$/);
  const stamp = int(1, Number.MAX_SAFE_INTEGER);
  const title = z.string().min(1).max(64).refine(v => v.trim().length > 0);
  const code = z.string().min(1).max(32);
  const source = z.enum(['beat', 'pinball']);
  const scale = z.enum(['PENTA_C', 'MINOR_C', 'DORIAN_C']);
  const category = z.enum(['BEAT', 'PERC', 'MELODY', 'VIBE']);
  const cardId = z.string().regex(/^card-(0[1-9]|1[0-6])$/);
  const note = z.string().max(4).regex(/^[A-G](?:b|#)?[0-8]$/);
  const color = z.string().regex(/^#[0-9a-fA-F]{6}$/);
  const unit = range(0, 1);
  const bpm = range(40, 240);
  const versions = { schemaVersion: int(1, 3).optional(), assetVersion: z.string().min(1).max(64).optional(), rendererVersion: z.string().min(1).max(64).optional() };
  const time = range(0, 120000);
  const duration = range(1, 120000);
  const obj = shape => z.object(shape).strict();
  const grid = cells => z.union([z.array(cells).length(16), z.array(cells).length(32)]);
  const steps = grid(z.boolean());
  const stepCell = obj({ on: z.boolean(), velocity: unit, pitchOffset: int(-4,4),
    lengthSteps: z.union([z.literal(1),z.literal(2),z.literal(4)]) });
  const track = obj({ category, cardId, steps, stepCells: grid(stepCell).optional(), accents: steps.optional(), volume: unit,
    tone: unit, mute: z.boolean(), solo: z.boolean() });
  const beat = obj({ bpm, swing: unit, scale, bars: int(1, 2),
    activePhraseLoop: z.enum(['A','B','AB']).optional(), tracks: z.array(track).length(4),
    liveFx: obj({ bitcrush: z.boolean(), echo: z.boolean(), stutter: z.boolean() }) });
  const positions = { sourceX: range(-1000, 2000).optional(), sourceY: range(-1000, 2000).optional() };
  const recorded = obj({ id: id.optional(), timeOffsetMs: time, durationMs: duration.optional(),
    cardId, note, velocity: unit, color, ...positions });
  const event = obj({ id, timeOffsetMs: time, durationMs: duration, pitch: note,
    velocity: unit, cardId, trackCategory: category, trackIndex: int(0, 3),
    stepIndex: int(0, 31).optional(), tone: unit.optional(), ...positions, color });
  const toy = obj({ id, type: z.enum(['block', 'bumper', 'spinner', 'portal']),
    x: range(0, 800), y: range(0, 680), angle: range(-3600, 3600), cardId, note });
  const scene = obj({ toys: z.array(toy).max(256), dropperX: range(0, 800),
    gravity: range(0, 3), dropRate: range(0, 2), bounce: range(0, 2), scale });
  const SnapshotSchema = obj({ ...versions, id, title: z.string().max(64).optional(), contentSignature: z.string().max(256).optional(),
    soundSeed: int(0, 0xffffffff).optional(), tailMs: range(0,15000).optional(), swing: unit.optional(),
    bars: int(1,2).optional(), sourceType: source, isDemo: z.boolean().optional(),
    capturedAt: stamp, durationMs: duration, bpm, scale, beatSnapshot: beat.optional(),
    pinballEvents: z.array(recorded).max(4096).optional(), pinballScene: scene.optional(),
    events: z.array(event).max(4096) }).superRefine((s, ctx) => {
      const fail = message => ctx.addIssue({ code: 'custom', message });
      if (s.sourceType === 'beat') {
        if (!s.beatSnapshot || s.pinballEvents || s.pinballScene) fail('Inconsistent beat snapshot');
        else if (s.bpm !== s.beatSnapshot.bpm || s.scale !== s.beatSnapshot.scale ||
          Math.abs(s.durationMs - 240000 * (['A','B'].includes(s.beatSnapshot.activePhraseLoop) ? 1 : s.beatSnapshot.bars) / s.bpm) > 1) fail('Beat timing mismatch');
      } else if (!s.pinballEvents || s.beatSnapshot) fail('Inconsistent pinball snapshot');
      if (s.events.some(e => e.timeOffsetMs > s.durationMs || e.timeOffsetMs + e.durationMs > 120000))
        fail('Event exceeds duration');
    });
  const parent = { parentCardId: id, parentCode: code, parentTitle: title, lineageDepth: int(1, 256) };
  const sticker = obj({ uid: id, stickerId: z.enum(['clapper','bell','coin','spoon','spatula','raindrop','cicada','bolt','note','cassette','starburst','heart','lantern','flame','crown']),
    x: range(0, 100), y: range(0, 100), scale: range(0.1, 8), rotation: range(-3600, 3600),
    zIndex: int(-100000, 100000).optional() });
  const design = { title, rarity: z.enum(['SSR', 'UR', 'LTD']), foil: z.enum(['prism','spark','cyber','chrome','gold']),
    artId: z.enum(['neon-dj','street-bell','bamboo-cat','arcade-bot','chestnut-pop','lion-drum',
      'soda-frog','mahjong-fox','street-rattle','lucky-coin','sugar-spoon','cyber-zither',
      'ferris-box','night-sizzle','rain-cloud','neon-tape','cicada-moon']),
    stickers: z.array(sticker).max(128), sourceType: source };
  const ForgeDraftSchema = obj({ ...design, title: z.string().max(64), snapshot: SnapshotSchema.nullable(),
    remixOrigin: obj(parent).nullable().optional() }).refine(d => !d.snapshot || d.sourceType === d.snapshot.sourceType);
  const MintedCardSchema = obj({ ...versions, ...design, id,
    storageStatus: z.enum(['primary','fallback']).optional(), audioCacheKey: z.string().max(512).optional(), serialNumber: int(0, Number.MAX_SAFE_INTEGER - 1),
    code, idempotencyKey: z.string().min(1).max(512),
    requestId: id.optional(), contentHash: z.string().regex(/^[a-f0-9]{64}$/).optional(), designVersion: z.literal(1).optional(),
    isDemo: z.boolean().optional(), waveformBars: z.array(unit).min(1).max(512), waveformIsRealPcm: z.boolean().optional(),
    audioFingerprintSeed: int(0, 0xffffffff), snapshot: SnapshotSchema, parentCardId: id.optional(),
    parentCode: code.optional(), parentTitle: title.optional(), lineageDepth: int(0, 256), createdAt: stamp
  }).superRefine((c, ctx) => {
    if ((c.designVersion !== undefined || c.requestId !== undefined) && !c.contentHash) {
      ctx.addIssue({ code: 'custom', path: ['contentHash'], message: 'Versioned works require a content digest' });
    }
    if (c.snapshot.sourceType !== c.sourceType || c.parentCardId === c.id ||
        [c.parentCardId, c.parentCode, c.parentTitle].some(v => Boolean(v) !== (c.lineageDepth > 0))) {
      ctx.addIssue({ code: 'custom', message: 'Invalid source or lineage metadata' });
    }
  });
  const header = { schema: z.enum(['holobeat.project.v2','holobeat.project.v3']), exportedAt: stamp, assetVersion: versions.assetVersion, rendererVersion: versions.rendererVersion };
  const ProjectSchema = z.discriminatedUnion('kind', [
    obj({ ...header, kind: z.literal('minted-card'), card: MintedCardSchema }),
    obj({ ...header, kind: z.literal('forge-draft'), draft: ForgeDraftSchema })
  ]);
  return { MintedCardSchema, ForgeDraftSchema, ProjectSchema, SnapshotSchema };
}
