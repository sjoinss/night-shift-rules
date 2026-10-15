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
      a: ['텅 빈 주차장에 차는 두 대뿐이다. 그중 흰 승용차 한 대는 앞바퀴 바람이 빠져 한쪽으로 기운 채, 먼지를 뽀얗게 뒤집어쓰고 있다.', '내려진 구내식당 셔터 아래로 냉장고 돌아가는 소리가 샌다.'],
      b: ['냉장고 소리가 멎었다.', '주차장에 차가 한 대뿐이다. 다른 한 대가 빠져나가는 소리는 들은 적이 없다.'],
      c: ['주차장이 텅 비었다. 바닥에 바퀴 자국만 두 줄.', { t: '처음부터 한 대였는지도 잘 생각나지 않는다.', c: 'th' }],
      d: ['환기구로 새벽 공기가 들어온다. 축축한 흙냄새 같은 바깥 냄새가 섞여 든다.'],
    },
    '1F': {
      a: ['삐뚤빼뚤한 우편함 줄과 공지 몇 장 붙은 게시판. 평소의 로비다.', '엘리베이터는 1층에 서 있다.'],
      b: ['로비 자동문 유리에 경비실 불빛이 비친다.', '유리 속 경비실 의자에 누가 앉아 있는 것 같아 돌아보면 비어 있다.'],
      c: ['로비 시계가 경비실 시계보다 2분 늦다.', { t: '아까는 맞았다.', c: 'th' }],
      d: ['로비 자동문 밖이 조금 밝아졌지만 아직 파랗다.'],
    },
    '2F': {
      a: ["빈 점포 세 칸 유리문마다 '임대' 종이가 붙어 있다.", '그중 한 장은 테이프가 떨어져 바닥에 엎어졌다.'],
      b: ["떨어져 있던 '임대' 종이가 테이프 두 줄로 반듯하게 다시 붙어 있다."],
      c: ['빈 점포 유리문 안쪽에 의자 하나가 나와 있다. 문 쪽을 보고.', { t: '아까는 저 자리에 아무것도 없었다.', c: 'th' }],
      d: ['빈 점포 세 칸은 조용하다. 의자는 언제 그랬냐는 듯 제자리로 돌아갔다.'],
    },
    '3F': {
      a: ['세무사무소와 학원, 창고 앞을 지나 복도 끝까지 걷는다.', "복도 끝 스위치에 '켜지 마시오'라고 매직으로 꾹꾹 눌러 쓴 테이프가 붙어 있다."],
      b: ['누가 떼다 만 것처럼, 스위치 테이프가 반쯤 들렸다.'],
      c: ['학원 유리문 안쪽에 입김이 하얗게 서린다.', { t: '아직 마르지 않았다.', w: 500 }],
      d: ['창으로 새벽빛이 조금씩 들어오고, 입김 자국은 사라지고 없다.'],
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
    if (S.place === '3F' && S.light3) lines.push('불을 켜 둔 복도가 아까보다 좁아 보인다.');
    if (S.place === '1F' && S.flags.letChief) lines.push('현관 매트가 안쪽을 향한 발자국 모양으로 젖어 있다.');
    await g.p(lines);
    const beat = (G.data.patrolBeat || {})[k + '_' + S.place];
    if (beat) await g.p(beat);
  }

  function cctv(S) {
    const t = S.t;
    if (t >= T('05:00')) return ['1 현관. 비어 있음.', '2 엘리베이터. 1층. 문 닫힘.', '3 3층 복도. 비어 있음.', '4 주차장. 비어 있음.'];
    if (t >= T('03:17'))
      return [
        '1 현관. 비어 있음.',
        "2 엘리베이터. 층 표시가 'F'.",
        S.light3 ? '3 3층 복도. 불 켜진 복도에 사람이 가득한데, 아무도 움직이지 않는다.' : '3 3층 복도. 어둡다.',
        '4 주차장 카메라에 경비실이 비치고, 의자는 비어 있다.',
      ];
    if (t >= T('00:00'))
      return [
        S.flags.letChief ? '1 현관. 안쪽 바닥에 물 자국.' : '1 현관. 유리문 밖에 우산 하나가 펴진 채 놓여 있다.',
        '2 엘리베이터 내부. 비어 있음. 층 표시가 꺼져 있다.',
        S.light3 ? '3 3층 복도. 불 켜진 복도 끝에 사람이 서 있다.' : '3 3층 복도. 어두운 화면 끝이 유난히 더 어둡다.',
        '4 주차장. 차 한 대.',
      ];
    return ['1 현관. 비어 있음.', '2 엘리베이터. 1층, 문 닫힘.', S.light3 ? '3 3층 복도. 불이 켜져 있다.' : '3 3층 복도. 어둡다.', '4 주차장. 차 두 대.'];
  }

  const REST = [
    (S) => '형광등 웅웅거리는 소리만 들린다.',
    (S) => '벽시계 초침이 한 칸씩 가다가 가끔 두 칸을 건너뛴다.',
    (S) => '아무 소리도 없이 무전기 표시등만 깜박인다.',
    (S) => (S.t >= T('00:00') ? '위층에서 의자 끄는 소리가 한 번 난다.' : '밖으로 차가 한 대 지나간다.'),
    (S) => (S.consent >= 2 ? '의자 뒤에서 누가 숨을 고른다. 돌아보면 벽뿐이다.' : '종이컵에 남은 커피는 진작 식었다.'),
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
    { id: 'cctv', place: '경비실', label: 'CCTV를 본다', dur: 1, photo: 'monitor', run: async (g) => {
        G.task.cctv(g.S);
        await g.p(cctv(g.S).map((t) => ({ t, c: 'mono' })));
      },
    },
    {
      id: 'journal',
      place: '경비실',
      task: 'journal',
      label: (S) => (S.journalOpened ? '근무 일지를 쓴다' : '근무 일지를 편다'),
      dur: 3,
      run: async (g) => G.scenes.journal(g),
    },
    {
      id: 'ledger',
      place: '경비실',
      task: 'ledger',
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
        if (!S.jungPages) await g.p('모서리가 닳은 검은 비닐 표지를 넘기면 안쪽에 볼펜 글씨가 빼곡하다.');
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
        await g.p('뒷장에 수칙이 손글씨로 한 번 더 적혀 있다.');
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
        await g.p("누런 서류철 표지에 '수칙 개정 이력'이라고 적혀 있다.");
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
      // 이번 시간 일을 다 했으면 다음 정시까지 (30분을 넘지는 않게)
      label: (S) => (G.duty.allDone(S) ? '다음 순찰까지 앉아 있는다' : '의자에 앉아 있는다'),
      dur: (S) => (G.duty.allDone(S) ? Math.max(5, Math.min(30, 60 - G.clockParts(S.t)[1])) : 10),
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
          '코르크 게시판에 압정이 빼곡하다.',
          ...Object.keys(F).map((k) => ({ t: F[k].board, c: 'mono' })),
          { t: '야간 경비원 구함 (상시)', c: 'mono' },
          '맨 아래 구인 공고는 같은 종이가 몇 겹으로 겹쳐 붙어 있다.'
        );
      },
    },
    {
      id: 'mail',
      task: 'mail',
      place: '1F',
      label: '우편함을 정리한다',
      dur: 8,
      avail: (S) => G.duty.open(S, 'mail') || !S.done.mail,
      run: async (g) => {
        const S = g.S;
        const n = G.duty.nth(S, 'mail');
        const set = G.data.mailSet(n);
        if (n === 0) await g.p('우편함 서른두 칸 중 몇 칸에 전단이 삐져나와 있으니, 전부 뽑아서 버리면 된다.');
        if (set.before) await g.p(set.before);
        await G.task.mailbox(g, set);
        if (n === 0) {
          S.done.mail = true;
          if (!S.clues.includes('mail')) S.clues.push('mail');
        }
        if (n === 1) S.done.mail2 = true;
      },
    },
    {
      id: 'lost',
      task: 'lost',
      place: '1F',
      label: '분실물함을 정리한다',
      dur: 8,
      avail: (S) => !S.done.lost,
      run: async (g) => {
        const S = g.S;
        S.done.lost = true;
        ['tag', 'key'].forEach((k) => S.clues.includes(k) || S.clues.push(k));
        await g.p(
          '우산 일곱 개와 장갑 한 짝, 아이 신발 한 짝이 나온다.',
          '플라스틱 명찰 하나는 양쪽 글자가 긁혀 나가 ▇민▇만 남아 있다.',
          "열쇠 하나에 달린 종이 태그에는 볼펜으로 '민수 보관'이라고 적혀 있다.",
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
          '세 칸 모두 잠겼다.',
          '가운데 칸 손잡이가 안쪽에서 누가 같이 쥐고 있는 것처럼 무겁다.',
          { t: '손을 떼자 그쪽도 놓는다.', w: 600 }
        );
      },
    },

    // 3층
    {
      id: 'trash3',
      task: 'trash3',
      place: '3F',
      label: '쓰레기통을 비운다',
      dur: 10,
      avail: (S) => G.duty.open(S, 'trash3') || !S.done.trash3,
      run: async (g) => {
        const S = g.S;
        if (!S.done.trash3) {
          S.done.trash3 = true;
          ['a', 'b'].forEach((k) => S.pieces.includes(k) || S.pieces.push(k));
          await g.p(
            '종이컵과 영수증, 파쇄된 서류가 나온다.',
            '통 바닥에 손글씨 종이 조각 두 장이 붙어 있다. 찢긴 자리를 맞대 보니 꼭 들어맞는다.',
            '주머니에 넣는다.'
          );
          return;
        }
        await g.p(
          '종이컵 두 개가 나온다. 그중 하나에는 입 댄 자리에 립스틱 자국이 묻었다.',
          { t: '컵 안쪽이 아직 따뜻하다.', w: 500 },
          { t: '이 층 사람들은 일곱 시 전에 다 퇴근했다.', c: 'th' }
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
          await g.p('테이프를 떼고 스위치를 올린다.');
          await G.task.lamps();
          await g.p({ t: '복도 끝에서부터 스위치 쪽으로, 불이 하나씩 다가오듯 들어왔다.', w: 300 }, { t: '마지막 등 아래는 당신이 서 있는 자리다.', c: 'th', w: 500 });
        } else {
          S.light3 = false;
          await g.p('스위치를 내려도 마지막 형광등은 한참 있다가 꺼진다.');
        }
      },
    },

    // 지하
    {
      id: 'trashB1',
      task: 'trashB1',
      place: 'B1',
      label: '쓰레기통을 비운다',
      dur: 10,
      avail: (S) => G.duty.open(S, 'trashB1') || !S.done.trashB1,
      run: async (g) => {
        const S = g.S;
        if (!S.done.trashB1) {
          S.done.trashB1 = true;
          await g.p('식권 뭉치 사이로 육개장 국물 냄새가 올라온다.', '봉투를 묶어 내놓는다.', '내놓은 봉투 옆에 똑같이 묶인 봉투가 하나 더 있다.', { t: '아까는 없었다.', c: 'th' });
          return;
        }
        await g.p(
          '봉투를 묶다가 식권 한 장이 떨어진다.',
          { t: '10월 15일 점심. 이름 칸에 볼펜으로 {{surname}}.', c: 'mono' },
          { t: '내일 날짜다.', c: 'th', w: 500 }
        );
      },
    },
  ];

  // 모든 순찰 구역에 '둘러본다'
  ['B1', '1F', '2F', '3F'].forEach((p) =>
    G.data.actions.unshift({ id: 'patrol_' + p, place: p, label: '둘러본다', dur: 4, run: patrol })
  );
})();
