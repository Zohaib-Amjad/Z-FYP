'use client';

import Image from 'next/image';
import { useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { Car, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/cn';
import type { VehicleImage } from '@/types';

const SWIPE_THRESHOLD_PX = 50;

interface VehicleGalleryProps {
  images: VehicleImage[];
  title: string;
}

/** Large image with thumbnails; arrow keys and horizontal swipes move between images. */
export function VehicleGallery({ images, title }: VehicleGalleryProps) {
  const ordered = [...images].sort(
    (a, b) => Number(b.isPrimary) - Number(a.isPrimary) || a.sortOrder - b.sortOrder,
  );
  const [index, setIndex] = useState(0);
  const swipeStart = useRef<number | null>(null);
  const count = ordered.length;

  if (count === 0) {
    return (
      <div className="flex aspect-[16/10] items-center justify-center rounded-card bg-ink-900 text-ink-500">
        <Car className="h-16 w-16" aria-hidden="true" />
        <span className="sr-only">No photographs available for {title}</span>
      </div>
    );
  }

  const go = (next: number) => setIndex((next + count) % count);
  const current = ordered[index];

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      go(index + 1);
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault();
      go(index - 1);
    }
  };
  const onPointerDown = (event: PointerEvent) => {
    swipeStart.current = event.clientX;
  };
  const onPointerUp = (event: PointerEvent) => {
    if (swipeStart.current === null) return;
    const delta = event.clientX - swipeStart.current;
    swipeStart.current = null;
    if (Math.abs(delta) >= SWIPE_THRESHOLD_PX) go(delta < 0 ? index + 1 : index - 1);
  };

  return (
    <section aria-roledescription="carousel" aria-label={`${title} photographs`}>
      <div
        tabIndex={0}
        onKeyDown={onKeyDown}
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerCancel={() => {
          swipeStart.current = null;
        }}
        className="relative aspect-[16/10] touch-pan-y select-none overflow-hidden rounded-card bg-ink-900"
      >
        <Image
          key={current.id}
          src={current.url}
          alt={current.altText ?? `${title}, photograph ${index + 1}`}
          fill
          priority={index === 0}
          draggable={false}
          sizes="(min-width: 1024px) 60vw, 100vw"
          unoptimized={current.url.endsWith('.svg')}
          className="object-cover"
        />
        {count > 1 ? (
          <>
            <button
              type="button"
              onClick={() => go(index - 1)}
              aria-label="Previous photograph"
              className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full flex h-11 w-11 items-center justify-center bg-ink-950/70 text-ivory-100 hover:bg-ink-950"
            >
              <ChevronLeft className="h-5 w-5" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => go(index + 1)}
              aria-label="Next photograph"
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full flex h-11 w-11 items-center justify-center bg-ink-950/70 text-ivory-100 hover:bg-ink-950"
            >
              <ChevronRight className="h-5 w-5" aria-hidden="true" />
            </button>
            <p
              aria-live="polite"
              className="absolute bottom-3 right-3 rounded-full bg-ink-950/70 px-3 py-1 text-xs font-medium text-ivory-100"
            >
              {index + 1} / {count}
            </p>
          </>
        ) : null}
      </div>
      {count > 1 ? (
        <ul className="mt-3 flex gap-3 overflow-x-auto pb-1">
          {ordered.map((image, position) => (
            <li key={image.id} className="shrink-0">
              <button
                type="button"
                onClick={() => setIndex(position)}
                aria-label={`Show photograph ${position + 1}`}
                aria-current={position === index}
                className={cn(
                  'relative block h-16 w-24 overflow-hidden rounded-control border-2 bg-ink-900 sm:h-20 sm:w-32',
                  position === index
                    ? 'border-gold-500'
                    : 'border-transparent opacity-70 hover:opacity-100',
                )}
              >
                <Image
                  src={image.url}
                  alt=""
                  fill
                  sizes="128px"
                  unoptimized={image.url.endsWith('.svg')}
                  className="object-cover"
                />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
