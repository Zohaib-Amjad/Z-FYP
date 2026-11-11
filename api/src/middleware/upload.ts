import type { RequestHandler } from 'express';
import multer, { FileFilterCallback } from 'multer';
import { env } from '../config/env';
import { AppError } from '../utils/AppError';
import { ALLOWED_IMAGE_MIMES } from '../utils/imageFiles';

const MAX_FILES_PER_REQUEST = 8;
const MAX_FILE_BYTES = env.MAX_UPLOAD_MB * 1024 * 1024;
const FIELD_NAME = 'images';

const uploadError = (message: string, status = 422): AppError =>
  new AppError(status, 'UPLOAD_INVALID', message);

const fileFilter = (
  _req: Express.Request,
  file: Express.Multer.File,
  callback: FileFilterCallback,
): void => {
  if (ALLOWED_IMAGE_MIMES.has(file.mimetype)) {
    callback(null, true);
    return;
  }
  callback(uploadError('Only JPEG, PNG and WebP images can be uploaded'));
};

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_BYTES, files: MAX_FILES_PER_REQUEST },
  fileFilter,
});

const toUploadError = (error: unknown): unknown => {
  if (error instanceof multer.MulterError) {
    switch (error.code) {
      case 'LIMIT_FILE_SIZE':
        return uploadError(`Each image must be ${env.MAX_UPLOAD_MB} MB or smaller`);
      case 'LIMIT_FILE_COUNT':
      case 'LIMIT_UNEXPECTED_FILE':
        return uploadError(
          `Upload up to ${MAX_FILES_PER_REQUEST} images per request using the "${FIELD_NAME}" field`,
        );
      default:
        return uploadError('The upload could not be processed');
    }
  }
  if (error instanceof Error && /^(Multipart|Unexpected end of form)/.test(error.message)) {
    return uploadError('The upload could not be read. Send the images as multipart form data', 400);
  }
  return error;
};

export const uploadImages: RequestHandler = (req, res, next) => {
  upload.array(FIELD_NAME, MAX_FILES_PER_REQUEST)(req, res, error => {
    next(error ? toUploadError(error) : undefined);
  });
};
