/**
 * app/set-password/SetPasswordForm.tsx
 * ─────────────────────────────────────────────────────────────
 * Client component for the invite-acceptance and password-reset
 * flow. Token comes from the server wrapper (page.tsx) so it's
 * available on first render without a useSearchParams() call.
 * ─────────────────────────────────────────────────────────────
 */

'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Alert } from '@/components/ui/Alert';
import { TextField } from '@/components/ui/TextField';
import { Button } from '@/components/ui/Button';
import { PasswordStrength } from '@/components/ui/PasswordStrength';
import styles from '../login/login.module.css';

interface SetPasswordFormProps {
  appName: string;
  iconLetter: string;
  token: string;
  enforceComplexity?: boolean;
}

export function SetPasswordForm({ appName, iconLetter, token, enforceComplexity = true }: SetPasswordFormProps) {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setFieldErrors({});

    if (!token) {
      setError('This link is missing its setup token. Please use the exact link from your invite email.');
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch('/api/auth/set-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password, confirmPassword }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (data.issues) {
          const errs: Record<string, string> = {};
          for (const issue of data.issues as { field: string; message: string }[]) {
            errs[issue.field] = issue.message;
          }
          setFieldErrors(errs);
        } else {
          setError(data.error ?? 'Could not set your password. Please try again.');
        }
        return;
      }

      router.push('/login?setup=success');
    } catch {
      setError('Could not reach the server. Check your connection and try again.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.card}>
        <div className={styles.logoRow}>
          <div className={styles.logoMark}>{iconLetter}</div>
          <div className={styles.logoName}>{appName}</div>
        </div>

        <h1 className={styles.title}>Set your password</h1>
        <p className={styles.subtitle}>
          Choose a secure password to activate your account.
        </p>

        {!token && (
          <Alert variant="danger" role="alert">
            No setup token found in this link. Please use the exact link from
            your invite or password reset email.
          </Alert>
        )}

        {error && <Alert variant="danger" role="alert">{error}</Alert>}

        <form onSubmit={handleSubmit}>
          <div className={styles.fieldStack}>
            <div>
              <TextField
                label="New password"
                type="password"
                autoComplete="new-password"
                placeholder="Min. 12 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                error={fieldErrors['password']}
                required
                autoFocus
              />
              <PasswordStrength password={password} enforceComplexity={enforceComplexity} />
            </div>
            <TextField
              label="Confirm password"
              type="password"
              autoComplete="new-password"
              placeholder="••••••••"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              error={fieldErrors['confirmPassword']}
              required
            />
          </div>

          <Button
            type="submit"
            variant="primary"
            fullWidth
            loading={isSubmitting}
            disabled={!token}
          >
            Set password &amp; sign in
          </Button>
        </form>
      </div>
    </div>
  );
}
