---
name: convert-purchase-orders
description: Convert every purchase order in purchase_order/input into the standardized 판매일(월)보 format and write the results to purchase_order/output. Handles Excel, HTML, text-based PDFs automatically via a Python script; image files (JPG/PNG) and scanned PDFs are handled in-session by Claude's built-in vision. Trigger when the user asks to "발주서 변환", "purchase order convert", "판매일보 생성", or explicitly invokes this skill.
---

# Purchase Order Converter

Converts files in `purchase_order/input/` into a normalized 28-column
workbook matching `purchase_order/sample_output/판매일(월)보 - 2026-04-10_sample.xlsx`,
writing each result to `purchase_order/output/<stem>_output.xlsx`.

## When to use this skill

- User asks to convert purchase orders, "발주서 변환", "판매일보 생성".
- User drops new input files into `purchase_order/input/` and wants them processed.

## Workflow

Always run the two steps below in order. Step 1 is a shell command; Step 2
is only needed if Step 1 reports `[vision]` or `[skip]` for files that
should have been converted.

### Step 1 — Run the converter script

From the project root:

```bash
python purchase_order/scripts/convert_purchase_orders.py
```

The script processes `.xlsx`, `.xls`, `.html`, and `.pdf` files automatically.
For each file it prints one of:

- `[ok] <file> -> <output> (<n> lines)` — converted successfully.
- `[skip] <file> (...)` — reference file or no parseable content.
- `[vision] <file>` — image or scanned PDF; needs Step 2.
- `[FAIL] <file>: ...` — parser raised; investigate the file manually.

Image files (`.jpg`, `.jpeg`, `.png`) are *not* listed by default. Scanned
PDFs appear in the listing but produce `[skip]` with a "no recognizable
order lines" message.

### Step 2 — Handle images and scanned PDFs (vision)

For each file that Step 1 could not process (`.jpg`, `.jpeg`, `.png`, or a
scanned `.pdf` like `네스트.pdf`):

1. **Read the file directly with the Read tool.** Claude Code can read
   image files as vision input; Read the file and extract the purchase
   order line items visually.

2. **Build a JSON document** with the extracted rows following this schema:

   ```json
   {
     "거래처명": "네스트",
     "일자": "2026-04-12",
     "lines": [
       {
         "품목코드": "",
         "품목명": "깐양파",
         "규격": "국내산",
         "단위": "kg",
         "수량": 10,
         "단가": 1650,
         "공급가액": 16500,
         "비고": "",
         "과세구분": "면세"
       }
     ]
   }
   ```

   Rules:
   - `거래처명` should default to the source filename without extension.
   - `일자` should default to today's date in ISO format (`YYYY-MM-DD`).
   - Every field except `품목명` and `수량` is optional; empty string or
     omission is fine.
   - Leave `공급가액` out if unknown — the script will compute it from
     `수량 * 단가`.
   - Set `과세구분` to `"과세"` only if the source clearly shows VAT; else
     `"면세"`.

3. **Write the JSON to a temp file** under `purchase_order/input/.vision/`
   (create the directory if missing). Name it after the source, e.g.
   `purchase_order/input/.vision/네스트.json`.

4. **Run the script in JSON mode:**

   ```bash
   python purchase_order/scripts/convert_purchase_orders.py \
     --json purchase_order/input/.vision/네스트.json \
     --out-name 네스트
   ```

   This writes `purchase_order/output/네스트_output.xlsx` in the exact same
   format as the other outputs.

5. Repeat for every remaining image / scanned file.

## Supported inputs and their parsers

| Ext          | Parser                  | Notes                                                     |
| ------------ | ----------------------- | --------------------------------------------------------- |
| `.xlsx`      | per-file parser + generic fallback | 해비치, 하워드, 더메리든, 헤이오드리 have custom parsers |
| `.xls`       | `parse_hoam`            | 호암교수회관 style (legacy xls with summary rows)        |
| `.html`      | `parse_html_generic`    | Birchstreet Korean / English / 경원재 custom tables       |
| `.pdf` text  | `parse_pdf` (table + text heuristic) | Uses `extract_tables()` for 발주서 layouts; falls back to text shape matching |
| `.pdf` scan  | vision (Step 2)         | e.g. 네스트.pdf — no extractable text                     |
| `.jpg/.png`  | vision (Step 2)         | photos / scanned sheets                                   |
| `발주 샘플 리스트.xlsx` | *(skipped)*  | Reference master, not an order                            |

## Output columns

Matches the sample layout exactly:

`No | 일자 | 품목코드 | 품목명 | 규격 | 단위 | 납기일 | 수량 | 단가 | 공급가액 | 부가세 | 합계금액 | 할인율 | 완료여부 | 마감여부 | 과세구분 | 문서번호 | 거래처코드 | 거래처명 | 유형 | 부서 | 사원 | 관리항목 | 창고코드 | 창고명 | 프로젝트코드 | 프로젝트 | 품목비고`

Default values set by the converter:
- `일자` — today's date (ISO) unless overridden
- `거래처명` — source filename without extension
- `완료여부` — `미진행`
- `마감여부` — `부`
- `유형` — `판매출고`
- `과세구분` — `면세` (falls back to `과세` when source shows VAT)
- `부가세` — 10% of 공급가액 when 과세, else 0
- `합계금액` — 공급가액 + 부가세

Columns that require ERP lookups (품목코드, 거래처코드, 문서번호, 창고, 부서 등)
are left blank unless the source supplies them.

## Script reference

```bash
# Convert everything in the default input folder
python purchase_order/scripts/convert_purchase_orders.py

# Convert a single file
python purchase_order/scripts/convert_purchase_orders.py --file 해비치.xlsx

# Custom input/output dirs
python purchase_order/scripts/convert_purchase_orders.py --input path/to/in --output path/to/out

# Write a vision-extracted JSON as an output xlsx
python purchase_order/scripts/convert_purchase_orders.py --json path/to/file.json --out-name 네스트
```

## Adding a new input format

1. Open `purchase_order/scripts/convert_purchase_orders.py`.
2. Write a `parse_<name>(path) -> OrderDoc` function producing `OrderLine` rows.
3. For Excel-specific parsers, register in `EXCEL_PARSERS` keyed by filename.
4. For HTML/PDF: the generic parsers usually work; if a specific vendor
   needs custom handling, branch on filename inside `convert_one()` or
   extend the relevant parser.
5. Re-run the skill.
