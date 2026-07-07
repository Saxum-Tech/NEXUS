/**
 * app/(admin)/admin/users/invite/page.tsx
 * ─────────────────────────────────────────────────────────────
 * Admin-facing form that calls POST /api/admin/users/invite.
 * On success, displays the generated setup link directly in the
 * UI (with a copy button) as a fallback/visible confirmation —
 * useful in early deployments before a transactional email
 * provider is wired up in lib/email/send-invite-email.ts, and
 * generally helpful so the admin always has the link on hand
 * even after an email is sent.
 * ─────────────────────────────────────────────────────────────
 */

'use client';

import { useState, type FormEvent } from 'react';
import { Alert } from '@/components/ui/Alert';
import { Card } from '@/components/ui/Card';
import { PageShell } from '@/components/layout/PageShell';
import { Select } from '@/components/ui/Select';
import { TextField } from '@/components/ui/TextField';
import { Button } from '@/components/ui/Button';
import { APP_ROLES, ROLE_LABELS, ROLE_DESCRIPTIONS, type AppRole } from '@/lib/auth/roles';
import styles from './invite.module.css';

interface InviteSuccessResult {
  user: { id: string; username: string; displayName: string; role: AppRole };
  setupUrl: string;
  setupLinkExpiresAt: string;
}

export default function InviteUserPage() {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [username, setUsername] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [department, setDepartment] = useState('');
  const [role, setRole] = useState<AppRole>('viewer');

  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<InviteSuccessResult | null>(null);
  const [copied, setCopied] = useState(false);

  // Assignable roles excludes super_admin for everyone except an
  // actual super_admin — the server enforces this too (defense in
  // depth), but hiding the option here avoids a confusing 403.
  // In a real app, pass the current user's role down from the
  // server layout/page and call canAssignRole() here instead of
  // hardcoding the exclusion.
  const assignableRoles = APP_ROLES.filter((r) => r !== 'super_admin');

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const response = await fetch('/api/admin/users/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName,
          lastName,
          username,
          contactEmail,
          department,
          role,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error ?? 'Could not send the invite. Please try again.');
        return;
      }

      setResult(data);
      // Reset form for the next invite.
      setFirstName('');
      setLastName('');
      setUsername('');
      setContactEmail('');
      setDepartment('');
      setRole('viewer');
    } catch {
      setError('Could not reach the server. Check your connection and try again.');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleCopyLink() {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result.setupUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API can fail in non-HTTPS/non-secure contexts —
      // the link is still selectable text in the input, so this
      // is a soft failure, not a blocker.
    }
  }

  return (
    <PageShell title="Invite user">
      {error && <Alert variant="danger" role="alert">{error}</Alert>}

      {result && (
        <Alert variant="success">
          <div className={styles.successTitle}>
            ✓ Invite created for {result.user.displayName} ({result.user.username})
          </div>
          <p className={styles.successDesc}>
            Setup link expires {new Date(result.setupLinkExpiresAt).toLocaleString()}.
            {' '}If a contact email was provided, it has also been sent there.
          </p>
          <div className={styles.linkBox}>
            <input className={styles.linkInput} readOnly value={result.setupUrl} />
            <Button type="button" size="sm" onClick={handleCopyLink}>
              {copied ? 'Copied!' : 'Copy link'}
            </Button>
          </div>
        </Alert>
      )}

      <div className={styles.layout}>
        <div className={styles.card}>
          <div className={styles.cardTitle}>New user details</div>

          <div className={styles.infoBand}>
            <strong>Auto-generated auth email:</strong> a synthetic Supabase auth
            address is created automatically from the username. The user never
            sees or uses this address — they sign in with username + password only.
          </div>

          <form onSubmit={handleSubmit}>
            <div className={styles.row2}>
              <TextField
                label="First name"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="Jane"
                required
              />
              <TextField
                label="Last name"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Doe"
                required
              />
            </div>

            <div className={styles.fieldGap}>
              <TextField
                label="Username"
                value={username}
                onChange={(e) => setUsername(e.target.value.toLowerCase())}
                placeholder="jane.doe"
                hint="Lowercase letters, numbers, dots and hyphens only. This is what they'll type to sign in."
                required
              />
            </div>

            <div className={styles.fieldGap}>
              <TextField
                label="Contact email"
                type="email"
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
                placeholder="jane.doe@company.com"
                hint="For invite delivery and notifications only. Duplicate contact emails across users are allowed."
              />
            </div>

            <div className={styles.fieldGap}>
              <TextField
                label="Department / team"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                placeholder="Engineering"
              />
            </div>

            <div className={styles.fieldGap}>
              <Select
                label="Role"
                value={role}
                onChange={(e) => setRole(e.target.value as AppRole)}
                hint="Determines what this user can access across the application."
              >
                {assignableRoles.map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABELS[r]} — {ROLE_DESCRIPTIONS[r]}
                  </option>
                ))}
              </Select>
            </div>

            <div className={styles.actions}>
              <Button type="submit" variant="primary" loading={isSubmitting}>
                Send invite
              </Button>
            </div>
          </form>
        </div>

        <div className={styles.sideStack}>
          <div className={styles.card}>
            <div className={styles.cardTitle}>How invites work</div>
            <div className={styles.stepItem}>
              <div className={styles.stepNum}>1</div>
              <div>
                <strong>Admin creates user</strong>
                <br />
                Username chosen, role assigned, synthetic auth email generated
                automatically.
              </div>
            </div>
            <div className={styles.stepItem}>
              <div className={styles.stepNum}>2</div>
              <div>
                <strong>Setup link sent</strong>
                <br />
                A secure link is emailed to their contact address. It expires in
                24 hours.
              </div>
            </div>
            <div className={styles.stepItem}>
              <div className={styles.stepNum}>3</div>
              <div>
                <strong>User sets password</strong>
                <br />
                They click the link and choose their own password — admins never
                see or set it directly.
              </div>
            </div>
            <div className={styles.stepItem}>
              <div className={styles.stepNum}>4</div>
              <div>
                <strong>Account active</strong>
                <br />
                From here on they sign in with username + password. No email
                involved.
              </div>
            </div>
          </div>
        </div>
      </div>
    </PageShell>
  );
}
