(function () {
  const G = window.G;
  const T = (s) => G.toM(s);
  const S_ = G.scenes;
  // 시간대: a 22~24시, b 00~03:17, c 03:17~05:00, d 05:00~
  const band = (t) => (t < T('00:00') ? 'a' : t < T('03:17') ? 'b' : t < T('05:00') ? 'c' : 'd');

  // ───────── 빈 시간을 채우는 작은 사건들 ─────────
  G.data.events.push(
    { id: 'phoneBlank', at: '22:20', scene: 'phoneBlank' },
    { id: 'glass2F', at: '22:35', scene: 'glass2F' },
    { id: 'radioCount', at: '23:05', scene: 'radioCount' },
    { id: 'fridge', at: '23:50', scene: 'fridge' },
    { id: 'mail402', at: '00:30', scene: 'mail402' },
    { id: 'sundukPhone', at: '01:40', scene: 'sundukPhone', photo: 'office' },
    { id: 'steps', at: '02:25', scene: 'steps' },
    { id: 'flicker', at: '03:00', scene: 'flicker' },
    { id: 'pen', at: '03:45', scene: 'pen' },
    { id: 'carStart', at: '04:20', scene: 'carStart' },
    { id: 'keysClink', at: '04:40', scene: 'keysClink' },
    { id: 'chiefCall', at: '05:28', scene: 'chiefCall', photo: 'office' }
  );
  G.data.events.sort((a, b) => T(a.at) - T(b.at));

  S_.phoneBlank = async (g) => {
    if (g.S.place !== '경비실') return;
    g.sfx('phone', 0.5);
    await g.p({ t: '전화가 한 번 울리고 끊긴다.', w: 300 }, '발신 번호 칸이 비어 있다.');
  };

  S_.glass2F = async (g) => {
    if (g.S.place === '2F') {
      await g.p('가운데 점포 유리문이 안쪽에서 두 번 흔들린다.', '잠금쇠가 덜컥거린다. 그리고 가만해진다.');
    } else {
      await g.p({ t: '위층 어딘가에서 유리문 흔드는 소리. 두 번.', w: 300 });
    }
  };

  S_.radioCount = async (g) => {
    g.sfx('static', 0.5);
    await g.p('무전기에서 누가 숫자를 센다.', { t: '"하나. 둘. 셋. 넷…"', s: 'slow' }, { t: '열하나에서 멈춘다.', w: 900 });
  };

  S_.fridge = async (g) => {
    if (g.S.place === 'B1') await g.p('식당 셔터 안쪽에서 냉장고가 멈춘다. 마지막으로 한 번 크게 떤다.');
    else await g.p({ t: '아래층에서 무언가 꺼지는 소리.', w: 300 }, '조용함이 한 칸 더 깊어진다.');
  };

  S_.mail402 = async (g) => {
    if (g.S.place !== '1F') return;
    await g.p({ t: '우편함 하나가 덜컹 닫힌다.', w: 300 }, '402호 칸이다.', { t: '아까 정리할 때, 4층 칸은 없었다.', c: 'th', w: 600 });
  };

  // 진짜 순덕. 낮의 일을 안다.
  S_.sundukPhone = async (g) => {
    const S = g.S;
    if (S.place !== '경비실') {
      g.sfx('phone', 0.3);
      await g.p('멀리 경비실 전화가 울린다. 길게.');
      const c = await g.choose([
        { id: 'go', label: '내려간다' },
        { id: 'no', label: '그냥 둔다' },
      ]);
      if (c === 'no') {
        await g.p({ t: '열 번쯤 울리고 끊긴다.', w: 600 });
        return;
      }
      await g.move('경비실');
    }
    g.sfx('phone');
    await g.p('전화를 든다.', '"여보세요? 나 순덕이에요. 집이에요. 깼어요?"', '"아니 자다가, 정 씨 이름이 생각날 듯해서. 정… 민… 뭐였더라. 아이고, 혀끝에서 맴도네."');
    let asked = false;
    for (;;) {
      const c = await g.choose([
        { id: 'lunch', label: '"오늘 점심 뭐 드셨어요?"', req: !asked },
        { id: 'who', label: '"정말 순덕 씨예요?"' },
        { id: 'hang', label: '아무 말 없이 끊는다' },
      ]);
      if (c === 'lunch') {
        asked = true;
        g.flag('sundukVerified');
        await g.p('"육개장. 짜더라. 계란말이는 다 식었고. 근데 그건 왜요?"', { t: '"…아, 그거 하는구나. 정 씨도 맨날 그거 물었어."', w: 400 });
        continue;
      }
      if (c === 'who') {
        await g.p('"그럼 누구예요, 이 시간에. 나지."', { t: '"…그쪽이 진짜 경비 양반이에요?"', w: 600 }, { t: '수화기 너머에서 잠깐 숨을 참는 소리.', w: 800 });
      }
      break;
    }
    await g.p(
      { t: '"3층 불은 껐죠? 껐으면 됐어요. 자요, 나는."', w: 300 },
      { t: '"아, 민수. 그래, 민수였어."', s: 'slow', w: 500 },
      '뚝.'
    );
    g.time(4);
  };

  S_.steps = async (g) => {
    await g.p({ t: '머리 위에서 발소리.', w: 400 }, '당신이 오늘 밤 걸은 순서대로. 같은 속도로.');
  };

  S_.flicker = async (g) => {
    await g.p('형광등 하나가 깜박이기 시작한다. 박자가 일정하다.', { t: '세어 보면, 열일곱 번에 한 번 길게 꺼진다.', w: 600 });
  };

  S_.pen = async (g) => {
    g.sfx('pen');
    await g.p('무전기에서 펜 소리. 사각사각.', { t: '무언가를 받아 적고 있다. 당신이 방금 한 생각을.', w: 600 });
  };

  S_.carStart = async (g) => {
    if (g.S.place === 'B1') await g.p('주차장 안쪽에서 시동 소리. 둘러봐도 차가 없다.', { t: '배기가스 냄새만 남는다.', w: 600 });
    else await g.p({ t: '지하에서 차 시동 거는 소리.', w: 400 }, '한참 그대로 켜져 있다가 꺼진다.');
  };

  // F 열쇠 힌트
  S_.keysClink = async (g) => {
    const S = g.S;
    if (S.hasFKey || S.fDone || S.fFailed) return;
    if (S.place === '경비실') await g.p({ t: '열쇠함 쪽에서 쇠붙이 부딪는 소리. 한 번.', w: 300 }, { t: '바람은 없다.', c: 'th' });
    else {
      g.sfx('static', 0.4);
      await g.p('무전기. 잡음 사이로 한 단어.', { t: '"…열쇠…"', s: 'slow' });
    }
  };

  // 진짜 소장. 말끝을 흐린다.
  S_.chiefCall = async (g) => {
    const S = g.S;
    if (S.place !== '경비실') {
      g.sfx('phone', 0.3);
      await g.p('경비실 전화가 울린다.');
      const c = await g.choose([
        { id: 'go', label: '내려간다' },
        { id: 'no', label: '그냥 둔다' },
      ]);
      if (c === 'no') {
        await g.p({ t: '오래 울리다 끊긴다.', w: 600 });
        return;
      }
      await g.move('경비실');
    }
    g.sfx('phone');
    await g.p(
      '"아, 저예요. 소장. 깨어 계시죠? 아니, 당연히… 깨어 계시겠지."',
      '"오 씨가 오늘 좀 늦는대요. 6시 넘어서. 차가 막힌다고… 새벽에 무슨 차가 막히는지."',
      { t: '"그 전에 누가 와도… 아니, 그냥."', w: 400 },
      '"6시에 봬요."'
    );
    g.flag('chiefWarned');
    g.time(2);
  };

  // ───────── 한 번씩 들여다보는 행동 ─────────
  const once = (S, key) => !S.done[key];
  const mark = (S, key) => (S.done[key] = true);

  const PEEK = {
    a: ['길 건너 편의점 불이 켜져 있다. 손님은 없다.', '바닥이 말라 있다.'],
    b: ['편의점 불이 꺼져 있다. 24시간이라고 써 붙인 곳이다.', '유리문에 입김이 서린다. 바깥쪽에.'],
    c: ['가로등 아래 우산 하나가 펴진 채 놓여 있다.', '바람은 없는데 조금씩 돈다.'],
    d: ['하늘 끝이 파래졌다.', '멀리 첫차 지나가는 소리.'],
  };
  const BOARD = {
    a: ['칠판에 오늘 날짜와 숙제 범위. 교실은 비어 있다.'],
    b: ['칠판 날짜가 내일로 바뀌어 있다.', '분필 가루가 아직 떨어지고 있다.'],
    c: ['칠판 가득 같은 글자. {{surname}}.', '크기만 조금씩 다르다.'],
    d: ['칠판이 깨끗하다. 지운 자국도 없다.'],
  };
  const SHUTTER = {
    a: ['냉장고 불빛. 스테인리스 조리대. 국자 하나가 걸려 있다.'],
    b: ['냉장고 불이 꺼져 있다.', '셔터 틈 바로 안쪽에 신발 두 짝. 이쪽을 향해 있다.'],
    c: ['신발이 없다. 셔터 안쪽 바닥에 젖은 자국 두 개.'],
    d: ['셔터 너머로 밥 짓는 냄새. 아직 아무도 출근하지 않았다.'],
  };
  const WINDOW = {
    a: ['경비실 창 너머로 로비. 형광등 하나가 남들보다 조금 늦게 깜박인다.'],
    b: ['창에 경비실 안이 비친다. 의자, 책상, 당신.', '옷걸이에 경비복이 하나 더 걸려 있다.', { t: '돌아보면 옷걸이는 비어 있다.', w: 700 }],
    c: ['로비 바닥에 발자국. 경비실 창 앞까지 와서 멈춰 있다.'],
    d: ['유리에 김이 서려 있다. 손가락으로 쓴 자국이 있는데, 다 흘러내려서 읽을 수 없다.'],
  };

  const bandAction = (id, place, label, dur, table) => ({
    id,
    place,
    label,
    dur,
    avail: (S) => once(S, id + '_' + band(S.t)),
    run: async (g) => {
      mark(g.S, id + '_' + band(g.S.t));
      await g.p(table[band(g.S.t)]);
    },
  });

  G.data.actions.push(
    bandAction('peekOut', '1F', '자동문 밖을 내다본다', 2, PEEK),
    bandAction('academy', '3F', '학원 문 유리로 들여다본다', 2, BOARD),
    bandAction('shutter', 'B1', '식당 셔터 틈으로 본다', 2, SHUTTER),
    bandAction('window', '경비실', '창밖을 본다', 1, WINDOW),
    {
      id: 'shopPeek',
      place: '2F',
      label: '가운데 점포 안을 들여다본다',
      dur: 3,
      avail: (S) => S.done.shops && once(S, 'shopPeek'),
      run: async (g) => {
        mark(g.S, 'shopPeek');
        await g.p(
          '유리에 이마를 대고 안을 본다.',
          '빈 점포 한가운데 책상 하나, 의자 하나.',
          '책상 위에 근무 일지와 같은 표지의 공책이 펼쳐져 있다.',
          { t: '글씨는 멀어서 안 보인다. 줄마다 끝이 같다는 것만 알겠다.', w: 500 }
        );
      },
    },
    {
      id: 'car',
      place: 'B1',
      label: '차 안을 들여다본다',
      dur: 3,
      avail: (S) => S.t < T('03:17') && once(S, 'car'),
      run: async (g) => {
        mark(g.S, 'car');
        await g.p(
          '먼지 앉은 흰 승용차. 앞 유리에 정기 주차증.',
          { t: '금성상가 정기주차  정▇▇  야간', c: 'mono' },
          '조수석에 경비 모자 하나. 뒷좌석에 개어 둔 담요.',
          { t: '보닛에 손을 대 본다.', w: 600 },
          { t: '따뜻하다.', s: 'slow' }
        );
      },
    },
    {
      id: 'drawerLow',
      group: '서랍',
      place: '경비실',
      label: '맨 아래 칸을 연다',
      dur: 2,
      avail: (S) => once(S, 'drawerLow'),
      run: async (g) => {
        mark(g.S, 'drawerLow');
        await g.p(
          '도시락 가방. 지퍼를 열면 반찬통 셋, 숟가락 하나.',
          "뚜껑 안쪽에 네임펜으로 '정'.",
          { t: '반찬통 하나는 씻지 않은 채다. 냄새는 나지 않는다.', w: 400 }
        );
      },
    }
  );

  // ───────── 같은 시간에 다시 둘러볼 때 ─────────
  G.data.patrolAgain = {
    B1: ['환풍기 소리만 난다.', '아까보다 바닥이 축축하다. 물 새는 곳은 없다.', '주차장 끝 비상구 표시등이 한 번 깜박인다.', '기둥 번호 하나가 거꾸로 붙어 있다. 아까도 그랬는지 모르겠다.'],
    '1F': ['우편함 뚜껑 하나가 열려 있다. 닫는다.', '자동문 센서 불이 혼자 켜졌다 꺼진다.', '게시판 압정 하나가 바닥에 떨어져 있다.', '엘리베이터 층 표시가 잠깐 꺼졌다 켜진다.'],
    '2F': ['세 번째 점포 안쪽에서 무언가 넘어지는 소리. 들여다봐도 아무것도 없다.', '복도 끝 창에 경비복이 비친다. 당신 것이다.', "바닥에 '임대' 종이 한 장. 주워서 붙여 둔다.", '빈 점포 유리문에 손자국. 안쪽에서 찍힌 것이다.'],
    '3F': ['학원 안에서 분필 소리. 한 번.', '세무사무소 팩스가 혼자 종이를 뱉는다. 빈 종이다.', '창고 문손잡이가 아까와 반대쪽으로 돌아가 있다.', '복도 스위치 테이프가 다시 붙어 있다.'],
  };

  // ───────── 앉아 있을 때 ─────────
  G.data.restMore = [
    (S) => '책상 유리 밑 쪽지들을 읽는다. 전부 정 씨 글씨다. 날짜가 조금씩 어긋나 있다.',
    (S) => (S.t >= T('00:00') ? '시계 초침 소리가 잠깐 끊긴다. 다시 들릴 때까지 숨을 참고 있었다.' : '밖에서 오토바이 한 대가 지나간다. 배달인가 보다.'),
    (S) => '출근부를 다시 넘겨 본다. 정 씨의 서명이 3주 내내 같은 자리에, 같은 크기로 있다.',
    (S) => (S.consent >= 1 ? '무전기 표시등이 당신 숨에 맞춰 깜박이는 것 같다.' : '무전기 표시등이 느리게 깜박인다.'),
    (S) => (S.t >= T('03:17') ? '형광등이 아까보다 누렇다.' : '형광등 소리가 조금 높아졌다가 내려온다.'),
    (S) => '종이컵을 버리려다 그만둔다. 아까 버린 것 같은데 그대로 있다.',
  ];

  // ───────── 02:52 지하의 아기 울음 ─────────
  // 이 건물에 아기는 없다. 소리로 부른다.
  G.data.events.push(
    { id: 'baby', at: '02:52', scene: 'baby', photo: 'parking' },
    { id: 'knock', at: '04:50', scene: 'knock' }
  );
  G.data.events.sort((a, b) => T(a.at) - T(b.at));

  S_.baby = async (g) => {
    const S = g.S;
    await g.p(
      S.place === 'B1' ? '주차장 안쪽에서 아기 울음소리.' : '발밑에서 아기 울음소리가 올라온다. 지하다.',
      { t: '숨 쉴 틈 없이 길게 운다.', w: 400 },
      { t: '아기는 저렇게 오래 울지 못한다.', c: 'th', w: 500 },
      { t: '이 건물에 아기는 없다.', c: 'th' }
    );
    const c = await g.choose([
      { id: 'go', label: S.place === 'B1' ? '소리 나는 쪽으로 간다' : '내려가 본다' },
      { id: 'radio', label: '무전기 소리를 키워 덮는다' },
      { id: 'stay', label: '가만히 있는다' },
    ]);
    if (c === 'go') {
      g.add('consent', 1);
      if (S.place !== 'B1') await g.move('B1');
      await g.p(
        '주차장 한가운데. 울음은 바로 앞에서 나는데, 앞에는 아무것도 없다.',
        { t: '한 걸음 다가가자 울음이 뚝 멎는다.', w: 900 },
        { t: '귀 바로 옆에서, 당신 목소리로.', w: 700 },
        { t: '"여기."', s: 'slow' }
      );
      g.time(4);
    } else if (c === 'radio') {
      g.sfx('static', 0.7);
      await g.p('잡음이 주변을 가득 채운다.', { t: '잡음 사이로도 울음이 들린다. 아니, 잡음이 울음 박자에 맞춰 끊긴다.', w: 700 }, { t: '끈다. 조용하다.', w: 900 });
    } else {
      await g.p({ t: '울음이 한 번 끊겼다가.', w: 1000 }, { t: '웃음으로 바뀐다.', w: 600 }, { t: '아기 웃음이 아니다. 아기 웃음을 흉내 내는, 어른의 웃음이다.', c: 'th' });
    }
  };

  // ───────── 04:50 문 두드리는 소리 ─────────
  // 선택지가 전부 같은 말이 된다. 아무것도 누르지 않아야 한다.
  S_.knock = async (g) => {
    const S = g.S;
    const door = S.place === '경비실' ? '경비실 문' : '등 뒤 계단 문';
    await g.p(
      { t: door + '을 누가 두드린다.', w: 300 },
      { t: '똑. 똑.', s: 'slow', w: 600 },
      S.place === '경비실' ? { t: '안에서 잠가 둔 문이다. 바깥은 건물 안이다.', c: 'th' } : { t: '방금 지나온 문이다.', c: 'th' },
      { t: '"아저씨. 문 좀 열어 주세요."', s: 'slow', w: 500 },
      '아이 목소리다.'
    );
    const r = await g.same({
      opts: [
        { id: 'quiet', label: '숨을 죽인다' },
        { id: 'ask', label: '"누구니?"' },
        { id: 'radio', label: '무전기로 소장을 부른다' },
        { id: 'open', label: '문을 연다' },
      ],
      to: '문을 연다',
      seconds: 12,
      delay: 1600,
    });
    if (r.pressed) {
      g.add('consent', 2);
      await g.p(
        '손잡이를 돌린다.',
        { t: '어느 걸 고르려 했는지 기억나지 않는다.', c: 'th' },
        { t: '문밖은 비어 있다.', w: 900 },
        '바닥에 작은 발자국이 젖어 있다. 안쪽으로.',
        { t: '당신 의자 앞에서 멈춘다.', s: 'slow', w: 600 }
      );
    } else {
      await g.p(
        { t: '두드림이 멎는다.', w: 900 },
        { t: '"…안 열어 주네."', s: 'slow', w: 600 },
        { t: '아이 목소리가 아니다.', c: 'th' },
        { t: '아주 가벼운 발소리가 멀어진다. 다리가 넷인 것처럼, 박자가 맞지 않는다.', w: 600 }
      );
    }
    g.time(3);
  };
})();
