# 야간 근무 수칙

`index.html`을 브라우저로 바로 열면 된다. 서버나 빌드 단계는 없다.

## 개발용

- `?debug=1` 화면 오른쪽 아래에 시각 이동, 숨김 수치, 엔딩 강제 패널
- `?debug=effects` 글자 깨짐 효과 미리 보기

## 구조

- `data/scenes.js` 시간 이벤트와 장면 대본. 대부분의 글은 여기 있다
- `data/places.js` 층별 행동, 순찰, CCTV 문구
- `data/rules.js` 수칙 원문, 변조문, 변조 시각
- `data/docs.js` 정 씨 수첩, 개정 이력, 출입 대장
- `data/endings.js` 엔딩 문구와 판정 순서 (C > B > E > D > A)
- `js/engine.js` 시간, 강제 이벤트, 엔딩 판정
- `js/ui.js` 로그 타이핑, 선택지, 서류 시트, LCD 시계
- `js/effects.js` G1~G4 깨짐, 이름 오염(G6)
- `js/audio.js` Web Audio 합성음

저장은 localStorage(`hg.save.v1`, `hg.settings.v1`, `hg.archive.v1`)에 한다. 저장이 막혀 있어도 게임은 돌아간다.

## 오른쪽 사진

폭 1100px 이상에서만 보인다. 장면은 `js/photo.js`에서 캔버스로 그린 뒤 흑백 → 카키 듀오톤을 입힌다.
실제 사진으로 바꾸려면 `assets/img/`에 파일을 두고 `data/` 쪽 스크립트에서 지정한다.

```js
G.data.photoFiles = { lobby: 'assets/img/lobby.jpg', corridor3: 'assets/img/dark-hall.jpg' };
```

지정한 사진에는 CSS 필터로 같은 톤이 입혀진다. 키 목록은 `G.photo.keys()`.
