"""Create a Chrome Web Store ZIP with extension files at the archive root."""

from pathlib import Path
import sys
from zipfile import ZIP_DEFLATED, ZipFile


source = Path(sys.argv[1]).resolve()
destination = Path(sys.argv[2]).resolve()
destination.parent.mkdir(parents=True, exist_ok=True)
with ZipFile(destination, "w", ZIP_DEFLATED) as archive:
    for path in sorted(source.rglob("*")):
        if path.is_file():
            archive.write(path, path.relative_to(source).as_posix())
