/**
 * app/login/LoginForm.tsx
 * ─────────────────────────────────────────────────────────────
 * Client component: the actual login form UI and API call.
 * Receives branding as props from the server-rendered page.tsx
 * so the correct name/icon renders on first paint.
 * ─────────────────────────────────────────────────────────────
 */

'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Alert } from '@/components/ui/Alert';
import { TextField } from '@/components/ui/TextField';
import { Button } from '@/components/ui/Button';
import styles from './login.module.css';

interface LoginFormProps {
  appName: string;
  iconLetter: string;
}

export function LoginForm({ appName, iconLetter }: LoginFormProps) {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [timeoutExpired] = useState(
    typeof window !== 'undefined' &&
      new URLSearchParams(window.location.search).get('reason') === 'timeout'
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error ?? 'Something went wrong. Please try again.');
        return;
      }

      router.push(data.redirectTo ?? '/dashboard');
      router.refresh();
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

        <h1 className={styles.title}>Sign in</h1>
        <p className={styles.subtitle}>
          Use your assigned username and password to access this system.
        </p>

        {timeoutExpired && (
          <Alert variant="info">
            Your session expired due to inactivity. Please sign in again.
          </Alert>
        )}

        <Alert variant="info">
          This is a closed system. Access is by invitation only — contact your
          administrator if you need an account.
        </Alert>

        {error && (
          <Alert variant="danger" role="alert">
            {error}
          </Alert>
        )}

        <form onSubmit={handleSubmit}>
          <div className={styles.fieldStack}>
            <TextField
              label="Username"
              type="text"
              autoComplete="username"
              placeholder="your.username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              autoFocus
            />
            <TextField
              label="Password"
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              hint="Forgot your password? Contact your administrator to reset it."
              required
            />
          </div>

          <Button type="submit" variant="primary" fullWidth loading={isSubmitting}>
            Sign in
          </Button>
        </form>
      </div>
    </div>
  );
}
