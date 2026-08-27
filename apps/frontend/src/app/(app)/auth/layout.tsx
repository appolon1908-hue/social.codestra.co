import { getT } from '@gitroom/react/translation/get.translation.service.backend';

export const dynamic = 'force-dynamic';
import { ReactNode } from 'react';
import loadDynamic from 'next/dynamic';
import { LogoTextComponent } from '@gitroom/frontend/components/ui/logo-text.component';
const ReturnUrlComponent = loadDynamic(() => import('./return.url.component'));
export default async function AuthLayout({
  children,
}: {
  children: ReactNode;
}) {
  const t = await getT();

  return (
    <div className="codestra-shell bg-[#0b0b0b] flex flex-1 p-[12px] gap-[12px] min-h-screen w-screen text-white">
      {/*<style>{`html, body {overflow-x: hidden;}`}</style>*/}
      <ReturnUrlComponent />
      <div className="flex flex-col py-[40px] px-[20px] flex-1 lg:w-[600px] lg:flex-none rounded-[16px] border border-white/10 text-white p-[12px] bg-[#171717]">
        <div className="w-full max-w-[440px] mx-auto justify-center gap-[20px] h-full flex flex-col text-white">
          <LogoTextComponent />
          <div className="flex">{children}</div>
        </div>
      </div>
      <div className="text-[36px] flex-1 pt-[88px] hidden lg:flex flex-col items-center">
        <div className="text-center">
          {t('welcome_to_codestra_social', 'Welcome to Codestra')}
          <br />
          <span className="mt-4 block max-w-[720px] text-[20px] font-medium text-[#a1a1aa]">
            {t(
              'codestra_social_tagline',
              'Plan, create, schedule, and manage your social content from one secure workspace.'
            )}
          </span>
        </div>
        <div className="mt-auto pb-8 text-sm text-[#a1a1aa]">
          Powered by Codestra LLC · © 2026 Codestra LLC. All rights reserved.
        </div>
      </div>
    </div>
  );
}
