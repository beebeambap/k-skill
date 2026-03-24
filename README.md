# k-skill

한국인을 위한, 한국인에 의한, 한국인의 에이전트 스킬 모음집.

`k-skill`은 한국 서비스와 한국 생활 맥락에 맞는 에이전트 스킬을 모아 둔 멀티-스킬 패키지다. 목표는 단순한 링크 모음이 아니라, 바로 설치해서 쓸 수 있는 한국형 스킬 레포를 만드는 것이다.

## 왜 만드나

- 해외용 generic skill 모음집과 달리 한국 로컬 서비스에 바로 맞는 자동화가 필요하다
- 한국인이 자주 쓰는 서비스는 분명한데, 에이전트 스킬 생태계에는 아직 빈칸이 많다
- CLI, 공개 패키지, Open API 위에서 빠르게 usable한 스킬을 만들 수 있다
- 잘 되면 이 시대의 한국형 `awesome list` 역할을 할 수 있다

## 현재 들어있는 스킬

- `k-skill-setup`
  - 모든 credential-bearing skill이 공통으로 따르는 `sops + age` 설치, 세팅, 검증
- `srt-booking`
  - SRT 조회, 예매, 예약 확인, 취소
- `ktx-booking`
  - KTX/Korail 조회, 예매, 예약 확인, 취소
- `kbo-results`
  - 날짜 기준 KBO 경기 결과와 스코어보드 조회
- `lotto-results`
  - 로또 최신 회차, 특정 회차, 번호 대조
- `seoul-subway-arrival`
  - 서울 지하철 실시간 도착 정보 조회

## 빠른 시작

### 1. 설치 가능한 스킬 목록 보기

```bash
npx --yes skills add <owner/repo> --list
```

로컬에서 이 레포를 바로 테스트하려면:

```bash
npx --yes skills add . --list
```

### 2. 원하는 스킬만 골라 설치

```bash
npx --yes skills add <owner/repo> \
  --skill k-skill-setup \
  --skill srt-booking \
  --skill kbo-results
```

### 3. credential이 필요한 스킬이면 setup부터

다음 스킬들은 먼저 `k-skill-setup`을 따라야 한다.

- `srt-booking`
- `ktx-booking`
- `seoul-subway-arrival`

setup 문서:

- [`k-skill-setup/SKILL.md`](/Users/jeffrey/Projects/k-skill/k-skill-setup/SKILL.md)
- [`docs/security-and-secrets.md`](/Users/jeffrey/Projects/k-skill/docs/security-and-secrets.md)

## 공통 사용 흐름

### 조회형 스킬

그냥 설치 후 바로 쓰면 된다.

- `kbo-results`
- `lotto-results`

예시 프롬프트:

- `오늘 KBO 경기 결과 알려줘`
- `어제 한화 경기 스코어만 보여줘`
- `이번 주 로또 번호 뭐야`
- `1210회 당첨번호 알려줘`

### 인증이 필요한 스킬

먼저 `sops + age`로 공통 secret setup을 끝낸 뒤 쓴다.

- `srt-booking`
- `ktx-booking`
- `seoul-subway-arrival`

예시 프롬프트:

- `수서에서 부산 가는 SRT 찾아줘`
- `내일 오전 서울에서 부산 가는 KTX 조회해줘`
- `강남역 지금 몇 분 뒤 도착해?`

## 보안 방식

`k-skill`은 기본 비밀관리 방식으로 `sops + age`를 사용한다.

- 계정 가입이 필요 없다
- macOS, Linux, Windows에서 모두 쓸 수 있다
- 평문 secret을 git에 넣지 않아도 된다
- 모든 credential-bearing skill이 같은 방식으로 secret을 주입받을 수 있다

권장 기본 경로:

- age key: `~/.config/k-skill/age/keys.txt`
- encrypted secrets file: `~/.config/k-skill/secrets.env`

권장 실행 패턴:

```bash
SOPS_AGE_KEY_FILE="$HOME/.config/k-skill/age/keys.txt" \
sops exec-env "$HOME/.config/k-skill/secrets.env" '<your command>'
```

중요한 한계도 있다.

- `sops + age`는 저장 시점과 저장소 노출에는 강하다
- 하지만 `sops exec-env ...`로 실행된 프로세스는 복호화된 환경변수를 사용할 수 있다
- 즉, 에이전트가 값을 사용할 수 있는 세션에서는 원칙적으로 읽을 수도 있다
- 더 강한 격리가 필요하면 secret 자체를 넘기지 말고 wrapper command만 노출해야 한다

자세한 정책은 [`docs/security-and-secrets.md`](/Users/jeffrey/Projects/k-skill/docs/security-and-secrets.md)를 본다.

## setup 요약

`k-skill-setup`이 하는 일은 크게 다섯 가지다.

1. `sops`와 `age` 설치
2. age key 생성
3. 공통 secrets 파일 작성
4. secrets 파일 암호화
5. 런타임 주입 검증

예시 파일:

- [`examples/.sops.yaml.example`](/Users/jeffrey/Projects/k-skill/examples/.sops.yaml.example)
- [`examples/secrets.env.example`](/Users/jeffrey/Projects/k-skill/examples/secrets.env.example)

검증 스크립트:

```bash
bash scripts/check-setup.sh
```

## 개발

스킬 구조 검증:

```bash
bash scripts/validate-skills.sh
```

공통 setup 점검:

```bash
bash scripts/check-setup.sh
```

## 로드맵

### 다음 후보

- 네이버 스마트스토어 검색/주문
- 다나와 가격 비교
- 카카오톡 조회/전송
- HWP 문서 편집
- 당근 자동 거래
- KBO 경기 일정/순위 확장
- 연금복권 결과 조회
- 정부/공공 민원성 Open API 스킬

### 넣을 때 기준

- 한국인에게 명확히 유용한가
- 공개 CLI, 패키지, Open API 위에서 얇게 만들 수 있는가
- 계정 정지나 정책 리스크가 너무 크지 않은가
- 유지보수 비용이 초기 바이럴 가치보다 낮은가

### 지금 보류한 이유

- 공식 API auth/setup이 너무 무거운 경우
- 비공식 자동화 표면이 너무 불안정한 경우
- 계정 리스크가 큰 경우

추가 메모는 [`docs/roadmap.md`](/Users/jeffrey/Projects/k-skill/docs/roadmap.md)에 둔다.
