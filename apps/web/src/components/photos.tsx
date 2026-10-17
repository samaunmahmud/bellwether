import aerial800 from '../assets/photos/aerial-800.webp';
import aerial from '../assets/photos/aerial.webp';
import barn800 from '../assets/photos/barn-800.webp';
import barn from '../assets/photos/barn.webp';
import gate800 from '../assets/photos/gate-800.webp';
import gate from '../assets/photos/gate.webp';
import lambs800 from '../assets/photos/lambs-800.webp';
import lambs from '../assets/photos/lambs.webp';
import storm800 from '../assets/photos/storm-800.webp';
import storm from '../assets/photos/storm.webp';
import type { ReactNode } from 'react';
import cattle800 from '../assets/photos/cattle-800.webp';
import cattle from '../assets/photos/cattle.webp';
import dog800 from '../assets/photos/dog-800.webp';
import dog from '../assets/photos/dog.webp';
import fell800 from '../assets/photos/fell-800.webp';
import fell from '../assets/photos/fell.webp';

/**
 * v3.2: background photos (AI-generated in Figma for Bellwether, not real farms). Decorative:
 * every page that shows one says the same thing in text.
 */
export const PHOTOS = {
  fell: { src: fell, small: fell800, width: 1376, height: 768 },
  cattle: { src: cattle, small: cattle800, width: 1584, height: 672 },
  dog: { src: dog, small: dog800, width: 1584, height: 672 },
  gate: { src: gate, small: gate800, width: 1376, height: 768 },
  aerial: { src: aerial, small: aerial800, width: 1584, height: 672 },
  storm: { src: storm, small: storm800, width: 1584, height: 672 },
  barn: { src: barn, small: barn800, width: 1584, height: 672 },
  lambs: { src: lambs, small: lambs800, width: 1584, height: 672 },
} as const;

export type PhotoName = keyof typeof PHOTOS;

/** Sheep farms get the fell, cattle-only farms the lowland herd. */
export function farmPhoto(stats: { sheep: number; cattle: number }): PhotoName {
  return stats.sheep === 0 && stats.cattle > 0 ? 'cattle' : 'fell';
}

/** A decorative background photo that fills its positioned parent. */
export function Photo({ name, className = '' }: { name: PhotoName; className?: string }) {
  const p = PHOTOS[name];
  return (
    <img
      className={`photo ${className}`}
      src={p.src}
      srcSet={`${p.small} 800w, ${p.src} ${p.width}w`}
      sizes="100vw"
      width={p.width}
      height={p.height}
      alt=""
      decoding="async"
    />
  );
}

/**
 * v3.3: the photo banner at the top of a page. `eyebrow` sits above the title (usually a link
 * back to the farm); children are the title, a line under it and any buttons.
 */
export function PageHero({
  photo,
  eyebrow,
  children,
}: {
  photo: PhotoName;
  eyebrow?: ReactNode;
  children: ReactNode;
}) {
  return (
    <header className="page-hero page-hero--compact">
      <Photo name={photo} className="photo--drift" />
      <div className="page-hero__content">
        {eyebrow && <p className="page-hero__eyebrow">{eyebrow}</p>}
        <div className="page-hero__row">{children}</div>
      </div>
    </header>
  );
}
