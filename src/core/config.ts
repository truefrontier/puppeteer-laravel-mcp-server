import dotenv from 'dotenv';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { ServerConfig, BrowserPoolConfig } from './types.js';

// Read .env from the package folder, not the current folder. MCP clients start
// the server wherever they like, and a .env there (say, in a repo the agent is
// working on) must not pick settings such as CHROME_PATH.
dotenv.config({ path: join(dirname(fileURLToPath(import.meta.url)), '../../.env') });

export const serverConfig: ServerConfig = {
  browserPoolSize: parseInt(process.env.BROWSER_POOL_SIZE || '5'),
  browserTimeout: parseInt(process.env.BROWSER_TIMEOUT || '30000'),
  headless: process.env.HEADLESS === 'true',
  chromePath: process.env.CHROME_PATH || undefined,
  chromeNoSandbox: process.env.CHROME_NO_SANDBOX === 'true',
  herdDirectory: process.env.HERD_DIRECTORY || '~/Herd',
  defaultDomainSuffix: process.env.DEFAULT_DOMAIN_SUFFIX || '.test',
  sslEnabled: process.env.SSL_ENABLED === 'true',
  mcpTransport: (process.env.MCP_TRANSPORT as 'stdio' | 'http') || 'stdio',
  mcpPort: process.env.MCP_PORT ? parseInt(process.env.MCP_PORT) : undefined,
  mcpAuthEnabled: process.env.MCP_AUTH_ENABLED === 'true',
  debugScreenshots: process.env.DEBUG_SCREENSHOTS === 'true',
  debugConsoleLogs: process.env.DEBUG_CONSOLE_LOGS === 'true',
  visualDebug: process.env.VISUAL_DEBUG === 'true',
};

export const browserPoolConfig: BrowserPoolConfig = {
  min: 0,
  max: serverConfig.browserPoolSize,
  acquireTimeoutMillis: 30000,
  createTimeoutMillis: 30000,
  destroyTimeoutMillis: 5000,
  idleTimeoutMillis: 300000,
  reapIntervalMillis: 1000,
  createRetryIntervalMillis: 200,
  autostart: false,
};

export const laravelHerdConfig = {
  domains: {
    test: serverConfig.defaultDomainSuffix,
    ssl: serverConfig.sslEnabled,
  },
  paths: {
    herdDirectory: serverConfig.herdDirectory.replace('~', process.env.HOME || ''),
  },
  commands: {
    php: 'herd php',
    composer: 'herd composer',
    artisan: 'herd artisan',
  },
};