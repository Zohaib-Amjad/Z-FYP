import dotenv from 'dotenv';
import path from 'path';
import { VEHICLES } from '../prisma/seed-data';
import { writeSeedImageFiles } from '../prisma/seed-images';

dotenv.config();

const apiRoot = path.resolve(__dirname, '..');
const seedDirectory = path.resolve(apiRoot, process.env.UPLOAD_DIR ?? 'uploads', 'seed');

for (const vehicle of VEHICLES) writeSeedImageFiles(seedDirectory, vehicle);
console.log(
  `Wrote ${VEHICLES.length * 2} demo vehicle images to ${path.relative(apiRoot, seedDirectory)}`,
);
