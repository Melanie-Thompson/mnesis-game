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

export function playHitSound() {
  const ctx = getCtx();
  const t = ctx.currentTime;
  // Noise burst + low thud
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = "sawtooth";
  osc.frequency.setValueAtTime(200, t);
  osc.frequency.exponentialRampToValueAtTime(60, t + 0.15);
  g.gain.setValueAtTime(0.18, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
  osc.connect(g);
  g.connect(ctx.destination);
  osc.start(t);
  osc.stop(t + 0.15);
  // Click
  playNote(ctx, 800, t, 0.03, 0.12, "square");
}

export function playEnemyHitSound() {
  const ctx = getCtx();
  const t = ctx.currentTime;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = "sawtooth";
  osc.frequency.setValueAtTime(300, t);
  osc.frequency.exponentialRampToValueAtTime(80, t + 0.12);
  g.gain.setValueAtTime(0.15, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
  osc.connect(g);
  g.connect(ctx.destination);
  osc.start(t);
  osc.stop(t + 0.12);
  playNote(ctx, 1200, t, 0.02, 0.08, "square");
}

export function playSpellSound() {
  const ctx = getCtx();
  const t = ctx.currentTime;
  const vol = 0.10;
  // Rising shimmer
  playNote(ctx, 440, t, 0.12, vol, "sine");
  playNote(ctx, 660, t + 0.06, 0.12, vol, "sine");
  playNote(ctx, 880, t + 0.12, 0.15, vol, "sine");
  playNote(ctx, 1320, t + 0.18, 0.2, vol * 0.6, "sine");
}

export function playHealSound() {
  const ctx = getCtx();
  const t = ctx.currentTime;
  const vol = 0.10;
  // Gentle ascending chime
  playNote(ctx, 523.25, t, 0.2, vol, "sine");
  playNote(ctx, 659.25, t + 0.12, 0.2, vol, "sine");
  playNote(ctx, 783.99, t + 0.24, 0.3, vol, "sine");
  playNote(ctx, 1046.5, t + 0.36, 0.35, vol * 0.7, "triangle");
}

export function playSyzygySound() {
  const ctx = getCtx();
  const t = ctx.currentTime;
  const vol = 0.14;
  // Dramatic chord burst
  playNote(ctx, 261.63, t, 0.08, vol, "square");
  playNote(ctx, 329.63, t, 0.08, vol, "square");
  playNote(ctx, 392.00, t, 0.08, vol, "square");
  // Rising sweep
  playNote(ctx, 523.25, t + 0.1, 0.1, vol, "square");
  playNote(ctx, 659.25, t + 0.1, 0.1, vol, "square");
  playNote(ctx, 783.99, t + 0.1, 0.1, vol, "square");
  // Impact
  playNote(ctx, 1046.5, t + 0.22, 0.25, vol, "sawtooth");
  playNote(ctx, 523.25, t + 0.22, 0.25, vol * 0.5, "sawtooth");
}

export function playShiftSound() {
  const ctx = getCtx();
  const t = ctx.currentTime;
  // Short whoosh — descending tone
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = "triangle";
  osc.frequency.setValueAtTime(600, t);
  osc.frequency.exponentialRampToValueAtTime(300, t + 0.12);
  g.gain.setValueAtTime(0.10, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
  osc.connect(g);
  g.connect(ctx.destination);
  osc.start(t);
  osc.stop(t + 0.12);
}

export function playSyzygyReadySound() {
  const ctx = getCtx();
  const t = ctx.currentTime;
  const vol = 0.08;
  // Two-note chime
  playNote(ctx, 783.99, t, 0.15, vol, "sine");
  playNote(ctx, 1046.5, t + 0.15, 0.25, vol, "sine");
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
