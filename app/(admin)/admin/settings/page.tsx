/**
 * app/(admin)/admin/settings/page.tsx
 * ─────────────────────────────────────────────────────────────
 * Loads the org's app_config via GET /api/admin/config, lets an
 * admin edit it, and PATCHes it back. On successful save, also
 * updates --color-brand on the live document immediately (in
 * addition to the database write) so the admin sees the effect
 * without a full page reload — the same CSS variable the root
 * layout sets server-side on every other page load.
 * ─────────────────────────────────────────────────────────────
 */

'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { Alert } from '@/components/ui/Alert';
import { PageShell } from '@/components/layout/PageShell';
import { TextField } from '@/components/ui/TextField';
import { UploadZone } from '@/components/ui/UploadZone';
import { Button } from '@/components/ui/Button';
import styles from './settings.module.css';

interface AppConfigForm {
  appName: string;
  supportEmail: string;
  defaultLanguage: string;
  timezone: string;
  primaryColor: string;
  iconLetter: string;
  logoUrl: string;
  faviconUrl: string;
  requirePasswordChangeOnFirstLogin: boolean;
  sessionTimeoutMinutes: number;
  enforcePasswordComplexity: boolean;
  limitConcurrentSessions: boolean;
}

const EMPTY_FORM: AppConfigForm = {
  appName: '',
  supportEmail: '',
  defaultLanguage: 'en',
  timezone: 'UTC',
  primaryColor: '#6c4de6',
  iconLetter: 'A',
  logoUrl: '',
  faviconUrl: '',
  requirePasswordChangeOnFirstLogin: true,
  sessionTimeoutMinutes: 30,
  enforcePasswordComplexity: true,
  limitConcurrentSessions: false,
};

export default function AdminSettingsPage() {
  const [form, setForm] = useState<AppConfigForm>(EMPTY_FORM);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const response = await fetch('/api/admin/config');
        const json = await response.json();
        if (!response.ok) {
          setError(json.error ?? 'Could not load settings.');
          return;
        }
        const c = json.config;
        setForm({
          appName: c.app_name,
          supportEmail: c.support_email ?? '',
          defaultLanguage: c.default_language,
          timezone: c.timezone,
          primaryColor: c.primary_color,
          iconLetter: c.icon_letter,
          logoUrl: c.logo_url ?? '',
          faviconUrl: c.favicon_url ?? '',
          requirePasswordChangeOnFirstLogin: c.require_password_change_on_first_login,
          sessionTimeoutMinutes: c.session_timeout_minutes,
          enforcePasswordComplexity: c.enforce_password_complexity,
          limitConcurrentSessions: c.limit_concurrent_sessions,
        });
      } catch {
        setError('Could not reach the server.');
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, []);

  function updateField<K extends keyof AppConfigForm>(key: K, value: AppConfigForm[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(false);
    setIsSaving(true);

    try {
      const response = await fetch('/api/admin/config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const json = await response.json();

      if (!response.ok) {
        setError(json.error ?? 'Could not save settings.');
        return;
      }

      // Reflect the new brand colour immediately, without a reload.
      // This mirrors exactly what app/layout.tsx does server-side
      // on every other page — see the comment there.
      document.documentElement.style.setProperty('--color-brand', form.primaryColor);

      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch {
      setError('Could not reach the server.');
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoading) {
    return <div className={styles.page}>Loading settings…</div>;
  }

  return (
    <PageShell title="App settings">

      {error && <Alert variant="danger" role="alert">{error}</Alert>}
      {success && <Alert variant="success">✓ Settings saved and applied.</Alert>}

      <form onSubmit={handleSubmit}>
        <div className={styles.panel}>
          <div className={styles.sectionTitle}>General</div>
          <div className={styles.row2}>
            <TextField
              label="App name"
              value={form.appName}
              onChange={(e) => updateField('appName', e.target.value)}
              required
            />
            <TextField
              label="Support email"
              type="email"
              value={form.supportEmail}
              onChange={(e) => updateField('supportEmail', e.target.value)}
            />
          </div>
        </div>

        <div className={styles.panel}>
          <div className={styles.sectionTitle}>Branding &amp; appearance</div>

          <div className={styles.previewBar}>
            <div className={styles.previewMark} style={{ background: form.primaryColor }}>
              {form.iconLetter || 'A'}
            </div>
            <div className={styles.previewName}>{form.appName || 'AppName'}</div>
            <div className={styles.previewLabel}>Live preview</div>
          </div>

          <div className={`${styles.row2} ${styles.uploadRow}`}>
            <div>
              <label className={styles.colorLabel}>App logo</label>
              <UploadZone
                asset="logo"
                currentUrl={form.logoUrl || null}
                onUploaded={(url) => updateField('logoUrl', url)}
                hint="PNG, SVG or WEBP · 200×200px recommended · max 2 MB"
              />
            </div>
            <div>
              <label className={styles.colorLabel}>Favicon</label>
              <UploadZone
                asset="favicon"
                currentUrl={form.faviconUrl || null}
                onUploaded={(url) => updateField('faviconUrl', url)}
                hint="PNG or ICO · 32×32px recommended · max 2 MB"
              />
            </div>
          </div>

          <div className={styles.fieldGap}>
            <label className={styles.colorLabel}>
              Primary brand colour
            </label>
            <div className={styles.colorRow}>
              <input
                type="color"
                className={styles.colorPicker}
                value={form.primaryColor}
                onChange={(e) => updateField('primaryColor', e.target.value)}
              />
              <input
                className={styles.hexInput}
                value={form.primaryColor}
                onChange={(e) => updateField('primaryColor', e.target.value)}
              />
              <span className={styles.colorHint}>
                Applied to buttons, accents, badges and focus states across the app.
              </span>
            </div>
          </div>

          <div className={styles.fieldGap}>
            <TextField
              label="Icon fallback letter"
              value={form.iconLetter}
              onChange={(e) => updateField('iconLetter', e.target.value.slice(0, 2).toUpperCase())}
              maxLength={2}
              hint="Shown when no logo is uploaded."
            />
          </div>
        </div>

        <div className={styles.panel}>
          <div className={styles.sectionTitle}>Security &amp; access</div>

          <div className={styles.checkRow}>
            <input
              type="checkbox"
              checked={form.requirePasswordChangeOnFirstLogin}
              onChange={(e) => updateField('requirePasswordChangeOnFirstLogin', e.target.checked)}
            />
            <div>
              <span className={styles.checkLabel}>Force password change on first login</span>
              <p className={styles.checkDesc}>
                New users must set their own password before accessing the app.
              </p>
            </div>
          </div>

          <div className={styles.checkRow}>
            <input
              type="checkbox"
              checked={form.enforcePasswordComplexity}
              onChange={(e) => updateField('enforcePasswordComplexity', e.target.checked)}
            />
            <div>
              <span className={styles.checkLabel}>Require password complexity</span>
              <p className={styles.checkDesc}>
                Minimum 12 characters with uppercase, lowercase, a number, and a special character.
              </p>
            </div>
          </div>

          <div className={styles.checkRow}>
            <input
              type="checkbox"
              checked={form.limitConcurrentSessions}
              onChange={(e) => updateField('limitConcurrentSessions', e.target.checked)}
            />
            <div>
              <span className={styles.checkLabel}>Limit concurrent sessions</span>
              <p className={styles.checkDesc}>
                Prevent users from being signed in on more than one device at a time.
              </p>
            </div>
          </div>
        </div>

        <Button type="submit" variant="primary" loading={isSaving}>
          Save &amp; apply
        </Button>
      </form>
    </PageShell>
  );
}
