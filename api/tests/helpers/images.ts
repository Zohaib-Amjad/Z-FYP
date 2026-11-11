export const pngBuffer = (extraBytes = 0): Buffer =>
  Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    Buffer.alloc(32, 1),
    Buffer.alloc(extraBytes, 2),
  ]);

export const jpegBuffer = (): Buffer =>
  Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(32, 3)]);

export const webpBuffer = (): Buffer =>
  Buffer.concat([
    Buffer.from('RIFF', 'latin1'),
    Buffer.from([0x24, 0, 0, 0]),
    Buffer.from('WEBP', 'latin1'),
    Buffer.alloc(32, 4),
  ]);

export const textBuffer = (): Buffer => Buffer.from('this is definitely not an image');
