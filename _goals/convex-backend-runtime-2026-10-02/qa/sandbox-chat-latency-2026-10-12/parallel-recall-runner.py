"""Offline, exact-command receipts for the bounded recall repair."""
import json
import os
from pathlib import Path
import subprocess
import sys
import time

root = Path(__file__).resolve().parents[4]
out = Path(__file__).resolve().parent
name, *args = sys.argv[1:]
env = dict(os.environ)
node_bin = "/Users/SaintNick/.codex/tmp/cortex-runtime-toolchain-20261005/node_modules/.bin"
env.update(PATH=node_bin + os.pathsep + env["PATH"], CONVEX_URL="http://127.0.0.1:9", CORTEX_TEST_ENV_MODE="explicit")
started = time.time()
with (out / f"parallel-recall-{name}.log").open("w") as log:
    result = subprocess.run(args, cwd=root, env=env, stdout=log, stderr=subprocess.STDOUT)
receipt = {"command": args, "cwd": str(root), "exitCode": result.returncode,
           "elapsedSeconds": round(time.time() - started, 3),
           "environment": {"PATH_prefix": node_bin, "CONVEX_URL": env["CONVEX_URL"], "CORTEX_TEST_ENV_MODE": env["CORTEX_TEST_ENV_MODE"]},
           "rawLog": f"parallel-recall-{name}.log"}
(out / f"parallel-recall-{name}.json").write_text(json.dumps(receipt, indent=2) + "\n")
print(json.dumps(receipt))
print((out / receipt["rawLog"]).read_text()[-18000:])
sys.exit(result.returncode)
