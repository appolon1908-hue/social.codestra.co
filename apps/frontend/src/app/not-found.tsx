import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#0b0b0b] p-6 text-white">
      <section className="max-w-lg rounded-[16px] border border-white/10 bg-[#171717] p-8 text-center">
        <p className="text-sm font-semibold text-[#ffe500]">404</p>
        <h1 className="mt-3 text-3xl font-semibold">Page not found</h1>
        <p className="mt-4 text-[#a1a1aa]">
          The Codestra page you requested could not be found.
        </p>
        <Link
          href="/"
          className="mt-8 inline-flex min-h-[44px] items-center rounded-full bg-[#ffe500] px-5 font-semibold text-black hover:bg-[#ffd700] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ffe500]"
        >
          Return home
        </Link>
      </section>
    </main>
  );
}
