(function () {
  const G = window.G;

  const CHO = 'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ';
  const JUNG = 'ㅏㅐㅑㅒㅓㅔㅕㅖㅗㅘㅙㅚㅛㅜㅝㅞㅟㅠㅡㅢㅣ';
  const JONG = ['', 'ㄱ', 'ㄲ', 'ㄳ', 'ㄴ', 'ㄵ', 'ㄶ', 'ㄷ', 'ㄹ', 'ㄺ', 'ㄻ', 'ㄼ', 'ㄽ', 'ㄾ', 'ㄿ', 'ㅀ', 'ㅁ', 'ㅂ', 'ㅄ', 'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'];
  // 깨진 글자는 이 넷으로만 채운다
  const GL = ['門', '名', '鍵', '答'];

  const isHangul = (ch) => {
    const c = ch.charCodeAt(0);
    return c >= 0xac00 && c <= 0xd7a3;
  };
  const decompose = (ch) => {
    if (!isHangul(ch)) return ch;
    const c = ch.charCodeAt(0) - 0xac00;
    return CHO[Math.floor(c / 588)] + JUNG[Math.floor((c % 588) / 28)] + JONG[c % 28];
  };
  const hasJong = (word) => {
    const ch = word[word.length - 1];
    if (!ch || !isHangul(ch)) return false;
    return (ch.charCodeAt(0) - 0xac00) % 28 !== 0;
  };

  const lv = () => [0, 0.5, 1][G.settings.fx] ?? 1;
  const pick = (a) => a[Math.floor(Math.random() * a.length)];

  function g1(t, p) {
    return [...t].map((ch) => (Math.random() < p ? decompose(ch) : ch)).join('');
  }
  function g2(t, p) {
    return [...t].map((ch) => (isHangul(ch) && Math.random() < p ? pick(GL) : ch)).join('');
  }
  // 마인크래프트 §k처럼: 정해진 글자 자리에서 아무 글자로 계속 바뀐다
  const live = new Set();
  let ticker = null;
  const rndGlyph = () => (Math.random() < 0.85 ? String.fromCharCode(0xac00 + Math.floor(Math.random() * 11172)) : pick(['▓', '▒', '░', '█']));
  function tick() {
    for (const el of live) {
      if (!el.isConnected) {
        live.delete(el);
        continue;
      }
      el.textContent = rndGlyph();
    }
    if (!live.size) {
      clearInterval(ticker);
      ticker = null;
    }
  }
  function obfSpan(ch) {
    const sp = document.createElement('span');
    sp.className = 'obf';
    sp.textContent = rndGlyph();
    live.add(sp);
    if (!ticker) ticker = setInterval(tick, lv() < 1 ? 170 : 55);
    return sp;
  }
  // 글자 일부를 쉬지 않고 바뀌는 칸으로
  function obfuscate(t, p, all) {
    const frag = document.createDocumentFragment();
    let buf = '';
    for (const ch of t) {
      if (ch.trim() && (all || Math.random() < p)) {
        if (buf) frag.append(document.createTextNode(buf));
        buf = '';
        frag.append(obfSpan(ch));
      } else buf += ch;
    }
    if (buf) frag.append(document.createTextNode(buf));
    return frag;
  }

  function g3(t) {
    return [...t].map((ch) => (/\s/.test(ch) ? ch : '▇')).join('');
  }

  // {{g1|...}} 형태 파싱
  function parse(raw) {
    const out = [];
    const re = /\{\{(g\d+)\|([^}]*)\}\}/g;
    let i = 0;
    let m;
    while ((m = re.exec(raw))) {
      if (m.index > i) out.push({ t: raw.slice(i, m.index) });
      out.push({ t: m[2], g: m[1] });
      i = re.lastIndex;
    }
    if (i < raw.length) out.push({ t: raw.slice(i) });
    return out;
  }

  const plain = (raw) => parse(raw).map((s) => s.t).join('');

  // ambient: 0~1, 일반 문장에 G2를 얼마나 섞을지
  function build(raw, ambient) {
    const frag = document.createDocumentFragment();
    const L = lv();
    for (const seg of parse(raw)) {
      if (!seg.g || L === 0) {
        if (L && ambient) frag.append(obfuscate(seg.t, ambient * L));
        else frag.append(document.createTextNode(seg.t));
        continue;
      }
      const span = document.createElement('span');
      span.className = 'gl gl-' + seg.g;
      switch (seg.g) {
        case 'g1':
          span.textContent = g1(seg.t, 0.4 * L);
          break;
        case 'g2':
          span.append(obfuscate(seg.t, 0.45 * L));
          break;
        case 'g3':
          span.textContent = L < 1 ? seg.t : g3(seg.t);
          break;
        case 'g4': {
          span.append(document.createTextNode(seg.t));
          const words = seg.t.trim().split(/\s+/);
          const last = words[words.length - 1].replace(/[."”]+$/, '');
          const n = L < 1 ? 1 : 3;
          for (let k = 1; k <= n; k++) {
            const e = document.createElement('span');
            e.className = 'echo e' + k;
            e.textContent = ' ' + last;
            span.append(e);
          }
          break;
        }
        default:
          span.textContent = seg.t;
      }
      frag.append(span);
    }
    return frag;
  }

  // G6: 이름 오염
  function nameText(name, level) {
    if (!name) return '';
    if (lv() === 0 || level < 2) return name;
    if (level >= 3) return '아무개';
    const a = [...name];
    if (a.length === 1) return name + '▇';
    a[a.length - 1] = '▇';
    return a.join('');
  }

  G.fx = { obfuscate, decompose, hasJong, parse, plain, build, nameText, g1, g2, g3, level: lv, GL };
})();
