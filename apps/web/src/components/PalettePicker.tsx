import { useState } from 'react';

export const PALETTE_KEY = 'bellwether:palette';

/** v3.3: colour schemes (A82). Pasture is the default; the others change accent and sidebar. */
export const PALETTES = [
  { id: 'pasture', name: 'Pasture', swatch: ['#2d6a4f', '#74c69d'] },
  { id: 'heather', name: 'Heather', swatch: ['#6b4c8a', '#c9a7eb'] },
  { id: 'loch', name: 'Loch', swatch: ['#1f6f8b', '#7cc8e3'] },
  { id: 'peat', name: 'Peat', swatch: ['#6b4a33', '#d9b48f'] },
] as const;

type PaletteId = (typeof PALETTES)[number]['id'];

const isPalette = (v: string | null): v is PaletteId => PALETTES.some((p) => p.id === v);

function read(): PaletteId {
  try {
    const v = localStorage.getItem(PALETTE_KEY);
    return isPalette(v) ? v : 'pasture';
  } catch {
    return 'pasture';
  }
}

function apply(id: PaletteId) {
  if (id === 'pasture') document.documentElement.removeAttribute('data-palette');
  else document.documentElement.setAttribute('data-palette', id);
}

/** Called once before React draws, so the page never flashes the default colours. */
export function applyStoredPalette() {
  apply(read());
}

export function PalettePicker() {
  const [current, setCurrent] = useState<PaletteId>(read);

  function choose(id: PaletteId) {
    setCurrent(id);
    apply(id);
    try {
      localStorage.setItem(PALETTE_KEY, id);
    } catch {
      // Private browsing: the choice lasts until the page closes.
    }
  }

  return (
    <fieldset className="palette-picker">
      <legend className="visually-hidden">Colour scheme</legend>
      <div className="palette-picker__options">
        {PALETTES.map((p) => (
          <label key={p.id} className="palette-picker__option" title={p.name}>
            <input
              type="radio"
              name="palette"
              value={p.id}
              aria-label={p.name}
              checked={current === p.id}
              onChange={() => choose(p.id)}
            />
            <span
              className="palette-picker__swatch"
              aria-hidden="true"
              style={{
                background: `linear-gradient(135deg, ${p.swatch[0]} 50%, ${p.swatch[1]} 50%)`,
              }}
            />
          </label>
        ))}
      </div>
    </fieldset>
  );
}
