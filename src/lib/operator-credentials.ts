/**
 * Password sign-in for a single configured account.
 *
 * The magic link needs a working mail server; this does not. It exists so a
 * deployment can be got into and used before SMTP is sorted out, and so it
 * stays usable if the mail provider goes down.
 *
 * The credentials come from the environment, never from source. A password in
 * a repository is a password for everyone who can read the repository, which
 * for a public project is everyone.
 *
 * What this is not: general password authentication. It is one shared account.
 * Contributors should get their own accounts through the magic link, because a
 * shared login makes the `created_by` column a lie — every tree looks like it
 * was recorded by the same person.
 */
import { createHash, timingSafeEqual } from 'node:crypto';

export type OperatorConfig = {
  email: string;
  password: string;
};

/**
 * Compares without leaking length or content through timing.
 *
 * Hashing first makes the two buffers the same size, which `timingSafeEqual`
 * requires — it throws on a length mismatch, and that throw would itself be an
 * observable signal about the password's length.
 */
export function secretsMatch(a: string, b: string): boolean {
  const hashA = createHash('sha256').update(a, 'utf8').digest();
  const hashB = createHash('sha256').update(b, 'utf8').digest();
  return timingSafeEqual(hashA, hashB);
}

/**
 * Passwords a person would plausibly copy out of documentation, which is
 * exactly how a bootstrap account ends up with the password `changeme` on a
 * public URL. Checked case-insensitively.
 */
const REFUSED_PASSWORDS = new Set([
  'password',
  'password123',
  'changeme',
  'change-me',
  'letmein',
  'admin',
  'admin123',
  'secret',
  'trees',
  'cruncholino',
  'qwerty',
  '12345678',
  '123456789',
  '1234567890',
  'your-password-here',
  'operator',
]);

export const MIN_OPERATOR_PASSWORD_LENGTH = 12;

export type OperatorConfigProblem = { code: string; message: string };

/**
 * Validates the configured pair. Returns the problems rather than throwing, so
 * `env.ts` can report all of them at once and the provider can simply not
 * register itself.
 */
export function validateOperatorConfig(
  email: string | undefined,
  password: string | undefined,
): OperatorConfigProblem[] {
  const problems: OperatorConfigProblem[] = [];

  // Half-configured is the dangerous state: it reads as "I set this up" while
  // the account silently does not exist.
  if (email && !password) {
    problems.push({
      code: 'missing_password',
      message: 'OPERATOR_EMAIL is set but OPERATOR_PASSWORD is not',
    });
  }
  if (password && !email) {
    problems.push({
      code: 'missing_email',
      message: 'OPERATOR_PASSWORD is set but OPERATOR_EMAIL is not',
    });
  }

  if (password) {
    if (password.length < MIN_OPERATOR_PASSWORD_LENGTH) {
      problems.push({
        code: 'too_short',
        message: `OPERATOR_PASSWORD must be at least ${MIN_OPERATOR_PASSWORD_LENGTH} characters`,
      });
    }
    if (REFUSED_PASSWORDS.has(password.toLowerCase())) {
      problems.push({
        code: 'guessable',
        message: 'OPERATOR_PASSWORD is one of the passwords everybody tries first',
      });
    }
  }

  return problems;
}

export function operatorConfig(
  email: string | undefined,
  password: string | undefined,
): OperatorConfig | null {
  if (!email || !password) return null;
  if (validateOperatorConfig(email, password).length > 0) return null;
  return { email: email.toLowerCase(), password };
}

/** Both fields are compared in constant time, so neither reveals the other. */
export function verifyOperator(
  config: OperatorConfig | null,
  submitted: { email: string; password: string },
): boolean {
  if (!config) return false;
  const emailOk = secretsMatch(config.email, submitted.email.trim().toLowerCase());
  const passwordOk = secretsMatch(config.password, submitted.password);
  return emailOk && passwordOk;
}
