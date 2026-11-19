import { ApiError, toApiError } from '@/lib/api';
import type { AdminDealership, AdminVehicleImage } from '@/types';

/**
 * Uploads images with progress reporting (fetch cannot report upload progress, so this uses
 * XMLHttpRequest). Resolves with the vehicle's full image list; rejects with an ApiError.
 */
export function uploadVehicleImages(
  vehicleId: string,
  files: File[],
  altText: string,
  onProgress: (fraction: number) => void,
): Promise<AdminVehicleImage[]> {
  return new Promise((resolve, reject) => {
    const form = new FormData();
    files.forEach(file => form.append('images', file));
    if (altText.trim()) form.append('altText', altText.trim());

    const request = new XMLHttpRequest();
    request.open('POST', `/api/admin/vehicles/${vehicleId}/images`);
    request.withCredentials = true;
    request.setRequestHeader('Accept', 'application/json');
    request.upload.onprogress = event => {
      if (event.lengthComputable) onProgress(event.loaded / event.total);
    };
    request.onerror = () =>
      reject(
        new ApiError(0, 'NETWORK_ERROR', 'We could not reach the server. Check your connection.'),
      );
    request.onload = () => {
      let body: unknown = null;
      try {
        body = JSON.parse(request.responseText);
      } catch {
        body = null;
      }
      if (request.status >= 200 && request.status < 300) {
        resolve((body as { data: AdminVehicleImage[] }).data);
      } else {
        reject(toApiError(request.status, body));
      }
    };
    request.send(form);
  });
}

/** Uploads (or replaces) a showroom photograph. Resolves with the updated dealership. */
export async function uploadDealershipImage(
  dealershipId: string,
  file: File,
): Promise<AdminDealership> {
  const form = new FormData();
  form.append('image', file);
  let response: Response;
  try {
    response = await fetch(`/api/admin/dealerships/${dealershipId}/image`, {
      method: 'POST',
      body: form,
      credentials: 'include',
      headers: { Accept: 'application/json' },
    });
  } catch {
    throw new ApiError(0, 'NETWORK_ERROR', 'We could not reach the server. Check your connection.');
  }
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) throw toApiError(response.status, body);
  return (body as { data: AdminDealership }).data;
}
