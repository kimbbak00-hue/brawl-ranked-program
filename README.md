# 브롤 픽보드 (brawl-ranked-program)

브롤스타즈 경쟁전 밴픽 도우미. 게임 위에 세로 아이콘 줄로 떠 있고, 아이콘을 누르면 패널이 펼쳐져요.

## 설치
1. [Releases → latest](../../releases/latest)에서 `brawl-pickboard.apk`를 폰으로 받기
2. 설치 (처음이면 브라우저/파일 앱에 ‘출처를 알 수 없는 앱 설치’ 허용)
3. 앱 열기 → ‘다른 앱 위에 표시’ 권한 켜기 → **픽보드 켜고 브롤스타즈 열기**

## 구조
- `web/` — 화면과 승률 엔진 (data.js 브롤러, model.js 승률 모델 표, engine.js 계산, app.js 화면)
- `tools/build_web.py` — web/ → `app/src/main/assets/index.html`, `dist/brawl-pickboard.html`
- `app/` — 안드로이드 오버레이 (OverlayService: 게임 위 창, MainActivity: 권한·실행)
- `data/` — 수집 원본(브롤러 스탯, 경쟁전 맵 승률, 맞상대 승률), `tools/fit*.py` — 모델 적합
- `.github/workflows/build-apk.yml` — main에 push하면 APK 빌드 후 latest 릴리스에 올림

## 동작 원칙
- 게임 화면을 읽거나 조작하지 않음. 입력은 직접 누른 것만 사용
- 창은 포커스를 가져가지 않아(FLAG_NOT_FOCUSABLE) 게임이 백그라운드로 가지 않음
- 서명키 `keystore/pickboard.jks`(비밀번호 pickboard)는 업데이트 설치가 이어지도록 저장소에 고정

made by eipi10
