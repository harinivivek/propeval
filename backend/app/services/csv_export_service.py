import csv
import io
from collections.abc import Generator

from starlette.responses import StreamingResponse


def _generate_csv_rows(
    rows: list[dict], columns: list[tuple[str, str]]
) -> Generator[str, None, None]:
    output = io.StringIO()
    writer = csv.writer(output)

    writer.writerow([col[0] for col in columns])
    yield output.getvalue()
    output.seek(0)
    output.truncate(0)

    for row in rows:
        writer.writerow([row.get(col[1], "") for col in columns])
        yield output.getvalue()
        output.seek(0)
        output.truncate(0)


def generate_csv_response(
    rows: list[dict],
    columns: list[tuple[str, str]],
    filename: str,
) -> StreamingResponse:
    return StreamingResponse(
        _generate_csv_rows(rows, columns),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
