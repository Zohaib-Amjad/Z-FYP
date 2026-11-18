import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { uploadsDir } from '../config/paths';
import { AppError } from './AppError';

export interface ImageType {
  mime: 'image/jpeg' | 'image/png' | 'image/webp';
  extension: 'jpg' | 'png' | 'webp';
}

/** A file as received from multer's memory storage. */
export interface UploadedImage {
  buffer: Buffer;
  mimetype: string;
  originalname: string;
}

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const JPEG_SIGNATURE = Buffer.from([0xff, 0xd8, 0xff]);

export const ALLOWED_IMAGE_MIMES: ReadonlySet<string> = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
]);

export const detectImageType = (buffer: Buffer): ImageType | null => {
  if (buffer.subarray(0, JPEG_SIGNATURE.length).equals(JPEG_SIGNATURE)) {
    return { mime: 'image/jpeg', extension: 'jpg' };
  }
  if (buffer.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE)) {
    return { mime: 'image/png', extension: 'png' };
  }
  const isWebp =
    buffer.length >= 12 &&
    buffer.subarray(0, 4).toString('latin1') === 'RIFF' &&
    buffer.subarray(8, 12).toString('latin1') === 'WEBP';
  return isWebp ? { mime: 'image/webp', extension: 'webp' } : null;
};

/**
 * Confirms the file content really is a JPEG, PNG or WebP image matching its declared type,
 * so a renamed file cannot be stored as an image.
 */
export const checkedImageType = (file: UploadedImage): ImageType => {
  const detected = detectImageType(file.buffer);
  if (!detected || detected.mime !== file.mimetype) {
    throw new AppError(
      422,
      'UPLOAD_INVALID',
      `"${file.originalname.slice(0, 60)}" is not a valid JPEG, PNG or WebP image`,
    );
  }
  return detected;
};

const vehicleDir = (vehicleId: string): string => path.join(uploadsDir, 'vehicles', vehicleId);

const vehicleImageUrl = (vehicleId: string, fileName: string): string =>
  `/uploads/vehicles/${vehicleId}/${fileName}`;

export const writeVehicleImage = async (
  vehicleId: string,
  buffer: Buffer,
  extension: ImageType['extension'],
): Promise<{ url: string; filePath: string }> => {
  const fileName = `${crypto.randomUUID()}.${extension}`;
  const directory = vehicleDir(vehicleId);
  await fs.mkdir(directory, { recursive: true });
  const filePath = path.join(directory, fileName);
  await fs.writeFile(filePath, buffer, { flag: 'wx' });
  return { url: vehicleImageUrl(vehicleId, fileName), filePath };
};

export const removeFiles = async (filePaths: string[]): Promise<void> => {
  await Promise.all(filePaths.map(filePath => fs.rm(filePath, { force: true })));
};

export const removeVehicleImageFile = async (vehicleId: string, url: string): Promise<void> => {
  const prefix = vehicleImageUrl(vehicleId, '');
  if (!url.startsWith(prefix)) return;
  const fileName = path.basename(url);
  await removeFiles([path.join(vehicleDir(vehicleId), fileName)]);
};

const dealershipDir = (dealershipId: string): string =>
  path.join(uploadsDir, 'dealerships', dealershipId);

const dealershipImageUrl = (dealershipId: string, fileName: string): string =>
  `/uploads/dealerships/${dealershipId}/${fileName}`;

export const writeDealershipImage = async (
  dealershipId: string,
  buffer: Buffer,
  extension: ImageType['extension'],
): Promise<{ url: string; filePath: string }> => {
  const fileName = `${crypto.randomUUID()}.${extension}`;
  const directory = dealershipDir(dealershipId);
  await fs.mkdir(directory, { recursive: true });
  const filePath = path.join(directory, fileName);
  await fs.writeFile(filePath, buffer, { flag: 'wx' });
  return { url: dealershipImageUrl(dealershipId, fileName), filePath };
};

/** Deletes an uploaded showroom photo; demo photos under /uploads/seed are left alone. */
export const removeDealershipImageFile = async (
  dealershipId: string,
  url: string,
): Promise<void> => {
  const prefix = dealershipImageUrl(dealershipId, '');
  if (!url.startsWith(prefix)) return;
  await removeFiles([path.join(dealershipDir(dealershipId), path.basename(url))]);
};
