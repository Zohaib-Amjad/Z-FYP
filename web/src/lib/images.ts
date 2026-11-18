const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_FILES_PER_UPLOAD = 8;
export const MAX_IMAGES_PER_VEHICLE = 12;
export const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;

export interface FileCheck {
  accepted: File[];
  rejected: { name: string; reason: string }[];
}

const megabytes = (bytes: number): string => `${(bytes / (1024 * 1024)).toFixed(1)} MB`;

/** Why a single file cannot be uploaded as an image, or null when its type and size are fine. */
export function imageFileProblem(file: File): string | null {
  if (!(ACCEPTED_IMAGE_TYPES as readonly string[]).includes(file.type)) {
    return 'Only JPEG, PNG or WebP images are accepted.';
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return `This image is ${megabytes(file.size)}; the limit is ${megabytes(MAX_IMAGE_BYTES)}.`;
  }
  return null;
}

/** Client-side check of files chosen for upload; the server repeats it on the real file content. */
export function checkImageFiles(files: File[], existingCount: number): FileCheck {
  const accepted: File[] = [];
  const rejected: FileCheck['rejected'] = [];
  const room = Math.min(MAX_FILES_PER_UPLOAD, MAX_IMAGES_PER_VEHICLE - existingCount);

  for (const file of files) {
    const problem = imageFileProblem(file);
    if (problem) {
      rejected.push({ name: file.name, reason: problem });
    } else if (accepted.length >= room) {
      rejected.push({
        name: file.name,
        reason:
          existingCount + accepted.length >= MAX_IMAGES_PER_VEHICLE
            ? `A vehicle can hold at most ${MAX_IMAGES_PER_VEHICLE} images.`
            : `At most ${MAX_FILES_PER_UPLOAD} images can be uploaded at once.`,
      });
    } else {
      accepted.push(file);
    }
  }
  return { accepted, rejected };
}

export interface ImageOrderUpdate {
  id: string;
  sortOrder: number;
}

/**
 * Moves the image at `index` by `delta` positions and returns the sort-order updates needed
 * (only for images whose position changed). Orders are normalised to 0, 1, 2 ...
 */
export function reorderImages(
  images: { id: string; sortOrder: number }[],
  index: number,
  delta: number,
): ImageOrderUpdate[] {
  const target = index + delta;
  if (index < 0 || index >= images.length || target < 0 || target >= images.length) return [];
  const ordered = [...images].sort((a, b) => a.sortOrder - b.sortOrder);
  const [moved] = ordered.splice(index, 1);
  ordered.splice(target, 0, moved);
  const before = new Map(images.map(image => [image.id, image.sortOrder]));
  return ordered
    .map((image, position) => ({ id: image.id, sortOrder: position }))
    .filter(update => before.get(update.id) !== update.sortOrder);
}
