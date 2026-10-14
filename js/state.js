(function () {
  const G = (window.G = window.G || {});
  G.data = G.data || {};

  // 시간은 정오(12:00) 기준 분 단위. 21:50 → 590, 06:00 → 1080
  G.toM = (s) => {
    const [h, m] = s.split(':').map(Number);
    return (h < 12 ? h + 24 : h) * 60 + m - 720;
  };
  G.clockParts = (t) => {
    const x = (((t + 720) % 1440) + 1440) % 1440;
    return [Math.floor(x / 60), x % 60];
  };
  G.fmt = (t) => {
    const [h, m] = G.clockParts(t);
    return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
  };

  G.newState = () => ({
    v: 1,
    t: G.toM('21:50'),
    place: '경비실',
    surname: '',
    given: '',
    consent: 0,
    nameExposure: 0,
    keyGiven: false,
    restored7: false,
    knowsRealName: false,
    fDone: false,
    fFailed: false,
    hasFKey: false,
    light3: false,
    facts: [],
    logged: [],
    rulesSeen: [],
    struck: [],
    flags: {},
    fired: {},
    mutated: {},
    jungPages: 0,
    jungBack: false,
    readHistory: false,
    readLedger: false,
    journalOpened: false,
    pieces: [],
    clues: [],
    patrol: {},
    done: {},
    said: [],
    log: [],
    freeze: false,
    ended: null,
  });

  const KEY = 'hg.save.v1';
  const SKEY = 'hg.settings.v1';
  const AKEY = 'hg.archive.v1';

  G.store = {
    get(k, d) {
      try {
        const v = localStorage.getItem(k);
        return v ? JSON.parse(v) : d;
      } catch (e) {
        return d;
      }
    },
    set(k, v) {
      try {
        localStorage.setItem(k, JSON.stringify(v));
        return true;
      } catch (e) {
        return false;
      }
    },
    del(k) {
      try {
        localStorage.removeItem(k);
      } catch (e) {}
    },
  };

  G.save = () => {
    if (!G.S || G.S.ended) return;
    if (G.S.log.length > 500) G.S.log = G.S.log.slice(-500);
    G.store.set(KEY, G.S);
  };
  G.loadSave = () => {
    const s = G.store.get(KEY, null);
    return s && s.v === 1 && !s.ended ? Object.assign(G.newState(), s) : null;
  };
  G.clearSave = () => G.store.del(KEY);

  let reduce = false;
  try {
    reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch (e) {}

  G.settings = Object.assign(
    { speed: 'normal', fx: reduce ? 1 : 2, sound: true, timer: true },
    G.store.get(SKEY, {})
  );
  G.saveSettings = () => G.store.set(SKEY, G.settings);

  G.archive = Object.assign({ endings: [], runs: 0, lastRule: '' }, G.store.get(AKEY, {}));
  G.saveArchive = () => G.store.set(AKEY, G.archive);
})();
