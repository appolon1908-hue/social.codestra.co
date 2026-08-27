import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Open-source acknowledgments | Codestra',
  description: 'Open-source licensing and modification notice for Codestra.',
};

export default function OpenSourceAcknowledgments() {
  return (
    <main className="min-h-screen bg-[#0b0b0b] px-6 py-16 text-white">
      <article className="mx-auto max-w-3xl rounded-[16px] border border-white/10 bg-[#171717] p-8 leading-7">
        <h1 className="text-3xl font-semibold">Open-source acknowledgments</h1>
        <p className="mt-6 text-[#a1a1aa]">
          Codestra is a modified deployment based on the Postiz open-source
          project. The original software was not created by Codestra LLC.
        </p>
        <p className="mt-4 text-[#a1a1aa]">
          The upstream project is licensed under the GNU Affero General Public
          License, version 3. Codestra modifications remain subject to the
          applicable license and third-party notices.
        </p>
        <ul className="mt-6 list-disc space-y-3 pl-6">
          <li>
            <a
              className="underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#ffe500]"
              href="https://github.com/gitroomhq/postiz-app"
            >
              Upstream source and history
            </a>
          </li>
          <li>
            <a
              className="underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#ffe500]"
              href="https://github.com/gitroomhq/postiz-app/blob/main/LICENSE"
            >
              GNU AGPL-3.0 license
            </a>
          </li>
          <li>
            Codestra corresponding source location: pending publication of the
            Codestra fork repository.
          </li>
        </ul>
        <p className="mt-8 text-sm text-[#a1a1aa]">
          © 2026 Codestra LLC. Codestra modifications only. Upstream copyrights
          and license notices are preserved.
        </p>
        <Link
          className="mt-8 inline-flex min-h-[44px] items-center rounded-full bg-[#ffe500] px-5 font-semibold text-black hover:bg-[#ffd700] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ffe500]"
          href="/auth/login"
        >
          Return to Codestra
        </Link>
      </article>
    </main>
  );
}
