#!/usr/bin/env python3
"""Manage the screenshots embedded in the docs/*.html handouts.

The handouts are single self-contained files: every screenshot is a base64
data: URI, so a handout can be opened, emailed or attached without its images
going missing.

  extract <handout.html> <out-dir>
      Write every embedded image to <out-dir> as NN.png and print its alt
      text, so you can see which screenshot is which.

  embed <handout.html>
      Replace every src="embed:<path>" with the image at <path> as a data:
      URI. <path> is relative to the current directory. Write the new
      screenshot to a file, point an <img> at it with embed:, then run this.

Screenshots must use an invented roster. Never embed real student names,
emails or ids.
"""
import base64
import mimetypes
import re
import sys
from pathlib import Path

IMG = re.compile(r'<img[^>]*?src="data:(image/[\w+]+);base64,([^"]*)"[^>]*>')
EMBED = re.compile(r'src="embed:([^"]+)"')


def extract(html_path: str, out_dir: str) -> None:
    html = Path(html_path).read_text()
    out = Path(out_dir)
    out.mkdir(parents=True, exist_ok=True)
    for i, match in enumerate(IMG.finditer(html)):
        ext = match.group(1).split("/")[1].replace("svg+xml", "svg")
        target = out / f"{i:02d}.{ext}"
        target.write_bytes(base64.b64decode(match.group(2)))
        alt = re.search(r'alt="([^"]*)"', match.group(0))
        print(f"{target}  {alt.group(1) if alt else ''}")


def embed(html_path: str) -> None:
    path = Path(html_path)
    html = path.read_text()

    def to_data_uri(match: re.Match) -> str:
        image = Path(match.group(1))
        mime = mimetypes.guess_type(image.name)[0] or "image/png"
        data = base64.b64encode(image.read_bytes()).decode()
        print(f"embedded {image} ({image.stat().st_size // 1024} KB)")
        return f'src="data:{mime};base64,{data}"'

    new_html, count = EMBED.subn(to_data_uri, html)
    if count == 0:
        print('no src="embed:..." images found')
        return
    path.write_text(new_html)


if __name__ == "__main__":
    if len(sys.argv) == 4 and sys.argv[1] == "extract":
        extract(sys.argv[2], sys.argv[3])
    elif len(sys.argv) == 3 and sys.argv[1] == "embed":
        embed(sys.argv[2])
    else:
        sys.exit(__doc__)
