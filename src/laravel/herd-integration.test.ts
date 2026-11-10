import { chmodSync, existsSync, mkdtempSync, readFileSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import vm from 'vm';
import { jest } from '@jest/globals';
import { LaravelHerdIntegration } from './herd-integration.js';

// A stand-in `herd` that records each argument it gets on its own line. Tests
// hand its absolute path to the constructor, so the real Herd never runs.
// (Jest gives each test file its own copy of process.env, so a PATH override
// would not reach child processes.)
function fakeHerd() {
  const dir = mkdtempSync(join(tmpdir(), 'fake-herd-'));
  const log = join(dir, 'argv.log');
  writeFileSync(join(dir, 'herd'), `#!/bin/sh\nfor a in "$@"; do printf '%s\\n' "$a" >> '${log}'; done\n`);
  chmodSync(join(dir, 'herd'), 0o755);
  const argv = () => (existsSync(log) ? readFileSync(log, 'utf8').split('\n').slice(0, -1) : []);
  return { dir, argv, pwned: join(dir, 'pwned') };
}

// A page whose evaluate() runs scripts in a separate JS realm, the way Puppeteer
// does: functions travel as source text and their arguments as JSON.
function fakePage() {
  const store: Record<string, string> = {};
  const routeCalls: unknown[][] = [];
  const ctx: any = vm.createContext({
    store,
    routeCalls,
    localStorage: { setItem: (k: string, v: string) => { store[k] = v; } },
    document: { querySelector: () => null },
    CustomEvent: class { constructor(public type: string, public init: unknown) {} },
  });
  vm.runInContext(`
    var window = globalThis;
    window.dispatchEvent = () => true;
    window.route = (...args) => { routeCalls.push(args); return 'https://demo.test/dest'; };
  `, ctx);
  const page = {
    evaluate: async (fn: unknown, ...args: unknown[]) =>
      vm.runInContext(typeof fn === 'function' ? `(${fn})(...${JSON.stringify(args)})` : String(fn), ctx),
    goto: jest.fn(async () => null),
    reload: jest.fn(async () => null),
  };
  return { page, ctx, store, routeCalls };
}

describe('Herd commands run without a shell', () => {
  let herd: ReturnType<typeof fakeHerd>;
  let bin: string;

  beforeEach(() => {
    herd = fakeHerd();
    bin = join(herd.dir, 'herd');
  });

  test('artisan arguments reach herd as literal text, not as shell commands', async () => {
    const laravel = new LaravelHerdIntegration({} as any, 'demo', bin);
    const hostile = [`; touch ${herd.pwned}`, `$(touch ${herd.pwned})`, `\`touch ${herd.pwned}\``];

    await laravel.runArtisanCommand('list', hostile);

    expect(existsSync(herd.pwned)).toBe(false);
    expect(herd.argv()).toEqual(['artisan', '--site=demo', 'list', ...hostile]);
  });

  test('a site name cannot smuggle in a command', async () => {
    const laravel = new LaravelHerdIntegration({} as any, `demo$(touch ${herd.pwned})`, bin);

    await laravel.runArtisanCommand('list');

    expect(existsSync(herd.pwned)).toBe(false);
    expect(herd.argv()).toEqual(['artisan', `--site=demo$(touch ${herd.pwned})`, 'list']);
  });

  test('an artisan command name outside the allowed pattern is refused before herd runs', async () => {
    const laravel = new LaravelHerdIntegration({} as any, 'demo', bin);

    await expect(laravel.runArtisanCommand(`list; touch ${herd.pwned}`)).rejects.toThrow('Invalid artisan command name');

    expect(existsSync(herd.pwned)).toBe(false);
    expect(herd.argv()).toEqual([]);
  });

  test('normal artisan command names still work', async () => {
    const laravel = new LaravelHerdIntegration({} as any, 'demo', bin);

    await laravel.seedDatabase('UserSeeder', { database: 'testing' });
    await laravel.runArtisanCommand('ide-helper:generate');

    expect(herd.argv()).toEqual([
      'artisan', '--site=demo', 'db:seed', '--class=UserSeeder', '--database=testing',
      'artisan', '--site=demo', 'ide-helper:generate',
    ]);
  });
});

describe('page scripts take inputs as arguments, not as source', () => {
  test('a route name with a quote in it cannot run code in the page', async () => {
    const { page, ctx, routeCalls } = fakePage();
    const routeName = "home', globalThis.pwned = true, '";
    const laravel = new LaravelHerdIntegration(page as any);

    await laravel.visitRoute(routeName, { id: 7 });

    expect(ctx.pwned).toBeUndefined();
    expect(routeCalls).toEqual([[routeName, { id: 7 }]]);
    expect(page.goto).toHaveBeenCalledWith('https://demo.test/dest', { waitUntil: 'networkidle2' });
  });

  test('a route missing from window.route falls back to window.Laravel.routes', async () => {
    const { page, ctx } = fakePage();
    vm.runInContext(`delete window.route; window.Laravel = { routes: { 'posts.show': '/posts/{post}' } };`, ctx);
    const laravel = new LaravelHerdIntegration(page as any);

    await laravel.visitRoute('posts.show', { post: 3 });

    expect(page.goto).toHaveBeenCalledWith('/posts/3', { waitUntil: 'networkidle2' });
  });

  test('a login email with a quote in it is stored as text, not run', async () => {
    const { page, ctx, store } = fakePage();
    const email = "a@b.test', pwned: globalThis.pwned = true, x: '";
    const laravel = new LaravelHerdIntegration(page as any);

    await laravel.loginAs(email, { guardName: "admin'+(globalThis.pwned2 = true)+'" });

    expect(ctx.pwned).toBeUndefined();
    expect(ctx.pwned2).toBeUndefined();
    expect(JSON.parse(store.laravel_auth_user)).toMatchObject({
      email,
      guard: "admin'+(globalThis.pwned2 = true)+'",
      authenticated: true,
    });
  });

  test('actingAs stores the user id it was given', async () => {
    const { page, store } = fakePage();
    const laravel = new LaravelHerdIntegration(page as any);

    await laravel.actingAs(42);

    expect(JSON.parse(store.laravel_acting_as)).toMatchObject({ userId: 42, guard: 'web' });
  });
});
