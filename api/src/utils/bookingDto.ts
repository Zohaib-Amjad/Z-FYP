import type { Prisma } from '@prisma/client';

export const BOOKING_SELECT = {
  id: true,
  status: true,
  customerNote: true,
  staffNote: true,
  rejectionReason: true,
  cancellationReason: true,
  cancelledBy: true,
  approvedAt: true,
  completedAt: true,
  createdAt: true,
  updatedAt: true,
  customer: {
    select: { id: true, firstName: true, lastName: true, email: true, phone: true },
  },
  slot: {
    select: {
      id: true,
      startAt: true,
      endAt: true,
      vehicle: {
        select: {
          id: true,
          manufacturer: true,
          model: true,
          year: true,
          images: { where: { isPrimary: true }, take: 1, select: { url: true, altText: true } },
        },
      },
      dealership: {
        select: { id: true, name: true, address: true, city: true, phone: true },
      },
    },
  },
} satisfies Prisma.BookingSelect;

export type BookingRow = Prisma.BookingGetPayload<{ select: typeof BOOKING_SELECT }>;

export const toBookingDto = ({ slot, ...booking }: BookingRow) => {
  const { vehicle, dealership, ...slotTimes } = slot;
  const { images, ...vehicleFields } = vehicle;
  return {
    ...booking,
    slot: slotTimes,
    vehicle: { ...vehicleFields, primaryImage: images.at(0) ?? null },
    dealership,
  };
};

export type BookingDto = ReturnType<typeof toBookingDto>;
