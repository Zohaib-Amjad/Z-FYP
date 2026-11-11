import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

const apiRoot = path.resolve(__dirname, '..');
const uploadsDir = path.resolve(apiRoot, process.env.UPLOAD_DIR ?? 'uploads');
const KEEP = new Set(['seed']);

if (process.env.NODE_ENV === 'production') {
  console.error('demo:reset refuses to run with NODE_ENV=production.');
  process.exit(1);
}

const removeUploadedImages = (): number => {
  if (!fs.existsSync(uploadsDir)) return 0;
  const entries = fs.readdirSync(uploadsDir).filter(name => !KEEP.has(name));
  for (const name of entries)
    fs.rmSync(path.join(uploadsDir, name), { recursive: true, force: true });
  return entries.length;
};

console.log('Resetting the development database and loading the demo data...');
execSync('npx prisma migrate reset --force', { cwd: apiRoot, stdio: 'inherit' });
const removed = removeUploadedImages();
console.log(`Removed ${removed} uploaded image folder(s) left over from earlier demos.`);
console.log('Demo data is ready. Sign in with the accounts printed above.');
