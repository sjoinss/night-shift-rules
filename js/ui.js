(function () {
  const G = window.G;
  const $ = (s, r) => (r || document).querySelector(s);
  const el = (tag, cls, txt) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (txt != null) e.textContent = txt;
    return e;
  };
  const T = (s) => G.toM(s);

  let R = {};
  let skipping = false;
  let typing = false;
  let keyMap = null; // 숫자키 → 버튼
  let docOpen = null;
  let docResolve = null;
  let lastFocus = null;

  // ───────── LCD 시계 ─────────
  const SEG = {
    a: [6, 0, 24, 6, 'h'],
    b: [30, 6, 6, 24, 'v'],
    c: [30, 34, 6, 24, 'v'],
    d: [6, 58, 24, 6, 'h'],
    e: [0, 34, 6, 24, 'v'],
    f: [0, 6, 6, 24, 'v'],
    g: [6, 29, 24, 6, 'h'],
  };
  const DIG = ['abcdef', 'bc', 'abged', 'abgcd', 'fgbc', 'afgcd', 'afgedc', 'abc', 'abcdefg', 'abcdfg'];
  function segPoly(x, y, w, h, o) {
    const p =
      o === 'h'
        ? [[x, y + h / 2], [x + h / 2, y], [x + w - h / 2, y], [x + w, y + h / 2], [x + w - h / 2, y + h], [x + h / 2, y + h]]
        : [[x + w / 2, y], [x + w, y + w / 2], [x + w, y + h - w / 2], [x + w / 2, y + h], [x, y + h - w / 2], [x, y + w / 2]];
    return p.map((q) => q.join(',')).join(' ');
  }
  function buildLCD(host) {
    const NS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', '-4 -4 196 72');
    svg.setAttribute('aria-hidden', 'true');
    const digits = [];
    const xs = [0, 46, 108, 154];
    xs.forEach((x0) => {
      const grp = document.createElementNS(NS, 'g');
      grp.setAttribute('transform', `translate(${x0},0) skewX(-6)`);
      const segs = {};
      Object.keys(SEG).forEach((k) => {
        const [x, y, w, h, o] = SEG[k];
        const p = document.createElementNS(NS, 'polygon');
        p.setAttribute('points', segPoly(x, y, w, h, o));
        p.setAttribute('class', 'seg');
        grp.append(p);
        segs[k] = p;
      });
      svg.append(grp);
      digits.push(segs);
    });
    const colon = document.createElementNS(NS, 'g');
    colon.setAttribute('class', 'colon');
    [18, 42].forEach((cy) => {
      const c = document.createElementNS(NS, 'rect');
      c.setAttribute('x', 90);
      c.setAttribute('y', cy);
      c.setAttribute('width', 6);
      c.setAttribute('height', 6);
      c.setAttribute('class', 'seg on');
      colon.append(c);
    });
    svg.append(colon);
    host.textContent = '';
    host.append(svg);
    return { digits, colon };
  }
  function setLCD(lcd, str, mode) {
    // str: 'HHMM', '▇' = 망가진 자리. mode 'off' = 전원 없음
    lcd.digits.forEach((segs, i) => {
      const ch = str[i];
      let on;
      if (mode === 'off') on = '';
      else if (ch === '▇') on = Object.keys(SEG).filter(() => Math.random() < 0.5).join('');
      else on = DIG[+ch] || '';
      Object.keys(segs).forEach((k) => segs[k].setAttribute('class', on.includes(k) ? 'seg on' : 'seg'));
    });
    lcd.colon.style.opacity = mode === 'off' ? '0.08' : '';
  }

  // ───────── HUD ─────────
  function hud() {
    const S = G.S;
    if (!S || !R.clock) return;
    let str = G.fmt(S.t).replace(':', '');
    let mode = '';
    if (S.freeze) str = '0317';
    if (R.blackLv === 1) mode = 'off';
    else if (G.fx.level() && S.t >= T('03:08') && S.t < T('03:17') && Math.random() < 0.6) str = str.slice(0, 3) + '▇';
    setLCD(R.lcd, str, mode);
    R.clock.setAttribute('aria-label', '현재 시각 ' + (S.freeze ? '03:17' : G.fmt(S.t)));

    const P = G.data.places[S.place];
    R.where.textContent = P ? P.label : S.place;

    const lvl = S.nameExposure;
    R.tagName.textContent = G.fx.nameText(S.surname || ' ', lvl);
    R.tag.classList.toggle('flick', lvl === 1 && G.fx.level() > 0);
    R.tag.hidden = !S.surname;

    const show = {
      rules: !!S.flags.hasRules,
      mine: !!S.flags.hasRules,
      jung: S.jungPages > 0,
      history: S.readHistory,
      ledger: S.readLedger,
    };
    R.tabs.querySelectorAll('[data-doc]').forEach((b) => (b.hidden = !show[b.dataset.doc]));
    document.body.classList.toggle('late', S.t >= T('03:30') && G.fx.level() > 0);
    G.photo.update();
  }

  // ───────── 로그 ─────────
  const BASE = { slow: 55, normal: 30, fast: 12, instant: 0 };
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  async function pause(ms) {
    const end = performance.now() + ms;
    while (!skipping && performance.now() < end) await sleep(Math.min(40, end - performance.now()));
  }

  function ambientP(cls) {
    const S = G.S;
    if (!S || cls === 'clean' || cls.includes('clean') || cls === 'sys' || cls === 'mono') return 0;
    if (S.t >= T('05:00') && S.t < T('05:20')) return 0;
    if (S.consent >= 3) return 0.05;
    if (S.consent >= 2) return 0.025;
    return 0;
  }

  function makeLine(raw, cls, o) {
    const p = el('p', 'ln ' + (cls || 'nar'));
    if (o && o.stamp) p.dataset.stamp = o.stamp;
    p.append(el('span', 'sr-only', G.fx.plain(raw)));
    const vis = el('span', 'vis');
    vis.setAttribute('aria-hidden', 'true');
    vis.append(G.fx.build(raw, o && o.static ? 0 : ambientP(cls || 'nar')));
    p.append(vis);
    return { p, vis };
  }

  function scrollDown() {
    R.scroller.scrollTop = R.scroller.scrollHeight;
  }

  // 상황에 따라 글자 속도를 바꾼다. 1보다 크면 느리게.
  function pace(raw, cls, o) {
    const S = G.S;
    let k = o.s === 'slow' ? 1.8 : 1;
    const c = cls || 'nar';
    if (/mono|sys|act/.test(c)) k *= 0.45; // 화면, 공지: 기계적으로
    if (/hand/.test(c)) k *= 1.35; // 손글씨: 쓰는 속도
    if (c === 'me') k *= 0.8;
    if (S) {
      const t = S.t;
      if (t < T('23:00')) k *= 0.85; // 고요 구간
      if (t >= T('02:50') && t < T('03:30')) k *= 1.3; // 03:17 전후
      if (t >= T('05:00') && t < T('05:35')) k *= 0.9; // 거짓 평온
      if (S.consent >= 2) k *= 1.12;
      if (S.consent >= 3) k *= 1.12;
    }
    if (R.blackLv) k *= 1.6;
    // 손님의 격식체: 쉼표나 마침표에서 멈추지 않고 고르게
    const even = c === 'say' && /(습니까|십시오|습니다)[.?"”]/.test(raw);
    if (even) k *= 1.35;
    return { k, even };
  }

  async function line(raw, cls, o) {
    o = o || {};
    const { p, vis } = makeLine(raw, cls, o);
    R.log.append(p);
    if (!R.batchStart) R.batchStart = p;
    scrollDown();
    const pc = pace(raw, cls, o);
    const ms = BASE[G.settings.speed] * pc.k;
    if (!ms || skipping) return;
    const walker = document.createTreeWalker(vis, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    const full = nodes.map((n) => n.nodeValue);
    nodes.forEach((n) => (n.nodeValue = ''));
    typing = true;
    outer: for (let i = 0; i < nodes.length; i++) {
      const chars = [...full[i]];
      for (let k = 0; k < chars.length; k++) {
        if (skipping) {
          for (let j = i; j < nodes.length; j++) nodes[j].nodeValue = full[j];
          break outer;
        }
        nodes[i].nodeValue = chars.slice(0, k + 1).join('');
        if (k % 6 === 0) scrollDown();
        const ch = chars[k];
        if (pc.even) await sleep(ms);
        else await sleep(/[.?!…]/.test(ch) ? ms * 7 : /[,]/.test(ch) ? ms * 4 : ch === ' ' ? ms * 1.3 : ms);
      }
    }
    typing = false;
    scrollDown();
  }

  function endBatch() {
    skipping = false;
    typing = false;
  }

  function staticLine(raw, cls) {
    const { p } = makeLine(raw, cls, { static: true });
    R.log.append(p);
  }

  function rebuildLog() {
    R.log.textContent = '';
    (G.S.log || []).forEach((l) => staticLine(l.t, l.c));
    if (G.S.log.length) R.log.append(el('p', 'ln sys', '— 이어서 —'));
    scrollDown();
  }

  // ───────── 선택지 ─────────
  // keep: 새 선택지를 그리기 직전엔 '방금 나온 글' 표시를 지우지 않는다
  function clearDock(keep) {
    R.dock.textContent = '';
    keyMap = null;
    if (!keep) R.batchStart = null;
  }

  // 선택지가 붙으면 맨 아래로 내리되, 방금 나온 글의 첫 줄은 화면 안에 남긴다
  function settle() {
    hud();
    const sc = R.scroller;
    // 아래 여백은 빼고, 선택지 끝이 화면 아래에 오게
    const padB = parseFloat(getComputedStyle(R.dock).paddingBottom) || 0;
    const bottom = Math.max(0, sc.scrollHeight - sc.clientHeight - padB);
    const first = R.batchStart && R.batchStart.isConnected ? R.batchStart.offsetTop - 28 : bottom;
    sc.scrollTop = Math.max(0, Math.min(bottom, first));
  }

  function choose(list) {
    return new Promise((resolve) => {
      clearDock(true);
      const ol = el('ol', 'choices');
      const keys = {};
      const amb = G.S && G.S.consent >= 2 ? (G.S.consent >= 3 ? 0.08 : 0.04) : 0;
      list.forEach((o, i) => {
        const li = el('li');
        const b = el('button', 'choice');
        b.type = 'button';
        b.append(el('span', 'k', String(i + 1)));
        const lab = el('span', 'lbl');
        lab.append(el('span', 'sr-only', G.fx.plain(o.label)));
        const v = el('span');
        v.setAttribute('aria-hidden', 'true');
        v.append(G.fx.build(o.label, amb));
        lab.append(v);
        b.append(lab);
        b.addEventListener('click', () => {
          clearDock();
          resolve(o.id);
        });
        li.append(b);
        ol.append(li);
        keys[String(i + 1)] = b;
      });
      R.dock.append(ol);
      settle();
      keyMap = keys;
      R.dock.focus({ preventScroll: true });
    });
  }

  function focusFirst(container) {
    // 키보드 사용자를 위해 첫 버튼에 포커스. 화면 흔들림 없이.
    const b = container.querySelector('button, input');
    if (b) b.focus({ preventScroll: true });
  }

  function menu(m) {
    return new Promise((resolve) => {
      clearDock(true);
      const wrap = el('div', 'menu');
      const acts = el('ul', 'acts');
      const keys = {};
      m.acts.forEach((a, i) => {
        const li = el('li');
        const b = el('button', 'act');
        b.type = 'button';
        b.append(el('span', 'k', String(i + 1)), el('span', 'lbl', a.label), el('span', 'lead'), el('span', 'dur', a.dur + '분'));
        b.addEventListener('click', () => {
          clearDock();
          resolve({ type: 'act', id: a.id });
        });
        li.append(b);
        acts.append(li);
        if (i < 9) keys[String(i + 1)] = b;
      });
      const floors = el('div', 'floors');
      floors.setAttribute('role', 'group');
      floors.setAttribute('aria-label', '층 이동');
      m.moves.forEach((mv) => {
        const b = el('button', 'floor' + (mv.here ? ' here' : ''));
        b.type = 'button';
        b.append(el('span', 'fl', mv.label), el('span', 'dur', mv.here ? '' : mv.dur + '분'));
        if (mv.here) {
          b.disabled = true;
          b.setAttribute('aria-current', 'location');
        } else
          b.addEventListener('click', () => {
            clearDock();
            resolve({ type: 'move', id: mv.id });
          });
        floors.append(b);
      });
      wrap.append(acts, floors);
      R.dock.append(wrap);
      settle();
      keyMap = keys;
      R.dock.focus({ preventScroll: true });
    });
  }

  function ask(o) {
    return new Promise((resolve) => {
      clearDock(true);
      const f = el('form', 'ask');
      const lab = el('label', 'ask-l');
      lab.append(el('span', 'sr-only', o.label || o.placeholder));
      if (o.prefix) lab.append(el('span', 'ask-pre', o.prefix));
      const inp = el('input');
      inp.type = 'text';
      inp.maxLength = o.max || 8;
      if (inp.maxLength > 8) {
        f.classList.add('long');
      }
      inp.placeholder = o.placeholder || '';
      inp.autocomplete = 'off';
      inp.spellcheck = false;
      lab.append(inp);
      const b = el('button', 'ask-b', o.button || '적는다');
      b.type = 'submit';
      f.append(lab, b);
      f.addEventListener('submit', (e) => {
        e.preventDefault();
        const v = clean(inp.value, o.max || 8);
        if (!v && !o.allowEmpty) {
          inp.focus();
          f.classList.remove('shake');
          void f.offsetWidth;
          f.classList.add('shake');
          return;
        }
        clearDock();
        resolve(v);
      });
      R.dock.append(f);
      settle();
      inp.focus({ preventScroll: true });
    });
  }

  function clean(v, max) {
    return [...String(v).replace(/[^\p{L}\p{N} .,?!'"~\-]/gu, '').replace(/\s+/g, ' ').trim()].slice(0, max).join('');
  }

  // ───────── 03:17 ─────────
  function hold(o) {
    if (!G.settings.timer) {
      const opts = [
        { id: 'press', label: '응답한다' },
        { id: 'pass', label: '응답하지 않는다' },
      ];
      if (o.quiet) opts.push({ id: 'silent', label: '침묵한다 (7번)' });
      return choose(opts);
    }
    return new Promise((resolve) => {
      clearDock(true);
      const box = el('div', 'hold');
      const b = el('button', 'hold-b', '응답');
      b.type = 'button';
      box.append(b);
      let sil = null;
      if (o.quiet) {
        sil = el('button', 'hold-s', '침묵한다 (7번)');
        sil.type = 'button';
        box.append(sil);
        document.body.classList.add('quiet');
      }
      R.dock.append(box);
      settle();
      let done = false;
      const timers = [];
      const finish = (r) => {
        if (done) return;
        done = true;
        timers.forEach(clearTimeout);
        document.body.classList.remove('quiet');
        clearDock();
        resolve(r);
      };
      b.addEventListener('click', () => finish('press'));
      if (sil) sil.addEventListener('click', () => finish('silent'));
      (o.drip || []).forEach((t, i) => {
        timers.push(
          setTimeout(() => {
            if (done) return;
            const txt = G.engine.tpl(t);
            const { p } = makeLine(txt, 'say', {});
            R.log.append(p);
            scrollDown();
            G.engine.pushLog(txt, 'say');
            if (i === 0) G.audio.sfx('ring4', 0.5);
          }, 4000 + i * 5000)
        );
      });
      timers.push(setTimeout(() => finish('pass'), o.seconds * 1000));
    });
  }

  // ───────── 정전 ─────────
  function blackout(lv) {
    R.blackLv = lv;
    document.body.classList.toggle('dark', lv === 1);
    document.body.classList.toggle('emerg', lv === 2);
    hud();
  }

  // ───────── 서류 ─────────
  const DOCS = {
    rules: { label: '수칙', cls: 'p-rules' },
    mine: { label: '내 수첩', cls: 'p-mine' },
    jung: { label: '정 씨 수첩', cls: 'p-jung' },
    history: { label: '개정 이력', cls: 'p-hist' },
    ledger: { label: '출입 대장', cls: 'p-ledger' },
    settings: { label: '설정', cls: 'p-set' },
  };

  function openDoc(name, sub) {
    return new Promise((resolve) => {
      if (docOpen) closeDoc();
      docOpen = name;
      docResolve = resolve;
      lastFocus = document.activeElement;
      R.paper.className = 'paper ' + DOCS[name].cls;
      R.paperBody.textContent = '';
      R.paperBody.append(render(name, sub));
      R.sheet.hidden = false;
      R.sheet.setAttribute('aria-label', DOCS[name].label);
      document.body.classList.add('sheet-open');
      R.paper.scrollTop = 0;
      if (sub === 'back') {
        const t = $('#jung-back', R.paperBody);
        if (t) t.scrollIntoView({ block: 'start' });
      }
      R.sheetClose.focus({ preventScroll: true });
    });
  }
  function closeDoc() {
    if (!docOpen) return;
    R.sheet.hidden = true;
    document.body.classList.remove('sheet-open');
    docOpen = null;
    const r = docResolve;
    docResolve = null;
    if (lastFocus && lastFocus.isConnected) lastFocus.focus({ preventScroll: true });
    else focusFirst(R.dock);
    if (r) r();
  }
  function refreshDoc() {
    if (!docOpen) return;
    const n = docOpen;
    const st = R.paper.scrollTop;
    R.paperBody.textContent = '';
    R.paperBody.append(render(n));
    R.paper.scrollTop = st;
  }

  function render(name, sub) {
    const S = G.S;
    const box = el('div', 'doc');
    if (name === 'rules') return renderRules(S, box);
    if (name === 'mine') return renderMine(S, box);
    if (name === 'settings') return renderSettings(box);
    if (S && S.place !== '경비실') {
      box.append(el('p', 'away', '경비실 책상 위에 두고 왔다.'));
      return box;
    }
    if (name === 'jung') return renderJung(S, box);
    if (name === 'history') return renderHistory(S, box);
    if (name === 'ledger') return renderLedger(S, box);
    return box;
  }

  function renderRules(S, box) {
    const head = el('header', 'rules-head');
    head.append(el('h2', null, '금성상가 야간 경비 근무 수칙'), el('p', 'ed', '(개정 제11판)'));
    const seal = el('span', 'seal');
    seal.setAttribute('aria-hidden', 'true');
    seal.append(el('span', null, '관리'), el('span', null, '사무소'));
    head.append(seal);
    box.append(head);
    const ol = el('ol', 'rules');
    G.data.rules.forEach((r) => {
      const li = el('li');
      const txt = G.ruleText(S, r);
      const b = el('button', 'rule');
      b.type = 'button';
      b.append(el('span', 'rn', r.n + '.'));
      const body = el('span', 'rt' + (r.n === 7 && S.restored7 ? ' hand-ink' : ''));
      body.textContent = txt;
      if (r.n === 7 && !txt) {
        body.classList.add('blank');
        body.append(el('span', 'sr-only', '비어 있음'));
      }
      b.append(body);
      const struck = S.struck.includes(r.n);
      b.classList.toggle('struck', struck);
      b.setAttribute('aria-pressed', struck ? 'true' : 'false');
      b.addEventListener('click', () => {
        if (r.n === 7 && !txt) return;
        const i = S.struck.indexOf(r.n);
        if (i >= 0) S.struck.splice(i, 1);
        else {
          S.struck.push(r.n);
          if (S.mutated[r.n] && r.formal && !S.rulesSeen.includes(r.n)) S.rulesSeen.push(r.n);
          G.audio.sfx('pen');
        }
        refreshDoc();
      });
      li.append(b);
      ol.append(li);
    });
    box.append(ol);
    return box;
  }

  function renderMine(S, box) {
    if (S.journalOpened) box.append(el('p', 'm-hand big', '방문증 4719'));
    // 할 일
    const hr = G.patrolHour(S.t);
    const pt = S.patrol[hr] || [];
    const todo = el('ul', 'todo');
    const item = (txt, done) => {
      const li = el('li', done ? 'done' : '', txt);
      if (done) li.append(el('span', 'sr-only', ' 완료'));
      todo.append(li);
    };
    const pl = el('li', 'patrol-row');
    pl.append(el('span', null, hr + '시 순찰 '));
    ['B1', '1F', '2F', '3F'].forEach((f) => {
      const s = el('span', pt.includes(f) ? 'done' : '', f);
      pl.append(s, document.createTextNode(' '));
    });
    todo.append(pl);
    item('우편물', !!S.done.mail);
    item('분실물함', !!S.done.lost);
    item('쓰레기통 3F', !!S.done.trash3);
    item('쓰레기통 B1', !!S.done.trashB1);
    item('일지', !!S.journalOpened);
    box.append(todo);

    if (S.logged.length) {
      const ul = el('ul', 'logged');
      S.logged.forEach((k) => ul.append(el('li', null, G.data.facts[k].note)));
      box.append(el('p', 'm-sub', '일지에 적은 것'), ul);
    }

    const pocket = [];
    S.clues.forEach((k) => pocket.push(G.data.clues[k]));
    if (S.hasFKey) pocket.push({ name: "'F' 열쇠", text: '손잡이 쪽이 미지근하다.' });
    if (pocket.length) {
      const ul = el('ul', 'pocket');
      pocket.forEach((c) => {
        const li = el('li');
        li.append(el('b', null, c.name), document.createTextNode(' ' + c.text));
        ul.append(li);
      });
      box.append(el('p', 'm-sub', '주머니'), ul);
    }

    if (S.pieces.length) box.append(renderPieces(S));
    return box;
  }

  function renderPieces(S) {
    const wrap = el('div', 'pieces');
    const P = G.data.pieces;
    const order = ['a', 'b', 'c'].filter((k) => S.pieces.includes(k));
    if (S.restored7) {
      const s = el('p', 'scrap whole hand-ink', G.data.rules[6].restored);
      wrap.append(s);
      return wrap;
    }
    order.forEach((k, i) => {
      const s = el('div', 'scrap s-' + k);
      if (k === 'c' && S.pieces.length === 3) {
        const f = el('form', 'fill');
        f.append(document.createTextNode(P.c));
        const inp = el('input');
        inp.type = 'text';
        inp.maxLength = 2;
        inp.setAttribute('aria-label', '찢겨 나간 글자');
        inp.placeholder = '  ';
        f.append(inp, document.createTextNode('이다.'));
        const b = el('button', 'fill-b', '써 넣는다');
        b.type = 'submit';
        f.append(b);
        f.addEventListener('submit', (e) => {
          e.preventDefault();
          const v = inp.value.trim();
          if (v === '문' || v === '門') {
            S.restored7 = true;
            G.audio.sfx('pen');
            G.engine.note('수칙 7번 빈칸에 옮겨 적는다.');
            refreshDoc();
          } else {
            inp.value = '';
            f.classList.remove('shake');
            void f.offsetWidth;
            f.classList.add('shake');
          }
        });
        s.append(f);
      } else {
        s.textContent = k === 'c' ? P.c + '▒▒▒' : P[k];
      }
      wrap.append(s);
    });
    return wrap;
  }

  function renderJung(S, box) {
    const pages = G.data.jung.slice(0, S.jungPages * 3);
    pages.forEach((pg, i) => {
      const p = el('p', 'jp' + (pg.shake ? ' shake' + pg.shake : ''));
      p.append(el('span', 'pn', String(i + 1)));
      p.append(document.createTextNode(pg.t));
      box.append(p);
    });
    if (S.jungPages < 3) box.append(el('p', 'jp more', '…'));
    if (S.jungBack) {
      const back = el('section', 'jback');
      back.id = 'jung-back';
      G.data.jungBack.forEach((t) => back.append(el('p', null, t)));
      box.append(back);
    }
    return box;
  }

  function renderHistory(S, box) {
    box.append(el('h2', 'h-title', '수칙 개정 이력'));
    const tb = el('table', 'hist');
    const thead = el('thead');
    const hr = el('tr');
    ['판', '연월', '내용', '기재자', '비고'].forEach((h) => hr.append(el('th', null, h)));
    thead.append(hr);
    tb.append(thead);
    const body = el('tbody');
    G.data.history.forEach((r) => {
      const tr = el('tr');
      [r.ed, r.y, r.what, r.by, r.note].forEach((c) => tr.append(el('td', null, c)));
      body.append(tr);
      if (r.memo) {
        const m = el('tr', 'memo');
        const td = el('td', null, r.memo);
        td.colSpan = 5;
        m.append(td);
        body.append(m);
      }
    });
    tb.append(body);
    box.append(tb);
    return box;
  }

  function renderLedger(S, box) {
    box.append(el('h2', 'h-title', '출입 대장  10월 14일'));
    const t1 = el('table', 'ledger');
    G.ledger(S).forEach((r) => {
      const tr = el('tr');
      r.forEach((c) => tr.append(el('td', null, c)));
      t1.append(tr);
    });
    box.append(t1);
    box.append(el('h2', 'h-title', '출근부'));
    const t2 = el('table', 'ledger att');
    G.attendance(S).forEach((r) => {
      const tr = el('tr');
      tr.append(el('td', null, r[0]), el('td', 'sig', r[1]));
      t2.append(tr);
    });
    box.append(t2);
    return box;
  }

  function renderSettings(box) {
    box.append(el('h2', 'h-title', '설정'));
    const rows = [
      ['speed', '글자 속도', [['slow', '느리게'], ['normal', '보통'], ['fast', '빠르게'], ['instant', '바로']]],
      ['fx', '글자 깨짐 연출', [[0, '끄기'], [1, '약하게'], [2, '보통']]],
      ['sound', '소리', [[true, '켜기'], [false, '끄기']]],
      ['timer', '시간 제한', [[true, '켜기'], [false, '끄기']]],
    ];
    rows.forEach(([key, name, opts]) => {
      const fs = el('fieldset', 'set-row');
      fs.append(el('legend', null, name));
      opts.forEach(([v, lab]) => {
        const id = 'set-' + key + '-' + v;
        const inp = el('input');
        inp.type = 'radio';
        inp.name = 'set-' + key;
        inp.id = id;
        inp.checked = G.settings[key] === v;
        inp.addEventListener('change', () => {
          G.settings[key] = v;
          G.saveSettings();
          if (key === 'sound') G.audio.setEnabled(v);
          hud();
        });
        const l = el('label', null, lab);
        l.htmlFor = id;
        fs.append(inp, l);
      });
      box.append(fs);
    });
    if (G.S && !G.S.ended && !R.game.hidden) {
      const q = el('button', 'quit', '그만두고 나가기');
      q.type = 'button';
      q.addEventListener('click', () => {
        G.save();
        location.reload();
      });
      box.append(q);
    }
    return box;
  }

  // ───────── 엔딩 화면 ─────────
  function showEnding(code, stats) {
    const E = G.data.endings[code];
    R.game.hidden = true;
    R.ending.hidden = false;
    const card = $('#ending-card');
    card.textContent = '';
    card.append(el('h2', 'e-name', E.name));
    const dl = el('dl', 'e-stats');
    const row = (k, v) => dl.append(el('dt', null, k), el('dd', null, v));
    row('알아챈 변조', stats.seen + ' / 4');
    row('읽은 서류', stats.docs + ' / 4');
    row('퇴근 시각', stats.time);
    card.append(dl);
    const ol = el('ol', 'e-list');
    G.data.endingOrder.forEach((c) => {
      const got = G.archive.endings.includes(c);
      const li = el('li', got ? 'got' : 'blank', got ? G.data.endings[c].name : '');
      if (!got) li.append(el('span', 'sr-only', '아직 보지 못한 결말'));
      ol.append(li);
    });
    card.append(ol);
    const b = el('button', 'title-b', '다시 출근');
    b.type = 'button';
    b.addEventListener('click', () => location.reload());
    card.append(b);
    b.focus({ preventScroll: true });
  }

  // ───────── 초기화 ─────────
  function init() {
    R = {
      game: $('#game'),
      ending: $('#ending'),
      log: $('#log'),
      scroller: $('#stage'),
      dock: $('#dock'),
      clock: $('#clock'),
      where: $('#where'),
      tag: $('#tag'),
      tagName: $('#tagName'),
      tabs: $('#tabs'),
      sheet: $('#sheet'),
      paper: $('#paper'),
      paperBody: $('#paperBody'),
      sheetClose: $('#sheetClose'),
      blackLv: 0,
    };
    R.lcd = buildLCD(R.clock);

    R.tabs.addEventListener('click', (e) => {
      const b = e.target.closest('[data-doc]');
      if (!b) return;
      if (docOpen === b.dataset.doc) closeDoc();
      else openDoc(b.dataset.doc);
    });
    R.sheetClose.addEventListener('click', closeDoc);
    R.sheet.addEventListener('click', (e) => {
      if (e.target === R.sheet) closeDoc();
    });

    R.scroller.addEventListener('click', (e) => {
      if (e.target.closest('#dock')) return;
      if (typing) skipping = true;
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && docOpen) {
        closeDoc();
        return;
      }
      const inField = e.target && /INPUT|TEXTAREA/.test(e.target.tagName);
      if (inField) return;
      if (typing && (e.key === ' ' || e.key === 'Enter')) {
        e.preventDefault();
        skipping = true;
        return;
      }
      if (!docOpen && keyMap && keyMap[e.key]) {
        e.preventDefault();
        keyMap[e.key].click();
      }
    });
  }

  G.ui = {
    init,
    hud,
    line,
    pause,
    endBatch,
    choose,
    menu,
    ask,
    hold,
    blackout,
    openDoc,
    closeDoc,
    rebuildLog,
    showEnding,
    buildLCD,
    setLCD,
    isDocOpen: (n) => docOpen === n,
    clearDock,
    makeLine,
    scrollDown,
    staticLine,
  };
})();
