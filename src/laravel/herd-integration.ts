import { execFile } from 'child_process';
import { promisify } from 'util';
import { LaravelAuthConfig, LaravelDbConfig } from '../core/types.js';
import { Page } from 'puppeteer';

const execFileAsync = promisify(execFile);

// Artisan command names look like `migrate`, `db:seed`, `ide-helper:generate`.
const ARTISAN_COMMAND = /^[a-z][a-z0-9_-]*(:[a-z0-9_-]+)*$/i;

export class LaravelHerdIntegration {
  constructor(private page: Page, private siteName?: string, private herdBinary = 'herd') {}

  // Runs `herd <subcommand> [--site=<site>] ...args` with no shell, so every
  // argument reaches herd as literal text.
  async executeHerdCommand(subcommand: string, args: string[] = []): Promise<string> {
    const argv = this.siteName ? [subcommand, `--site=${this.siteName}`, ...args] : [subcommand, ...args];

    try {
      const { stdout, stderr } = await execFileAsync(this.herdBinary, argv);
      if (stderr) {
        console.warn(`Herd command warning: ${stderr}`);
      }
      return stdout.trim();
    } catch (error) {
      throw new Error(`Herd command failed: ${error}`);
    }
  }

  async getPhpVersion(): Promise<string> {
    return await this.executeHerdCommand('php', ['-v']);
  }

  async runArtisanCommand(command: string, args: string[] = []): Promise<string> {
    if (!ARTISAN_COMMAND.test(command)) {
      throw new Error(`Invalid artisan command name: ${JSON.stringify(command)}`);
    }
    return await this.executeHerdCommand('artisan', [command, ...args]);
  }

  async runComposerCommand(command: string, args: string[] = []): Promise<string> {
    return await this.executeHerdCommand('composer', [command, ...args]);
  }

  async secureSite(): Promise<void> {
    if (!this.siteName) {
      throw new Error('Site name required for SSL security');
    }
    await this.executeHerdCommand('secure', [this.siteName]);
  }

  async unsecureSite(): Promise<void> {
    if (!this.siteName) {
      throw new Error('Site name required for SSL unsecurity');
    }
    await this.executeHerdCommand('unsecure', [this.siteName]);
  }

  // Laravel-specific authentication helpers
  // Page scripts below take their inputs as evaluate() arguments, never as
  // source text, so quotes in an email, guard or route name stay data.
  async loginAs(email: string, config: LaravelAuthConfig = {}): Promise<void> {
    await this.page.evaluate((email, guard) => {
      const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') ||
                       document.querySelector<HTMLInputElement>('input[name="_token"]')?.value;

      // Inject authentication state
      const w = window as any;
      if (w.Laravel && w.Laravel.csrfToken) {
        w.Laravel.csrfToken = csrfToken;
      }

      // Set session data via localStorage for SPA compatibility
      localStorage.setItem('laravel_auth_user', JSON.stringify({
        email,
        authenticated: true,
        guard,
        timestamp: new Date().toISOString()
      }));

      // Trigger authentication events if available
      if (window.dispatchEvent) {
        window.dispatchEvent(new CustomEvent('laravel:auth:login', { detail: { email, guard } }));
      }
    }, email, config.guardName || 'web');

    // Reload page to apply authentication state
    await this.page.reload({ waitUntil: 'networkidle2' });
  }

  async actingAs(userId: number, config: LaravelAuthConfig = {}): Promise<void> {
    await this.page.evaluate((userId, guard) => {
      // Set acting as user data
      localStorage.setItem('laravel_acting_as', JSON.stringify({
        userId,
        guard,
        timestamp: new Date().toISOString()
      }));

      // Trigger acting as events
      if (window.dispatchEvent) {
        window.dispatchEvent(new CustomEvent('laravel:auth:acting-as', { detail: { userId, guard } }));
      }
    }, userId, config.guardName || 'web');

    await this.page.reload({ waitUntil: 'networkidle2' });
  }

  async logout(): Promise<void> {
    const logoutScript = `
      (async () => {
        // Clear authentication data
        localStorage.removeItem('laravel_auth_user');
        localStorage.removeItem('laravel_acting_as');
        
        // Clear session storage
        sessionStorage.clear();
        
        // Trigger logout events
        if (window.dispatchEvent) {
          window.dispatchEvent(new CustomEvent('laravel:auth:logout'));
        }
        
        return true;
      })()
    `;

    await this.page.evaluate(logoutScript);
    await this.page.reload({ waitUntil: 'networkidle2' });
  }

  // Database management helpers
  async seedDatabase(seeder: string, config: LaravelDbConfig = {}): Promise<void> {
    const args = ['--class=' + seeder];
    if (config.database) {
      args.push('--database=' + config.database);
    }
    
    await this.runArtisanCommand('db:seed', args);
  }

  async migrateDatabase(fresh: boolean = false, config: LaravelDbConfig = {}): Promise<void> {
    const command = fresh ? 'migrate:fresh' : 'migrate';
    const args = [];
    
    if (config.database) {
      args.push('--database=' + config.database);
    }
    
    await this.runArtisanCommand(command, args);
  }

  async rollbackDatabase(steps: number = 1, config: LaravelDbConfig = {}): Promise<void> {
    const args = [`--step=${steps}`];
    if (config.database) {
      args.push('--database=' + config.database);
    }
    
    await this.runArtisanCommand('migrate:rollback', args);
  }

  // Route helpers
  async visitRoute(routeName: string, params: Record<string, any> = {}): Promise<void> {
    try {
      const url = await this.page.evaluate((routeName, params) => {
        const w = window as any;

        // Try to use Laravel's route helper if available
        if (w.route && typeof w.route === 'function') {
          return w.route(routeName, params);
        }

        // Fallback: try to find route in Laravel Mix manifest or generate manually
        const route = (w.Laravel?.routes || {})[routeName];

        if (route) {
          let url = route;
          // Simple parameter replacement
          Object.keys(params).forEach(key => {
            url = url.replace('{' + key + '}', params[key]);
          });
          return url;
        }

        throw new Error('Route not found: ' + routeName);
      }, routeName, params) as string;
      await this.page.goto(url, { waitUntil: 'networkidle2' });
    } catch (error) {
      throw new Error(`Failed to visit route ${routeName}: ${error}`);
    }
  }

  // Cache management
  async clearCache(): Promise<void> {
    await this.runArtisanCommand('cache:clear');
  }

  async clearConfig(): Promise<void> {
    await this.runArtisanCommand('config:clear');
  }

  async clearRoute(): Promise<void> {
    await this.runArtisanCommand('route:clear');
  }

  async clearView(): Promise<void> {
    await this.runArtisanCommand('view:clear');
  }

  async clearAll(): Promise<void> {
    await Promise.all([
      this.clearCache(),
      this.clearConfig(),
      this.clearRoute(),
      this.clearView(),
    ]);
  }

  // Queue management
  async runQueue(queue?: string): Promise<void> {
    const args = queue ? ['--queue=' + queue] : [];
    await this.runArtisanCommand('queue:work', [...args, '--stop-when-empty']);
  }

  async clearFailedJobs(): Promise<void> {
    await this.runArtisanCommand('queue:flush');
  }

  // Environment helpers
  async getEnvironment(): Promise<string> {
    const envScript = `
      (async () => {
        // Try to get environment from Laravel global
        if (window.Laravel && window.Laravel.env) {
          return window.Laravel.env;
        }
        
        // Try to get from meta tag
        const envMeta = document.querySelector('meta[name="env"]');
        if (envMeta) {
          return envMeta.getAttribute('content');
        }
        
        return 'unknown';
      })()
    `;

    return await this.page.evaluate(envScript) as string;
  }

  async isDebugMode(): Promise<boolean> {
    const debugScript = `
      (async () => {
        // Check Laravel debug mode
        if (window.Laravel && typeof window.Laravel.debug !== 'undefined') {
          return window.Laravel.debug;
        }
        
        // Check for debug indicators in page
        const debugElements = document.querySelectorAll('.sf-toolbar, #debugbar, .phpdebugbar');
        return debugElements.length > 0;
      })()
    `;

    return await this.page.evaluate(debugScript) as boolean;
  }
}