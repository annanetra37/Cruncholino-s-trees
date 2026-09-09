export default function CheckEmailPage() {
  return (
    <div className="mx-auto max-w-md px-4 py-16 text-center">
      <p className="text-4xl" aria-hidden>
        ✉️
      </p>
      <h1 className="mt-4 text-2xl font-bold">Check your email</h1>
      <p className="mt-2 text-stone-600">
        We sent you a sign-in link. It expires in 24 hours, and opening it on the same device keeps
        you signed in there.
      </p>
    </div>
  );
}
