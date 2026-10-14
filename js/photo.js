(function () {
  const G = window.G;
  // 오른쪽 사진 패널. 장면은 전부 캔버스로 그리고, 마지막에 흑백 → 카키 듀오톤으로 덮는다.
  // 실제 사진으로 바꾸려면 G.data.photoFiles = { lobby: 'assets/img/lobby.jpg' } 처럼 지정한다 (CSS 필터로 같은 톤 적용).
  const W = 600;
  const H = 1000;

  const PAL = {
    khaki: [[14, 19, 16], [70, 76, 61], [198, 192, 158]],
    red: [[10, 2, 1], [92, 28, 19], [216, 158, 134]],
  };

  const canvas = (w, h) => {
    const c = document.createElement('canvas');
    c.width = w || W;
    c.height = h || H;
    return c;
  };
  const gs = (v) => {
    v = Math.max(0, Math.min(255, Math.round(v)));
    return `rgb(${v},${v},${v})`;
  };
  function rng(seed) {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // ───────── 원근 ─────────
  function Cam(o) {
    const f = o.f || 420;
    const cx = o.cx != null ? o.cx : W / 2;
    const cy = o.cy != null ? o.cy : H * 0.5;
    const eye = o.eye || 1.55;
    const P = (x, y, z) => [cx + (f * x) / z, cy - (f * (y - eye)) / z];
    P.f = f;
    return P;
  }
  function poly(ctx, P, pts, fill) {
    ctx.beginPath();
    pts.forEach((p, i) => {
      const s = P(p[0], p[1], p[2]);
      if (i) ctx.lineTo(s[0], s[1]);
      else ctx.moveTo(s[0], s[1]);
    });
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
  }
  function line(ctx, P, a, b, stroke, w) {
    const s = P(a[0], a[1], a[2]);
    const e = P(b[0], b[1], b[2]);
    ctx.beginPath();
    ctx.moveTo(s[0], s[1]);
    ctx.lineTo(e[0], e[1]);
    ctx.strokeStyle = stroke;
    ctx.lineWidth = w || 1;
    ctx.stroke();
  }
  function glow(ctx, x, y, r, a, sy) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.translate(x, y);
    ctx.scale(1, sy || 1);
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
    g.addColorStop(0, `rgba(255,255,255,${a})`);
    g.addColorStop(0.35, `rgba(255,255,255,${a * 0.35})`);
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(-r, -r, r * 2, r * 2);
    ctx.restore();
  }
  // 벽면에 붙은 직사각형 (x 고정)
  const wallRect = (x, y0, y1, z0, z1) => [[x, y0, z0], [x, y1, z0], [x, y1, z1], [x, y0, z1]];
  // 정면 직사각형 (z 고정)
  const faceRect = (x0, x1, y0, y1, z) => [[x0, y0, z], [x1, y0, z], [x1, y1, z], [x0, y1, z]];

  // ───────── 상자형 공간: 복도, 로비, 주차장 ─────────
  function room(ctx, o) {
    const P = Cam(o);
    const hw = o.w / 2;
    const h = o.h;
    const z0 = o.z0 || 0.6;
    const z1 = o.z1;
    const lights = o.lights || [];
    const amb = o.amb == null ? 0.04 : o.amb;
    const lum = (z) => {
      let l = amb;
      lights.forEach((L) => {
        if (L.on) l += (L.on * (L.p || 1)) / (1 + (z - L.z) * (z - L.z) * 0.22);
      });
      return Math.min(1.2, l) / (1 + z * (o.fog || 0.02));
    };
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H);
    const dz = 0.2;
    for (let z = z0; z < z1; z += dz) {
      const za = z;
      const zb = Math.min(z1, z + dz);
      const l = lum(z + dz / 2) * 255;
      poly(ctx, P, [[-hw, 0, za], [hw, 0, za], [hw, 0, zb], [-hw, 0, zb]], gs(l * (o.floorK || 0.5)));
      poly(ctx, P, [[-hw, h, za], [hw, h, za], [hw, h, zb], [-hw, h, zb]], gs(l * (o.ceilK || 0.45)));
      poly(ctx, P, wallRect(-hw, 0, h, za, zb), gs(l * (o.wallK || 0.72)));
      poly(ctx, P, wallRect(hw, 0, h, za, zb), gs(l * (o.wallK || 0.72) * 0.92));
    }
    poly(ctx, P, faceRect(-hw, hw, 0, h, z1), gs(lum(z1) * 255 * (o.endK || 0.6)));

    // 걸레받이, 모서리
    [-hw, hw].forEach((x) => {
      line(ctx, P, [x, 0.08, z0], [x, 0.08, z1], 'rgba(0,0,0,0.5)', 2);
      line(ctx, P, [x, h, z0], [x, h, z1], 'rgba(0,0,0,0.35)', 1);
    });
    // 바닥 타일
    if (o.tile) {
      ctx.globalAlpha = 0.18;
      for (let z = Math.ceil(z0 / o.tile) * o.tile; z < z1; z += o.tile) line(ctx, P, [-hw, 0, z], [hw, 0, z], '#000', 1);
      for (let x = -hw + o.tile; x < hw; x += o.tile) line(ctx, P, [x, 0, z0 + 0.3], [x, 0, z1], '#000', 1);
      ctx.globalAlpha = 1;
    }
    // 천장 등
    lights.forEach((L) => {
      const x = L.x || 0;
      poly(ctx, P, [[x - 0.13, h - 0.01, L.z - 0.55], [x + 0.13, h - 0.01, L.z - 0.55], [x + 0.13, h - 0.01, L.z + 0.55], [x - 0.13, h - 0.01, L.z + 0.55]], gs(L.on ? 150 + 100 * L.on : 34));
      if (L.on) {
        const c = P(x, h - 0.02, L.z);
        glow(ctx, c[0], c[1], (P.f * 1.1) / L.z, 0.5 * L.on);
        const r = P(x, -h + 0.4, L.z + 0.6);
        if (o.shine !== false) glow(ctx, r[0], r[1], (P.f * 1.0) / L.z, 0.16 * L.on * (o.shine || 1), 0.3);
      }
    });
    return { P, lum, hw, h, z0, z1, lights };
  }

  function door(ctx, R, side, z, o) {
    o = o || {};
    const { P, lum, hw } = R;
    const x = side * hw * 0.999;
    const l = lum(z + 0.5) * 255;
    const dw = o.dw || 0.95;
    poly(ctx, P, wallRect(x, 0, 2.05, z, z + dw), gs(l * (o.k || 0.42)));
    ctx.globalAlpha = 0.55;
    line(ctx, P, [x, 2.05, z], [x, 2.05, z + dw], '#000', 2);
    line(ctx, P, [x, 0, z], [x, 2.05, z], '#000', 2);
    line(ctx, P, [x, 0, z + dw], [x, 2.05, z + dw], '#000', 2);
    ctx.globalAlpha = 1;
    if (o.glass) {
      poly(ctx, P, wallRect(x, 0.15, 1.95, z + 0.08, z + dw - 0.08), gs(l * 0.25 + 18));
      if (o.paper) poly(ctx, P, wallRect(x, 1.0, 1.4, z + 0.3, z + 0.62), gs(l * 0.95 + 40));
    } else {
      poly(ctx, P, wallRect(x, 1.35, 1.75, z + 0.3, z + 0.65), gs(l * 0.25 + 10));
      line(ctx, P, [x, 1.0, z + dw - 0.12], [x, 1.0, z + dw - 0.25], 'rgba(255,255,255,0.25)', 2);
    }
    // 호실 번호판
    if (!o.glass) {
      poly(ctx, P, wallRect(x * 0.999, 2.12, 2.26, z + 0.3, z + 0.65), gs(l * 0.9 + 30));
      poly(ctx, P, wallRect(x * 0.998, 2.16, 2.22, z + 0.38, z + 0.57), gs(l * 0.3 + 6));
    }
    if (o.lit) {
      poly(ctx, P, wallRect(x, 0, 0.025, z, z + dw), gs(250));
      const c = P(x - side * 0.3, 0, z + dw / 2);
      glow(ctx, c[0], c[1], P.f / (z + 0.5), 0.3, 0.25);
    }
  }

  function figure(ctx, P, x, z, shade, o) {
    o = o || {};
    const hgt = o.h || 1.7;
    const pts = [
      [x - 0.21, hgt - 0.27],
      [x + 0.21, hgt - 0.27],
      [x + 0.19, 0.95],
      [x + 0.12, 0],
      [x - 0.12, 0],
      [x - 0.19, 0.95],
    ];
    ctx.beginPath();
    pts.forEach((p, i) => {
      const s = P(p[0], p[1], z);
      if (i) ctx.lineTo(s[0], s[1]);
      else ctx.moveTo(s[0], s[1]);
    });
    ctx.closePath();
    ctx.fillStyle = gs(shade);
    ctx.fill();
    const hd = P(x, hgt - 0.13, z);
    const r = (P.f * 0.11) / z;
    ctx.beginPath();
    ctx.ellipse(hd[0], hd[1], r * 0.85, r, 0, 0, Math.PI * 2);
    ctx.fill();
    // 목
    poly(ctx, P, [[x - 0.05, hgt - 0.3, z], [x + 0.05, hgt - 0.3, z], [x + 0.05, hgt - 0.2, z], [x - 0.05, hgt - 0.2, z]], gs(shade));
    if (o.umbrella) {
      const c = P(x, hgt + 0.15, z);
      const ur = (P.f * 0.62) / z;
      ctx.beginPath();
      ctx.ellipse(c[0], c[1], ur, ur * 0.55, 0, Math.PI, 0);
      ctx.lineTo(c[0] + ur, c[1] + ur * 0.06);
      ctx.lineTo(c[0] - ur, c[1] + ur * 0.06);
      ctx.fillStyle = gs(shade * 0.7);
      ctx.fill();
      line(ctx, P, [x + 0.02, hgt + 0.15, z], [x + 0.06, hgt - 0.6, z], gs(shade), 2);
    }
    if (o.cap) {
      const c = P(x, hgt - 0.04, z);
      ctx.beginPath();
      ctx.ellipse(c[0] + r * 0.4, c[1], r * 1.4, r * 0.28, 0, 0, Math.PI * 2);
      ctx.fillStyle = gs(shade * 0.8);
      ctx.fill();
    }
  }

  function exitSign(ctx, R, z) {
    const { P, h } = R;
    poly(ctx, P, faceRect(-0.24, 0.24, h - 0.38, h - 0.2, z - 0.02), gs(225));
    const c = P(0, h - 0.29, z - 0.05);
    glow(ctx, c[0], c[1], (P.f * 0.9) / z, 0.4);
  }

  function endWindow(ctx, R, z, v) {
    const { P } = R;
    poly(ctx, P, faceRect(-0.65, 0.65, 0.95, 2.05, z - 0.01), gs(v));
    line(ctx, P, [0, 0.95, z - 0.02], [0, 2.05, z - 0.02], 'rgba(0,0,0,0.8)', 2);
    line(ctx, P, [-0.65, 1.5, z - 0.02], [0.65, 1.5, z - 0.02], 'rgba(0,0,0,0.8)', 2);
    const c = P(0.2, 1.7, z);
    glow(ctx, c[0], c[1], (P.f * 1.2) / z, v / 600);
  }

  // ───────── 디테일 ─────────
  // 징두리(아래쪽 벽), 천장 텍스, 배관, 바닥 광택
  function dress(ctx, R, o) {
    o = o || {};
    const { P, hw, h, z0, z1 } = R;
    const wy = o.wain == null ? 1.0 : o.wain;
    if (wy) {
      [-1, 1].forEach((sd) => {
        const x = sd * hw * 0.999;
        ctx.globalAlpha = 0.3;
        poly(ctx, P, wallRect(x, 0, wy, z0, z1), '#000');
        ctx.globalAlpha = 1;
        line(ctx, P, [x * 0.999, wy, z0], [x * 0.999, wy, z1], 'rgba(255,255,255,0.16)', 2);
        line(ctx, P, [x * 0.999, wy - 0.025, z0], [x * 0.999, wy - 0.025, z1], 'rgba(0,0,0,0.4)', 1);
      });
    }
    if (o.ceil !== false) {
      ctx.globalAlpha = 0.18;
      for (let z = Math.ceil(z0 / 0.6) * 0.6; z < z1; z += 0.6) line(ctx, P, [-hw, h, z], [hw, h, z], '#000', 1);
      for (let x = -hw + 0.6; x < hw - 0.1; x += 0.6) line(ctx, P, [x, h, z0], [x, h, z1], '#000', 1);
      ctx.globalAlpha = 1;
      // 스프링클러
      for (let z = 2.2; z < z1; z += 3.6) {
        const c = P(0.6, h - 0.01, z);
        ctx.fillStyle = gs(25);
        ctx.beginPath();
        ctx.arc(c[0], c[1], Math.max(1, 14 / z), 0, Math.PI * 2);
        ctx.fill();
      }
    }
    if (o.pipe) {
      const x = o.pipe * hw * 0.82;
      line(ctx, P, [x, h - 0.14, z0], [x, h - 0.14, z1], gs(10), 6);
      line(ctx, P, [x, h - 0.11, z0], [x, h - 0.11, z1], 'rgba(255,255,255,0.18)', 1);
      for (let z = 2; z < z1; z += 2.5) line(ctx, P, [x, h - 0.14, z], [x, h, z], gs(10), 2);
    }
    // 바닥 광택: 켜진 등 밑으로 길게 늘어진 반사
    (R.lights || []).forEach((L) => {
      if (!L.on) return;
      const za = Math.max(z0 + 0.1, L.z - 2.4);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      // 가운데가 밝고 가장자리로 흐려지는 세로 반사
      const lx = L.x || 0;
      for (let k = 0; k < 4; k++) {
        const ww = 0.08 + k * 0.1;
        ctx.globalAlpha = 0.012 * L.on;
        poly(ctx, P, [[lx - ww, 0.001, za], [lx + ww, 0.001, za], [lx + ww * 0.4, 0.001, L.z + 0.8], [lx - ww * 0.4, 0.001, L.z + 0.8]], '#fff');
      }
      ctx.restore();
    });
  }

  function plate(ctx, R, side, z, y0, y1, dz, v) {
    poly(ctx, R.P, wallRect(side * R.hw * 0.997, y0, y1, z, z + dz), gs(v));
  }

  // 소화전 함
  function hydrant(ctx, R, side, z) {
    const { P, lum, hw } = R;
    const x = side * hw * 0.996;
    const l = lum(z + 0.3) * 255;
    poly(ctx, P, wallRect(x, 0.45, 1.35, z, z + 0.55), gs(l * 0.28 + 6));
    poly(ctx, P, wallRect(x * 0.999, 0.5, 1.3, z + 0.04, z + 0.51), gs(l * 0.52 + 10));
    poly(ctx, P, wallRect(x * 0.998, 1.08, 1.22, z + 0.1, z + 0.45), gs(l * 0.95 + 35));
    poly(ctx, P, wallRect(x * 0.998, 0.6, 0.98, z + 0.1, z + 0.45), gs(l * 0.35 + 8));
    line(ctx, P, [x * 0.997, 0.85, z + 0.47], [x * 0.997, 0.7, z + 0.47], 'rgba(0,0,0,0.6)', 2);
  }

  // 복도 쓰레기통
  function bin(ctx, R, side, z) {
    const { P, lum, hw } = R;
    const x = side * (hw - 0.3);
    const l = lum(z) * 255;
    poly(ctx, P, faceRect(x - 0.17, x + 0.17, 0, 0.62, z), gs(l * 0.38 + 6));
    poly(ctx, P, [[x - 0.17, 0.62, z], [x + 0.17, 0.62, z], [x + 0.17, 0.62, z + 0.3], [x - 0.17, 0.62, z + 0.3]], gs(l * 0.2 + 4));
    poly(ctx, P, faceRect(x - 0.18, x + 0.18, 0.58, 0.64, z - 0.01), gs(l * 0.8 + 30));
    ctx.globalAlpha = 0.4;
    line(ctx, P, [x - 0.1, 0.5, z - 0.005], [x - 0.1, 0.1, z - 0.005], '#000', 1);
    line(ctx, P, [x + 0.1, 0.5, z - 0.005], [x + 0.1, 0.1, z - 0.005], '#000', 1);
    ctx.globalAlpha = 1;
  }

  // 천장 환기구
  function vent(ctx, R, z) {
    const { P, h } = R;
    poly(ctx, P, [[-0.3, h - 0.005, z], [0.3, h - 0.005, z], [0.3, h - 0.005, z + 0.5], [-0.3, h - 0.005, z + 0.5]], gs(30));
    ctx.globalAlpha = 0.6;
    for (let k = 1; k < 6; k++) line(ctx, P, [-0.28, h - 0.006, z + k * 0.08], [0.28, h - 0.006, z + k * 0.08], '#000', 1);
    ctx.globalAlpha = 1;
  }

  function wallClock(ctx, R, side, z, y) {
    const c = R.P(side * R.hw * 0.996, y, z);
    const r = (R.P.f * 0.14) / z;
    ctx.save();
    ctx.translate(c[0], c[1]);
    ctx.scale(0.45, 1);
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fillStyle = gs(R.lum(z) * 255 * 0.9 + 30);
    ctx.fill();
    ctx.strokeStyle = gs(20);
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(r * 0.1, -r * 0.65);
    ctx.moveTo(0, 0);
    ctx.lineTo(r * 0.5, r * 0.2);
    ctx.stroke();
    ctx.restore();
  }

  // 투시면 위에 글자 쓰기 (가까이 보이는 표지 정도)
  function label(ctx, P, x, y, z, txt, size, v) {
    const c = P(x, y, z);
    ctx.fillStyle = gs(v);
    ctx.font = '700 ' + Math.max(6, Math.round((size * P.f) / z)) + 'px "Nanum Gothic", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(txt, c[0], c[1]);
  }

  // ───────── 장면들 ─────────
  const SC = {};

  SC.corridor2 = (ctx) => {
    const R = room(ctx, {
      w: 2.6, h: 2.7, z1: 24, tile: 0.6, amb: 0.03,
      lights: [{ z: 3, on: 1 }, { z: 8, on: 0 }, { z: 13, on: 0.7 }, { z: 18, on: 0 }, { z: 23, on: 0.35 }],
    });
    dress(ctx, R, { pipe: 1 });
    [4, 10, 16].forEach((z) => door(ctx, R, -1, z, { glass: true, paper: true }));
    [6.5, 12.5, 19].forEach((z) => door(ctx, R, 1, z));
    hydrant(ctx, R, 1, 9.2);
    vent(ctx, R, 5.5);
    vent(ctx, R, 15.5);
    // 바닥에 떨어진 임대 종이
    poly(ctx, R.P, [[-0.9, 0.002, 5.6], [-0.6, 0.002, 5.5], [-0.55, 0.002, 5.85], [-0.86, 0.002, 5.95]], gs(150));
    exitSign(ctx, R, 24);
  };

  function corridor3Base(ctx, lit) {
    const R = room(ctx, {
      w: 2.4, h: 2.6, z1: 22, tile: 0.6,
      amb: lit ? 0.05 : 0.13, fog: lit ? 0.02 : 0.05,
      lights: lit ? [{ z: 3, on: 1 }, { z: 8, on: 1 }, { z: 13, on: 1 }, { z: 18, on: 1 }] : [{ z: 3, on: 0 }, { z: 8, on: 0 }, { z: 13, on: 0 }, { z: 18, on: 0.45 }],
    });
    dress(ctx, R, { pipe: -1 });
    [3.5, 9, 14].forEach((z) => door(ctx, R, -1, z));
    [5.5, 11.5, 16.5].forEach((z) => door(ctx, R, 1, z));
    hydrant(ctx, R, 1, 8.3);
    bin(ctx, R, -1, 6.6);
    vent(ctx, R, 10.5);
    // 가까운 벽 스위치와 테이프
    const { P } = R;
    poly(ctx, P, wallRect(1.198, 1.15, 1.38, 1.3, 1.45), gs(lit ? 190 : 70));
    poly(ctx, P, wallRect(1.197, 1.22, 1.3, 1.26, 1.5), gs(lit ? 230 : 110));
    endWindow(ctx, R, 22, lit ? 30 : 150);
    exitSign(ctx, R, 22);
    return R;
  }

  SC.corridor3 = (ctx) => {
    corridor3Base(ctx, false);
  };

  SC.corridor3_lit = (ctx) => {
    const R = corridor3Base(ctx, true);
    figure(ctx, R.P, -0.55, 10.5, 22);
    figure(ctx, R.P, 0.6, 14, 26);
    figure(ctx, R.P, 0.05, 18.5, 30);
    figure(ctx, R.P, -0.7, 19.5, 32);
  };

  SC.floorF = (ctx) => {
    const R = room(ctx, {
      w: 2.6, h: 2.7, z1: 16, tile: 0.6, amb: 0.07, fog: 0.05,
      lights: [{ z: 3, on: 0 }, { z: 8, on: 0 }, { z: 13, on: 0 }],
    });
    dress(ctx, R, {});
    const { P, lum } = R;
    // 게시판 (1층과 같은 자리, 날짜만 오래된)
    poly(ctx, P, wallRect(-1.299, 1.0, 1.9, 4, 5.6), gs(lum(5) * 255 * 0.9 + 14));
    [[1.1, 1.5, 4.2, 4.7], [1.2, 1.8, 4.9, 5.4], [1.05, 1.35, 5.0, 5.5], [1.55, 1.85, 4.15, 4.6]].forEach(([y0, y1, a, b]) =>
      poly(ctx, P, wallRect(-1.298, y0, y1, a, b), gs(lum(5) * 255 + 26))
    );
    wallClock(ctx, R, -1, 7.2, 2.2);
    door(ctx, R, 1, 6);
    hydrant(ctx, R, 1, 10);
    // 복도 끝 경비실 문
    poly(ctx, P, faceRect(-0.55, 0.55, 0, 2.1, 15.995), gs(12));
    poly(ctx, P, faceRect(-0.5, 0.36, 0, 2.05, 15.99), gs(24));
    poly(ctx, P, faceRect(-0.38, 0.24, 1.2, 1.85, 15.985), gs(55));
    label(ctx, P, -0.07, 1.98, 15.98, '경 비 실', 0.09, 70);
    poly(ctx, P, faceRect(0.36, 0.42, 0, 2.05, 15.98), gs(250));
    const c = P(0.39, 1.0, 15.9);
    glow(ctx, c[0], c[1], 130, 0.45, 2.2);
    const f = P(0.3, 0, 15);
    glow(ctx, f[0], f[1], 160, 0.35, 0.18);
  };

  SC.lobby = (ctx, o) => {
    o = o || {};
    const dawn = !!o.dawn;
    const R = room(ctx, {
      w: 6, h: 3.3, z1: 13, tile: 0.8, amb: dawn ? 0.12 : 0.03, floorK: 0.6,
      lights: dawn ? [] : [{ z: 3.5, on: 0.9 }, { z: 9, on: 0.6 }],
      shine: 1.6,
    });
    dress(ctx, R, { wain: 1.1 });
    const { P, lum } = R;
    // 유리 현관
    poly(ctx, P, faceRect(-2.7, 2.7, 0, 2.7, 12.99), gs(dawn ? 205 : 62));
    const sl = P(2.2, 3.0, 13);
    if (!dawn) glow(ctx, sl[0], sl[1], 120, 0.45);
    else glow(ctx, W / 2, P(0, 1.5, 13)[1], 320, 0.35);
    // 바깥 길 건너 건물 윤곽
    poly(ctx, P, faceRect(-2.7, -0.9, 0.6, 2.2, 12.995), gs(dawn ? 160 : 38));
    poly(ctx, P, faceRect(0.6, 2.7, 0.6, 1.8, 12.995), gs(dawn ? 150 : 34));
    [-2.7, -1.35, 0, 1.35, 2.7].forEach((x) => line(ctx, P, [x, 0, 12.98], [x, 2.7, 12.98], 'rgba(0,0,0,0.8)', 3));
    line(ctx, P, [-2.7, 2.7, 12.98], [2.7, 2.7, 12.98], 'rgba(0,0,0,0.8)', 3);
    line(ctx, P, [-0.15, 0.9, 12.97], [-0.15, 1.3, 12.97], 'rgba(0,0,0,0.6)', 3);
    line(ctx, P, [0.15, 0.9, 12.97], [0.15, 1.3, 12.97], 'rgba(0,0,0,0.6)', 3);
    // 유리에 붙은 안내문
    poly(ctx, P, faceRect(-1.2, -0.85, 1.35, 1.8, 12.97), gs(dawn ? 230 : 110));
    // 유리에 비친 것
    ctx.globalAlpha = dawn ? 0.15 : 0.35;
    poly(ctx, P, faceRect(-2.6, 2.6, -1.4, 0, 12.99), gs(dawn ? 160 : 50));
    ctx.globalAlpha = 1;
    // 현관 매트
    poly(ctx, P, [[-1.2, 0.003, 11], [1.2, 0.003, 11], [1.2, 0.003, 12.8], [-1.2, 0.003, 12.8]], gs(lum(12) * 255 * 0.2 + 4));
    // 우편함
    const mx = -2.999;
    poly(ctx, P, wallRect(mx, 0.95, 2.02, 2.95, 6.25), gs(lum(4.5) * 255 * 0.25));
    for (let i = 0; i < 8; i++)
      for (let j = 0; j < 4; j++) {
        const z = 3 + i * 0.4;
        const y = 1.0 + j * 0.25;
        poly(ctx, P, wallRect(mx * 0.999, y, y + 0.21, z, z + 0.36), gs(lum(z) * 255 * ((i + j) % 3 ? 0.5 : 0.62)));
        poly(ctx, P, wallRect(mx * 0.998, y + 0.15, y + 0.18, z + 0.06, z + 0.2), gs(lum(z) * 255 + 40));
        if ((i * 7 + j * 3) % 5 === 0) poly(ctx, P, wallRect(mx * 0.997, y + 0.02, y + 0.09, z + 0.04, z + 0.3), gs(lum(z) * 255 * 0.9 + 60));
      }
    // 게시판
    poly(ctx, P, wallRect(mx, 1.0, 2.1, 7.2, 9), gs(lum(8) * 255 * 0.55));
    [[1.15, 1.6, 7.4, 7.9], [1.3, 1.95, 8.0, 8.5], [1.1, 1.45, 8.55, 8.9], [1.65, 2.0, 7.35, 7.8]].forEach(([y0, y1, a, b]) =>
      poly(ctx, P, wallRect(mx * 0.999, y0, y1, a, b), gs(lum(8) * 255 * 0.95 + 20))
    );
    // 우산꽂이
    const ux = -2.5;
    poly(ctx, P, faceRect(ux - 0.15, ux + 0.15, 0, 0.55, 10.2), gs(lum(10) * 255 * 0.35 + 8));
    [-0.08, 0, 0.07].forEach((d, i) => line(ctx, P, [ux + d, 0.5, 10.25], [ux + d * 2.2, 0.95 + i * 0.05, 10.25], gs(lum(10) * 255 * 0.3 + 4), 3));
    // 엘리베이터
    const ex = 2.999;
    poly(ctx, P, wallRect(ex, 0, 2.3, 5.6, 7.4), gs(lum(6.5) * 255 * 0.3));
    poly(ctx, P, wallRect(ex * 0.999, 0, 2.1, 5.8, 7.2), gs(lum(6.5) * 255 * 0.95 + 15));
    line(ctx, P, [ex * 0.998, 0, 6.5], [ex * 0.998, 2.1, 6.5], 'rgba(0,0,0,0.7)', 2);
    poly(ctx, P, wallRect(ex * 0.999, 2.35, 2.55, 6.25, 6.75), gs(20));
    const ind = P(ex, 2.45, 6.5);
    glow(ctx, ind[0], ind[1], 14, 0.6);
    poly(ctx, P, wallRect(ex * 0.999, 1.0, 1.35, 5.3, 5.45), gs(40));
    const cb = P(ex * 0.998, 1.15, 5.37);
    glow(ctx, cb[0], cb[1], 10, dawn ? 0.2 : 0.7);
    // 층별 안내판
    poly(ctx, P, wallRect(ex * 0.999, 1.1, 2.2, 8.2, 9.2), gs(lum(8.7) * 255 * 0.22 + 4));
    for (let k = 0; k < 6; k++) poly(ctx, P, wallRect(ex * 0.998, 1.25 + k * 0.15, 1.3 + k * 0.15, 8.3, 9.0 - (k % 2) * 0.2), gs(lum(8.7) * 255 * 0.7 + 30));
    // 앞쪽 화분 (초점 밖)
    ctx.save();
    if ('filter' in ctx) ctx.filter = 'blur(5px)';
    const pot = P(1.05, 0, 2.0);
    const potT = P(1.05, 0.5, 2.0);
    const pw = (P.f * 0.28) / 2.0;
    ctx.fillStyle = gs(14);
    ctx.fillRect(pot[0] - pw / 2, potT[1], pw, pot[1] - potT[1]);
    const r2 = rng(5);
    for (let k = 0; k < 14; k++) {
      const a = -Math.PI / 2 + (r2() - 0.5) * 2.2;
      const len = pw * (1.2 + r2() * 1.6);
      ctx.beginPath();
      ctx.ellipse(pot[0] + Math.cos(a) * len * 0.5, potT[1] + Math.sin(a) * len * 0.5, len * 0.5, pw * 0.13, a, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  };

  SC.lobby_dawn = (ctx) => SC.lobby(ctx, { dawn: true });

  SC.parking = (ctx) => {
    const R = room(ctx, {
      w: 9, h: 2.5, z1: 30, amb: 0.13, floorK: 0.5, ceilK: 0.36, wallK: 0.55, fog: 0.025,
      lights: [{ z: 5, on: 0 }, { z: 9, on: 1, x: 1.5 }, { z: 21, on: 0 }, { z: 26, on: 0.5, x: -1.5 }],
      shine: 0.6,
    });
    dress(ctx, R, { wain: 1.2, ceil: false });
    const { P, lum, h } = R;
    // 천장 배관
    [[-3.2, 9, 0.16], [-2.6, 6, 0.1], [1.0, 10, 0.12], [3.4, 5, 0.2]].forEach(([x, w, d]) => {
      line(ctx, P, [x, h - d, 0.8], [x, h - d, 30], gs(8), w);
      line(ctx, P, [x, h - d + 0.03, 0.8], [x, h - d + 0.03, 30], 'rgba(255,255,255,0.12)', 1);
    });
    // 바닥 선, 기름 자국
    ctx.globalAlpha = 0.5;
    for (let z = 2; z < 30; z += 2.4) {
      line(ctx, P, [1.6, 0, z], [1.6, 0, z + 1.2], gs(lum(z) * 255 + 40), 2);
      line(ctx, P, [-1.6, 0, z], [-1.6, 0, z + 1.2], gs(lum(z) * 255 + 40), 2);
    }
    ctx.globalAlpha = 1;
    [[-2.4, 3.5, 0.5], [2.6, 13, 0.7], [-3, 16, 0.4], [0.4, 6.5, 0.3]].forEach(([x, z, rr]) => {
      const c = P(x, 0, z);
      const e = P(x + rr, 0, z);
      ctx.save();
      ctx.translate(c[0], c[1]);
      ctx.scale(1, 0.22);
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, Math.abs(e[0] - c[0]));
      g.addColorStop(0, 'rgba(0,0,0,0.45)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.fillRect(-500, -500, 1000, 1000);
      ctx.restore();
    });
    // 차
    const cz = 7.2;
    const cl = lum(cz) * 255;
    // 차 밑 그림자
    poly(ctx, P, [[1.9, 0.002, cz - 0.1], [3.9, 0.002, cz - 0.1], [3.9, 0.002, cz + 4.2], [1.9, 0.002, cz + 4.2]], 'rgba(0,0,0,0.6)');
    poly(ctx, P, faceRect(2.0, 3.9, 0.25, 1.0, cz), gs(cl * 0.18 + 6));
    poly(ctx, P, faceRect(2.3, 3.6, 1.0, 1.42, cz + 0.6), gs(cl * 0.14 + 5));
    poly(ctx, P, faceRect(2.42, 3.48, 1.04, 1.38, cz + 0.59), gs(cl * 0.35 + 14));
    poly(ctx, P, [[2.0, 1.0, cz], [2.0, 1.0, cz + 4], [2.0, 0.25, cz + 4], [2.0, 0.25, cz]], gs(cl * 0.25 + 6));
    poly(ctx, P, [[2.3, 1.42, cz + 0.6], [2.3, 1.42, cz + 3], [2.0, 1.0, cz + 3.6], [2.0, 1.0, cz]], gs(cl * 0.3 + 8));
    poly(ctx, P, [[2.27, 1.38, cz + 0.8], [2.27, 1.38, cz + 2.8], [2.04, 1.04, cz + 3.3], [2.04, 1.04, cz + 0.3]], gs(cl * 0.5 + 18));
    line(ctx, P, [2.3, 1.42, cz + 0.6], [2.3, 1.42, cz + 3], 'rgba(255,255,255,0.3)', 1);
    // 바퀴 (내려앉은 쪽은 납작하게)
    [[cz + 0.7, 1], [cz + 3.3, 0.55]].forEach(([wz, sq]) => {
      const c = P(1.99, 0.3 * sq, wz);
      const rr = (P.f * 0.32) / wz;
      ctx.beginPath();
      ctx.ellipse(c[0], c[1], rr * 0.35, rr * sq, 0, 0, Math.PI * 2);
      ctx.fillStyle = gs(5);
      ctx.fill();
    });
    poly(ctx, P, faceRect(2.15, 2.45, 0.6, 0.72, cz - 0.01), gs(cl * 0.6 + 30));
    poly(ctx, P, faceRect(3.45, 3.75, 0.6, 0.72, cz - 0.01), gs(cl * 0.6 + 30));
    // 기둥 + 번호 + 바퀴 멈춤턱
    [4.5, 11, 17.5, 24].forEach((z, i) => {
      [-2.9, 2.9].forEach((x) => {
        const l = lum(z) * 255;
        poly(ctx, P, faceRect(x - 0.3, x + 0.3, 0, h, z), gs(l * 0.62));
        const inner = x < 0 ? x + 0.3 : x - 0.3;
        poly(ctx, P, wallRect(inner, 0, h, z, z + 0.6), gs(l * 0.45));
        poly(ctx, P, faceRect(x - 0.3, x + 0.3, 0.9, 1.15, z - 0.001), gs(l * 0.9 + 10));
        poly(ctx, P, faceRect(x - 0.3, x + 0.3, 0, 0.35, z - 0.001), gs(l * 0.3 + 4));
        label(ctx, P, x, 1.55, z - 0.002, 'B1-' + (x < 0 ? 'A' : 'B') + (i + 1), 0.16, l * 0.25 + 4);
      });
      poly(ctx, P, faceRect(-4.3, -3.4, 0, 0.12, z + 2.5), gs(lum(z + 2.5) * 255 * 0.9 + 25));
    });
  };

  SC.office = (ctx) => {
    // 앉은 눈높이에서 책상을 조금 내려다본다
    const cam = { eye: 1.22, f: 440, cy: H * 0.3 };
    const P = Cam(cam);
    const room0 = room(ctx, Object.assign({ w: 3.6, h: 2.6, z1: 4, z0: 0.6, amb: 0.08, lights: [{ z: 2.6, on: 0.85 }], wallK: 0.62, shine: 0.3 }, cam));
    const { lum } = room0;
    const DY = 0.76; // 책상 높이

    // 창문과 블라인드
    poly(ctx, P, faceRect(-1.55, -0.35, 1.05, 2.2, 3.99), gs(70));
    const st = P(-1.2, 2.3, 4.5);
    glow(ctx, st[0], st[1], 150, 0.4);
    ctx.globalAlpha = 0.75;
    for (let y = 1.07; y < 2.2; y += 0.055) line(ctx, P, [-1.55, y, 3.98], [-0.35, y, 3.98], '#000', 2);
    ctx.globalAlpha = 1;
    // 열쇠함
    poly(ctx, P, faceRect(0.5, 1.45, 1.05, 2.0, 3.99), gs(lum(3.9) * 255 * 0.3));
    for (let i = 0; i < 8; i++)
      for (let j = 0; j < 5; j++) {
        const x = 0.58 + i * 0.11;
        const y = 1.15 + j * 0.17;
        poly(ctx, P, faceRect(x, x + 0.025, y, y + 0.05, 3.98), gs(i === 7 && j === 0 ? 30 : 120));
      }
    // 벽시계
    const ck = P(0.05, 2.28, 3.99);
    ctx.beginPath();
    ctx.arc(ck[0], ck[1], 15, 0, Math.PI * 2);
    ctx.fillStyle = gs(150);
    ctx.fill();
    ctx.strokeStyle = gs(30);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(ck[0], ck[1]);
    ctx.lineTo(ck[0] + 3, ck[1] - 10);
    ctx.moveTo(ck[0], ck[1]);
    ctx.lineTo(ck[0] + 8, ck[1] + 4);
    ctx.stroke();
    // 벽에 붙은 수칙 종이
    poly(ctx, P, faceRect(-0.2, 0.25, 1.15, 1.75, 3.98), gs(165));
    ctx.globalAlpha = 0.4;
    for (let k = 0; k < 9; k++) line(ctx, P, [-0.15, 1.65 - k * 0.055, 3.97], [0.2 - (k % 3) * 0.05, 1.65 - k * 0.055, 3.97], '#000', 1);
    ctx.globalAlpha = 1;

    // ── 책상 ──
    const top = (x, z) => [x, DY, z];
    const tz0 = 0.3;
    const tz1 = 3.0;
    // 상판 (안쪽으로 갈수록 어둡게)
    for (let z = tz0; z < tz1; z += 0.1) {
      const l = 70 - (z - tz0) * 14 + lum(z) * 40;
      poly(ctx, P, [top(-2, z), top(2, z), top(2, z + 0.1), top(-2, z + 0.1)], gs(l));
    }
    // 나뭇결
    const r = rng(41);
    ctx.globalAlpha = 0.2;
    for (let i = 0; i < 60; i++) {
      const z = tz0 + r() * (tz1 - tz0);
      const x0 = -2 + r() * 3;
      line(ctx, P, top(x0, z), top(x0 + 0.4 + r() * 1.2, z + (r() - 0.5) * 0.04), r() < 0.5 ? '#000' : '#fff', 1);
    }
    ctx.globalAlpha = 1;
    // 유리판 밑 쪽지들
    const under = [
      [-0.95, -0.62, 0.62, 0.86, 150],
      [-0.6, -0.36, 0.95, 1.12, 175],
      [0.55, 0.9, 0.6, 0.82, 160],
      [0.75, 1.0, 0.95, 1.15, 140],
      [-1.2, -0.9, 1.25, 1.45, 130],
      [0.2, 0.42, 0.42, 0.55, 185],
    ];
    under.forEach(([x0, x1, z0, z1, v], i) => {
      const k = (i % 2 ? 1 : -1) * 0.03;
      poly(ctx, P, [top(x0, z0), top(x1, z0 + k), top(x1 - k, z1), top(x0 - k, z1 - k)], gs(v * 0.95));
      ctx.globalAlpha = 0.3;
      for (let j = 1; j < 4; j++) line(ctx, P, top(x0 + 0.04, z0 + j * ((z1 - z0) / 4)), top(x1 - 0.06, z0 + j * ((z1 - z0) / 4)), '#000', 1);
      ctx.globalAlpha = 1;
    });
    // 유리판 가장자리와 반사
    line(ctx, P, top(-1.9, 2.4), top(1.9, 2.4), 'rgba(255,255,255,0.18)', 1.5);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.035;
    poly(ctx, P, [top(-0.42, 0.45), top(-0.3, 0.45), top(0.45, 3.0), top(0.3, 3.0)], '#fff');
    ctx.restore();

    // 컵 자국
    [[0.05, 0.5], [0.12, 0.56]].forEach(([x, z]) => {
      const c = P(x, DY, z);
      const e = P(x + 0.045, DY, z);
      ctx.beginPath();
      ctx.ellipse(c[0], c[1], Math.abs(e[0] - c[0]), Math.abs(e[0] - c[0]) * 0.32, 0, 0.3, Math.PI * 1.8);
      ctx.strokeStyle = 'rgba(0,0,0,0.35)';
      ctx.lineWidth = 2;
      ctx.stroke();
    });

    // 그림자 (물건 밑)
    const shadow = (x, z, rx, rz, a) => {
      const c = P(x, DY, z);
      const s2 = P(x + rx, DY, z);
      const rad = Math.abs(s2[0] - c[0]);
      ctx.save();
      ctx.translate(c[0], c[1]);
      ctx.scale(1, rz);
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rad);
      g.addColorStop(0, 'rgba(0,0,0,' + a + ')');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.fillRect(-rad, -rad, rad * 2, rad * 2);
      ctx.restore();
    };
    // 상자 (책상 위)
    const box = (x0, x1, y1, z0, z1, tTop, tFront, tSide) => {
      if (x0 > 0) poly(ctx, P, wallRect(x0, DY, y1, z0, z1), gs(tSide));
      if (x1 < 0) poly(ctx, P, wallRect(x1, DY, y1, z0, z1), gs(tSide));
      poly(ctx, P, [[x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1]], gs(tTop));
      poly(ctx, P, faceRect(x0, x1, DY, y1, z0), gs(tFront));
    };

    // CRT 모니터
    shadow(0.85, 2.45, 0.6, 0.3, 0.6);
    box(0.5, 1.2, 1.2, 2.15, 2.75, 40, 26, 34);
    poly(ctx, P, faceRect(0.56, 1.14, 0.83, 1.14, 2.14), gs(150));
    line(ctx, P, [0.85, 0.83, 2.13], [0.85, 1.14, 2.13], '#000', 2);
    line(ctx, P, [0.56, 0.985, 2.13], [1.14, 0.985, 2.13], '#000', 2);
    ctx.globalAlpha = 0.25;
    for (let y = 0.84; y < 1.14; y += 0.018) line(ctx, P, [0.56, y, 2.125], [1.14, y, 2.125], '#000', 1);
    ctx.globalAlpha = 1;
    const mc = P(0.85, 0.99, 2.1);
    glow(ctx, mc[0], mc[1], 150, 0.3);
    // 모니터 빛이 책상에 번진다
    const sp = P(0.85, DY, 1.75);
    glow(ctx, sp[0], sp[1], 170, 0.22, 0.32);

    // 출근부 (펼친 장부)
    shadow(-0.12, 0.82, 0.3, 0.3, 0.45);
    const lz0 = 0.68;
    const lz1 = 0.92;
    poly(ctx, P, [top(-0.42, lz0), top(-0.12, lz0 - 0.01), top(-0.12, lz1), top(-0.4, lz1 + 0.01)], gs(185));
    poly(ctx, P, [top(-0.12, lz0 - 0.01), top(0.18, lz0), top(0.16, lz1 + 0.01), top(-0.12, lz1)], gs(170));
    line(ctx, P, top(-0.12, lz0 - 0.01), top(-0.12, lz1), 'rgba(0,0,0,0.5)', 1.5);
    ctx.globalAlpha = 0.4;
    for (let k = 1; k < 8; k++) {
      const z = lz0 + k * 0.03;
      line(ctx, P, top(-0.39, z), top(-0.15, z), '#000', 1);
      line(ctx, P, top(-0.09, z), top(0.14, z), '#000', 1);
    }
    ctx.globalAlpha = 1;
    // 볼펜
    shadow(0.26, 0.62, 0.08, 0.3, 0.4);
    line(ctx, P, top(0.22, 0.55), top(0.33, 0.72), gs(15), 4);

    // 전화기
    shadow(-1.0, 2.3, 0.35, 0.3, 0.55);
    box(-1.3, -0.75, 0.86, 2.1, 2.5, 52, 24, 36);
    poly(ctx, P, [[-1.32, 0.93, 2.12], [-0.73, 0.93, 2.12], [-0.73, 0.93, 2.3], [-1.32, 0.93, 2.3]], gs(30));
    poly(ctx, P, faceRect(-1.32, -0.73, 0.86, 0.93, 2.12), gs(18));
    // 꼬인 줄
    ctx.strokeStyle = gs(22);
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let k = 0; k <= 20; k++) {
      const t = k / 20;
      const pt = P(-0.75 + t * 0.35, DY + 0.01, 2.25 - t * 0.35 + Math.sin(t * 22) * 0.012);
      if (k) ctx.lineTo(pt[0], pt[1]);
      else ctx.moveTo(pt[0], pt[1]);
    }
    ctx.stroke();

    // 무전기 (세워 둠)
    shadow(-0.48, 1.18, 0.12, 0.3, 0.6);
    box(-0.54, -0.44, 0.98, 1.12, 1.2, 30, 14, 22);
    line(ctx, P, [-0.47, 0.98, 1.16], [-0.47, 1.2, 1.16], gs(14), 2.5);
    const led = P(-0.51, 0.95, 1.11);
    glow(ctx, led[0], led[1], 8, 0.9);
    ctx.globalAlpha = 0.5;
    for (let k = 0; k < 4; k++) line(ctx, P, [-0.53, 0.82 + k * 0.022, 1.115], [-0.45, 0.82 + k * 0.022, 1.115], '#000', 1);
    ctx.globalAlpha = 1;

    // 종이컵
    shadow(0.42, 1.25, 0.07, 0.3, 0.5);
    const cx0 = P(0.37, DY, 1.25);
    const cx1 = P(0.47, DY, 1.25);
    const ct0 = P(0.355, DY + 0.1, 1.25);
    const ct1 = P(0.485, DY + 0.1, 1.25);
    ctx.beginPath();
    ctx.moveTo(cx0[0], cx0[1]);
    ctx.lineTo(cx1[0], cx1[1]);
    ctx.lineTo(ct1[0], ct1[1]);
    ctx.lineTo(ct0[0], ct0[1]);
    ctx.closePath();
    ctx.fillStyle = gs(175);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse((ct0[0] + ct1[0]) / 2, ct0[1], (ct1[0] - ct0[0]) / 2, 3, 0, 0, Math.PI * 2);
    ctx.fillStyle = gs(40);
    ctx.fill();


    // 손전등 (앞쪽에 누운 것)
    shadow(-0.15, 0.5, 0.12, 0.3, 0.55);
    poly(ctx, P, [top(-0.26, 0.44), top(-0.24, 0.42), top(-0.04, 0.53), top(-0.06, 0.55)].map((p) => [p[0], p[1] + 0.035, p[2]]), gs(20));
    poly(ctx, P, [top(-0.26, 0.44), top(-0.24, 0.42), top(-0.04, 0.53), top(-0.06, 0.55)].map((p) => [p[0], p[1] + 0.06, p[2]]), gs(45));
    const lens = P(-0.05, DY + 0.05, 0.54);
    ctx.beginPath();
    ctx.ellipse(lens[0], lens[1], 9, 13, -0.4, 0, Math.PI * 2);
    ctx.fillStyle = gs(120);
    ctx.fill();
    // 열쇠 꾸러미
    shadow(0.14, 0.44, 0.06, 0.3, 0.45);
    const ring = P(0.13, DY + 0.003, 0.44);
    ctx.beginPath();
    ctx.ellipse(ring[0], ring[1], 16, 6, 0, 0, Math.PI * 2);
    ctx.strokeStyle = gs(150);
    ctx.lineWidth = 2;
    ctx.stroke();
    [[0.15, 0.435, 0.185, 0.425], [0.15, 0.445, 0.18, 0.46], [0.115, 0.44, 0.09, 0.42]].forEach(([x0, z0, x1, z1]) => {
      line(ctx, P, top(x0, z0), top(x1, z1), gs(170), 4);
      const tip = P(x1, DY, z1);
      ctx.fillStyle = gs(140);
      ctx.fillRect(tip[0] - 3, tip[1] - 3, 6, 6);
    });
  };

  SC.elevator = (ctx) => {
    const o = { w: 6, h: 3, z1: 4.2, amb: 0.01, floorK: 0.55, eye: 1.55, tile: 0.7, lights: [] };
    const R = room(ctx, o);
    dress(ctx, R, { wain: 0 });
    const { P } = R;
    // 엘리베이터 안
    const iz0 = 4.2;
    const iz1 = 5.6;
    poly(ctx, P, faceRect(-0.55, 0.55, 0, 2.15, iz1), gs(150));
    // 뒷벽 위쪽 거울
    poly(ctx, P, faceRect(-0.5, 0.5, 1.0, 2.05, iz1 - 0.005), gs(120));
    line(ctx, P, [0, 1.0, iz1 - 0.01], [0, 2.05, iz1 - 0.01], 'rgba(255,255,255,0.3)', 1);
    poly(ctx, P, wallRect(-0.55, 0, 2.15, iz0, iz1), gs(200));
    poly(ctx, P, wallRect(0.55, 0, 2.15, iz0, iz1), gs(185));
    poly(ctx, P, [[-0.55, 0, iz0], [0.55, 0, iz0], [0.55, 0, iz1], [-0.55, 0, iz1]], gs(165));
    poly(ctx, P, [[-0.55, 2.15, iz0], [0.55, 2.15, iz0], [0.55, 2.15, iz1], [-0.55, 2.15, iz1]], gs(245));
    // 손잡이
    line(ctx, P, [-0.54, 0.9, iz0 + 0.1], [-0.54, 0.9, iz1], gs(250), 3);
    line(ctx, P, [-0.5, 0.9, iz1 - 0.01], [0.5, 0.9, iz1 - 0.01], gs(240), 3);
    // 안내 스티커, 점검필증
    poly(ctx, P, wallRect(-0.548, 1.35, 1.6, 4.55, 4.8), gs(240));
    poly(ctx, P, wallRect(-0.547, 1.38, 1.4, 4.58, 4.77), gs(150));
    // 버튼판
    poly(ctx, P, wallRect(0.549, 0.9, 1.5, 4.5, 4.75), gs(90));
    for (let k = 0; k < 5; k++) poly(ctx, P, wallRect(0.548, 0.98 + k * 0.1, 1.02 + k * 0.1, 4.58, 4.66), gs(k === 4 ? 250 : 60));
    const bt = P(0.548, 1.4, 4.62);
    glow(ctx, bt[0], bt[1], 10, 0.9);
    const top = P(0, 2.1, 4.9);
    glow(ctx, top[0], top[1], 260, 0.4);
    // 문턱
    poly(ctx, P, [[-0.55, 0.002, iz0 - 0.06], [0.55, 0.002, iz0 - 0.06], [0.55, 0.002, iz0 + 0.04], [-0.55, 0.002, iz0 + 0.04]], gs(210));
    // 문짝과 스테인리스 문틀
    poly(ctx, P, faceRect(-1.15, -0.55, 0, 2.15, 4.19), gs(95));
    poly(ctx, P, faceRect(0.55, 1.15, 0, 2.15, 4.19), gs(90));
    [-1.0, -0.8, 0.75, 0.95].forEach((x) => line(ctx, P, [x, 0.1, 4.185], [x, 2.05, 4.185], 'rgba(255,255,255,0.12)', 2));
    poly(ctx, P, faceRect(-1.25, -1.15, 0, 2.3, 4.18), gs(70));
    poly(ctx, P, faceRect(1.15, 1.25, 0, 2.3, 4.18), gs(70));
    poly(ctx, P, faceRect(-1.25, 1.25, 2.15, 2.3, 4.18), gs(60));
    // 호출 버튼
    poly(ctx, P, faceRect(1.45, 1.6, 1.0, 1.3, 4.18), gs(50));
    const cb = P(1.525, 1.18, 4.17);
    glow(ctx, cb[0], cb[1], 10, 0.6);
    // 액자 (점검 증명서)
    poly(ctx, P, faceRect(1.45, 1.95, 1.5, 1.9, 4.18), gs(30));
    poly(ctx, P, faceRect(1.48, 1.92, 1.53, 1.87, 4.175), gs(110));
    // 층 표시
    poly(ctx, P, faceRect(-0.3, 0.3, 2.42, 2.66, 4.18), gs(12));
    const ind = P(0, 2.54, 4.17);
    ctx.fillStyle = gs(240);
    ctx.font = '700 22px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('F', ind[0], ind[1]);
    glow(ctx, ind[0], ind[1], 24, 0.5);
    // 바닥으로 새는 빛
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const a = P(-0.55, 0, 4.2);
    const b = P(0.55, 0, 4.2);
    const c = P(1.6, 0, 0.9);
    const d = P(-1.6, 0, 0.9);
    const g = ctx.createLinearGradient(0, a[1], 0, c[1]);
    g.addColorStop(0, 'rgba(255,255,255,0.45)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(a[0], a[1]);
    ctx.lineTo(b[0], b[1]);
    ctx.lineTo(c[0], c[1]);
    ctx.lineTo(d[0], d[1]);
    ctx.fill();
    ctx.restore();
  };

  function stairs(ctx, lit) {
    const P = Cam({ eye: 1.45, f: 360, cy: H * 0.66 });
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H);
    const n = 15;
    const rise = 0.17;
    const run = 0.28;
    const z0 = 1.7;
    const landY = n * rise;
    const landZ = z0 + n * run;
    const backZ = landZ + 1.2;
    const lightAt = (y, z) => 0.1 + (lit ? 0.9 / (1 + Math.pow((landY + 1.4 - y) * 0.9, 2) + Math.pow(backZ - z, 2) * 0.25) : 0.02 * (1 - z / backZ));
    // 옆벽 (계단선을 따라 아래쪽은 페인트 띠)
    for (let z = z0 - 0.7; z < backZ; z += 0.2) {
      const yMid = Math.max(0, Math.min(landY, (z - z0) * (rise / run)));
      const l = lightAt(yMid + 1.2, z) * 255;
      poly(ctx, P, wallRect(-0.95, -0.5, landY + 3.2, z, z + 0.2), gs(l * 0.7));
      poly(ctx, P, wallRect(0.95, -0.5, landY + 3.2, z, z + 0.2), gs(l * 0.6));
      poly(ctx, P, wallRect(-0.949, yMid - 0.5, yMid + 0.9, z, z + 0.2), gs(l * 0.42));
      poly(ctx, P, wallRect(0.949, yMid - 0.5, yMid + 0.9, z, z + 0.2), gs(l * 0.36));
    }
    // 페인트 경계선
    line(ctx, P, [-0.948, 0.9, z0], [-0.948, landY + 0.9, landZ], 'rgba(255,255,255,0.14)', 2);
    line(ctx, P, [0.948, 0.9, z0], [0.948, landY + 0.9, landZ], 'rgba(255,255,255,0.1)', 2);
    // 계단참 벽과 바닥
    const bl = lightAt(landY + 1.4, backZ) * 255;
    poly(ctx, P, faceRect(-0.95, 0.95, landY, landY + 3.2, backZ), gs(bl * 0.85));
    poly(ctx, P, faceRect(-0.95, 0.95, landY, landY + 0.9, backZ - 0.002), gs(bl * 0.5));
    poly(ctx, P, [[-0.95, landY, landZ], [0.95, landY, landZ], [0.95, landY, backZ], [-0.95, landY, backZ]], gs(lightAt(landY, landZ + 0.5) * 255 * 0.7));
    // 계단참 창 (철망 유리)
    poly(ctx, P, faceRect(-0.7, -0.15, landY + 1.2, landY + 2.0, backZ - 0.003), gs(lit ? 28 : 18));
    ctx.globalAlpha = 0.35;
    for (let k = 1; k < 6; k++) {
      line(ctx, P, [-0.7 + k * 0.09, landY + 1.2, backZ - 0.004], [-0.7 + k * 0.09, landY + 2.0, backZ - 0.004], gs(lit ? 120 : 50), 1);
      line(ctx, P, [-0.7, landY + 1.2 + k * 0.13, backZ - 0.004], [-0.15, landY + 1.2 + k * 0.13, backZ - 0.004], gs(lit ? 120 : 50), 1);
    }
    ctx.globalAlpha = 1;
    // 계단 + 미끄럼 방지 띠
    for (let k = n - 1; k >= 0; k--) {
      const z = z0 + k * run;
      const y0 = k * rise;
      const l = lightAt(y0, z) * 255;
      poly(ctx, P, faceRect(-0.95, 0.95, y0, y0 + rise, z), gs(l * 0.32));
      poly(ctx, P, [[-0.95, y0 + rise, z], [0.95, y0 + rise, z], [0.95, y0 + rise, z + run], [-0.95, y0 + rise, z + run]], gs(l * 1.05));
      poly(ctx, P, [[-0.85, y0 + rise + 0.001, z + 0.02], [0.85, y0 + rise + 0.001, z + 0.02], [0.85, y0 + rise + 0.001, z + 0.07], [-0.85, y0 + rise + 0.001, z + 0.07]], gs(l * 0.45));
      line(ctx, P, [-0.95, y0 + rise, z], [0.95, y0 + rise, z], 'rgba(255,255,255,0.22)', 1.5);
      // 모서리 먼지
      poly(ctx, P, [[-0.95, y0 + rise + 0.001, z], [-0.8, y0 + rise + 0.001, z], [-0.8, y0 + rise + 0.001, z + run], [-0.95, y0 + rise + 0.001, z + run]], 'rgba(0,0,0,0.25)');
    }
    // 난간 + 기둥
    line(ctx, P, [-0.86, 0.95, z0 - 0.4], [-0.86, landY + 0.95, landZ], gs(lit ? 120 : 40), 3);
    line(ctx, P, [-0.9, 0.95, z0 - 0.4], [-0.9, landY + 0.95, landZ], 'rgba(0,0,0,0.6)', 2);
    for (let k = 1; k < n; k += 3) {
      const z = z0 + k * run + 0.14;
      const y = (k + 1) * rise;
      line(ctx, P, [-0.87, y + 0.92, z], [-0.92, y + 0.92, z], gs(lit ? 90 : 30), 2);
    }
    // 소화전 함 (오른쪽 벽 아래)
    poly(ctx, P, wallRect(0.947, 0.9, 1.6, z0 + 0.6, z0 + 1.1), gs(lightAt(1.2, z0 + 0.8) * 255 * 0.3));
    poly(ctx, P, wallRect(0.946, 1.35, 1.48, z0 + 0.68, z0 + 1.02), gs(lightAt(1.2, z0 + 0.8) * 255 * 0.9 + 20));
    // 등
    const lp = P(0, landY + 2.4, backZ - 0.01);
    if (lit) {
      poly(ctx, P, faceRect(-0.18, 0.18, landY + 2.3, landY + 2.5, backZ - 0.01), gs(250));
      glow(ctx, lp[0], lp[1], 330, 0.55);
    } else {
      poly(ctx, P, faceRect(-0.18, 0.18, landY + 2.3, landY + 2.5, backZ - 0.01), gs(30));
    }
    // 철문
    const dl = lightAt(landY + 1, landZ) * 255;
    poly(ctx, P, wallRect(0.949, landY, landY + 2.05, landZ + 0.15, backZ - 0.1), gs(dl * 0.5));
    poly(ctx, P, wallRect(0.948, landY + 0.95, landY + 1.0, backZ - 0.35, backZ - 0.2), gs(dl * 0.9 + 20));
    if (lit) {
      ctx.fillStyle = gs(30);
      const t = P(0.949, landY + 1.75, landZ + 0.55);
      ctx.font = '700 26px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('F', t[0] - 8, t[1]);
    }
  }
  SC.stairs_lit = (ctx) => stairs(ctx, true);
  SC.stairs_dark = (ctx) => stairs(ctx, false);

  SC.blackout = (ctx) => {
    const R = room(ctx, { w: 2.4, h: 2.6, z1: 18, amb: 0.15, fog: 0.07, lights: [], tile: 0.6 });
    dress(ctx, R, { pipe: -1 });
    [3.5, 9, 14].forEach((z) => door(ctx, R, -1, z));
    [5.5, 11.5].forEach((z) => door(ctx, R, 1, z));
    hydrant(ctx, R, 1, 8.3);
    bin(ctx, R, -1, 6.6);
    const { P } = R;
    poly(ctx, P, faceRect(-0.5, 0.5, 0, 2.05, 17.99), gs(14));
    // 쌍둥이 비상등
    poly(ctx, P, faceRect(-0.3, 0.3, 2.22, 2.36, 17.98), gs(40));
    [-0.2, 0.2].forEach((x) => {
      const c = P(x, 2.32, 17.95);
      ctx.beginPath();
      ctx.arc(c[0], c[1], 5, 0, Math.PI * 2);
      ctx.fillStyle = gs(255);
      ctx.fill();
      glow(ctx, c[0], c[1], 70, 0.4);
    });
    const em = P(0, 2.3, 17.9);
    glow(ctx, em[0], em[1], 260, 0.12);
    const f = P(0, 0, 16);
    glow(ctx, f[0], f[1], 140, 0.18, 0.25);
  };

  SC.exterior = (ctx, o) => {
    o = o || {};
    const dawn = !!o.dawn;
    const r = rng(7);
    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, gs(dawn ? 110 : 14));
    sky.addColorStop(0.7, gs(dawn ? 175 : 46));
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);
    // 전깃줄
    ctx.strokeStyle = gs(dawn ? 60 : 8);
    ctx.lineWidth = 1.5;
    [[0, 150, 600, 210, 300, 230], [0, 175, 600, 245, 300, 262], [0, 120, 600, 160, 300, 190]].forEach(([x0, y0, x1, y1, cx, cy]) => {
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.quadraticCurveTo(cx, cy, x1, y1);
      ctx.stroke();
    });
    const bx0 = 80;
    const bx1 = 540;
    const by0 = 250;
    const by1 = 900;
    const dark = (v) => gs(dawn ? v * 2.6 + 30 : v);
    // 옥상 물탱크, 안테나
    ctx.fillStyle = dark(12);
    ctx.fillRect(bx0 + 60, by0 - 70, 90, 56);
    ctx.fillRect(bx0 + 70, by0 - 14, 8, 14);
    ctx.fillRect(bx0 + 132, by0 - 14, 8, 14);
    ctx.fillRect(bx1 - 70, by0 - 120, 3, 106);
    ctx.fillRect(bx1 - 90, by0 - 100, 44, 3);
    ctx.fillRect(bx1 - 84, by0 - 82, 32, 3);
    // 건물
    const fac = ctx.createLinearGradient(0, by0, 0, by1);
    fac.addColorStop(0, gs(dawn ? 92 : 30));
    fac.addColorStop(1, gs(dawn ? 70 : 22));
    ctx.fillStyle = fac;
    ctx.fillRect(bx0, by0, bx1 - bx0, by1 - by0);
    ctx.fillStyle = dark(16);
    ctx.fillRect(bx0 - 6, by0 - 14, bx1 - bx0 + 12, 16);
    // 빗물 자국
    for (let k = 0; k < 14; k++) {
      ctx.fillStyle = 'rgba(0,0,0,' + (0.08 + r() * 0.12) + ')';
      ctx.fillRect(bx0 + r() * (bx1 - bx0), by0, 2 + r() * 6, 80 + r() * 380);
    }
    // 홈통
    ctx.fillStyle = dark(10);
    ctx.fillRect(bx1 - 14, by0, 6, by1 - by0);
    // 간판
    ctx.fillStyle = gs(dawn ? 120 : 40);
    ctx.fillRect(bx0 + 40, by0 + 20, bx1 - bx0 - 80, 46);
    ctx.fillStyle = gs(dawn ? 60 : 18);
    ctx.font = '800 32px "Nanum Myeongjo", serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('금 성 상 가', W / 2 + 10, by0 + 44);
    // 층마다 가로 간판
    // 위에서부터 5층, 4층(F), 3층, 2층. 4층에는 간판이 없다
    const signs = ['임    대', '', '한결수학   대한세무회계', '임    대'];
    // 창
    for (let f = 0; f < 4; f++) {
      const y = by0 + 100 + f * 128;
      if (signs[f]) {
        ctx.fillStyle = gs(dawn ? 105 : 26);
        ctx.fillRect(bx0 + 16, y - 26, bx1 - bx0 - 40, 20);
        ctx.fillStyle = gs(dawn ? 60 : 14);
        ctx.font = '700 13px "Nanum Gothic", sans-serif';
        ctx.fillText(signs[f], W / 2, y - 16);
      }
      for (let i = 0; i < 6; i++) {
        const x = bx0 + 22 + i * 74;
        const v = dawn ? 40 + r() * 30 : 10 + r() * 22;
        ctx.fillStyle = gs(v);
        ctx.fillRect(x, y, 56, 76);
        ctx.fillStyle = gs(v + (dawn ? 30 : 12));
        ctx.fillRect(x, y, 56, 6);
        // 창틀
        ctx.fillStyle = dark(8);
        ctx.fillRect(x + 27, y, 2, 76);
        ctx.fillRect(x, y + 38, 56, 2);
        // 블라인드 반쯤
        if (r() < 0.35) {
          ctx.globalAlpha = 0.5;
          for (let k = 0; k < 6; k++) ctx.fillRect(x, y + 8 + k * 5, 56, 2);
          ctx.globalAlpha = 1;
        }
        // 실외기
        if (r() < 0.28) {
          ctx.fillStyle = dark(14);
          ctx.fillRect(x + 6, y + 80, 44, 26);
          ctx.strokeStyle = dark(30);
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(x + 20, y + 93, 9, 0, Math.PI * 2);
          ctx.stroke();
        }
      }
    }
    // 세로 간판
    ctx.fillStyle = gs(dawn ? 115 : 34);
    ctx.fillRect(bx1 - 4, by0 + 90, 26, 300);
    ctx.fillStyle = gs(dawn ? 55 : 14);
    ctx.font = '800 17px "Nanum Gothic", sans-serif';
    ['노', '래', '방'].forEach((ch, i) => ctx.fillText(ch, bx1 + 9, by0 + 130 + i * 32));
    // 1층
    ctx.fillStyle = gs(dawn ? 50 : 14);
    ctx.fillRect(bx0, by1 - 130, bx1 - bx0, 130);
    // 셔터 내린 가게
    ctx.fillStyle = gs(dawn ? 75 : 20);
    ctx.fillRect(bx0 + 14, by1 - 112, 150, 112);
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    for (let k = 0; k < 22; k++) ctx.fillRect(bx0 + 14, by1 - 110 + k * 5, 150, 1.5);
    ctx.fillStyle = gs(dawn ? 85 : 52);
    ctx.fillRect(W / 2 - 80, by1 - 115, 160, 115);
    ctx.fillStyle = gs(dawn ? 40 : 10);
    ctx.fillRect(W / 2 - 2, by1 - 115, 4, 115);
    // 경비실 창
    if (!dawn) {
      ctx.fillStyle = gs(215);
      ctx.fillRect(bx1 - 110, by1 - 100, 62, 44);
      ctx.fillStyle = gs(120);
      ctx.fillRect(bx1 - 80, by1 - 100, 2, 44);
      glow(ctx, bx1 - 79, by1 - 78, 110, 0.4);
    } else {
      ctx.fillStyle = gs(60);
      ctx.fillRect(bx1 - 110, by1 - 100, 62, 44);
    }
    // 길과 연석
    ctx.fillStyle = gs(dawn ? 80 : 12);
    ctx.fillRect(0, by1, W, H - by1);
    ctx.fillStyle = gs(dawn ? 105 : 26);
    ctx.fillRect(0, by1 + 18, W, 5);
    // 앞에 선 차
    ctx.fillStyle = dark(6);
    ctx.beginPath();
    ctx.moveTo(-20, H);
    ctx.lineTo(-20, by1 + 40);
    ctx.quadraticCurveTo(60, by1 - 10, 150, by1 + 30);
    ctx.lineTo(200, by1 + 60);
    ctx.lineTo(210, H);
    ctx.fill();
    // 전봇대와 변압기
    ctx.fillStyle = dark(7);
    ctx.fillRect(28, 90, 9, by1 - 90 + 60);
    ctx.fillRect(10, 110, 46, 4);
    ctx.fillRect(14, 140, 38, 4);
    ctx.fillRect(38, 160, 20, 46);
    if (!dawn) {
      ctx.save();
      ctx.globalAlpha = 0.35;
      ctx.fillStyle = gs(180);
      ctx.fillRect(bx1 - 104, by1 + 30, 48, 60);
      ctx.restore();
      // 가로등
      ctx.fillStyle = gs(8);
      ctx.fillRect(28, 320, 46, 6);
      glow(ctx, 74, 330, 210, 0.5);
      glow(ctx, 80, by1 + 30, 160, 0.25, 0.3);
    }
  };
  SC.exterior_dawn = (ctx) => SC.exterior(ctx, { dawn: true });

  // CCTV 화면 공통 마감
  function cctv(ctx, label, stamp) {
    ctx.save();
    ctx.globalAlpha = 0.22;
    ctx.fillStyle = '#000';
    for (let y = 0; y < H; y += 4) ctx.fillRect(0, y, W, 2);
    ctx.restore();
    ctx.fillStyle = gs(220);
    ctx.font = '700 22px sans-serif';
    ctx.textBaseline = 'top';
    if (label) {
      ctx.textAlign = 'left';
      ctx.fillText(label, 30, 34);
    }
    if (stamp) {
      ctx.textAlign = 'right';
      ctx.fillText(stamp, W - 30, H - 60);
    }
  }

  function entrance(ctx, o) {
    const R = room(ctx, { w: 5, h: 3.2, z1: 7, eye: 2.4, f: 560, cy: H * 0.4, tile: 0.8, amb: 0.08, lights: [{ z: 2.5, on: 0.5 }], shine: 0.4 });
    dress(ctx, R, { wain: 1.1 });
    const { P } = R;
    // 바깥: 유리문 너머 길, 건너편 건물
    poly(ctx, P, faceRect(-2.4, 2.4, 0, 2.7, 6.99), gs(40));
    poly(ctx, P, faceRect(-2.4, 2.4, 0, 0.25, 6.995), gs(30));
    poly(ctx, P, faceRect(-2.4, -0.6, 0.9, 2.7, 6.997), gs(30));
    poly(ctx, P, faceRect(1.0, 2.4, 1.1, 2.7, 6.997), gs(28));
    const sl = P(1.8, 3.4, 9);
    glow(ctx, sl[0], sl[1], 160, 0.35);
    figure(ctx, P, 0.1, 7.6, 10, o);
    [-2.4, -1.2, 0, 1.2, 2.4].forEach((x) => line(ctx, P, [x, 0, 6.98], [x, 2.7, 6.98], 'rgba(0,0,0,0.85)', 4));
    line(ctx, P, [-2.4, 2.7, 6.98], [2.4, 2.7, 6.98], 'rgba(0,0,0,0.85)', 4);
    // 손잡이, 유리에 붙은 종이
    line(ctx, P, [-0.12, 0.9, 6.97], [-0.12, 1.4, 6.97], gs(130), 3);
    line(ctx, P, [0.12, 0.9, 6.97], [0.12, 1.4, 6.97], gs(130), 3);
    poly(ctx, P, faceRect(-1.0, -0.7, 1.4, 1.8, 6.97), gs(120));
    // 매트
    poly(ctx, P, [[-1.1, 0.003, 5.4], [1.1, 0.003, 5.4], [1.1, 0.003, 6.9], [-1.1, 0.003, 6.9]], gs(10));
  }
  SC.cam_umbrella = (ctx) => {
    entrance(ctx, { umbrella: true, h: 1.78 });
    cctv(ctx, 'CH1', '10-14  00:10:47');
  };
  SC.cam_cap = (ctx) => {
    entrance(ctx, { cap: true, h: 1.74 });
    cctv(ctx, 'CH1', '10-15  05:40:12');
  };

  SC.monitor = (ctx) => {
    ctx.fillStyle = gs(6);
    ctx.fillRect(0, 0, W, H);
    const bez = { x: 40, y: 190, w: 520, h: 600 };
    ctx.fillStyle = gs(30);
    ctx.fillRect(bez.x, bez.y, bez.w, bez.h);
    ctx.fillStyle = gs(14);
    ctx.fillRect(bez.x + 18, bez.y + 18, bez.w - 36, bez.h - 36);
    const keys = ['lobby', 'elevator', G.S && G.S.light3 ? 'corridor3_lit' : 'corridor3', 'parking'];
    const sw = (bez.w - 36 - 8) / 2;
    const sh = (bez.h - 36 - 8) / 2;
    keys.forEach((k, i) => {
      const c = canvas();
      SC[k](c.getContext('2d'));
      const x = bez.x + 18 + (i % 2) * (sw + 8);
      const y = bez.y + 18 + Math.floor(i / 2) * (sh + 8);
      ctx.save();
      ctx.filter = 'contrast(1.25) brightness(1.15)';
      ctx.drawImage(c, 0, (H - (W * sh) / sw) / 2, W, (W * sh) / sw, x, y, sw, sh);
      ctx.restore();
      ctx.fillStyle = gs(220);
      ctx.font = '700 14px sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText('CH' + (i + 1), x + 8, y + 8);
    });
    glow(ctx, W / 2, bez.y + bez.h / 2, 420, 0.12);
    cctv(ctx);
    // 책상 가장자리
    ctx.fillStyle = gs(20);
    ctx.fillRect(0, 860, W, 140);
  };

  // 오래된 인화지 느낌: 얼룩, 세로 긁힘, 먼지
  function grime(ctx, seed) {
    const r = rng(seed + 3);
    ctx.save();
    for (let i = 0; i < 26; i++) {
      const x = r() * W;
      const y = r() * H;
      const rad = 50 + r() * 190;
      const g = ctx.createRadialGradient(x, y, 0, x, y, rad);
      g.addColorStop(0, 'rgba(0,0,0,' + (0.05 + r() * 0.09) + ')');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.fillRect(x - rad, y - rad, rad * 2, rad * 2);
    }
    for (let i = 0; i < 9; i++) {
      ctx.fillStyle = 'rgba(' + (r() < 0.5 ? '0,0,0' : '255,255,255') + ',' + (0.04 + r() * 0.07) + ')';
      ctx.fillRect(r() * W, r() * H * 0.6, 1 + r() * 1.5, 120 + r() * 520);
    }
    for (let i = 0; i < 160; i++) {
      ctx.fillStyle = 'rgba(255,255,255,' + r() * 0.22 + ')';
      ctx.fillRect(r() * W, r() * H, 1 + r() * 1.5, 1 + r() * 2.5);
    }
    ctx.restore();
  }

  // ───────── 마감: 블러, 비네팅, 입자, 듀오톤 ─────────
  function finish(c, pal, seed) {
    const ctx = c.getContext('2d');
    const t = canvas();
    const tc = t.getContext('2d');
    if ('filter' in tc) tc.filter = 'blur(1.3px)';
    tc.drawImage(c, 0, 0);
    ctx.drawImage(t, 0, 0);
    // 밝은 곳 번짐
    const hb = canvas();
    const hc = hb.getContext('2d');
    if ('filter' in hc) hc.filter = 'blur(14px)';
    hc.drawImage(c, 0, 0);
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.globalAlpha = 0.32;
    ctx.drawImage(hb, 0, 0);
    ctx.restore();
    grime(ctx, seed);
    const v = ctx.createRadialGradient(W / 2, H * 0.48, H * 0.18, W / 2, H * 0.5, H * 0.78);
    v.addColorStop(0, 'rgba(0,0,0,0)');
    v.addColorStop(1, 'rgba(0,0,0,0.78)');
    ctx.fillStyle = v;
    ctx.fillRect(0, 0, W, H);

    const img = ctx.getImageData(0, 0, W, H);
    const a = img.data;
    const r = rng(seed);
    const [p0, p1, p2] = PAL[pal];
    for (let i = 0; i < a.length; i += 4) {
      let L = (a[i] * 0.3 + a[i + 1] * 0.59 + a[i + 2] * 0.11) / 255;
      L += (r() - 0.5) * 0.11;
      L = Math.max(0, Math.min(1, L));
      L = 0.6 * L + 0.4 * L * L * (3 - 2 * L);
      let q0;
      let q1;
      let k;
      if (L < 0.5) {
        q0 = p0;
        q1 = p1;
        k = L * 2;
      } else {
        q0 = p1;
        q1 = p2;
        k = (L - 0.5) * 2;
      }
      a[i] = q0[0] + (q1[0] - q0[0]) * k;
      a[i + 1] = q0[1] + (q1[1] - q0[1]) * k;
      a[i + 2] = q0[2] + (q1[2] - q0[2]) * k;
    }
    ctx.putImageData(img, 0, 0);
    return c.toDataURL('image/jpeg', 0.84);
  }

  const cache = {};
  function url(key) {
    const files = G.data.photoFiles || {};
    if (files[key]) return { src: files[key], file: true };
    if (!cache[key]) {
      const c = canvas();
      SC[key](c.getContext('2d'));
      cache[key] = finish(c, key === 'blackout' ? 'red' : 'khaki', key.length * 131 + 17);
    }
    return { src: cache[key] };
  }

  // ───────── 패널 ─────────
  let R = null;
  let current = null;
  let over = null;
  let front = 0;

  function show(key) {
    if (!R || !key || key === current || !SC[key]) return;
    current = key;
    let u;
    try {
      u = url(key);
    } catch (e) {
      return;
    }
    const next = R.imgs[1 - front];
    const prev = R.imgs[front];
    next.classList.toggle('file', !!u.file);
    next.onload = () => {
      next.classList.add('on');
      prev.classList.remove('on');
      front = 1 - front;
    };
    next.src = u.src;
  }

  function placeKey(S) {
    if (!S) return 'exterior';
    const dawn = S.t >= G.toM('05:00');
    switch (S.place) {
      case '경비실':
        return 'office';
      case '1F':
        return dawn ? 'lobby_dawn' : 'lobby';
      case '2F':
        return 'corridor2';
      case '3F':
        return S.light3 ? 'corridor3_lit' : 'corridor3';
      case 'B1':
        return 'parking';
      case 'F':
        return 'floorF';
    }
    return 'office';
  }

  const visible = () => R && getComputedStyle(R.el).display !== 'none';

  G.photo = {
    init() {
      const el = document.getElementById('photo');
      if (!el) return;
      R = { el, imgs: [...el.querySelectorAll('img')] };
      this.update();
      // 한가할 때 미리 그려 둔다
      const keys = Object.keys(SC);
      const idle = window.requestIdleCallback || ((f) => setTimeout(f, 200));
      const step = () => {
        const k = keys.shift();
        if (!k) return;
        if (visible() && !cache[k] && k !== 'monitor') {
          try {
            url(k);
          } catch (e) {}
        }
        idle(step);
      };
      idle(step);
    },
    override(key) {
      over = key;
      this.update();
    },
    update() {
      if (!visible()) return;
      show(over || (G.S && !G.S.ended ? placeKey(G.S) : 'exterior'));
    },
    show(key) {
      over = key;
      if (visible()) show(key);
    },
    keys: () => Object.keys(SC),
    src: (key) => url(key).src,
  };
})();
