---
name: garak-market
description: 가락도매시장 품목별 가격 데이터를 수집해 SQLite에 누적 저장하고 Excel 리포트를 자동 생성합니다. Trigger when the user asks to "가락시장 시세", "가격 수집", "아스파라거스 시세", or explicitly invokes this skill.
---

# 가락시장 가격 수집기

`garak_market/data/garak_prices.db`에 가격 데이터를 날짜별로 누적하고,
`garak_market/data/가락시장_아스파라거스_시세.xlsx` 리포트를 자동 갱신합니다.

## When to use this skill

- 사용자가 "가락시장 시세 수집해줘", "아스파라거스 가격 가져와줘"를 요청할 때
- 특정 날짜의 데이터가 필요할 때
- Excel 리포트를 새로 생성해달라고 할 때

## 수집 대상

| 항목 | 값 |
|------|----|
| 시장 | 서울 가락도매시장 |
| 품목 | 아스파라거스 국산 (품목코드 25301) |
| 등급 | 상 / 보통 / 하 |
| 수집 필드 | 날짜, 등급, 단위, 최저가, 최고가, 평균가, 전일비 |

> **참고**: 가락시장 API는 전체 시장 통합 데이터를 제공합니다 (서울청과 단독 필터 미지원).
> 당일 데이터는 장 마감 후 반영되므로 기본값은 **어제 날짜**입니다.

## Workflow

### Step 1 — 가격 수집 실행

```bash
# 어제 데이터 수집 (기본)
python garak_market/scripts/garak_price_collector.py

# 특정 날짜 지정
python garak_market/scripts/garak_price_collector.py --date 20260411

# Excel 리포트만 재생성 (수집 없이)
python garak_market/scripts/garak_price_collector.py --report
```

스크립트 출력 패턴:
- `[collect] YYYY-MM-DD 아스파라거스 가격 수집 시작...` — 정상 실행
- `→ N행 수집, N행 신규 저장` — 성공
- `→ 데이터 없음 (휴장일이거나 아직 미반영)` — 해당 날짜 데이터 없음 (휴장일 등)

### Step 2 — 결과 확인

수집 완료 후 자동 생성되는 파일:
- `garak_market/data/garak_prices.db` — SQLite 누적 DB
- `garak_market/data/가락시장_아스파라거스_시세.xlsx` — Excel 리포트 (시트 2개)
  - **아스파라거스 시세**: 전체 누적 데이터
  - **등급별 최근 7일**: 등급별 평균/최고가 요약

## 내부 동작 방식

1. **세션 초기화** — Playwright로 가락시장 BIX5 대시보드 접속, JSESSIONID 획득
2. **API 호출** — `db.garak.co.kr:9443/api/datasources/` POST 요청으로 가격 데이터 수집
3. **DB 저장** — `INSERT OR IGNORE`로 중복 방지하며 SQLite에 누적
4. **리포트 갱신** — openpyxl로 Excel 자동 생성

## 품목 확장 방법

다른 품목을 추가로 수집하고 싶을 때:

1. `garak_market/scripts/garak_price_collector.py` 열기
2. 상단 상수 수정:
   ```python
   TARGET_ITM_CD = "25301"    # 새 품목 코드로 변경
   TARGET_ITM_NM = "아스파라거스"  # 새 품목명으로 변경
   ```
3. 품목 코드는 자동완성 API로 확인 가능:
   ```
   POST https://www.garak.co.kr/youtong/search/autoComplete.do
   body: searchKey=품목명
   ```

## Script reference

```bash
# 어제 데이터 수집
python garak_market/scripts/garak_price_collector.py

# 특정 날짜
python garak_market/scripts/garak_price_collector.py --date YYYYMMDD

# 리포트만 재생성
python garak_market/scripts/garak_price_collector.py --report
```
