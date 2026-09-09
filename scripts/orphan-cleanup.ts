/**
 * T6.4 — delete R2 objects with no TreePhoto row.
 *
 * Orphans happen for ordinary reasons: a contributor uploads a photo and then
 * abandons the form, or a create request fails after the upload succeeded.
 *
 * The grace period is the important part. An object uploaded five minutes ago
 * may belong to a form that is still open on someone's phone; deleting it
 * would break a submission that has not happened yet.
 */
import { PrismaClient } from '@prisma/client';
import { deleteObject, listObjects, storageEnabled } from '../src/lib/storage/r2';
import { logger } from '../src/lib/logger';

const prisma = new PrismaClient();

const GRACE_HOURS = Number.parseInt(process.env.ORPHAN_GRACE_HOURS ?? '24', 10);
const DRY_RUN = process.env.DRY_RUN === '1';

async function main() {
  if (!storageEnabled()) {
    logger.info('orphan cleanup skipped: photo storage is not configured');
    return;
  }

  const cutoff = new Date(Date.now() - GRACE_HOURS * 60 * 60 * 1000);
  let examined = 0;
  let deleted = 0;

  for await (const object of listObjects()) {
    examined += 1;
    if (object.lastModified && object.lastModified > cutoff) continue;

    const referenced = await prisma.treePhoto.findUnique({
      where: { storageKey: object.key },
      select: { id: true },
    });
    if (referenced) continue;

    if (DRY_RUN) {
      logger.info('orphan (dry run)', { key: object.key });
    } else {
      await deleteObject(object.key);
      logger.info('deleted orphan', { key: object.key });
    }
    deleted += 1;
  }

  logger.info('orphan cleanup finished', { examined, deleted, dryRun: DRY_RUN, graceHours: GRACE_HOURS });
}

main()
  .catch((error) => {
    logger.error('orphan cleanup failed', { error });
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
