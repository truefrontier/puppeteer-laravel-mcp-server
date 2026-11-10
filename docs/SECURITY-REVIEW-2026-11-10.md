# Security review: puppeteer-laravel-mcp-server (Nov 10, 2026)

## Bottom line

- **Four must-fix problems, all fixed on branch `overflow/mcp-input-safety`:**
  - shell injection through Herd commands;
  - screenshot paths that climb out of `screenshots/`;
  - page scripts built by pasting strings into source;
  - no argument checks at dispatch, although the README claimed "injection attack prevention".
- **Ten nice-to-fix items are listed.** The biggest: Chrome runs with its sandbox turned off, `.env` is read from whatever folder the client starts the server in, and production dependencies carry high and critical advisories.
- **Follow-up branch `overflow/mcp-hardening` (stacked on this one) fixes five more:**
  - a fifth must-fix: page console text written to stdout, the MCP protocol channel (#16);
  - the sandbox (#5);
  - the `.env` folder (#6);
  - the ignored `guard` (#14);
  - the undeclared `sessionId` (#11).
- **One functional bug turned up on the way.** Herd has no `artisan` command, so every Artisan-based tool fails against real Herd.
- **Nothing is published.** Users of `npx @truefrontier/puppeteer-laravel-mcp-server` get these fixes only after a new npm version ships. That is Kevin's call.

## Scope and method

- Fresh clone of `truefrontier/puppeteer-laravel-mcp-server` at `main` = `a33d63f` (0.2.2).
- I read every path from the MCP request to the shell, the file system and the page. That covers `src/core/mcp-server.ts`, `src/laravel/herd-integration.ts`, `src/tools/puppeteer-tools.ts`, `src/browser/pool.ts` and `src/core/config.ts`, plus the two install scripts.
- **Threat model:** the server is driven by an LLM agent. That agent reads web pages, which can carry prompt injection. So any tool argument may be chosen by a hostile page. The question for each input is: can it reach something more powerful than the page itself (the shell, the file system, other sites)?
- Line numbers below are from `a33d63f` unless a line says otherwise.

## Must-fix (fixed on this branch)

### 1. Shell injection through Herd commands

- **Where:** `src/laravel/herd-integration.ts:13-18`. `executeHerdCommand` built one string, `` `${command} --site=${siteName} ${args.join(' ')}` ``, and ran it through `exec`, which uses `/bin/sh`.
- **Reachable from:**
  - `laravel_artisan` `command` and `args` (`src/core/mcp-server.ts:196-205` schema, `:300-301` dispatch);
  - `laravel_db_seed` `seeder` and `database` (`mcp-server.ts:294-295` → `herd-integration.ts:141-148`);
  - `create_session` `siteName` (`mcp-server.ts:259-260` → constructor → `:14`).
- **Impact:** an argument such as `; touch x` or `$(...)` runs as a shell command with the user's full rights. This lets a hostile page move from the browser to the Mac.
- **Proven:** before the fix, the test's `; touch <tmp>/pwned` ran (the fake `herd` stub's folder got the file).
- **Fix:** `execFile(herdBinary, argv)` with no shell, so each argument reaches `herd` as literal text. Artisan command names must match `^[a-z][a-z0-9_-]*(:[a-z0-9_-]+)*$` (for example `migrate`, `db:seed`, `ide-helper:generate`).
- **Tests:** `src/laravel/herd-integration.test.ts`, "Herd commands run without a shell". They use a stub `herd` passed by absolute path, so the real Herd never runs.

### 2. Screenshot path climbs out of `screenshots/`

- **Where:** `src/tools/puppeteer-tools.ts:110-120`. The `path` argument of `screenshot` was joined onto `screenshots/` with no check.
- **Impact:** `../../.zshrc` (or any `../` path) overwrites a file the user can write with image bytes. That destroys data and can break a login shell.
- **Fix:** resolve the path, then require that it starts with `<cwd>/screenshots/`. Absolute paths and `../` are refused before the screenshot is taken. Subfolders such as `run-1/home.png` now work, because the parent folder is created.
- **Tests:** `src/tools/puppeteer-tools.test.ts`.

### 3. Page scripts built by pasting strings into source

- **Where:**
  - `loginAs`: `email` at `herd-integration.ts:69` and `:78`, `guardName` at `:71` and `:78`;
  - `actingAs`: `userId` and `guardName` at `:97-98` and `:105`;
  - `visitRoute`: `routeName` at `:176`, `:181` and `:192`.
- **Impact:** a value with a quote in it, such as `home', globalThis.x = 1, '`, runs as code in the page. On its own this matters less, because the `execute` tool already runs any script in the page. But it also breaks every route name or email that contains a quote. And it turns data the agent copied from one page into code on another.
- **Fix:** each script is now a function, and its inputs travel as `page.evaluate` arguments. Puppeteer sends them as JSON, so they stay data.
- **Tests:** `herd-integration.test.ts`, "page scripts take inputs as arguments". They run scripts in a separate `vm` realm the way Puppeteer does, so a function that closed over Node variables would fail too.

### 4. No argument checks at dispatch, and a README claim that said otherwise

- **Where:** `src/core/mcp-server.ts:253-305` cast every argument (`args?.x as string`) and never looked at the tool's `inputSchema`. `README.md:39` claimed "Input Validation: Injection attack prevention."
- **Impact:** `userId` could arrive as a string of code, `args` as a string instead of an array, and so on. Each tool trusted the type it was told.
- **Fix:**
  - The tool list moved to a module constant, `TOOLS`.
  - Dispatch now checks each call against its schema (type, enum, required, properties, array items) before anything runs. Undeclared keys such as `sessionId` still pass.
  - `laravel_artisan.args` now declares `items: { type: 'string' }`.
  - The README's Security Features list now says what is built and what is not.
- **Tests:** `src/core/mcp-server.test.ts`. They drive the real server over the SDK's in-memory transport, with a browser pool that throws if anything tries to launch Chrome.

## Nice-to-fix (not changed)

5. **Chrome runs with its sandbox off.** *Fixed on `overflow/mcp-hardening`: the sandbox stays on unless `CHROME_NO_SANDBOX=true`. Checked with a headless launch of the installed Chrome.*
   - `src/browser/pool.ts:16-27` passes `--no-sandbox`, `--disable-setuid-sandbox`, `--no-zygote` and `--single-process`.
   - `navigate` opens any URL. So a renderer bug on a hostile page lands in a process with the user's full rights.
   - These flags are meant for Linux containers that run as root. On a Mac they only remove protection.
   - Fix: drop them, then test with a real browser.
6. **`.env` is read from the current folder.** *Fixed on `overflow/mcp-hardening`: `.env` now loads from the package folder.*
   - `src/core/config.ts:4` calls `dotenv.config()`, which reads `.env` from wherever the MCP client starts the server.
   - `CHROME_PATH` from that file (`config.ts:10`, used at `pool.ts:31-33`) chooses the program Puppeteer launches.
   - If a client starts the server inside an untrusted repo, that repo's `.env` picks what runs.
   - Fix: load `.env` from the package folder, or take `CHROME_PATH` only from the real environment.
7. **Dependencies with advisories.**
   - `npm audit --omit=dev` (Nov 10, 2026) on the lockfile reports:
     - critical: `basic-ftp`;
     - high: `@modelcontextprotocol/sdk` 0.5.0 (`<=1.31.0`), `tar-fs`, `ws`, `extract-zip`, `js-yaml`, `ip-address` and `zod`;
     - moderate: `uuid`.
   - **Most of these don't reach npm users.** `package-lock.json` isn't published (`files` is `["dist"]`), so `npx` installs resolve fresh versions within the `package.json` ranges. `npm audit fix` shows in-range fixes for `basic-ftp`, `tar-fs`, `ws`, `js-yaml`, `ip-address` and `uuid`. A lockfile-only update would help only people working in this repo.
   - **Two need a breaking upgrade, and users do carry these:**
     - the SDK, to 1.32.2 (which also fixes the `zod` advisory);
     - Puppeteer, to 25 (for `extract-zip`).
   - The repo pinned both down on purpose for Node compatibility (`1638c9b`, `3d51af3`), so each upgrade needs its own test pass with a real browser.
   - I did not check whether the SDK advisories are reachable in stdio-only use.
8. **The install wrappers run an unpinned package.**
   - `install-claude-desktop.sh:15` and `install-claude-desktop-user.sh:19` both run `exec npx -y @truefrontier/puppeteer-laravel-mcp-server`.
   - Every launch runs whatever version is newest on npm. A bad publish, or a taken-over npm account, reaches every user at their next start.
   - Fix: pin a version.
9. **Symlinks inside `screenshots/`.**
   - The new check works on the path text. A symlink planted inside `screenshots/` can still point elsewhere.
   - Only someone who can already write to that folder can plant one. Accept this, or `realpath` the parent folder before writing.
10. **Artisan itself can run code.**
    - `laravel_artisan` still accepts `tinker --execute=...` and any custom command. That is what an Artisan tool is for.
    - If the agent shouldn't have that power, add an allowlist (for example, an env var listing allowed commands).
11. **Most tools don't declare `sessionId`.** *Fixed on `overflow/mcp-hardening`: every session tool now declares it.*
    - Every tool except `get_pool_stats` reads `args.sessionId`, but only `destroy_session` and `get_page_info` list it in `inputSchema` (`mcp-server.ts:221-240`).
    - Clients that follow the schema always use the shared `default` session.
12. **The README still overclaims elsewhere.**
    - `README.md:32-33` promises "HTTP+SSE" and "OAuth 2.1 authentication".
    - The HTTP transport throws "not yet implemented" (`mcp-server.ts:565`).

## Functional bugs found on the way (not security)

13. **Herd has no `artisan` command.**
    - `herd list` on this Mac (Nov 10, 2026) shows `php`, `composer` and `tinker`, but no `artisan`.
    - So `laravel_artisan`, `laravel_db_seed` and the cache and queue helpers all fail with `Command "artisan" is not defined`.
    - Likely fix: run `herd php artisan ...` from the site's folder.
    - I did not check whether `herd` accepts `--site=`.
14. **The `guard` argument is ignored.** *Fixed on `overflow/mcp-hardening`.*
    - Dispatch passes the raw arguments (`guard`) to `loginAs` and `actingAs`, which read `guardName` (`mcp-server.ts:289`, `:292`; `LaravelAuthConfig` in `src/core/types.ts`).
    - So every login uses the `web` guard.
15. **`laravel_auth_login` doesn't log in.**
    - It writes `localStorage` and fires a DOM event (`herd-integration.ts:55-90`).
    - Laravel's session login never reads either, so the server-side user doesn't change.
    - The README presents the tool as authentication.

## Found later (follow-up branch `overflow/mcp-hardening`)

16. **Page console text is written to stdout (must-fix, fixed there).**
    - `src/browser/pool.ts:92` printed every browser console message with `console.log` when `DEBUG_CONSOLE_LOGS=true`, and `.env.example` turns that on.
    - In stdio mode, stdout is the MCP protocol channel. A page can `console.log("\n{\"jsonrpc\":\"2.0\",...}")` and put a whole forged JSON-RPC message in front of the client: a fake tool result, or a request from the "server."
    - Fix: page console text goes to stderr. It was the only `console.log` in `src/`.

## How to check this branch

```bash
npm ci --ignore-scripts   # no Chrome download
npm test                  # 21 tests; no browser launches and Herd never runs
npm run build
```
