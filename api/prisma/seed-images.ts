import fs from 'fs';
import path from 'path';
import type { VehicleSeed } from './seed-data';

export const slugify = (text: string): string =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

export const buildPlaceholderSvg = (vehicle: VehicleSeed, variant: number): string => {
  const [hueA, hueB] = vehicle.hues;
  const angle = variant === 1 ? 135 : 45;
  const title = `${vehicle.manufacturer} ${vehicle.model}`;
  const label = variant === 1 ? 'Exterior' : 'Interior';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1000" viewBox="0 0 1600 1000">
  <defs>
    <linearGradient id="g" gradientTransform="rotate(${angle})">
      <stop offset="0%" stop-color="hsl(${hueA},45%,14%)"/>
      <stop offset="60%" stop-color="hsl(${hueB},40%,28%)"/>
      <stop offset="100%" stop-color="hsl(${hueB},55%,52%)"/>
    </linearGradient>
  </defs>
  <rect width="1600" height="1000" fill="url(#g)"/>
  <text x="800" y="480" text-anchor="middle" font-family="Georgia, serif" font-size="84" fill="#f5ecd7">${title}</text>
  <text x="800" y="560" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-size="30" letter-spacing="10" fill="#d6c08a">${label.toUpperCase()}</text>
</svg>
`;
};

/** Writes the two placeholder photographs of a vehicle and returns their file names. */
export const writeSeedImageFiles = (directory: string, vehicle: VehicleSeed): string[] => {
  fs.mkdirSync(directory, { recursive: true });
  const slug = slugify(`${vehicle.manufacturer}-${vehicle.model}`);
  return [1, 2].map(variant => {
    const fileName = `${slug}-${variant}.svg`;
    fs.writeFileSync(path.join(directory, fileName), buildPlaceholderSvg(vehicle, variant));
    return fileName;
  });
};
