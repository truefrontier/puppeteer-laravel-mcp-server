import { existsSync, mkdtempSync, realpathSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { PuppeteerTools } from './puppeteer-tools.js';

describe('screenshot path', () => {
  const originalCwd = process.cwd();
  let work: string;
  let tools: PuppeteerTools;

  beforeEach(() => {
    work = realpathSync(mkdtempSync(join(tmpdir(), 'shots-')));
    process.chdir(work);
    const page = { screenshot: async () => Buffer.from('png'), evaluate: async () => undefined };
    tools = new PuppeteerTools({} as any, page as any);
  });
  afterEach(() => process.chdir(originalCwd));

  test('a relative name is saved under screenshots/', async () => {
    await expect(tools.screenshot({ path: 'home.png' })).resolves.toBe(join(work, 'screenshots', 'home.png'));
    expect(existsSync(join(work, 'screenshots', 'home.png'))).toBe(true);
  });

  test('a subfolder under screenshots/ is created', async () => {
    await expect(tools.screenshot({ path: 'run-1/home.png' })).resolves.toBe(join(work, 'screenshots', 'run-1', 'home.png'));
  });

  test('../ cannot climb out of screenshots/', async () => {
    await expect(tools.screenshot({ path: '../escaped.png' })).rejects.toThrow('must stay inside');
    expect(existsSync(join(work, 'escaped.png'))).toBe(false);
  });

  test('an absolute path is refused', async () => {
    await expect(tools.screenshot({ path: join(work, 'abs.png') })).rejects.toThrow('must stay inside');
    expect(existsSync(join(work, 'abs.png'))).toBe(false);
  });
});
