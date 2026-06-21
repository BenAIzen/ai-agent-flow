"""
Golden-test runner for extractors.py.

Runs extract_metadata() on every file listed in fixtures.json and compares
against the expected (date, business). No pytest dependency.

Usage:  python purchase_order/web/tests/run_tests.py
Exit:   0 on all-pass, 1 if any case fails.
"""

from __future__ import annotations

import io
import json
import sys
from pathlib import Path

# Force UTF-8 stdout so Korean output prints correctly on Windows.
if sys.stdout.encoding and sys.stdout.encoding.lower() != "utf-8":
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

HERE = Path(__file__).resolve().parent
WEB_DIR = HERE.parent
INPUT_DIR = WEB_DIR.parent / "input"

sys.path.insert(0, str(WEB_DIR))
from apps.converter.extractors import extract_metadata  # noqa: E402


def main() -> int:
    fixtures_path = HERE / "fixtures.json"
    fixtures: dict[str, dict[str, str]] = json.loads(
        fixtures_path.read_text(encoding="utf-8")
    )

    fails: list[str] = []
    skipped: list[str] = []
    for filename, expected in fixtures.items():
        path = INPUT_DIR / filename
        if not path.exists():
            skipped.append(filename)
            print(f"SKIP {filename}  (file not found)")
            continue
        got_date, got_biz = extract_metadata(path)
        exp_date, exp_biz = expected["date"], expected["business"]
        if got_date == exp_date and got_biz == exp_biz:
            print(f"PASS {filename}")
        else:
            print(f"FAIL {filename}")
            print(f"  expected: date={exp_date!r}, business={exp_biz!r}")
            print(f"  got:      date={got_date!r}, business={got_biz!r}")
            fails.append(filename)

    total = len(fixtures)
    passed = total - len(fails) - len(skipped)
    print()
    print("=" * 50)
    print(f"  passed: {passed} / {total}    "
          f"failed: {len(fails)}    skipped: {len(skipped)}")
    print("=" * 50)
    return 1 if fails else 0


if __name__ == "__main__":
    sys.exit(main())
