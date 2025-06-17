import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';

import { BrowserPool } from '../browser/pool.js';
import { PuppeteerTools } from '../tools/puppeteer-tools.js';
import { LaravelHerdIntegration } from '../laravel/herd-integration.js';
import { serverConfig } from './config.js';
import { BrowserInstance } from './types.js';
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const packageJson = JSON.parse(readFileSync(join(__dirname, '../../package.json'), 'utf-8'));

export class PuppeteerMCPServer {
  private server: Server;
  private browserPool: BrowserPool | null = null;
  private activeSessions: Map<string, { instance: BrowserInstance; tools: PuppeteerTools; laravel: LaravelHerdIntegration }> = new Map();

  constructor() {
    this.server = new Server(
      {
        name: 'puppeteer-laravel-mcp-server',
        version: packageJson.version,
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupToolHandlers();
  }

  private async getBrowserPool(): Promise<BrowserPool> {
    if (!this.browserPool) {
      this.browserPool = new BrowserPool();
    }
    return this.browserPool;
  }

  private setupToolHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          // Core browser automation tools
          {
            name: 'navigate',
            description: 'Navigate to a URL with Laravel Herd domain resolution',
            inputSchema: {
              type: 'object',
              properties: {
                url: { type: 'string', description: 'URL to navigate to' },
                waitUntil: { 
                  type: 'string', 
                  enum: ['load', 'domcontentloaded', 'networkidle0', 'networkidle2'],
                  description: 'When to consider navigation complete'
                },
                timeout: { type: 'number', description: 'Navigation timeout in milliseconds' },
                viewport: {
                  type: 'object',
                  properties: {
                    width: { type: 'number' },
                    height: { type: 'number' }
                  }
                }
              },
              required: ['url']
            }
          },
          {
            name: 'screenshot',
            description: 'Capture page screenshot optimized for Claude analysis',
            inputSchema: {
              type: 'object',
              properties: {
                path: { type: 'string', description: 'Optional file path' },
                type: { type: 'string', enum: ['png', 'jpeg', 'webp'], description: 'Image format' },
                quality: { type: 'number', description: 'Image quality (0-100)' },
                fullPage: { type: 'boolean', description: 'Capture full page' },
                clip: {
                  type: 'object',
                  properties: {
                    x: { type: 'number' },
                    y: { type: 'number' },
                    width: { type: 'number' },
                    height: { type: 'number' }
                  }
                }
              }
            }
          },
          {
            name: 'interact',
            description: 'Perform user interactions (click, type, scroll)',
            inputSchema: {
              type: 'object',
              properties: {
                selector: { type: 'string', description: 'CSS selector for element' },
                action: { 
                  type: 'string', 
                  enum: ['click', 'type', 'select', 'scroll'],
                  description: 'Action to perform'
                },
                value: { type: 'string', description: 'Value for type/select actions' },
                timeout: { type: 'number', description: 'Timeout in milliseconds' }
              },
              required: ['selector', 'action']
            }
          },
          {
            name: 'execute',
            description: 'Execute JavaScript in the browser context',
            inputSchema: {
              type: 'object',
              properties: {
                script: { type: 'string', description: 'JavaScript code to execute' },
                args: { type: 'array', description: 'Arguments to pass to script' }
              },
              required: ['script']
            }
          },
          {
            name: 'wait_for',
            description: 'Wait for elements with intelligent timeout handling',
            inputSchema: {
              type: 'object',
              properties: {
                selector: { type: 'string', description: 'CSS selector to wait for' },
                timeout: { type: 'number', description: 'Timeout in milliseconds' },
                visible: { type: 'boolean', description: 'Wait for element to be visible' },
                hidden: { type: 'boolean', description: 'Wait for element to be hidden' }
              },
              required: ['selector']
            }
          },
          
          // Laravel Herd integration tools
          {
            name: 'laravel_auth_login',
            description: 'Authenticate as a specific user',
            inputSchema: {
              type: 'object',
              properties: {
                email: { type: 'string', description: 'User email to authenticate as' },
                guard: { type: 'string', description: 'Laravel guard name' }
              },
              required: ['email']
            }
          },
          {
            name: 'laravel_auth_acting_as',
            description: 'Act as a specific user by ID',
            inputSchema: {
              type: 'object',
              properties: {
                userId: { type: 'number', description: 'User ID to act as' },
                guard: { type: 'string', description: 'Laravel guard name' }
              },
              required: ['userId']
            }
          },
          {
            name: 'laravel_db_seed',
            description: 'Run database seeders for test data',
            inputSchema: {
              type: 'object',
              properties: {
                seeder: { type: 'string', description: 'Seeder class name' },
                database: { type: 'string', description: 'Database connection name' }
              },
              required: ['seeder']
            }
          },
          {
            name: 'laravel_route_visit',
            description: 'Navigate using Laravel route names',
            inputSchema: {
              type: 'object',
              properties: {
                routeName: { type: 'string', description: 'Laravel route name' },
                params: { type: 'object', description: 'Route parameters' }
              },
              required: ['routeName']
            }
          },
          {
            name: 'laravel_artisan',
            description: 'Execute Laravel Artisan commands',
            inputSchema: {
              type: 'object',
              properties: {
                command: { type: 'string', description: 'Artisan command' },
                args: { type: 'array', description: 'Command arguments' }
              },
              required: ['command']
            }
          },
          
          // Session management
          {
            name: 'create_session',
            description: 'Create a new browser session',
            inputSchema: {
              type: 'object',
              properties: {
                sessionId: { type: 'string', description: 'Optional session ID' },
                siteName: { type: 'string', description: 'Laravel Herd site name' }
              }
            }
          },
          {
            name: 'destroy_session',
            description: 'Destroy a browser session',
            inputSchema: {
              type: 'object',
              properties: {
                sessionId: { type: 'string', description: 'Session ID to destroy' }
              },
              required: ['sessionId']
            }
          },
          {
            name: 'get_page_info',
            description: 'Get current page information and debug data',
            inputSchema: {
              type: 'object',
              properties: {
                sessionId: { type: 'string', description: 'Session ID' }
              }
            }
          },
          {
            name: 'get_pool_stats',
            description: 'Get browser pool statistics',
            inputSchema: {
              type: 'object',
              properties: {}
            }
          }
        ] as Tool[]
      };
    });

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          // Session management
          case 'create_session':
            return await this.createSession(args?.sessionId as string, args?.siteName as string);
          
          case 'destroy_session':
            return await this.destroySession(args?.sessionId as string);
          
          case 'get_page_info':
            return await this.getPageInfo(args?.sessionId as string);
          
          case 'get_pool_stats':
            return await this.getPoolStats();

          // Core browser automation
          case 'navigate':
            return await this.navigate(args?.sessionId as string, args?.url as string, args);
          
          case 'screenshot':
            return await this.screenshot(args?.sessionId as string, args);
          
          case 'interact':
            return await this.interact(args?.sessionId as string, args?.selector as string, args?.action as string, args?.value as string, args);
          
          case 'execute':
            return await this.execute(args?.sessionId as string, args?.script as string, args?.args as any[]);
          
          case 'wait_for':
            return await this.waitFor(args?.sessionId as string, args?.selector as string, args);

          // Laravel integration
          case 'laravel_auth_login':
            return await this.laravelAuthLogin(args?.sessionId as string, args?.email as string, args);
          
          case 'laravel_auth_acting_as':
            return await this.laravelAuthActingAs(args?.sessionId as string, args?.userId as number, args);
          
          case 'laravel_db_seed':
            return await this.laravelDbSeed(args?.sessionId as string, args?.seeder as string, args);
          
          case 'laravel_route_visit':
            return await this.laravelRouteVisit(args?.sessionId as string, args?.routeName as string, args?.params);
          
          case 'laravel_artisan':
            return await this.laravelArtisan(args?.sessionId as string, args?.command as string, args?.args as any[]);

          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error: ${error instanceof Error ? error.message : String(error)}`
            }
          ],
          isError: true
        };
      }
    });
  }

  private async getSession(sessionId?: string) {
    if (!sessionId) {
      // Create default session if none provided
      const defaultSessionId = 'default';
      if (!this.activeSessions.has(defaultSessionId)) {
        await this.createSession(defaultSessionId);
      }
      sessionId = defaultSessionId;
    }

    const session = this.activeSessions.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    return { sessionId, ...session };
  }

  // Session management methods
  private async createSession(sessionId?: string, siteName?: string) {
    sessionId = sessionId || `session-${Date.now()}`;
    
    if (this.activeSessions.has(sessionId)) {
      throw new Error(`Session already exists: ${sessionId}`);
    }

    const browserPool = await this.getBrowserPool();
    const instance = await browserPool.acquire();
    const page = await browserPool.createPage(instance);
    const tools = new PuppeteerTools(instance, page);
    const laravel = new LaravelHerdIntegration(page, siteName);

    this.activeSessions.set(sessionId, { instance, tools, laravel });

    return {
      content: [
        {
          type: 'text',
          text: `Session created: ${sessionId}`
        }
      ]
    };
  }

  private async destroySession(sessionId: string) {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    // Close all pages in the browser instance
    const pages = await session.instance.browser.pages();
    await Promise.all(pages.map(page => page.close()));

    // Release browser instance back to pool
    const browserPool = await this.getBrowserPool();
    await browserPool.release(session.instance);
    
    this.activeSessions.delete(sessionId);

    return {
      content: [
        {
          type: 'text',
          text: `Session destroyed: ${sessionId}`
        }
      ]
    };
  }

  private async getPageInfo(sessionId?: string) {
    const { tools } = await this.getSession(sessionId);
    const info = await tools.getPageInfo();

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(info, null, 2)
        }
      ]
    };
  }

  private async getPoolStats() {
    const browserPool = await this.getBrowserPool();
    const stats = browserPool.getStats();

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(stats, null, 2)
        }
      ]
    };
  }

  // Browser automation methods
  private async navigate(sessionId: string | undefined, url: string, options: any = {}) {
    const { tools } = await this.getSession(sessionId);
    await tools.navigate(url, options);

    return {
      content: [
        {
          type: 'text',
          text: `Navigated to: ${url}`
        }
      ]
    };
  }

  private async screenshot(sessionId: string | undefined, options: any = {}) {
    const { tools } = await this.getSession(sessionId);
    const filepath = await tools.screenshot(options);

    return {
      content: [
        {
          type: 'text',
          text: `Screenshot saved: ${filepath}`
        }
      ]
    };
  }

  private async interact(sessionId: string | undefined, selector: string, action: string, value?: string, options: any = {}) {
    const { tools } = await this.getSession(sessionId);
    await tools.interact(selector, action as any, value, options);

    return {
      content: [
        {
          type: 'text',
          text: `Interaction completed: ${action} on ${selector}`
        }
      ]
    };
  }

  private async execute(sessionId: string | undefined, script: string, args: any[] = []) {
    const { tools } = await this.getSession(sessionId);
    const result = await tools.execute(script, ...args);

    return {
      content: [
        {
          type: 'text',
          text: `Script executed. Result: ${JSON.stringify(result)}`
        }
      ]
    };
  }

  private async waitFor(sessionId: string | undefined, selector: string, options: any = {}) {
    const { tools } = await this.getSession(sessionId);
    await tools.waitFor(selector, options);

    return {
      content: [
        {
          type: 'text',
          text: `Element found: ${selector}`
        }
      ]
    };
  }

  // Laravel integration methods
  private async laravelAuthLogin(sessionId: string | undefined, email: string, options: any = {}) {
    const { laravel } = await this.getSession(sessionId);
    await laravel.loginAs(email, options);

    return {
      content: [
        {
          type: 'text',
          text: `Authenticated as: ${email}`
        }
      ]
    };
  }

  private async laravelAuthActingAs(sessionId: string | undefined, userId: number, options: any = {}) {
    const { laravel } = await this.getSession(sessionId);
    await laravel.actingAs(userId, options);

    return {
      content: [
        {
          type: 'text',
          text: `Acting as user ID: ${userId}`
        }
      ]
    };
  }

  private async laravelDbSeed(sessionId: string | undefined, seeder: string, options: any = {}) {
    const { laravel } = await this.getSession(sessionId);
    await laravel.seedDatabase(seeder, options);

    return {
      content: [
        {
          type: 'text',
          text: `Database seeded with: ${seeder}`
        }
      ]
    };
  }

  private async laravelRouteVisit(sessionId: string | undefined, routeName: string, params: any = {}) {
    const { laravel } = await this.getSession(sessionId);
    await laravel.visitRoute(routeName, params);

    return {
      content: [
        {
          type: 'text',
          text: `Visited route: ${routeName}`
        }
      ]
    };
  }

  private async laravelArtisan(sessionId: string | undefined, command: string, args: any[] = []) {
    const { laravel } = await this.getSession(sessionId);
    const result = await laravel.runArtisanCommand(command, args);

    return {
      content: [
        {
          type: 'text',
          text: `Artisan command executed: ${command}\n${result}`
        }
      ]
    };
  }

  async start() {
    if (serverConfig.mcpTransport === 'stdio') {
      const transport = new StdioServerTransport();
      await this.server.connect(transport);
    } else {
      throw new Error('HTTP transport not yet implemented');
    }
  }

  async stop() {
    // Close all active sessions
    for (const [sessionId] of this.activeSessions) {
      await this.destroySession(sessionId);
    }

    // Drain browser pool if it was initialized
    if (this.browserPool) {
      await this.browserPool.drain();
    }
    
    // Close server
    await this.server.close();
  }
}