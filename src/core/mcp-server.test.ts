import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { PuppeteerMCPServer } from './mcp-server.js';

// Talks to the real server over an in-memory MCP transport. The browser pool is
// replaced with one that fails loudly, so a call that gets past argument checks
// shows up as "browser launch attempted" and no browser ever starts.
async function connect() {
  const mcp = new PuppeteerMCPServer();
  (mcp as any).browserPool = {
    acquire: async () => { throw new Error('browser launch attempted'); },
  };
  const [serverSide, clientSide] = InMemoryTransport.createLinkedPair();
  await (mcp as any).server.connect(serverSide);
  const client = new Client({ name: 'test', version: '0.0.0' }, { capabilities: {} });
  await client.connect(clientSide);
  return client;
}

async function call(name: string, args: Record<string, unknown>) {
  const client = await connect();
  const result: any = await client.callTool({ name, arguments: args });
  await client.close();
  return { isError: result.isError, text: result.content[0].text as string };
}

describe('tool arguments are checked against inputSchema before anything runs', () => {
  test.each([
    ['laravel_artisan', { command: 'list', args: '; touch /tmp/x' }, 'args must be array'],
    ['laravel_artisan', { command: 'list', args: ['ok', 7] }, 'args[1] must be string'],
    ['laravel_artisan', { args: [] }, 'command is required'],
    ['laravel_auth_acting_as', { userId: '1); alert(1' }, 'userId must be number'],
    ['laravel_route_visit', { routeName: 'home', params: 'x' }, 'params must be object'],
    ['navigate', { url: 'demo', waitUntil: 'soon' }, 'waitUntil must be one of load, domcontentloaded, networkidle0, networkidle2'],
    ['screenshot', { fullPage: 'yes' }, 'fullPage must be boolean'],
  ])('%s %j is refused', async (name, args, message) => {
    const { isError, text } = await call(name, args);
    expect(isError).toBe(true);
    expect(text).toContain(message);
    expect(text).not.toContain('browser launch attempted');
  });

  test('valid arguments pass the check (and reach the browser pool)', async () => {
    const { isError, text } = await call('laravel_artisan', { command: 'route:list', args: ['--json'] });
    expect(isError).toBe(true);
    expect(text).toContain('browser launch attempted');
  });

  test('an unknown tool is still reported as unknown', async () => {
    const { text } = await call('nope', {});
    expect(text).toContain('Unknown tool: nope');
  });
});
