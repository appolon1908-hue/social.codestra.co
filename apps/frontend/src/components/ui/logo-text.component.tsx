import React from 'react';
import Image from 'next/image';

export const LogoTextComponent = () => (
  <a
    href="https://social.codestra.co"
    aria-label="Codestra home"
    className="inline-flex min-h-[44px] items-center gap-2 text-white no-underline"
  >
    <Image
      src="/codestra-wordmark.png"
      width={242}
      height={45}
      className="h-10 w-auto max-w-[220px] object-contain"
      alt="Codestra"
      priority
    />
  </a>
);
