"""Check syntax of the simulator's inline JS with installed Node.js."""
import pathlib
import re
import subprocess
import tempfile

html = (pathlib.Path(__file__).resolve().parents[1] / "knox-falcon-sim.html").read_text(encoding="utf-8")
match = re.search(r"<script>(.*?)</script>", html, flags=re.S)
if not match:
    raise SystemExit("Could not find simulator inline JavaScript")
with tempfile.TemporaryDirectory() as directory:
    script = pathlib.Path(directory) / "simulator.js"
    script.write_text(match.group(1), encoding="utf-8")
    subprocess.run(["node", "--check", str(script)], check=True)
print("HTML inline JavaScript syntax: OK")
