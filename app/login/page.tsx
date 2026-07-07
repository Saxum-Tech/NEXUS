/**
 * app/login/page.tsx
 * ─────────────────────────────────────────────────────────────
 * Server Component wrapper: fetches real branding from the
 * database before render so the login page shows the correct
 * app name and icon from first paint with no flash.
 * ─────────────────────────────────────────────────────────────
 */

import { getAppConfig } from '@/lib/config/get-app-config';
import { LoginForm } from './LoginForm';

import { env } from '@/lib/env';

export default async function LoginPage() {
  const config = await getAppConfig(env.defaultOrgId);
  return <LoginForm appName={config.app_name} iconLetter={config.icon_letter} />;
}
