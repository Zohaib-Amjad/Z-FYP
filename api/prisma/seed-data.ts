import { BookingStatus, FuelType, Role, Transmission, VehicleType } from '@prisma/client';

export const DEV_PASSWORD = process.env.SEED_PASSWORD ?? 'Prestige#2026';

export const STAFF = [
  {
    email: 'staff1@prestige.test',
    firstName: 'Eleanor',
    lastName: 'Whitfield',
    phone: '+44 20 7946 0101',
  },
  {
    email: 'staff2@prestige.test',
    firstName: 'Marcus',
    lastName: 'Ashworth',
    phone: '+44 20 7946 0102',
  },
];

export const CUSTOMERS = [
  {
    email: 'amelia.hart@prestige.test',
    firstName: 'Amelia',
    lastName: 'Hart',
    phone: '+44 7700 900111',
    license: 'HART9503126A99XY',
  },
  {
    email: 'oliver.bennett@prestige.test',
    firstName: 'Oliver',
    lastName: 'Bennett',
    phone: '+44 7700 900222',
    license: 'BENNE807154O91AB',
  },
  {
    email: 'sophia.laurent@prestige.test',
    firstName: 'Sophia',
    lastName: 'Laurent',
    phone: '+44 7700 900333',
    license: 'LAURE711236S92CD',
  },
  {
    email: 'james.okafor@prestige.test',
    firstName: 'James',
    lastName: 'Okafor',
    phone: '+44 7700 900444',
    license: 'OKAFO602283J93EF',
  },
  {
    email: 'isabella.rossi@prestige.test',
    firstName: 'Isabella',
    lastName: 'Rossi',
    phone: '+44 7700 900555',
    license: 'ROSSI909304I94GH',
  },
  {
    email: 'henry.caldwell@prestige.test',
    firstName: 'Henry',
    lastName: 'Caldwell',
    phone: '+44 7700 900666',
    license: 'CALDW512117H95IJ',
  },
];

export const DEALERSHIPS = [
  {
    name: 'Prestige Mayfair',
    address: '14 Berkeley Square, Mayfair',
    city: 'London',
    phone: '+44 20 7946 1000',
    email: 'mayfair@prestige.test',
    openingHours: 'Mon-Fri 09:00-18:00, Sat 09:00-14:00',
    description:
      'Our flagship showroom in the heart of Mayfair, with private viewing suites and a dedicated concierge.',
  },
  {
    name: 'Prestige Deansgate',
    address: '82 Deansgate',
    city: 'Manchester',
    phone: '+44 161 496 2000',
    email: 'deansgate@prestige.test',
    openingHours: 'Mon-Fri 09:00-18:00, Sat 09:00-14:00',
    description:
      'A contemporary showroom offering curated drives through the Cheshire countryside.',
  },
  {
    name: 'Prestige Edinburgh',
    address: '9 Charlotte Square',
    city: 'Edinburgh',
    phone: '+44 131 496 3000',
    email: 'edinburgh@prestige.test',
    openingHours: 'Mon-Fri 09:00-17:30, Sat 09:00-13:00',
    description:
      'A refined Georgian-townhouse showroom with scenic test-drive routes across the Lothians.',
  },
];

export interface VehicleSeed {
  manufacturer: string;
  model: string;
  year: number;
  vehicleType: VehicleType;
  fuelType: FuelType;
  transmission: Transmission;
  engine: string;
  powerHp: number;
  topSpeedKmh: number;
  acceleration0to100: number;
  seats: number;
  color: string;
  priceFrom: number;
  description: string;
  features: string[];
  hues: [number, number];
}

export const VEHICLES: VehicleSeed[] = [
  {
    manufacturer: 'Mercedes-Benz',
    model: 'S 580 e',
    year: 2025,
    vehicleType: 'SEDAN',
    fuelType: 'PLUG_IN_HYBRID',
    transmission: 'AUTOMATIC',
    engine: '3.0L inline-six turbo with electric motor',
    powerHp: 510,
    topSpeedKmh: 250,
    acceleration0to100: 4.8,
    seats: 5,
    color: 'Obsidian Black',
    priceFrom: 128000,
    description:
      'The benchmark for rear-seat refinement, pairing near-silent electric running with effortless long-distance poise.',
    features: [
      'Executive rear seating',
      'Burmester 4D surround sound',
      'Air Body Control suspension',
      'Digital Light headlights',
      'Rear-axle steering',
    ],
    hues: [220, 250],
  },
  {
    manufacturer: 'Porsche',
    model: '911 Carrera T',
    year: 2025,
    vehicleType: 'COUPE',
    fuelType: 'PETROL',
    transmission: 'MANUAL',
    engine: '3.0L twin-turbo flat-six',
    powerHp: 389,
    topSpeedKmh: 295,
    acceleration0to100: 4.5,
    seats: 4,
    color: 'Gentian Blue',
    priceFrom: 112000,
    description:
      'A purist 911 with a seven-speed manual gearbox, lightweight glazing and a pared-back, driver-focused cabin.',
    features: [
      'Seven-speed manual gearbox',
      'Sport Chrono package',
      'Porsche Active Suspension Management',
      'Sports exhaust',
      'Lightweight glass',
    ],
    hues: [210, 235],
  },
  {
    manufacturer: 'Audi',
    model: 'RS e-tron GT',
    year: 2025,
    vehicleType: 'GRAND_TOURER',
    fuelType: 'ELECTRIC',
    transmission: 'AUTOMATIC',
    engine: 'Dual permanent-magnet electric motors',
    powerHp: 637,
    topSpeedKmh: 250,
    acceleration0to100: 3.3,
    seats: 4,
    color: 'Daytona Grey',
    priceFrom: 134000,
    description:
      'A sculpted electric grand tourer delivering supercar acceleration with a calm, beautifully finished interior.',
    features: [
      '800-volt fast charging',
      'Adaptive air suspension',
      'Matrix LED laser lights',
      'Bang & Olufsen 3D sound',
      'Carbon roof',
    ],
    hues: [200, 225],
  },
  {
    manufacturer: 'Bentley',
    model: 'Continental GT Speed',
    year: 2025,
    vehicleType: 'GRAND_TOURER',
    fuelType: 'PETROL',
    transmission: 'DUAL_CLUTCH',
    engine: '6.0L twin-turbo W12',
    powerHp: 650,
    topSpeedKmh: 335,
    acceleration0to100: 3.6,
    seats: 4,
    color: 'Verdant Green',
    priceFrom: 245000,
    description:
      'Hand-crafted in Crewe, the Speed marries a thunderous W12 with a cabin of diamond-quilted leather and open-pore veneer.',
    features: [
      'Rotating display dashboard',
      'Naim for Bentley audio',
      'Bentley Dynamic Ride',
      'Diamond-quilted leather',
      'All-wheel steering',
    ],
    hues: [150, 175],
  },
  {
    manufacturer: 'Land Rover',
    model: 'Range Rover Autobiography',
    year: 2025,
    vehicleType: 'SUV',
    fuelType: 'DIESEL',
    transmission: 'AUTOMATIC',
    engine: '3.0L inline-six mild-hybrid diesel',
    powerHp: 350,
    topSpeedKmh: 234,
    acceleration0to100: 6.1,
    seats: 5,
    color: 'Santorini Black',
    priceFrom: 148000,
    description:
      'The definitive luxury SUV, combining serene refinement on the road with legendary capability off it.',
    features: [
      'Executive Class rear seats',
      'Meridian Signature sound',
      'Terrain Response 2',
      'Four-zone climate control',
      'Panoramic roof',
    ],
    hues: [30, 55],
  },
  {
    manufacturer: 'Rolls-Royce',
    model: 'Ghost',
    year: 2025,
    vehicleType: 'SEDAN',
    fuelType: 'PETROL',
    transmission: 'AUTOMATIC',
    engine: '6.75L twin-turbo V12',
    powerHp: 563,
    topSpeedKmh: 250,
    acceleration0to100: 4.8,
    seats: 5,
    color: 'Arctic White',
    priceFrom: 275000,
    description:
      'Post-opulent minimalism with a Magic Carpet Ride, whisper-quiet cabin and a Starlight Headliner.',
    features: [
      'Starlight Headliner',
      'Planar suspension system',
      'Coach doors',
      'Bespoke audio',
      'Illuminated Pantheon grille',
    ],
    hues: [260, 285],
  },
  {
    manufacturer: 'Ferrari',
    model: 'Roma Spider',
    year: 2025,
    vehicleType: 'CONVERTIBLE',
    fuelType: 'PETROL',
    transmission: 'DUAL_CLUTCH',
    engine: '3.9L twin-turbo V8',
    powerHp: 612,
    topSpeedKmh: 320,
    acceleration0to100: 3.4,
    seats: 2,
    color: 'Rosso Corsa',
    priceFrom: 230000,
    description:
      'La Nuova Dolce Vita, a soft-top Ferrari that blends effortless style with a spine-tingling V8 soundtrack.',
    features: [
      'Retractable fabric roof',
      'Eight-speed dual-clutch gearbox',
      'Magnetorheological dampers',
      'Passenger display',
      'Carbon-ceramic brakes',
    ],
    hues: [0, 15],
  },
  {
    manufacturer: 'Lamborghini',
    model: 'Urus SE',
    year: 2025,
    vehicleType: 'SUV',
    fuelType: 'PLUG_IN_HYBRID',
    transmission: 'AUTOMATIC',
    engine: '4.0L twin-turbo V8 plug-in hybrid',
    powerHp: 789,
    topSpeedKmh: 312,
    acceleration0to100: 3.4,
    seats: 5,
    color: 'Giallo Auge',
    priceFrom: 235000,
    description:
      'The super SUV reimagined with plug-in hybrid power, delivering supercar performance with everyday usability.',
    features: [
      'Torque vectoring',
      'Active roll stabilisation',
      'ANIMA drive modes',
      'Carbon-ceramic brakes',
      'Bang & Olufsen 3D audio',
    ],
    hues: [45, 60],
  },
  {
    manufacturer: 'Aston Martin',
    model: 'Vantage',
    year: 2025,
    vehicleType: 'SPORTS',
    fuelType: 'PETROL',
    transmission: 'AUTOMATIC',
    engine: '4.0L twin-turbo V8',
    powerHp: 656,
    topSpeedKmh: 325,
    acceleration0to100: 3.5,
    seats: 2,
    color: 'Lunar White',
    priceFrom: 165000,
    description:
      'A razor-sharp British sports car with a muscular V8 and a cabin finished in hand-stitched leather.',
    features: [
      'Electronic rear differential',
      'Adaptive damping',
      'Carbon-fibre seats',
      'Bowers & Wilkins audio',
      'Launch control',
    ],
    hues: [170, 195],
  },
  {
    manufacturer: 'Lexus',
    model: 'LM 350h',
    year: 2025,
    vehicleType: 'MPV',
    fuelType: 'HYBRID',
    transmission: 'AUTOMATIC',
    engine: '2.5L four-cylinder self-charging hybrid',
    powerHp: 250,
    topSpeedKmh: 190,
    acceleration0to100: 8.7,
    seats: 4,
    color: 'Sonic Titanium',
    priceFrom: 118000,
    description:
      'A first-class lounge on wheels, with captain seats, a privacy partition and exceptional rear-cabin serenity.',
    features: [
      'Four-seat executive layout',
      '48-inch rear display',
      'Mark Levinson audio',
      'Privacy partition',
      'Powered sliding doors',
    ],
    hues: [275, 300],
  },
  {
    manufacturer: 'Maserati',
    model: 'Grecale Folgore',
    year: 2025,
    vehicleType: 'SUV',
    fuelType: 'ELECTRIC',
    transmission: 'AUTOMATIC',
    engine: 'Dual electric motors',
    powerHp: 550,
    topSpeedKmh: 220,
    acceleration0to100: 4.1,
    seats: 5,
    color: 'Grigio Incognito',
    priceFrom: 112000,
    description:
      'The Trident enters the electric era with a graceful SUV that retains Maserati character and Italian craftsmanship.',
    features: [
      '800-volt architecture',
      'Air suspension',
      'Sonus faber audio',
      'Maserati Intelligent Assistant',
      'Matrix LED headlights',
    ],
    hues: [225, 245],
  },
  {
    manufacturer: 'Mercedes-AMG',
    model: 'A 45 S 4MATIC+',
    year: 2025,
    vehicleType: 'HATCHBACK',
    fuelType: 'PETROL',
    transmission: 'DUAL_CLUTCH',
    engine: '2.0L turbocharged four-cylinder',
    powerHp: 421,
    topSpeedKmh: 270,
    acceleration0to100: 3.9,
    seats: 5,
    color: 'Patagonia Red',
    priceFrom: 68000,
    description:
      'The most powerful production four-cylinder in the world, packaged in a compact and endlessly thrilling hatchback.',
    features: [
      'AMG Performance 4MATIC+',
      'Drift Mode',
      'AMG Track Pace',
      'Performance seats',
      'Burmester surround sound',
    ],
    hues: [350, 10],
  },
];

export interface SampleStep {
  to: BookingStatus;
  action: string;
  by: 'customer' | 'staff';
  note: string;
}

export interface SampleBooking {
  customer: number;
  vehicle: number;
  days: number;
  hour: number;
  rescheduleTo?: { days: number; hour: number };
  customerNote: string;
  steps: SampleStep[];
  staffNote?: string;
  rejectionReason?: string;
  cancellationReason?: string;
  cancelledBy?: Role;
  unread?: boolean;
}

const created = (note: string): SampleStep => ({
  to: 'PENDING',
  action: 'CREATED',
  by: 'customer',
  note,
});

export const SAMPLE_BOOKINGS: SampleBooking[] = [
  {
    customer: 0,
    vehicle: 0,
    days: 3,
    hour: 10,
    unread: true,
    customerNote: 'I would like to experience the rear-seat comfort on a motorway route.',
    steps: [created('Test-drive request submitted.')],
  },
  {
    customer: 1,
    vehicle: 1,
    days: 4,
    hour: 11,
    unread: true,
    customerNote: 'Interested in the manual gearbox before placing an order.',
    steps: [
      created('Test-drive request submitted.'),
      {
        to: 'APPROVED',
        action: 'APPROVED',
        by: 'staff',
        note: 'Confirmed. A product specialist will meet you at reception.',
      },
    ],
  },
  {
    customer: 2,
    vehicle: 2,
    days: 5,
    hour: 14,
    unread: true,
    customerNote: 'Keen to try the electric grand tourer.',
    rejectionReason:
      'The vehicle is reserved for a press event on this date. Please choose another time.',
    steps: [
      created('Test-drive request submitted.'),
      {
        to: 'REJECTED',
        action: 'REJECTED',
        by: 'staff',
        note: 'The vehicle is reserved for a press event on this date. Please choose another time.',
      },
    ],
  },
  {
    customer: 3,
    vehicle: 3,
    days: 6,
    hour: 15,
    unread: true,
    customerNote: 'Weekend trip planning.',
    cancellationReason: 'My travel plans have changed.',
    cancelledBy: 'CUSTOMER',
    steps: [
      created('Test-drive request submitted.'),
      {
        to: 'CANCELLED',
        action: 'CANCELLED',
        by: 'customer',
        note: 'My travel plans have changed.',
      },
    ],
  },
  {
    customer: 0,
    vehicle: 4,
    days: 3,
    hour: 13,
    rescheduleTo: { days: 5, hour: 13 },
    unread: true,
    customerNote: 'Would like to test the off-road capability.',
    staffNote: 'Moved to a later date after a scheduled vehicle service.',
    steps: [
      created('Test-drive request submitted.'),
      {
        to: 'RESCHEDULED',
        action: 'RESCHEDULED',
        by: 'staff',
        note: 'Moved to a later date after a scheduled vehicle service.',
      },
    ],
  },
  {
    customer: 4,
    vehicle: 5,
    days: -2,
    hour: 10,
    customerNote: 'Considering the Ghost for chauffeur use.',
    steps: [
      created('Test-drive request submitted.'),
      {
        to: 'APPROVED',
        action: 'APPROVED',
        by: 'staff',
        note: 'Approved. We look forward to welcoming you.',
      },
    ],
  },
  {
    customer: 1,
    vehicle: 6,
    days: -5,
    hour: 11,
    customerNote: 'A summer coastal drive with the roof down.',
    staffNote: 'Customer enjoyed the drive and requested a brochure.',
    steps: [
      created('Test-drive request submitted.'),
      { to: 'APPROVED', action: 'APPROVED', by: 'staff', note: 'Approved.' },
      { to: 'COMPLETED', action: 'COMPLETED', by: 'staff', note: 'Test drive completed.' },
    ],
  },
  {
    customer: 5,
    vehicle: 7,
    days: -7,
    hour: 14,
    customerNote: 'Interested in the hybrid performance figures.',
    cancellationReason: 'The vehicle required an urgent workshop inspection.',
    cancelledBy: 'STAFF',
    steps: [
      created('Test-drive request submitted.'),
      {
        to: 'CANCELLED',
        action: 'CANCELLED',
        by: 'staff',
        note: 'The vehicle required an urgent workshop inspection.',
      },
    ],
  },
  {
    customer: 2,
    vehicle: 0,
    days: -9,
    hour: 10,
    customerNote: 'Evaluating the plug-in hybrid range.',
    steps: [
      created('Test-drive request submitted.'),
      { to: 'APPROVED', action: 'APPROVED', by: 'staff', note: 'Approved.' },
      { to: 'COMPLETED', action: 'COMPLETED', by: 'staff', note: 'Test drive completed.' },
    ],
  },
  {
    customer: 5,
    vehicle: 8,
    days: 2,
    hour: 12,
    unread: true,
    customerNote: 'Would like to drive the Vantage on a mix of road types.',
    steps: [created('Test-drive request submitted.')],
  },
  {
    customer: 3,
    vehicle: 3,
    days: 7,
    hour: 11,
    customerNote: 'Interested in the hybrid drivetrain; I commute about 60 miles a day.',
    steps: [created('Test-drive request submitted.')],
  },
  {
    customer: 4,
    vehicle: 5,
    days: 8,
    hour: 14,
    unread: true,
    customerNote: 'Please let me compare the ride quality with my current coupe.',
    steps: [created('Test-drive request submitted.')],
  },
];
