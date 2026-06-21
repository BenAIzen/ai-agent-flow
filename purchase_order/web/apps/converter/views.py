"""PO converter — multipart upload + xlsx download."""

from __future__ import annotations

import tempfile
import uuid
from pathlib import Path
from typing import Any

from django.http import FileResponse, Http404
from rest_framework.parsers import MultiPartParser
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .services import (
    OUT_COLUMNS,
    build_workbook,
    extract_metadata,
    parse_uploaded,
)

# In-memory single-use download tokens. Keys are UUIDs returned to the
# frontend; the bytes are deleted once downloaded.
# NOTE: this is intentionally in-process — moves to S3/Redis in Phase 4.
_DOWNLOADS: dict[str, tuple[bytes, str]] = {}


class ConvertView(APIView):
    """POST /api/convert  — multipart upload one or more PO files."""

    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser]

    def post(self, request):
        files = request.FILES.getlist("files")
        if not files:
            return Response({"detail": "No files uploaded"}, status=400)

        summary: list[dict[str, Any]] = []
        combined_rows: list[dict[str, Any]] = []

        with tempfile.TemporaryDirectory() as tmpdir:
            tmp = Path(tmpdir)
            for uf in files:
                if not uf.name:
                    continue
                tmp_path = tmp / uf.name
                with open(tmp_path, "wb") as out:
                    for chunk in uf.chunks():
                        out.write(chunk)

                doc, status = parse_uploaded(tmp_path)
                entry: dict[str, Any] = {
                    "file": uf.name,
                    "status": status,
                    "date": "",
                    "business": "",
                    "line_count": 0,
                    "lines": [],
                }
                if status != "ok" or doc is None:
                    summary.append(entry)
                    continue

                date, business = extract_metadata(tmp_path)
                entry["date"] = date
                entry["business"] = business
                entry["line_count"] = len(doc.lines)
                entry["lines"] = [
                    {
                        "품목코드": line.품목코드,
                        "품명": line.품목명,
                        "수량": line.수량,
                        "단위": line.단위,
                        "단가": line.단가,
                    }
                    for line in doc.lines
                ]
                summary.append(entry)

                for line in doc.lines:
                    combined_rows.append({
                        "발주날짜": date,
                        "발주업장": business,
                        "품목코드": line.품목코드,
                        "품명": line.품목명,
                        "수량": line.수량,
                        "단위": line.단위,
                        "단가": line.단가,
                    })

        download_id = ""
        if combined_rows:
            download_id = uuid.uuid4().hex
            data = build_workbook(combined_rows)
            _DOWNLOADS[download_id] = (
                data, f"발주서_변환_{download_id[:8]}.xlsx"
            )

        return Response({
            "summary": summary,
            "download_id": download_id,
            "total_rows": len(combined_rows),
        })


class DownloadView(APIView):
    """GET /api/convert/download/<id>  — one-shot xlsx download.

    Not auth-gated: the UUID itself is the capability and it's popped on use.
    """

    permission_classes = [AllowAny]
    authentication_classes = []

    def get(self, request, download_id: str):
        item = _DOWNLOADS.pop(download_id, None)
        if not item:
            raise Http404("download expired or unknown")
        data, name = item
        tmp = tempfile.NamedTemporaryFile(delete=False, suffix=".xlsx")
        tmp.write(data)
        tmp.flush()
        tmp.close()
        return FileResponse(
            open(tmp.name, "rb"),
            as_attachment=True,
            filename=name,
            content_type=(
                "application/vnd.openxmlformats-officedocument."
                "spreadsheetml.sheet"
            ),
        )
