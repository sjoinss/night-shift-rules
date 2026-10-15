(function () {
  const G = window.G;
  const T = (s) => G.toM(s);
  const FLOORS = ['B1', '1F', '2F', '3F'];

  // ───────── 금일 근무표 ─────────
  // hand: 인쇄가 아니라 누가 볼펜으로 덧붙인 줄
  const TASK = {
    patrol: { label: '순찰' },
    ledger: { label: '출입 대장 확인', place: '경비실', doneIf: (S) => S.readLedger },
    mail: { label: '우편함 정리', place: '1F' },
    lost: { label: '분실물함 정리', place: '1F', doneIf: (S) => !!S.done.lost },
    shred: { label: '폐기 서류 파쇄', place: '경비실' },
    trash3: { label: '쓰레기통 3층', place: '3F' },
    trashB1: { label: '쓰레기통 지하', place: 'B1' },
    journal: { label: '일지 기록', place: '경비실' },
    keycount: { label: '반납 열쇠 정리', place: '경비실' },
    tape: { label: '녹화 확인', place: '경비실' },
    switch: { label: '3층 복도 불 켤 것', place: '3F', hand: true, doneIf: (S) => S.light3 },
    F: { label: '04:00 F층 순찰', hand: true, req: (S) => !!S.mutated[2], doneIf: (S) => S.fDone || S.fFailed },
    handover: { label: '05:40 오 씨에게 열쇠 인계', hand: true, req: (S) => !!S.mutated[10], doneIf: (S) => S.keyGiven },
  };

  const SCHED = {
    22: ['patrol', 'ledger', 'mail'],
    23: ['patrol', 'shred', 'lost'],
    0: ['patrol', 'trash3', 'journal'],
    1: ['patrol', 'keycount', 'trashB1'],
    2: ['patrol', 'tape', 'shred', 'switch'],
    3: ['patrol', 'mail', 'trash3', 'journal'],
    4: ['patrol', 'F', 'shred', 'tape'],
    5: ['patrol', 'keycount', 'journal', 'handover'],
  };

  const hourOf = (S) => G.patrolHour(S.t);
  const prevHour = (h) => String((+h + 23) % 24);

  function items(S, h) {
    if (h === undefined) h = hourOf(S);
    return (SCHED[h] || []).filter((id) => !TASK[id].req || TASK[id].req(S));
  }
  function isDone(S, h, id) {
    if (id === 'patrol') return FLOORS.every((f) => (S.patrol[h] || []).includes(f));
    if (TASK[id].doneIf) return !!TASK[id].doneIf(S);
    return (S.duty[h] || []).includes(id);
  }
  function pending(S, id) {
    const h = hourOf(S);
    return items(S, h).includes(id) && !isDone(S, h, id);
  }
  // 지금 시간 것이거나, 바로 전 시간에 밀린 것
  function open(S, id) {
    const p = prevHour(hourOf(S));
    return pending(S, id) || (items(S, p).includes(id) && !isDone(S, p, id));
  }
  function mark(S, id) {
    if (!TASK[id]) return;
    for (const h of [hourOf(S), prevHour(hourOf(S))]) {
      if (items(S, h).includes(id) && !isDone(S, h, id)) {
        (S.duty[h] = S.duty[h] || []).push(id);
        return;
      }
    }
  }
  function allDone(S) {
    const h = hourOf(S);
    return items(S, h)
      .filter((id) => !TASK[id].hand)
      .every((id) => isDone(S, h, id));
  }
  function patrolTodo(S, place) {
    const h = hourOf(S);
    return pending(S, 'patrol') && !(S.patrol[h] || []).includes(place);
  }
  function floorTodo(S, place) {
    const h = hourOf(S);
    return items(S, h).some((id) => {
      if (isDone(S, h, id)) return false;
      if (id === 'patrol') return FLOORS.includes(place) && !(S.patrol[h] || []).includes(place);
      return TASK[id].place === place;
    });
  }
  // 몇 번째로 하는지 (0부터)
  function nth(S, id) {
    const k = id + '_n';
    const n = S.done[k] || 0;
    S.done[k] = n + 1;
    return n;
  }
  // 근무표 칸에 보일 것
  function view(S) {
    const h = hourOf(S);
    return {
      hour: h.padStart(2, '0') + '시',
      rows: items(S, h).map((id) => ({
        id,
        label: TASK[id].label,
        hand: !!TASK[id].hand,
        done: isDone(S, h, id),
        floors: id === 'patrol' ? FLOORS.map((f) => ({ f, done: (S.patrol[h] || []).includes(f) })) : null,
      })),
    };
  }

  function score(S) {
    let done = 0;
    let total = 0;
    Object.keys(SCHED).forEach((h) =>
      SCHED[h].forEach((id) => {
        if (TASK[id].hand) return;
        total++;
        if (isDone(S, h, id)) done++;
      })
    );
    return [done, total];
  }

  G.duty = { items, isDone, pending, open, mark, allDone, patrolTodo, floorTodo, nth, view, score, TASK };

  // ───────── 파쇄할 서류 ─────────
  const keepSheet = (g) => {
    if (!g.S.clues.includes('sheet')) g.S.clues.push('sheet');
  };
  G.data.clues.sheet = { name: '근무 일지 한 장', text: '10/15. 칸마다 이상 없음. 03:17 칸만 비어 있다.' };

  // 지난 판이 있으면, 그 밤의 일지가 폐기 서류 사이에 끼어 있다
  function lastNight() {
    const A = G.archive;
    if (!A || !A.runs) return [];
    const end = {
      A: ['06:00  인계 완료'],
      B: ['06:00  ▇▇▇▇'],
      C: ['00:19  문 열어 드림', '이후 기록 없음'],
      D: ['06:00  수칙 12번 기재'],
      E: ['04:48  F층 정민수 확인', '06:00  인계 완료'],
    }[A.last] || ['06:00'];
    return [
      {
        head: '근무 일지  10/14',
        lines: ['야간  {{surname}}○○', '22:00  순찰  이상 없음', '03:17  ', ...end],
        after: [{ t: '어젯밤 일지다. 출근부에 적힌 어젯밤 근무자는 정 씨인데, 칸마다 당신 글씨로 채워져 있다.', c: 'th', w: 500 }],
      },
    ];
  }

  const SHRED = [
    // 23시
    (S) => [
      { head: '관리비 고지서 (사본)', lines: ['203호 행복분식', '미납 3개월', '연락 안 됨. 다음 달 명도.'] },
      { head: '출입 대장  9월', lines: ['09/14  21:50  야간 정  출근', '09/15  06:00  주간 오  출근', '09/15  21:50  야간 정  출근', '09/16  06:00  주간 오  출근'] },
      { head: '전단', lines: ['금성상가 2층 점포 임대', '보증금 조정 가능', '문의 관리사무소'] },
      ...lastNight(),
      {
        head: '근무 일지  10/15',
        lines: ['야간  {{surname}}○○', '22:00  순찰  이상 없음', '23:00  순찰  이상 없음', '00:00  순찰  이상 없음', '01:00  순찰  이상 없음'],
        jam: {
          at: 0.45,
          extra: ['02:00  순찰  이상 없음', '03:00  순찰  이상 없음', '03:17', '04:00  순찰  이상 없음', '06:00  인계 완료'],
          after: [
            '빼낸 종이를 펼친다. 오늘 밤 근무 일지다.',
            { t: '오늘 일지는 아직 한 줄도 쓰지 않았는데, 당신 글씨로 빼곡하다.', c: 'th' },
            { t: '03:17 칸만 비어 있다.', w: 500 },
          ],
        },
        pocket: keepSheet,
        bin: '{{surname}}{{surname}}{{surname}}{{surname}}',
        after: [{ t: '통 안을 내려다보니 조각마다 글자가 하나씩 남아 있다.', w: 300 }, { t: '{{surname}}. {{surname}}. {{surname}}.', s: 'slow' }],
      },
    ],
    // 02시
    (S) => {
      const pile = [];
      if (S.clues.includes('sheet')) {
        S.clues.splice(S.clues.indexOf('sheet'), 1);
        pile.push({
          before: ['서류 더미 맨 위에 접힌 종이 한 장.', { t: '주머니를 만져 보니 비어 있다.', c: 'th', w: 600 }],
          head: '근무 일지  10/15',
          lines: ['야간  {{surname}}○○', '00:00  순찰  이상 없음', '01:00  순찰  이상 없음', '02:00  순찰  이상 없음', '03:17'],
        });
      }
      pile.push(
        { head: '대한세무회계  폐기', lines: ['주민등록번호  ▒▒▒▒▒▒-▒▒▒▒▒▒▒', '보관 기한 지남'] },
        {
          head: '한결수학 출석부  중2',
          lines: ['김도윤   ○ ○ ○ ○', '이서연   ○ ○ / ○', '박준호   ○ ○ ○ ○', '         ○ ○ ○ ○'],
          voice: { at: 0.55, sfx: 'voiceHi' },
          after: [{ t: '갈리는 소리 사이로, 작게.', w: 300 }, { t: '"네."', s: 'slow' }, { t: '이름 없는 줄에도 출석 표시가 빠짐없이 있었다.', c: 'th', w: 500 }],
        },
        {
          head: 'CCTV 출력물',
          lines: ['의자에 경비복. 고개를 숙이고 있다.', 'CH4  주차장', '출력  10/15  03:17'],
          flip: { at: 0.4, line: 0, to: '의자에 경비복. 고개를 들고 이쪽을 본다.' },
          after: [{ t: '분명 주차장 카메라 출력물인데, 찍힌 건 경비실이었다.', c: 'th' }, { t: '03:17은 아직 오지 않았다.', c: 'th' }],
        }
      );
      return pile;
    },
    // 04시
    (S) => [
      { head: '수칙  개정 제10판', lines: ['8. 손님이라 불리는 방문객은 안으로 들이지 않는다.', '9. 열쇠는 몸에서 떼지 않는다.', '10. 06:00 종이 울릴 때까지 문을 열지 않는다.'] },
      { head: '이력서', lines: ['성명   (수정액으로 지움)', '희망 근무   야간', '지원 동기   밤에 조용한 일을 하고 싶어서.'] },
      {
        head: '',
        lines: ['', '', '', ''],
        voice: { at: 0.5, sfx: 'knock' },
        bin: '열어줘열어줘',
        after: [{ t: '빈 종이였다.', c: 'th' }, '통 안 조각마다 글자가 묻어 있다.', { t: '열. 어. 줘.', s: 'slow' }, { t: '그러고 보니 갈리는 소리 사이에 두 번, 똑, 똑 하는 소리가 섞여 있었다.', w: 400 }],
      },
      { head: '출근부  2009', lines: ['01/05   한', '01/06   한', '01/07   한', '01/08   {{surname}}'], after: [{ t: '2009년이면 당신은 이 동네에 살지도 않았다.', c: 'th' }] },
    ],
  ];
  const SHRED_PLAIN = [
    { head: '전단', lines: ['금성상가 2층 점포 임대', '문의 관리사무소'] },
    { head: '영수증 묶음', lines: ['형광등 6개', '건전지 AA 4개', '종이컵 1줄'] },
  ];

  // ───────── 우편함 ─────────
  const MAIL = [
    {
      stuff: ['101', '104', '201', '301', '302', '307', 'B101'],
      flyers: [
        '전단. 치킨 두 마리 만육천 원.',
        '전단. 2층 점포 임대.',
        '전단. 2층 점포 임대.',
        '고지서. 대한세무회계.',
        '전단. 수학 겨울방학 특강.',
        '전단. 열쇠 복사, 도장.',
        '거래명세서. 대성식자재.',
      ],
      stubborn: {
        slot: '203',
        got: '반송 우편. 정▇수 귀하.',
        before: ['203호 칸 밖으로 봉투 끝이 삐죽 나왔다.', { t: '잡아당기자 안쪽에서 같이 당긴다.', c: 'th', w: 300 }],
        after: [
          { t: '끝이 젖은 봉투가 빠져나온다.', w: 300 },
          '받는 사람 정▇수 귀하. 가운데 글자가 물에 번졌다.',
          '보낸 곳 금성상가 관리사무소. 반송 사유 수취인 불명.',
          '주머니에 넣는다.',
          { t: '203호는 작년부터 비어 있다.', c: 'th' },
        ],
      },
      late: {
        label: '402',
        appear: [{ t: '맨 아랫줄 끝에 없던 칸이 하나 더 있다. 402호.', w: 400 }, { t: '아까 셀 때는 서른두 칸이었다.', c: 'th' }],
        lines: ['손을 뻗자 꽂혀 있던 종이가 안쪽으로 쏙 빨려 들어간다.', { t: '칸 안쪽에서 내쉰 숨이 손등에 닿는다.', w: 500 }],
        got: '',
      },
    },
    {
      before: ['아까 다 비운 칸마다 종이가 다시 삐져나왔다.'],
      stuff: ['102', '105', '204', '206', '303', 'B103'],
      flyers: [
        '전단. 2층 점포 임대.',
        '전단. 2층 점포 임대. 문의 경비실.',
        '전단. 문의 경비실.',
        '전단. 경비실 문 열어 주세요.',
        '전단. {{surname}} 씨 문 열어 주세요.',
        '전단. {{surname}} 씨. {{surname}} 씨.',
      ],
      late: {
        label: '경비',
        appear: [{ t: '우편함 맨 위 칸막이 틈에서 봉투 한 장이 눈에 띈다.', w: 300 }],
        lines: [
          '금성상가 야간경비 {{surname}}○○ 귀하.',
          '우표도 우체국 도장도 없는 봉투 안은 비어 있다.',
          { t: '어디서 본 글씨인가 했더니, 출근부에 당신이 쓴 글씨다.', c: 'th' },
        ],
        got: '봉투. {{surname}}○○ 귀하.',
      },
    },
  ];
  const MAIL_PLAIN = { stuff: ['103', '208', '304'], flyers: ['전단. 2층 점포 임대.'] };
  G.data.mailSet = (n) => MAIL[n] || MAIL_PLAIN;

  // ───────── 열쇠함 ─────────
  const ROWS = [
    ['101', '102', '103', '104', '105', '106', '107', '108'],
    ['201', '202', '203', '204', '205', '206', '207', '208'],
    ['301', '302', '303', '304', '305', '306', '307', '308'],
    ['B1-1', 'B1-2', 'B1-3', 'B1-4', 'B1-5', 'B1-6', 'B1-7', 'B1-8'],
    ['경비실', '옥상', '기계실', '전기실', '창고', '셔터', '비상구', 'F'],
  ];
  const KEYRUN = [
    {
      intro: ['반납함을 열자 낮에 빌려 간 열쇠 넷이 짤그랑 쏟아진다.', '태그 번호랑 같은 번호 고리에 걸면 된다.'],
      empty: ['202', '305', 'B1-3', '경비실'],
      keys: [
        { tag: '202', hook: '202' },
        { tag: '305', hook: '305' },
        { tag: 'B1-3', hook: 'B1-3' },
        {
          tag: '경비실',
          hook: '경비실',
          note: ['마지막 열쇠 태그에 적힌 글자는, 경비실.', { t: '경비실 열쇠는 당신 주머니에 있다.', c: 'th' }, '주머니를 더듬자 열쇠가 손에 잡힌다.', { t: '똑같은 열쇠가 둘이다.', w: 600 }],
        },
      ],
    },
    {
      intro: ['반납함 안에서 열쇠 셋이 짤그랑거린다.', { t: '오늘 밤 열쇠를 빌려 간 사람은 없다.', c: 'th' }],
      empty: ['창고', '옥상'],
      keys: [
        { tag: '창고', hook: '창고' },
        { tag: '옥상', hook: '옥상', note: [{ t: '옥상 열쇠 끝에 흙이 묻어 있다. 옥상엔 시멘트 바닥뿐인데.', w: 300 }] },
        {
          tag: '4▇2',
          hook: '402',
          note: ['세 번째 태그는 번져서 4와 2만 겨우 읽힌다.'],
          newHook: true,
          newHookNote: [{ t: '열쇠함 맨 아래에 못 보던 고리가 하나 박혀 있다.', w: 400 }],
        },
      ],
      done: [{ t: '402. 이 건물은 3층까지다.', c: 'th' }],
    },
  ];
  const KEY_PLAIN = { intro: ['반납함에 열쇠가 하나 들어왔다.'], empty: ['202'], keys: [{ tag: '202', hook: '202' }] };
  function keyCfg(S, n) {
    const run = KEYRUN[n] || KEY_PLAIN;
    const fHere = S.t >= T('04:30') && !S.hasFKey && !S.fDone && !S.fFailed;
    return {
      intro: run.intro,
      hooks: ROWS.flat().map((label) => ({ label, key: label === 'F' ? fHere : !run.empty.includes(label) })),
      keys: run.keys,
      done: run.done,
    };
  }

  // 01시: 반납함 정리 뒤 경비실 문
  async function doorKeyhole(g) {
    g.sfx('thud', 0.3);
    await g.p(
      { t: '등 뒤에서 딸깍.', w: 700 },
      '경비실 문 열쇠 구멍에 무언가 들어갔다가 빠지는 소리가 난다.',
      { t: '문은 안에서 잠가 두었고, 열쇠는 둘 다 여기 있다.', c: 'th' }
    );
    const c = await g.choose([
      { id: 'peek', label: '열쇠 구멍을 들여다본다' },
      { id: 'away', label: '문에서 물러난다' },
    ]);
    if (c === 'peek') {
      g.flag('peeked');
      await g.p('허리를 굽혀 구멍에 눈을 댄다.');
      await G.task.peek(g);
      await g.p(
        { t: '눈이 웃는다.', w: 300 },
        '물러선다.',
        { t: '로비 불빛이 새어 들어와야 할 열쇠 구멍이 까맣다.', w: 600 },
        { t: '아직 거기 붙어 있다.', c: 'th', w: 500 },
        { t: 'CCTV 1번 화면, 로비에는 아무도 없다.', c: 'mono', w: 600 }
      );
    } else {
      await g.p({ t: '딸깍. 딸깍.', s: 'slow' }, '맞는 열쇠를 찾듯 몇 번 더 이어진다.', { t: '그러다 조용해진다. 멀어지는 발소리는 끝내 들리지 않는다.', w: 700 });
    }
  }

  // ───────── 녹화 ─────────
  const TAPES = [
    {
      ch: 'CH2  엘리베이터',
      from: '01:59',
      to: '22:00',
      frames: [
        { at: '00:11', lines: ['비어 있음. 문 닫힘.'] },
        { at: '00:10', stop: true, lines: ['문이 열려 있다.', '젖은 바닥 위에 우산 하나가 펴진 채 서 있다.'] },
        { at: '22:51', lines: ['비어 있음.'] },
        { at: '22:50', stop: true, lines: ['문이 열린 채 안은 비어 있다.', '안쪽 거울에 로비가 비친다. 로비에 경비복.'] },
        { at: '22:21', lines: ['비어 있음.'] },
        {
          at: '22:20',
          stop: true,
          lines: ['안에 경비복 차림이 한 사람.', '모자를 눌러쓴 채 거울 쪽을 보고 서 있어서 얼굴이 안 보인다.'],
          say: [{ t: '22시 20분. 그 시각 건물 안에 경비복을 입은 사람은 당신 하나였다.', c: 'th' }],
        },
        { at: '22:19', stop: true, lines: ['같은 사람.', '고개를 돌려 카메라를 보고 있다.'] },
        { at: '22:03', lines: ['비어 있음.'] },
        { at: '22:02', lines: ['순덕 씨가 엘리베이터 앞에서만 고개를 푹 숙이고 지나간다.'] },
        { at: '22:00', lines: ['비어 있음. 문 닫힘.'] },
      ],
      after: [{ t: '출입 대장에는 그 시각에 들어온 사람이 없다.', c: 'th' }],
    },
    {
      ch: 'CH4  주차장',
      from: '03:59',
      to: '00:00',
      frames: [
        { at: '03:18', lines: ['비어 있음. 바닥에 바퀴 자국 둘.'] },
        { at: '03:17', stop: true, lines: ['화면에 경비실이 찍혀 있다.', '의자에 경비복. 고개를 숙이고 있다.', '그 뒤에 하나가 더 서 있다.'] },
        { at: '03:16', lines: ['차 한 대. 운전석에 누가 앉아 있다.'] },
        { at: '02:53', lines: ['차 한 대.'] },
        { at: '02:52', stop: true, lines: ['차 옆 바닥에 무언가 웅크리고 있다.', '화질이 나빠 크기를 가늠할 수 없지만, 아주 크다.'] },
        { at: '01:00', lines: ['차 한 대.'] },
        { at: '00:00', lines: ['차 두 대.'] },
      ],
      after: [{ t: '03:17에 당신은 비상등 아래 있었지만, 고개를 숙인 기억은 없다.', c: 'th' }],
    },
  ];

  // ───────── 근무표에 묶인 새 일 ─────────
  G.data.actions.push(
    {
      id: 'shred',
      task: 'shred',
      place: '경비실',
      label: '폐기 서류를 파쇄한다',
      dur: 6,
      avail: (S) => G.duty.open(S, 'shred'),
      run: async (g) => {
        const n = G.duty.nth(g.S, 'shred');
        if (n === 0) await g.p('책상 옆 파쇄기 위로 폐기 서류가 상자째 수북하다.');
        await G.task.shred(g, SHRED[n] ? SHRED[n](g.S) : SHRED_PLAIN);
      },
    },
    {
      id: 'keycount',
      task: 'keycount',
      place: '경비실',
      label: '반납된 열쇠를 건다',
      dur: 5,
      avail: (S) => G.duty.open(S, 'keycount'),
      run: async (g) => {
        const n = G.duty.nth(g.S, 'keycount');
        const cfg = keyCfg(g.S, n);
        await g.p(cfg.intro);
        await G.task.hangKeys(g, cfg);
        if (n === 0) await doorKeyhole(g);
      },
    },
    {
      id: 'tape',
      task: 'tape',
      place: '경비실',
      label: '녹화를 되감아 본다',
      dur: 6,
      photo: 'monitor',
      avail: (S) => G.duty.open(S, 'tape'),
      run: async (g) => {
        const n = G.duty.nth(g.S, 'tape');
        await G.task.tape(g, TAPES[n] || TAPES[TAPES.length - 1]);
      },
    }
  );
})();
