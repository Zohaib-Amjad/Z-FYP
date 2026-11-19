import { BookingStatus, FuelType, Role, Transmission, VehicleType } from '@prisma/client';

export const DEV_PASSWORD = process.env.SEED_PASSWORD ?? 'Prestige#2026';

export const STAFF = [
  {
    email: 'staff1@prestige.test',
    firstName: 'Eleanor',
    lastName: 'Whitfield',
    phone: '+92 42 3575 0101',
  },
  {
    email: 'staff2@prestige.test',
    firstName: 'Marcus',
    lastName: 'Ashworth',
    phone: '+92 42 3575 0102',
  },
];

export const CUSTOMERS = [
  {
    email: 'amelia.hart@prestige.test',
    firstName: 'Amelia',
    lastName: 'Hart',
    phone: '+92 300 5550111',
    license: 'HART9503126A99XY',
  },
  {
    email: 'oliver.bennett@prestige.test',
    firstName: 'Oliver',
    lastName: 'Bennett',
    phone: '+92 321 5550222',
    license: 'BENNE807154O91AB',
  },
  {
    email: 'sophia.laurent@prestige.test',
    firstName: 'Sophia',
    lastName: 'Laurent',
    phone: '+92 333 5550333',
    license: 'LAURE711236S92CD',
  },
  {
    email: 'james.okafor@prestige.test',
    firstName: 'James',
    lastName: 'Okafor',
    phone: '+92 345 5550444',
    license: 'OKAFO602283J93EF',
  },
  {
    email: 'isabella.rossi@prestige.test',
    firstName: 'Isabella',
    lastName: 'Rossi',
    phone: '+92 312 5550555',
    license: 'ROSSI909304I94GH',
  },
  {
    email: 'henry.caldwell@prestige.test',
    firstName: 'Henry',
    lastName: 'Caldwell',
    phone: '+92 301 5550666',
    license: 'CALDW512117H95IJ',
  },
];

export const DEALERSHIPS = [
  {
    name: 'LuxDrive Gulberg',
    address: '42 Main Boulevard, Gulberg III',
    city: 'Lahore',
    phone: '+92 42 3575 1000',
    email: 'gulberg@luxdrive.test',
    openingHours: 'Mon-Fri 09:00-18:00, Sat 09:00-14:00',
    description:
      'Our flagship showroom on Main Boulevard, with private viewing suites and a dedicated concierge.',
  },
  {
    name: 'LuxDrive Blue Area',
    address: '18 Jinnah Avenue, Blue Area',
    city: 'Islamabad',
    phone: '+92 51 2870 2000',
    email: 'bluearea@luxdrive.test',
    openingHours: 'Mon-Fri 09:00-18:00, Sat 09:00-14:00',
    description: 'A contemporary showroom with curated test-drive routes along the Margalla Hills.',
  },
  {
    name: 'LuxDrive DHA',
    address: '27 Khayaban-e-Shahbaz, DHA Phase 6',
    city: 'Karachi',
    phone: '+92 21 3584 3000',
    email: 'dha@luxdrive.test',
    openingHours: 'Mon-Fri 09:00-17:30, Sat 09:00-13:00',
    description:
      'A refined showroom moments from the Clifton seafront, with coastal test-drive routes.',
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
  /** Verified Pakistani price in PKR, or null to show "Price on request". */
  priceFrom: number | null;
  description: string;
  features: string[];
  /** Paint colour shown as a swatch on the placeholder images; not stored in the database. */
  paintHex: string;
}

export const VEHICLES: VehicleSeed[] = [
  {
    manufacturer: 'Mercedes-Benz',
    model: 'S-Class',
    year: 2025,
    vehicleType: 'SEDAN',
    fuelType: 'PETROL',
    transmission: 'AUTOMATIC',
    engine: '3.0L inline-six turbo with EQ Boost (S 450 4MATIC)',
    powerHp: 367,
    topSpeedKmh: 250,
    acceleration0to100: 5.1,
    seats: 5,
    color: 'Selenite Grey',
    priceFrom: 155000000,
    description:
      'The flagship saloon in its purest petrol form: whisper-quiet, beautifully finished and composed at any speed.',
    features: [
      'MBUX Hyperscreen',
      'Burmester 3D surround sound',
      'Airmatic air suspension',
      'Energising comfort seats',
      'Ambient lighting with 64 colours',
    ],
    paintHex: '#6c6e70',
  },
  {
    manufacturer: 'Porsche',
    model: '911 Carrera',
    year: 2025,
    vehicleType: 'COUPE',
    fuelType: 'PETROL',
    transmission: 'DUAL_CLUTCH',
    engine: '3.0L twin-turbo flat-six',
    powerHp: 394,
    topSpeedKmh: 294,
    acceleration0to100: 4.1,
    seats: 4,
    color: 'Guards Red',
    priceFrom: null,
    description:
      'The definitive sports car, as usable on a weekday commute as it is thrilling on an open mountain road.',
    features: [
      'Eight-speed PDK gearbox',
      'Sport Chrono package',
      'Porsche Active Suspension Management',
      'Bose surround sound',
      'LED Matrix headlights',
    ],
    paintHex: '#b3121a',
  },
  {
    manufacturer: 'Audi',
    model: 'e-tron GT',
    year: 2025,
    vehicleType: 'COUPE',
    fuelType: 'ELECTRIC',
    transmission: 'AUTOMATIC',
    engine: 'Dual electric motors, 97 kWh battery',
    powerHp: 523,
    topSpeedKmh: 245,
    acceleration0to100: 4.0,
    seats: 4,
    color: 'Tactical Green',
    priceFrom: 44000000,
    description:
      'Low, wide and quietly devastating: an electric grand tourer with the poise of a sports car.',
    features: [
      'quattro all-wheel drive',
      'Adaptive air suspension',
      '800-volt fast charging',
      'Bang & Olufsen sound',
      'Panoramic glass roof',
    ],
    paintHex: '#3e4a3d',
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
    priceFrom: null,
    description:
      'Hand-crafted in Crewe, the Speed marries a thunderous W12 with a cabin of diamond-quilted leather and open-pore veneer.',
    features: [
      'Rotating display dashboard',
      'Naim for Bentley audio',
      'Bentley Dynamic Ride',
      'Diamond-quilted leather',
      'All-wheel steering',
    ],
    paintHex: '#2f4a3a',
  },
  {
    manufacturer: 'Land Rover',
    model: 'Range Rover Sport',
    year: 2025,
    vehicleType: 'SUV',
    fuelType: 'DIESEL',
    transmission: 'AUTOMATIC',
    engine: '3.0L inline-six turbo diesel',
    powerHp: 350,
    topSpeedKmh: 234,
    acceleration0to100: 5.9,
    seats: 5,
    color: 'Varesine Blue',
    priceFrom: null,
    description:
      'Sharper and more dynamic than its larger sibling, equally at home on city streets and northern mountain passes.',
    features: [
      'Terrain Response 2',
      'Dynamic air suspension',
      'Meridian surround sound',
      'Pivi Pro infotainment',
      'Cabin air purification',
    ],
    paintHex: '#1f2c44',
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
    priceFrom: null,
    description:
      'Post-opulent minimalism with a Magic Carpet Ride, whisper-quiet cabin and a Starlight Headliner.',
    features: [
      'Starlight Headliner',
      'Planar suspension system',
      'Coach doors',
      'Bespoke audio',
      'Illuminated Pantheon grille',
    ],
    paintHex: '#f1f1ee',
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
    priceFrom: null,
    description:
      'La Nuova Dolce Vita, a soft-top Ferrari that blends effortless style with a spine-tingling V8 soundtrack.',
    features: [
      'Retractable fabric roof',
      'Eight-speed dual-clutch gearbox',
      'Magnetorheological dampers',
      'Passenger display',
      'Carbon-ceramic brakes',
    ],
    paintHex: '#c1121f',
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
    priceFrom: null,
    description:
      'The super SUV reimagined with plug-in hybrid power, delivering supercar performance with everyday usability.',
    features: [
      'Torque vectoring',
      'Active roll stabilisation',
      'ANIMA drive modes',
      'Carbon-ceramic brakes',
      'Bang & Olufsen 3D audio',
    ],
    paintHex: '#e8b10c',
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
    priceFrom: null,
    description:
      'A razor-sharp British sports car with a muscular V8 and a cabin finished in hand-stitched leather.',
    features: [
      'Electronic rear differential',
      'Adaptive damping',
      'Carbon-fibre seats',
      'Bowers & Wilkins audio',
      'Launch control',
    ],
    paintHex: '#e9e8e2',
  },
  {
    manufacturer: 'Lexus',
    model: 'LX 600',
    year: 2025,
    vehicleType: 'SUV',
    fuelType: 'PETROL',
    transmission: 'AUTOMATIC',
    engine: '3.4L twin-turbo V6',
    powerHp: 409,
    topSpeedKmh: 210,
    acceleration0to100: 7.2,
    seats: 7,
    color: 'Sonic Quartz',
    priceFrom: null,
    description:
      'Legendary go-anywhere toughness wrapped in hand-crafted Lexus luxury, with room for seven in comfort.',
    features: [
      'Full-time four-wheel drive',
      'Adaptive variable suspension',
      'Mark Levinson surround sound',
      'Three-row seating',
      'Multi-terrain monitor',
    ],
    paintHex: '#ecebe7',
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
    priceFrom: null,
    description:
      'The Trident enters the electric era with a graceful SUV that retains Maserati character and Italian craftsmanship.',
    features: [
      '800-volt architecture',
      'Air suspension',
      'Sonus faber audio',
      'Maserati Intelligent Assistant',
      'Matrix LED headlights',
    ],
    paintHex: '#5a5c5e',
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
    priceFrom: null,
    description:
      'The most powerful production four-cylinder in the world, packaged in a compact and endlessly thrilling hatchback.',
    features: [
      'AMG Performance 4MATIC+',
      'Drift Mode',
      'AMG Track Pace',
      'Performance seats',
      'Burmester surround sound',
    ],
    paintHex: '#7a1e24',
  },
  {
    manufacturer: 'BMW',
    model: 'X5',
    year: 2025,
    vehicleType: 'SUV',
    fuelType: 'HYBRID',
    transmission: 'AUTOMATIC',
    engine: '3.0L inline-six turbo with electric motor',
    powerHp: 483,
    topSpeedKmh: 250,
    acceleration0to100: 4.8,
    seats: 5,
    color: 'Mineral White',
    priceFrom: 89000000,
    description:
      'The athletic family SUV, now able to glide through town on electric power alone before the six-cylinder takes over.',
    features: [
      'xDrive all-wheel drive',
      'BMW Curved Display',
      'Harman Kardon surround sound',
      'Panoramic glass roof',
      'Parking Assistant Plus',
    ],
    paintHex: '#e8e8e4',
  },
  {
    manufacturer: 'Toyota',
    model: 'Land Cruiser 300',
    year: 2025,
    vehicleType: 'SUV',
    fuelType: 'PETROL',
    transmission: 'AUTOMATIC',
    engine: '3.5L twin-turbo V6',
    powerHp: 409,
    topSpeedKmh: 210,
    acceleration0to100: 6.7,
    seats: 7,
    color: 'Precious White Pearl',
    priceFrom: 106000000,
    description:
      'The go-anywhere icon, rebuilt on a lighter frame with a refined cabin and the toughness that made its name.',
    features: [
      'Full-time four-wheel drive',
      'Multi-Terrain Select',
      'JBL premium sound',
      'Three-row seating',
      'Cool box and rear entertainment',
    ],
    paintHex: '#f1f0ea',
  },
  {
    manufacturer: 'Volvo',
    model: 'XC90',
    year: 2025,
    vehicleType: 'SUV',
    fuelType: 'PLUG_IN_HYBRID',
    transmission: 'AUTOMATIC',
    engine: '2.0L four-cylinder turbo with electric motor',
    powerHp: 455,
    topSpeedKmh: 180,
    acceleration0to100: 5.4,
    seats: 7,
    color: 'Denim Blue',
    priceFrom: null,
    description:
      'Calm Scandinavian luxury for seven, with quiet electric running in town and a cabin finished in natural materials.',
    features: [
      'All-wheel drive',
      'Bowers & Wilkins sound',
      'Air suspension',
      'Orrefors crystal gear selector',
      'Pilot Assist',
    ],
    paintHex: '#2e4057',
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
    customerNote: 'Interested in the PDK gearbox before placing an order.',
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
    customerNote: 'Evaluating the S-Class as a daily executive car.',
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
    customerNote: 'Interested in the W12 on a long run; I drive about 100 km a day.',
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
