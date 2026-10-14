(function () {
  const G = window.G;
  const T = (s) => G.toM(s);
  const S_ = (G.scenes = {});

  G.data.events = [
    { id: 'sunduk', at: '22:00', scene: 'sunduk' },
    { id: 'elev', at: '22:50', scene: 'elevGhost' },
    { id: 'radio1', at: '23:30', scene: 'radioJung' },
    { id: 'chief', at: '00:10', scene: 'chief' },
    { id: 'call1', at: '01:00', scene: 'callSunduk' },
    { id: 'call2', at: '02:10', scene: 'callEcho' },
    { id: 'radio7', at: '02:40', scene: 'radio7' },
    { id: 'b0317', at: '03:17', scene: 'blackout' },
    { id: 'stairs', at: '04:00', scene: 'stairs' },
    { id: 'calm', at: '05:00', scene: 'calm' },
    { id: 'relief', at: '05:40', scene: 'relief' },
  ];

  // ───────── 출근 ─────────
  S_.intro = async (g) => {
    await g.p(
      { t: '경비실 형광등 하나가 늦게 들어온다.', w: 500 },
      '책상 위에 전화기, 무전기, 출근부. 벽에는 열쇠함.'
    );
    g.sfx('phone');
    await g.p({ t: '전화가 울린다.', w: 700 });
    await g.p(
      { t: '"아, 오셨어요? 일찍 오셨네. 정 씨는… 그만뒀어요. 갑자기요. 네, 갑자기."', w: 600 },
      '"수칙은 벽에 붙어 있고 서랍에도 한 부 있어요. 읽어는 보세요. 어기라는 것도 아니고, 지키라는 것도 아니고요. 그냥 읽어 보시라고."',
      { t: '"아, 무전기요. 정 씨 목소리 같은 게 들려도… 꺼 두지는 마시고요. 아니, 그냥. 6시에 봬요."', w: 300 },
      { t: '뚝.', c: 'dim', w: 600 },
      "출근부 맨 아래 칸. 마지막 서명은 '정'. 날짜는 어제다.",
      '소장은 정 씨가 3주 전에 그만뒀다고 했다.',
      '서명란 옆에 작은 글씨. 성만 쓸 것.'
    );
    const sn = await g.ask({ max: 2, placeholder: '성', button: '서명한다', label: '출근부 서명' });
    g.S.surname = sn || '김';
    G.ui.hud();
    await g.p(
      { t: '{{surname}}', c: 'hand' },
      '책상 유리 밑에 쪽지가 끼워져 있다.',
      { t: '정시 순찰 B1~3F. 우편물, 분실물함, 쓰레기통(3F, B1). 일지 쓸 것.', c: 'hand' },
      '수칙 종이를 한 부 접어 주머니에 넣는다.'
    );
    g.flag('hasRules');
    G.ui.hud();
    g.S.t = T('22:00');
  };

  // ───────── 22:00 순덕 ─────────
  S_.sunduk = async (g) => {
    const S = g.S;
    if (S.place !== '경비실' && S.place !== '1F') {
      await g.p('아래층 현관 쪽에서 누가 부른다. 내려간다.');
      await g.move('1F');
    }
    await g.p(
      '퇴근 가방을 멘 미화 아주머니가 ' + (S.place === '경비실' ? '경비실 창을 두드린다.' : '현관 앞에 서 있다.'),
      '"새로 왔구나. 이름이 어떻게 돼요? 나는 순덕이야, 순덕이."'
    );
    const c = await g.choose([
      { id: 'sur', label: '"{{surname}}입니다."' },
      { id: 'any', label: '"아무개입니다."' },
      { id: 'full', label: '이름을 전부 말한다' },
    ]);
    if (c === 'full') {
      await askGiven(g);
      g.add('nameExposure', 1);
      await g.say('"{{full}}입니다."');
      await g.p(
        '"…그래, 이름 좋네."',
        '그녀는 웃다가 잠깐 천장을 본다.',
        '"근데 여기서는 이름 크게 말하는 거 아니에요. 나한테도. 벽이 들어요."'
      );
    } else if (c === 'any') {
      await g.p('"어머, 잘 아네. 정 씨도 그랬는데."');
    } else {
      await g.p('"{{surname}} 씨. 그래요, {{surname}} 씨."');
    }
    await g.p(
      '"3층 불은 켜지 마요. 켜 놓고 가면 사람들이 와요. 아, 나는 갈게요. 밤엔 안 있어요, 나는."',
      { t: '그녀가 현관을 나서다 멈춘다.', w: 500 },
      { t: '"…정 씨 이름이 뭐였지? 십일 년을 봤는데. 이상하네."', s: 'slow' },
      { t: '현관문이 닫힌다.', w: 400 }
    );
    g.flag('sundukLeft');
    g.time(2);
  };

  async function askGiven(g) {
    if (g.S.given) return;
    const v = await g.ask({ max: 3, placeholder: '이름', button: '말한다', prefix: g.S.surname, label: '이름' });
    g.S.given = v || '아무';
  }

  // ───────── 22:50 부르지 않은 엘리베이터 ─────────
  S_.elevGhost = async (g) => {
    const S = g.S;
    if (S.place === '1F' || S.place === '경비실') {
      g.sfx('ding');
      await g.p(
        S.place === '경비실' ? "로비 쪽에서 '딩' 소리. 경비실 창 너머로 엘리베이터 문이 열려 있다." : "로비 엘리베이터가 '딩' 하고 열린다.",
        '호출한 적 없다.'
      );
    } else {
      g.sfx('ding', 0.35);
      await g.p("아래층에서 '딩' 소리가 올라온다. 로비 엘리베이터다.");
      const c0 = await g.choose([
        { id: 'go', label: '내려가 본다' },
        { id: 'no', label: '그냥 둔다' },
      ]);
      if (c0 === 'no') {
        await g.p({ t: '한참 뒤, 같은 소리가 한 번 더 난다.', w: 900 }, '이번에는 더 아래쪽이다.');
        return;
      }
      await g.move('1F');
      await g.p('엘리베이터 문이 열려 있다.');
    }
    await g.p('안은 비어 있다. 조명이 한 번 깜박인다.', '층 버튼은 F만 불이 들어와 있다.', '문은 열린 채 닫히지 않는다.');
    const c = await g.choose([
      { id: 'watch', label: '지켜본다' },
      { id: 'cctv', label: 'CCTV로 확인한다' },
      { id: 'ride', label: '타 본다' },
    ]);
    if (c === 'watch') {
      await g.p(
        { t: '한참.', w: 1200, c: 'dim' },
        "문이 닫히기 직전, 안에서 작게 '아' 하는 소리가 났다.",
        '숨을 들이쉬는 소리였다.',
        '엘리베이터는 올라가지 않았다. 그 자리에 오래 서 있다가, 천천히 아래로 내려갔다.',
        { t: '지하로.', s: 'slow', w: 400 }
      );
      g.time(6);
    } else if (c === 'cctv') {
      if (S.place !== '경비실') await g.move('경비실');
      await g.p(
        { t: '2 엘리베이터 내부.', c: 'mono' },
        '비어 있다. 문 쪽 바닥에 젖은 발자국 두 개. 안쪽을 향해 있다.',
        '나오는 발자국은 없다.',
        { t: '화면 속 문이 닫힌다. 층 표시는 B1.', w: 700 }
      );
      g.time(4);
    } else {
      g.add('consent', 1);
      if (S.place !== '1F') await g.move('1F');
      await g.p(
        '발을 들인다. 문이 닫힌다.',
        { t: '층 표시가 바뀐다. 이 건물에 없는 숫자다.', w: 800 },
        { t: '{{g1|하나, 둘, 셋.}}', c: 'dim', w: 600 },
        '문이 열린다. 로비다.'
      );
      g.time(28);
      await g.p('시계를 본다. {{clock}}.');
    }
  };

  // ───────── 23:30 무전, 정 씨 ─────────
  S_.radioJung = async (g) => {
    g.sfx('static');
    await g.p(
      '무전기에서 잡음.',
      { t: '"…지직… 어, 들려? 야, 나야."', w: 700 },
      '낮고 느린 목소리. 말끝을 조금 끈다.',
      '"여기 밤에 손님 와. 손님은 무섭게 오지 않는다. 그게 제일 무섭다."',
      '"그 새로 왔다던 사람이지? 이름이 뭐였더라. 소장이 말해 줬는데, 까먹었네."'
    );
    const c = await g.choose([
      { id: 'yes', label: '"네, 접니다."' },
      { id: 'name', label: '이름을 말한다' },
      { id: 'off', label: '무전기를 끈다' },
      { id: 'mute', label: '아무 말도 하지 않는다' },
    ]);
    if (c === 'yes') {
      g.add('consent', 1);
      await g.p({ t: '"…그래. 맞네."', w: 500 }, { t: '"그 목소리다."', s: 'slow' });
    } else if (c === 'name') {
      await askGiven(g);
      g.add('consent', 1);
      g.add('nameExposure', 1);
      await g.say('"{{full}}입니다."');
      await g.p({ t: '"{{full}}. …{{full}}."', s: 'slow' }, '받아 적는 것처럼, 천천히.', '"그래, 그거였지."');
    } else if (c === 'off') {
      await g.p({ t: '전원을 내린다.', w: 1500 }, '천장 스피커가 지직거린다.', { t: '"야, 꺼도 소용없어. 나 안 갔어."', s: 'slow' });
      await g.p({ t: '무전기 표시등이 다시 켜져 있다.', w: 800 });
    } else {
      await g.p({ t: '"…없어?"', w: 1200 }, '"있잖아. 숨소리 들려."', { t: '잡음이 길게 이어진다.', w: 1200 }, '"…그래. 잘하네."');
    }
    g.sfx('static', 0.5);
    await g.p({ t: '지직.', c: 'dim' });
    g.time(3);
  };

  // ───────── 낮의 질문 (00:10 / 05:40 공용) ─────────
  const DAY_Q = {
    fire: {
      q: '"오늘 소방점검 온 업체가 어디였죠?"',
      hit: ['"한빛소방입니다. 오전 아홉 시 반에 왔습니다."', '"이제 문을 열어 주시겠습니까."'],
      miss: ['"…소방점검이요. 글쎄요, 제가 오늘은 밖에서 일을 봐서."', '"문부터 열어 주시겠습니까. 추우니까요."'],
    },
    parcel: {
      q: '"오늘 택배 몇 건 들어왔죠?"',
      hit: ['"열네 건입니다. 세 건은 경비실에 있습니다."', '"맞습니까."'],
      miss: ['"택배요. 많았지요."', '"많았습니다. 문을 열어 주시겠습니까."'],
    },
    menu: {
      q: '"오늘 구내식당 점심 뭐였어요?"',
      hit: ['"육개장입니다. 계란말이도 있었습니다."'],
      miss: ['"점심이요."', '"맛있었습니다. 아주 맛있었습니다."'],
    },
    elev: {
      q: '"엘리베이터 점검은 몇 시에 끝났어요?"',
      hit: ['"두 시입니다. 동양엘리베이터에서 왔습니다."'],
      miss: ['"점검은 잘 끝났습니다. 아주 잘."'],
    },
  };

  async function askDay(g) {
    const S = g.S;
    const opts = S.facts.map((k) => ({ id: k, label: DAY_Q[k].q }));
    if (!opts.length) opts.push({ id: 'generic', label: '"오늘 낮에 무슨 일 있었어요?"' });
    opts.push({ id: 'weather', label: '"오늘 날씨 어땠어요?"' }, { id: 'meal', label: '"식사는 하셨어요?"' });
    const q = await g.choose(opts);
    if (q === 'generic') return g.p('"평소와 같았습니다."', '"문을 열어 주시겠습니까."');
    if (q === 'weather') return g.p('"비가 왔지요. 지금도 오고요."', 'CCTV 속 현관 바닥은 말라 있다.');
    if (q === 'meal') return g.p({ t: '"네. 먹었습니다."', w: 100 }, '대답이 빠르다.');
    const d = DAY_Q[q];
    if (S.logged.includes(q)) {
      g.flag('guestKnew');
      return g.p(...d.hit);
    }
    return g.p(...d.miss);
  }

  // ───────── 00:10 인터폰, 소장 ─────────
  S_.chief = async (g) => {
    const S = g.S;
    g.sfx('ring');
    if (S.place !== '경비실') {
      await g.p('멀리서 인터폰 소리. 경비실이다.');
      await g.move('경비실');
      g.sfx('ring');
    }
    await g.p(
      '인터폰이 울린다.',
      '현관 CCTV. 정장에 서류 가방, 우산을 쓴 남자. 얼굴은 우산에 가려져 있다.',
      '바닥은 말라 있다.',
      '"소장입니다. 야간 점검이에요. 문 좀 열어 주세요."'
    );
    const st = {};
    for (;;) {
      const c = await g.choose([
        { id: 'num', label: '방문증 번호를 묻는다', req: !st.num },
        { id: 'day', label: '낮에 있었던 일을 묻는다', req: !!st.num && !st.day },
        { id: 'who', label: '"소장님이세요?"', req: !st.who },
        { id: 'open', label: '문을 열어 준다' },
        { id: 'no', label: '"열 수 없습니다."' },
        { id: 'hang', label: '인터폰을 내려놓는다' },
      ]);
      if (c === 'num') {
        st.num = true;
        await g.p('"4719입니다."');
      } else if (c === 'who') {
        st.who = true;
        await g.p('"이 시간에 소장 말고 누가 오겠습니까?"');
      } else if (c === 'day') {
        st.day = true;
        await askDay(g);
        if (!S.flags.guestKnew && S.facts.length) await g.p({ t: '전화 속 소장은 그런 식으로 말하지 않았다.', c: 'dim' });
      } else if (c === 'open') {
        g.add('consent', 2);
        g.flag('letChief');
        await g.p(
          '버튼을 누른다. 자동문이 열린다.',
          { t: '아무도 들어오지 않는다.', w: 900 },
          '화면 속 남자는 그 자리에 서서 우산을 접는다. 아주 천천히.',
          '그리고 화면 밖으로 사라진다.',
          { t: '자동문이 닫힌다. 현관 매트가 젖어 있다.', w: 700 }
        );
        break;
      } else if (c === 'no') {
        g.add('consent', 1);
        await g.p({ t: '"그렇습니까."', w: 500 }, '남자가 고개를 숙인다. 아주 공손하게.', '그리고 화면 밖으로 걸어 나간다.');
        break;
      } else {
        await g.p(
          { t: '인터폰이 다시 울린다. 한 번.', w: 800 },
          { t: '두 번.', w: 900 },
          { t: '멈춘다.', w: 800 },
          '화면 속 남자는 그대로 서 있다. 우산 끝에서 물이 떨어지지 않는다.',
          { t: '다시 봤을 때는 없다.', w: 1400 }
        );
        g.time(3);
        break;
      }
    }
    g.time(3);
  };

  // ───────── 01:00 순덕 목소리 ─────────
  const CALL_SD = { t: '"경비 양반, 거기 있어요?"', s: 'slow' };
  S_.callSunduk = async (g) => {
    await g.p({ t: '계단 쪽에서 목소리가 내려온다.', w: 400 }, CALL_SD);
    let c = await g.choose([
      { id: 'si', label: '아무 말도 하지 않는다' },
      { id: 'yes', label: '"네, 여기요."' },
      { id: 'who', label: '"순덕 씨?"' },
    ]);
    if (c === 'yes') {
      g.add('consent', 1);
      await g.p('"아, 거기 있구나."');
    } else if (c === 'who') {
      g.add('consent', 1);
      await g.p('"응. 나야. 내려가도 돼요?"');
    }
    await g.p({ ...CALL_SD, w: 1300 }, { t: '아까와 같은 높이, 같은 길이.', c: 'dim' });
    c = await g.choose([
      { id: 'si', label: '아무 말도 하지 않는다' },
      { id: 'patrol', label: '"순찰 중입니다."' },
      { id: 'yes', label: '"네."' },
    ]);
    if (c === 'si') await g.p('목소리가 한 층 내려왔다.');
    else if (c === 'yes') {
      g.add('consent', 1);
      await g.p('"그럼 문 좀 열어 줘요. 추워서."');
    } else await g.p({ t: '잠시 조용하다.', w: 900 });
    await g.p({ ...CALL_SD, w: 1500 });
    c = await g.choose([
      { id: 'si', label: '아무 말도 하지 않는다' },
      { id: 'patrol', label: '"순찰 중입니다."' },
      { id: 'left', label: '"퇴근하셨잖아요."' },
    ]);
    if (c === 'si') {
      await g.p({ t: '발소리가 계단을 올라간다. 3층에서 멈춘다.', w: 900 }, '그 뒤로는 아무 소리도 없다.');
    } else if (c === 'patrol') {
      g.add('consent', 1);
      await g.p('"그래요? 어디를요?"', { t: '"어디를 도는데요? 나도 같이 가요."', w: 600 });
    } else {
      g.add('consent', 1);
      await g.p({ t: '"…응. 퇴근했지."', w: 700 }, { t: '"근데 내 목소리는 왜 아직 여기 있을까요?"', s: 'slow' });
    }
    g.time(5);
  };

  // ───────── 02:10 내 목소리 ─────────
  S_.callEcho = async (g) => {
    const S = g.S;
    const first = S.said[0] || '"…"';
    await g.p(
      '어딘가에서 부르는 소리. 지하인지 위층인지 모르겠다.',
      { t: first, c: 'say', s: 'slow', w: 500 },
      { t: '당신 목소리다.', w: 800 },
      '처음 당신이 이 건물에서 소리 내어 한 말이다. 숨 쉬는 자리까지 똑같다.'
    );
    let c = await g.choose([
      { id: 'si', label: '아무 말도 하지 않는다' },
      { id: 'who', label: '"누구세요?"' },
    ]);
    if (c === 'who') {
      g.add('consent', 1);
      await g.p({ t: '"누구세요?"', c: 'say', s: 'slow', w: 600 }, '조금 늦게, 같은 말이 돌아온다.');
    }
    await g.p({ t: '"{{surname}} 씨. 거기 있어요?"', s: 'slow', w: 1300 }, '이번엔 당신을 부른다. 당신 목소리로.');
    c = await g.choose([
      { id: 'si', label: '아무 말도 하지 않는다' },
      { id: 'patrol', label: '"순찰 중입니다."' },
      { id: 'name', label: '이름을 말한다' },
    ]);
    if (c === 'name') {
      await askGiven(g);
      g.add('consent', 1);
      g.add('nameExposure', 1);
      await g.say('"{{full}}입니다."');
      await g.p({ t: '"{{g4|{{full}}입니다.}}"', c: 'say', w: 600 }, '목소리가 따라 한다. 당신보다 조금 더 정확하게.');
    } else if (c === 'patrol') {
      g.seen(5);
      await g.p({ t: '목소리가 멈춘다.', w: 900 }, { t: '"순찰 중입니다."', c: 'say', s: 'slow' }, '그 말도 가져간다.');
    } else {
      await g.p('"…{{surname}} 씨?"', '한 걸음 가까워졌다.');
    }
    await g.p({ t: '"{{surname}} 씨."', s: 'slow', w: 1500 });
    c = await g.choose([
      { id: 'si', label: '아무 말도 하지 않는다' },
      { id: 'stop', label: '"그만해."' },
    ]);
    if (c === 'si') {
      await g.p({ t: '환풍기가 다시 돈다.', w: 1200 }, '언제 멈췄었는지 모르겠다.');
    } else {
      g.add('consent', 1);
      await g.p({ t: '"그만해."', c: 'say', w: 700 }, { t: '"그만해. 그만해. 그만해."', c: 'say', s: 'slow' }, '웃음 비슷한 숨소리.');
    }
    g.time(5);
  };

  // ───────── 02:40 7번 ─────────
  S_.radio7 = async (g) => {
    g.sfx('static');
    await g.p('무전기.', { t: '"…{{surname}} 씨, 7번은 지키고 계세요?"', s: 'slow', w: 600 });
    if (g.S.restored7) {
      await g.p("수칙 7번 칸에는 당신 글씨가 있다.", { t: '"…아."', w: 1200 }, { t: '"읽으셨구나."', s: 'slow' });
      g.sfx('static', 0.6);
      await g.p({ t: '잡음이 아주 오래 이어진다.', w: 600 });
    } else {
      await g.p('수칙 7번은 비어 있다.', { t: '"아. 못 읽으시겠구나."', w: 1500 }, { t: '"지워졌으니까요."', s: 'slow', w: 900 });
    }
    g.time(1);
  };

  // ───────── 03:17 ─────────
  S_.blackout = async (g) => {
    const S = g.S;
    S.t = T('03:17');
    S.freeze = true;
    G.ui.hud();
    g.sfx('cut');
    g.blackout(1);
    await g.p({ t: '모든 불이 꺼진다.', w: 300 });
    await g.p({ t: '하나. 둘. 셋. 넷. 다섯. 여섯. 일곱.', c: 'dim', s: 'slow', w: 800 });
    g.blackout(2);
    await g.p({ t: '비상등이 들어온다.', w: 500 });
    g.sfx('breath');
    await g.p('경비실 스피커 전부에서 같은 숨소리가 난다.', { t: '인터폰 네 대가 동시에 울린다. 1F, 2F, 3F, B1.', w: 1800 });
    g.sfx('ring4');
    await g.p('같은 목소리다. 다정하다.');
    const named = S.nameExposure > 0;
    const calls = named
      ? ['"{{name_a}}."', '"{{name_a}}, 문 좀 열어 줘."', '"{{name_a}}, 나야."', '"{{g4|{{name_a}}, 추워.}}"', '"{{name_a}}."']
      : ['"…이름이 뭐였더라."', '"새로 온 사람. 이름이."', '"이름이 뭐였더라, 응?"', '"{{g4|문 좀 열어 줘.}}"', '"…"'];
    await g.p({ t: calls[0], s: 'slow', w: 800 }, { t: calls[1], s: 'slow', w: 800 }, { t: calls[2], s: 'slow', w: 800 });

    const r = await g.hold({ seconds: 17, drip: calls.slice(3), quiet: S.restored7 });
    if (r === 'press') {
      g.add('consent', 2);
      await g.p({ t: '"{{g2|…그래. 고마워.}}"', s: 'slow' }, { t: '{{g2|고마워 고마워 고마워}}', c: 'dim' });
    } else {
      if (r === 'silent') g.seen(7);
      await g.p('목소리가 낮아진다.', { t: '"…다음에 또 올게요."', s: 'slow', w: 900 });
    }
    g.blackout(0);
    G.audio.ambient(true);
    await g.p({ t: '불이 돌아온다.', w: 900 }, '시계는 03:17에 멈춰 있다.');
    await g.wait(2200);
    S.freeze = false;
    S.t = T('03:26');
    G.ui.hud();
    await g.p('한참 뒤에야 움직인다.');
  };

  // ───────── 04:00 F층 계단참 ─────────
  S_.stairs = async (g) => {
    const S = g.S;
    if (S.place === '경비실') await g.p('CCTV 3층 화면 위쪽이 밝다.', '4층으로 올라가는 계단참에 불이 켜져 있다.');
    else await g.p('계단 쪽이 밝다.', '4층으로 올라가는 계단참에 불이 켜져 있다.');
    await g.p('이 건물 계단 등은 3층까지밖에 없다.');
    let looked = false;
    for (;;) {
      const c = await g.choose([
        { id: 'up', label: '올라가 본다' },
        { id: 'stay', label: '계단 문을 닫는다' },
        { id: 'look', label: '수칙을 꺼내 본다', req: !looked },
      ]);
      if (c === 'look') {
        looked = true;
        await g.openDoc('rules');
        continue;
      }
      if (c === 'up') {
        g.add('consent', 1);
        g.add('nameExposure', 1);
        if (S.place !== '3F') await g.move('3F');
        await g.p(
          { t: '한 칸씩.', w: 600 },
          "'F'라고 적힌 철문. 문 아래 틈으로 빛이 샌다.",
          '안에서 누가 종이를 넘긴다.',
          { t: '그리고 부른다. 당신의 성을. 출근부에 쓴 획 그대로.', w: 600 },
          { t: '"{{g1|{{surname}} 씨}}. 순찰 오셨습니까."', s: 'slow', w: 700 },
          { t: '…', c: 'dim', w: 1600 },
          '정신을 차리면 3층 복도다.'
        );
        S.place = '3F';
        S.t = Math.max(S.t, T('04:31'));
        G.ui.hud();
        await g.p('{{clock}}.');
      } else {
        g.seen(2);
        await g.p('철문 닫히는 소리가 계단을 타고 끝까지 올라간다.', { t: '아주 위에서, 똑같은 소리가 한 번 더.', w: 900 });
        g.time(2);
      }
      break;
    }
  };

  // ───────── 05:00 ─────────
  S_.calm = async (g) => {
    G.audio.ambient(false);
    await g.p({ t: '환풍기 소리가 멎어 있다. 언제 멎었는지 모르겠다.', w: 600 }, { t: '밖에서 첫 새소리.', w: 1500 });
  };

  // ───────── 05:40 교대자 ─────────
  S_.relief = async (g) => {
    const S = g.S;
    g.sfx('ring');
    if (S.place !== '경비실') {
      await g.p('인터폰 소리. 경비실로 내려간다.');
      await g.move('경비실');
    } else await g.p('인터폰이 울린다.');
    await g.p(
      '현관 CCTV. 작업복 차림에 모자를 쓴 남자. 모자 그늘에 얼굴이 없다. 아니, 어둡다.',
      '빈손이다.',
      '"교대하러 왔습니다. 오 씨입니다. 조금 일찍 왔습니다."',
      '"열쇠를 인계해 주시겠습니까."'
    );
    const st = {};
    for (;;) {
      const c = await g.choose([
        { id: 'key', label: '문을 열고 열쇠를 넘긴다' },
        { id: 'num', label: '방문증 번호를 묻는다', req: !st.num },
        { id: 'day', label: '낮에 있었던 일을 묻는다', req: !st.day },
        { id: 'no', label: '"6시 전에는 못 엽니다."' },
        { id: 'hang', label: '인터폰을 내려놓는다' },
      ]);
      if (c === 'key') {
        S.keyGiven = true;
        await g.p(
          '자동문이 열린다.',
          '열쇠 꾸러미를 내민다. 남자가 받는다. 장갑을 끼지 않은 손.',
          { t: '"고맙습니다. 수고 많으셨습니다."', w: 600 },
          { t: '"이제 들어가 쉬십시오."', s: 'slow' }
        );
        return;
      }
      if (c === 'num') {
        st.num = true;
        await g.p('"교대자에게 방문증이 필요합니까?"');
      } else if (c === 'day') {
        st.day = true;
        await askDay(g);
        g.seen(10);
      } else if (c === 'no') {
        g.add('consent', 1);
        g.seen(10);
        await g.p({ t: '"그렇습니까."', w: 500 }, '"그럼 기다리겠습니다. 여기서."');
        break;
      } else {
        g.seen(10);
        await g.p({ t: '인터폰이 계속 울린다.', w: 1200 }, { t: '세다가 그만둔다.', w: 1200 });
        break;
      }
    }
    S.t = Math.max(S.t, T('05:57'));
    G.ui.hud();
    await g.p({ t: '화면 속 남자는 그 자리에 서 있다. 06:00이 가까워질수록, 조금씩 화면 가장자리로 밀려난다.', w: 300 });
  };

  // ───────── 근무 일지 ─────────
  S_.journal = async (g) => {
    const S = g.S;
    const F = G.data.facts;
    if (!S.journalOpened) {
      S.journalOpened = true;
      await g.p('근무 일지. 첫 장 맨 위에 볼펜 글씨.', { t: '방문증 4719', c: 'hand' }, '그 아래로 정 씨의 일지가 빼곡하다. 어제 날짜까지.');
    } else {
      await g.p('일지를 편다.');
    }
    for (;;) {
      const opts = S.facts
        .filter((k) => !S.logged.includes(k))
        .map((k) => ({ id: k, label: "'" + F[k].note + "' 적어 둔다" }));
      opts.push({ id: 'night', label: '오늘 밤 일을 적는다', req: !S.done.nightLog && S.t >= T('23:00') });
      opts.push({ id: 'close', label: '덮는다' });
      const c = await g.choose(opts);
      if (c === 'close') break;
      if (c === 'night') {
        S.done.nightLog = true;
        await g.p({ t: '이상 없음.', c: 'hand' }, '쓰고 보니, 정 씨의 일지도 매일 그렇게 끝나 있었다.');
        continue;
      }
      S.logged.push(c);
      g.sfx('pen');
      await g.p({ t: F[c].note, c: 'hand' });
    }
  };

  // ───────── 열쇠함 ─────────
  S_.keys = async (g) => {
    const S = g.S;
    if (!S.done.keys) {
      S.done.keys = true;
      await g.p('고리 마흔 개. 호실 번호가 붙어 있다.', "맨 아랫줄 끝 고리에는 번호 대신 'F'.");
    }
    if (S.t < T('04:30') || S.hasFKey || S.fDone || S.fFailed) {
      await g.p(S.hasFKey ? "'F' 열쇠는 주머니에 있다." : "'F' 고리는 비어 있다.");
      return;
    }
    await g.p("'F' 고리에 열쇠가 걸려 있다.", { t: '아까는 없었다.', w: 600 });
    const c = await g.choose([
      { id: 'take', label: '가져간다' },
      { id: 'leave', label: '그대로 둔다' },
    ]);
    if (c === 'take') {
      S.hasFKey = true;
      await g.p('차갑지 않다. 방금까지 누가 쥐고 있던 것처럼.');
    }
  };

  // ───────── 엘리베이터 (내가 부른) ─────────
  S_.elevator = async (g) => {
    const S = g.S;
    g.sfx('ding', 0.6);
    await g.p('버튼을 누른다. 1층에 서 있던 문이 바로 열린다.');
    if (!S.done.keyhole) {
      S.done.keyhole = true;
      await g.p('층 버튼 맨 위, F 옆에 열쇠 구멍이 있다.');
    }
    const canF = S.hasFKey && !S.fDone && !S.fFailed;
    const c = await g.choose([
      { id: '3F', label: '3' },
      { id: '2F', label: '2' },
      { id: 'B1', label: 'B1' },
      { id: 'F', label: "열쇠를 꽂고 'F'를 누른다", req: canF },
      { id: 'out', label: '내린다' },
    ]);
    if (c === 'out') return;
    if (c === 'F') return S_.floorF(g);
    S.place = c;
    g.time(1);
    G.ui.hud();
  };

  // ───────── F층 ─────────
  S_.floorF = async (g) => {
    const S = g.S;
    S.place = 'F';
    G.ui.hud();
    await g.p(
      { t: "열쇠를 돌리자 엘리베이터가 올라간다.", w: 400 },
      '문이 열린다.',
      '복도가 낯익다. 1층과 같은 타일, 같은 게시판, 같은 시계.',
      '게시판의 날짜만 아주 오래됐다.',
      { t: '복도 끝, 경비실 문틈의 불빛. 안에서 펜 소리가 들린다.', w: 600 }
    );
    g.sfx('pen');
    await g.p(
      '문을 연다.',
      '경비복을 입은 남자의 등이 보인다. 그는 쓰고 있다.',
      { t: '당신이 오늘 쓴 문장을, 한 글자씩 따라서.', w: 500 },
      { t: '"…{{surname}} 씨. 왔어?"', s: 'slow' }
    );
    let tries = 0;
    for (;;) {
      const c = await g.choose([
        { id: 'call', label: '이름을 부른다' },
        { id: 'leave', label: '돌아선다' },
      ]);
      if (c === 'leave') {
        await g.p({ t: '펜 소리가 다시 이어진다.', w: 600 }, '엘리베이터는 기다리고 있다.');
        break;
      }
      const raw = await g.ask({ max: 4, placeholder: '이름', button: '부른다', label: '부를 이름' });
      const name = raw.replace(/\s/g, '');
      await g.say('"' + name + '."');
      if (name === '정민수') {
        S.knowsRealName = true;
        S.fDone = true;
        await g.p(
          { t: '펜 소리가 멈춘다.', w: 1200 },
          { t: '"…오랜만이네, 그 소리."', c: 'clean', s: 'slow', w: 600 },
          { t: '"다음 사람한테 일러 줘. 6시까지 아무것도 내주지 마. 그게 전부야."', c: 'clean' },
          { t: '"나머지는 전부, 내 얘기가 아니라 저것의 얘기야."', c: 'clean', w: 600 },
          { t: '그는 돌아보지 않는다.', w: 900 }
        );
        break;
      }
      tries++;
      if (tries === 1 && name.includes('민수')) {
        await g.p({ t: '펜이 잠깐 멈춘다.', w: 700 }, '"…반만이네."', '펜 소리가 다시 이어진다.');
        continue;
      }
      S.fFailed = true;
      g.add('consent', 1);
      await g.p(
        { t: '펜 소리가 멈추지 않는다.', w: 900 },
        '남자의 고개가 아주 천천히 돌아오기 시작한다.',
        { t: '눈을 감는다.', w: 1200 },
        '엘리베이터 문 닫히는 소리.'
      );
      break;
    }
    S.place = '1F';
    S.hasFKey = false;
    g.time(12);
    G.ui.hud();
    await g.p('로비다. {{clock}}.');
  };

  // ───────── 경고 / 강제 엔딩 ─────────
  S_.warn2 = async (g) => g.p({ t: '형광등이 한 번 꺼졌다 켜진다. 다시 켜질 때까지 조금 오래 걸렸다.', w: 300 });
  S_.warn3 = async (g) => g.p({ t: '경비실 문손잡이가 아주 조금 돌아갔다가, 제자리로 돌아온다.', w: 500 });
  S_.away = async (g) => {
    g.sfx('static', 0.5);
    await g.p('무전기.', { t: '"…어디 갔다 왔어? 한참 없더라."', s: 'slow' });
  };

  S_.doorOpen = async (g) => {
    await g.p(
      { t: '경비실 문손잡이가 돌아간다.', w: 700 },
      '잠가 둔 문이다.',
      { t: '문이 열린다.', w: 1200 },
      { t: '"초대해 주셔서 고맙습니다."', s: 'slow' }
    );
  };

  S_.nameLost = async (g) => {
    await g.p('출근부를 다시 본다. 맨 아래 칸에 쓴 글자가');
    await g.cut();
  };

  S_.morning = async (g) => {
    g.sfx('chime');
    g.S.t = T('06:00');
    G.ui.hud();
    await g.p({ t: '06:00. 차임이 울린다.', w: 400 });
  };
})();
