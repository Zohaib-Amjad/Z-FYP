import fs from 'fs';
import path from 'path';
import type { VehicleSeed } from './seed-data';

export const slugify = (text: string): string =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

const escapeXml = (text: string): string =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Exterior plates sit on a light studio backdrop, interior plates on charcoal. */
const PLATE_TONES = {
  exterior: {
    wall: '#ece8e1',
    floor: '#e2ddd4',
    title: '#1c1c1c',
    text: '#55524d',
    muted: '#6b6660',
    swatchEdge: '#bdb7ae',
  },
  interior: {
    wall: '#1c1c1c',
    floor: '#232220',
    title: '#f7f4ee',
    text: '#d9d5ce',
    muted: '#bdb7ae',
    swatchEdge: '#55524d',
  },
} as const;

const SANS = 'Inter, Helvetica, Arial, sans-serif';
const SERIF = 'Georgia, serif';

/**
 * Flat "photography to follow" plate in the house style, used until staff upload real photographs.
 * Variant 1 is the exterior plate, variant 2 the interior plate.
 */
export const buildPlaceholderSvg = (vehicle: VehicleSeed, variant: number): string => {
  const label = variant === 1 ? 'Exterior' : 'Interior';
  const tone = variant === 1 ? PLATE_TONES.exterior : PLATE_TONES.interior;
  const manufacturer = escapeXml(vehicle.manufacturer.toUpperCase());
  const model = escapeXml(vehicle.model);
  const detail = escapeXml(`${vehicle.year} · ${vehicle.color}`);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1000" viewBox="0 0 1600 1000" role="img" aria-label="${escapeXml(`${vehicle.manufacturer} ${vehicle.model}, ${label.toLowerCase()} photography to follow`)}">
  <rect width="1600" height="1000" fill="${tone.wall}"/>
  <rect y="660" width="1600" height="340" fill="${tone.floor}"/>
  <text x="120" y="190" font-family="${SANS}" font-size="34" font-weight="600" letter-spacing="8" fill="${tone.muted}">${manufacturer}</text>
  <text x="120" y="300" font-family="${SERIF}" font-size="104" fill="${tone.title}">${model}</text>
  <circle cx="138" cy="372" r="18" fill="${vehicle.paintHex}" stroke="${tone.swatchEdge}" stroke-width="2"/>
  <text x="174" y="384" font-family="${SANS}" font-size="36" fill="${tone.text}">${detail}</text>
  <g transform="translate(1387 117) scale(2.2)" fill="#b8975a">
    <path d="M40.58 35.18A20 20 0 1 1 43.81 26.78" fill="none" stroke="#b8975a" stroke-width="2.5" stroke-linecap="round"/>
    <path d="M16 11h4.5v18.5L46 30.6v1.3L16 33z"/>
  </g>
  <text x="120" y="860" font-family="${SANS}" font-size="30" font-weight="600" letter-spacing="8" fill="${tone.muted}">${label.toUpperCase()}</text>
  <text x="120" y="916" font-family="${SERIF}" font-size="36" font-style="italic" fill="${tone.muted}">Photography to follow</text>
</svg>
`;
};

/**
 * Licensed photographs (see docs/image-credits.md): vehicles as <slug>-1.jpg (exterior) and <slug>-2.jpg
 * (interior); showrooms as dealership-<slug of the showroom name>.jpg.
 */
const PHOTO_DIRECTORY = path.join(__dirname, 'seed-photos');

/**
 * Writes a vehicle's two demo images (exterior, then interior) and returns their file names. A licensed
 * photograph is copied when one exists in prisma/seed-photos; otherwise a placeholder plate is drawn.
 */
export const writeSeedImageFiles = (directory: string, vehicle: VehicleSeed): string[] => {
  fs.mkdirSync(directory, { recursive: true });
  const slug = slugify(`${vehicle.manufacturer}-${vehicle.model}`);
  return [1, 2].map(variant => {
    const photo = path.join(PHOTO_DIRECTORY, `${slug}-${variant}.jpg`);
    if (fs.existsSync(photo)) {
      const fileName = path.basename(photo);
      fs.copyFileSync(photo, path.join(directory, fileName));
      return fileName;
    }
    const fileName = `${slug}-${variant}.svg`;
    fs.writeFileSync(path.join(directory, fileName), buildPlaceholderSvg(vehicle, variant));
    return fileName;
  });
};

/**
 * Copies a showroom's licensed photograph into the upload folder and returns its URL, or null when
 * prisma/seed-photos has no photograph for that showroom.
 */
export const writeSeedDealershipImage = (directory: string, name: string): string | null => {
  const fileName = `dealership-${slugify(name)}.jpg`;
  const photo = path.join(PHOTO_DIRECTORY, fileName);
  if (!fs.existsSync(photo)) return null;
  fs.mkdirSync(directory, { recursive: true });
  fs.copyFileSync(photo, path.join(directory, fileName));
  return `/uploads/seed/${fileName}`;
};
