'use client';

import { useQueryClient } from '@tanstack/react-query';
import Image from 'next/image';
import { useRef, useState, type DragEvent } from 'react';
import { ArrowDown, ArrowUp, ImagePlus, Star, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { ConfirmDialog } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { api, ApiError } from '@/lib/api';
import {
  ACCEPTED_IMAGE_TYPES,
  MAX_IMAGES_PER_VEHICLE,
  checkImageFiles,
  reorderImages,
} from '@/lib/images';
import { queryKeys } from '@/lib/queryKeys';
import { uploadVehicleImages } from '@/lib/upload';
import { cn } from '@/lib/cn';
import type { AdminVehicleImage } from '@/types';

interface PendingFile {
  id: number;
  file: File;
  preview: string;
  progress: number;
}

interface ImageManagerProps {
  vehicleId: string;
  vehicleName: string;
  images: AdminVehicleImage[];
}

let nextPendingId = 1;

export function ImageManager({ vehicleId, vehicleName, images }: ImageManagerProps) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const input = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [pending, setPending] = useState<PendingFile[]>([]);
  const [problems, setProblems] = useState<{ name: string; reason: string }[]>([]);
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [removing, setRemoving] = useState<AdminVehicleImage | null>(null);
  const [alt, setAlt] = useState<Record<string, string>>({});

  const ordered = [...images].sort((a, b) => a.sortOrder - b.sortOrder);
  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: queryKeys.admin.vehicle(vehicleId) });

  const choose = (files: File[]) => {
    const { accepted, rejected } = checkImageFiles(files, images.length + pending.length);
    setProblems(rejected);
    setPending(current => [
      ...current,
      ...accepted.map(file => ({
        id: nextPendingId++,
        file,
        preview: URL.createObjectURL(file),
        progress: 0,
      })),
    ]);
  };

  const clearPending = () => {
    pending.forEach(item => URL.revokeObjectURL(item.preview));
    setPending([]);
  };

  const upload = async () => {
    setUploading(true);
    try {
      await uploadVehicleImages(
        vehicleId,
        pending.map(item => item.file),
        '',
        fraction => setPending(current => current.map(item => ({ ...item, progress: fraction }))),
      );
      toast.success(
        `${pending.length} ${pending.length === 1 ? 'photograph' : 'photographs'} uploaded.`,
      );
      clearPending();
      await refresh();
    } catch (error) {
      toast.error(
        error instanceof ApiError ? error.message : 'The upload failed. Please try again.',
      );
      setPending(current => current.map(item => ({ ...item, progress: 0 })));
    } finally {
      setUploading(false);
    }
  };

  const run = async (work: () => Promise<unknown>, success?: string) => {
    setBusy(true);
    try {
      await work();
      await refresh();
      void queryClient.invalidateQueries({ queryKey: queryKeys.vehicles.all });
      if (success) toast.success(success);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'That change could not be saved.');
    } finally {
      setBusy(false);
    }
  };

  const move = (index: number, delta: number) =>
    run(async () => {
      for (const update of reorderImages(ordered, index, delta)) {
        await api.patch(`/api/admin/vehicles/${vehicleId}/images/${update.id}`, {
          sortOrder: update.sortOrder,
        });
      }
    });

  const onDrop = (event: DragEvent) => {
    event.preventDefault();
    setDragging(false);
    choose([...event.dataTransfer.files]);
  };

  return (
    <Card>
      <CardHeader>
        <h2 className="font-display text-2xl font-semibold">Photographs</h2>
        <p className="mt-1 text-sm text-ink-600">
          {images.length} of {MAX_IMAGES_PER_VEHICLE} photographs. The primary image appears on
          cards and in search results.
        </p>
      </CardHeader>
      <CardBody className="space-y-6">
        <div
          onDragOver={event => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          className={cn(
            'rounded-card border-2 border-dashed px-6 py-8 text-center transition-colors',
            dragging ? 'border-gold-500 bg-gold-200/30' : 'border-ink-300 bg-ivory-100',
          )}
        >
          <ImagePlus className="mx-auto h-8 w-8 text-gold-700" aria-hidden="true" />
          <p className="mt-2 text-sm text-ink-700">Drag photographs here, or</p>
          <input
            ref={input}
            id="image-files"
            type="file"
            multiple
            accept={ACCEPTED_IMAGE_TYPES.join(',')}
            className="sr-only"
            onChange={event => {
              choose([...(event.target.files ?? [])]);
              event.target.value = '';
            }}
          />
          <Button
            variant="outline"
            size="sm"
            className="mt-3"
            onClick={() => input.current?.click()}
            disabled={uploading}
          >
            Choose files
          </Button>
          <p className="mt-3 text-xs text-ink-500">
            JPEG, PNG or WebP, up to 5 MB each, 8 at a time.
          </p>
        </div>

        {problems.length > 0 ? (
          <ul
            role="alert"
            className="space-y-1 rounded-control border border-status-rejected/30 bg-[#fdf6f6] px-4 py-3 text-sm text-status-rejected"
          >
            {problems.map(problem => (
              <li key={problem.name}>
                <strong className="font-semibold">{problem.name}:</strong> {problem.reason}
              </li>
            ))}
          </ul>
        ) : null}

        {pending.length > 0 ? (
          <div className="space-y-3">
            <ul className="grid gap-3 sm:grid-cols-2">
              {pending.map(item => (
                <li
                  key={item.id}
                  className="flex items-center gap-3 rounded-control border border-ivory-300 p-2"
                >
                  {/* A local blob preview cannot go through the image optimiser. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={item.preview} alt="" className="h-14 w-20 rounded object-cover" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{item.file.name}</p>
                    <div
                      role="progressbar"
                      aria-label={`Upload progress for ${item.file.name}`}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={Math.round(item.progress * 100)}
                      className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-ink-100"
                    >
                      <div
                        className="h-full bg-gold-500 transition-all"
                        style={{ width: `${item.progress * 100}%` }}
                      />
                    </div>
                  </div>
                </li>
              ))}
            </ul>
            <div className="flex gap-3">
              <Button onClick={() => void upload()} loading={uploading}>
                {uploading
                  ? 'Uploading…'
                  : `Upload ${pending.length} ${pending.length === 1 ? 'photograph' : 'photographs'}`}
              </Button>
              <Button variant="ghost" onClick={clearPending} disabled={uploading}>
                Clear selection
              </Button>
            </div>
          </div>
        ) : null}

        {ordered.length === 0 ? (
          <p className="text-sm text-ink-600">
            No photographs yet. Customers will see a placeholder until you add one.
          </p>
        ) : (
          <ul className="space-y-3">
            {ordered.map((image, index) => (
              <li
                key={image.id}
                className="flex flex-col gap-3 rounded-card border border-ivory-300 p-3 sm:flex-row sm:items-center"
              >
                <div className="relative h-24 w-full shrink-0 overflow-hidden rounded-control bg-ink-900 sm:w-36">
                  <Image
                    src={image.url}
                    alt={image.altText ?? vehicleName}
                    fill
                    sizes="144px"
                    unoptimized={image.url.endsWith('.svg')}
                    className="object-cover"
                  />
                </div>
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="flex items-center gap-2">
                    {image.isPrimary ? (
                      <Badge className="bg-gold-200 text-ink-900 ring-gold-400">Primary</Badge>
                    ) : null}
                    <span className="text-xs text-ink-500">Photograph {index + 1}</span>
                  </div>
                  <label
                    className="block text-xs font-medium text-ink-700"
                    htmlFor={`alt-${image.id}`}
                  >
                    Alt text
                  </label>
                  <div className="flex gap-2">
                    <input
                      id={`alt-${image.id}`}
                      value={alt[image.id] ?? image.altText ?? ''}
                      maxLength={160}
                      onChange={event =>
                        setAlt(current => ({ ...current, [image.id]: event.target.value }))
                      }
                      className="h-11 min-w-0 flex-1 rounded-control border border-ink-300 bg-white px-3 text-sm"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={
                        busy ||
                        alt[image.id] === undefined ||
                        alt[image.id].trim() === (image.altText ?? '') ||
                        alt[image.id].trim() === ''
                      }
                      onClick={() =>
                        void run(async () => {
                          await api.patch(`/api/admin/vehicles/${vehicleId}/images/${image.id}`, {
                            altText: alt[image.id].trim(),
                          });
                          setAlt(({ [image.id]: _saved, ...rest }) => rest);
                        }, 'Alt text saved.')
                      }
                    >
                      Save
                    </Button>
                  </div>
                </div>
                <div className="flex shrink-0 flex-wrap gap-2 sm:flex-col">
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      aria-label="Move earlier"
                      disabled={busy || index === 0}
                      onClick={() => void move(index, -1)}
                    >
                      <ArrowUp className="h-4 w-4" aria-hidden="true" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      aria-label="Move later"
                      disabled={busy || index === ordered.length - 1}
                      onClick={() => void move(index, 1)}
                    >
                      <ArrowDown className="h-4 w-4" aria-hidden="true" />
                    </Button>
                  </div>
                  {image.isPrimary ? null : (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={busy}
                      onClick={() =>
                        void run(
                          () =>
                            api.patch(`/api/admin/vehicles/${vehicleId}/images/${image.id}`, {
                              isPrimary: true,
                            }),
                          'Primary photograph updated.',
                        )
                      }
                    >
                      <Star className="h-4 w-4" aria-hidden="true" />
                      Make primary
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={busy}
                    onClick={() => setRemoving(image)}
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                    Delete
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardBody>

      <ConfirmDialog
        open={removing !== null}
        onClose={() => setRemoving(null)}
        onConfirm={() => {
          const target = removing;
          setRemoving(null);
          if (target)
            void run(
              () => api.delete(`/api/admin/vehicles/${vehicleId}/images/${target.id}`),
              'Photograph deleted.',
            );
        }}
        title="Delete this photograph?"
        description={
          removing?.isPrimary
            ? 'This is the primary photograph. The next one will become primary. The file is permanently removed.'
            : 'The file is permanently removed and cannot be recovered.'
        }
        confirmLabel="Delete photograph"
        confirmVariant="danger"
      />
    </Card>
  );
}
