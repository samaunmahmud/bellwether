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
