import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/*
 * FR-10.1: mobile-first, large tap targets, readable outdoors.
 * jsdom can't measure layout, so these check the rules in the stylesheet itself.
 */
const css = readFileSync(join(__dirname, '../src/styles.css'), 'utf8');

/** The declarations of the first rule whose selector list matches exactly. */
function rule(selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s*');
  const match = new RegExp(`(^|\\n)${escaped}\\s*\\{([^}]*)\\}`).exec(css);
  if (!match) throw new Error(`No rule for "${selector}"`);
  return match[2]!;
}

const px = (declarations: string, property: string) => {
  const match = new RegExp(`${property}:\\s*(\\d+)px`).exec(declarations);
  return match ? Number(match[1]) : null;
};

describe('mobile styles (FR-10.1)', () => {
  it('gives buttons, inputs and selects a tap target of at least 48px', () => {
    expect(px(rule('button,\na.button'), 'min-height')).toBeGreaterThanOrEqual(48);
    expect(px(rule('input,\nselect'), 'min-height')).toBeGreaterThanOrEqual(48);
  });

  it('uses at least 16px text in form fields, so phones don’t zoom in', () => {
    expect(px(rule('input,\nselect'), 'font-size')).toBeGreaterThanOrEqual(16);
  });

  it('makes checkboxes and toggle rows easy to hit', () => {
    expect(
      px(rule("input[type='checkbox'],\ninput[type='radio']"), 'width'),
    ).toBeGreaterThanOrEqual(24);
    expect(px(rule('.toggle'), 'min-height')).toBeGreaterThanOrEqual(48);
  });

  it('uses a larger base font for reading outdoors', () => {
    expect(px(rule('html'), 'font-size')).toBeGreaterThanOrEqual(17);
  });

  it('stacks forms into one column and widens actions on small screens', () => {
    const small = /@media \(max-width: 600px\) \{([\s\S]*?)\n\}/.exec(css)?.[1] ?? '';
    expect(small).toMatch(/\.form--inline\s*\{[^}]*grid-template-columns:\s*(minmax\(0,\s*)?1fr/);
    expect(small).toMatch(/\.form button\[type='submit'\][^{]*\{[^}]*width:\s*100%/);
  });

  it('never lets a single-column grid grow wider than the phone', () => {
    // A bare `1fr` column grows to fit its widest child (a table or heatmap), pushing the whole
    // page sideways; `minmax(0, 1fr)` keeps it to the screen and lets that child scroll.
    expect(css).not.toMatch(/grid-template-columns:\s*1fr\s*;/);
  });
});
