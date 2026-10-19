# bellwether-risk (Python)

A Python port of the six modules in `packages/risk-engine`: tick activity, dog heatstroke,
cattle heat stress (THI), sheep blowfly, newborn lamb chill and liver fluke. Same thresholds,
same reasons, no I/O. Cattle heat stress uses daily data only (the TS engine also has an hourly path).
The TypeScript engine is still the one the app uses.

```sh
cd packages/risk-engine-py
python3 -m venv .venv && . .venv/bin/activate
pip install -e '.[dev]'
pytest
```
