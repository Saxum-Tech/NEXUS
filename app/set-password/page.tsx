/**
 * app/set-password/page.tsx
 * ─────────────────────────────────────────────────────────────
 * Server wrapper: fetches branding then renders the client form.
 * The token is read from searchParams and passed down so the
 * client form doesn't need direct URL access in a way that
 * would break SSR.
 * ─────────────────────────────────────────────────────────────
 */

import { getAppConfig } from '@/lib/config/get-app-config';
import { SetPasswordForm } from './SetPasswordForm';

import { env } from '@/lib/env';

export default async function SetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const config = await getAppConfig(env.defaultOrgId);
  const { token } = await searchParams;

  return (
    <SetPasswordForm
      appName={config.app_name}
      iconLetter={config.icon_letter}
      token={token ?? ''}
      enforceComplexity={config.enforce_password_complexity}
    />
  );
}
