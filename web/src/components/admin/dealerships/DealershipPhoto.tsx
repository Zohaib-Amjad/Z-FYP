'use client';

import { useQueryClient } from '@tanstack/react-query';
import Image from 'next/image';
import { useRef, useState, type ChangeEvent } from 'react';
import { ImagePlus, Store, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { ConfirmDialog } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { api, ApiError } from '@/lib/api';
import { ACCEPTED_IMAGE_TYPES, imageFileProblem } from '@/lib/images';
import { queryKeys } from '@/lib/queryKeys';
import { uploadDealershipImage } from '@/lib/upload';
import type { AdminDealership } from '@/types';

/** Upload, replace or remove the photograph shown on the showroom's card in the customer portal. */
export function DealershipPhoto({ dealership }: { dealership: AdminDealership }) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);

  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.dealership(dealership.id) }),
      queryClient.invalidateQueries({ queryKey: ['admin', 'dealerships'] }),
      queryClient.invalidateQueries({ queryKey: queryKeys.dealerships.all }),
    ]);
  };

  const onFileChosen = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    const problem = imageFileProblem(file);
    if (problem) {
      toast.error(problem);
      return;
    }
    setBusy(true);
    try {
      await uploadDealershipImage(dealership.id, file);
      toast.success('Showroom photograph updated.');
      await refresh();
    } catch (error) {
      toast.error(
        error instanceof ApiError ? error.message : 'The upload failed. Please try again.',
      );
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    setBusy(true);
    try {
      await api.delete(`/api/admin/dealerships/${dealership.id}/image`);
      toast.success('Showroom photograph removed.');
      setConfirmRemove(false);
      await refresh();
    } catch (error) {
      toast.error(
        error instanceof ApiError ? error.message : 'The photograph could not be removed.',
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <h2 className="font-display text-2xl font-semibold">Showroom photograph</h2>
        <p className="mt-1 text-sm text-ink-600">
          Shown on the showroom&rsquo;s card on the home page. JPEG, PNG or WebP, up to 5 MB; a
          landscape photograph works best.
        </p>
      </CardHeader>
      <CardBody className="space-y-4">
        <div className="relative aspect-[16/10] w-full max-w-xl overflow-hidden rounded-card border border-ivory-300 bg-ink-950">
          {dealership.imageUrl ? (
            <Image
              src={dealership.imageUrl}
              alt={`${dealership.name} showroom`}
              fill
              sizes="(min-width: 768px) 36rem, 100vw"
              className="object-cover"
            />
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-2 text-ink-300">
              <Store className="h-10 w-10" aria-hidden="true" />
              <span className="text-sm">No photograph yet</span>
            </div>
          )}
        </div>
        <input
          ref={input}
          type="file"
          accept={ACCEPTED_IMAGE_TYPES.join(',')}
          className="sr-only"
          aria-label="Choose a showroom photograph"
          onChange={event => void onFileChosen(event)}
        />
        <div className="flex flex-wrap gap-3">
          <Button onClick={() => input.current?.click()} loading={busy}>
            <ImagePlus className="h-4 w-4" aria-hidden="true" />
            {dealership.imageUrl ? 'Replace photograph' : 'Upload photograph'}
          </Button>
          {dealership.imageUrl ? (
            <Button variant="outline" onClick={() => setConfirmRemove(true)} disabled={busy}>
              <Trash2 className="h-4 w-4" aria-hidden="true" />
              Remove
            </Button>
          ) : null}
        </div>
      </CardBody>
      <ConfirmDialog
        open={confirmRemove}
        onClose={() => setConfirmRemove(false)}
        title="Remove the showroom photograph?"
        description="The home page card will show the showroom details without a photograph. An uploaded file is permanently deleted."
        confirmLabel="Remove photograph"
        confirmVariant="danger"
        loading={busy}
        onConfirm={() => void remove()}
      />
    </Card>
  );
}
