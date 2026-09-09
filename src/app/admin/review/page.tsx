import { redirect } from 'next/navigation';
import { Role } from '@prisma/client';
import { atLeast, getSessionUser } from '@/lib/authz';
import { ReviewQueue } from '@/components/ReviewQueue';

export const dynamic = 'force-dynamic';

export default async function ReviewPage() {
  const user = await getSessionUser();
  if (!user) redirect('/signin?next=/admin/review');
  if (!atLeast(user.role, Role.REVIEWER)) redirect('/dashboard');

  return (
    <div className="mx-auto max-w-4xl px-4 py-6">
      <h1 className="text-2xl font-bold">Review queue</h1>
      <p className="mt-1 text-stone-600">
        Submissions in draft or flagged for a second look.
      </p>
      <ReviewQueue />
    </div>
  );
}
