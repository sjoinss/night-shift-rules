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

  // 형광등 안정기가 붙는 '지잉': 120Hz 톱니파를 낮게 거른다
  function buzz(t0, dur, vol, hold) {
    const o = ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.value = 120;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 700;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + 0.02);
    if (hold) g.gain.setValueAtTime(vol, t0 + hold);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + (hold || 0.02) + dur);
    o.connect(lp).connect(g).connect(master);
    o.start(t0);
    o.stop(t0 + (hold || 0.02) + dur + 0.05);
  }

  const SFX = {
    // 벽 스위치를 올리는 딸깍
    lampClick(t) {
      burst(t, 0.03, 0.3, 'highpass', 2500, 0.7, 0.002);
      tone(160, t, 0.06, 0.12, 'sine');
    },
    // 점등관이 튀는 틱, 잠깐 붙었다 떨어지는 지잉
    lampTick(t) {
      burst(t, 0.025, 0.14, 'bandpass', 3200, 1.5, 0.002);
      buzz(t, 0.1, 0.05);
    },
    // 불이 나가는 틱. 형광등 웅 소리도 같이 끊겼다가 돌아온다
    lampCut(t) {
      burst(t, 0.02, 0.1, 'highpass', 2500, 0.7, 0.002);
      if (!amb) return;
      [[amb.hg, 0.006], [amb.hg2, 0.002]].forEach(([g, v]) => {
        g.gain.cancelScheduledValues(t);
        g.gain.setValueAtTime(0, t);
        g.gain.setValueAtTime(v, t + 1.33);
      });
    },
    // 마지막 하나가 붙는다: 틱, 그리고 웅 소리가 한 번 부풀었다가 늘 듣던 소리로 가라앉는다
    lampOn(t) {
      burst(t, 0.025, 0.16, 'bandpass', 3200, 1.5, 0.002);
      buzz(t, 2.4, 0.06, 0.25);
      tone(240, t, 2.2, 0.012, 'triangle');
    },
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
    // 파쇄기 칼날: 낮은 갈림 + 종이 찢기는 소리
    grind(t, v) {
      burst(t, 0.2, 0.14 * v, 'lowpass', 900, 0.7, 0.01);
      burst(t + 0.03, 0.14, 0.05 * v, 'bandpass', 3200, 2, 0.005);
      tone(58 + Math.random() * 8, t, 0.18, 0.04 * v, 'sawtooth');
    },
    rewind(t, v) {
      burst(t, 0.14, 0.06 * v, 'bandpass', 2400, 4, 0.01);
      tone(1900 + Math.random() * 300, t, 0.1, 0.008 * v, 'square');
    },
    // 갈리는 소리 사이에 섞이는 아이 대답. 성대처럼 톱니파를 모음 대역으로 거른다
    voiceHi(t, v) {
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(330, t);
      o.frequency.linearRampToValueAtTime(290, t + 0.32);
      const g = ctx.createGain();
      env(g, t, 0.04, 0.22 * v, 0.34);
      [500, 1850, 2600].forEach((f, i) => {
        const bp = ctx.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.value = f;
        bp.Q.value = 9;
        const k = ctx.createGain();
        k.gain.value = [1, 0.5, 0.25][i];
        o.connect(bp).connect(k).connect(g);
      });
      g.connect(master);
      o.start(t);
      o.stop(t + 0.45);
    },
    // 위층 바닥을 걷는 발소리
    steps(t, v) {
      for (let i = 0; i < 5; i++) {
        const d = t + i * 0.46 + Math.random() * 0.05;
        tone(62 + Math.random() * 10, d, 0.14, 0.16 * v, 'sine');
        burst(d, 0.06, 0.05 * v, 'lowpass', 500, 0.7, 0.004);
      }
    },
    // 동틀 무렵 참새 몇 마리. 짧게 올라갔다 내려오는 휘파람 소리
    birds(t, v) {
      const chirp = (s, f0, f1, d, vol) => {
        const o = ctx.createOscillator();
        o.frequency.setValueAtTime(f0, s);
        o.frequency.exponentialRampToValueAtTime(f1, s + d);
        const g = ctx.createGain();
        env(g, s, 0.008, vol, d);
        o.connect(g).connect(master);
        o.start(s);
        o.stop(s + d + 0.05);
      };
      const s0 = t + 0.6;
      [
        [0, 3800, 4700, 0.06],
        [0.1, 4300, 3500, 0.08],
        [0.22, 3900, 4800, 0.05],
        [1.5, 3500, 4400, 0.07],
        [1.62, 4200, 3400, 0.09],
        [2.6, 4000, 4900, 0.05],
      ].forEach(([d, a, b, len]) => chirp(s0 + d, a, b, len, 0.045 * v));
    },
    // 비상등 안정기가 붙는 낮은 웅
    emergOn(t) {
      const o = ctx.createOscillator();
      o.type = 'triangle';
      o.frequency.value = 100;
      const g = ctx.createGain();
      env(g, t, 0.6, 0.03, 1.4);
      o.connect(g).connect(master);
      o.start(t);
      o.stop(t + 2.1);
    },
    // 쇠 손잡이가 잠금쇠에 걸리는 덜컥
    handle(t, v) {
      burst(t, 0.04, 0.25 * v, 'bandpass', 1500, 3, 0.003);
      burst(t + 0.07, 0.05, 0.18 * v, 'bandpass', 1100, 3, 0.003);
      tone(240, t, 0.08, 0.06 * v, 'triangle');
    },
    rattle(t, v) {
      SFX.handle(t, v);
      SFX.handle(t + 0.45, v);
    },
    // 경첩이 천천히 우는 소리
    creak(t, v) {
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(180, t);
      o.frequency.linearRampToValueAtTime(120, t + 1.4);
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 600;
      bp.Q.value = 4;
      const g = ctx.createGain();
      env(g, t, 0.3, 0.05 * v, 1.2);
      o.connect(bp).connect(g).connect(master);
      o.start(t);
      o.stop(t + 1.6);
    },
    // 계단 철문이 닫히는 쾅. 쇠판이 조금 울린다
    slam(t, v) {
      tone(55, t, 0.7, 0.35 * v, 'sine');
      burst(t, 0.25, 0.25 * v, 'lowpass', 900, 0.7, 0.003);
      tone(420, t, 1.2, 0.03 * v, 'triangle');
      tone(611, t, 1.0, 0.02 * v, 'triangle');
    },
    // 열쇠끼리 부딪는 짤랑
    keys(t, v) {
      for (let i = 0; i < 5; i++) tone(2200 + Math.random() * 1400, t + i * 0.06 + Math.random() * 0.03, 0.25, 0.03 * v, 'triangle');
    },
    // 잠긴 유리문을 두 번 흔드는 소리
    glass(t, v) {
      [0, 0.35].forEach((d) => {
        for (let k = 0; k < 3; k++) burst(t + d + k * 0.045, 0.03, 0.1 * v, 'bandpass', 2800, 2, 0.002);
        tone(1300, t + d, 0.15, 0.02 * v, 'triangle');
      });
    },
    // 지하에서 올라오는 공회전
    engine(t, v) {
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(30, t);
      o.frequency.linearRampToValueAtTime(42, t + 0.4);
      o.frequency.linearRampToValueAtTime(38, t + 3);
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 220;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.14 * v, t + 0.35);
      g.gain.setValueAtTime(0.14 * v, t + 2.4);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 3.4);
      o.connect(lp).connect(g).connect(master);
      o.start(t);
      o.stop(t + 3.5);
    },
    // 냉장고 압축기가 한 번 몸을 떨고 멎는다
    fridge(t, v) {
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = 50;
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 300;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.08 * v, t);
      g.gain.setValueAtTime(0.08 * v, t + 0.6);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 1.1);
      o.connect(lp).connect(g).connect(master);
      o.start(t);
      o.stop(t + 1.2);
      tone(70, t + 0.6, 0.3, 0.15 * v, 'sine');
    },
    knock(t, v) {
      [0, 0.42].forEach((d) => {
        tone(95, t + d, 0.18, 0.3 * v, 'sine');
        burst(t + d, 0.05, 0.12 * v, 'lowpass', 1200, 0.7, 0.002);
      });
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
