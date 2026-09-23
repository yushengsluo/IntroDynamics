"""Serve the examples without caching files while they are being edited."""

import argparse
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from io import BytesIO
from pathlib import Path
from urllib.parse import urlsplit


class DevelopmentHandler(SimpleHTTPRequestHandler):
    def send_head(self):
        # Python's default server can return 304 for two edits in one second.
        # Always send the current file, including to clients with an old cache.
        for header in ("If-Modified-Since", "If-None-Match"):
            if header in self.headers:
                del self.headers[header]
        path = Path(self.translate_path(self.path))
        if path.is_dir():
            # Preserve the standard directory redirect and listing behavior.
            if not urlsplit(self.path).path.endswith("/"):
                return super().send_head()
            path = next((path / name for name in ("index.html", "index.htm")
                         if (path / name).is_file()), path)
        if not path.is_file():
            return super().send_head()
        try:
            content = path.read_bytes()
        except OSError:
            self.send_error(404, "File not found")
            return None
        # Read befor