/* 웨일리 게임 소리 — 배경음악(직접 작곡한 칩튠·마림바 루프)과 효과음을 WebAudio로 실시간 합성합니다.
   음원 파일이 없어서 가볍고, 템포를 게임 속도에 맞춰 바꿀 수 있어요.
   window.WSOUND = { ctx, sfx: {...}, music: { play(name), stop(), tempo(x), duck(ms), toggle(), isOn() } } */
(function () {
  let ac = null, master, musicBus, sfxBus, delay, noiseBuf;
  const LS = 'whaley-sound:music';
  let musicOn = true;
  try { musicOn = localStorage.getItem(LS) !== 'off'; } catch (e) {}

  function ctx() {
    if (!ac) {
      try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return null; }
      const comp = ac.createDynamicsCompressor();
      comp.threshold.value = -14; comp.ratio.value = 4; comp.attack.value = .003; comp.release.value = .2;
      master = ac.createGain(); master.gain.value = .9; master.connect(comp); comp.connect(ac.destination);
      musicBus = ac.createGain(); musicBus.gain.value = musicOn ? .34 : 0; musicBus.connect(master);
      sfxBus = ac.createGain(); sfxBus.gain.value = .85; sfxBus.connect(master);
      // 효과음에 살짝 울림(에코)을 더해 반짝이는 느낌
      delay = ac.createDelay(); delay.delayTime.value = .13;
      const fb = ac.createGain(); fb.gain.value = .28; const wet = ac.createGain(); wet.gain.value = .22;
      const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 3200;
      delay.connect(lp); lp.connect(fb); fb.connect(delay); lp.connect(wet); wet.connect(master);
      noiseBuf = ac.createBuffer(1, ac.sampleRate * 1, ac.sampleRate);
      const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    if (ac.state === 'suspended') ac.resume();
    return ac;
  }
  const mf = (m) => 440 * Math.pow(2, (m - 69) / 12);

  /* ── 소리 재료 ── */
  function osc(bus, t, f, d, type, vol, o) {
    o = o || {};
    const a = ac, os = a.createOscillator(), g = a.createGain();
    os.type = type; os.frequency.setValueAtTime(f, t);
    if (o.slide) os.frequency.exponentialRampToValueAtTime(o.slide, t + (o.slideT || d));
    if (o.detune) os.detune.value = o.detune;
    if (o.vib) { const l = a.createOscillator(), lg = a.createGain(); l.frequency.value = o.vib; lg.gain.value = f * .03; l.connect(lg); lg.connect(os.frequency); l.start(t); l.stop(t + d + .05); }
    const at = o.attack || .005;
    g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + at); g.gain.exponentialRampToValueAtTime(.0001, t + d);
    let out = g;
    if (o.lp) { const f2 = a.createBiquadFilter(); f2.type = 'lowpass'; f2.frequency.value = o.lp; g.connect(f2); out = f2; }
    os.connect(g); out.connect(bus); if (o.echo) out.connect(delay);
    os.start(t); os.stop(t + d + .05);
  }
  function noise(bus, t, d, vol, type, freq, o) {
    o = o || {};
    const a = ac, s = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain();
    s.buffer = noiseBuf; f.type = type || 'bandpass'; f.frequency.setValueAtTime(freq || 2000, t);
    if (o.sweep) f.frequency.exponentialRampToValueAtTime(o.sweep, t + d);
    if (o.q) f.Q.value = o.q;
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.0001, t + d);
    s.connect(f); f.connect(g); g.connect(bus); if (o.echo) g.connect(delay);
    s.start(t); s.stop(t + d + .02);
  }

  /* ── 효과음 ── */
  const now = () => (ctx() ? ac.currentTime : 0);
  let stepN = 0;
  const S = {
    // 계단 한 칸: 통통 튀는 칩튠 점프 (연속으로 오를수록 음이 올라가요)
    jump() { if (!ctx()) return; const t = now(), k = [0, 2, 4, 5, 7, 9, 11, 12][stepN++ % 8];
      osc(sfxBus, t, mf(72 + k), .11, 'square', .09, { slide: mf(84 + k), slideT: .06, lp: 4000 });
      noise(sfxBus, t, .03, .05, 'highpass', 6000); },
    resetSteps() { stepN = 0; },
    ok() { if (!ctx()) return; const t = now();
      [76, 81, 88].forEach((m, i) => osc(sfxBus, t + i * .055, mf(m), .22, 'triangle', .16, { echo: true }));
      osc(sfxBus, t + .12, mf(100), .25, 'sine', .05, { echo: true });
      noise(sfxBus, t, .08, .04, 'highpass', 8000, { echo: true }); },
    bad() { if (!ctx()) return; const t = now();
      osc(sfxBus, t, 240, .32, 'sawtooth', .09, { slide: 90, lp: 1400 });
      osc(sfxBus, t + .02, 252, .3, 'square', .05, { slide: 100, lp: 900 });
      osc(sfxBus, t, 90, .18, 'sine', .25, { slide: 45 }); },
    coin() { if (!ctx()) return; const t = now();
      osc(sfxBus, t, mf(83), .07, 'square', .07, { lp: 6000 }); osc(sfxBus, t + .06, mf(88), .28, 'square', .07, { lp: 6000, echo: true }); },
    fall() { if (!ctx()) return; const t = now();
      osc(sfxBus, t, 1100, .75, 'sine', .12, { slide: 140, vib: 9 });
      osc(sfxBus, t + .7, 70, .3, 'sine', .35, { slide: 35 }); noise(sfxBus, t + .7, .25, .18, 'lowpass', 900); },
    win() { if (!ctx()) return; const t = now();
      [72, 76, 79, 84].forEach((m, i) => osc(sfxBus, t + i * .1, mf(m), .2, 'square', .07, { lp: 5000 }));
      [72, 76, 79, 84, 88].forEach((m) => osc(sfxBus, t + .42, mf(m), .9, 'triangle', .09, { echo: true }));
      noise(sfxBus, t + .42, .5, .06, 'highpass', 7000, { echo: true }); },
    splash() { if (!ctx()) return; const t = now();
      noise(sfxBus, t, .45, .3, 'lowpass', 2600, { sweep: 300 });
      for (let i = 0; i < 5; i++) osc(sfxBus, t + .08 + i * .06, 500 + Math.random() * 700, .07, 'sine', .07, { slide: 1500 + Math.random() * 800 }); },
    pop() { if (!ctx()) return; const t = now();
      osc(sfxBus, t, 380, .09, 'sine', .25, { slide: 1500, slideT: .05 }); noise(sfxBus, t, .03, .12, 'highpass', 3000);
      osc(sfxBus, t + .05, mf(96), .15, 'sine', .04, { echo: true }); },
    bonk() { if (!ctx()) return; const t = now();
      osc(sfxBus, t, 820, .08, 'sine', .22, { slide: 420 }); noise(sfxBus, t, .05, .15, 'bandpass', 1200, { q: 4 });
      osc(sfxBus, t, 160, .15, 'sine', .2, { slide: 80 }); },
    whoosh() { if (!ctx()) return; const t = now(); noise(sfxBus, t, .45, .16, 'bandpass', 400, { sweep: 3500, q: 1.2 }); },
    wob() { if (!ctx()) return; const t = now(); osc(sfxBus, t, 330, .22, 'triangle', .12, { slide: 520, vib: 14 }); },
    catch() { if (!ctx()) return; const t = now();
      [72, 76, 79, 84, 88].forEach((m, i) => osc(sfxBus, t + i * .08, mf(m), .3, 'square', .06, { lp: 5000, echo: true }));
      [76, 79, 84].forEach((m) => osc(sfxBus, t + .45, mf(m), 1, 'triangle', .08, { echo: true })); },
    click() { if (!ctx()) return; const t = now(); osc(sfxBus, t, 1400, .04, 'square', .04, { lp: 5000 }); },
  };

  /* ── 배경음악 (모두 새로 지은 곡) ── */
  // mel: 16칸(16분음표) 한 마디, 0 = 쉼. ch: 그 마디 화음(MIDI). 같은 곡을 계속 돌려요.
  const C = [48, 52, 55], G = [43, 47, 50], Am = [45, 48, 52], F = [41, 45, 48], Dm = [50, 53, 57], E = [40, 44, 47];
  const TRACKS = {
    // 계단: 빠르고 통통 튀는 칩튠 (점수가 오를수록 템포 UP)
    stairs: { bpm: 150, lead: 'chip', bass: 'octave', drums: 'four', bars: [
      [C, [72, 0, 76, 0, 79, 0, 76, 79, 84, 0, 79, 0, 76, 0, 79, 0]],
      [G, [74, 0, 79, 0, 83, 0, 79, 83, 86, 0, 83, 0, 79, 0, 74, 0]],
      [Am, [72, 0, 76, 0, 81, 0, 76, 81, 84, 0, 81, 0, 79, 0, 76, 0]],
      [F, [77, 0, 81, 0, 84, 0, 81, 84, 86, 0, 84, 0, 81, 0, 79, 0]],
      [C, [84, 0, 83, 84, 0, 79, 0, 76, 0, 79, 0, 84, 0, 86, 0, 88]],
      [G, [86, 0, 83, 0, 79, 0, 83, 86, 0, 91, 0, 86, 0, 83, 0, 79]],
      [F, [81, 0, 84, 0, 88, 0, 84, 81, 77, 0, 81, 0, 84, 0, 81, 77]],
      [G, [79, 0, 83, 0, 86, 0, 83, 79, 74, 0, 79, 0, 83, 0, 86, 0]]] },
    // 웨일리 런: 바닷가 느낌 마림바
    run: { bpm: 124, lead: 'marimba', bass: 'sync', drums: 'tropical', bars: [
      [C, [76, 0, 79, 0, 0, 81, 0, 79, 0, 76, 0, 72, 0, 74, 76, 0]],
      [Am, [76, 0, 72, 0, 0, 69, 0, 72, 0, 76, 0, 79, 0, 81, 0, 0]],
      [F, [77, 0, 81, 0, 0, 84, 0, 81, 0, 77, 0, 81, 0, 79, 77, 0]],
      [G, [79, 0, 0, 83, 0, 86, 0, 0, 83, 0, 79, 0, 74, 0, 79, 0]]] },
    // 문장 오비: 두근두근 모험
    obby: { bpm: 132, lead: 'pulse', bass: 'drive', drums: 'adventure', bars: [
      [Am, [69, 0, 72, 76, 0, 72, 76, 81, 0, 79, 0, 76, 0, 72, 0, 74]],
      [F, [72, 0, 77, 81, 0, 77, 81, 84, 0, 81, 0, 79, 0, 77, 0, 76]],
      [C, [76, 0, 79, 84, 0, 79, 84, 88, 0, 86, 0, 84, 0, 79, 0, 81]],
      [E, [80, 0, 83, 0, 88, 0, 83, 80, 0, 76, 0, 80, 0, 83, 0, 0]]] },
    // 바다 친구 잡기(파닉스·240): 귀여운 종소리
    sea: { bpm: 112, lead: 'bell', bass: 'half', drums: 'soft', bars: [
      [F, [81, 0, 0, 84, 0, 0, 89, 0, 88, 0, 84, 0, 81, 0, 0, 0]],
      [Dm, [86, 0, 0, 84, 0, 0, 81, 0, 77, 0, 81, 0, 84, 0, 0, 0]],
      [[46, 50, 53], [82, 0, 0, 86, 0, 0, 89, 0, 91, 0, 89, 0, 86, 0, 0, 0]],
      [[48, 52, 55], [84, 0, 0, 0, 79, 0, 0, 0, 84, 0, 86, 0, 88, 0, 0, 0]]] },
  };

  function playStep(tr, bar, s, t, sd) {
    const [ch, mel] = tr.bars[bar], root = ch[0], m = mel[s];
    // 멜로디
    if (m) {
      if (tr.lead === 'chip') { osc(musicBus, t, mf(m), sd * .9, 'square', .07, { lp: 3800 }); osc(musicBus, t, mf(m), sd * .9, 'square', .03, { detune: 8, lp: 2500 }); }
      else if (tr.lead === 'marimba') { osc(musicBus, t, mf(m), .28, 'sine', .2); osc(musicBus, t, mf(m) * 4, .06, 'sine', .05); }
      else if (tr.lead === 'pulse') { osc(musicBus, t, mf(m), sd * 1.6, 'square', .055, { lp: 2600 }); osc(musicBus, t, mf(m - 12), sd * 1.6, 'triangle', .05); }
      else if (tr.lead === 'bell') { osc(musicBus, t, mf(m), .7, 'sine', .14); osc(musicBus, t, mf(m) * 2.76, .25, 'sine', .03); }
    }
    // 화음 반주
    if (tr.lead === 'chip' && s % 4 === 2) ch.forEach((n) => osc(musicBus, t, mf(n + 24), sd * .7, 'square', .016, { lp: 2000 }));
    if (tr.lead === 'marimba' && (s === 2 || s === 6 || s === 10 || s === 14)) ch.forEach((n) => osc(musicBus, t, mf(n + 12), .18, 'sine', .05));
    if (tr.lead === 'bell' && s % 8 === 0) ch.forEach((n) => osc(musicBus, t, mf(n + 12), sd * 7, 'triangle', .03, { attack: .04 }));
    if (tr.lead === 'pulse' && s % 4 === 0) ch.forEach((n) => osc(musicBus, t, mf(n + 12), sd * 3, 'sawtooth', .012, { lp: 1500 }));
    // 베이스
    if (tr.bass === 'octave' && s % 2 === 0) osc(musicBus, t, mf(root - 12 + (s % 4 === 2 ? 12 : 0)), sd * 1.6, 'triangle', .2);
    if (tr.bass === 'sync' && [0, 3, 6, 8, 11, 14].includes(s)) osc(musicBus, t, mf(root - 12 + (s === 6 || s === 14 ? 7 : 0)), sd * 2, 'triangle', .22);
    if (tr.bass === 'drive' && s % 2 === 0) osc(musicBus, t, mf(root - 12), sd * 1.5, 'sawtooth', .07, { lp: 600 });
    if (tr.bass === 'half' && (s === 0 || s === 8)) osc(musicBus, t, mf(root - 12 + (s ? 7 : 0)), sd * 6, 'triangle', .18);
    // 드럼
    const kick = (v) => osc(musicBus, t, 150, .14, 'sine', v || .5, { slide: 42, slideT: .12 });
    const snare = (v) => { noise(musicBus, t, .13, v || .16, 'bandpass', 1900, { q: .8 }); osc(musicBus, t, 190, .08, 'triangle', .07); };
    const hat = (v) => noise(musicBus, t, .03, v || .06, 'highpass', 8000);
    if (tr.drums === 'four') { if (s % 4 === 0) kick(); if (s === 4 || s === 12) snare(); if (s % 2 === 1) hat(); }
    if (tr.drums === 'tropical') { if (s === 0 || s === 10) kick(.4); if (s === 4 || s === 12) noise(musicBus, t, .07, .12, 'bandpass', 2500, { q: 2 }); noise(musicBus, t, .04, s % 2 ? .035 : .02, 'bandpass', 6500); }
    if (tr.drums === 'adventure') { if (s === 0 || s === 6 || s === 8) kick(.45); if (s === 4 || s === 12) snare(.13); if (s % 2 === 0) hat(.04); if (s === 14) osc(musicBus, t, 220, .15, 'sine', .15, { slide: 110 }); }
    if (tr.drums === 'soft') { if (s === 0 || s === 8) kick(.25); if (s === 4 || s === 12) noise(musicBus, t, .08, .07, 'bandpass', 3000, { q: 1.5 }); if (s % 2 === 1) hat(.025); }
  }

  let cur = null, timer = 0, nextT = 0, step = 0, mult = 1;
  function sched() {
    if (!cur || !ac) return;
    const sd = 60 / (cur.bpm * mult) / 4;
    while (nextT < ac.currentTime + .15) {
      const bar = Math.floor(step / 16) % cur.bars.length;
      playStep(cur, bar, step % 16, nextT, sd);
      nextT += sd; step++;
    }
  }
  const music = {
    play(name) {
      if (!ctx() || !TRACKS[name]) return;
      if (cur === TRACKS[name] && timer) return;
      music.stop(); cur = TRACKS[name]; mult = 1; step = 0; nextT = ac.currentTime + .08;
      musicBus.gain.cancelScheduledValues(ac.currentTime); musicBus.gain.setValueAtTime(musicOn ? .34 : 0, ac.currentTime);
      timer = setInterval(sched, 25); sched();
    },
    stop() { clearInterval(timer); timer = 0; cur = null; },
    tempo(x) { mult = Math.max(.7, Math.min(1.6, x || 1)); },
    // 원어민 소리가 나올 때 음악을 잠깐 줄여요
    duck(ms) { if (!ac || !musicOn) return; const t = ac.currentTime; musicBus.gain.cancelScheduledValues(t); musicBus.gain.setValueAtTime(musicBus.gain.value, t); musicBus.gain.linearRampToValueAtTime(.09, t + .08); musicBus.gain.setValueAtTime(.09, t + (ms || 1200) / 1000); musicBus.gain.linearRampToValueAtTime(.34, t + (ms || 1200) / 1000 + .4); },
    toggle() { musicOn = !musicOn; try { localStorage.setItem(LS, musicOn ? 'on' : 'off'); } catch (e) {} if (ac) musicBus.gain.setValueAtTime(musicOn ? .34 : 0, ac.currentTime); return musicOn; },
    isOn: () => musicOn,
  };
  document.addEventListener('visibilitychange', () => { if (!ac) return; if (document.hidden) ac.suspend(); else ac.resume(); });
  window.WSOUND = { ctx, sfx: S, music };
})();
