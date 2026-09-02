'use client';

import React, { Fragment, ReactNode, useCallback, useState } from 'react';
import { Logo } from '@gitroom/frontend/components/new-layout/logo';
import { Plus_Jakarta_Sans } from 'next/font/google';
const ModeComponent = dynamic(
  () => import('@gitroom/frontend/components/layout/mode.component'),
  {
    ssr: false,
  }
);

import clsx from 'clsx';
import dynamic from 'next/dynamic';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { useVariables } from '@gitroom/react/helpers/variable.context';
import { useSearchParams } from 'next/navigation';
import useSWR from 'swr';
import { CheckPayment } from '@gitroom/frontend/components/layout/check.payment';
import { ToolTip } from '@gitroom/frontend/components/layout/top.tip';
import { ShowMediaBoxModal } from '@gitroom/frontend/components/media/media.component';
import { ShowLinkedinCompany } from '@gitroom/frontend/components/launches/helpers/linkedin.component';
import { MediaSettingsLayout } from '@gitroom/frontend/components/launches/helpers/media.settings.component';
import { Toaster } from '@gitroom/react/toaster/toaster';
import { ShowPostSelector } from '@gitroom/frontend/components/post-url-selector/post.url.selector';
import { NewSubscription } from '@gitroom/frontend/components/layout/new.subscription';
import { Support } from '@gitroom/frontend/components/layout/support';
import { ContinueProvider } from '@gitroom/frontend/components/layout/continue.provider';
import { ContextWrapper } from '@gitroom/frontend/components/layout/user.context';
import { CopilotKit } from '@copilotkit/react-core';
import { MantineWrapper } from '@gitroom/react/helpers/mantine.wrapper';
import { Impersonate } from '@gitroom/frontend/components/layout/impersonate';
import { AnnouncementBanner } from '@gitroom/frontend/components/layout/announcement.banner';
import { Title } from '@gitroom/frontend/components/layout/title';
import { TopMenu } from '@gitroom/frontend/components/layout/top.menu';
import { LanguageComponent } from '@gitroom/frontend/components/layout/language.component';
import { ChromeExtensionComponent } from '@gitroom/frontend/components/layout/chrome.extension.component';
import NotificationComponent from '@gitroom/frontend/components/notifications/notification.component';
import { OrganizationSelector } from '@gitroom/frontend/components/layout/organization.selector';
import { StreakComponent } from '@gitroom/frontend/components/layout/streak.component';
import { PreConditionComponent } from '@gitroom/frontend/components/layout/pre-condition.component';
import { AttachToFeedbackIcon } from '@gitroom/frontend/components/new-layout/sentry.feedback.component';
import { FirstBillingComponent } from '@gitroom/frontend/components/billing/first.billing.component';
import { TrialTracker } from '@gitroom/frontend/components/layout/gtm.component';

const jakartaSans = Plus_Jakarta_Sans({
  weight: ['600', '500', '700'],
  style: ['normal', 'italic'],
  subsets: ['latin'],
});

export const LayoutComponent = ({ children }: { children: ReactNode }) => {
  const fetch = useFetch();

  const { backendUrl, billingEnabled, isGeneral, aiAgentEnabled } =
    useVariables();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const searchParams = useSearchParams();
  const load = useCallback(async (path: string) => {
    return await (await fetch(path)).json();
  }, []);
  const { data: user, mutate } = useSWR('/user/self', load, {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    revalidateIfStale: false,
    refreshWhenOffline: false,
    refreshWhenHidden: false,
  });

  if (!user) return null;

  return (
    <ContextWrapper user={user}>
      {aiAgentEnabled ? (
        <CopilotKit
          credentials="include"
          runtimeUrl={backendUrl + '/copilot/chat'}
          showDevConsole={false}
        >
          <ApplicationShell
            user={user}
            mutate={mutate}
            searchCheck={searchParams.get('check') || ''}
            mobileMenuOpen={mobileMenuOpen}
            setMobileMenuOpen={setMobileMenuOpen}
          >
            {children}
          </ApplicationShell>
        </CopilotKit>
      ) : (
        <ApplicationShell
          user={user}
          mutate={mutate}
          searchCheck={searchParams.get('check') || ''}
          mobileMenuOpen={mobileMenuOpen}
          setMobileMenuOpen={setMobileMenuOpen}
        >
          {children}
        </ApplicationShell>
      )}
    </ContextWrapper>
  );
};

const ApplicationShell = ({
  children,
  user,
  mutate,
  searchCheck,
  mobileMenuOpen,
  setMobileMenuOpen,
}: {
  children: ReactNode;
  user: any;
  mutate: () => Promise<any>;
  searchCheck: string;
  mobileMenuOpen: boolean;
  setMobileMenuOpen: (open: boolean) => void;
}) => {
  const { billingEnabled, isGeneral } = useVariables();
  return (
    <Fragment>
      <MantineWrapper>
        <ToolTip />
        <Toaster />
        <TrialTracker />
        <CheckPayment check={searchCheck} mutate={mutate}>
          <ShowMediaBoxModal />
          <ShowLinkedinCompany />
          <MediaSettingsLayout />
          <ShowPostSelector />
          <PreConditionComponent />
          <NewSubscription />
          <ContinueProvider />
          <div
            className={clsx(
              'hz-social-app-shell flex min-w-0 flex-col min-h-screen text-newTextColor p-[4px] md:p-[12px]',
              jakartaSans.className
            )}
          >
            <div>{user?.admin ? <Impersonate /> : <div />}</div>
            {user.tier === 'FREE' && isGeneral && billingEnabled ? (
              <FirstBillingComponent />
            ) : (
              <>
                <AnnouncementBanner />
                <div className="flex min-w-0 flex-1 gap-[8px]">
                  <Support />
                  <div className="hz-social-rail hidden md:flex flex-col bg-newBgColorInner w-[80px] rounded-[12px]">
                    <div
                      id="left-menu"
                      className={clsx(
                        'fixed h-full w-[64px] start-[17px] flex flex-1 top-0',
                        user?.admin && 'pt-[60px] max-h-[1000px]:w-[500px]'
                      )}
                    >
                      <div className="flex flex-col h-full gap-[32px] flex-1 py-[12px]">
                        <Logo />
                        <TopMenu />
                      </div>
                    </div>
                  </div>
                  {mobileMenuOpen && (
                    <div
                      className="fixed inset-0 z-[1000] bg-black/60 md:hidden"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      <nav
                        className="flex h-full w-[280px] max-w-[85vw] flex-col gap-8 bg-newBgColorInner p-4"
                        onClick={(event) => event.stopPropagation()}
                        aria-label="Mobile navigation"
                      >
                        <div className="flex items-center justify-between">
                          <Logo />
                          <button
                            type="button"
                            className="min-h-[44px] min-w-[44px] rounded-lg bg-btnSimple"
                            aria-label="Close navigation"
                            onClick={() => setMobileMenuOpen(false)}
                          >
                            ×
                          </button>
                        </div>
                        <TopMenu />
                      </nav>
                    </div>
                  )}
                  <div className="hz-social-main min-w-0 flex-1 bg-newBgLineColor rounded-[12px] overflow-hidden flex flex-col gap-[1px] blurMe">
                    <div className="hz-social-topbar flex bg-newBgColorInner min-h-[64px] md:h-[80px] px-[12px] md:px-[20px] items-center">
                      <button
                        type="button"
                        className="mr-3 min-h-[44px] min-w-[44px] rounded-lg bg-btnSimple md:hidden"
                        aria-label="Open navigation"
                        onClick={() => setMobileMenuOpen(true)}
                      >
                        ☰
                      </button>
                      <div className="flex min-w-0 flex-1 items-center gap-[12px]">
                        <div className="hz-social-product-identity hidden lg:flex">
                          <span className="hz-social-product-name">Codestra Social</span>
                          <span className="hz-social-domain">social.codestra.co</span>
                        </div>
                        <div className="min-w-0 truncate text-[18px] md:text-[24px] font-[600]">
                          <Title />
                        </div>
                      </div>
                      <div className="hidden md:flex gap-[20px] text-textItemBlur">
                        <StreakComponent />
                        <div className="w-[1px] h-[20px] bg-blockSeparator" />
                        <OrganizationSelector />
                        <div className="hover:text-newTextColor">
                          <ModeComponent />
                        </div>
                        <div className="w-[1px] h-[20px] bg-blockSeparator" />
                        <LanguageComponent />
                        <ChromeExtensionComponent />
                        <div className="w-[1px] h-[20px] bg-blockSeparator" />
                        <AttachToFeedbackIcon />
                        <NotificationComponent />
                      </div>
                    </div>
                    <div className="flex min-w-0 flex-1 gap-[1px] overflow-x-auto">
                      {children}
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </CheckPayment>
      </MantineWrapper>
    </Fragment>
  );
};
