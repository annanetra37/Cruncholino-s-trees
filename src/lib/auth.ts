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
 * The ids the sign-in page needs. They are read back off the provider objects
 * rather than assumed: Auth.js does not necessarily keep the `id` passed in —
 * the Credentials provider reports itself as `credentials` whatever you call
 * it — and a hard-coded guess here shows the user "no sign-in method is
 * configured" on a perfectly working deployment.
 */
let emailProviderId: string | null = null;
let devProviderId: string | null = null;

if (env.EMAIL_SERVER) {
  const provider = Nodemailer({
    server: env.EMAIL_SERVER,
    from: env.EMAIL_FROM,
  });
  emailProviderId = provider.id ?? 'nodemailer';
  providers.push(provider);
}

/**
 * Local development without an SMTP server: type an email, get signed in. It is
 * refused outright in production even if someone sets the flag by mistake —
 * this is the kind of switch that ends up in a staging env file and then in a
 * production one.
 */
if (env.AUTH_DEV_LOGIN && env.NODE_ENV !== 'production') {
  const provider = Credentials({
    id: 'dev-login',
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

  devProviderId = provider.id ?? 'credentials';
  providers.push(provider);
}

export const authConfig: NextAuthConfig = {
  adapter: PrismaAdapter(prisma),
  providers,
  session: { strategy: 'jwt', maxAge: 30 * 24 * 60 * 60 },
  trustHost: env.AUTH_TRUST_HOST,
  secret: env.AUTH_SECRET,
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
export const authMethods = { emailProviderId, devProviderId } as const;
