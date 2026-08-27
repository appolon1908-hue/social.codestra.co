'use client';

import Image from 'next/image';

export const Logo = () => (
  <a
    href="/launches"
    aria-label="Codestra home"
    title="Codestra"
    className="mt-[8px] flex min-h-[60px] min-w-[60px] items-center justify-center rounded-[12px] border border-white/10 bg-[#171717] p-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ffe500]"
  >
    <Image
      src="/codestra-mark.png"
      width={44}
      height={44}
      className="h-11 w-11 object-contain"
      alt="Codestra"
      priority
    />
  </a>
);
