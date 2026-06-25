#!/usr/bin/env python3
"""Set GH Actions secrets via API, bypassing WSL DNS poisoning.

GitHub uses libsodium sealed_box (X25519 + XSalsa20-Poly1305), not RSA.
Reference: https://docs.github.com/en/rest/actions/secrets
"""
import base64
import json
import socket
import sys
from pathlib import Path

import requests
from nacl.public import PublicKey, SealedBox

# Bypass WSL DNS poisoning: api.github.com → 140.82.112.5
_ORIG = socket.getaddrinfo


def _patched(host, *a, **kw):
    if host == "api.github.com":
        host = "140.82.112.5"
    return _ORIG(host, *a, **kw)


socket.getaddrinfo = _patched

API_BASE = "https://api.github.com:443"
REPO = "AndyWongWithAI/industry-value-flow"
TOKEN = json.load(open("/home/hq/.claude/secrets.json"))["github_cli_pat"]["token"]
HEADERS = {
    "Authorization": f"Bearer {TOKEN}",
    "Accept": "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
}

SECRETS = {
    "SSH_USER": "root",
    "ARCH_API_KEY": json.load(open("/home/hq/.claude/secrets.json"))["architecture_blueprint"]["architecture_api_key"],
    "SSH_KEY": Path("/home/hq/.ssh/github_actions_arch_platform").read_text(),
}


def encrypt(public_key_b64: str, secret_value: str) -> str:
    pk_bytes = base64.b64decode(public_key_b64)
    pk = PublicKey(pk_bytes)
    box = SealedBox(pk)
    encrypted = box.encrypt(secret_value.encode("utf-8"))
    return base64.b64encode(encrypted).decode("utf-8")


def set_secret(name: str, value: str) -> bool:
    r = requests.get(
        f"{API_BASE}/repos/{REPO}/actions/secrets/public-key",
        headers=HEADERS,
    )
    r.raise_for_status()
    pub = r.json()
    encrypted = encrypt(pub["key"], value)
    r = requests.put(
        f"{API_BASE}/repos/{REPO}/actions/secrets/{name}",
        headers=HEADERS,
        json={"encrypted_value": encrypted, "key_id": pub["key_id"]},
    )
    if r.status_code in (201, 204):
        print(f"  ✓ {name}")
        return True
    print(f"  ✗ {name}: HTTP {r.status_code} {r.text[:200]}")
    return False


def main():
    ok = True
    for name, value in SECRETS.items():
        print(f"Setting {name}...")
        if not set_secret(name, value):
            ok = False
    sys.exit(0 if ok else 1)


if __name__ == "__main__":
    main()
