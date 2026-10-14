(function () {
  const G = window.G;
  // 외부 파일 없이 Web Audio로 합성. assets/audio/ 에 같은 이름의 mp3를 두면 나중에 교체할 수 있게 이름만 맞춰 둔다.
  let ctx = null;
  let master = null;
  let amb = null;

  function ensure() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = G.settings.sound ? 0.7 : 0;
      master.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  function noise(sec, brown) {
    const len = Math.floor(ctx.sampleRate * sec);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      if (brown) {
        last = (last + 0.02 * w) / 1.02;
        d[i] = last * 3.5;
      } else d[i] = w;
    }
    return buf;
  }

  function env(g, t0, a, peak, dcy) {
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(peak, t0 + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + a + dcy);
  }

  function tone(freq, t0, dur, vol, type) {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type || 'sine';
    o.frequency.value = freq;
    env(g, t0, 0.01, vol, dur);
    o.connect(g).connect(master);
    o.start(t0);
    o.stop(t0 + dur + 0.05);
  }

  function burst(t0, dur, vol, fType, fFreq, q, a) {
    const s = ctx.createBufferSource();
    s.buffer = noise(dur + 0.1, false);
    const f = ctx.createBiquadFilter();
    f.type = fType;
    f.frequency.value = fFreq;
    f.Q.value = q || 1;
    const g = ctx.createGain();
    env(g, t0, a || 0.005, vol, dur);
    s.connect(f).connect(g).connect(master);
    s.start(t0);
    s.stop(t0 + dur + 0.1);
  }

  function startAmbient() {
    if (!ensure() || amb) return;
    const fan = ctx.createBufferSource();
    fan.buffer = noise(6, true);
    fan.loop = true;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 380;
    const fg = ctx.createGain();
    fg.gain.value = 0.16;
    fan.connect(lp).connect(fg).connect(master);
    fan.start();

    const hum = ctx.createOscillator();
    hum.frequency.value = 120;
    const hg = ctx.createGain();
    hg.gain.value = 0.006;
    hum.connect(hg).connect(master);
    hum.start();

    const hum2 = ctx.createOscillator();
    hum2.type = 'triangle';
    hum2.frequency.value = 240;
    const hg2 = ctx.createGain();
    hg2.gain.value = 0.002;
    hum2.connect(hg2).connect(master);
    hum2.start();

    amb = { fan, fg, hum, hg, hum2, hg2 };
  }

  function stopAmbient(fade) {
    if (!amb || !ctx) return;
    const t = ctx.currentTime;
    const parts = amb;
    amb = null;
    [parts.fg, parts.hg, parts.hg2].forEach((g) => {
      g.gain.cancelScheduledValues(t);
      g.gain.setValueAtTime(g.gain.value, t);
      g.gain.linearRampToValueAtTime(0, t + (fade || 0.02));
    });
    setTimeout(() => {
      try {
        parts.fan.stop();
        parts.hum.stop();
        parts.hum2.stop();
      } catch (e) {}
    }, (fade || 0.02) * 1000 + 100);
  }

  const SFX = {
    page(t) {
      burst(t, 0.18, 0.35, 'bandpass', 2600, 0.8, 0.02);
      burst(t + 0.16, 0.12, 0.2, 'bandpass', 3400, 0.8, 0.01);
    },
    ding(t, v) {
      tone(1046, t, 1.4, 0.18 * v, 'sine');
      tone(784, t + 0.32, 1.8, 0.16 * v, 'sine');
    },
    ring(t) {
      for (let i = 0; i < 2; i++) {
        const s = t + i * 0.9;
        for (let k = 0; k < 8; k++) tone(k % 2 ? 480 : 440, s + k * 0.05, 0.05, 0.05, 'square');
      }
    },
    ring4(t) {
      for (let i = 0; i < 4; i++) SFX.ring(t + i * 0.13);
    },
    phone(t) {
      for (let i = 0; i < 2; i++) {
        for (let k = 0; k < 14; k++) tone(k % 2 ? 420 : 380, t + i * 1.6 + k * 0.04, 0.04, 0.05, 'triangle');
      }
    },
    static(t) {
      burst(t, 0.9, 0.22, 'bandpass', 1600, 0.6, 0.03);
    },
    cut(t) {
      stopAmbient(0.01);
      tone(52, t, 0.6, 0.35, 'sine');
    },
    breath(t) {
      burst(t, 1.6, 0.18, 'lowpass', 700, 0.5, 0.9);
      burst(t + 2.2, 1.8, 0.16, 'lowpass', 600, 0.5, 1.0);
    },
    chime(t) {
      [659, 523, 587, 392].forEach((f, i) => tone(f, t + i * 0.7, 1.6, 0.12, 'sine'));
      [392, 587, 659, 523].forEach((f, i) => tone(f, t + 3 + i * 0.7, 1.6, 0.12, 'sine'));
    },
    pen(t) {
      for (let i = 0; i < 5; i++) burst(t + i * 0.11 + Math.random() * 0.04, 0.06, 0.05, 'highpass', 4000, 0.7, 0.005);
    },
    thud(t) {
      tone(70, t, 0.4, 0.25, 'sine');
    },
  };

  G.audio = {
    unlock() {
      ensure();
    },
    ambient(on) {
      if (on) startAmbient();
      else stopAmbient(1.5);
    },
    sfx(name, vol) {
      if (!G.settings.sound || !ensure() || !SFX[name]) return;
      try {
        SFX[name](ctx.currentTime + 0.02, vol == null ? 1 : vol);
      } catch (e) {}
    },
    setEnabled(on) {
      if (!ensure()) return;
      master.gain.setTargetAtTime(on ? 0.7 : 0, ctx.currentTime, 0.05);
    },
  };
})();
