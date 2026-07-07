/**
 * app/layout.tsx
 * ─────────────────────────────────────────────────────────────
 * Root layout. Fetches the org's app_config server-side and
 * injects the brand colour as an inline <style> override of
 * --color-brand, plus sets the page title and favicon from the
 * same config. Because this runs on the server before any HTML
 * reaches the browser, there's no flash of default branding —
 * the very first paint already reflects what's stored in the
 * database.
 * ─────────────────────────────────────────────────────────────
 */

import type { Metadata } from 'next';
import { getAppConfig } from '@/lib/config/get-app-config';
import '@/styles/globals.css';

import { env } from '@/lib/env';

export async function generateMetadata(): Promise<Metadata> {
  const config = await getAppConfig(env.defaultOrgId);

  return {
    title: config.app_name,
    icons: config.favicon_url ? [{ url: config.favicon_url }] : undefined,
  };
}

export default async function RootLayout({ children }: { children: any }) {
  const config = await getAppConfig(env.defaultOrgId);

  return (
    <html lang={config.default_language}>
      <head>
        {/*
          Overrides --color-brand before any component renders.
          This is the entire mechanism by which "admin changes
          the brand colour in settings" becomes "every button,
          badge, and accent on the site updates" — every other
          colour in the design system derives from this one
          custom property (see styles/tokens.css).
        */}
        <style
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{
            __html: `:root { --color-brand: ${config.primary_color}; }`,
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
