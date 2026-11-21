"""Train the BharatSim failure classifier and write the model + metrics.

    python scripts/train_classifier.py

Outputs worker/models/failure_classifier.joblib and
worker/models/failure_classifier.metrics.json (held-out accuracy and per-class F1).
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from worker import ml  # noqa: E402

if __name__ == "__main__":
    ml.train(verbose=True)
    print(ml.METRICS.read_text(encoding="utf-8"))
