import path from 'path';
import { env } from './env';

const apiRoot = path.resolve(__dirname, '..', '..');

export const uploadsDir = path.resolve(apiRoot, env.UPLOAD_DIR);
