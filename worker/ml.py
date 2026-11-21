"""Failure classifier for Android log lines.

A TF-IDF (character n-grams + words) + logistic regression model that labels a
log line as crash, anr, oom, network, storage or other, with a probability.

Training data, stated plainly:
- real Android framework logs from the public LogHub dataset (logpai/loghub,
  Android_2k.log), weakly labelled by rules, mostly "other";
- templated failure lines built from real Android exception classes, tags and
  message formats, with randomised packages, numbers and hosts;
- (optionally) lines from our own runs saved under worker/.cache/labelled.tsv.

The held-out score printed at training time is measured on this mix, so it
says how well the model separates these patterns, not real-world accuracy.
"""
from __future__ import annotations

import random
import re
import urllib.request
from pathlib import Path

import joblib
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import FeatureUnion, Pipeline

HERE = Path(__file__).resolve().parent
CACHE = HERE / ".cache"
MODEL = HERE / "models" / "failure_classifier.joblib"
LOGHUB_URL = "https://raw.githubusercontent.com/logpai/loghub/master/Android/Android_2k.log"
LABELS = ["crash", "anr", "oom", "network", "storage", "other"]
MODEL_VERSION = "failure-classifier-1.0"
METRICS = HERE / "models" / "failure_classifier.metrics.json"

_PREFIX = re.compile(r"^\s*\d\d-\d\d\s+\d\d:\d\d:\d\d\.\d+\s+\d+\s+\d+\s+")


def normalize(line: str) -> str:
    line = _PREFIX.sub("", line)
    line = re.sub(r"0x[0-9a-fA-F]+", "0xH", line)
    line = re.sub(r"\d+", "0", line)
    return line.strip()[:400]


def weak_label(line: str) -> str:
    l = line
    if re.search(r"FATAL EXCEPTION|AndroidRuntime.*(Exception|Error)|Process: .* PID|has died|Force finishing", l):
        if "OutOfMemoryError" in l:
            return "oom"
        return "crash"
    if re.search(r"ANR in |Input dispatching timed out|not responding|Application Not Responding", l, re.I):
        return "anr"
    if re.search(r"OutOfMemoryError|lowmemorykiller|Low on memory|onTrimMemory|GC_FOR_ALLOC.*paused", l):
        return "oom"
    if re.search(r"UnknownHostException|SocketTimeoutException|ConnectException|SSLHandshakeException|NoRouteToHost|Network is unreachable|ECONNRESET|ETIMEDOUT|EAI_NODATA|HTTP FAILED|failed to connect", l, re.I):
        return "network"
    if re.search(r"ENOSPC|No space left|SQLiteFullException|disk is full|DiskFull|storage low", l, re.I):
        return "storage"
    return "other"


# ---------------------------------------------------------------- templated failures

PKGS = ["com.shopnow.app", "in.payfast.wallet", "com.newsdaily.reader", "com.kirana.orders", "in.gov.citizen", "com.ride.go", "com.learnhindi.app", "app.chatbox"]
HOSTS = ["api.shopnow.in", "cdn.newsdaily.com", "payments.payfast.in", "graph.facebook.com", "firebaseinstallations.googleapis.com", "api.example.in"]
CLASSES = ["MainActivity", "FeedFragment", "CheckoutViewModel", "ImageLoader", "SyncWorker", "OrderRepository", "LoginActivity"]


def _templates(rng: random.Random) -> list[tuple[str, str]]:
    p, h, c = rng.choice(PKGS), rng.choice(HOSTS), rng.choice(CLASSES)
    n = rng.randint(100, 99999)
    ms = rng.randint(1000, 60000)
    return [
        ("crash", f"E AndroidRuntime: FATAL EXCEPTION: {rng.choice(['main', 'pool-2-thread-1', 'feed-loader', 'OkHttp Dispatcher', 'DefaultDispatcher-worker-3'])}"),
        ("crash", f"E AndroidRuntime: Process: {p}, PID: {n}"),
        ("crash", f"E AndroidRuntime: java.lang.NullPointerException: Attempt to invoke virtual method 'int java.lang.String.length()' on a null object reference"),
        ("crash", f"E AndroidRuntime: java.lang.IllegalStateException: Fragment {c} not attached to a context."),
        ("crash", f"E AndroidRuntime: java.lang.RuntimeException: Unable to start activity ComponentInfo{{{p}/{p}.{c}}}"),
        ("crash", f"E AndroidRuntime: kotlin.UninitializedPropertyAccessException: lateinit property adapter has not been initialized"),
        ("crash", f"E AndroidRuntime: java.lang.IndexOutOfBoundsException: Index: {n % 50}, Size: {n % 7}"),
        ("crash", f"I ActivityManager: Process {p} (pid {n}) has died: fg TOP"),
        ("crash", f"W ActivityManager:   Force finishing activity {p}/.{c}"),
        ("crash", f"E AndroidRuntime: java.lang.RuntimeException: Feed download failed"),
        ("anr", f"E ActivityManager: ANR in {p} ({p}/.{c})"),
        ("anr", f"E ActivityManager: Reason: Input dispatching timed out (Waiting to send non-key event because the touched window has not finished processing)"),
        ("anr", f"I WindowManager: Input event dispatching timed out sending to {p}/{p}.{c}.  Reason: Waiting because the focused window has not finished processing"),
        ("anr", f"W ActivityManager: Timeout executing service: ServiceRecord{{{n:x} u0 {p}/.{c}Service}}"),
        ("anr", f"E ActivityManager: Reason: Broadcast of Intent {{ act=android.net.conn.CONNECTIVITY_CHANGE }} timed out"),
        ("oom", f"E AndroidRuntime: java.lang.OutOfMemoryError: Failed to allocate a {n * 40} byte allocation with {n} free bytes and {n // 100}KB until OOM"),
        ("oom", f"I art     : Throwing OutOfMemoryError \"Failed to allocate a {n * 16} byte allocation\""),
        ("oom", f"I lowmemorykiller: Kill '{p}' ({n}), uid 10{n % 999}, oom_adj 900 to free {n // 10}kB"),
        ("oom", f"I ActivityManager: Low on memory: ... {p} cached (adj 905)"),
        ("oom", f"W {c}: onTrimMemory level=80, releasing caches"),
        ("network", f"W System.err: java.net.SocketTimeoutException: timeout"),
        ("network", f"W System.err: java.net.SocketTimeoutException: failed to connect to {h}/{n % 255}.{n % 200}.1.{n % 99} (port 443) after {ms}ms"),
        ("network", f"E {c}: java.net.UnknownHostException: Unable to resolve host \"{h}\": No address associated with hostname"),
        ("network", f"W System.err: java.net.ConnectException: Failed to connect to {h}/{n % 255}.0.0.1:443"),
        ("network", f"E OkHttp  : <-- HTTP FAILED: java.net.SocketTimeoutException: Read timed out"),
        ("oom", f"E AndroidRuntime: java.lang.OutOfMemoryError: OutOfMemoryError thrown while trying to throw OutOfMemoryError; no stack trace available"),
        ("oom", f"W Glide   : Load failed for https://{h}/img/{n}.jpg: java.lang.OutOfMemoryError: Failed to allocate a {n * 64} byte allocation"),
        ("oom", f"I lmkd    : Kill '{p}' ({n}), uid 10{n % 999}, oom_score_adj 900 to free {n // 5}kB rss, 0kB swap; reason: low watermark is breached"),
        ("oom", f"E art     : Out of memory: Heap Size={n // 100}MB, Allocated={n // 101}MB, Capacity={n // 100}MB"),
        ("oom", f"W {c}: java.lang.OutOfMemoryError: pthread_create (1040KB stack) failed: Try again"),
        ("oom", f"E AndroidRuntime: Caused by: java.lang.OutOfMemoryError: Failed to allocate a {n * 8} byte allocation with {n} free bytes"),
        ("anr", f"I am_anr  : [0,{n},{p},952745540,Input dispatching timed out (Waiting because no window has focus)]"),
        ("anr", f"E ActivityManager: ANR in {p}, PID: {n}"),
        ("anr", f"W ActivityManager: Application Not Responding: {p}/.{c}"),
        ("network", f"W System.err: javax.net.ssl.SSLHandshakeException: connection closed"),
        ("network", f"E Volley  : [{n}] NetworkDispatcher.processRequest: Unhandled exception java.net.SocketException: Connection reset"),
        ("network", f"D NetworkMonitor/100: PROBE_DNS {h} {ms}ms FAIL in type ADDRCONFIG"),
        ("network", f"W {c}: java.io.IOException: unexpected end of stream on http://{h}/..."),
        ("storage", f"E SQLiteLog: (13) statement aborts at 7: [INSERT INTO cache VALUES(?)] database or disk is full"),
        ("storage", f"E AndroidRuntime: android.database.sqlite.SQLiteFullException: database or disk is full (code 13 SQLITE_FULL)"),
        ("storage", f"W System.err: java.io.IOException: write failed: ENOSPC (No space left on device)"),
        ("storage", f"E {c}: Failed to save image: java.io.IOException: No space left on device"),
        ("storage", f"W StorageManager: storage low, {n % 300} MB free"),
        ("other", f"I ActivityTaskManager: START u0 {{act=android.intent.action.MAIN cat=[android.intent.category.LAUNCHER] cmp={p}/.{c}}}"),
        ("other", f"I ActivityTaskManager: Displayed {p}/.{c}: +{ms % 3000}ms"),
        ("other", f"D {c}: onResume"),
        ("other", f"I Choreographer: Skipped {n % 90} frames!  The application may be doing too much work on its main thread."),
        ("other", f"D OkHttp  : <-- 200 OK https://{h}/v1/feed ({ms % 900}ms)"),
        ("other", f"I chatty  : uid=10{n % 999}({p}) identical {n % 40} lines"),
        ("other", f"D EGL_emulation: eglMakeCurrent: 0xH: ver 3 0 (tinfo 0xH)"),
        ("other", f"I zygote64: Background concurrent copying GC freed {n}({n // 1000}MB) AllocSpace objects"),
    ]


def _loghub_lines() -> list[str]:
    CACHE.mkdir(exist_ok=True)
    path = CACHE / "Android_2k.log"
    if not path.exists():
        try:
            with urllib.request.urlopen(LOGHUB_URL, timeout=20) as r:
                path.write_bytes(r.read())
        except Exception:
            return []
    return [l for l in path.read_text(encoding="utf-8", errors="replace").splitlines() if l.strip()]


def build_dataset(seed: int = 7) -> tuple[list[str], list[str], list[str]]:
    """Lines, labels and a group id per line (template id, or the log tag for
    LogHub lines) so evaluation can hold out whole patterns."""
    rng = random.Random(seed)
    X: list[str] = []
    y: list[str] = []
    groups: list[str] = []
    for line in _loghub_lines():
        X.append(normalize(line))
        y.append(weak_label(line))
        tag = re.search(r"\s[VDIWEF]\s+([^:]+):", line)
        groups.append("loghub:" + (tag.group(1).strip() if tag else "?"))
    for _ in range(140):
        for i, (label, line) in enumerate(_templates(rng)):
            X.append(normalize(line))
            y.append(label)
            groups.append(f"template:{i}")
    own = CACHE / "labelled.tsv"
    if own.exists():
        for j, row in enumerate(own.read_text(encoding="utf-8").splitlines()):
            label, _, line = row.partition("\t")
            if label in LABELS and line:
                X.append(normalize(line))
                y.append(label)
                groups.append(f"own:{j}")
    return X, y, groups


def train(verbose: bool = True):
    X, y, groups = build_dataset()
    pipe = Pipeline([
        ("features", FeatureUnion([
            ("chars", TfidfVectorizer(analyzer="char_wb", ngram_range=(3, 5), min_df=2, sublinear_tf=True)),
            ("words", TfidfVectorizer(analyzer="word", token_pattern=r"[A-Za-z_.$]{3,}", ngram_range=(1, 2), min_df=1, sublinear_tf=True)),
        ])),
        ("clf", LogisticRegression(max_iter=2000, C=4.0, class_weight="balanced")),
    ])
    # 5-fold group cross-validation: each fold holds out whole templates / log
    # components, so scores reflect patterns the model never saw.
    import statistics
    from sklearn.base import clone
    from sklearn.metrics import classification_report
    from sklearn.model_selection import GroupKFold
    accs, f1s = [], []
    per_class: dict[str, list[float]] = {k: [] for k in LABELS}
    y_true_all: list[str] = []
    y_pred_all: list[str] = []
    for tr, te in GroupKFold(n_splits=5).split(X, y, groups):
        m = clone(pipe).fit([X[i] for i in tr], [y[i] for i in tr])
        yte = [y[i] for i in te]
        pred = list(m.predict([X[i] for i in te]))
        rep = classification_report(yte, pred, output_dict=True, zero_division=0)
        accs.append(rep["accuracy"])
        f1s.append(rep["macro avg"]["f1-score"])
        y_true_all += yte
        y_pred_all += pred
    report = classification_report(y_true_all, y_pred_all, output_dict=True, zero_division=0)
    score = statistics.mean(accs)
    Xte = y_true_all
    pipe.fit(X, y)
    MODEL.parent.mkdir(exist_ok=True)
    from collections import Counter
    import datetime
    meta = {
        "model_version": MODEL_VERSION,
        "trained_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "samples": len(X),
        "class_counts": dict(Counter(y)),
        "holdout_accuracy": round(score, 4),
        "holdout_accuracy_std": round(statistics.pstdev(accs), 4),
        "holdout_macro_f1": round(statistics.mean(f1s), 4),
        "holdout_macro_f1_std": round(statistics.pstdev(f1s), 4),
        "per_class_f1": {k: round(v["f1-score"], 4) for k, v in report.items() if k in LABELS},
        "evaluation": "5-fold GroupKFold: each fold holds out whole templates and LogHub log tags",
        "holdout_samples": len(Xte),
        "data": "LogHub Android_2k (weak rule labels) + templated failure lines + worker/.cache/labelled.tsv",
        "caveat": "Held-out metrics are measured on this mixed, partly templated dataset; they are not field accuracy.",
    }
    joblib.dump({"pipeline": pipe, **meta}, MODEL)
    METRICS.write_text(__import__("json").dumps(meta, indent=2), encoding="utf-8")
    if verbose:
        print(f"failure classifier {MODEL_VERSION}: {len(X)} lines, held-out accuracy {score:.3f}, macro F1 {meta['holdout_macro_f1']:.3f}")
    return pipe


_pipe = None


def model():
    global _pipe
    if _pipe is None:
        if MODEL.exists():
            _pipe = joblib.load(MODEL)["pipeline"]
        else:
            _pipe = train()
    return _pipe


def metadata() -> dict:
    if METRICS.exists():
        return __import__("json").loads(METRICS.read_text(encoding="utf-8"))
    return {"model_version": MODEL_VERSION, "trained": False}


def classify(lines: list[str]) -> list[tuple[str, float]]:
    if not lines:
        return []
    pipe = model()
    probs = pipe.predict_proba([normalize(l) for l in lines])
    classes = list(pipe.classes_)
    out = []
    for row in probs:
        i = int(row.argmax())
        out.append((classes[i], float(row[i])))
    return out


if __name__ == "__main__":
    train()
