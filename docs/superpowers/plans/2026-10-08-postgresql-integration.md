# PostgreSQL TypeORM Minimal Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade the complete monorepo toolchain/dependency set to the latest stable releases and add a non-blocking TypeORM/PostgreSQL readiness prototype without Docker.

**Architecture:** Nest loads and validates one `DATABASE_URL`, then registers one manually initialized TypeORM `DataSource`. A focused readiness service serializes lazy initialization and runs `SELECT 1`; liveness remains independent while `/internal/ready` maps database availability to 200/503.

**Tech Stack:** Node.js 26.11.1, pnpm 12.10.1, TypeScript 7.0.2, NestJS 12, `@nestjs/config`, `@nestjs/typeorm`, TypeORM, `pg`, Vitest, local PostgreSQL.

---

## File map

- Modify `package.json`: pin Node/pnpm with Volta and align engines/packageManager.
- Modify `apps/api/package.json`: update stable dependencies and add Nest config, Nest TypeORM, TypeORM, `pg`, and database smoke-test script.
- Modify `apps/web/package.json`: update TypeScript and Node types.
- Modify `pnpm-lock.yaml`: resolve the exact dependency graph.
- Create `.env.example`: document the single safe PostgreSQL setting.
- Create `apps/api/src/config/validate-environment.ts`: validate and sanitize startup configuration.
- Create `apps/api/test/validate-environment.spec.ts`: configuration contract tests.
- Create `apps/api/src/database/database.module.ts`: construct the manual TypeORM DataSource.
- Create `apps/api/src/database/database-readiness.service.ts`: initialize once, retry after failure, and probe.
- Create `apps/api/test/database-readiness.service.spec.ts`: service behavior tests.
- Create `apps/api/src/internal/internal.controller.ts`: readiness HTTP mapping.
- Create `apps/api/src/internal/internal.module.ts`: internal endpoint composition.
- Create `apps/api/test/readiness.spec.ts`: readiness routing tests.
- Create `apps/api/test/setup-env.ts`: deterministic non-secret URL for ordinary tests.
- Create `apps/api/vitest.smoke.config.ts`: isolated real-database smoke configuration.
- Create `apps/api/test/database.smoke.spec.ts`: real local PostgreSQL `SELECT 1` test.
- Modify `apps/api/vitest.config.ts`: load ordinary test environment setup and exclude smoke test.
- Modify `apps/api/src/app.module.ts`: compose config, database, health, and internal modules.
- Modify `apps/api/src/configure-app.ts`: exempt `/internal/ready` from the API prefix.
- Modify `apps/api/src/main.ts`: enable shutdown hooks.
- Modify `apps/api/test/health.spec.ts`: verify liveness remains independent.
- Modify `docs/PRD-fullstack-ai-ledger.md` and `docs/TECH-PLAN-fullstack-ai-ledger.md`: replace raw-`pg`/no-ORM/Docker decisions with approved TypeORM/local PostgreSQL decisions.

### Task 1: Upgrade runtime, package manager, and all existing dependencies

- [ ] **Step 1: Verify the current baseline**

Run:

```bash
pnpm check
```

Expected: contracts, typecheck, tests, and builds pass before dependency mutation.

- [ ] **Step 2: Install and pin the approved stable toolchain with Volta**

Run:

```bash
volta install node@26.11.1 pnpm@12.10.1
volta pin node@26.11.1 pnpm@12.10.1
```

Ensure root `package.json` contains:

```json
{
  "packageManager": "pnpm@12.10.1",
  "engines": {
    "node": "26.11.1",
    "pnpm": "12.10.1"
  },
  "volta": {
    "node": "26.11.1",
    "pnpm": "12.10.1"
  }
}
```

- [ ] **Step 3: Upgrade every current workspace dependency to npm latest stable**

Run:

```bash
pnpm --recursive update --latest
pnpm install
pnpm outdated --recursive
```

Expected: `pnpm outdated --recursive` reports no outdated direct dependency. Based on the registry snapshot taken during planning, TypeScript becomes `7.0.2` and `@types/node` becomes `26.6.4`; already-current direct dependencies retain their exact stable versions.

- [ ] **Step 4: Validate the upgraded baseline**

Run:

```bash
pnpm check
```

Expected: all existing checks pass. Fix only compatibility regressions required by the new stable versions.

### Task 2: Add strict DATABASE_URL validation

- [ ] **Step 1: Add exact database dependencies**

Run:

```bash
pnpm --filter @ledger/api add @nestjs/config@12.0.1 @nestjs/typeorm@12.0.2 typeorm@1.1.2 pg@8.23.1
pnpm --filter @ledger/api add -D @types/pg@8.23.1
```

Expected: exact versions appear in `apps/api/package.json` and lockfile.

- [ ] **Step 2: Write failing environment validation tests**

Create `apps/api/test/validate-environment.spec.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { validateEnvironment } from '../src/config/validate-environment.js'

describe('validateEnvironment', () => {
  it('rejects a missing DATABASE_URL', () => {
    expect(() => validateEnvironment({})).toThrow('DATABASE_URL is required')
  })

  it('rejects non-PostgreSQL protocols without echoing the value', () => {
    const secret = 'mysql://private-user:private-password@localhost/ledger'
    expect(() => validateEnvironment({ DATABASE_URL: secret })).toThrow(
      'DATABASE_URL must use postgres:// or postgresql://',
    )

    try {
      validateEnvironment({ DATABASE_URL: secret })
    } catch (error) {
      expect(String(error)).not.toContain(secret)
      expect(String(error)).not.toContain('private-password')
    }
  })

  it.each([
    'postgres://localhost/ledger',
    'postgresql://ledger_user:encoded%20password@localhost:5432/ledger',
  ])('accepts %s', (databaseUrl) => {
    expect(validateEnvironment({ DATABASE_URL: databaseUrl })).toMatchObject({
      DATABASE_URL: databaseUrl,
    })
  })
})
```

- [ ] **Step 3: Run the test and verify the missing-module failure**

Run:

```bash
pnpm --filter @ledger/api exec vitest run test/validate-environment.spec.ts
```

Expected: FAIL because `src/config/validate-environment.ts` does not exist.

- [ ] **Step 4: Implement minimal validation**

Create `apps/api/src/config/validate-environment.ts`:

```ts
export function validateEnvironment(
  environment: Record<string, unknown>,
): Record<string, unknown> & { DATABASE_URL: string } {
  const databaseUrl = environment.DATABASE_URL
  if (typeof databaseUrl !== 'string' || databaseUrl.trim() === '') {
    throw new Error('DATABASE_URL is required')
  }

  let parsed: URL
  try {
    parsed = new URL(databaseUrl)
  } catch {
    throw new Error('DATABASE_URL must be a valid URL')
  }

  if (parsed.protocol !== 'postgres:' && parsed.protocol !== 'postgresql:') {
    throw new Error('DATABASE_URL must use postgres:// or postgresql://')
  }

  return { ...environment, DATABASE_URL: databaseUrl }
}
```

- [ ] **Step 5: Run the focused tests**

Run:

```bash
pnpm --filter @ledger/api exec vitest run test/validate-environment.spec.ts
```

Expected: PASS.

### Task 3: Add the manual TypeORM DataSource and readiness service

- [ ] **Step 1: Write failing readiness service tests**

Create `apps/api/test/database-readiness.service.spec.ts` with a structural `DataSource` test double. Cover these assertions:

```ts
expect(await service.isReady()).toBe(true)
expect(dataSource.initialize).toHaveBeenCalledTimes(1)
expect(dataSource.query).toHaveBeenCalledWith('SELECT 1')
```

Also use a deferred initialization Promise and `Promise.all([service.isReady(), service.isReady()])` to prove one initialization call, then reject one initialization and assert the next call retries. Add an initialized-DataSource case whose `query` rejects and assert `false`.

- [ ] **Step 2: Run the test and verify the missing-module failure**

Run:

```bash
pnpm --filter @ledger/api exec vitest run test/database-readiness.service.spec.ts
```

Expected: FAIL because the readiness service does not exist.

- [ ] **Step 3: Implement the readiness service**

Create `apps/api/src/database/database-readiness.service.ts`:

```ts
import { Injectable, Logger } from '@nestjs/common'
import { InjectDataSource } from '@nestjs/typeorm'
import { DataSource } from 'typeorm'

@Injectable()
export class DatabaseReadinessService {
  private readonly logger = new Logger(DatabaseReadinessService.name)
  private initializationPromise: Promise<DataSource> | undefined

  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async isReady(): Promise<boolean> {
    try {
      await this.ensureInitialized()
      await this.dataSource.query('SELECT 1')
      return true
    } catch {
      this.logger.warn('Database readiness check failed')
      return false
    }
  }

  private async ensureInitialized(): Promise<void> {
    if (this.dataSource.isInitialized) return

    const pending = (this.initializationPromise ??= this.dataSource.initialize())
    try {
      await pending
    } finally {
      if (this.initializationPromise === pending) this.initializationPromise = undefined
    }
  }
}
```

- [ ] **Step 4: Implement the database module**

Create `apps/api/src/database/database.module.ts`:

```ts
import { Module } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { TypeOrmModule, type TypeOrmModuleOptions } from '@nestjs/typeorm'
import { DatabaseReadinessService } from './database-readiness.service.js'

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService): TypeOrmModuleOptions => ({
        type: 'postgres',
        url: config.getOrThrow<string>('DATABASE_URL'),
        manualInitialization: true,
        synchronize: false,
        migrationsRun: false,
        entities: [],
        connectTimeoutMS: 3_000,
        extra: { query_timeout: 3_000 },
      }),
    }),
  ],
  providers: [DatabaseReadinessService],
  exports: [DatabaseReadinessService],
})
export class DatabaseModule {}
```

- [ ] **Step 5: Run service tests and typecheck**

Run:

```bash
pnpm --filter @ledger/api exec vitest run test/database-readiness.service.spec.ts
pnpm --filter @ledger/api run typecheck
```

Expected: PASS. The exported `TypeOrmModuleOptions` must accept `manualInitialization`, `connectTimeoutMS`, disabled synchronization, and the `pg` query timeout configuration exactly as written.

### Task 4: Add liveness/readiness HTTP composition

- [ ] **Step 1: Add deterministic ordinary-test environment setup**

Create `apps/api/test/setup-env.ts`:

```ts
process.env.DATABASE_URL ??= 'postgresql://localhost/ledger_unit_test'
```

Modify `apps/api/vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.spec.ts'],
    exclude: ['test/database.smoke.spec.ts'],
    setupFiles: ['test/setup-env.ts'],
  },
})
```

- [ ] **Step 2: Write failing readiness HTTP tests**

Create `apps/api/test/readiness.spec.ts`. Build a `TestingModule` from `AppModule`, override `DatabaseReadinessService` with `{ isReady: vi.fn() }`, and assert:

```ts
expect((await request(server).get('/internal/ready')).status).toBe(200)
expect((await request(server).get('/internal/ready')).body).toEqual({ status: 'ready' })
expect((await request(server).get('/api/v1/internal/ready')).status).toBe(404)
```

Set the mock to resolve `false` and assert exact status/body:

```ts
expect(response.status).toBe(503)
expect(response.body).toEqual({ status: 'not_ready' })
```

- [ ] **Step 3: Run the HTTP test and verify failure**

Run:

```bash
pnpm --filter @ledger/api exec vitest run test/readiness.spec.ts
```

Expected: FAIL because the internal module and route do not exist.

- [ ] **Step 4: Implement the internal controller and module**

Create `apps/api/src/internal/internal.controller.ts`:

```ts
import {
  Controller,
  Get,
  ServiceUnavailableException,
} from '@nestjs/common'
import {
  ApiOkResponse,
  ApiProperty,
  ApiServiceUnavailableResponse,
} from '@nestjs/swagger'
import { DatabaseReadinessService } from '../database/database-readiness.service.js'

class ReadyResponse {
  @ApiProperty({ enum: ['ready'] })
  status!: 'ready'
}

class NotReadyResponse {
  @ApiProperty({ enum: ['not_ready'] })
  status!: 'not_ready'
}

@Controller('internal')
export class InternalController {
  constructor(private readonly database: DatabaseReadinessService) {}

  @Get('ready')
  @ApiOkResponse({ type: ReadyResponse })
  @ApiServiceUnavailableResponse({ type: NotReadyResponse })
  async ready(): Promise<ReadyResponse> {
    if (!(await this.database.isReady())) {
      throw new ServiceUnavailableException({ status: 'not_ready' })
    }
    return { status: 'ready' }
  }
}
```

Create `apps/api/src/internal/internal.module.ts`:

```ts
import { Module } from '@nestjs/common'
import { DatabaseModule } from '../database/database.module.js'
import { InternalController } from './internal.controller.js'

@Module({ imports: [DatabaseModule], controllers: [InternalController] })
export class InternalModule {}
```

- [ ] **Step 5: Compose application modules and routes**

Replace `apps/api/src/app.module.ts` with:

```ts
import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { DatabaseModule } from './database/database.module.js'
import { HealthModule } from './health/health.module.js'
import { InternalModule } from './internal/internal.module.js'
import { validateEnvironment } from './config/validate-environment.js'

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      envFilePath: ['../../.env', '.env'],
      validate: validateEnvironment,
    }),
    DatabaseModule,
    HealthModule,
    InternalModule,
  ],
})
export class AppModule {}
```

Replace `apps/api/src/configure-app.ts` with:

```ts
import { RequestMethod, type INestApplication } from '@nestjs/common'

export function configureApp(app: INestApplication): void {
  app.setGlobalPrefix('api/v1', {
    exclude: [{ path: 'internal/ready', method: RequestMethod.GET }],
  })
}
```

Add `app.enableShutdownHooks()` before `listen()` in `apps/api/src/main.ts`.

- [ ] **Step 6: Preserve explicit liveness behavior**

Update `apps/api/test/health.spec.ts` so the testing module overrides `DatabaseReadinessService` with an `isReady` function that throws if called; retain the expected `200 { status: 'ok' }` assertion. This proves liveness does not touch PostgreSQL.

- [ ] **Step 7: Run focused HTTP tests**

Run:

```bash
pnpm --filter @ledger/api exec vitest run test/health.spec.ts test/readiness.spec.ts
```

Expected: PASS with exact liveness/readiness routes and bodies.

### Task 5: Add local PostgreSQL smoke test and environment example

- [ ] **Step 1: Add the safe environment example**

Create root `.env.example`:

```dotenv
DATABASE_URL=postgresql://ledger_user:replace-with-local-password@127.0.0.1:5432/ledger
```

Do not commit a real `.env`; the existing `.gitignore` already excludes it.

- [ ] **Step 2: Create an isolated smoke-test config**

Create `apps/api/vitest.smoke.config.ts`:

```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/database.smoke.spec.ts'],
  },
})
```

Create `apps/api/test/database.smoke.spec.ts`:

```ts
import 'reflect-metadata'
import { Test } from '@nestjs/testing'
import { afterAll, describe, expect, it } from 'vitest'
import type { TestingModule } from '@nestjs/testing'
import { AppModule } from '../src/app.module.js'
import { DatabaseReadinessService } from '../src/database/database-readiness.service.js'

let moduleRef: TestingModule | undefined

afterAll(async () => moduleRef?.close())

describe('local PostgreSQL smoke test', () => {
  it('connects and executes SELECT 1', async () => {
    moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile()
    const readiness = moduleRef.get(DatabaseReadinessService)
    await expect(readiness.isReady()).resolves.toBe(true)
  })
})
```

Add to `apps/api/package.json`:

```json
"test:db": "vitest run --config vitest.smoke.config.ts"
```

- [ ] **Step 3: Configure the ignored local `.env` for the installed PostgreSQL**

Use the default local PostgreSQL role and `postgres` database first. Create the ignored root `.env` without embedding credentials:

```dotenv
DATABASE_URL=postgresql://127.0.0.1:5432/postgres
```

This URL lets `pg` use its local role defaults. Verify the same target is reachable before running the smoke test:

```bash
psql "postgresql://127.0.0.1:5432/postgres" -Atqc 'SELECT 1'
pnpm --filter @ledger/api run test:db
```

Expected: both commands print/pass `1`. If the local installation requires password authentication, stop without printing credentials and report that a URL-encoded local credential must be placed manually in the ignored `.env`. Do not print or commit that value.

### Task 6: Align project documentation and run final verification

- [ ] **Step 1: Update approved architecture decisions in both project documents**

In `docs/PRD-fullstack-ai-ledger.md` and `docs/TECH-PLAN-fullstack-ai-ledger.md`:

- replace raw `pg` as the primary persistence abstraction with Nest TypeORM + PostgreSQL driver;
- replace “不用 ORM” statements with explicit TypeORM Entity/Repository usage while preserving SQL/transaction/index learning requirements;
- replace `DbModule` raw Pool ownership with one TypeORM `DataSource` and explicit transaction manager/query runner boundaries;
- remove Docker Compose from local environment instructions and specify local PostgreSQL through `DATABASE_URL`;
- retain parameterized queries, database constraints, migrations, `synchronize: false`, real PostgreSQL tests, authorization filters, and fixed money/time semantics.

- [ ] **Step 2: Verify there are no contradictory old decisions**

Run:

```bash
grep -RniE '不用 ORM|不以 ORM|原生 pg|pg 参数化|Docker Compose|单例 Pool|连接池.*pg' docs/PRD-fullstack-ai-ledger.md docs/TECH-PLAN-fullstack-ai-ledger.md
```

Expected: no statement still mandates raw `pg`, rejects ORM, or proposes Docker; mentions of TypeORM's PostgreSQL driver and parameterized SQL are allowed only when consistent with the new decision.

- [ ] **Step 3: Verify dependency freshness**

Run:

```bash
node --version
pnpm --version
pnpm outdated --recursive
```

Expected: Node `v26.11.1`, pnpm `12.10.1`, and no outdated direct dependency.

- [ ] **Step 4: Run the complete automated checks**

With a valid non-secret test `DATABASE_URL` available from root `.env`, run:

```bash
pnpm check
pnpm --filter @ledger/api run test:db
```

Expected: contracts generation, typechecks, all ordinary tests, API/Web builds, and the real PostgreSQL smoke test pass.

- [ ] **Step 5: Manually verify unavailable-database semantics without modifying PostgreSQL**

Run the API once with a valid-format URL targeting an unused local port:

```bash
DATABASE_URL=postgresql://127.0.0.1:1/ledger pnpm --filter @ledger/api run dev
```

From another shell, verify `/api/v1/health` returns 200 and `/internal/ready` returns 503 within the configured timeout. Stop the process normally and confirm no secret appears in HTTP output or logs.

No git commit is created unless the user explicitly requests one.
