import fs from 'fs';
import path from 'path';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { uploadsDir } from '../src/config/paths';
import { disconnectPrisma, prisma } from '../src/config/prisma';
import { authCookie } from './helpers/auth';
import { resetDatabase, seedMinimalData } from './helpers/db';
import { jpegBuffer, pngBuffer, textBuffer, webpBuffer } from './helpers/images';

let app: ReturnType<typeof createApp>;
let data: Awaited<ReturnType<typeof seedMinimalData>>;
let staffCookie: string;

beforeEach(async () => {
  app = createApp();
  await resetDatabase();
  fs.rmSync(path.join(uploadsDir, 'vehicles'), { recursive: true, force: true });
  data = await seedMinimalData();
  staffCookie = authCookie(data.staff);
});

afterAll(async () => {
  await resetDatabase();
  fs.rmSync(path.join(uploadsDir, 'vehicles'), { recursive: true, force: true });
  await disconnectPrisma();
});

interface Part {
  buffer: Buffer;
  filename: string;
  contentType: string;
}
const png = (filename = 'front.png'): Part => ({
  buffer: pngBuffer(),
  filename,
  contentType: 'image/png',
});

const upload = (
  parts: Part[],
  field = 'images',
  fields: Record<string, string> = {},
  cookie = staffCookie,
  vehicleId = data.vehicle.id,
) => {
  const req = request(app).post(`/api/admin/vehicles/${vehicleId}/images`).set('Cookie', cookie);
  for (const [key, value] of Object.entries(fields)) req.field(key, value);
  for (const part of parts) {
    req.attach(field, part.buffer, { filename: part.filename, contentType: part.contentType });
  }
  return req;
};

const imageRows = (vehicleId = data.vehicle.id) =>
  prisma.vehicleImage.findMany({ where: { vehicleId }, orderBy: [{ sortOrder: 'asc' }] });
const filesOnDisk = (vehicleId = data.vehicle.id): string[] => {
  const dir = path.join(uploadsDir, 'vehicles', vehicleId);
  return fs.existsSync(dir) ? fs.readdirSync(dir) : [];
};
const expectExactlyOnePrimary = async (): Promise<void> => {
  const rows = await imageRows();
  if (rows.length > 0) expect(rows.filter(r => r.isPrimary)).toHaveLength(1);
};

describe('POST /api/admin/vehicles/:id/images', () => {
  it('stores a valid image under a random name and serves it', async () => {
    const res = await upload([png('../../evil name.png')]);

    expect(res.status).toBe(201);
    expect(res.body.data).toHaveLength(1);
    const [image] = res.body.data;
    expect(image.url).toMatch(
      new RegExp(`^/uploads/vehicles/${data.vehicle.id}/[0-9a-f-]{36}\\.png$`),
    );
    expect(image.url).not.toContain('evil');
    expect(filesOnDisk()).toHaveLength(1);

    const served = await request(app).get(image.url);
    expect(served.status).toBe(200);
    expect(served.headers['content-type']).toBe('image/png');
    expect(served.headers['x-content-type-options']).toBe('nosniff');
  });

  it('makes the first image primary and later ones not', async () => {
    const first = await upload([png()]);
    const second = await upload([png('side.png')]);

    expect(first.body.data[0].isPrimary).toBe(true);
    expect(second.body.data).toHaveLength(2);
    expect(second.body.data.filter((i: { isPrimary: boolean }) => i.isPrimary)).toHaveLength(1);
    expect(second.body.data[0].id).toBe(first.body.data[0].id);
    await expectExactlyOnePrimary();
  });

  it('accepts several JPEG, PNG and WebP files in one request, in order', async () => {
    const res = await upload([
      png('a.png'),
      { buffer: jpegBuffer(), filename: 'b.jpg', contentType: 'image/jpeg' },
      { buffer: webpBuffer(), filename: 'c.webp', contentType: 'image/webp' },
    ]);

    expect(res.status).toBe(201);
    expect(res.body.data.map((i: { url: string }) => path.extname(i.url))).toEqual([
      '.png',
      '.jpg',
      '.webp',
    ]);
    expect(res.body.data.map((i: { isPrimary: boolean }) => i.isPrimary)).toEqual([
      true,
      false,
      false,
    ]);
    const orders = res.body.data.map((i: { sortOrder: number }) => i.sortOrder);
    expect([...orders].sort((a, b) => a - b)).toEqual(orders);
    expect(filesOnDisk()).toHaveLength(3);
  });

  it('defaults the alt text from the model name, or uses the one supplied', async () => {
    const defaulted = await upload([png()]);
    const custom = await upload([png('b.png')], 'images', { altText: 'Rear three-quarter view' });

    expect(defaulted.body.data[0].altText).toBe('Porsche 911 Carrera T');
    expect(custom.body.data[1].altText).toBe('Rear three-quarter view');
  });

  it('rejects a file with a disallowed mime type', async () => {
    const res = await upload([
      { buffer: textBuffer(), filename: 'notes.txt', contentType: 'text/plain' },
    ]);

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('UPLOAD_INVALID');
    expect(res.body.error.message).toContain('JPEG, PNG and WebP');
    expect(filesOnDisk()).toHaveLength(0);
  });

  it('rejects an allowed mime type whose content is not an image', async () => {
    const res = await upload([
      { buffer: textBuffer(), filename: 'fake.png', contentType: 'image/png' },
    ]);

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('UPLOAD_INVALID');
    expect(res.body.error.message).toContain('fake.png');
    expect(await prisma.vehicleImage.count()).toBe(0);
  });

  it('rejects content whose signature disagrees with the declared mime type', async () => {
    const res = await upload([
      { buffer: pngBuffer(), filename: 'actually-png.jpg', contentType: 'image/jpeg' },
    ]);

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('UPLOAD_INVALID');
  });

  it('rejects a script disguised as an image', async () => {
    const res = await upload([
      {
        buffer: Buffer.from('<script>alert(1)</script>'),
        filename: 'x.svg',
        contentType: 'image/svg+xml',
      },
    ]);

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('UPLOAD_INVALID');
  });

  it('rejects files over the size limit and stores nothing', async () => {
    const tooLarge: Part = {
      buffer: pngBuffer(5 * 1024 * 1024),
      filename: 'huge.png',
      contentType: 'image/png',
    };
    const res = await upload([png('ok.png'), tooLarge]);

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('UPLOAD_INVALID');
    expect(res.body.error.message).toContain('5 MB');
    expect(filesOnDisk()).toHaveLength(0);
    expect(await prisma.vehicleImage.count()).toBe(0);
  });

  it('accepts a file just under the size limit', async () => {
    const res = await upload([
      { buffer: pngBuffer(5 * 1024 * 1024 - 100), filename: 'big.png', contentType: 'image/png' },
    ]);

    expect(res.status).toBe(201);
  });

  it('rejects more than 8 files in one request', async () => {
    const res = await upload(Array.from({ length: 9 }, (_, i) => png(`${i}.png`)));

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('UPLOAD_INVALID');
    expect(filesOnDisk()).toHaveLength(0);
  });

  it('rejects files sent under the wrong field name', async () => {
    const res = await upload([png()], 'photos');

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('UPLOAD_INVALID');
    expect(res.body.error.message).toContain('"images"');
  });

  it('rejects a request without files', async () => {
    const res = await request(app)
      .post(`/api/admin/vehicles/${data.vehicle.id}/images`)
      .set('Cookie', staffCookie);

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('UPLOAD_INVALID');
  });

  it('rejects a JSON body sent instead of multipart form data', async () => {
    const res = await request(app)
      .post(`/api/admin/vehicles/${data.vehicle.id}/images`)
      .set('Cookie', staffCookie)
      .send({ images: 'nope' });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details.map((d: { field: string }) => d.field)).toEqual(['images']);
    expect(await prisma.vehicleImage.count()).toBe(0);
  });

  it('allows at most 12 images per vehicle and stores nothing from a request that would exceed it', async () => {
    await upload(Array.from({ length: 8 }, (_, i) => png(`${i}.png`)));
    await upload(Array.from({ length: 4 }, (_, i) => png(`b${i}.png`)));
    expect(await prisma.vehicleImage.count()).toBe(12);

    const res = await upload([png('extra.png')]);

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('UPLOAD_INVALID');
    expect(res.body.error.message).toContain('at most 12');
    expect(await prisma.vehicleImage.count()).toBe(12);
    expect(filesOnDisk()).toHaveLength(12);
    await expectExactlyOnePrimary();
  });

  it('removes the files written by a request that fails the 12-image limit', async () => {
    await upload(Array.from({ length: 8 }, (_, i) => png(`${i}.png`)));
    await upload(Array.from({ length: 3 }, (_, i) => png(`b${i}.png`)));
    const res = await upload([png('x.png'), png('y.png')]);

    expect(res.status).toBe(422);
    expect(filesOnDisk()).toHaveLength(11);
  });

  it('returns 404 for an unknown vehicle without saving files', async () => {
    const res = await upload(
      [png()],
      'images',
      {},
      staffCookie,
      '0bbe7e55-75e7-4355-b1e3-af30b7b9ee11',
    );

    expect(res.status).toBe(404);
    expect(filesOnDisk('0bbe7e55-75e7-4355-b1e3-af30b7b9ee11')).toHaveLength(0);
  });

  it('is restricted to staff', async () => {
    const asCustomer = await upload([png()], 'images', {}, authCookie(data.customer));
    const anonymous = await request(app)
      .post(`/api/admin/vehicles/${data.vehicle.id}/images`)
      .attach('images', pngBuffer(), { filename: 'a.png', contentType: 'image/png' });

    expect(asCustomer.status).toBe(403);
    expect(anonymous.status).toBe(401);
    expect(filesOnDisk()).toHaveLength(0);
  });

  it('is shown in the vehicle detail in display order', async () => {
    await upload([png('a.png'), png('b.png')]);
    const res = await request(app)
      .get(`/api/admin/vehicles/${data.vehicle.id}`)
      .set('Cookie', staffCookie);

    expect(res.body.data.images).toHaveLength(2);
    expect(res.body.data.images[0].isPrimary).toBe(true);
  });
});

describe('PATCH /api/admin/vehicles/:id/images/:imageId', () => {
  const patch = (imageId: string, body: object, vehicleId = data.vehicle.id) =>
    request(app)
      .patch(`/api/admin/vehicles/${vehicleId}/images/${imageId}`)
      .set('Cookie', staffCookie)
      .send(body);
  let ids: string[];

  beforeEach(async () => {
    const res = await upload([png('a.png'), png('b.png'), png('c.png')]);
    ids = res.body.data.map((i: { id: string }) => i.id);
  });

  it('updates the alt text and sort order', async () => {
    const res = await patch(ids[1], { altText: 'Cockpit', sortOrder: 0 });

    expect(res.status).toBe(200);
    expect(res.body.data[0]).toMatchObject({ id: ids[1], altText: 'Cockpit', sortOrder: 0 });
  });

  it('moves the primary flag so there is exactly one primary', async () => {
    const res = await patch(ids[2], { isPrimary: true });

    expect(res.status).toBe(200);
    const primaries = res.body.data.filter((i: { isPrimary: boolean }) => i.isPrimary);
    expect(primaries.map((i: { id: string }) => i.id)).toEqual([ids[2]]);
    await expectExactlyOnePrimary();
  });

  it('keeps one primary when the primary is set again', async () => {
    const res = await patch(ids[0], { isPrimary: true });

    expect(res.status).toBe(200);
    await expectExactlyOnePrimary();
  });

  it('refuses to unset the primary image directly', async () => {
    const res = await patch(ids[0], { isPrimary: false });

    expect(res.status).toBe(422);
    expect(res.body.error.details[0].field).toBe('isPrimary');
    await expectExactlyOnePrimary();
  });

  it('allows isPrimary false on an image that is not primary', async () => {
    expect((await patch(ids[1], { isPrimary: false })).status).toBe(200);
    await expectExactlyOnePrimary();
  });

  it('rejects empty bodies, bad values and unknown fields', async () => {
    expect((await patch(ids[0], {})).status).toBe(422);
    expect((await patch(ids[0], { altText: '' })).status).toBe(422);
    expect((await patch(ids[0], { sortOrder: -1 })).status).toBe(422);
    expect((await patch(ids[0], { url: '/uploads/x.png' })).status).toBe(422);
  });

  it('returns 404 for an unknown image or an image of another vehicle', async () => {
    const other = await prisma.vehicle.create({
      data: {
        ...(await prisma.vehicle.findUniqueOrThrow({
          where: { id: data.vehicle.id },
          select: {
            manufacturer: true,
            model: true,
            year: true,
            vehicleType: true,
            fuelType: true,
            transmission: true,
            engine: true,
            powerHp: true,
            seats: true,
            color: true,
            description: true,
            features: true,
          },
        })),
        model: 'Other',
      },
    });

    expect((await patch('0bbe7e55-75e7-4355-b1e3-af30b7b9ee11', { altText: 'x' })).status).toBe(
      404,
    );
    expect((await patch(ids[0], { altText: 'x' }, other.id)).status).toBe(404);
  });

  it('is enforced by the database: a second primary cannot be inserted', async () => {
    await expect(
      prisma.vehicleImage.create({
        data: { vehicleId: data.vehicle.id, url: '/uploads/x.png', altText: 'x', isPrimary: true },
      }),
    ).rejects.toMatchObject({ code: 'P2002' });
  });
});

describe('DELETE /api/admin/vehicles/:id/images/:imageId', () => {
  const remove = (imageId: string) =>
    request(app)
      .delete(`/api/admin/vehicles/${data.vehicle.id}/images/${imageId}`)
      .set('Cookie', staffCookie);
  let images: { id: string; url: string }[];

  beforeEach(async () => {
    const res = await upload([png('a.png'), png('b.png')]);
    images = res.body.data;
  });

  it('removes the database row and the file', async () => {
    const res = await remove(images[1].id);

    expect(res.status).toBe(200);
    expect(res.body.data.map((i: { id: string }) => i.id)).toEqual([images[0].id]);
    expect(filesOnDisk()).toHaveLength(1);
    expect((await request(app).get(images[1].url)).status).toBe(404);
  });

  it('promotes the next image when the primary is deleted', async () => {
    const res = await remove(images[0].id);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0]).toMatchObject({ id: images[1].id, isPrimary: true });
    await expectExactlyOnePrimary();
  });

  it('leaves a vehicle with no images when the last one is deleted', async () => {
    await remove(images[1].id);
    const res = await remove(images[0].id);

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
    expect(filesOnDisk()).toHaveLength(0);
  });

  it('does not delete seed files that live outside the vehicle upload folder', async () => {
    const seedDir = path.join(uploadsDir, 'seed');
    fs.mkdirSync(seedDir, { recursive: true });
    fs.writeFileSync(path.join(seedDir, 'keep.svg'), '<svg/>');
    const seeded = await prisma.vehicleImage.create({
      data: {
        vehicleId: data.vehicle.id,
        url: '/uploads/seed/keep.svg',
        altText: 'seed',
        sortOrder: 99,
      },
    });

    expect((await remove(seeded.id)).status).toBe(200);
    expect(fs.existsSync(path.join(seedDir, 'keep.svg'))).toBe(true);
    fs.rmSync(seedDir, { recursive: true, force: true });
  });

  it('returns 404 for an unknown image and 422 for a malformed id', async () => {
    expect((await remove('0bbe7e55-75e7-4355-b1e3-af30b7b9ee11')).status).toBe(404);
    expect((await remove('nope')).status).toBe(422);
  });

  it('is restricted to staff', async () => {
    const res = await request(app)
      .delete(`/api/admin/vehicles/${data.vehicle.id}/images/${images[0].id}`)
      .set('Cookie', authCookie(data.customer));

    expect(res.status).toBe(403);
    expect(await prisma.vehicleImage.count()).toBe(2);
  });
});
