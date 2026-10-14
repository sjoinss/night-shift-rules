(function () {
  const G = window.G;
  const T = (s) => G.toM(s);

  G.data.places = {
    F: { label: 'F', pos: 4, hidden: true },
    '3F': { label: '3층', pos: 3 },
    '2F': { label: '2층', pos: 2 },
    '1F': { label: '1층 로비', pos: 1 },
    경비실: { label: '경비실', pos: 1 },
    B1: { label: '지하 1층', pos: 0 },
  };
  G.data.floorOrder = ['3F', '2F', '1F', '경비실', 'B1'];

  G.moveCost = (a, b) => {
    if (a === b) return 0;
    const pa = G.data.places[a].pos;
    const pb = G.data.places[b].pos;
    if (pa === pb) return 1;
    return Math.abs(pa - pb) * 2;
  };

  // 시간대: a 22~24시, b 00~03:17, c 03:17~05:00, d 05:00~
  const band = (t) => (t < T('00:00') ? 'a' : t < T('03:17') ? 'b' : t < T('05:00') ? 'c' : 'd');

  const PATROL = {
    B1: {
      a: ['주차장. 차 두 대. 하나는 바퀴가 내려앉아 있다.', '구내식당 셔터는 내려져 있고, 그 아래로 냉장고 소리가 샌다.'],
      b: ['냉장고 소리가 멎어 있다.', '주차장에 차는 한 대뿐이다. 다른 한 대가 나가는 소리는 듣지 못했다.'],
      c: ['주차장에 차가 없다. 바닥에 바퀴 자국만 둘.', { t: '처음부터 한 대였는지 잘 생각나지 않는다.', c: 'th' }],
      d: ['주차장. 환기구로 찬 공기가 들어온다.', '바깥 냄새가 난다. 비 냄새는 아니다.'],
    },
    '1F': {
      a: ['로비. 우편함 줄이 고르지 않다. 게시판에 공지가 몇 장.', '엘리베이터는 1층에 서 있다.'],
      b: ['로비 자동문 유리에 경비실 불빛이 비친다.', '유리 속 경비실 의자에 누가 앉아 있는 것처럼 보인다. 돌아보면 비어 있다.'],
      c: ['로비 시계가 경비실 시계보다 2분 늦다.', { t: '아까는 맞았다.', c: 'th' }],
      d: ['로비 자동문 밖이 조금 밝아졌다.', '아직 파랗다.'],
    },
    '2F': {
      a: ["빈 점포 셋. 유리문마다 '임대' 종이.", '하나는 테이프가 떨어져 바닥에 엎어져 있다.'],
      b: ["'임대' 종이가 다시 붙어 있다. 테이프 두 줄. 반듯하게."],
      c: ['빈 점포 유리문 안쪽에 의자가 하나 나와 있다.', '문 쪽을 보고 놓여 있다.'],
      d: ['빈 점포 셋. 조용하다.', '의자는 원래 자리에 있다.'],
    },
    '3F': {
      a: ['세무사무소, 학원, 창고.', "복도 끝 스위치에 테이프가 붙어 있다. '켜지 마시오.' 매직으로 꾹꾹 눌러 쓴 글씨."],
      b: ['스위치 테이프가 반쯤 떼어져 있다. 누가 떼다 만 것처럼.'],
      c: ['학원 유리문에 입김 자국이 있다. 안쪽에.', '아직 마르지 않았다.'],
      d: ['3층 복도. 창으로 새벽빛이 조금.', '입김 자국은 없다.'],
    },
  };

  function patrolKey(t) {
    return String(G.clockParts(t)[0]);
  }

  G.patrolHour = patrolKey;

  async function patrol(g) {
    const S = g.S;
    const k = patrolKey(S.t);
    S.patrol[k] = S.patrol[k] || [];
    if (S.patrol[k].includes(S.place)) {
      const again = G.data.patrolAgain[S.place];
      const n = (S.done['again_' + S.place] = (S.done['again_' + S.place] || 0) + 1);
      await g.p(again[(n - 1) % again.length]);
      return;
    }
    S.patrol[k].push(S.place);
    const lines = PATROL[S.place][band(S.t)].slice();
    if (S.place === '3F' && S.light3) lines.push('복도 불이 켜져 있다. 그런데 복도가 아까보다 좁아 보인다.');
    if (S.place === '1F' && S.flags.letChief) lines.push('현관 매트가 젖어 있다. 안쪽으로 발자국 모양.');
    await g.p(lines);
  }

  function cctv(S) {
    const t = S.t;
    if (t >= T('05:00')) return ['1 현관. 비어 있음.', '2 엘리베이터. 1층. 문 닫힘.', '3 3층 복도. 비어 있음.', '4 주차장. 비어 있음.'];
    if (t >= T('03:17'))
      return [
        '1 현관. 비어 있음.',
        "2 엘리베이터. 층 표시가 'F'.",
        S.light3 ? '3 3층 복도. 불이 켜져 있다. 사람이 많다. 아무도 움직이지 않는다.' : '3 3층 복도. 어둡다.',
        '4 주차장 카메라인데, 경비실이 나온다. 의자가 비어 있다.',
      ];
    if (t >= T('00:00'))
      return [
        S.flags.letChief ? '1 현관. 안쪽 바닥에 물 자국.' : '1 현관. 유리문 밖에 우산 하나가 펴진 채 놓여 있다.',
        '2 엘리베이터 내부. 비어 있음. 층 표시가 꺼져 있다.',
        S.light3 ? '3 3층 복도. 불이 켜져 있다. 끝 쪽에 사람이 서 있다.' : '3 3층 복도. 어둡다. 화면 끝이 조금 더 어둡다.',
        '4 주차장. 차 한 대.',
      ];
    return ['1 현관. 비어 있음.', '2 엘리베이터. 1층, 문 닫힘.', S.light3 ? '3 3층 복도. 불이 켜져 있다.' : '3 3층 복도. 어둡다.', '4 주차장. 차 두 대.'];
  }

  const REST = [
    (S) => '형광등 소리.',
    (S) => '벽시계 초침이 한 칸씩 간다. 가끔 두 칸.',
    (S) => '무전기 표시등이 깜박인다. 아무 소리도 나지 않는다.',
    (S) => (S.t >= T('00:00') ? '위층에서 의자 끄는 소리. 한 번.' : '밖으로 차가 한 대 지나간다.'),
    (S) => (S.consent >= 2 ? '의자 뒤에서 누가 숨을 고른다. 돌아보면 벽이다.' : '종이컵에 남은 커피가 식어 있다.'),
  ];

  function restLine(S) {
    const n = (S.done.rest = (S.done.rest || 0) + 1);
    const pool = REST.concat(G.data.restMore || []);
    return pool[(n - 1) % pool.length](S);
  }

  // 다음에 무슨 일이 생기기까지 남은 분 (시간 이벤트, 자리 비움, 06:00)
  G.untilNext = (S) => {
    const at = G.data.events.filter((e) => !S.fired[e.id]).map((e) => T(e.at));
    if (S.flags.awayPending && !S.flags.awayDone) at.push(T('23:30'));
    at.push(T('06:00'));
    return Math.min(...at.filter((t) => t > S.t)) - S.t;
  };

  // 각 행동: label, place, dur(분, 또는 S => 분), avail(S), run(g)
  G.data.actions = [
    // 경비실
    { id: 'cctv', place: '경비실', label: 'CCTV를 본다', dur: 1, photo: 'monitor', run: async (g) => g.p(cctv(g.S).map((t) => ({ t, c: 'mono' }))) },
    {
      id: 'journal',
      place: '경비실',
      label: (S) => (S.journalOpened ? '근무 일지를 쓴다' : '근무 일지를 편다'),
      dur: 3,
      run: async (g) => G.scenes.journal(g),
    },
    {
      id: 'ledger',
      place: '경비실',
      label: '출입 대장을 본다',
      dur: 3,
      avail: (S) => !S.readLedger,
      run: async (g) => {
        g.S.readLedger = true;
        await g.p('출입 대장과 출근부가 한 권에 묶여 있다.');
        await g.openDoc('ledger');
      },
    },
    {
      id: 'jung',
      group: '서랍',
      place: '경비실',
      label: (S) => (S.jungPages ? '정 씨 수첩을 마저 읽는다' : '서랍 속 낡은 수첩을 읽는다'),
      dur: 5,
      avail: (S) => S.jungPages < 3,
      run: async (g) => {
        const S = g.S;
        if (!S.jungPages) await g.p('검은 비닐 표지. 모서리가 닳았다. 안쪽에 볼펜 글씨.');
        S.jungPages++;
        await g.openDoc('jung');
      },
    },
    {
      id: 'jungBack',
      group: '서랍',
      place: '경비실',
      label: '수첩 뒷장을 펼친다',
      dur: 5,
      avail: (S) => S.jungPages > 0 && !S.jungBack,
      run: async (g) => {
        g.S.jungBack = true;
        await g.p('뒷장에 수칙이 한 번 더 적혀 있다. 손으로.');
        await g.openDoc('jung', 'back');
      },
    },
    {
      id: 'history',
      group: '서랍',
      place: '경비실',
      label: '서랍 안쪽 서류철을 꺼낸다',
      dur: 5,
      avail: (S) => !S.readHistory,
      run: async (g) => {
        const S = g.S;
        S.readHistory = true;
        await g.p("누런 서류철. 표지에 '수칙 개정 이력'.");
        if (!S.pieces.includes('c')) {
          S.pieces.push('c');
          await g.p('서류철 밑에서 찢어진 종이 조각이 하나 떨어진다.');
        }
        await g.openDoc('history');
      },
    },
    { id: 'keys', place: '경비실', label: '열쇠함을 연다', dur: 1, run: async (g) => G.scenes.keys(g) },
    {
      id: 'rest',
      place: '경비실',
      label: '의자에 앉아 있는다',
      dur: 10,
      run: async (g) => g.p(restLine(g.S)),
    },
    {
      id: 'wait',
      place: '경비실',
      label: '무슨 일이 생길 때까지 앉아 있는다',
      dur: (S) => G.untilNext(S),
      avail: (S) => G.untilNext(S) > 10,
      run: async (g) => g.p('의자에 등을 붙이고 시계만 본다.', restLine(g.S), { t: '시간이 한꺼번에 간다.', c: 'dim' }),
    },

    // 1층
    {
      id: 'board',
      place: '1F',
      label: '게시판을 읽는다',
      dur: 3,
      run: async (g) => {
        const S = g.S;
        const F = G.data.facts;
        Object.keys(F).forEach((k) => {
          if (!S.facts.includes(k)) S.facts.push(k);
        });
        await g.p(
          '코르크 게시판. 압정이 많다.',
          ...Object.keys(F).map((k) => ({ t: F[k].board, c: 'mono' })),
          { t: '야간 경비원 구함 (상시)', c: 'mono' },
          '맨 아래 구인 공고는 같은 종이가 몇 겹으로 겹쳐 붙어 있다.'
        );
      },
    },
    {
      id: 'mail',
      place: '1F',
      label: '우편물을 정리한다',
      dur: 8,
      avail: (S) => !S.done.mail || (S.t >= T('03:00') && !S.done.mail2),
      run: async (g) => {
        const S = g.S;
        if (!S.done.mail) {
          S.done.mail = true;
          if (!S.clues.includes('mail')) S.clues.push('mail');
          await g.p(
            '우편함 서른두 칸. 전단지, 고지서, 전단지.',
            '바닥에 반송 우편 한 통이 떨어져 있다.',
            '받는 사람 정▇수 귀하. 가운데 글자가 물에 번졌다.',
            '보낸 곳 금성상가 관리사무소. 반송 사유 수취인 불명.',
            '주머니에 넣는다.'
          );
        } else {
          S.done.mail2 = true;
          await g.p(
            '아까 비운 우편함에 봉투가 하나 더 있다.',
            '금성상가 야간경비 {{surname}}○○ 귀하.',
            '우표도 우체국 도장도 없다. 봉투는 비어 있다.',
            { t: '글씨가 낯익다. 출근부에 당신이 쓴 글씨다.', c: 'th' }
          );
        }
      },
    },
    {
      id: 'lost',
      place: '1F',
      label: '분실물함을 정리한다',
      dur: 8,
      avail: (S) => !S.done.lost,
      run: async (g) => {
        const S = g.S;
        S.done.lost = true;
        ['tag', 'key'].forEach((k) => S.clues.includes(k) || S.clues.push(k));
        await g.p(
          '우산 일곱 개. 장갑 한 짝. 아이 신발 한 짝.',
          '플라스틱 명찰 하나. ▇민▇. 양쪽 글자가 긁혀 나갔다.',
          "열쇠 하나. 종이 태그에 볼펜으로 '민수 보관'.",
          '어느 문 열쇠인지는 적혀 있지 않다.'
        );
      },
    },
    { id: 'elev', place: '1F', label: '엘리베이터를 부른다', dur: 1, run: async (g) => G.scenes.elevator(g) },

    // 2층
    {
      id: 'shops',
      place: '2F',
      label: '빈 점포 문을 확인한다',
      dur: 5,
      avail: (S) => !S.done.shops,
      run: async (g) => {
        g.S.done.shops = true;
        await g.p(
          '세 칸 다 잠겨 있다.',
          '가운데 칸 손잡이가 무겁다. 안쪽에서 누가 같이 쥐고 있는 것처럼.',
          { t: '손을 떼자 그쪽도 놓는다.', w: 600 }
        );
      },
    },

    // 3층
    {
      id: 'trash3',
      place: '3F',
      label: '쓰레기통을 비운다',
      dur: 10,
      avail: (S) => !S.done.trash3,
      run: async (g) => {
        const S = g.S;
        S.done.trash3 = true;
        ['a', 'b'].forEach((k) => S.pieces.includes(k) || S.pieces.push(k));
        await g.p(
          '종이컵, 영수증, 파쇄된 서류.',
          '통 바닥에 손글씨 종이 조각 두 장이 붙어 있다. 같은 종이를 찢은 것이다.',
          '주머니에 넣는다.'
        );
      },
    },
    {
      id: 'switch',
      place: '3F',
      label: (S) => (S.light3 ? '복도 불을 끈다' : '복도 불을 켠다'),
      dur: 1,
      run: async (g) => {
        const S = g.S;
        if (!S.light3) {
          S.light3 = true;
          if (!S.flags.lit3) {
            S.flags.lit3 = true;
            g.add('consent', 1);
          }
          await g.p('테이프를 떼고 스위치를 올린다.', { t: '복도 끝에서부터 불이 하나씩 들어온다. 스위치 쪽으로.', w: 300 });
        } else {
          S.light3 = false;
          await g.p('끈다. 마지막 형광등이 꺼지기까지 조금 걸린다.');
        }
      },
    },

    // 지하
    {
      id: 'trashB1',
      place: 'B1',
      label: '쓰레기통을 비운다',
      dur: 10,
      avail: (S) => !S.done.trashB1,
      run: async (g) => {
        g.S.done.trashB1 = true;
        await g.p('식권 뭉치, 육개장 국물 냄새.', '봉투를 묶어 내놓는다.', '내놓은 봉투 옆에 똑같이 묶인 봉투가 하나 더 있다.', { t: '아까는 없었다.', c: 'th' });
      },
    },
  ];

  // 모든 순찰 구역에 '둘러본다'
  ['B1', '1F', '2F', '3F'].forEach((p) =>
    G.data.actions.unshift({ id: 'patrol_' + p, place: p, label: '둘러본다', dur: 4, run: patrol })
  );
})();
