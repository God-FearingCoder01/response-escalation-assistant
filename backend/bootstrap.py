"""Bootstrap PIN configuration for newly seeded privileged profiles."""

import os
from pathlib import Path

from dotenv import load_dotenv


# The project starts Uvicorn from the repository root. Load that root .env
# explicitly so local bootstrap values are available before app imports run.
PROJECT_ROOT = Path(__file__).resolve().parent.parent
load_dotenv(PROJECT_ROOT / ".env")


def _load_bootstrap_pin(variable: str) -> str:
    configured = os.environ.get(variable, "").strip()
    if not configured:
        raise RuntimeError(f"Set {variable} to a private four-digit bootstrap PIN before starting the backend.")
    if len(configured) != 4 or not configured.isdigit() or configured == "0000":
        raise RuntimeError(f"{variable} must be four digits and cannot be 0000.")
    return configured


SUPERADMIN_BOOTSTRAP_PIN = _load_bootstrap_pin("SUPERADMIN_BOOTSTRAP_PIN")
AGENT_BOOTSTRAP_PIN = _load_bootstrap_pin("AGENT_BOOTSTRAP_PIN")
