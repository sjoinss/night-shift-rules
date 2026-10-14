(function () {
  const G = window.G;
  const $ = (s) => document.querySelector(s);
  const params = new URLSearchParams(location.search);

  function boot() {
    G.ui.init();
    G.photo.init();

    if (params.get('debug') === 'effects') return effectsLab();

    // 타이틀 시계
    const lcd = G.ui.buildLCD($('#titleClock'));
    G.ui.setLCD(lcd, '2150');

    // 실제로 새벽에 접속하면 한 줄
    const h = new Date().getHours();
    if (h >= 2 && h < 5) $('#titleNote').textContent = '이 시간에 오셨네요.';
    // 지난 밤이 어떻게 끝났는지 기억하는 타이틀
    if (G.archive.last === 'C') $('#titleNote').textContent = '문 열어 두었습니다. 들어오세요.';
    if (G.archive.last === 'B') $('#titleNote').textContent = '처음 뵙겠습니다.';

    const saved = G.loadSave();
    const cont = $('#btnContinue');
    cont.hidden = !saved;

    $('#btnStart').addEventListener('click', () => begin(true));
    cont.addEventListener('click', () => {
      G.S = saved;
      begin(false);
    });
    $('#btnTitleSettings').addEventListener('click', () => G.ui.openDoc('settings'));
    $('#btnSettings').addEventListener('click', () => G.ui.openDoc('settings'));

    // 탭을 떠났다 돌아오면 (한 번만)
    let left = 0;
    document.addEventListener('visibilitychange', () => {
      if (!G.S || G.S.ended) return;
      if (document.hidden) left = Date.now();
      else if (left && Date.now() - left > 5000 && !G.S.flags.awayDone) G.S.flags.awayPending = true;
    });

    if (params.get('debug') === '1') debugPanel();
  }

  let begun = false;
  function begin(fresh) {
    if (begun) return;
    begun = true;
    G.audio.unlock();
    G.audio.ambient(true);
    $('#title').hidden = true;
    $('#game').hidden = false;
    G.engine.start(fresh);
  }

  // ───────── ?debug=1 ─────────
  function debugPanel() {
    const box = document.createElement('div');
    box.className = 'debug';
    box.innerHTML =
      '<b>debug</b> <input id="dbgT" size="5" value="00:05"><button id="dbgGo">시각</button>' +
      ' <button data-v="consent">consent+</button><button data-v="nameExposure">name+</button>' +
      ' <button id="dbg7">7복원</button><button id="dbgKey">F열쇠</button>' +
      ' <select id="dbgEnd"><option value="">엔딩</option><option>A</option><option>B</option><option>C</option><option>D</option><option>E</option></select>' +
      '<pre id="dbgOut"></pre>';
    document.body.append(box);
    const out = box.querySelector('#dbgOut');
    setInterval(() => {
      const S = G.S;
      if (!S) return;
      out.textContent = JSON.stringify(
        {
          t: G.fmt(S.t),
          place: S.place,
          consent: S.consent,
          name: S.nameExposure,
          r7: S.restored7,
          f: S.fDone,
          mut: Object.keys(S.mutated),
          seen: S.rulesSeen,
          logged: S.logged,
        },
        null,
        0
      );
    }, 500);
    box.querySelector('#dbgGo').onclick = () => {
      if (!G.S) return;
      G.S.t = G.toM(box.querySelector('#dbgT').value);
      G.ui.hud();
    };
    box.querySelectorAll('[data-v]').forEach((b) => (b.onclick = () => G.S && G.engine.g.add(b.dataset.v, 1)));
    box.querySelector('#dbg7').onclick = () => G.S && (G.S.restored7 = true);
    box.querySelector('#dbgKey').onclick = () => G.S && ((G.S.hasFKey = true), (G.S.t = Math.max(G.S.t, G.toM('04:30'))));
    box.querySelector('#dbgEnd').onchange = (e) => {
      const c = e.target.value;
      if (!c || !G.S) return;
      Object.assign(G.S, { keyGiven: c === 'C', nameExposure: c === 'B' ? 3 : 0, consent: 0, restored7: c === 'D' || c === 'E', fDone: c === 'E', knowsRealName: c === 'E' });
      if (c !== 'B' && c !== 'C') G.S.t = G.toM('06:00');
    };
  }

  // ───────── ?debug=effects ─────────
  function effectsLab() {
    $('#title').hidden = true;
    const lab = $('#lab');
    lab.hidden = false;
    const sample = '문 좀 열어 줘. 나야, 정말 나야.';
    const render = () => {
      const out = lab.querySelector('.lab-out');
      out.textContent = '';
      [0, 1, 2].forEach((lv) => {
        G.settings.fx = lv;
        const h = document.createElement('h3');
        h.textContent = '강도 ' + lv;
        out.append(h);
        ['g1', 'g2', 'g3', 'g4'].forEach((k) => {
          const p = document.createElement('p');
          p.className = 'ln nar';
          p.append(k + '  ', G.fx.build('{{' + k + '|' + sample + '}}', 0));
          out.append(p);
        });
        const p = document.createElement('p');
        p.className = 'ln nar';
        p.append('ambient  ', G.fx.build(sample, 0.3));
        out.append(p);
        const n = document.createElement('p');
        n.className = 'ln nar';
        n.textContent = 'G6  ' + [0, 1, 2, 3].map((l) => G.fx.nameText('김', l)).join('  /  ');
        out.append(n);
      });
      G.settings.fx = 2;
    };
    lab.querySelector('button').onclick = render;
    render();
  }

  document.addEventListener('DOMContentLoaded', boot);
})();
