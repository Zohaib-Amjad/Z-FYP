import type { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma';
import type { UpdateImageInput } from '../validators/vehicle.validators';
import { AppError } from '../utils/AppError';
import {
  ImageType,
  detectImageType,
  removeFiles,
  removeVehicleImageFile,
  writeVehicleImage,
} from '../utils/imageFiles';
import { lockVehicle } from '../utils/locks';
import { IMAGE_ORDER, IMAGE_SELECT } from '../utils/vehicleDto';
import { vehicleNotFound } from './vehicle.service';

const MAX_IMAGES_PER_VEHICLE = 12;

export interface UploadedImage {
  buffer: Buffer;
  mimetype: string;
  originalname: string;
}

type Tx = Prisma.TransactionClient;

const invalidUpload = (message: string): AppError => new AppError(422, 'UPLOAD_INVALID', message);

const displayName = (name: string): string => name.slice(0, 60);

const checkedType = (file: UploadedImage): ImageType => {
  const detected = detectImageType(file.buffer);
  if (!detected || detected.mime !== file.mimetype) {
    throw invalidUpload(
      `"${displayName(file.originalname)}" is not a valid JPEG, PNG or WebP image`,
    );
  }
  return detected;
};

const imagesOf = (tx: Tx | typeof prisma, vehicleId: string) =>
  tx.vehicleImage.findMany({ where: { vehicleId }, select: IMAGE_SELECT, orderBy: IMAGE_ORDER });

const promoteFirstImage = async (tx: Tx, vehicleId: string): Promise<void> => {
  const first = await tx.vehicleImage.findFirst({
    where: { vehicleId },
    orderBy: IMAGE_ORDER,
    select: { id: true },
  });
  if (first) await tx.vehicleImage.update({ where: { id: first.id }, data: { isPrimary: true } });
};

const findImage = async (tx: Tx, vehicleId: string, imageId: string) => {
  const image = await tx.vehicleImage.findFirst({
    where: { id: imageId, vehicleId },
    select: { id: true, url: true, isPrimary: true },
  });
  if (!image) throw new AppError(404, 'NOT_FOUND', 'Image not found');
  return image;
};

const insertImages = async (
  tx: Tx,
  vehicleId: string,
  files: { buffer: Buffer; type: ImageType }[],
  altText: string,
  written: string[],
): Promise<void> => {
  const [count, aggregate] = await Promise.all([
    tx.vehicleImage.count({ where: { vehicleId } }),
    tx.vehicleImage.aggregate({ where: { vehicleId }, _max: { sortOrder: true } }),
  ]);
  if (count + files.length > MAX_IMAGES_PER_VEHICLE) {
    throw invalidUpload(
      `A vehicle can have at most ${MAX_IMAGES_PER_VEHICLE} images (${count} already uploaded)`,
    );
  }
  const firstSortOrder = (aggregate._max.sortOrder ?? 0) + 1;
  for (const [index, file] of files.entries()) {
    const stored = await writeVehicleImage(vehicleId, file.buffer, file.type.extension);
    written.push(stored.filePath);
    await tx.vehicleImage.create({
      data: {
        vehicleId,
        url: stored.url,
        altText,
        isPrimary: count === 0 && index === 0,
        sortOrder: firstSortOrder + index,
      },
    });
  }
};

export const addVehicleImages = async (
  vehicleId: string,
  files: UploadedImage[],
  altText?: string,
) => {
  if (files.length === 0) throw invalidUpload('Select at least one image to upload');
  const vehicle = await prisma.vehicle.findUnique({
    where: { id: vehicleId },
    select: { manufacturer: true, model: true },
  });
  if (!vehicle) throw vehicleNotFound();
  const checked = files.map(file => ({ buffer: file.buffer, type: checkedType(file) }));
  const written: string[] = [];
  try {
    await prisma.$transaction(async tx => {
      await lockVehicle(tx, vehicleId);
      await insertImages(
        tx,
        vehicleId,
        checked,
        altText ?? `${vehicle.manufacturer} ${vehicle.model}`,
        written,
      );
    });
  } catch (error) {
    await removeFiles(written);
    throw error;
  }
  return imagesOf(prisma, vehicleId);
};

export const updateVehicleImage = (vehicleId: string, imageId: string, input: UpdateImageInput) =>
  prisma.$transaction(async tx => {
    await lockVehicle(tx, vehicleId);
    const image = await findImage(tx, vehicleId, imageId);
    if (input.isPrimary === false && image.isPrimary) {
      throw new AppError(422, 'VALIDATION_ERROR', 'Request validation failed', [
        {
          field: 'isPrimary',
          message: 'A vehicle must have a primary image. Set another image as primary instead',
        },
      ]);
    }
    if (input.isPrimary === true && !image.isPrimary) {
      await tx.vehicleImage.updateMany({
        where: { vehicleId, isPrimary: true },
        data: { isPrimary: false },
      });
    }
    await tx.vehicleImage.update({
      where: { id: imageId },
      data: { altText: input.altText, sortOrder: input.sortOrder, isPrimary: input.isPrimary },
    });
    return imagesOf(tx, vehicleId);
  });

export const deleteVehicleImage = async (vehicleId: string, imageId: string) => {
  const removed = await prisma.$transaction(async tx => {
    await lockVehicle(tx, vehicleId);
    const image = await findImage(tx, vehicleId, imageId);
    await tx.vehicleImage.delete({ where: { id: imageId } });
    if (image.isPrimary) await promoteFirstImage(tx, vehicleId);
    return image;
  });
  await removeVehicleImageFile(vehicleId, removed.url);
  return imagesOf(prisma, vehicleId);
};
