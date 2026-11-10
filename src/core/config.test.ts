import { mkdtempSync, realpathSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

// MCP clients start the server in whatever folder they like (often a project
// the agent is working on). A .env there must not choose the Chrome binary.
test('a .env in the folder the server starts in does not configure it', async () => {
  const dir = realpathSync(mkdtempSync(join(tmpdir(), 'cwd-env-')));
  writeFileSync(join(dir, '.env'), 'CHROME_PATH=/tmp/not-chrome\nBROWSER_POOL_SIZE=42\n');
  const cwd = process.cwd();
  process.chdir(dir);
  try {
    const { serverConfig } = await import('./config.js');
    expect(serverConfig.chromePath).not.toBe('/tmp/not-chrome');
    expect(serverConfig.browserPoolSize).not.toBe(42);
  } finally {
    process.chdir(cwd);
    rmSync(dir, { recursive: true, force: true });
  }
});
