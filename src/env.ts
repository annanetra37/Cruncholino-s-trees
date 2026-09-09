/**
 * T1.2 — the environment variable contract.
 *
 * Every variable the app reads is declared here, validated once, and exported
 * as a typed object. A missing or malformed variable kills the process at boot
 * with the variable's name in the message, rather than surfacing as
 * `undefined` three screens into a user's session.
 *
 * `next build` is exempt: the build step runs without runtime secrets on
 * Railway, and failing it would only turn a deploy-time configuration mistake
 * into a confusing build error.
 */
import { z } from 'zod';

const booleanish = z
  .union([z.boolean(), z.enum(['true', 'false', '1', '0'])])
  .transform((v) => v === true || v === 'true' || v === '1');

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),

  // --- Database -----------------------------------------------------------
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),

  // --- Auth ---------------------------------------------------------------
  AUTH_SECRET: z.string().min(16, 'AUTH_SECRET must be at least 16 characters'),
  AUTH_URL: z
    .url()
    .refine((value) => !value.includes('${{'), {
      // `https://${{RAILWAY_PUBLIC_DOMAIN}}` parses as a perfectly valid URL
      // whose host is the literal template, so `z.url()` alone accepts it and
      // the failure surfaces much later as an unexplained sign-in error.
      message:
        'AUTH_URL still contains an unexpanded ${{...}} reference — check the variable is spelled exactly as the platform expects',
    })
    .optional(),
  AUTH_TRUST_HOST: booleanish.default(true),
  EMAIL_SERVER: z.string().optional(),
  EMAIL_FROM: z.email().default('trees@example.org'),
  /** Dev-only shortcut: sign in by typing an email, no SMTP round trip. */
  AUTH_DEV_LOGIN: booleanish.default(false),

  // --- Geocoding ----------------------------------------------------------
  /**
   * Decided (Q2): a free provider.
   *
   *   nominatim — OpenStreetMap's own. Free, no key, the best address detail
   *               for Armenia. Its usage policy caps requests at one per
   *               second and forbids bulk use, which the throttle and the
   *               coordinate cache between them keep this app well inside.
   *   photon    — Komoot's OSM geocoder. Free, no key, no account, no hard
   *               rate limit published. The fallback if Nominatim starts
   *               refusing requests.
   *   maptiler  — paid, keyed. Here for the day the volume justifies it.
   *   none      — disables lookups; trees are stored with coordinates only.
   */
  GEOCODING_PROVIDER: z.enum(['nominatim', 'photon', 'maptiler', 'none']).default('nominatim'),
  GEOCODING_API_KEY: z.string().optional(),
  GEOCODING_BASE_URL: z.string().optional(),
  GEOCODING_USER_AGENT: z.string().default('cruncholino-trees/0.1 (+https://example.org)'),
  GEOCODING_TIMEOUT_MS: z.coerce.number().int().positive().default(3000),
  /** Minimum gap between outbound geocode calls. Nominatim's policy is 1/s. */
  GEOCODING_MIN_INTERVAL_MS: z.coerce.number().int().nonnegative().default(1100),

  // --- Map ----------------------------------------------------------------
  NEXT_PUBLIC_MAP_STYLE_URL: z.string().default('https://demotiles.maplibre.org/style.json'),
  NEXT_PUBLIC_MAP_TILES_KEY: z.string().optional(),
  NEXT_PUBLIC_MAP_DEFAULT_CENTER: z.string().default('44.5152,40.1872'),
  NEXT_PUBLIC_MAP_DEFAULT_ZOOM: z.coerce.number().default(11),

  // --- Object storage (Cloudflare R2) -------------------------------------
  R2_ACCOUNT_ID: z.string().optional(),
  R2_ACCESS_KEY_ID: z.string().optional(),
  R2_SECRET_ACCESS_KEY: z.string().optional(),
  R2_BUCKET: z.string().optional(),
  R2_PUBLIC_URL: z.string().optional(),

  // --- Behaviour switches -------------------------------------------------
  /**
   * T7.3, decided: the dashboard is login-gated. Tree locations — including
   * trees in private gardens — are visible only to people with an account.
   *
   * Setting this to `true` publishes every coordinate in the database to
   * anyone with the URL. That is a decision about other people's property, not
   * a configuration preference, so the default is the closed one.
   */
  PUBLIC_READ: booleanish.default(false),
  /**
   * Rounds coordinates to ~110 m for signed-out viewers. Only has any effect
   * when PUBLIC_READ is true — with the dashboard gated there are no
   * signed-out viewers to protect — and is kept for the case where opening it
   * up later is worth doing with a privacy margin.
   */
  FUZZ_PUBLIC_COORDINATES: booleanish.default(false),
  /** Decided: submissions publish immediately; no review queue in the path. */
  MODERATION_ENABLED: booleanish.default(false),
  /** T3.9: radius for the same-species duplicate warning. */
  DUPLICATE_RADIUS_M: z.coerce.number().positive().default(5),
  /** T3.3: above this many features the map gets clusters, not points. */
  MAX_GEOJSON_FEATURES: z.coerce.number().int().positive().default(5000),
  MAX_PAGE_SIZE: z.coerce.number().int().positive().default(200),
  RATE_LIMIT_WRITES_PER_MINUTE: z.coerce.number().int().positive().default(30),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
});

export type Env = z.infer<typeof envSchema>;

/**
 * `next build` collects pages without runtime configuration; so does a bare
 * `tsc`. Neither should be blocked by a missing production secret.
 */
const isBuildPhase =
  process.env.NEXT_PHASE === 'phase-production-build' || process.env.SKIP_ENV_VALIDATION === '1';

const buildPhaseFallbacks = {
  DATABASE_URL: 'postgresql://build:build@localhost:5432/build',
  AUTH_SECRET: 'build-time-placeholder-secret',
} as const;

function loadEnv(): Env {
  const source = isBuildPhase ? { ...buildPhaseFallbacks, ...process.env } : process.env;
  const parsed = envSchema.safeParse(source);

  if (!parsed.success) {
    const lines = parsed.error.issues.map((issue) => {
      const name = issue.path.join('.') || '(root)';
      return `  - ${name}: ${issue.message}`;
    });
    const message = ['Invalid environment configuration:', ...lines, '', 'See .env.example.'].join(
      '\n',
    );

    // Throwing here would be swallowed by a framework boundary and reported as
    // a generic 500. Exit loudly instead, on the server only.
    if (typeof window === 'undefined') {
      console.error(message);
      process.exit(1);
    }
    throw new Error(message);
  }

  return parsed.data;
}

export const env: Env = loadEnv();

export const isProduction = env.NODE_ENV === 'production';
export const isTest = env.NODE_ENV === 'test';

/** R2 is optional: without it the app runs fine, photo upload just refuses. */
export function r2Config() {
  const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET, R2_PUBLIC_URL } = env;
  if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET) return null;
  return {
    accountId: R2_ACCOUNT_ID,
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
    bucket: R2_BUCKET,
    publicUrl: R2_PUBLIC_URL ?? '',
  };
}
