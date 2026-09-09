import { getT } from '@/i18n/server';

export default async function CheckEmailPage() {
  const { t } = await getT();

  return (
    <div className="mx-auto max-w-md px-4 py-16 text-center">
      <p className="text-4xl" aria-hidden>
        ✉️
      </p>
      <h1 className="mt-4 text-2xl font-bold">{t('signin.checkEmailTitle')}</h1>
      <p className="mt-2 text-stone-600">{t('signin.checkEmailBody')}</p>
    </div>
  );
}
