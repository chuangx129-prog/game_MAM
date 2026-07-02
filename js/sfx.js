// ============ WebAudio 合成音效(占位,后续可换真实音效) ============
const SFX = (() => {
  let ctx = null;
  function ensure() {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume();
  }
  function beep(freq = 440, dur = 0.1, type = 'sine', vol = 0.12, slide = 0) {
    try {
      ensure();
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = type; o.frequency.value = freq;
      if (slide) o.frequency.linearRampToValueAtTime(Math.max(30, freq + slide), ctx.currentTime + dur);
      g.gain.value = vol;
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
      o.connect(g).connect(ctx.destination);
      o.start(); o.stop(ctx.currentTime + dur + 0.02);
    } catch (e) { /* 音频不可用时静默 */ }
  }
  function noiseBurst(dur = 0.3, vol = 0.12) {
    try {
      ensure();
      const n = (ctx.sampleRate * dur) | 0;
      const buf = ctx.createBuffer(1, n, ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
      const s = ctx.createBufferSource(); s.buffer = buf;
      const g = ctx.createGain(); g.gain.value = vol;
      s.connect(g).connect(ctx.destination); s.start();
    } catch (e) { /* ignore */ }
  }
  const later = (ms, fn) => setTimeout(fn, ms);

  // ---- 追逐恐怖 BGM:低音蜂鸣 + 心跳 + 不和谐高音 ----
  let chaseBgm = null;
  function startChase() {
    try {
      ensure();
      if (chaseBgm) return;
      const g = ctx.createGain(); g.gain.value = 0.045; g.connect(ctx.destination);
      const o1 = ctx.createOscillator(); o1.type = 'sawtooth'; o1.frequency.value = 52;
      const o2 = ctx.createOscillator(); o2.type = 'sawtooth'; o2.frequency.value = 55.7; // 失谐制造不安
      const lfo = ctx.createOscillator(); lfo.frequency.value = 2.3;
      const lg = ctx.createGain(); lg.gain.value = 0.03;
      lfo.connect(lg); lg.connect(g.gain);
      o1.connect(g); o2.connect(g);
      o1.start(); o2.start(); lfo.start();
      const hb = setInterval(() => { beep(62, 0.1, 'sine', 0.3); later(150, () => beep(55, 0.09, 'sine', 0.2)); }, 620);
      const sting = setInterval(() => beep(660, 0.5, 'triangle', 0.035, -140), 2400);
      chaseBgm = { g, o1, o2, lfo, hb, sting };
    } catch (e) { /* ignore */ }
  }
  function stopChase() {
    if (!chaseBgm) return;
    try { chaseBgm.o1.stop(); chaseBgm.o2.stop(); chaseBgm.lfo.stop(); chaseBgm.g.disconnect(); } catch (e) { /* ignore */ }
    clearInterval(chaseBgm.hb); clearInterval(chaseBgm.sting);
    chaseBgm = null;
  }

  // ---- 合成迪斯科节拍(跳舞 BGM 的兜底)----
  let danceBeat = null;
  function startDance() {
    try {
      ensure();
      if (danceBeat) return;
      let step = 0;
      danceBeat = setInterval(() => {
        beep(58, 0.09, 'sine', 0.3);                                // 底鼓
        if (step % 2 === 1) beep(2400, 0.03, 'square', 0.05);       // 镲
        if (step % 4 === 2) beep(220, 0.1, 'sawtooth', 0.08, 60);   // 贝斯
        step++;
      }, 250);
    } catch (e) { /* ignore */ }
  }
  function stopDance() {
    if (danceBeat) { clearInterval(danceBeat); danceBeat = null; }
  }

  return {
    startChase, stopChase, startDance, stopDance,
    knock() { noiseBurst(0.12, 0.25); beep(90, 0.15, 'sine', 0.3, -30); },
    unlock: ensure,
    kickWarn() { beep(110, 0.25, 'sawtooth', 0.2); },                       // 真踢预警:低沉
    fakeWarn() { beep(330, 0.18, 'sine', 0.09, -60); },                     // 翻身:轻柔
    dodge()    { beep(520, 0.08, 'square', 0.07, 240); },
    hurt()     { noiseBurst(0.22, 0.18); beep(150, 0.2, 'sawtooth', 0.14, -70); },
    star()     { beep(880, 0.09, 'sine', 0.09, 120); later(80, () => beep(1320, 0.12, 'sine', 0.07)); },
    step()     { beep(190, 0.03, 'triangle', 0.03); },
    meow()     { beep(700, 0.12, 'sine', 0.08, 160); later(130, () => beep(920, 0.16, 'sine', 0.06, -240)); },
    flush()    { noiseBurst(0.8, 0.14); },
    ding()     { beep(1180, 0.25, 'sine', 0.1); },
    heart()    { beep(70, 0.1, 'sine', 0.24); later(180, () => beep(60, 0.1, 'sine', 0.18)); },
    icecream() { beep(523, 0.1, 'sine', 0.09); later(110, () => beep(659, 0.1, 'sine', 0.09)); later(220, () => beep(784, 0.16, 'sine', 0.09)); },
    buy()      { beep(600, 0.06, 'square', 0.06, 100); later(70, () => beep(900, 0.1, 'square', 0.05)); },
    cough()    { noiseBurst(0.15, 0.12); later(220, () => noiseBurst(0.18, 0.14)); },
  };
})();
