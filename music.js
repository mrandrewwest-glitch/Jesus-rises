// ============================================================
//  music.js: shared synthesised sound library for the Bible-story games
//
//  Everything is made with WebAudio, so nothing is downloaded. It works in a
//  live AudioContext or in an OfflineAudioContext.
//
//    Music.theme = { tune: 'amazingGrace', instrument: 'harp', accent: 'strings',
//                    ambience: 'sea', percussion: false };
//    Music.init(ac, masterGain);   // from the game's sfx.init
//    Music.win(); Music.start(); Music.fail();
//    Music.tap(height01);          // height 0..1 picks a note up the tune's scale
//    Music.ambience(true|false);   // start or stop the theme's ambient bed
//    Music.render(ac, out, t0, 'win'|'start'|'fail'|'tap', theme, height?)
//    Music.renderAmbience(ac, out, t0, seconds, name)   // for offline rendering
//
//  Instruments: choir, organ, harp, pipe, bells, strings, timbrel.
//  Tunes (public-domain hymn melodies): hallelujah, joyToTheWorld,
//    oComeAllYeFaithful, amazingGrace, jesusLovesMe, odeToJoy, doxology.
//  Ambience: sea, wind, birds, crowd, night, fire, market, none.
//  The default theme is the house sound: the Hallelujah choir with organ.
//
//  Everything sits inside one closure, so the only global is window.Music.
//  That matters because the games already declare globals such as noteFreq
//  and VOWELS with const.
// ============================================================
(function () {
  'use strict';

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const rand = (a, b) => a + Math.random() * (b - a);
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

  // Disconnects the nodes once the source has finished, so long sessions don't leak.
  function cleanup(src, nodes) {
    src.onended = () => {
      try { src.disconnect(); } catch (e) { /* already gone */ }
      for (const n of nodes) { try { n.disconnect(); } catch (e) { /* already gone */ } }
    };
  }

  // One shared 2-second white-noise buffer per AudioContext
  const noiseCache = new WeakMap();
  function noiseBuffer(ac) {
    let b = noiseCache.get(ac);
    if (!b) {
      const len = Math.floor(ac.sampleRate * 2);
      b = ac.createBuffer(1, len, ac.sampleRate);
      const d = b.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      noiseCache.set(ac, b);
    }
    return b;
  }
  function noiseSource(ac, t0, loop = true) {
    const s = ac.createBufferSource();
    s.buffer = noiseBuffer(ac);
    s.loop = loop;
    s.start(t0, Math.random() * 1.8);
    return s;
  }

  // ------------------------------------------------------------
  //  Notes
  // ------------------------------------------------------------
  const VOWELS = {             // formant frequencies for each sung vowel
    a: [800, 1150, 2900],      // "Hal", "jah"
    e: [500, 1750, 2600],      // "le"
    u: [350, 700, 2500],       // "lu"
    o: [450, 800, 2830],       // "oh"
    i: [300, 2200, 3000],      // "ee"
  };
  const NOTE_OFFSETS = { C: -9, D: -7, E: -5, F: -4, G: -2, A: 0, B: 2 };
  const PC = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  function noteFreq(n) {
    if (typeof n === 'number') return n;
    const m = /^([A-G])([#b]?)(\d)$/.exec(n);
    const semis = NOTE_OFFSETS[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0) + (m[3] - 4) * 12;
    return 440 * Math.pow(2, semis / 12);
  }
  const midiFreq = (m) => 440 * Math.pow(2, (m - 69) / 12);
  const freqMidi = (f) => Math.round(69 + 12 * Math.log2(f / 440));
  function pitchClass(name) {
    const m = /^([A-G])([#b]?)/.exec(name);
    return (PC[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? 11 : 0)) % 12;
  }

  // ------------------------------------------------------------
  //  The house sound: the Hallelujah choir and organ.
  //  (Motif after Handel's Messiah, 1741, public domain.) The scores,
  //  singPart, organ and playHeaven are copied unchanged from the games.
  //  Only the node cleanup is new.
  // ------------------------------------------------------------
  // Scores: [vowel, beats, soprano, alto, tenor, bass]; a null vowel is a rest
  const SCORE_WIN = [
    ['a', 1, 'A4', 'F#4', 'D4', 'D3'], ['e', 0.75, 'A4', 'F#4', 'D4', 'D3'],
    ['u', 0.25, 'B4', 'G4', 'D4', 'D3'], ['a', 1, 'A4', 'F#4', 'D4', 'D3'], [null, 0.5],
    ['a', 1, 'E5', 'C#5', 'E4', 'A2'], ['e', 0.75, 'E5', 'C#5', 'E4', 'A2'],
    ['u', 0.25, 'F#5', 'D5', 'F#4', 'A2'], ['a', 1, 'E5', 'C#5', 'E4', 'A2'], [null, 0.5],
    ['a', 1.25, 'D5', 'B4', 'G4', 'G2'], ['e', 0.5, 'D5', 'B4', 'G4', 'G2'],
    ['u', 0.75, 'C#5', 'A4', 'E4', 'A2'], ['a', 3, 'D5', 'A4', 'F#4', 'D3'],
  ];
  const SCORE_START = [['a', 3, 'D5', 'A4', 'F#4', 'D3']];
  const SCORE_FAIL = [['o', 1.2, 'F#4', 'D4', 'A3', 'D3'], ['o', 2.4, 'D4', 'B3', 'F#3', 'B2']];

  // One choir part sung legato: a few detuned voices through vowel formant filters
  function singPart(ac, out, t0, beat, score, part, vol, opts = {}) {
    const total = score.reduce((s, n) => s + n[1], 0) * beat;
    const end = t0 + total;
    const env = ac.createGain();
    env.gain.setValueAtTime(0.0001, t0);
    env.connect(out);
    const nodes = [env];
    const formants = [0, 1, 2].map((k) => {
      const bp = ac.createBiquadFilter();
      bp.type = 'bandpass'; bp.Q.value = [6, 9, 12][k];
      const g = ac.createGain(); g.gain.value = [1, 0.55, 0.25][k] * 3;
      bp.connect(g); g.connect(env);
      nodes.push(bp, g);
      return bp;
    });
    const voices = [];
    for (let v = 0; v < 3; v++) {
      const o = ac.createOscillator();
      o.type = 'sawtooth';
      const lfo = ac.createOscillator(), depth = ac.createGain();
      lfo.frequency.value = 4.8 + Math.random() * 1.2; depth.gain.value = 14;
      lfo.connect(depth); depth.connect(o.detune);
      o.detune.value = (v - 1) * 9;
      formants.forEach((f) => o.connect(f));
      o.start(t0); o.stop(end + 0.6); lfo.start(t0); lfo.stop(end + 0.6);
      cleanup(lfo, [depth]);
      voices.push(o);
    }
    cleanup(voices[2], nodes);
    let t = t0, first = true;
    for (const [vowel, beats, ...notes] of score) {
      const d = beats * beat;
      if (!vowel) {
        env.gain.setTargetAtTime(0.0001, t, 0.04);
        first = true; t += d; continue;
      }
      const f = noteFreq(notes[part]);
      voices.forEach((o) => (first ? o.frequency.setValueAtTime(f, t) : o.frequency.setTargetAtTime(f, t, 0.02)));
      VOWELS[vowel].forEach((ff, k) => (first ? formants[k].frequency.setValueAtTime(ff, t) : formants[k].frequency.setTargetAtTime(ff, t, 0.03)));
      // consonant: a quick dip in volume at the start of each syllable
      env.gain.setTargetAtTime(vol * 0.35, t, 0.012);
      env.gain.setTargetAtTime(vol, t + 0.035, first ? 0.05 : 0.025);
      first = false;
      t += d;
    }
    if (opts.swell) env.gain.setTargetAtTime(vol * 1.5, end - score[score.length - 1][1] * beat * 0.8, 0.4);
    if (opts.droop) voices.forEach((o) => o.frequency.setTargetAtTime(noteFreq(score[score.length - 1][2 + part]) * 0.93, end - 0.8, 0.35));
    env.gain.setTargetAtTime(0.0001, end, 0.18);
  }

  // Pipe organ: stacked sine pipes (8', 4', 2 2/3', 2')
  function organNote(ac, out, t, f, d, vol) {
    d = Math.max(d, 0.1);
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.03);
    g.gain.setValueAtTime(vol, t + d - 0.04);
    g.gain.linearRampToValueAtTime(0.0001, t + d + 0.08);
    g.connect(out);
    [[1, 1], [2, 0.5], [3, 0.25], [4, 0.2]].forEach(([h, a], i) => {
      const o = ac.createOscillator(), og = ac.createGain();
      o.frequency.value = f * h; og.gain.value = a;
      o.connect(og); og.connect(g);
      o.start(t); o.stop(t + d + 0.1);
      cleanup(o, i === 3 ? [og, g] : [og]);
    });
  }
  function organ(ac, out, t0, beat, score, vol) {
    let t = t0;
    for (const [vowel, beats, ...notes] of score) {
      const d = beats * beat;
      if (vowel) for (const n of notes) organNote(ac, out, t, noteFreq(n), d, vol);
      t += d;
    }
  }

  // Plays one piece ('win' | 'start' | 'fail'): the choir with a pipe organ beneath
  const HEAVEN_BEAT = { win: 0.42, start: 0.45, fail: 0.5 };
  const HEAVEN_SCORE = { win: SCORE_WIN, start: SCORE_START, fail: SCORE_FAIL };
  function heavenChoir(ac, out, t0, piece) {
    const score = HEAVEN_SCORE[piece], beat = HEAVEN_BEAT[piece];
    const opts = { swell: piece === 'win', droop: piece === 'fail' };
    const vols = [0.2, 0.14, 0.13, 0.16];
    for (let part = 0; part < 4; part++) singPart(ac, out, t0, beat, score, part, vols[part], opts);
  }
  function playHeaven(ac, out, t0, piece) {
    const score = HEAVEN_SCORE[piece], beat = HEAVEN_BEAT[piece];
    heavenChoir(ac, out, t0, piece);
    organ(ac, out, t0, beat, score, 0.045);
  }

  // ------------------------------------------------------------
  //  Instrument palette: fn(ac, out, t0, freq, dur, vol, opts)
  //  freq may be a number or an array of numbers (a chord)
  // ------------------------------------------------------------
  const asList = (f) => (Array.isArray(f) ? f : [f]).map(noteFreq);

  // Loudness trims so each instrument sits at about the choir's level at the same vol
  const TRIM = { choir: 1, organ: 0.62, harp: 0.9, pipe: 0.75, bells: 0.53, strings: 0.72, timbrel: 1 };

  function choir(ac, out, t0, freq, dur, vol, opts = {}) {
    const fs = asList(freq), v = vol * TRIM.choir / Math.sqrt(fs.length);
    fs.forEach((f) => singPart(ac, out, t0, Math.max(dur, 0.12), [[opts.vowel || 'a', 1, f]], 0, v, opts));
  }

  function organInst(ac, out, t0, freq, dur, vol) {
    const fs = asList(freq), v = vol * TRIM.organ / Math.sqrt(fs.length);
    fs.forEach((f) => organNote(ac, out, t0, f, dur, v));
  }

  // Plucked harp or lyre: a few harmonics, each decaying quickly (upper ones faster),
  // plus a tiny noise "pluck". There is no feedback loop, so high notes stay clean.
  function harpNote(ac, out, t, f, vol) {
    const tau0 = clamp(0.9 * Math.sqrt(262 / f), 0.22, 1.5);
    const H = [[1, 1], [2, 0.45], [3, 0.22], [4, 0.1], [5, 0.05]];
    H.forEach(([h, a]) => {
      if (f * h > 11000) return;
      const o = ac.createOscillator(), g = ac.createGain();
      o.frequency.value = f * h * (1 + 0.0004 * h * h);
      const tau = tau0 / Math.pow(h, 0.8);
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(a * vol, t + 0.004);
      g.gain.setTargetAtTime(0, t + 0.004, tau);
      o.connect(g); g.connect(out);
      o.start(t); o.stop(t + 0.01 + tau * 6);
      cleanup(o, [g]);
    });
    const n = noiseSource(ac, t, false), bp = ac.createBiquadFilter(), ng = ac.createGain();
    bp.type = 'bandpass'; bp.frequency.value = Math.min(f * 3, 9000); bp.Q.value = 1.5;
    ng.gain.setValueAtTime(0, t);
    ng.gain.linearRampToValueAtTime(vol * 0.25, t + 0.002);
    ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.03);
    n.connect(bp); bp.connect(ng); ng.connect(out);
    n.stop(t + 0.04);
    cleanup(n, [bp, ng]);
  }
  function harp(ac, out, t0, freq, dur, vol, opts = {}) {
    const fs = asList(freq).sort((a, b) => a - b), v = vol * TRIM.harp / Math.sqrt(fs.length);
    const strum = opts.strum != null ? opts.strum : 0.035;
    fs.forEach((f, i) => harpNote(ac, out, t0 + i * strum, f, v));
  }

  // Shepherd's pipe: soft attack, gentle delayed vibrato and breath noise
  function pipeNote(ac, out, t, f, d, vol) {
    d = Math.max(d, 0.12);
    const end = t + d, rel = 0.12;
    const env = ac.createGain();
    env.gain.setValueAtTime(0.0001, t);
    env.gain.linearRampToValueAtTime(vol, t + 0.07);
    env.gain.setValueAtTime(vol, end);
    env.gain.linearRampToValueAtTime(0.0001, end + rel);
    env.connect(out);
    const lfo = ac.createOscillator(), depth = ac.createGain();
    lfo.frequency.value = rand(4.8, 5.6);
    depth.gain.setValueAtTime(0, t);
    depth.gain.linearRampToValueAtTime(0, t + 0.15);
    depth.gain.linearRampToValueAtTime(14, t + 0.6);
    lfo.connect(depth);
    const oscs = [[1, 1], [2, 0.12], [3, 0.05]].map(([h, a]) => {
      const o = ac.createOscillator(), g = ac.createGain();
      o.frequency.value = f * h; g.gain.value = a;
      depth.connect(o.detune);
      o.connect(g); g.connect(env);
      o.start(t); o.stop(end + rel + 0.02);
      cleanup(o, [g]);
      return o;
    });
    lfo.start(t); lfo.stop(end + rel + 0.02);
    cleanup(lfo, [depth, env]);
    // breath: band-passed noise with a small "chiff" at the start
    const n = noiseSource(ac, t), bp = ac.createBiquadFilter(), ng = ac.createGain();
    bp.type = 'bandpass'; bp.frequency.value = Math.min(f * 2, 8000); bp.Q.value = 1.2;
    ng.gain.setValueAtTime(0.0001, t);
    ng.gain.linearRampToValueAtTime(vol * 0.35, t + 0.025);
    ng.gain.setTargetAtTime(vol * 0.1, t + 0.03, 0.05);
    ng.gain.setValueAtTime(vol * 0.1, end);
    ng.gain.linearRampToValueAtTime(0.0001, end + rel);
    n.connect(bp); bp.connect(ng); ng.connect(out);
    n.stop(end + rel + 0.02);
    cleanup(n, [bp, ng]);
    return oscs;
  }
  function pipe(ac, out, t0, freq, dur, vol) {
    const fs = asList(freq), v = vol * TRIM.pipe / Math.sqrt(fs.length);
    fs.forEach((f) => pipeNote(ac, out, t0, f, dur, v));
  }

  // Handbells and chimes: inharmonic partials with a long ring
  const BELL = [[0.5, 0.2, 1.3], [1, 1, 1], [2, 0.35, 0.55], [2.76, 0.3, 0.4], [5.4, 0.14, 0.2], [8.93, 0.06, 0.1]];
  function bellNote(ac, out, t, f, vol) {
    const base = clamp(2.0 * Math.sqrt(440 / f), 0.5, 2.6);
    BELL.forEach(([r, a, k]) => {
      if (f * r > 12000) return;
      const o = ac.createOscillator(), g = ac.createGain();
      o.frequency.value = f * r;
      const tau = base * k;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(a * vol, t + 0.003);
      g.gain.setTargetAtTime(0, t + 0.003, tau);
      o.connect(g); g.connect(out);
      o.start(t); o.stop(t + 0.01 + tau * 6);
      cleanup(o, [g]);
    });
  }
  function bells(ac, out, t0, freq, dur, vol, opts = {}) {
    const fs = asList(freq).sort((a, b) => a - b), v = vol * TRIM.bells / Math.sqrt(fs.length);
    const strum = opts.strum != null ? opts.strum : 0.05;
    fs.forEach((f, i) => bellNote(ac, out, t0 + i * strum, f, v));
  }

  // Warm strings pad: detuned saws through a lowpass that opens as the bow digs in
  function strings(ac, out, t0, freq, dur, vol, opts = {}) {
    const fs = asList(freq), v = vol * TRIM.strings / Math.sqrt(fs.length);
    const d = Math.max(dur, 0.15), end = t0 + d;
    const att = opts.attack != null ? opts.attack : Math.min(0.3, d * 0.4);
    const rel = opts.release != null ? opts.release : 0.45;
    const top = Math.max(...fs);
    const lp = ac.createBiquadFilter();
    lp.type = 'lowpass'; lp.Q.value = 0.6;
    const cut = Math.min(3200, top * 3.2 + 400);
    lp.frequency.setValueAtTime(cut * 0.45, t0);
    lp.frequency.linearRampToValueAtTime(cut, t0 + att + 0.1);
    const env = ac.createGain();
    env.gain.setValueAtTime(0.0001, t0);
    env.gain.linearRampToValueAtTime(v, t0 + att);
    env.gain.setValueAtTime(v, end);
    env.gain.linearRampToValueAtTime(0.0001, end + rel);
    lp.connect(env); env.connect(out);
    const lfo = ac.createOscillator(), depth = ac.createGain();
    lfo.frequency.value = rand(4.6, 5.4); depth.gain.value = 5;
    lfo.connect(depth);
    const dets = fs.length === 1 ? [-8, 0, 8] : [-7, 7];
    let last = null;
    fs.forEach((f) => dets.forEach((dt) => {
      const o = ac.createOscillator();
      o.type = 'sawtooth'; o.frequency.value = f; o.detune.value = dt + rand(-2, 2);
      depth.connect(o.detune);
      o.connect(lp);
      o.start(t0); o.stop(end + rel + 0.02);
      last = o;
    }));
    lfo.start(t0); lfo.stop(end + rel + 0.02);
    cleanup(lfo, [depth]);
    cleanup(last, [lp, env]);
  }

  // Timbrel: a tambourine jingle plus a low hand-drum thump.
  // Here freq is only a strength: 0 means jingle only, any other value adds the thump.
  function timbrel(ac, out, t0, freq, dur, vol, opts = {}) {
    const v = vol * TRIM.timbrel;
    const thump = opts.thump != null ? opts.thump : freq !== 0;
    const jingle = opts.jingle != null ? opts.jingle : 1;
    if (jingle > 0) {
      const n = noiseSource(ac, t0, false), hp = ac.createBiquadFilter(), bp = ac.createBiquadFilter(), g = ac.createGain();
      hp.type = 'highpass'; hp.frequency.value = 5500;
      bp.type = 'peaking'; bp.frequency.value = rand(8500, 9500); bp.Q.value = 3; bp.gain.value = 9;
      const a = v * 0.9 * jingle;
      g.gain.setValueAtTime(0, t0);
      g.gain.linearRampToValueAtTime(a, t0 + 0.003);
      g.gain.setTargetAtTime(a * 0.25, t0 + 0.004, 0.012);
      g.gain.setTargetAtTime(a * 0.55, t0 + 0.03, 0.004);   // second jingle rattle
      g.gain.setTargetAtTime(0.0001, t0 + 0.036, 0.045);
      n.connect(hp); hp.connect(bp); bp.connect(g); g.connect(out);
      n.stop(t0 + 0.3);
      cleanup(n, [hp, bp, g]);
    }
    if (thump) {
      const o = ac.createOscillator(), g = ac.createGain();
      o.frequency.setValueAtTime(150, t0);
      o.frequency.exponentialRampToValueAtTime(58, t0 + 0.12);
      g.gain.setValueAtTime(0, t0);
      g.gain.linearRampToValueAtTime(v * 1.6, t0 + 0.004);
      g.gain.setTargetAtTime(0, t0 + 0.006, 0.06);
      o.connect(g); g.connect(out);
      o.start(t0); o.stop(t0 + 0.45);
      cleanup(o, [g]);
    }
  }

  const INSTRUMENTS = { choir, organ: organInst, harp, pipe, bells, strings, timbrel };
  const PLUCKED = { harp: 1, bells: 1 };

  // ------------------------------------------------------------
  //  Chords: a symbol ('D', 'Em', 'A7') or an explicit array of note names
  //  (upper voices first, bass last). This returns [upper..., bass] as frequencies.
  // ------------------------------------------------------------
  function voiceChord(ch) {
    if (Array.isArray(ch)) return ch.map(noteFreq);
    const m = /^([A-G][#b]?)(m?)(7?)$/.exec(ch);
    const root = pitchClass(m[1]);
    const ints = [0, m[2] ? 3 : 4, 7];
    if (m[3]) ints.push(10);
    let bass = 36 + root; if (bass < 40) bass += 12;               // E2..D#3
    const upperInts = ints.length === 4 ? ints.slice(1) : ints;
    const upper = upperInts.map((iv) => { let x = 48 + (root + iv) % 12; while (x < 55) x += 12; return x; })
      .sort((a, b) => b - a);                                       // G3..F#4
    return [...upper, bass].map(midiFreq);
  }

  // ------------------------------------------------------------
  //  Tune library: public-domain hymn melodies
  //  melody: 'Note/beats' tokens ('r/1' is a rest), vowels: one per note (for the choir)
  //  chords: [symbol, beats]; a null symbol is silence
  // ------------------------------------------------------------
  function parseMelody(str, vowels) {
    const vs = (vowels || '').split(/\s+/).filter(Boolean);
    let k = 0;
    return str.trim().split(/\s+/).map((tok) => {
      const [n, b] = tok.split('/');
      if (n === 'r') return { note: null, beats: +b };
      return { note: n, beats: +b, vowel: vs[k++] || 'a' };
    });
  }

  const TUNES = {
    // Handel, Messiah (1741): "Hal-le-lu-jah" motif and cadence. D major.
    hallelujah: {
      title: 'Hallelujah (Handel)', key: 'D', beat: 0.42, meter: 4, pickup: 0, startN: 4,
      satb: true,
      melody: SCORE_WIN.map(([v, b, s]) => (v ? { note: s, beats: b, vowel: v } : { note: null, beats: b })),
      chords: SCORE_WIN.map(([v, b, s, a, t, bs]) => [v ? [a, t, bs] : null, b]),
    },
    // "Antioch" (arr. Lowell Mason, 1839): "Joy to the world, the Lord is come! Let earth receive her King". D major, 2/4.
    joyToTheWorld: {
      title: 'Joy to the World', key: 'D', beat: 0.36, meter: 2, pickup: 0, startN: 4,
      melody: parseMelody('D5/1 C#5/.75 B4/.25 A4/1.5 G4/.5 F#4/1 E4/1 D4/1.5 A4/.5 B4/1.5 B4/.5 C#5/1.5 C#5/.5 D5/3',
        'o u e o e o i a e e i i e i'),
      chords: [['D', 2], ['D', 2], ['D', 1], ['A7', 1], ['D', 2], ['G', 2], ['A7', 2], ['D', 3]],
    },
    // "Adeste Fideles" (J. F. Wade, c. 1743): "O come, all ye faithful, joyful and triumphant"
    // ending on the pick-up "O" (G) as a closing tonic. G major, 4/4.
    oComeAllYeFaithful: {
      title: 'O Come, All Ye Faithful', key: 'G', beat: 0.34, meter: 4, pickup: 1, startN: 4,
      melody: parseMelody('G4/1 G4/2 D4/1 G4/1 A4/2 D4/2 B4/1 A4/1 B4/1 C5/1 B4/2 A4/2 G4/3',
        'o a o i e u o u a i u a o'),
      chords: [['G', 1], ['G', 4], ['D', 4], ['G', 1], ['D', 1], ['G', 1], ['C', 1], ['G', 2], ['D7', 2], ['G', 3]],
    },
    // "New Britain" (1829): "Amazing grace, how sweet the sound, that saved a wretch like me". G major, 3/4.
    amazingGrace: {
      title: 'Amazing Grace', key: 'G', beat: 0.32, meter: 3, pickup: 1, startN: 4,
      melody: parseMelody('D4/1 G4/2 B4/.5 G4/.5 B4/2 A4/1 G4/2 E4/1 D4/2 D4/1 G4/2 B4/.5 G4/.5 B4/2 A4/1 D5/3',
        'a a i i e a i e a a e a a e a i'),
      chords: [[null, 1], ['G', 3], ['G', 3], ['C', 3], ['G', 3], ['G', 3], ['G', 2], ['D', 1], ['G', 3]],
    },
    // W. B. Bradbury (1862): "Jesus loves me! This I know, for the Bible tells me so". D major, 4/4.
    jesusLovesMe: {
      title: 'Jesus Loves Me', key: 'D', beat: 0.34, meter: 4, pickup: 0, startN: 4,
      melody: parseMelody('A4/1 F#4/1 F#4/1 E4/1 F#4/1 A4/1 A4/2 B4/1 B4/1 D5/1 B4/1 B4/1 A4/1 A4/3',
        'e u a i i a o o e a e e i o'),
      chords: [['D', 8], ['G', 4], ['G', 1], ['A7', 1], ['D', 3]],
    },
    // Beethoven, Symphony 9 (1824), sung as "Joyful, Joyful, We Adore Thee". D major, 4/4.
    // The win uses the answering phrase: it opens the same way and ends on the tonic.
    odeToJoy: {
      title: 'Joyful, Joyful (Ode to Joy)', key: 'D', beat: 0.36, meter: 4, pickup: 0, startN: 4,
      melody: parseMelody('F#4/1 F#4/1 G4/1 A4/1 A4/1 G4/1 F#4/1 E4/1 D4/1 D4/1 E4/1 F#4/1 E4/1.5 D4/.5 D4/3',
        'o u o u o i a o e o o a a o e'),
      chords: [['D', 4], ['A7', 4], ['D', 4], ['A', 2], ['D', 3]],
    },
    // "Old Hundredth" (Genevan Psalter, 1551), the Doxology: "Praise God, from whom all blessings flow". G major.
    doxology: {
      title: 'Doxology (Old Hundredth)', key: 'G', beat: 0.48, meter: 4, pickup: 0, startN: 3,
      melody: parseMelody('G4/2 G4/1 F#4/1 E4/1 D4/1 G4/1 A4/1 B4/3', 'e o o u o e i o'),
      chords: [['G', 3], ['D', 1], ['Em', 1], ['G', 1], ['C', 1], ['D', 1], ['G', 3]],
    },
  };
  // The first six melody notes of odeToJoy (the opening "Joyful, joyful, Lord we" line)
  const ODE_OPENING = parseMelody('F#4/1 F#4/1 G4/1 A4/1 A4/1 G4/1');

  // ------------------------------------------------------------
  //  Rendering helpers
  // ------------------------------------------------------------
  const MEL = 0.25;   // melody level (a little above the house choir soprano, which has 3 other parts)
  const ACC = 0.14;   // harmony level
  const PERC = 0.07;  // timbrel level

  const sumBeats = (list) => list.reduce((s, n) => s + (n.beats != null ? n.beats : n[1]), 0);

  // Melody line on one instrument. notes: [{note, beats, vowel}]
  function playLine(ac, out, t0, beat, notes, inst, vol, opts = {}) {
    if (inst === 'choir') {
      const score = notes.map((n) => (n.note ? [opts.vowel || n.vowel || 'a', n.beats, n.note] : [null, n.beats]));
      singPart(ac, out, t0, beat, score, 0, vol, opts);
      return;
    }
    const fn = INSTRUMENTS[inst] || harp;
    let t = t0;
    notes.forEach((n, i) => {
      const d = n.beats * beat;
      if (n.note) {
        const last = i === notes.length - 1;
        const accentVol = inst === 'timbrel' ? vol * 0.6 : vol;
        fn(ac, out, t, noteFreq(n.note), last ? d + (opts.hold || 0) : d * 0.94, accentVol);
      }
      t += d;
    });
  }

  // Harmony on the accent instrument. chords: [[symbol|array|null, beats]]
  function playChords(ac, out, t0, beat, chords, inst, vol, opts = {}) {
    if (inst === 'timbrel') { playPerc(ac, out, t0, beat, sumBeats(chords), opts.meter || 4, opts.pickup || 0, vol * 0.9); return; }
    // merge repeated chords so pads and organ hold instead of re-striking
    const merged = [];
    for (const [c, b] of chords) {
      const key = c && JSON.stringify(c);
      const prev = merged[merged.length - 1];
      if (prev && prev.key === key && !PLUCKED[inst]) prev.beats += b;
      else merged.push({ key, chord: c, beats: b });
    }
    if (inst === 'choir') {
      const vowel = opts.vowel || 'o';
      const score = merged.map((m) => {
        if (!m.chord) return [null, m.beats];
        const v = voiceChord(m.chord);
        const up = v.slice(0, -1);
        while (up.length < 3) up.push(up[up.length - 1]);
        return [vowel, m.beats, up[0], up[1], up[2], v[v.length - 1]];
      });
      const vs = [0.75, 0.65, 0.65, 0.8];
      for (let p = 0; p < 4; p++) singPart(ac, out, t0, beat, score, p, vol * vs[p], opts);
      return;
    }
    const fn = INSTRUMENTS[inst] || organInst;
    let t = t0;
    merged.forEach((m, i) => {
      const d = m.beats * beat;
      if (m.chord) {
        const v = voiceChord(m.chord);
        const last = i === merged.length - 1;
        const hold = last ? (opts.hold || 0) : 0;
        if (inst === 'harp') {
          // flowing harp: bass and chord on the first beat, then a lighter re-pluck on each further beat
          const steps = Math.max(1, Math.round(m.beats));
          for (let s = 0; s < steps; s++) {
            const ts = t + s * (d / steps);
            if (last && s > 0) break;
            harp(ac, out, ts, s === 0 ? v : v.slice(0, -1), d / steps, s === 0 ? vol : vol * 0.6);
          }
        } else if (inst === 'pipe') {
          pipe(ac, out, t, v.slice(0, -1).slice(0, 2), d * 0.96 + hold, vol * 0.8);
        } else if (inst === 'bells') {
          bells(ac, out, t, v, d, vol * 0.9);
        } else {
          fn(ac, out, t, v, d * 0.98 + hold, vol);
        }
      }
      t += d;
    });
  }

  // Timbrel rhythm: a thump on each downbeat, jingles on the beats and a soft
  // jingle on the off-beats, ending with a hit on the final chord
  function playPerc(ac, out, t0, beat, totalBeats, meter, pickup, vol) {
    const lastBeat = Math.floor(totalBeats - 1e-6);
    for (let b = 0; b < lastBeat; b++) {
      const t = t0 + b * beat;
      const down = ((b - pickup) % meter + meter) % meter === 0;
      timbrel(ac, out, t, down ? 1 : 0, beat, down ? vol : vol * 0.7, { thump: down });
      if (beat > 0.25) timbrel(ac, out, t + beat / 2, 0, beat, vol * 0.35, { thump: false });
    }
  }

  // The last chord of the tune (for start swells), and the tonic in minor (for fails)
  function finalChord(tune) {
    for (let i = tune.chords.length - 1; i >= 0; i--) if (tune.chords[i][0]) return tune.chords[i][0];
    return tune.key;
  }

  function minorise(midi, keyPc) {
    const d = ((midi - keyPc) % 12 + 12) % 12;
    return d === 4 || d === 9 || d === 11 ? midi - 1 : midi;
  }
  function stepDownMinor(midi, keyPc) {
    const scale = [0, 2, 3, 5, 7, 8, 10];
    for (let m = midi - 1; m > midi - 4; m--) if (scale.includes(((m - keyPc) % 12 + 12) % 12)) return m;
    return midi - 2;
  }

  function normTheme(theme) {
    const th = Object.assign({}, DEFAULT_THEME, theme || {});
    if (!TUNES[th.tune]) th.tune = DEFAULT_THEME.tune;
    if (!INSTRUMENTS[th.instrument]) th.instrument = DEFAULT_THEME.instrument;
    if (!INSTRUMENTS[th.accent]) th.accent = DEFAULT_THEME.accent;
    return th;
  }

  // ------------------------------------------------------------
  //  Pieces
  // ------------------------------------------------------------
  function renderWin(ac, out, t0, th, tune) {
    const beat = tune.beat, total = sumBeats(tune.melody) * beat;
    const plucked = !!PLUCKED[th.instrument];
    playLine(ac, out, t0, beat, tune.melody, th.instrument, MEL, { swell: true, hold: plucked ? 0 : 0.35 });
    playChords(ac, out, t0, beat, tune.chords, th.accent, ACC, { hold: 0.35, meter: tune.meter, pickup: tune.pickup, vowel: 'a' });
    if (th.percussion && th.accent !== 'timbrel' && th.instrument !== 'timbrel') {
      playPerc(ac, out, t0, beat, sumBeats(tune.melody), tune.meter, tune.pickup, PERC);
      timbrel(ac, out, t0 + total - tune.melody[tune.melody.length - 1].beats * beat, 1, beat, PERC * 1.2);
    }
    return total + 1.2;
  }

  function renderStart(ac, out, t0, th, tune) {
    const notes = tune.melody.filter((n) => n.note).slice(0, tune.startN).map((n) => Object.assign({}, n));
    const nb = sumBeats(notes);
    const beat = clamp(0.95 / nb, 0.14, tune.beat);
    notes[notes.length - 1].beats += 0.55 / beat;          // hold the last note over the swell
    const total = sumBeats(notes) * beat;
    playLine(ac, out, t0, beat, notes, th.instrument, MEL * 0.85, { swell: true, hold: 0.1 });
    const chord = finalChord(tune);
    if (th.accent === 'timbrel') {
      [0, 0.07, 0.14].forEach((dt, i) => timbrel(ac, out, t0 + dt, 0, 0.1, PERC * (0.5 + i * 0.2), { thump: false }));
      timbrel(ac, out, t0 + total - 0.55, 1, 0.2, PERC);
    } else if (PLUCKED[th.accent]) {
      INSTRUMENTS[th.accent](ac, out, t0, voiceChord(chord), total, ACC * 0.8);
      INSTRUMENTS[th.accent](ac, out, t0 + total - 0.55, voiceChord(chord).slice(0, -1), total, ACC * 0.6);
    } else {
      playChords(ac, out, t0, total, [[chord, 1]], th.accent, ACC * 0.9, { vowel: 'a', swell: true });
    }
    if (th.percussion && th.accent !== 'timbrel') {
      [0, 0.07, 0.14].forEach((dt, i) => timbrel(ac, out, t0 + dt, 0, 0.1, PERC * (0.4 + i * 0.2), { thump: false }));
    }
    return total + 1.0;
  }

  function renderFail(ac, out, t0, th, tune) {
    const kp = pitchClass(tune.key);
    const src = tune.melody.filter((n) => n.note).slice(0, 3);
    const mid = src.map((n) => minorise(freqMidi(noteFreq(n.note)), kp));
    mid.push(stepDownMinor(mid[mid.length - 1], kp));
    const notes = mid.map((m, i) => ({ note: midiFreq(m), beats: i < 3 ? 1 : 3.2, vowel: 'o' }));
    const beat = 0.3, total = sumBeats(notes) * beat;
    playLine(ac, out, t0, beat, notes, th.instrument, MEL * 0.7, { droop: true, vowel: 'o' });
    const minor = tune.key + 'm';
    if (th.accent === 'timbrel') {
      timbrel(ac, out, t0 + 3 * beat, 1, 0.3, PERC * 0.6, { jingle: 0.3 });
    } else if (PLUCKED[th.accent]) {
      INSTRUMENTS[th.accent](ac, out, t0, voiceChord(minor), total, ACC * 0.6, { strum: 0.08 });
    } else {
      playChords(ac, out, t0, total - 0.1, [[minor, 1]], th.accent, ACC * 0.6, { vowel: 'o' });
    }
    return total + 1.0;
  }

  // Hallelujah on the choir keeps the original SATB piece. With the organ accent it is
  // exactly the old playHeaven; with any other accent that instrument replaces the organ.
  function renderSatb(ac, out, t0, piece, th, tune) {
    const score = HEAVEN_SCORE[piece], beat = HEAVEN_BEAT[piece];
    const total = sumBeats(score) * beat;
    if (th.accent === 'organ') playHeaven(ac, out, t0, piece);
    else {
      heavenChoir(ac, out, t0, piece);
      if (th.accent !== 'choir') {
        const chords = score.map(([v, b, s, a, t, bs]) => [v ? [a, t, bs] : null, b]);
        playChords(ac, out, t0, beat, chords, th.accent, ACC * 0.8, { meter: 4, pickup: 0 });
      }
    }
    if (piece === 'win' && th.percussion && th.accent !== 'timbrel') playPerc(ac, out, t0, beat, sumBeats(score), 4, 0, PERC);
    return total + 1.0;
  }

  // Tap: a short note on the theme instrument, pitched up the tune's major pentatonic
  const tapState = { last: -1 };
  function renderTap(ac, out, t0, th, tune, height) {
    const kp = pitchClass(tune.key);
    const scale = [];
    let base = 60 + kp; if (base > 66) base -= 12;
    for (let oct = 0; scale.length < 9; oct++) for (const d of [0, 2, 4, 7, 9]) if (scale.length < 9) scale.push(base + oct * 12 + d);
    let idx = Math.round(clamp(height || 0, 0, 1) * (scale.length - 1));
    if (idx === tapState.last && Math.random() < 0.35) idx = clamp(idx + (Math.random() < 0.5 ? -1 : 1), 0, scale.length - 1);
    tapState.last = idx;
    const f = midiFreq(scale[idx]) * Math.pow(2, rand(-6, 6) / 1200);
    const vary = rand(0.85, 1.1), dur = rand(0.2, 0.26);
    if (th.instrument === 'choir') {
      singPart(ac, out, t0, dur, [[pick(['a', 'a', 'o', 'e']), 1, f]], 0, 0.12 * vary);
    } else {
      INSTRUMENTS[th.instrument](ac, out, t0, f, dur, MEL * 0.6 * vary);
    }
    // a quiet shadow on the accent instrument
    if (th.accent === 'organ') organNote(ac, out, t0, f, 0.2, 0.03 * vary);
    else if (th.accent === 'timbrel') timbrel(ac, out, t0, 0, 0.1, PERC * 0.4 * vary, { thump: false });
    else if (th.accent !== th.instrument && th.accent !== 'choir') {
      INSTRUMENTS[th.accent](ac, out, t0 + 0.01, f * (Math.random() < 0.5 ? 1 : 2), dur, MEL * 0.18 * vary);
    }
    return dur + 1.0;
  }

  // Schedules any piece into any context at t0, without reading the clock, and
  // returns its length in seconds
  function render(ac, out, t0, piece, theme, height) {
    const th = normTheme(theme), tune = TUNES[th.tune];
    if (piece === 'tap') return renderTap(ac, out, t0, th, tune, height);
    if (tune.satb && th.instrument === 'choir' && HEAVEN_SCORE[piece]) return renderSatb(ac, out, t0, piece, th, tune);
    if (piece === 'win') return renderWin(ac, out, t0, th, tune);
    if (piece === 'start') return renderStart(ac, out, t0, th, tune);
    if (piece === 'fail') return renderFail(ac, out, t0, th, tune);
    return 0;
  }

  // ------------------------------------------------------------
  //  Ambient beds: each has base(ac, bus, t0, st), which adds looping layers to
  //  st.srcs and st.nodes, and events(ac, bus, from, to, st), which schedules
  //  random sounds inside a time window
  // ------------------------------------------------------------
  function lfoTo(ac, t0, st, param, rate, depth) {
    const l = ac.createOscillator(), g = ac.createGain();
    l.frequency.value = rate; g.gain.value = depth;
    l.connect(g); g.connect(param);
    l.start(t0);
    st.srcs.push(l); st.nodes.push(g);
    return l;
  }
  // looping noise -> filter -> gain -> dest
  function noiseLayer(ac, dest, t0, st, type, freq, q, gain) {
    const n = noiseSource(ac, t0), f = ac.createBiquadFilter(), g = ac.createGain();
    f.type = type; f.frequency.value = freq; f.Q.value = q; g.gain.value = gain;
    n.connect(f); f.connect(g); g.connect(dest);
    st.srcs.push(n); st.nodes.push(f, g);
    return { f, g };
  }
  function blip(ac, dest, t, dur, build) {    // one oscillator event: build(o, g) sets the automation
    const o = ac.createOscillator(), g = ac.createGain();
    g.gain.setValueAtTime(0, t);
    build(o, g);
    o.connect(g); g.connect(dest);
    o.start(t); o.stop(t + dur);
    cleanup(o, [g]);
  }
  function every(st, key, from, to, gap, fn) {  // runs fn(t) at random gaps between from and to
    if (st[key] == null) st[key] = from + gap() * Math.random();
    while (st[key] < to) { if (st[key] >= from - 0.05) fn(st[key]); st[key] += gap(); }
  }

  function gull(ac, dest, t) {
    const calls = 2 + Math.floor(Math.random() * 2), f0 = rand(1100, 1400);
    for (let c = 0; c < calls; c++) {
      const tc = t + c * rand(0.32, 0.45);
      blip(ac, dest, tc, 0.45, (o, g) => {
        o.type = 'triangle';
        o.frequency.setValueAtTime(f0 * 0.8, tc);
        o.frequency.linearRampToValueAtTime(f0 * 1.3, tc + 0.05);
        o.frequency.exponentialRampToValueAtTime(f0 * 0.7, tc + 0.32);
        g.gain.linearRampToValueAtTime(0.016, tc + 0.03);
        g.gain.setTargetAtTime(0, tc + 0.22, 0.05);
      });
    }
  }

  function chirp(ac, dest, t) {
    const kind = pick(['chirp', 'chirp', 'trill', 'whistle']);
    const f0 = pick([2600, 3200, 3900, 4600]) * rand(0.95, 1.05);
    const vol = rand(0.009, 0.02);
    if (kind === 'chirp') {
      const k = 1 + Math.floor(Math.random() * 3);
      blip(ac, dest, t, k * 0.11 + 0.1, (o, g) => {
        for (let i = 0; i < k; i++) {
          const ti = t + i * 0.11;
          o.frequency.setValueAtTime(f0 * 0.8, ti);
          o.frequency.exponentialRampToValueAtTime(f0 * 1.35, ti + 0.05);
          g.gain.setValueAtTime(0, ti);
          g.gain.linearRampToValueAtTime(vol, ti + 0.012);
          g.gain.linearRampToValueAtTime(0, ti + 0.06);
        }
      });
    } else if (kind === 'trill') {
      const k = 6 + Math.floor(Math.random() * 7), step = rand(0.035, 0.05);
      blip(ac, dest, t, k * step + 0.1, (o, g) => {
        for (let i = 0; i < k; i++) {
          const ti = t + i * step;
          o.frequency.setValueAtTime(i % 2 ? f0 * 1.12 : f0, ti);
          g.gain.setValueAtTime(0, ti);
          g.gain.linearRampToValueAtTime(vol * 0.8, ti + 0.01);
          g.gain.linearRampToValueAtTime(0, ti + step * 0.9);
        }
      });
    } else {
      blip(ac, dest, t, 0.7, (o, g) => {       // a sweet two-note "fee-bee"
        o.frequency.setValueAtTime(f0 * 0.9, t);
        o.frequency.linearRampToValueAtTime(f0 * 0.88, t + 0.22);
        o.frequency.setValueAtTime(f0 * 0.72, t + 0.3);
        o.frequency.linearRampToValueAtTime(f0 * 0.7, t + 0.55);
        g.gain.linearRampToValueAtTime(vol, t + 0.04);
        g.gain.setValueAtTime(vol, t + 0.2);
        g.gain.linearRampToValueAtTime(0, t + 0.25);
        g.gain.linearRampToValueAtTime(vol * 0.9, t + 0.33);
        g.gain.setValueAtTime(vol * 0.9, t + 0.5);
        g.gain.linearRampToValueAtTime(0, t + 0.58);
      });
    }
  }

  // A murmuring voice: a sawtooth "larynx" through two moving formant filters, spoken in syllables
  function voice(ac, dest, t, vol) {
    const syl = 2 + Math.floor(Math.random() * 5), sd = rand(0.13, 0.22), dur = syl * sd;
    const o = ac.createOscillator(), f1 = ac.createBiquadFilter(), f2 = ac.createBiquadFilter(), g = ac.createGain();
    o.type = 'sawtooth';
    const p = rand(95, 240);
    o.frequency.setValueAtTime(p, t);
    o.frequency.linearRampToValueAtTime(p * rand(1.05, 1.25), t + dur * 0.4);
    o.frequency.linearRampToValueAtTime(p * rand(0.8, 0.95), t + dur);
    f1.type = f2.type = 'bandpass'; f1.Q.value = 5; f2.Q.value = 7;
    g.gain.setValueAtTime(0, t);
    for (let s = 0; s < syl; s++) {
      const ts = t + s * sd, v = VOWELS[pick(['a', 'e', 'o', 'u', 'i'])];
      f1.frequency.setTargetAtTime(v[0], ts, 0.02);
      f2.frequency.setTargetAtTime(v[1], ts, 0.02);
      g.gain.setTargetAtTime(vol * rand(0.6, 1), ts, 0.02);
      g.gain.setTargetAtTime(0, ts + sd * 0.7, 0.025);
    }
    o.connect(f1); o.connect(f2); f1.connect(g); f2.connect(g); g.connect(dest);
    o.start(t); o.stop(t + dur + 0.2);
    cleanup(o, [f1, f2, g]);
  }

  function clink(ac, dest, t, vol) {
    const f = rand(2200, 3200);
    [[1, 1, 0.12], [2.4, 0.5, 0.07], [3.9, 0.3, 0.05]].forEach(([r, a, tau]) => blip(ac, dest, t, tau * 7, (o, g) => {
      o.frequency.value = f * r;
      g.gain.linearRampToValueAtTime(vol * a, t + 0.002);
      g.gain.setTargetAtTime(0, t + 0.003, tau);
    }));
  }

  const BEDS = {
    sea: {
      base(ac, bus, t0, st) {
        const surf = noiseLayer(ac, bus, t0, st, 'lowpass', 550, 0.7, 0.24);
        const foam = noiseLayer(ac, bus, t0, st, 'bandpass', 2400, 0.5, 0.05);
        noiseLayer(ac, bus, t0, st, 'lowpass', 160, 0.7, 0.25);           // deep rumble
        lfoTo(ac, t0, st, surf.g.gain, 0.085, 0.21);                     // waves swelling
        lfoTo(ac, t0, st, surf.f.frequency, 0.085, 320);
        lfoTo(ac, t0, st, foam.g.gain, 0.11, 0.045);
      },
      events(ac, bus, from, to, st) { every(st, 'gull', from, to, () => rand(6, 14), (t) => gull(ac, bus, t)); },
    },
    wind: {
      base(ac, bus, t0, st) {
        st.gust = ac.createGain(); st.gust.gain.value = 1; st.gust.connect(bus); st.nodes.push(st.gust);
        const w = noiseLayer(ac, st.gust, t0, st, 'bandpass', 520, 0.9, 0.4);
        const wh = noiseLayer(ac, st.gust, t0, st, 'bandpass', 900, 12, 0.25);   // whistle
        lfoTo(ac, t0, st, w.f.frequency, 0.07, 260);
        lfoTo(ac, t0, st, w.g.gain, 0.13, 0.22);
        lfoTo(ac, t0, st, wh.f.frequency, 0.05, 380);
      },
      events(ac, bus, from, to, st) {
        every(st, 'g', from, to, () => rand(5, 10), (t) => {
          st.gust.gain.setTargetAtTime(rand(1.5, 1.9), t, 0.7);
          st.gust.gain.setTargetAtTime(1, t + rand(1.2, 2), 1.1);
        });
      },
    },
    birds: {
      base(ac, bus, t0, st) {
        const b = noiseLayer(ac, bus, t0, st, 'lowpass', 650, 0.7, 0.16);        // soft breeze
        lfoTo(ac, t0, st, b.g.gain, 0.09, 0.07);
      },
      events(ac, bus, from, to, st) { every(st, 'c', from, to, () => rand(0.25, 1.4), (t) => chirp(ac, bus, t)); },
    },
    crowd: {
      base(ac, bus, t0, st) {
        st.vbus = ac.createBiquadFilter(); st.vbus.type = 'lowpass'; st.vbus.frequency.value = 1900;
        st.vbus.connect(bus); st.nodes.push(st.vbus);
        const m = noiseLayer(ac, bus, t0, st, 'bandpass', 480, 0.9, 0.18);
        lfoTo(ac, t0, st, m.g.gain, 0.2, 0.06);
      },
      events(ac, bus, from, to, st) { every(st, 'v', from, to, () => rand(0.15, 0.45), (t) => voice(ac, st.vbus, t, rand(0.016, 0.032))); },
    },
    market: {
      base(ac, bus, t0, st) {
        st.vbus = ac.createBiquadFilter(); st.vbus.type = 'lowpass'; st.vbus.frequency.value = 2200;
        st.vbus.connect(bus); st.nodes.push(st.vbus);
        const m = noiseLayer(ac, bus, t0, st, 'bandpass', 520, 0.8, 0.22);
        lfoTo(ac, t0, st, m.g.gain, 0.25, 0.07);
      },
      events(ac, bus, from, to, st) {
        every(st, 'v', from, to, () => rand(0.08, 0.25), (t) => voice(ac, st.vbus, t, rand(0.016, 0.03)));
        every(st, 'k', from, to, () => rand(1.2, 4), (t) => {
          const n = Math.random() < 0.35 ? 3 : 1;             // sometimes a jingle of coins
          for (let i = 0; i < n; i++) clink(ac, bus, t + i * rand(0.05, 0.09), rand(0.02, 0.035));
        });
      },
    },
    night: {
      base(ac, bus, t0, st) {
        const b = noiseLayer(ac, bus, t0, st, 'lowpass', 380, 0.7, 0.2);
        lfoTo(ac, t0, st, b.g.gain, 0.06, 0.08);
        st.crickets = [rand(4200, 4500), rand(4700, 5000)];
      },
      events(ac, bus, from, to, st) {
        st.crickets.forEach((cf, ci) => every(st, 'k' + ci, from, to, () => rand(0.55, 0.9), (t) => blip(ac, bus, t, 0.14, (o, g) => {
          o.frequency.value = cf;
          for (let p = 0; p < 3; p++) {
            const tp = t + p * 0.032;
            g.gain.setValueAtTime(0, tp);
            g.gain.linearRampToValueAtTime(0.013, tp + 0.004);
            g.gain.linearRampToValueAtTime(0, tp + 0.016);
          }
        })));
        every(st, 'owl', from, to, () => rand(12, 25), (t) => [0, 0.55].forEach((dt, i) => blip(ac, bus, t + dt, 0.6, (o, g) => {
          const tt = t + dt;
          o.frequency.setValueAtTime(390, tt);
          o.frequency.linearRampToValueAtTime(360, tt + 0.4);
          g.gain.linearRampToValueAtTime(i ? 0.012 : 0.009, tt + 0.08);
          g.gain.setTargetAtTime(0, tt + 0.25, 0.07);
        })));
      },
    },
    fire: {
      base(ac, bus, t0, st) {
        const r = noiseLayer(ac, bus, t0, st, 'lowpass', 240, 0.7, 0.35);
        noiseLayer(ac, bus, t0, st, 'bandpass', 1300, 0.7, 0.025);
        lfoTo(ac, t0, st, r.g.gain, 0.35, 0.12);
        st.hp = ac.createBiquadFilter(); st.hp.type = 'highpass'; st.hp.frequency.value = 1400;
        st.hp.connect(bus); st.nodes.push(st.hp);
      },
      events(ac, bus, from, to, st) {
        every(st, 'c', from, to, () => (Math.random() < 0.7 ? rand(0.02, 0.09) : rand(0.2, 0.7)), (t) => {
          const n = noiseSource(ac, t, false), g = ac.createGain();
          const big = Math.random() < 0.08, a = big ? rand(0.12, 0.2) : rand(0.02, 0.09), d = big ? 0.02 : rand(0.003, 0.009);
          g.gain.setValueAtTime(0, t);
          g.gain.linearRampToValueAtTime(a, t + 0.0015);
          g.gain.setTargetAtTime(0, t + 0.002, d);
          n.connect(g); g.connect(st.hp);
          n.stop(t + d * 8 + 0.01);
          cleanup(n, [g]);
        });
      },
    },
  };
  const AMB_LEVEL = 0.5;

  function startBed(ac, out, name, t0, fadeIn) {
    const bed = BEDS[name];
    if (!bed) return null;
    const bus = ac.createGain();
    bus.gain.setValueAtTime(0.0001, t0);
    bus.gain.setTargetAtTime(AMB_LEVEL, t0, fadeIn / 3);
    bus.connect(out);
    const st = { srcs: [], nodes: [bus] };
    bed.base(ac, bus, t0, st);
    const h = {
      name, until: t0, stopped: false, timer: null,
      schedule(to) { if (!h.stopped && to > h.until) { bed.events(ac, bus, h.until, to, st); h.until = to; } },
      stop(t, fade) {
        if (h.stopped) return;
        h.stopped = true;
        if (h.timer) { clearInterval(h.timer); h.timer = null; }
        bus.gain.cancelScheduledValues(t);
        bus.gain.setTargetAtTime(0.0001, t, fade / 4);
        const end = t + fade + 0.1;
        st.srcs.forEach((s) => { try { s.stop(end); } catch (e) { /* not started */ } });
        const first = st.srcs[0];
        if (first) cleanup(first, st.nodes);
      },
    };
    return h;
  }

  // Offline or scheduled: plays a bed for `dur` seconds, fading in and out
  function renderAmbience(ac, out, t0, dur, name, fade = 1.2) {
    const h = startBed(ac, out, name, t0, Math.min(2, dur / 3));
    if (!h) return 0;
    h.schedule(t0 + dur);
    h.stop(t0 + dur - fade, fade);
    return dur;
  }

  // ------------------------------------------------------------
  //  Public API
  // ------------------------------------------------------------
  const DEFAULT_THEME = { tune: 'hallelujah', instrument: 'choir', accent: 'organ', ambience: 'none', percussion: false };

  // Suggested pairings for the kinds of Bible story
  const PRESETS = {
    heaven:    { tune: 'hallelujah', instrument: 'choir', accent: 'organ', ambience: 'none', percussion: false },
    christmas: { tune: 'joyToTheWorld', instrument: 'bells', accent: 'choir', ambience: 'night', percussion: false },
    nativity:  { tune: 'oComeAllYeFaithful', instrument: 'organ', accent: 'choir', ambience: 'night', percussion: false },
    galilee:   { tune: 'amazingGrace', instrument: 'harp', accent: 'strings', ambience: 'sea', percussion: false },
    healing:   { tune: 'amazingGrace', instrument: 'strings', accent: 'harp', ambience: 'crowd', percussion: false },
    parable:   { tune: 'jesusLovesMe', instrument: 'pipe', accent: 'harp', ambience: 'wind', percussion: false },
    harvest:   { tune: 'odeToJoy', instrument: 'strings', accent: 'organ', ambience: 'market', percussion: true },
    feast:     { tune: 'odeToJoy', instrument: 'harp', accent: 'strings', ambience: 'crowd', percussion: true },
    children:  { tune: 'jesusLovesMe', instrument: 'bells', accent: 'harp', ambience: 'birds', percussion: false },
    easter:    { tune: 'hallelujah', instrument: 'choir', accent: 'organ', ambience: 'birds', percussion: false },
    praise:    { tune: 'doxology', instrument: 'organ', accent: 'choir', ambience: 'none', percussion: false },
    night:     { tune: 'amazingGrace', instrument: 'pipe', accent: 'strings', ambience: 'night', percussion: false },
    campfire:  { tune: 'doxology', instrument: 'harp', accent: 'strings', ambience: 'fire', percussion: false },
  };

  const Music = {
    theme: Object.assign({}, DEFAULT_THEME),
    ac: null, out: null,
    tunes: TUNES, instruments: INSTRUMENTS, beds: Object.keys(BEDS).concat('none'), presets: PRESETS,
    noteFreq, voiceChord, odeOpening: ODE_OPENING,
    _bed: null,

    // Call from the game's sfx.init once its AudioContext and master gain exist
    init(ac, dest) {
      if (!ac) return;
      if (this.ac === ac && this.out) { if (dest && dest !== this._dest) { this.out.disconnect(); this.out.connect(dest); this._dest = dest; } return; }
      this.ac = ac;
      this._dest = dest || ac.destination;
      this.out = ac.createGain();
      this.out.gain.value = 1;
      this.out.connect(this._dest);
    },
    _now() { return this.ac.currentTime + 0.05; },
    win() { if (this.ac) return render(this.ac, this.out, this._now(), 'win', this.theme); },
    start() { if (this.ac) return render(this.ac, this.out, this._now(), 'start', this.theme); },
    fail() { if (this.ac) return render(this.ac, this.out, this._now(), 'fail', this.theme); },
    tap(height) { if (this.ac) return render(this.ac, this.out, this.ac.currentTime + 0.01, 'tap', this.theme, height); },

    // Starts (true) or stops (false) the theme's ambient bed, fading in and out
    ambience(on) {
      if (!this.ac) return;
      const ac = this.ac, name = (this.theme && this.theme.ambience) || 'none';
      const cur = this._bed;
      if (on && cur && !cur.stopped && cur.name === name) return;
      if (cur) { cur.stop(ac.currentTime, 1.2); this._bed = null; }
      if (!on || !BEDS[name]) return;
      const h = startBed(ac, this.out, name, ac.currentTime + 0.02, 2.5);
      h.schedule(ac.currentTime + 1.5);
      h.timer = setInterval(() => {
        if (ac.state === 'closed') { h.stop(0, 0.1); return; }
        h.schedule(ac.currentTime + 1.5);
      }, 400);
      this._bed = h;
    },

    render, renderAmbience,
  };

  window.Music = Music;
})();
