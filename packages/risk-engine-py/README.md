# bellwether-risk (Python)

A Python port of selected modules from `packages/risk-engine`: tick activity, dog heatstroke
and cattle heat stress (THI). Same thresholds, same reasons, no I/O.
The TypeScript engine is still the one the app uses.

```sh
cd packages/risk-engine-py
python3 -m venv .venv && . .venv/bin/activate
pip install -e '.[dev]'
pytest
```
