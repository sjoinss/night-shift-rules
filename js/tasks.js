(function () {
  const G = window.G;
  const el = (tag, cls, txt) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (txt != null) e.textContent = txt;
    return e;
  };
  const tpl = (t) => G.engine.tpl(t);
  const T = (s) => G.toM(s);
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  const frame = () => new Promise((r) => requestAnimationFrame(r));

  // 누르고 있는 동안 진행되는 버튼. 숫자키나 짧은 클릭은 조금씩 민다.
  function holdButton(label, key) {
    const b = el('button', 'choice hold-go');
    b.type = 'button';
    b.append(el('span', 'k', key), el('span', 'lbl', label));
    const st = { down: false, nudge: 0, at: 0 };
    const on = () => {
      st.down = true;
      st.at = performance.now();
      b.classList.add('down');
    };
    const off = () => {
      if (st.down && performance.now() - st.at < 160) {
        st.nudge += 1;
        // 짧게 누르면 밑줄이 조금 찼다 빠진다. 더 누르고 있으라는 신호
        b.classList.remove('tap');
        void b.offsetWidth;
        b.classList.add('tap');
      }
      st.down = false;
      b.classList.remove('down');
    };
    b.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      try {
        b.setPointerCapture(e.pointerId);
      } catch (x) {}
      on();
    });
    ['pointerup', 'pointercancel', 'lostpointercapture'].forEach((n) => b.addEventListener(n, off));
    b.addEventListener('keydown', (e) => {
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        if (!st.down) on();
      }
    });
    b.addEventListener('keyup', (e) => {
      if (e.key === ' ' || e.key === 'Enter') {
        st.down = false;
        b.classList.remove('down');
      }
    });
    // 숫자키(keyMap)는 click()으로 들어온다
    b.addEventListener('click', (e) => {
      if (e.detail === 0) st.nudge += 1;
    });
    const stop = () => {
      st.down = false;
      st.nudge = 0;
      b.classList.remove('down');
    };
    return { b, st, stop };
  }

  // 여러 버튼 중 하나를 고를 때까지
  function buttons(list, cls) {
    return new Promise((resolve) => {
      const row = el('div', 'task-row ' + (cls || ''));
      const keys = {};
      list.forEach((o, i) => {
        const b = el('button', 'slot-b');
        b.type = 'button';
        b.append(el('span', 'k', String(i + 1)), el('span', null, o.label));
        b.addEventListener('click', () => {
          G.ui.release();
          resolve(o.id);
        });
        row.append(b);
        keys[String(i + 1)] = b;
      });
      G.ui.controls(row, keys);
    });
  }

  // 글자를 깨뜨린다. a: 0~1
  const SHARD = ['░', '▒', '▓', '│', '╎'];
  function crack(s, a) {
    return [...s]
      .map((ch) => {
        if (!ch.trim() || Math.random() > a) return ch;
        const d = G.fx.decompose(ch);
        return d !== ch && Math.random() < 0.55 ? d[Math.floor(Math.random() * d.length)] : pick(SHARD);
      })
      .join('');
  }

  // ───────── 파쇄 ─────────
  // sheet: { head, lines, bin?, voice?: {at, sfx}, flip?: {at, line, to}, jam?: {at, extra, after}, after?, pocket? }
  const STRIP = ['│', '║', '┃', '╎', '╏', '┆', '|'];

  async function shredSheet(g, sh) {
    const wrap = el('div', 'task shred');
    const win = el('div', 'sd-win');
    const paper = el('div', 'sd-paper');
    const rows = [];
    const addRow = (t, cls) => {
      const p = el('p', 'sd-l' + (cls ? ' ' + cls : ''), tpl(t) || ' ');
      rows.push({ p, orig: p.textContent });
      paper.append(p);
    };
    paper.append(el('p', 'sd-h', tpl(sh.head)));
    sh.lines.forEach((t) => addRow(t));
    win.append(paper);
    const slot = el('div', 'sd-slot');
    const bin = el('p', 'sd-bin');
    bin.setAttribute('aria-hidden', 'true');
    wrap.append(win, slot, bin);
    G.ui.release();
    G.ui.block(wrap);
    await frame();
    let H = paper.offsetHeight;
    win.style.height = H + 'px';

    const binSrc = sh.bin ? [...tpl(sh.bin).replace(/\s/g, '')] : null;
    let binI = 0;
    let binN = 0;
    const feedBin = (n) => {
      for (let i = 0; i < n; i++) {
        if (binSrc && Math.random() < 0.28) bin.textContent += binSrc[binI++ % binSrc.length];
        else bin.textContent += pick(STRIP);
      }
      if (bin.textContent.length > 90) bin.textContent = bin.textContent.slice(-90);
    };

    let p = 0;
    let lastCrack = 0;
    let lastGrind = 0;
    let voiced = false;
    let flipped = false;
    let jammed = false;
    const render = (now) => {
      paper.style.transform = 'translateY(' + p * H + 'px)';
      if (now - lastCrack < 70) return;
      lastCrack = now;
      rows.forEach((r) => {
        const top = r.p.offsetTop;
        const h = r.p.offsetHeight || 20;
        const d = H - (top + h + p * H);
        // 넣기 전에는 멀쩡하다
        const a = p > 0 ? Math.max(0, Math.min(1, 1 - d / (h * 1.6))) : 0;
        r.p.textContent = a > 0.05 ? crack(r.orig, a) : r.orig;
      });
    };

    const feed = async (speed, until) => {
      const hb = holdButton(speed > 0 ? '넣는다' : '역회전', '1');
      G.ui.controls(hb.b, { 1: hb.b });
      let last = performance.now();
      for (;;) {
        const now = await frame().then(() => performance.now());
        const dt = Math.min(64, now - last);
        last = now;
        let dp = 0;
        if (hb.st.down) dp += dt / Math.abs(speed);
        if (hb.st.nudge) {
          dp += 0.07 * hb.st.nudge;
          hb.st.nudge = 0;
        }
        if (dp) {
          const before = p;
          p = Math.max(0, Math.min(1, p + Math.sign(speed) * dp));
          if (now - lastGrind > 150) {
            lastGrind = now;
            G.audio.sfx(speed > 0 ? 'grind' : 'rewind', 0.7);
          }
          if (speed > 0) {
            binN += (p - before) * 40;
            if (binN >= 1) {
              feedBin(Math.floor(binN));
              binN -= Math.floor(binN);
            }
          }
        }
        render(now);
        if (speed > 0 && sh.voice && !voiced && p >= sh.voice.at) {
          voiced = true;
          G.audio.sfx(sh.voice.sfx, 1);
        }
        if (speed > 0 && sh.flip && !flipped && p >= sh.flip.at) {
          flipped = true;
          rows[sh.flip.line].orig = tpl(sh.flip.to);
        }
        if (speed > 0 && sh.jam && !jammed && p >= sh.jam.at) {
          jammed = true;
          hb.stop();
          G.audio.sfx('thud');
          return 'jam';
        }
        if (until(p)) {
          hb.stop();
          return 'ok';
        }
      }
    };

    let r = await feed(1900, (x) => x >= 1);
    if (r === 'jam') {
      G.ui.release();
      await g.p({ t: '기계가 컥 소리를 내며 멈춘다. 종이가 반쯤 물린 채다.', c: 'dim' });
      await feed(-1300, (x) => x <= 0);
      rows.forEach((row) => (row.p.textContent = row.orig));
      sh.jam.extra.forEach((t) => addRow(t, 'hand'));
      H = paper.offsetHeight;
      win.style.height = H + 'px';
      G.ui.release();
      await g.p(sh.jam.after);
      const c = await g.choose([
        { id: 'in', label: '다시 넣는다' },
        { id: 'keep', label: '접어서 주머니에 넣는다' },
      ]);
      if (c === 'keep') {
        win.classList.add('kept');
        if (sh.pocket) sh.pocket(g);
        G.engine.pushLog(tpl(sh.head) + '  (주머니)', 'dim');
        return 'kept';
      }
      r = await feed(1900, (x) => x >= 1);
    }
    G.ui.release();
    win.style.height = '0px';
    win.classList.add('gone');
    // 다 갈린 종이는 조각 줄만 남긴다
    slot.hidden = true;
    G.engine.pushLog('파쇄  ' + (tpl(sh.head) || '종이 한 장'), 'dim');
    if (sh.after) await g.p(sh.after);
    return 'done';
  }

  async function shred(g, sheets) {
    for (const sh of sheets) {
      if (sh.before) await g.p(sh.before);
      await shredSheet(g, sh);
    }
    G.ui.release();
  }

  const shake = (b) => {
    b.classList.remove('shake');
    void b.offsetWidth;
    b.classList.add('shake');
  };

  // 버티는 것을 당긴다. 누르고 있으면 당기고, 놓으면 안쪽으로 끌려 들어간다.
  async function tug(g, st) {
    if (st.before) await g.p(st.before);
    const wrap = el('div', 'tug');
    const bar = el('span', 'tug-bar');
    bar.setAttribute('aria-hidden', 'true');
    const hb = holdButton('당긴다', '1');
    wrap.append(hb.b, bar);
    G.ui.controls(wrap, { 1: hb.b });
    let p = 0.15;
    let last = performance.now();
    let nextYank = last + 900 + Math.random() * 700;
    for (;;) {
      const now = await frame().then(() => performance.now());
      const dt = Math.min(64, now - last);
      last = now;
      if (hb.st.down) p += dt / 2100;
      else p -= dt / 1500;
      if (hb.st.nudge) {
        p += 0.05 * hb.st.nudge;
        hb.st.nudge = 0;
      }
      // 안에서 한 번씩 확 잡아당긴다
      if (now > nextYank) {
        nextYank = now + 900 + Math.random() * 900;
        if (p > 0.25) {
          p -= 0.18;
          G.audio.sfx('thud', 0.5);
          shake(wrap);
        }
      }
      p = Math.max(0, Math.min(1, p));
      const n = Math.round(p * 16);
      bar.textContent = '▮'.repeat(n) + '▯'.repeat(16 - n);
      if (p >= 1) break;
    }
    hb.stop();
    G.ui.release();
    if (st.after) await g.p(st.after);
  }

  // ───────── 우편함 정리 ─────────
  // 칸마다 삐져나온 우편물(▤)을 눌러서 뽑는다.
  // cfg: { stuff: [칸], flyers: [뽑을 때마다 나오는 글], stubborn?: {slot, got, before, after}, late?: {label, appear, lines, got} }
  const MAILROWS = [
    ['101', '102', '103', '104', '105', '106', '107', '108'],
    ['201', '202', '203', '204', '205', '206', '207', '208'],
    ['301', '302', '303', '304', '305', '306', '307', '308'],
    ['B101', 'B102', 'B103', 'B104', 'B105', 'B106', 'B107', 'B108'],
  ];
  async function mailbox(g, cfg) {
    const box = el('div', 'task mbox');
    const grid = el('div', 'mgrid');
    box.append(grid);
    const status = el('p', 'task-n');
    let need = cfg.stuff.length + (cfg.stubborn ? 1 : 0);
    let got = 0;
    let flyer = 0;
    let busy = false;
    let finish;
    let done = new Promise((r) => (finish = r));
    const upd = (txt) => (status.textContent = '뽑은 것 ' + got + ' / ' + need + (txt ? '    ' + txt : ''));
    upd();

    const slot = (label, kind) => {
      const b = el('button', 'mslot' + (kind ? ' stuff' : ''));
      b.type = 'button';
      const mouth = el('i', null, kind ? '▤' : '');
      b.append(el('span', 'ml', label), mouth);
      b.setAttribute('aria-label', label + (kind ? ' 우편물 있음' : ''));
      b.addEventListener('click', async () => {
        if (busy) return;
        if (!b.classList.contains('stuff')) return shake(b);
        busy = true;
        let txt;
        if (kind === 'stubborn') {
          await tug(g, cfg.stubborn);
          txt = tpl(cfg.stubborn.got);
        } else if (kind === 'late') {
          b.classList.remove('stuff');
          mouth.textContent = '';
          await g.p(cfg.late.lines);
          txt = cfg.late.got ? tpl(cfg.late.got) : '';
        } else {
          txt = tpl(cfg.flyers[Math.min(flyer, cfg.flyers.length - 1)]);
          flyer++;
        }
        b.classList.remove('stuff');
        b.classList.add('out');
        mouth.textContent = '';
        got++;
        G.audio.sfx('page', 0.4);
        upd(txt);
        G.ui.controls(status);
        busy = false;
        if (got === need) finish();
      });
      return b;
    };
    MAILROWS.flat().forEach((l) => {
      const kind = cfg.stubborn && cfg.stubborn.slot === l ? 'stubborn' : cfg.stuff.includes(l) ? 'flyer' : null;
      grid.append(slot(l, kind));
    });
    G.ui.release();
    G.ui.block(box);
    G.ui.controls(status);
    await done;
    if (cfg.late) {
      // 다 뽑고 나면 맨 아래에 없던 칸이 하나
      await g.p(cfg.late.appear);
      const b = slot(cfg.late.label, 'late');
      b.classList.add('extra');
      grid.append(b);
      need++;
      upd();
      G.ui.controls(status);
      done = new Promise((r) => (finish = r));
      await done;
    }
    grid.querySelectorAll('button').forEach((b) => (b.disabled = true));
    box.classList.add('closed');
    G.ui.release();
    G.engine.pushLog('우편함 정리  ' + got + '통', 'dim');
  }

  // ───────── 열쇠 걸기 ─────────
  // 반납함에서 꺼낸 열쇠를 태그 번호와 같은 고리에 건다.
  // cfg: { hooks: [{label, key}], keys: [{tag, hook, note?, newHook?, newHookNote?, after?}], done }
  async function hangKeys(g, cfg) {
    const box = el('div', 'task keys');
    const grid = el('div', 'keybox');
    box.append(grid);
    const hand = el('p', 'task-n');
    let busy = false;
    let want = null;
    let hinted = false;
    let resolveHang;
    const addHook = (h) => {
      const b = el('button', 'hook' + (h.key ? ' has' : '') + (h.extra ? ' extra' : ''));
      b.type = 'button';
      const mark = el('i', null, h.key ? '●' : '○');
      b.append(el('span', 'hl', h.label), mark);
      b.setAttribute('aria-label', h.label + (h.key ? ' 열쇠 있음' : ' 비어 있음'));
      b.addEventListener('click', async () => {
        if (busy || !want) return;
        if (h.label !== want.hook || h.key) {
          shake(b);
          if (!hinted) {
            hinted = true;
            busy = true;
            await g.p({ t: '태그 번호와 고리 번호가 다르다.', c: 'th' });
            busy = false;
            G.ui.controls(hand);
          }
          return;
        }
        h.key = true;
        mark.textContent = '●';
        b.classList.add('has', 'ok');
        b.setAttribute('aria-label', h.label + ' 열쇠 있음');
        G.audio.sfx('pen', 0.5);
        resolveHang();
      });
      grid.append(b);
    };
    cfg.hooks.forEach(addHook);
    G.ui.release();
    G.ui.block(box);
    for (let i = 0; i < cfg.keys.length; i++) {
      const k = cfg.keys[i];
      want = k;
      hand.textContent = '손에 든 열쇠  [' + tpl(k.tag) + ']    남은 열쇠 ' + (cfg.keys.length - i);
      if (k.note) {
        busy = true;
        await g.p(k.note);
        busy = false;
      }
      if (k.newHook) {
        addHook({ label: k.hook, key: false, extra: true });
        if (k.newHookNote) await g.p(k.newHookNote);
      }
      G.ui.controls(hand);
      await new Promise((r) => (resolveHang = r));
      want = null;
      if (k.after) await g.p(k.after);
    }
    grid.querySelectorAll('button').forEach((b) => (b.disabled = true));
    box.classList.add('closed');
    G.ui.release();
    G.engine.pushLog('열쇠 ' + cfg.keys.length + '개 제자리에', 'dim');
    if (cfg.done) await g.p(cfg.done);
  }

  // ───────── 열쇠 구멍 ─────────
  // 글자로 그린 눈. px: -1(왼쪽)~1(오른쪽)
  // mode: open | near(가까이) | white(흰자만) | shut(감음) | smile(웃는 눈)
  function eyeArt(px, mode) {
    // 9줄짜리 눈. 바깥 테두리는 그대로 두고 안쪽만 바꾼다
    const rows = [
      '            _.--~~~~~~~~~--._            ',
      '       _.-~~                 ~~-._       ',
      '    .~~                           ~~.    ',
      '   (                                 )   ',
      '  (                                   )  ',
      '   (                                 )   ',
      '    `~~.                         .~~`    ',
      '        `~-._               _.-~`        ',
      '             `~~~~~~~~~~~~~`             ',
    ].map((r) => [...r]);
    const put = (r, c, s) => [...s].forEach((ch, i) => (rows[r][c + i] = ch));
    const blank = (r) => {
      const a = rows[r].join('');
      const l = a.search(/[^ ]/);
      const rr = a.length - [...a].reverse().join('').search(/[^ ]/) - 1;
      for (let i = l + 1; i < rr; i++) rows[r][i] = ' ';
    };
    if (mode === 'shut') {
      put(4, 4, '~'.repeat(33));
    } else if (mode === 'white') {
      // 눈동자가 위로 넘어가 흰자만. 실핏줄
      put(3, 12, '~  .   ~ .  ~');
      put(5, 15, '.  ~  .');
    } else {
      const cx = 21 + Math.round(px * 7);
      const big = mode === 'near' || mode === 'smile';
      put(2, cx - 5, ' .-----. ');
      put(3, cx - 5, '/  .-.  \\');
      put(4, cx - 5, big ? '| (@@@) |' : '|  (@)  |');
      put(5, cx - 5, '\\  `-`  /');
      put(6, cx - 5, " `-----` ");
      if (mode === 'smile') {
        // 아래 눈꺼풀이 올라와 눈이 웃는다
        blank(6);
        blank(7);
        put(5, 3, '`~~.' + '~'.repeat(27) + '.~~`');
        put(6, 3, ' '.repeat(35));
        put(7, 3, ' '.repeat(35));
        put(8, 3, ' '.repeat(35));
      }
    }
    return rows.map((r) => r.join('')).join('\n');
  }

  // 문짝에 난 열쇠 구멍 하나. 처음엔 로비 불빛이 비치다가, 무언가 막으면 어두워진다.
  async function peek(g) {
    const door = el('div', 'task door');
    const wrap = el('div', 'kh');
    const hole = el('div', 'hole light');
    const pre = el('pre', 'eye');
    pre.setAttribute('aria-hidden', 'true');
    hole.append(pre);
    wrap.append(hole);
    door.append(wrap, el('p', 'sr-only', '열쇠 구멍 너머로 로비 불빛이 보이다가, 눈이 구멍을 막는다. 이리저리 구르다가 당신을 본다.'));
    G.ui.release();
    G.ui.block(door);
    const W = (ms) => G.ui.pause(ms);
    const show = async (px, mode, ms) => {
      pre.textContent = eyeArt(px, mode);
      await W(ms);
    };
    // 로비 불빛. 아무것도 없다
    await W(1400);
    // 불빛이 가려진다
    hole.classList.remove('light');
    await W(700);
    hole.classList.add('lit');
    await show(-1, 'open', 900);
    // 이리저리 굴린다
    for (const x of [-0.6, -0.2, 0.2, 0.6, 1, 1, 0.5, 0, -0.5, -1]) await show(x, 'open', 110);
    await show(-1, 'open', 400);
    await show(0, 'white', 700);
    await show(0, 'shut', 120);
    await show(0, 'open', 800);
    G.audio.sfx('thud', 0.4);
    hole.classList.add('near');
    await show(0, 'near', 1400);
    await show(0, 'shut', 110);
    await show(0, 'near', 500);
    await show(0, 'smile', 1400);
    // 눈은 안 보이는데 구멍은 계속 막혀 있다
    hole.classList.remove('lit', 'near');
    G.engine.pushLog('열쇠 구멍 너머의 눈', 'dim');
  }

  // ───────── 녹화 되감기 ─────────
  // 장면이 바뀌면 글이 끝에서부터 지워지고, 앞 장면 글이 뒤에서부터 거꾸로 써진다.
  // cfg: { ch, from, to, frames: [{ at, lines, stop?, say? }], after }
  async function tape(g, cfg) {
    const mon = el('div', 'task mon');
    const head = el('p', 'mon-h');
    const tEl = el('span', 'mon-t');
    head.append(el('span', null, cfg.ch), tEl);
    const body = el('p', 'mon-b');
    const noise = el('span', 'mon-noise');
    noise.setAttribute('aria-hidden', 'true');
    mon.append(head, body, noise);
    G.ui.release();
    G.ui.block(mon);

    const frames = cfg.frames.map((f) => Object.assign({ m: T(f.at) }, f)).sort((a, b) => b.m - a.m);
    const end = T(cfg.to);
    let cur = T(cfg.from);
    let shown = null;
    let disp = '';
    let job = 0;
    const paint = (s, edge) => {
      // 지워지는 끝자리에 부스러기
      body.textContent = s + (edge ? crack(edge, 0.9) : '');
    };
    const rewrite = async (target) => {
      const my = ++job;
      while (disp.length) {
        if (my !== job) return;
        disp = [...disp].slice(0, -3).join('');
        paint(disp, '▒▒');
        await frame();
      }
      const chars = [...target];
      let k = chars.length;
      while (k > 0) {
        if (my !== job) return;
        k = Math.max(0, k - 2);
        disp = chars.slice(k).join('');
        // 아직 안 써진 앞부분은 빈칸으로 자리만 잡는다
        paint(chars.slice(0, k).map((c) => (c === '\n' ? '\n' : ' ')).join('') + disp);
        await frame();
      }
      paint(disp);
    };
    const show = (f, instant) => {
      if (f === shown) return null;
      shown = f;
      const text = (f ? f.lines : ['…']).map(tpl).join('\n');
      if (instant) {
        disp = text;
        paint(disp);
        return null;
      }
      return rewrite(text);
    };
    const frameAt = (m) => frames.find((f) => f.m <= m) || frames[frames.length - 1];
    const stamp = (m) => {
      const s = String(Math.floor(Math.random() * 60)).padStart(2, '0');
      tEl.textContent = '◀◀ ' + G.fmt(Math.round(m)) + ':' + s;
    };
    show(frameAt(cur), true);
    tEl.textContent = '■ ' + G.fmt(cur);

    const stops = new Set();
    let hb = holdButton('되감는다', '1');
    G.ui.controls(hb.b, { 1: hb.b });
    let last = performance.now();
    let lastSnd = 0;
    while (cur > end) {
      const now = await frame().then(() => performance.now());
      const dt = Math.min(64, now - last);
      last = now;
      let dm = 0;
      if (hb.st.down) dm += dt / 40;
      if (hb.st.nudge) {
        dm += 6 * hb.st.nudge;
        hb.st.nudge = 0;
      }
      mon.classList.toggle('rew', !!dm);
      if (!dm) continue;
      // 화면을 위아래로 훑는 잡음 줄
      noise.textContent = Array.from({ length: 30 }, () => pick(['░', '▒', '▓', ' ', ' '])).join('');
      noise.style.top = Math.floor(Math.random() * 70) + 15 + '%';
      const next = Math.max(end, cur - dm);
      // 멈춰야 할 장면을 지나치지 않는다
      const st = frames.find((f) => f.stop && !stops.has(f) && f.m < cur && f.m >= next);
      cur = st ? st.m : next;
      if (now - lastSnd > 140) {
        lastSnd = now;
        G.audio.sfx('rewind', 0.5);
      }
      stamp(cur);
      const w = show(frameAt(cur));
      if (st) {
        stops.add(st);
        hb.stop();
        mon.classList.remove('rew');
        tEl.textContent = '❚❚ ' + G.fmt(cur);
        if (w) await w;
        if (st.say) {
          G.ui.release();
          await g.p(st.say);
          hb = holdButton('계속 되감는다', '1');
          G.ui.controls(hb.b, { 1: hb.b });
        }
      }
    }
    hb.stop();
    mon.classList.remove('rew');
    tEl.textContent = '■ ' + G.fmt(end);
    G.ui.release();
    mon.classList.add('closed');
    G.engine.pushLog(cfg.ch + '  ' + cfg.from + ' → ' + cfg.to + ' 되감기', 'dim');
    if (cfg.after) await g.p(cfg.after);
  }

  // ───────── 글자 그림 ─────────
  function artBlock(cls, label) {
    const box = el('div', 'task art ' + (cls || ''));
    const pre = el('pre', 'art-pre');
    pre.setAttribute('aria-hidden', 'true');
    box.append(pre);
    if (label) box.append(el('p', 'sr-only', label));
    G.ui.block(box);
    return { box, pre };
  }

  // 04:50 문 아래 틈. 새어 드는 불빛을 발 그림자가 가린다.
  function doorGap() {
    const { box, pre } = artBlock('gap', '문 아래 틈으로 새는 불빛을 발 그림자 두 개가 가리고 있다.');
    const Wd = 30;
    const side = '│' + ' '.repeat(Wd - 2) + '│';
    pre.textContent = [side, side, side, '└' + '─'.repeat(Wd - 2) + '┘'].join('\n');
    // 틈으로 새는 불빛만 따로, 밝게. 그림자는 빈칸이다
    const light = el('pre', 'art-pre gap-light');
    light.setAttribute('aria-hidden', 'true');
    box.insertBefore(light, pre.nextSibling);
    let feet = [10, 16];
    let mode = 'two';
    const draw = () => {
      const strip = Array.from({ length: Wd }, () => '█');
      if (mode !== 'gone')
        feet.forEach((x) => {
          for (let i = 0; i < 3; i++) if (x + i >= 0 && x + i < Wd) strip[x + i] = ' ';
        });
      light.textContent = strip.join('');
    };
    draw();
    const iv = setInterval(() => {
      if (mode !== 'two') return;
      // 무게를 옮겨 싣듯 조금씩 들썩인다
      feet = feet.map((x) => Math.max(1, Math.min(Wd - 4, x + (Math.random() < 0.3 ? (Math.random() < 0.5 ? -1 : 1) : 0))));
      draw();
    }, 650);
    return {
      three() {
        mode = 'three';
        feet = [feet[0], feet[1], Math.min(Wd - 4, feet[1] + 5)];
        draw();
      },
      gone() {
        mode = 'gone';
        draw();
      },
      stop() {
        clearInterval(iv);
      },
    };
  }

  // CCTV 네 칸. 3층 복도는 볼 때마다 한 줄씩 가까워진다.
  function cctv(S) {
    const t = S.t;
    const n = S.done.cctv_n || 0;
    S.done.cctv_n = n + 1;
    const CW = 15;
    const fit = (rows) => rows.map((r) => (r + ' '.repeat(CW)).slice(0, CW));
    const night = t >= T('00:00') && t < T('03:17');
    const after = t >= T('03:17') && t < T('05:00');
    let c1;
    if (night && !S.flags.letChief) c1 = ['   ║       ║', '   ║   _   ║', '   ║  /|\\  ║', '   ║   |   ║', '  =╩=======╩='];
    else if (S.flags.letChief && t < T('05:00')) c1 = ['   ║       ║', '   ║       ║', '   ║       ║', '   ║  . .  ║', '  =╩==.=.==╩='];
    else c1 = ['   ║       ║', '   ║       ║', '   ║       ║', '   ║       ║', '  =╩=======╩='];
    const fl = after ? 'F' : night ? ' ' : '1';
    let c2 = ['    [ ' + fl + ' ]', '   ┌───┬───┐', '   │   │   │', '   │   │   │', '   └───┴───┘'];
    let c3;
    if (!S.light3) c3 = ['', '   ░░░░░░░░', '  ░░▒▒▒▒▒▒░░', ' ░▒▒▓▓▓▓▓▓▒▒░', ''];
    else {
      const k = Math.min(3, n + (after ? 1 : 0));
      c3 = [
        ['      . . .', '      : : :', '', '', ''],
        ['    o  o  o', '    |  |  |', '', '', ''],
        ['', '  o   o   o', '  |   |   |', ' / \\ / \\ / \\', ''],
        ['  O    O    O', ' /|\\  /|\\  /|\\', '  |    |    |', ' / \\  / \\  / \\', ''],
      ][k];
    }
    let c4;
    if (after) c4 = ['   ________', '  |  [==]  |', '  |________|', '     |_|', '     / \\'];
    else if (t < T('00:00')) c4 = ['', '   ______', '  /|_||_\\`.', ' (  _    _ )', '  `(_)--(_)`'];
    else if (t < T('03:17')) c4 = ['', '   ______', '  /|_||_\\`.', ' (  _    _ )', '  `(_)--(_)'];
    else c4 = ['', '', '', '   .  ..  .', '  ==========='];
    [c1, c2, c3, c4] = [c1, c2, c3, c4].map(fit);
    const rows = ['┌1' + '─'.repeat(CW - 1) + '┬2' + '─'.repeat(CW - 1) + '┐'];
    for (let i = 0; i < 5; i++) rows.push('│' + c1[i] + '│' + c2[i] + '│');
    rows.push('├3' + '─'.repeat(CW - 1) + '┼4' + '─'.repeat(CW - 1) + '┤');
    for (let i = 0; i < 5; i++) rows.push('│' + c3[i] + '│' + c4[i] + '│');
    rows.push('└' + '─'.repeat(CW) + '┴' + '─'.repeat(CW) + '┘');
    const { pre } = artBlock('cctv', 'CCTV 네 칸 화면.');
    pre.textContent = rows.join('\n');
  }

  // 3층 복도 불. 먼 쪽부터 하나씩 켜지며 다가온다. 켜진 등 아래마다 누가 서 있다.
  async function lamps() {
    const { pre } = artBlock('lamps', '복도 형광등이 먼 쪽부터 하나씩 켜진다. 켜진 등 아래마다 사람이 서 있다.');
    const N = 8;
    const fig = new Set([2, 4, 5, 7]);
    const draw = (k) => {
      const a = [];
      const b = [];
      const c = [];
      for (let i = 0; i < N; i++) {
        const on = i < k;
        a.push(on ? '■' : '□');
        b.push(on && fig.has(i) ? 'o' : ' ');
        c.push(on && fig.has(i) ? '|' : ' ');
      }
      pre.textContent = [a.join('   '), b.join('   '), c.join('   '), '─'.repeat(N * 4 - 3)].join('\n');
    };
    draw(0);
    for (let k = 1; k <= N; k++) {
      await G.ui.pause(k === N ? 900 : 380);
      G.audio.sfx('thud', 0.15);
      draw(k);
    }
  }

  // 일지가 혼자 써진다
  async function selfWrite(rows, text) {
    const box = el('div', 'task jpage');
    rows.forEach((r) => box.append(el('p', 'jl', r)));
    const line = el('p', 'jl hand');
    box.append(line);
    box.append(el('p', 'sr-only', '빈 줄에 글씨가 저절로 써진다. ' + text));
    G.ui.block(box);
    await G.ui.pause(900);
    const chars = [...text];
    for (let i = 0; i < chars.length; i++) {
      line.textContent += chars[i];
      if (i % 3 === 0) G.audio.sfx('pen', 0.5);
      await G.ui.pause(chars[i] === ' ' ? 90 : 170);
    }
  }

  // 03:17 인터폰 네 대의 소리 모양. 똑같이 움직이다가 하나만 어긋난다.
  function waves() {
    const { pre } = artBlock('waves', '인터폰 네 대의 소리 모양이 똑같이 움직인다.');
    const L = ['1F', '2F', '3F', 'B1'];
    const Wd = 24;
    const bars = '▁▂▃▄▅▆▇';
    let tick = 0;
    let odd = -1;
    let mode = 'talk';
    const draw = () => {
      tick++;
      const base = Array.from({ length: Wd }, (_, i) => Math.abs(Math.sin((i + tick) * 0.55)) * Math.abs(Math.sin((i + tick) * 0.17)));
      pre.textContent = L.map((lab, r) => {
        let s = base.map((v) => (mode === 'flat' ? '▁' : bars[Math.min(6, Math.floor(v * 7))]));
        if (r === odd && mode === 'talk') s = s.map((_, i) => bars[(i * 3 + tick * 5) % 7]);
        return lab + ' ' + s.join('');
      }).join('\n');
    };
    draw();
    const iv = setInterval(draw, 120);
    return {
      desync() {
        odd = 3;
      },
      flat() {
        mode = 'flat';
        draw();
      },
      stop() {
        clearInterval(iv);
      },
    };
  }

  // 엘리베이터 층 표시. 숫자가 되다 만 모양이 깜박인다.
  async function floorLCD() {
    const box = el('div', 'task flr');
    const caseEl = el('div', 'lcd-case');
    const host = el('div', 'lcd');
    caseEl.append(host);
    box.append(caseEl, el('p', 'sr-only', '층 표시에 숫자가 되다 만 모양이 깜박이다가 F에서 멈춘다.'));
    G.ui.block(box);
    const lcd = G.ui.buildLCD(host);
    lcd.digits.slice(0, 2).forEach((d) => (d.a.parentNode.style.display = 'none'));
    lcd.colon.style.display = 'none';
    const set = (d, on) => Object.keys(d).forEach((k) => d[k].setAttribute('class', on.includes(k) ? 'seg on' : 'seg'));
    const rnd = () => 'abcdefg'.split('').filter(() => Math.random() < 0.45).join('');
    const end = performance.now() + 2600;
    while (performance.now() < end) {
      set(lcd.digits[2], rnd());
      set(lcd.digits[3], rnd());
      await G.ui.pause(110);
    }
    set(lcd.digits[2], '');
    set(lcd.digits[3], 'afge');
  }

  G.task = { shred, mailbox, hangKeys, peek, tape, buttons, doorGap, cctv, lamps, selfWrite, waves, floorLCD };
})();
