/**
 * T7.1 — Auth.js with an email magic link. No passwords, anywhere.
 *
 * Session strategy is JWT rather than database sessions: the adapter is still
 * needed (the magic-link flow stores verification tokens), but a JWT keeps the
 * hot path free of a session lookup on every request. The trade-off is that a
 * role change takes effect on the next token refresh; `ROLE_REFRESH_MS` bounds
 * that window, and `requireRole` re-reads from the database for anything
 * destructive.
 */
import NextAuth, { type NextAuthConfig } from 'next-auth';
import { Role } from '@prisma/client';
import { PrismaAdapter } from '@auth/prisma-adapter';
import Nodemailer from 'next-auth/providers/nodemailer';
import Credentials from 'next-auth/providers/credentials';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { env } from '@/env';
import { logger } from '@/lib/logger';
import { consume } from '@/lib/rate-limit';
import { operatorConfig, verifyOperator } from '@/lib/operator-credentials';

const ROLE_REFRESH_MS = 5 * 60 * 1000;

/** The claims this app adds to the session token. */
type AppClaims = {
  uid?: string;
  role?: Role;
  roleCheckedAt?: number;
  name?: string;
  email?: string;
};

const providers: NextAuthConfig['providers'] = [];

/**
 * Provider ids are declared here and used both to register the provider and to
 * drive the sign-in page, so the two can never disagree.
 *
 * They cannot be read back off the provider object: `Credentials({ id })`
 * returns a config whose `id` is still the factory default until Auth.js
 * normalises it, so trusting `provider.id` sends the browser to a callback URL
 * that does not exist and the user back to /signin with no explanation.
 */
const EMAIL_PROVIDER_ID = 'nodemailer';
const DEV_PROVIDER_ID = 'dev-login';
const OPERATOR_PROVIDER_ID = 'operator';

let emailProviderId: string | null = null;
let devProviderId: string | null = null;
let operatorProviderId: string | null = null;

if (env.EMAIL_SERVER) {
  providers.push(
    Nodemailer({
      id: EMAIL_PROVIDER_ID,
      server: env.EMAIL_SERVER,
      from: env.EMAIL_FROM,
    }),
  );
  emailProviderId = EMAIL_PROVIDER_ID;
}

/**
 * Local development without an SMTP server: type an email, get signed in. It is
 * refused outright in production even if someone sets the flag by mistake —
 * this is the kind of switch that ends up in a staging env file and then in a
 * production one.
 */
if (env.AUTH_DEV_LOGIN && env.NODE_ENV !== 'production') {
  const provider = Credentials({
    id: DEV_PROVIDER_ID,
    name: 'Developer sign-in',
    credentials: { email: { label: 'Email', type: 'email' } },
    async authorize(credentials) {
      const parsed = z.object({ email: z.email() }).safeParse(credentials);
      if (!parsed.success) return null;

      const email = parsed.data.email.toLowerCase();
      const user = await prisma.user.upsert({
        where: { email },
        update: {},
        create: { email, name: email.split('@')[0], emailVerified: new Date() },
      });
      logger.warn('dev login used', { email });
      return { id: user.id, email: user.email, name: user.name, role: user.role };
    },
  });

  providers.push(provider);
  devProviderId = DEV_PROVIDER_ID;
}

/**
 * Password sign-in for the single configured account (see
 * `src/lib/operator-credentials.ts`). Unlike the dev login this is allowed in
 * production, because its whole purpose is getting into a real deployment that
 * has no working mail server yet.
 */
const operator = operatorConfig(env.OPERATOR_EMAIL, env.OPERATOR_PASSWORD);

if (operator) {
  const provider = Credentials({
    id: OPERATOR_PROVIDER_ID,
    name: 'Email and password',
    credentials: {
      email: { label: 'Email', type: 'email' },
      password: { label: 'Password', type: 'password' },
    },
    async authorize(credentials) {
      const parsed = z
        .object({ email: z.string().min(1), password: z.string().min(1) })
        .safeParse(credentials);
      if (!parsed.success) return null;

      // A password form on a public URL gets guessed at. The limiter is keyed
      // on the submitted address rather than the configured one, so probing
      // with different addresses cannot be used to bypass it.
      const attempt = consume(`signin:operator:${parsed.data.email.toLowerCase()}`, 10, 60_000);
      if (!attempt.allowed) {
        logger.warn('operator sign-in rate limited', { email: parsed.data.email });
        return null;
      }

      if (!verifyOperator(operator, parsed.data)) {
        // Logged because repeated failures on a shared account are worth
        // noticing, and there is nobody else to notice them.
        logger.warn('operator sign-in rejected', { email: parsed.data.email });
        return null;
      }

      const user = await prisma.user.upsert({
        where: { email: operator.email },
        update: { role: env.OPERATOR_ROLE },
        create: {
          email: operator.email,
          name: operator.email.split('@')[0],
          role: env.OPERATOR_ROLE,
          // The password *is* the proof of address ownership here; there is no
          // link to click, so marking it verified is accurate rather than
          // generous.
          emailVerified: new Date(),
        },
      });

      logger.info('operator sign-in', { email: operator.email, role: user.role });
      return { id: user.id, email: user.email, name: user.name, role: user.role };
    },
  });

  providers.push(provider);
  operatorProviderId = OPERATOR_PROVIDER_ID;
}

export const authConfig: NextAuthConfig = {
  adapter: PrismaAdapter(prisma),
  providers,
  session: { strategy: 'jwt', maxAge: 30 * 24 * 60 * 60 },
  trustHost: env.AUTH_TRUST_HOST,
  secret: env.AUTH_SECRET,
  /**
   * Auth.js reports every provider-level failure to the browser as
   * `?error=Configuration`, which tells nobody anything — an unreachable SMTP
   * host and a genuinely malformed config look identical. The real cause only
   * exists here, so it goes through the structured logger rather than to a
   * bare console, and can be filtered out of Railway's log stream by level.
   */
  logger: {
    error(error) {
      logger.error('auth error', { error, name: error.name, cause: error.cause });
    },
    warn(code) {
      logger.warn('auth warning', { code });
    },
    debug(message, metadata) {
      logger.debug('auth debug', { message, metadata });
    },
  },
  pages: {
    signIn: '/signin',
    verifyRequest: '/signin/check-email',
    error: '/signin',
  },
  callbacks: {
    async jwt({ token, user }) {
      // `@auth/core`'s JWT is an open record and lives behind a re-export that
      // declaration merging cannot reach reliably, so the app's own claims are
      // described here instead of by module augmentation.
      const claims = token as AppClaims;

      if (user?.id) {
        claims.uid = user.id;
        claims.roleCheckedAt = 0;
      }

      const uid = claims.uid;
      const checkedAt = claims.roleCheckedAt ?? 0;
      if (uid && Date.now() - checkedAt > ROLE_REFRESH_MS) {
        const dbUser = await prisma.user.findUnique({
          where: { id: uid },
          select: { role: true, name: true, email: true },
        });
        if (dbUser) {
          claims.role = dbUser.role;
          claims.name = dbUser.name ?? undefined;
          claims.email = dbUser.email;
          claims.roleCheckedAt = Date.now();
        }
      }

      return token;
    },
    async session({ session, token }) {
      const claims = token as AppClaims;
      if (claims.uid) session.user.id = claims.uid;
      session.user.role = claims.role ?? Role.CONTRIBUTOR;
      return session;
    },
  },
};

export const { handlers, auth, signIn, signOut } = NextAuth(authConfig);

/** What the sign-in page can actually offer, and under which provider id. */
export const authMethods = { emailProviderId, devProviderId, operatorProviderId } as const;
