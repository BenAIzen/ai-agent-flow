---
name: flow-price-forecast
description: flow-price-forecast/input/의 야채/과일 흐름표 과거 데이터(2023~2025)와 가락도매시장 서울청과(주) 최근 1주일 가격을 결합해 2026년 5월 가격을 추론하고 flow-price-forecast/output/에 예측 xlsx를 생성합니다. Trigger when the user asks "2026년 5월 가격 추론", "야채 가격 예측", "흐름표 예측", "flow-price-forecast 실행", or explicitly invokes this skill.
---

# flow-price-forecast — 흐름표 기반 가격 추론

`flow-price-forecast/input/야채,과일 흐름표(2023|2024|2025).xlsx` 의 월별 시세 추이와
가락시장 서울청과(주)의 **최근 1주일 평균가** 를 결합하여
`flow-price-forecast/output/야채,과일 흐름표(2026)_predicted.xlsx` 를 생성합니다.

## When to use this skill

- 사용자가 "2026년 5월 가격 추론해줘", "흐름표 다음 달 예측해줘" 등을 요청할 때
- 새 흐름표 시즌 시작 전에 baseline 가격표를 미리 만들고 싶을 때
- 다른 월(예: 6월) 또는 다른 연도 예측이 필요할 때 (`--target-month`, `--target-year`)

## 입력 파일

| 경로 | 역할 |
|------|------|
| `flow-price-forecast/input/야채,과일 흐름표(YYYY).xlsx` | 과거 시세 (월별 시트, 4개 column group × 3~4 일자) |
| `flow-price-forecast/input/recent/recent_prices.csv` | 최근 1주일 서울청과(주) 평균가 — `품목,가격,단위,일자` |

`recent_prices.csv` 가 없으면 스크립트는 **2025년 5월 시세를 그대로** 추론값으로
사용합니다 (recent_ratio = 1.0). 이는 "참고용 baseline" 이지 진짜 예측이 아니므로
가급적 최근 데이터를 함께 제공하세요.

## Workflow

### Step 1 — 최근 1주일 가격 수집

#### Option A: 스크립트로 자동 수집 (권장)

```bash
# 어제까지의 최근 7일 (서울청과(주))
python flow-price-forecast/scripts/fetch_seoul_cheonggwa.py

# 특정 구간
python flow-price-forecast/scripts/fetch_seoul_cheonggwa.py --start 20260420 --end 20260426
```

내부 동작: Playwright 로 `db.garak.co.kr:9443` BIX5 share 페이지에 접속해
JSESSIONID 를 획득한 뒤 `share UUID 478f1d87...` 의 datasource 엔드포인트에
`{mrktDiv: "1", corpCd: "11000101", startDate, endDate}` 를 POST. 결과를
품목·단위 별 평균가로 집계해 CSV 로 저장합니다.

처음 실행 시 의존성 설치:

```bash
python -m pip install requests playwright openpyxl
python -m playwright install chromium
```

#### Option B: 수동 export (자동화 실패 시 폴백)

1. 브라우저로 [경매 및 정가수의 현황 페이지](https://www.garak.co.kr/youtong/G1000349/dashboard/auctionStatus/1/page.do?tabId=2) 접속
2. 법인 dropdown 에서 **서울청과(주)** 선택
3. 날짜를 지난 주 범위로 설정 → **검색**
4. **CSV 다운로드** 클릭
5. 다운받은 파일을 다음 형식으로 정리해 `flow-price-forecast/input/recent/recent_prices.csv` 로 저장:

   ```csv
   품목,가격,단위,일자
   깐양파,1700,kg,2026-04-25
   양파,1000,kg,2026-04-25
   청상추(4kg),18000,4kg,2026-04-25
   ...
   ```

   - `품목` 은 흐름표의 표기와 **정확히 일치** 해야 매칭됩니다 (예: `청상추(4kg)`).
   - 일치하지 않는 품목은 추론에서 빠지고 2025년 5월 값을 그대로 사용합니다.

### Step 2 — 추론 실행

```bash
python flow-price-forecast/scripts/predict_may_prices.py
```

옵션:

```bash
# 다른 recent 파일 사용
python flow-price-forecast/scripts/predict_may_prices.py --recent path/to/file.csv

# 다른 월/연도 예측
python flow-price-forecast/scripts/predict_may_prices.py --target-year 2026 --target-month 6

# 다른 출력 경로
python flow-price-forecast/scripts/predict_may_prices.py --output flow-price-forecast/output/test.xlsx
```

출력: `flow-price-forecast/output/야채,과일 흐름표(2026)_predicted.xlsx` — `5월_예측` 시트
하나, 흐름표 원본과 동일한 4-그룹 × 일자 레이아웃, 각 일자 셀에 예측가가
들어갑니다. recent CSV 가 매칭되지 않은 품목은 2025년 동월 값이 그대로
복사되며, recent ratio 가 적용된 품목은 정수(원) 단위로 반올림됩니다.

## 추론 모델

```
template[일자] = 2025년 같은 월 같은 일자 가격  (없으면 2024 → 2023 폴백)
recent_ratio   = (최근 1주일 서울청과 평균가)
                 ÷ (2025년 같은 월의 직전 달 평균가)         # "1주일 전" anchor
예측[일자]     = template[일자] × recent_ratio
```

- recent 가격이 없는 품목은 `recent_ratio = 1.0` → template 값 그대로 사용.
- anchor 분모 (직전 달 평균) 도 없으면 2025년 동월 평균으로 폴백.
- 결과는 정수 (원 단위) 로 반올림합니다.

이 모델은 **계절성(2025년 동월 패턴) × 최근 시세 흐름** 의 단순 곱셈입니다.
공급 충격(작황·기상 이변)은 반영하지 않으므로 출력은 항상 **검토 후 사용** 하세요.

## 파일 구조

```
flow-price-forecast/
├── input/
│   ├── 야채,과일 흐름표(2023).xlsx
│   ├── 야채,과일 흐름표(2024).xlsx
│   ├── 야채,과일 흐름표(2025).xlsx
│   └── recent/
│       └── recent_prices.csv          # Step 1 결과
├── output/
│   └── 야채,과일 흐름표(2026)_predicted.xlsx
└── scripts/
    ├── predict_may_prices.py
    └── fetch_seoul_cheonggwa.py
```

## 흐름표 포맷 메모

각 월별 시트는 1행에 `품목 | M월D일 | M월D일 | M월D일` 패턴이 4번 반복되는
가로 4-그룹 레이아웃입니다 (총 16~19 컬럼). 일자 수는 보통 3개이지만
4개인 시트도 있어, 스크립트는 헤더 row 1 을 스캔해 그룹/일자 인덱스를
동적으로 잡습니다. 새 연도 파일을 추가해도 자동으로 인식됩니다.

법인코드는 https://www.garak.co.kr 페이지의 `<select>` 옵션값:

| 코드 | 법인 |
|------|------|
| 11000101 | 서울청과(주) ← 본 스킬 기본값 |
| 11000102 | 농협공판장(가락) |
| 11000103 | (주)중앙청과 |
| 11000104 | 동화청과(주) |
| 11000105 | 한국청과(주) |
| 11000106 | 대아청과(주) |
| 11000107 | 강동수산(주) |
