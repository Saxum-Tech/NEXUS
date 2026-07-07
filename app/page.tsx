/**
 * app/page.tsx
 * ─────────────────────────────────────────────────────────────
 * Root route. Just redirects — there's no public marketing page
 * in this template since the whole app is behind invite-only
 * auth. Replace with a real landing page if you need one publicly
 * reachable; just keep it out of the (app)/(admin) route groups
 * so it isn't caught by their layout's session requirement.
 * ─────────────────────────────────────────────────────────────
 */

import { redirect } from 'next/navigation';
import { getSessionProfile } from '@/lib/auth/session';

export default async function RootPage() {
  const profile = await getSessionProfile();
  redirect(profile ? '/dashboard' : '/login');
}
