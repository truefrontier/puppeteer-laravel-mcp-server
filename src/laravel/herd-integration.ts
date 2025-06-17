import { exec } from 'child_process';
import { promisify } from 'util';
import { laravelHerdConfig } from '../core/config.js';
import { LaravelAuthConfig, LaravelDbConfig } from '../core/types.js';
import { Page } from 'puppeteer';

const execAsync = promisify(exec);

export class LaravelHerdIntegration {
  constructor(private page: Page, private siteName?: string) {}

  async executeHerdCommand(command: string, args: string[] = []): Promise<string> {
    const fullCommand = this.siteName 
      ? `${command} --site=${this.siteName} ${args.join(' ')}`
      : `${command} ${args.join(' ')}`;
    
    try {
      const { stdout, stderr } = await execAsync(fullCommand);
      if (stderr) {
        console.warn(`Herd command warning: ${stderr}`);
      }
      return stdout.trim();
    } catch (error) {
      throw new Error(`Herd command failed: ${error}`);
    }
  }

  async getPhpVersion(): Promise<string> {
    return await this.executeHerdCommand('herd php', ['-v']);
  }

  async runArtisanCommand(command: string, args: string[] = []): Promise<string> {
    return await this.executeHerdCommand('herd artisan', [command, ...args]);
  }

  async runComposerCommand(command: string, args: string[] = []): Promise<string> {
    return await this.executeHerdCommand('herd composer', [command, ...args]);
  }

  async secureSite(): Promise<void> {
    if (!this.siteName) {
      throw new Error('Site name required for SSL security');
    }
    await this.executeHerdCommand('herd secure', [this.siteName]);
  }

  async unsecureSite(): Promise<void> {
    if (!this.siteName) {
      throw new Error('Site name required for SSL unsecurity');
    }
    await this.executeHerdCommand('herd unsecure', [this.siteName]);
  }

  // Laravel-specific authentication helpers
  async loginAs(email: string, config: LaravelAuthConfig = {}): Promise<void> {
    const loginScript = `
      (async () => {
        // First, try to find CSRF token
        const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') ||
                         document.querySelector('input[name="_token"]')?.value;
        
        // Inject authentication state
        if (window.Laravel && window.Laravel.csrfToken) {
          window.Laravel.csrfToken = csrfToken;
        }
        
        // Set session data via localStorage for SPA compatibility
        localStorage.setItem('laravel_auth_user', JSON.stringify({
          email: '${email}',
          authenticated: true,
          guard: '${config.guardName || 'web'}',
          timestamp: new Date().toISOString()
        }));
        
        // Trigger authentication events if available
        if (window.dispatchEvent) {
          window.dispatchEvent(new CustomEvent('laravel:auth:login', {
            detail: { email: '${email}', guard: '${config.guardName || 'web'}' }
          }));
        }
        
        return true;
      })()
    `;

    await this.page.evaluate(loginScript);
    
    // Reload page to apply authentication state
    await this.page.reload({ waitUntil: 'networkidle2' });
  }

  async actingAs(userId: number, config: LaravelAuthConfig = {}): Promise<void> {
    const actingAsScript = `
      (async () => {
        // Set acting as user data
        localStorage.setItem('laravel_acting_as', JSON.stringify({
          userId: ${userId},
          guard: '${config.guardName || 'web'}',
          timestamp: new Date().toISOString()
        }));
        
        // Trigger acting as events
        if (window.dispatchEvent) {
          window.dispatchEvent(new CustomEvent('laravel:auth:acting-as', {
            detail: { userId: ${userId}, guard: '${config.guardName || 'web'}' }
          }));
        }
        
        return true;
      })()
    `;

    await this.page.evaluate(actingAsScript);
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
    const routeScript = `
      (async () => {
        // Try to use Laravel's route helper if available
        if (window.route && typeof window.route === 'function') {
          return window.route('${routeName}', ${JSON.stringify(params)});
        }
        
        // Fallback: try to find route in Laravel Mix manifest or generate manually
        const routes = window.Laravel?.routes || {};
        const route = routes['${routeName}'];
        
        if (route) {
          let url = route;
          // Simple parameter replacement
          Object.keys(${JSON.stringify(params)}).forEach(key => {
            url = url.replace('{' + key + '}', ${JSON.stringify(params)}[key]);
          });
          return url;
        }
        
        throw new Error('Route not found: ${routeName}');
      })()
    `;

    try {
      const url = await this.page.evaluate(routeScript) as string;
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