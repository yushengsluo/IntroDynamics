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
        # Read before sending headers: moved/edited files may have stale stat
        # sizes. The response length must match the bytes actually being served.
        self.send_response(200)
        self.send_header("Content-Type", self.guess_type(str(path)))
        self.send_header("Content-Length", str(len(content)))
        self.end_headers()
        return BytesIO(content)

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--port", type=int, default=5173)
    args = parser.parse_args()
    directory = Path(__file__).resolve().parents[1] / "dist"
    handler = partial(DevelopmentHandler, directory=str(directory))
    with ThreadingHTTPServer(("127.0.0.1", args.port), handler) as server:
        print(f"Examples: http://127.0.0.1:{args.port}/", flush=True)
        try:
            server.serve_forever()
        except KeyboardInterrupt:
            pass
