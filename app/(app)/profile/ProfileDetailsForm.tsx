/**
 * app/(app)/profile/ProfileDetailsForm.tsx
 * ─────────────────────────────────────────────────────────────
 * Editable personal details: display name + contact email.
 * Uses useApiMutation so loading/error state is handled
 * consistently without manual useState overhead.
 * ─────────────────────────────────────────────────────────────
 */

'use client';

import { useState, type FormEvent } from 'react';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/TextField';
import { Toast } from '@/components/ui/Toast';
import { useApiMutation } from '@/lib/hooks';
import styles from './profile.module.css';

interface ProfileDetailsFormProps {
  initialDisplayName: string;
  initialContactEmail: string | null;
  username: string;
}

export function ProfileDetailsForm({
  initialDisplayName,
  initialContactEmail,
  username,
}: ProfileDetailsFormProps) {
  const [displayName, setDisplayName]   = useState(initialDisplayName);
  const [contactEmail, setContactEmail] = useState(initialContactEmail ?? '');
  const [toast, setToast]               = useState<string | null>(null);
  const [fieldErrors, setFieldErrors]   = useState<Record<string, string>>({});

  const { mutate, isLoading, error, clearError } = useApiMutation(
    '/api/user/profile',
    'PATCH',
    {
      onSuccess: () => setToast('Profile updated successfully.'),
      onError: () => {
        /* error is surfaced via the `error` state from the hook */
      },
    }
  );

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    clearError();
    setFieldErrors({});

    const res = await fetch('/api/user/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ displayName, contactEmail }),
    });
    const data = await res.json();

    if (!res.ok) {
      if (data.issues) {
        const errs: Record<string, string> = {};
        for (const issue of data.issues as { field: string; message: string }[]) {
          errs[issue.field] = issue.message;
        }
        setFieldErrors(errs);
      }
      // non-validation error surfaced via hook's error state
      return;
    }

    setToast('Profile updated successfully.');
  }

  return (
    <>
      {error && (
        <Alert variant="danger" role="alert" className={styles.feedback}>
          {error}
        </Alert>
      )}

      <form onSubmit={handleSubmit}>
        <div className={styles.formStack}>
          <TextField
            label="Display name"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            error={fieldErrors['displayName']}
            required
          />

          <TextField
            label="Contact email"
            type="email"
            value={contactEmail}
            onChange={(e) => setContactEmail(e.target.value)}
            error={fieldErrors['contactEmail']}
            hint="Used for system notifications (invite links, password resets). Not used for login. Duplicates are allowed — multiple users can share an inbox."
          />

          <TextField
            label="Username"
            value={username}
            readOnly
            hint="Usernames can only be changed by an administrator."
          />
        </div>

        <Button type="submit" variant="primary" size="sm" loading={isLoading}>
          Save changes
        </Button>
      </form>

      {toast && <Toast message={toast} onDismiss={() => setToast(null)} />}
    </>
  );
}
