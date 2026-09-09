/**
 * Grant a role to an existing user.
 *
 *   pnpm exec tsx scripts/set-role.ts you@example.org ADMIN
 *
 * The first person to sign in to a new deployment is a CONTRIBUTOR like
 * everyone else — there is no bootstrap admin, because an account that exists
 * before anyone has authenticated is an account nobody has authenticated as.
 * This is the deliberate step that promotes a real, signed-in person instead.
 *
 * On Railway:  railway run --service web pnpm exec tsx scripts/set-role.ts you@example.org ADMIN
 */
import { PrismaClient, Role } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const [email, roleArg] = process.argv.slice(2);

  if (!email || !roleArg) {
    console.error('Usage: tsx scripts/set-role.ts <email> <CONTRIBUTOR|REVIEWER|ADMIN>');
    process.exitCode = 1;
    return;
  }

  const role = roleArg.toUpperCase() as Role;
  if (!Object.values(Role).includes(role)) {
    console.error(`Unknown role "${roleArg}". Valid roles: ${Object.values(Role).join(', ')}`);
    process.exitCode = 1;
    return;
  }

  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (!user) {
    // Creating the user here would produce an account nobody has proved they
    // own — sign in first, then run this.
    console.error(`No user with email "${email}". Sign in through the app first, then re-run.`);
    process.exitCode = 1;
    return;
  }

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { role },
    select: { email: true, role: true },
  });

  console.log(`${updated.email} is now ${updated.role}.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
