import { useQuery } from '@apollo/client';
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { PALETTE_QUERY } from '../graphql/v3';
import { FARM_PAGES } from './farmPages';

interface PaletteData {
  farms: Array<{
    id: string;
    name: string;
    groups: Array<{ id: string; name: string }>;
    fields: Array<{ id: string; name: string }>;
  }>;
  animals: Array<{ id: string; name: string; species: string }>;
}

export interface PaletteItem {
  label: string;
  hint: string;
  to: string;
}

/** Everything the palette can jump to, current farm's pages first. */
export function paletteItems(data: PaletteData | undefined, farmId: string | null): PaletteItem[] {
  const farms = data?.farms ?? [];
  const current = farms.find((f) => f.id === farmId) ?? farms[0];
  const items: PaletteItem[] = [];
  if (current)
    for (const page of FARM_PAGES)
      items.push({ label: page.label, hint: current.name, to: `/farms/${current.id}${page.path}` });
  for (const farm of farms) {
    items.push({ label: farm.name, hint: 'Farm', to: `/farms/${farm.id}` });
    for (const g of farm.groups)
      items.push({ label: g.name, hint: `Group · ${farm.name}`, to: `/groups/${g.id}` });
    for (const f of farm.fields)
      items.push({ label: f.name, hint: `Field · ${farm.name}`, to: `/farms/${farm.id}/map` });
  }
  for (const pet of data?.animals ?? [])
    items.push({ label: pet.name, hint: `Pet · ${pet.species}`, to: `/pets/${pet.id}` });
  items.push(
    { label: 'My farms', hint: 'All farms', to: '/farms' },
    { label: 'My pets', hint: 'Pets', to: '/animals' },
    { label: 'Postcode forecast', hint: 'Any UK postcode', to: '/' },
  );
  return items;
}

/** Ctrl/⌘+K: type to jump to any farm page, group, field or pet. */
export function CommandPalette({
  open,
  onClose,
  farmId,
}: {
  open: boolean;
  onClose: () => void;
  farmId: string | null;
}) {
  const navigate = useNavigate();
  const input = useRef<HTMLInputElement>(null);
  const [text, setText] = useState('');
  const [index, setIndex] = useState(0);
  const { data } = useQuery<PaletteData>(PALETTE_QUERY, { skip: !open });

  const matches = useMemo(() => {
    const words = text.toLowerCase().split(/\s+/).filter(Boolean);
    return paletteItems(data, farmId)
      .filter((item) => words.every((w) => `${item.label} ${item.hint}`.toLowerCase().includes(w)))
      .slice(0, 12);
  }, [data, farmId, text]);

  useEffect(() => {
    if (open) {
      setText('');
      setIndex(0);
      setTimeout(() => input.current?.focus(), 0);
    }
  }, [open]);

  if (!open) return null;

  function go(item: PaletteItem | undefined) {
    if (!item) return;
    onClose();
    navigate(item.to);
  }

  function keys(e: KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setIndex((i) => Math.min(matches.length - 1, i + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setIndex((i) => Math.max(0, i - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      go(matches[index]);
    } else if (e.key === 'Escape') onClose();
  }

  return (
    <div className="palette__backdrop" onMouseDown={onClose}>
      <div
        className="palette"
        role="dialog"
        aria-modal="true"
        aria-label="Go to"
        onMouseDown={(e) => e.stopPropagation()}
        onKeyDown={keys}
      >
        <input
          ref={input}
          className="palette__input"
          placeholder="Go to a page, group, field or pet…"
          aria-label="Search"
          role="combobox"
          aria-expanded="true"
          aria-controls="palette-results"
          aria-activedescendant={matches[index] ? `palette-${index}` : undefined}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setIndex(0);
          }}
        />
        <ul className="palette__list" id="palette-results" role="listbox" aria-label="Results">
          {matches.map((item, i) => (
            <li
              key={`${item.to}-${item.label}`}
              id={`palette-${i}`}
              role="option"
              aria-selected={i === index}
              className={i === index ? 'is-active' : ''}
              onMouseEnter={() => setIndex(i)}
              onClick={() => go(item)}
            >
              <span>{item.label}</span>
              <span className="muted">{item.hint}</span>
            </li>
          ))}
          {matches.length === 0 && <li className="muted">Nothing matches “{text}”.</li>}
        </ul>
        <p className="palette__help muted">↑ ↓ to choose · Enter to go · Esc to close</p>
      </div>
    </div>
  );
}
