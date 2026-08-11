from __future__ import annotations

import json
import os
import threading
from dataclasses import dataclass
from pathlib import Path
from typing import Any


REPO_ROOT = Path(__file__).resolve().parents[1]
PROMPT_CATALOG_PATH = Path(
    os.getenv("PROMPT_CATALOG_PATH", REPO_ROOT / "config/prompts.json")
)
PROMPT_STATE_PATH = Path(
    os.getenv("PROMPT_STATE_PATH", REPO_ROOT / "data/prompt_labels.json")
)
DEFAULT_PROMPT_TEMPLATE = "Feature={{feature}}\nDocs={{docs}}\nQuestion={{message}}"
_STATE_LOCK = threading.Lock()


@dataclass(frozen=True)
class ResolvedPrompt:
    text: str
    name: str
    label: str
    version: str
    source: str
    managed_prompt: Any | None = None
    fetch_error: str | None = None


def _load_catalog() -> dict[str, Any]:
    payload = json.loads(PROMPT_CATALOG_PATH.read_text(encoding="utf-8"))
    if not isinstance(payload.get("versions"), dict) or not payload["versions"]:
        raise ValueError("Prompt catalog phải có ít nhất một version")
    if not isinstance(payload.get("default_labels"), dict):
        raise ValueError("Prompt catalog thiếu default_labels")
    return payload


def _load_labels(catalog: dict[str, Any]) -> dict[str, str]:
    defaults = dict(catalog["default_labels"])
    if not PROMPT_STATE_PATH.exists():
        return defaults
    try:
        saved = json.loads(PROMPT_STATE_PATH.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return defaults
    labels = saved.get("labels") if isinstance(saved, dict) else None
    if not isinstance(labels, dict):
        return defaults
    versions = catalog["versions"]
    return {
        label: (
            str(labels[label])
            if label in labels and str(labels[label]) in versions
            else default_version
        )
        for label, default_version in defaults.items()
    }


def prompt_registry() -> dict[str, Any]:
    """Return the local version catalog and current label pointers."""
    with _STATE_LOCK:
        catalog = _load_catalog()
        labels = _load_labels(catalog)
    return {
        "name": catalog.get("name", "day13-chat"),
        "versions": catalog["versions"],
        "labels": labels,
        "default_labels": catalog["default_labels"],
        "source": "local-registry",
    }


def set_prompt_label(label: str, version: str) -> dict[str, Any]:
    """Move a known label atomically to a known local prompt version."""
    with _STATE_LOCK:
        catalog = _load_catalog()
        if label not in catalog["default_labels"]:
            raise KeyError(f"Unknown prompt label: {label}")
        if version not in catalog["versions"]:
            raise KeyError(f"Unknown prompt version: {version}")
        labels = _load_labels(catalog)
        previous = labels[label]
        labels[label] = version
        PROMPT_STATE_PATH.parent.mkdir(parents=True, exist_ok=True)
        temporary_path = PROMPT_STATE_PATH.with_suffix(".tmp")
        temporary_path.write_text(
            json.dumps({"labels": labels}, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )
        temporary_path.replace(PROMPT_STATE_PATH)
    return {
        "name": catalog.get("name", "day13-chat"),
        "label": label,
        "previous_version": previous,
        "version": version,
        "labels": labels,
    }


def rollback_production_prompt() -> dict[str, Any]:
    registry = prompt_registry()
    baseline_version = registry["labels"]["baseline"]
    result = set_prompt_label("production", baseline_version)
    return {**result, "rollback_to": baseline_version}


def _local_prompt(label: str) -> tuple[dict[str, Any], str, str]:
    registry = prompt_registry()
    if label not in registry["labels"]:
        raise ValueError(f"Prompt label không hợp lệ: {label}")
    version = registry["labels"][label]
    return registry, version, str(registry["versions"][version]["template"])


def _compile_local_prompt(
    template: str, *, feature: str, docs: list[str], message: str
) -> str:
    return (
        template.replace("{{feature}}", feature)
        .replace("{{docs}}", "\n".join(docs))
        .replace("{{message}}", message)
    )


def resolve_prompt(
    client: Any,
    *,
    feature: str,
    docs: list[str],
    message: str,
    enabled: bool,
    label_override: str | None = None,
) -> ResolvedPrompt:
    registry_label = label_override or os.getenv("LANGFUSE_PROMPT_LABEL", "production")
    registry, local_version, local_template = _local_prompt(registry_label)
    name = os.getenv("LANGFUSE_PROMPT_NAME", str(registry["name"]))
    text = _compile_local_prompt(
        local_template,
        feature=feature,
        docs=docs,
        message=message,
    )
    if enabled:
        try:
            managed_prompt = client.get_prompt(
                name,
                label=registry_label,
                type="text",
                fallback=local_template,
                cache_ttl_seconds=60,
                fetch_timeout_seconds=2,
                max_retries=0,
            )
            if getattr(managed_prompt, "is_fallback", False):
                return ResolvedPrompt(
                    text=text,
                    name=name,
                    label=registry_label,
                    version=local_version,
                    source="local-fallback",
                    fetch_error="LangfuseFallback",
                )
            return ResolvedPrompt(
                text=managed_prompt.compile(
                    feature=feature,
                    docs="\n".join(docs),
                    message=message,
                ),
                name=name,
                label=registry_label,
                version=str(managed_prompt.version),
                source="langfuse",
                managed_prompt=managed_prompt,
            )
        except Exception as exc:
            return ResolvedPrompt(
                text=text,
                name=name,
                label=registry_label,
                version=local_version,
                source="local-fallback",
                fetch_error=type(exc).__name__,
            )

    return ResolvedPrompt(
        text=text,
        name=name,
        label=registry_label,
        version=local_version,
        source="local",
    )
