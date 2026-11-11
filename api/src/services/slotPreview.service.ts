import { prisma } from '../config/prisma';
import { env } from '../config/env';
import { AppError } from '../utils/AppError';
import { availableSlotWhere } from '../utils/slotAvailability';
import { IMAGE_SELECT } from '../utils/vehicleDto';

/**
 * What the booking confirmation page shows for a chosen slot. Slots of deactivated vehicles or
 * dealerships are hidden from customers (A6); a slot that exists but can no longer be booked
 * (taken, started, or withdrawn from the dealership) is returned with `isAvailable: false`
 * so the page can explain it instead of failing.
 */
export const getSlotPreview = async (slotId: string) => {
  const slot = await prisma.timeSlot.findFirst({
    where: {
      id: slotId,
      isActive: true,
      dealership: { isActive: true },
      vehicle: { isActive: true },
    },
    select: {
      id: true,
      startAt: true,
      endAt: true,
      dealership: {
        select: {
          id: true,
          name: true,
          address: true,
          city: true,
          phone: true,
          openingHours: true,
        },
      },
      vehicle: {
        select: {
          id: true,
          manufacturer: true,
          model: true,
          year: true,
          images: { where: { isPrimary: true }, select: IMAGE_SELECT, take: 1 },
        },
      },
    },
  });
  if (!slot) throw new AppError(404, 'NOT_FOUND', 'Time slot not found');

  const bookable = await prisma.timeSlot.count({
    where: { AND: [availableSlotWhere(new Date())], id: slotId },
  });
  const { images, ...vehicle } = slot.vehicle;
  return {
    id: slot.id,
    startAt: slot.startAt,
    endAt: slot.endAt,
    isAvailable: bookable > 0,
    cancellationWindowHours: env.CANCELLATION_WINDOW_HOURS,
    dealership: slot.dealership,
    vehicle: { ...vehicle, primaryImage: images.at(0) ?? null },
  };
};
