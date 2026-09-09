import { redirect } from 'next/navigation';
import { Role } from '@prisma/client';
import { atLeast, getSessionUser } from '@/lib/authz';
import { ReviewQueue } from '@/components/ReviewQueue';
import { getT } from '@/i18n/server';

export const dynamic = 'force-dynamic';

export default async function ReviewPage() {
  const user = await getSessionUser();
  if (!user) redirect('/signin?next=/admin/review');
  if (!atLeast(user.role, Role.REVIEWER)) redirect('/dashboard');

  const { t } = await getT();

  return (
    <div className="mx-auto max-w-4xl px-4 py-6">
      <h1 className="text-2xl font-bold">{t('review.title')}</h1>
      <p className="mt-1 text-stone-600">{t('review.subtitle')}</p>
      <ReviewQueue />
    </div>
  );
}
