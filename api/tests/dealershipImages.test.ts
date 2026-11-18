import fs from 'fs';
import path from 'path';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { uploadsDir } from '../src/config/paths';
import { disconnectPrisma, prisma } from '../src/config/prisma';
import { authCookie } from './helpers/auth';
import { resetDatabase, seedMinimalData } from './helpers/db';
import { jpegBuffer, pngBuffer, textBuffer } from './helpers/images';

let app: ReturnType<typeof createApp>;
let data: Awaited<ReturnType<typeof seedMinimalData>>;
let staffCookie: string;

const dealershipUploads = path.join(uploadsDir, 'dealerships');

beforeEach(async () => {
  app = createApp();
  await resetDatabase();
  fs.rmSync(dealershipUploads, { recursive: true, force: true });
  data = await seedMinimalData();
  staffCookie = authCookie(data.staff);
});

afterAll(async () => {
  await resetDatabase();
  fs.rmSync(dealershipUploads, { recursive: true, force: true });
  await disconnectPrisma();
});

const url = (id = data.dealership.id) => `/api/admin/dealerships/${id}/image`;

const upload = (
  buffer: Buffer,
  {
    filename = 'showroom.jpg',
    contentType = 'image/jpeg',
    field = 'image',
    cookie = staffCookie,
  } = {},
  id = data.dealership.id,
) =>
  request(app).post(url(id)).set('Cookie', cookie).attach(field, buffer, { filename, contentType });

const filesOnDisk = (id = data.dealership.id): string[] => {
  const dir = path.join(dealershipUploads, id);
  return fs.existsSync(dir) ? fs.readdirSync(dir) : [];
};

const storedUrl = async () =>
  (await prisma.dealership.findUniqueOrThrow({ where: { id: data.dealership.id } })).imageUrl;

describe('POST /api/admin/dealerships/:id/image', () => {
  it('stores the photograph under a random name, serves it and returns the dealership', async () => {
    const res = await upload(jpegBuffer(), { filename: '../../evil name.jpg' });

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ id: data.dealership.id, name: data.dealership.name });
    const { imageUrl } = res.body.data;
    expect(imageUrl).toMatch(
      new RegExp(`^/uploads/dealerships/${data.dealership.id}/[0-9a-f-]{36}\\.jpg$`),
    );
    expect(imageUrl).not.toContain('evil');
    expect(await storedUrl()).toBe(imageUrl);
    expect(filesOnDisk()).toHaveLength(1);

    const served = await request(app).get(imageUrl);
    expect(served.status).toBe(200);
  });

  it('replaces an earlier photograph and deletes its file', async () => {
    const first = await upload(jpegBuffer());
    const second = await upload(pngBuffer(), { filename: 'new.png', contentType: 'image/png' });

    expect(second.status).toBe(200);
    expect(second.body.data.imageUrl).not.toBe(first.body.data.imageUrl);
    expect(second.body.data.imageUrl).toMatch(/\.png$/);
    expect(filesOnDisk()).toEqual([path.basename(second.body.data.imageUrl)]);
  });

  it('rejects a file whose content is not an image, storing nothing', async () => {
    const res = await upload(textBuffer(), { filename: 'notes.jpg' });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('UPLOAD_INVALID');
    expect(await storedUrl()).toBeNull();
    expect(filesOnDisk()).toHaveLength(0);
  });

  it('rejects unsupported types, missing files and the wrong field name', async () => {
    const gif = await upload(Buffer.from('GIF89a'), {
      filename: 'a.gif',
      contentType: 'image/gif',
    });
    expect(gif.status).toBe(422);
    expect(gif.body.error.code).toBe('UPLOAD_INVALID');

    const none = await request(app).post(url()).set('Cookie', staffCookie).field('note', 'x');
    expect(none.status).toBe(422);

    const wrongField = await upload(jpegBuffer(), { field: 'images' });
    expect(wrongField.status).toBe(422);
    expect(wrongField.body.error.message).toContain('"image"');
    expect(filesOnDisk()).toHaveLength(0);
  });

  it('returns 404 for an unknown dealership and removes the written file', async () => {
    const res = await upload(jpegBuffer(), {}, '6b2c9d4e-0f8a-4a52-9a67-1d3b5c7e9f01');

    expect(res.status).toBe(404);
    expect(filesOnDisk('6b2c9d4e-0f8a-4a52-9a67-1d3b5c7e9f01')).toHaveLength(0);
  });

  it('is limited to signed-in staff', async () => {
    const anonymous = await request(app)
      .post(url())
      .attach('image', jpegBuffer(), { filename: 'a.jpg', contentType: 'image/jpeg' });
    expect(anonymous.status).toBe(401);

    const customer = await upload(jpegBuffer(), { cookie: authCookie(data.customer) });
    expect(customer.status).toBe(403);
    expect(await storedUrl()).toBeNull();
  });
});

describe('DELETE /api/admin/dealerships/:id/image', () => {
  it('clears the photograph and deletes the uploaded file', async () => {
    await upload(jpegBuffer());

    const res = await request(app).delete(url()).set('Cookie', staffCookie);

    expect(res.status).toBe(200);
    expect(res.body.data.imageUrl).toBeNull();
    expect(await storedUrl()).toBeNull();
    expect(filesOnDisk()).toHaveLength(0);
  });

  it('keeps demo photographs that live outside the dealership upload folder', async () => {
    await prisma.dealership.update({
      where: { id: data.dealership.id },
      data: { imageUrl: '/uploads/seed/dealership-demo.jpg' },
    });

    const res = await request(app).delete(url()).set('Cookie', staffCookie);

    expect(res.status).toBe(200);
    expect(res.body.data.imageUrl).toBeNull();
  });

  it('returns 404 for an unknown dealership', async () => {
    const res = await request(app)
      .delete(url('6b2c9d4e-0f8a-4a52-9a67-1d3b5c7e9f01'))
      .set('Cookie', staffCookie);
    expect(res.status).toBe(404);
  });
});

describe('public dealership data', () => {
  it('includes the photograph URL, or null when there is none', async () => {
    const before = await request(app).get('/api/dealerships');
    expect(before.body.data[0].imageUrl).toBeNull();

    const uploaded = await upload(jpegBuffer());
    const after = await request(app).get(`/api/dealerships/${data.dealership.id}`);

    expect(after.status).toBe(200);
    expect(after.body.data.imageUrl).toBe(uploaded.body.data.imageUrl);
  });
});
