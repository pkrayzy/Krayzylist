#!/usr/bin/env python3
"""Convert a userscript (.user.js) into a single adblock scriptlet rule.

Usage:
    python3 convert_userscript.py input.user.js [output.txt]

The generated rule is printed to stdout (and written to output.txt if given).
Requires Node + terser for minification (optional).
"""
import argparse
import os
import re
import subprocess
import sys
import tempfile
import shutil as _shutil


def extract_code(text):
    marker = "// ==/UserScript=="
    idx = text.find(marker)
    code = text[idx + len(marker):].strip() if idx != -1 else text.strip()
    # Some scripts start directly with an IIFE/arrow; otherwise wrap statements.
    stripped = code.lstrip()
    if not (stripped.startswith("(") or stripped.startswith("function")):
        code = "(function(){\n'use strict';\n" + code + "\n})();\n"
    # Ensure unsafeWindow is available in adblock scriptlet context.
    if "unsafeWindow" in code:
        code = code.replace("(function(){", "(function(){\nconst unsafeWindow=window;", 1)
        code = code.replace("(()=>{", "(()=>{\nconst unsafeWindow=window;", 1)
    return code


def extract_domains(text):
    domains = []
    seen = set()
    global_rule = False
    for line in text.splitlines():
        s = line.strip()
        if not s.startswith("// @match"):
            continue
        parts = s.split()
        if not parts:
            continue
        url = parts[-1]
        if "://" not in url:
            continue
        host = url.split("/", 3)[2] if url.count("/") >= 2 else ""
        host = host.strip("*").lstrip(".")
        if host in ("*", ""):
            global_rule = True
            continue
        if host not in seen:
            seen.add(host)
            domains.append(host)
    return domains, global_rule


def minify(code):
    if _shutil_which("npx") is None:
        return code
    with tempfile.NamedTemporaryFile("w", suffix=".js", delete=False) as f:
        f.write(code)
        path = f.name
    try:
        proc = subprocess.run(
            ["npx", "--yes", "terser", path, "--compress", "--mangle", "--toplevel"],
            capture_output=True,
            text=True,
        )
        if proc.returncode == 0 and proc.stdout.strip():
            return proc.stdout.strip()
        sys.stderr.write(proc.stderr)
        return code
    finally:
        try:
            os.remove(path)
        except OSError:
            pass


def _shutil_which(name):
    for d in os.environ.get("PATH", "").split(os.pathsep):
        p = os.path.join(d, name)
        if os.path.isfile(p) and os.access(p, os.X_OK):
            return p
    return None


def to_arrow(code):
    code = code.strip()
    if code.startswith("!function(){"):
        code = "(()=>{" + code[len("!function(){"):]
        if code.endswith("}()"):
            code = code[:-3] + "})()"
    return code


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("input", help="userscript .user.js file")
    ap.add_argument("output", nargs="?", help="output file (default: stdout)")
    args = ap.parse_args()

    with open(args.input, encoding="utf-8") as f:
        text = f.read()

    code = extract_code(text)
    code = minify(code)
    code = to_arrow(code)

    domains, global_rule = extract_domains(text)
    if global_rule or not domains:
        rule = "#%#" + code
    else:
        rule = ",".join(domains) + "#%#" + code

    if args.output:
        with open(args.output, "w", encoding="utf-8") as f:
            f.write(rule + "\n")
    else:
        print(rule)


if __name__ == "__main__":
    main()
