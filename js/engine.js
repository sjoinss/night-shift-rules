(function () {
  const G = window.G;
  const T = (s) => G.toM(s);
  const HARD = () => [T('03:17'), T('06:00')];
  const EVENT_PHOTO = {
    sunduk: 'office',
    elev: 'elevator',
    radio1: 'office',
    chief: 'cam_umbrella',
    call1: 'stairs_dark',
    call2: 'stairs_dark',
    radio7: 'office',
    b0317: 'blackout',
    stairs: 'stairs_lit',
    relief: 'cam_cap',
  };
  const ENDING_PHOTO = { A: 'exterior_dawn', B: 'office', C: 'lobby_dawn', D: 'office', E: 'floorF' };

  function S() {
    return G.S;
  }

  function tpl(str) {
    if (typeof str !== 'string') return str;
    const s = S();
    return str.replace(/\{\{(surname|given|full|name_a|clock)\}\}/g, (m, k) => {
      switch (k) {
        case 'surname':
          return G.fx.nameText(s.surname, s.nameExposure);
        case 'given':
          return s.given || '';
        case 'full':
          return G.fx.nameText(s.surname + (s.given || ''), s.nameExposure);
        case 'name_a':
          return s.given ? s.given + (G.fx.hasJong(s.given) ? '아' : '야') : s.surname + ' 씨';
        case 'clock':
          return G.fmt(s.t);
      }
      return m;
    });
  }

  function pushLog(t, c) {
    S().log.push({ t, c });
  }

  // 고른 것은 옅은 바탕으로 남겨서, 그 아래 글과 구분되게
  async function picked(t) {
    // 메뉴 글귀 끝의 '(4분)' 같은 표시는 뗀다
    t = t.replace(/\s*\(\d+분\)\s*$/, '').trim();
    const c = (/^["“]/.test(t) ? 'me' : 'act') + ' pick';
    await G.ui.line(t, c, { static: true });
    pushLog(t, c);
    G.ui.endBatch();
  }

  function norm(l) {
    if (typeof l === 'string') l = { t: l };
    const t = tpl(l.t);
    let c = l.c;
    if (!c) c = /^["“]/.test(t) ? 'say' : 'nar';
    return Object.assign({}, l, { t, c });
  }

  function spend(n) {
    S().t += n;
    G.ui.hud();
  }

  // 이 시간 동안 하드 이벤트(03:17, 06:00)를 넘어가는가
  function crossing(n) {
    const s = S();
    const tgt = s.t + n;
    return HARD().find((h) => s.t < h && tgt > h);
  }

  // 장면 스크립트가 쓰는 도구
  const g = {
    get S() {
      return S();
    },
    async p(...lines) {
      for (const raw of lines.flat()) {
        const n = norm(raw);
        if (n.w) await G.ui.pause(n.w);
        await G.ui.line(n.t, n.c, n);
        pushLog(n.t, n.c);
      }
      G.ui.endBatch();
    },
    wait: (ms) => G.ui.pause(ms).then(() => G.ui.endBatch()),
    async choose(opts) {
      const list = opts
        .filter((o) => o.req === undefined || o.req)
        .map((o) => Object.assign({}, o, { label: tpl(o.label) }));
      const id = await G.ui.choose(list);
      const o = list.find((x) => x.id === id);
      const plain = G.fx.plain(o.label);
      await picked(plain);
      if (/^["“]/.test(plain)) S().said.push(plain);
      return id;
    },
    async say(text) {
      const t = tpl(text);
      S().said.push(t);
      await G.ui.line(t, 'me', { static: true });
      pushLog(t, 'me');
      G.ui.endBatch();
    },
    ask: (o) => G.ui.ask(o),
    add(k, n) {
      const s = S();
      s[k] = Math.max(0, (s[k] || 0) + n);
      G.ui.hud();
    },
    flag(k, v) {
      S().flags[k] = v === undefined ? true : v;
    },
    has: (k) => !!S().flags[k],
    time: (n) => spend(n),
    sfx: (n, v) => G.audio.sfx(n, v),
    async move(p) {
      const d = G.moveCost(S().place, p);
      S().place = p;
      spend(d);
    },
    seen(n) {
      const s = S();
      if (!s.rulesSeen.includes(n)) s.rulesSeen.push(n);
    },
    blackout: (lv) => G.ui.blackout(lv),
    hold: (o) => G.ui.hold(o),
    async same(o) {
      const r = await G.ui.same(o);
      if (r.pressed) {
        await picked(G.engine.tpl(o.to));
      }
      return r;
    },
    openDoc: (n, sub) => G.ui.openDoc(n, sub),
    // G9: 로그 끊김
    async cut() {
      G.audio.ambient(false);
      await G.ui.pause(3000);
      G.ui.endBatch();
    },
  };

  // ───────── 메뉴 구성 ─────────
  function buildMenu() {
    const s = S();
    const all = G.data.actions
      .filter((a) => a.place === s.place && (!a.avail || a.avail(s)))
      .map((a) => ({ id: a.id, label: typeof a.label === 'function' ? a.label(s) : a.label, dur: a.dur, group: a.group }));
    // 서랍 속 서류는 '서랍을 연다' 하나로 묶는다
    const acts = all.filter((a) => !a.group);
    const grouped = all.filter((a) => a.group);
    if (grouped.length) acts.splice(Math.min(2, acts.length), 0, { id: 'group:' + grouped[0].group, label: grouped[0].group + '을 연다', dur: 0, group: true });
    const moves = G.data.floorOrder.map((id) => ({
      id,
      label: G.data.places[id].label,
      dur: G.moveCost(s.place, id),
      here: id === s.place,
    }));
    return { acts, moves };
  }

  async function openGroup(name) {
    const s = S();
    const items = G.data.actions.filter((a) => a.group === name && a.place === s.place && (!a.avail || a.avail(s)));
    const id = await g.choose(
      items
        .map((a) => ({ id: a.id, label: (typeof a.label === 'function' ? a.label(s) : a.label) + '  (' + a.dur + '분)' }))
        .concat([{ id: 'close', label: name + '을 닫는다' }])
    );
    if (id !== 'close') await doAction(id);
  }

  async function doAction(id) {
    const a = G.data.actions.find((x) => x.id === id);
    const c = crossing(a.dur);
    if (c) {
      S().t = c;
      G.ui.hud();
      if (a.id !== 'rest') await g.p({ t: '하던 일을 다 끝내지 못했다.', c: 'dim' });
      return;
    }
    spend(a.dur);
    if (a.photo) G.photo.override(a.photo);
    await a.run(g);
    if (a.photo) G.photo.override(null);
  }

  async function doMove(id) {
    const s = S();
    const d = G.moveCost(s.place, id);
    const c = crossing(d);
    s.place = id;
    if (c) s.t = c;
    else spend(d);
    G.ui.hud();
    const t = G.fmt(s.t) + '  ' + G.data.places[id].label;
    await G.ui.line(t, 'sys', { static: true });
    pushLog(t, 'sys');
    G.ui.endBatch();
  }

  // ───────── 강제 진행 ─────────
  async function forced() {
    const s = S();
    if (s.keyGiven) return ending('C');
    if (s.consent >= 4) {
      await G.scenes.doorOpen(g);
      return ending('C');
    }
    if (s.nameExposure >= 3) {
      await G.scenes.nameLost(g);
      return ending('B');
    }

    for (const m of G.data.mutations) {
      if (!s.mutated[m.rule] && s.t >= T(m.at) && !G.ui.isDocOpen('rules')) {
        s.mutated[m.rule] = true;
        G.audio.sfx('page');
      }
    }

    if (s.t >= T('06:00')) {
      await G.scenes.morning(g);
      return ending(G.judgeEnding(s));
    }

    for (const e of G.data.events) {
      if (s.fired[e.id] || s.t < T(e.at)) continue;
      s.fired[e.id] = true;
      G.photo.override(EVENT_PHOTO[e.id] || e.photo || null);
      await G.scenes[e.scene](g);
      G.photo.override(null);
      G.ui.hud();
      return true;
    }

    if (s.consent >= 2 && !s.flags.warn2) {
      s.flags.warn2 = true;
      await G.scenes.warn2(g);
      return true;
    }
    if (s.consent >= 3 && !s.flags.warn3) {
      s.flags.warn3 = true;
      await G.scenes.warn3(g);
      return true;
    }
    if (s.flags.awayPending && !s.flags.awayDone && s.t >= T('23:30') && s.t < T('05:00')) {
      s.flags.awayDone = true;
      s.flags.awayPending = false;
      await G.scenes.away(g);
      return true;
    }
    return false;
  }

  async function ending(code) {
    const s = S();
    const E = G.data.endings[code];
    s.ended = code;
    G.photo.show(ENDING_PHOTO[code]);
    G.audio.ambient(false);
    G.ui.blackout(0);
    await g.p(E.lines);
    if (code === 'D') {
      const r = await g.ask({ max: 40, placeholder: '12. ', button: '적는다', label: '새 수칙', allowEmpty: true });
      const rule = r || '…';
      G.archive.lastRule = rule;
      await g.p({ t: '12. ' + rule, c: 'hand' }, ...E.after);
    }
    await g.choose([{ id: 'n', label: '출근부를 덮는다' }]);

    if (!G.archive.endings.includes(code)) G.archive.endings.push(code);
    G.archive.last = code;
    G.archive.runs++;
    G.saveArchive();
    G.clearSave();
    const docs = [s.jungPages >= 3, s.jungBack, s.readHistory, s.readLedger].filter(Boolean).length;
    const seen = Object.keys(s.mutated).filter((n) => s.rulesSeen.includes(+n)).length;
    G.ui.showEnding(code, { seen, docs, time: G.fmt(s.t) });
    return true;
  }

  async function loop() {
    while (!S().ended) {
      if (await forced()) continue;
      G.save();
      const pick = await G.ui.menu(buildMenu());
      if (pick.type === 'move') await doMove(pick.id);
      else if (pick.id.startsWith('group:')) await openGroup(pick.id.slice(6));
      else {
        const a = G.data.actions.find((x) => x.id === pick.id);
        await picked(typeof a.label === 'function' ? a.label(S()) : a.label);
        await doAction(pick.id);
      }
    }
  }

  async function start(fresh) {
    if (fresh) {
      G.S = G.newState();
      G.ui.hud();
      await G.scenes.intro(g);
    } else {
      G.ui.hud();
      G.ui.rebuildLog();
    }
    loop();
  }

  G.engine = {
    start,
    tpl,
    pushLog,
    g,
    // 패널 등에서 남기는 한 줄
    note(t) {
      G.ui.staticLine(t, 'act');
      pushLog(t, 'act');
      G.ui.scrollDown();
    },
  };
})();
