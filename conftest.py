import os

# Prevent Windows Python 3.14 nt._supports_virtual_terminal() crash in virtualized console environments
os.environ["PYTHON_COLORS"] = "0"

