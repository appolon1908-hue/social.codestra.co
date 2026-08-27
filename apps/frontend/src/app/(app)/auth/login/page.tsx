export const dynamic = 'force-dynamic';
import { Login } from '@gitroom/frontend/components/auth/login';
import { Metadata } from 'next';
export const metadata: Metadata = {
  title: 'Sign in to Codestra',
  description:
    'Plan, create, schedule, and manage your social content from one secure workspace.',
};
export default async function Auth() {
  return <Login />;
}
