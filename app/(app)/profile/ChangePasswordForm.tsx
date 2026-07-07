/**
 * app/(app)/profile/ChangePasswordForm.tsx
 * ─────────────────────────────────────────────────────────────
 * Self-service password change. POSTs to /api/auth/change-password
 * which validates against the org's enforce_password_complexity
 * setting server-side. Shows a live PasswordStrength meter so
 * users know what's required before submitting.
 * ─────────────────────────────────────────────────────────────
 */

'use client';

import { useState, type FormEvent } from 'react';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { PasswordStrength } from '@/components/ui/PasswordStrength';
import { TextField } from '@/components/ui/TextField';
import { Toast } from '@/components/ui/Toast';
import styles from './profile.module.css';

export function ChangePasswordForm() {
  const [newPassword, setNewPassword]       = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError]                   = useState<string | null>(null);
  const [fieldErrors, setFieldErrors]       = useState<Record<string, string>>({});
  const [toast, setToast]                   = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting]     = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setFieldErrors({});
    setIsSubmitting(true);

    try {
      const response = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newPassword, confirmPassword }),
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
          setError(data.error ?? 'Could not update password. Please try again.');
        }
        return;
      }

      setNewPassword('');
      setConfirmPassword('');
      setToast('Password updated successfully.');
    } catch {
      setError('Could not reach the server. Check your connection and try again.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <>
      <form onSubmit={handleSubmit}>
        {error && (
          <Alert variant="danger" role="alert" className={styles.feedback}>
            {error}
          </Alert>
        )}

        <div className={styles.formStack}>
          <div>
            <TextField
              label="New password"
              type="password"
              autoComplete="new-password"
              placeholder="Min. 12 characters"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              error={fieldErrors['newPassword']}
              required
            />
            <PasswordStrength password={newPassword} />
          </div>

          <TextField
            label="Confirm new password"
            type="password"
            autoComplete="new-password"
            placeholder="••••••••"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            error={fieldErrors['confirmPassword']}
            required
          />
        </div>

        <Button type="submit" variant="primary" size="sm" loading={isSubmitting}>
          Update password
        </Button>
      </form>

      {toast && <Toast message={toast} onDismiss={() => setToast(null)} />}
    </>
  );
}
