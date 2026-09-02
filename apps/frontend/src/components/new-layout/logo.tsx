'use client';

import Image from 'next/image';

export const Logo = () => (
  <a
    href="/launches"
    aria-label="Codestra Social home"
    title="Codestra Social — social.codestra.co"
    className="hz-social-logo mt-[8px] flex min-h-[60px] min-w-[60px] items-center justify-center border p-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
  >
    <Image
      src="/codestra-mark.png"
      width={44}
      height={44}
      className="h-11 w-11 object-contain"
      alt="Codestra Social"
      priority
    />
  </a>
);
