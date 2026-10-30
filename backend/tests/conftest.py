import os

# Deterministic test-only bootstrap credentials.
os.environ["ENVIRONMENT"] = "test"
os.environ["SUPERADMIN_BOOTSTRAP_PIN"] = "7314"
os.environ["AGENT_BOOTSTRAP_PIN"] = "5826"
os.environ["PIN_PEPPER"] = "test-only-pin-pepper-0123456789abcdef"
