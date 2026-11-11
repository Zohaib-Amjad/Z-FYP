import { describe, expect, it } from 'vitest';
import {
  bulkSchema,
  dealershipSchema,
  generateTemporaryPassword,
  localToIso,
  slotSchema,
  staffSchema,
  toBulkPayload,
  toDealershipPayload,
  toVehiclePayload,
  vehicleSchema,
  type VehicleFormValues,
} from '@/lib/adminSchemas';
import { checkImageFiles, reorderImages } from '@/lib/images';

const vehicle: VehicleFormValues = {
  manufacturer: 'Aston Martin',
  model: 'Vantage',
  year: '2025',
  vehicleType: 'SPORTS',
  fuelType: 'PETROL',
  transmission: 'AUTOMATIC',
  engine: '4.0L twin-turbo V8',
  powerHp: '656',
  topSpeedKmh: '325',
  acceleration0to100: '3.5',
  seats: '2',
  color: 'Lunar White',
  priceFrom: '165000',
  description: 'A razor-sharp British sports car with a muscular V8.',
  features: ['Launch control'],
  availabilityNote: '',
};

const firstMessages = (result: {
  success: boolean;
  error?: { issues: { path: PropertyKey[]; message: string }[] };
}) =>
  Object.fromEntries(
    (result.error?.issues ?? [])
      .map(issue => [String(issue.path[0]), issue.message] as const)
      .reverse(),
  );

describe('vehicleSchema', () => {
  it('accepts a complete vehicle with blank optional fields', () => {
    expect(vehicleSchema.safeParse(vehicle).success).toBe(true);
    expect(
      vehicleSchema.safeParse({
        ...vehicle,
        topSpeedKmh: '',
        acceleration0to100: '',
        priceFrom: '',
      }).success,
    ).toBe(true);
  });

  it('mirrors the API rules with clear messages', () => {
    const messages = firstMessages(
      vehicleSchema.safeParse({
        ...vehicle,
        manufacturer: '',
        year: '1985',
        powerHp: '0',
        seats: '12',
        acceleration0to100: '3.456',
        priceFrom: '-5',
        description: 'short',
        color: 'x',
      }),
    );

    expect(messages.manufacturer).toBe('Manufacturer is required');
    expect(messages.year).toMatch(/between 1990/);
    expect(messages.powerHp).toMatch(/between 1 and 3000/);
    expect(messages.seats).toMatch(/between 1 and 9/);
    expect(messages.acceleration0to100).toBe('Use at most two decimal places');
    expect(messages.priceFrom).toMatch(/must be a number/);
    expect(messages.description).toMatch(/at least 10/);
    expect(messages.color).toMatch(/at least 2/);
  });

  it('limits the number of features and their length', () => {
    expect(
      vehicleSchema.safeParse({ ...vehicle, features: Array(21).fill('Heated seats') }).success,
    ).toBe(false);
    expect(vehicleSchema.safeParse({ ...vehicle, features: ['x'.repeat(61)] }).success).toBe(false);
  });

  it('converts form strings to the API payload, using null for blank optional fields', () => {
    const payload = toVehiclePayload({
      ...vehicle,
      topSpeedKmh: '',
      priceFrom: '',
      availabilityNote: '  ',
    });

    expect(payload).toMatchObject({
      year: 2025,
      powerHp: 656,
      seats: 2,
      topSpeedKmh: null,
      acceleration0to100: 3.5,
      priceFrom: null,
      availabilityNote: null,
    });
    expect(toVehiclePayload(vehicle).priceFrom).toBe(165000);
  });
});

describe('dealershipSchema', () => {
  const dealership = {
    name: 'Prestige Mayfair',
    address: '14 Berkeley Square',
    city: 'London',
    phone: '+44 20 7946 1000',
    email: 'Mayfair@Prestige.test',
    openingHours: 'Mon-Fri 09:00-18:00',
    description: '',
  };

  it('accepts a valid dealership and normalises the payload', () => {
    expect(dealershipSchema.safeParse(dealership).success).toBe(true);
    expect(toDealershipPayload(dealership)).toMatchObject({
      email: 'mayfair@prestige.test',
      description: null,
    });
  });

  it('rejects a bad phone, email and short name', () => {
    const messages = firstMessages(
      dealershipSchema.safeParse({ ...dealership, phone: 'abc', email: 'nope', name: 'A' }),
    );
    expect(messages.phone).toBe('Enter a valid phone number');
    expect(messages.email).toBe('Enter a valid email address');
    expect(messages.name).toMatch(/at least 2/);
  });
});

describe('slot schemas', () => {
  const slot = {
    dealershipId: 'd',
    vehicleId: 'v',
    date: '2027-03-01',
    startTime: '09:00',
    endTime: '10:00',
  };

  it('requires the end time to be after the start time', () => {
    expect(slotSchema.safeParse(slot).success).toBe(true);
    expect(firstMessages(slotSchema.safeParse({ ...slot, endTime: '09:00' })).endTime).toMatch(
      /after the start/,
    );
  });

  it('converts local date and time to the matching instant', () => {
    expect(new Date(localToIso('2027-03-01', '09:30')).getTime()).toBe(
      new Date(2027, 2, 1, 9, 30).getTime(),
    );
  });

  const bulk = {
    dealershipId: 'd',
    vehicleId: 'v',
    dateFrom: '2027-03-01',
    dateTo: '2027-03-14',
    daysOfWeek: ['MON', 'TUE'],
    dailyStartTime: '09:00',
    dailyEndTime: '12:00',
    durationMinutes: '60',
    breakMinutes: '30',
  };

  it('validates the bulk generator and builds the payload', () => {
    expect(bulkSchema.safeParse(bulk).success).toBe(true);
    expect(toBulkPayload(bulk, 'Europe/London')).toMatchObject({
      durationMinutes: 60,
      breakMinutes: 30,
      timeZone: 'Europe/London',
    });
    expect(toBulkPayload({ ...bulk, breakMinutes: '' }, 'UTC').breakMinutes).toBe(0);
  });

  it('rejects impossible bulk ranges, times and empty weekday choices', () => {
    expect(firstMessages(bulkSchema.safeParse({ ...bulk, dateTo: '2027-02-01' })).dateTo).toMatch(
      /cannot be before/,
    );
    expect(firstMessages(bulkSchema.safeParse({ ...bulk, dateTo: '2027-09-01' })).dateTo).toMatch(
      /at most 92 days/,
    );
    expect(
      firstMessages(bulkSchema.safeParse({ ...bulk, dailyEndTime: '08:00' })).dailyEndTime,
    ).toMatch(/after the daily start/);
    expect(firstMessages(bulkSchema.safeParse({ ...bulk, daysOfWeek: [] })).daysOfWeek).toMatch(
      /at least one day/,
    );
    expect(
      firstMessages(bulkSchema.safeParse({ ...bulk, durationMinutes: '10' })).durationMinutes,
    ).toMatch(/between 15 and 240/);
  });
});

describe('staffSchema and temporary passwords', () => {
  const staff = {
    firstName: 'Marcus',
    lastName: 'Ashworth',
    email: 'marcus@prestige.test',
    phone: '+44 20 7946 0102',
    password: 'Welcome2026',
  };

  it('applies the password rules', () => {
    expect(staffSchema.safeParse(staff).success).toBe(true);
    expect(
      firstMessages(staffSchema.safeParse({ ...staff, password: 'abcdefgh' })).password,
    ).toMatch(/one number/);
  });

  it('generates passwords that always satisfy the rules', () => {
    let seed = 7;
    const random = (max: number) => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return seed % max;
    };
    for (let index = 0; index < 50; index += 1) {
      const password = generateTemporaryPassword(random);
      expect(password).toHaveLength(14);
      expect(staffSchema.shape.password.safeParse(password).success).toBe(true);
    }
  });
});

describe('image helpers', () => {
  const file = (name: string, type: string, size = 1000) => {
    const instance = new File(['x'], name, { type });
    Object.defineProperty(instance, 'size', { value: size });
    return instance;
  };

  it('accepts JPEG, PNG and WebP within the size limit', () => {
    const result = checkImageFiles(
      [file('a.jpg', 'image/jpeg'), file('b.png', 'image/png'), file('c.webp', 'image/webp')],
      0,
    );
    expect(result.accepted).toHaveLength(3);
    expect(result.rejected).toEqual([]);
  });

  it('rejects other types and oversize files with a reason', () => {
    const result = checkImageFiles(
      [file('a.gif', 'image/gif'), file('big.jpg', 'image/jpeg', 6 * 1024 * 1024)],
      0,
    );
    expect(result.accepted).toEqual([]);
    expect(result.rejected[0].reason).toMatch(/JPEG, PNG or WebP/);
    expect(result.rejected[1].reason).toMatch(/limit is 5.0 MB/);
  });

  it('enforces 8 per upload and 12 per vehicle', () => {
    const many = Array.from({ length: 10 }, (_, index) => file(`${index}.jpg`, 'image/jpeg'));
    expect(checkImageFiles(many, 0).accepted).toHaveLength(8);
    const nearlyFull = checkImageFiles(many, 10);
    expect(nearlyFull.accepted).toHaveLength(2);
    expect(nearlyFull.rejected[0].reason).toMatch(/at most 12 images/);
  });

  it('reorders by returning only the changed sort orders', () => {
    const images = [
      { id: 'a', sortOrder: 0 },
      { id: 'b', sortOrder: 1 },
      { id: 'c', sortOrder: 2 },
    ];
    expect(reorderImages(images, 2, -1)).toEqual([
      { id: 'c', sortOrder: 1 },
      { id: 'b', sortOrder: 2 },
    ]);
    expect(reorderImages(images, 0, -1)).toEqual([]);
    expect(reorderImages(images, 2, 1)).toEqual([]);
  });

  it('copes with sort orders that do not start at zero', () => {
    const updates = reorderImages(
      [
        { id: 'a', sortOrder: 1 },
        { id: 'b', sortOrder: 2 },
      ],
      0,
      1,
    );
    expect(updates).toContainEqual({ id: 'b', sortOrder: 0 });
    expect(updates.find(update => update.id === 'a')?.sortOrder ?? 1).toBe(1);
  });
});
