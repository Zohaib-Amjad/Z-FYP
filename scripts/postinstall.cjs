const { existsSync } = require('fs');
const { spawnSync } = require('child_process');
const path = require('path');

const root = path.resolve(__dirname, '..');
const prismaCli = path.join(root, 'node_modules', 'prisma', 'build', 'index.js');

if (!existsSync(prismaCli)) {
  console.log(
    'postinstall: Prisma is not installed here (web-only install); skipping client generation.',
  );
  process.exit(0);
}

const result = spawnSync(
  process.execPath,
  [prismaCli, 'generate', '--schema', 'api/prisma/schema.prisma'],
  {
    cwd: root,
    stdio: 'inherit',
  },
);
process.exit(result.status ?? 1);
