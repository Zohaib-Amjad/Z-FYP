import dotenv from 'dotenv';
import path from 'path';
import { DEALERSHIPS, VEHICLES } from '../prisma/seed-data';
import { writeSeedDealershipImage, writeSeedImageFiles } from '../prisma/seed-images';

dotenv.config();

const apiRoot = path.resolve(__dirname, '..');
const seedDirectory = path.resolve(apiRoot, process.env.UPLOAD_DIR ?? 'uploads', 'seed');

for (const vehicle of VEHICLES) writeSeedImageFiles(seedDirectory, vehicle);
const showroomPhotos = DEALERSHIPS.filter(dealership =>
  writeSeedDealershipImage(seedDirectory, dealership.name),
).length;
console.log(
  `Wrote ${VEHICLES.length * 2} vehicle images and ${showroomPhotos} showroom photographs to ${path.relative(apiRoot, seedDirectory)}`,
);
