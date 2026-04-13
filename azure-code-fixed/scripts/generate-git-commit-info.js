/**
 * Generates build info (no git required).
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

const info = {
  gitCommitHash: 'local-build',
  gitBranch: 'main',
  buildDate: new Date().toISOString(),
};

const outDir = join(root, 'packages', 'core', 'src', 'generated');
mkdirSync(outDir, { recursive: true });

writeFileSync(
  join(outDir, 'build-info.ts'),
  `// Auto-generated — do not edit\nexport const BUILD_INFO = ${JSON.stringify(info, null, 2)} as const;\n`
);

console.log('Build info generated.');
