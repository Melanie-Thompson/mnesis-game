let audioCtx: AudioContext | null = null;

function getCtx(): AudioContext {
  if (!audioCtx) audioCtx = new AudioContext();
  return audioCtx;
}

function playNote(ctx: AudioContext, freq: number, start: number, dur: number, gain: number, type: OscillatorType = "square") {
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  g.gain.setValueAtTime(gain, start);
  g.gain.exponentialRampToValueAtTime(0.001, start + dur);
  osc.connect(g);
  g.connect(ctx.destination);
  osc.start(start);
  osc.stop(start + dur);
}

export function playVictoryFanfare() {
  const ctx = getCtx();
  const t = ctx.currentTime;
  const vol = 0.12;

  // Classic RPG victory fanfare — quick ascending phrase
  const notes: [number, number, number][] = [
    // [freq, startOffset, duration]
    [523.25, 0,    0.15],  // C5
    [523.25, 0.15, 0.15],  // C5
    [523.25, 0.30, 0.15],  // C5
    [523.25, 0.45, 0.35],  // C5 (held)
    [415.30, 0.85, 0.15],  // Ab4
    [466.16, 1.00, 0.15],  // Bb4
    [523.25, 1.15, 0.45],  // C5 (held)
    [466.16, 1.45, 0.15],  // Bb4
    [523.25, 1.60, 0.65],  // C5 (long)
  ];

  for (const [freq, offset, dur] of notes) {
    playNote(ctx, freq, t + offset, dur, vol, "square");
    playNote(ctx, freq * 2, t + offset, dur, vol * 0.3, "square");
  }
}

export function playDefeatSound() {
  const ctx = getCtx();
  const t = ctx.currentTime;
  const vol = 0.10;

  const notes: [number, number, number][] = [
    [293.66, 0,    0.35],  // D4
    [261.63, 0.40, 0.35],  // C4
    [233.08, 0.80, 0.35],  // Bb3
    [207.65, 1.20, 0.80],  // Ab3 (long, fading)
  ];

  for (const [freq, offset, dur] of notes) {
    playNote(ctx, freq, t + offset, dur, vol, "triangle");
    playNote(ctx, freq * 0.5, t + offset, dur, vol * 0.4, "triangle");
  }
}
