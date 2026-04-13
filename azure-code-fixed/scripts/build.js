/**
 * Azure Code build script
 */
import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

// Generate build info (no git needed)
const outDir = join(root, 'packages', 'core', 'src', 'generated');
mkdirSync(outDir, { recursive: true });
writeFileSync(
  join(outDir, 'build-info.ts'),
  `// Auto-generated\nexport const BUILD_INFO = { gitCommitHash: 'local', gitBranch: 'main', buildDate: '${new Date().toISOString()}' } as const;\n`
);

// Install if needed
if (!existsSync(join(root, 'node_modules'))) {
  execSync('npm install --ignore-scripts', { stdio: 'inherit', cwd: root });
}

// Build core first
console.log('Building azure-code-core...');
execSync('npm run build -w azure-code-core', { stdio: 'inherit', cwd: root });

// Build CLI
console.log('Building azure-code...');
execSync('npm run build -w azure-code', { stdio: 'inherit', cwd: root });

console.log('\n✓ Build complete. Run: npm install -g ./packages/cli');
