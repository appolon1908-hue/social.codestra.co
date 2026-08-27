'use client';

export default function GlobalError({ reset }: { reset: () => void }) {
  return (
    <html>
      <body className="bg-[#0b0b0b] text-white">
        <main className="flex min-h-screen items-center justify-center p-6">
          <section className="max-w-lg rounded-[16px] border border-white/10 bg-[#171717] p-8 text-center">
            <h1 className="text-3xl font-semibold">Codestra needs a moment</h1>
            <p className="mt-4 text-[#a1a1aa]">
              An unexpected error occurred. Your content has not been published
              by this page.
            </p>
            <button
              onClick={() => reset()}
              className="mt-8 min-h-[44px] rounded-full bg-[#ffe500] px-5 font-semibold text-black hover:bg-[#ffd700] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ffe500]"
            >
              Try again
            </button>
          </section>
        </main>
      </body>
    </html>
  );
}
