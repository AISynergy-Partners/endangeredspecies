#!/usr/bin/env python3
"""Minimal static file server for local preview.

Exists because `python3 -m http.server` evaluates os.getcwd() at import time
to build its --directory default, which fails under a sandbox that cannot
resolve the parent directory. This never touches the working directory.

    python3 scripts/serve.py <port> <root>
"""
import functools
import http.server
import socketserver
import sys


class Handler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        # local preview only: never serve a stale bundle while iterating
        self.send_header("Cache-Control", "no-store")
        http.server.SimpleHTTPRequestHandler.end_headers(self)

    def log_message(self, fmt, *args):
        sys.stderr.write("%s %s\n" % (self.address_string(), fmt % args))


def main():
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8651
    root = sys.argv[2] if len(sys.argv) > 2 else "."
    socketserver.TCPServer.allow_reuse_address = True
    handler = functools.partial(Handler, directory=root)
    with socketserver.TCPServer(("127.0.0.1", port), handler) as httpd:
        sys.stderr.write("serving %s on http://127.0.0.1:%d/\n" % (root, port))
        sys.stderr.flush()
        httpd.serve_forever()


if __name__ == "__main__":
    main()
