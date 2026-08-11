"""Chẩn đoán kết nối Langfuse: key, region và prompt.

    python scripts/check_langfuse.py

Script phân biệt ba tình huống hay bị nhầm lẫn với nhau:

  - thiếu key            -> app chạy prompt local, prompt_source=local
  - 401 sai region       -> key đúng nhưng host sai, prompt_source=local-fallback
  - 404 prompt chưa tạo  -> kết nối đúng, chỉ thiếu prompt trên project

Script chỉ đọc, không tạo hay sửa gì trên Langfuse.
"""

from __future__ import annotations

import base64
import os
import sys
from pathlib import Path

import httpx

REPO_ROOT = Path(__file__).resolve().parents[1]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from app.cli import configure_utf8_stdio

KNOWN_HOSTS = (
    ("EU", "https://cloud.langfuse.com"),
    ("US", "https://us.cloud.langfuse.com"),
)


def _load_env() -> None:
    env_path = REPO_ROOT / ".env"
    if not env_path.exists():
        return
    for line in env_path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip())


def _probe(host: str, auth: str) -> tuple[int | None, str]:
    try:
        response = httpx.get(
            f"{host.rstrip('/')}/api/public/projects",
            headers={"Authorization": f"Basic {auth}"},
            timeout=20.0,
        )
        return response.status_code, response.text[:120]
    except Exception as exc:
        return None, f"{type(exc).__name__}: {exc}"


def main() -> int:
    configure_utf8_stdio()
    _load_env()

    public_key = os.getenv("LANGFUSE_PUBLIC_KEY", "").strip()
    secret_key = os.getenv("LANGFUSE_SECRET_KEY", "").strip()
    host = os.getenv("LANGFUSE_HOST", "https://cloud.langfuse.com").strip()
    prompt_name = os.getenv("LANGFUSE_PROMPT_NAME", "day13-chat").strip()
    prompt_label = os.getenv("LANGFUSE_PROMPT_LABEL", "production").strip()

    print("--- Langfuse Check ---")
    print(f"host:          {host}")
    print(f"public key:    {public_key[:8] + '…' if public_key else '(trống)'}")
    print(f"secret key:    {'đã đặt' if secret_key else '(trống)'}")
    print(f"prompt:        {prompt_name} @ {prompt_label}")

    if not public_key or not secret_key:
        print("\n- [FAILED] Thiếu key. App vẫn chạy nhưng prompt_source sẽ là 'local'.")
        print("  Điền LANGFUSE_PUBLIC_KEY và LANGFUSE_SECRET_KEY vào .env.")
        return 1

    auth = base64.b64encode(f"{public_key}:{secret_key}".encode()).decode()
    status, body = _probe(host, auth)

    if status == 200:
        print("\n+ [PASSED] Key hợp lệ với host đang cấu hình.")
    elif status == 401:
        print(f"\n- [FAILED] 401 tại {host}: key không khớp host này.")
        working = [
            label
            for label, candidate in KNOWN_HOSTS
            if candidate != host and _probe(candidate, auth)[0] == 200
        ]
        if working:
            label = working[0]
            correct = dict((name, url) for name, url in KNOWN_HOSTS)[label]
            print(f"  Key này thuộc region {label}. Đặt trong .env:")
            print(f"    LANGFUSE_HOST={correct}")
            print("  Sau đó khởi động lại API.")
        else:
            print("  Key không dùng được ở cả hai region cloud. Tạo lại key trong project.")
        return 1
    else:
        print(f"\n- [FAILED] Không kết nối được: {status} {body}")
        return 1

    prompt_url = f"{host.rstrip('/')}/api/public/v2/prompts/{prompt_name}"
    try:
        response = httpx.get(
            prompt_url,
            params={"label": prompt_label},
            headers={"Authorization": f"Basic {auth}"},
            timeout=20.0,
        )
    except Exception as exc:
        print(f"- [FAILED] Lỗi khi đọc prompt: {type(exc).__name__}")
        return 1

    if response.status_code == 200:
        version = response.json().get("version")
        print(f"+ [PASSED] Prompt '{prompt_name}' label '{prompt_label}' -> version {version}.")
        print("\nMọi thứ đã sẵn sàng: trace sẽ ghi prompt_source=langfuse.")
        return 0

    if response.status_code == 404:
        print(f"- [FAILED] 404: chưa có prompt '{prompt_name}' với label '{prompt_label}'.")
        print("  Kết nối đã đúng, chỉ cần tạo prompt. Xem docs/PROMPT_VERSIONING.md:")
        print(f"    1. Tạo text prompt tên '{prompt_name}' giữ ba biến feature/docs/message.")
        print("    2. Gắn label 'baseline' và 'production' cho version 1.")
        print("    3. Tạo version 2 và gắn label 'candidate'.")
        return 1

    print(f"- [FAILED] {response.status_code}: {response.text[:160]}")
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
