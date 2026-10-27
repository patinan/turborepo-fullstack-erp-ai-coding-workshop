import type { INestApplication } from '@nestjs/common';
import { Test, type TestingModuleBuilder } from '@nestjs/testing';
import { FIXTURE_PASSWORD } from '@erp/database';
import { AppModule } from '../app.module.js';
import { Clock } from '../clock/clock.js';

/** The real clock until a test fixes it with `set()`. */
export class TestClock extends Clock {
  private fixed: Date | null = null;

  override now(): Date {
    return this.fixed ? new Date(this.fixed) : new Date();
  }

  set(time: Date | null) {
    this.fixed = time;
  }
}

export type ApiResponse<T> = { status: number; body: T };

/** Sends requests to the running API as one caller: anonymous, or with a session cookie. */
export class ApiCaller {
  constructor(
    private readonly baseUrl: string,
    readonly cookie?: string,
  ) {}

  get<T = unknown>(path: string) {
    return this.send<T>('GET', path);
  }

  post<T = unknown>(path: string, body?: unknown) {
    return this.send<T>('POST', path, body);
  }

  async send<T = unknown>(method: string, path: string, body?: unknown): Promise<ApiResponse<T>> {
    const headers: Record<string, string> = {};
    if (this.cookie) headers.cookie = this.cookie;
    if (body !== undefined) headers['content-type'] = 'application/json';

    const response = await fetch(`${this.baseUrl}/api${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await response.text();
    return { status: response.status, body: (text ? JSON.parse(text) : undefined) as T };
  }
}

export type TestApi = {
  app: INestApplication;
  clock: TestClock;
  anonymous: ApiCaller;
  /** Sign in through `POST /auth/login` with the fixture password and return that caller. */
  signIn: (username: string) => Promise<ApiCaller>;
  close: () => Promise<void>;
};

/**
 * Start the whole API on a free port against the test database, as `main.ts` does.
 * `configure` can override providers, e.g. to make the database throw.
 */
export async function startApi(
  configure: (builder: TestingModuleBuilder) => TestingModuleBuilder = (builder) => builder,
): Promise<TestApi> {
  const clock = new TestClock();
  const moduleRef = await configure(
    Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(Clock)
      .useValue(clock),
  ).compile();

  const app = moduleRef.createNestApplication({ bodyParser: false, logger: false });
  app.setGlobalPrefix('api');
  await app.listen(0, '127.0.0.1');
  const baseUrl = await app.getUrl();
  const anonymous = new ApiCaller(baseUrl);

  async function signIn(username: string) {
    const response = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username, password: FIXTURE_PASSWORD }),
    });
    const cookie = response.headers.getSetCookie()[0]?.split(';')[0];
    if (response.status !== 200 || !cookie) {
      throw new Error(`Sign-in as ${username} failed with ${response.status}`);
    }
    return new ApiCaller(baseUrl, cookie);
  }

  return { app, clock, anonymous, signIn, close: () => app.close() };
}
