import os

# Deterministic test-only bootstrap credentials.
os.environ["ENVIRONMENT"] = "test"
os.environ["SUPERADMIN_BOOTSTRAP_PIN"] = "7314"
os.environ["AGENT_BOOTSTRAP_PIN"] = "5826"
