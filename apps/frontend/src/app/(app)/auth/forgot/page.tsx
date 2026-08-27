export const dynamic = 'force-dynamic';
import { Forgot } from '@gitroom/frontend/components/auth/forgot';
import { Metadata } from 'next';
export const metadata: Metadata = {
  title: 'Reset your Codestra password',
  description: 'Recover access to your Codestra account.',
};
export default async function Auth() {
  return <Forgot />;
}
