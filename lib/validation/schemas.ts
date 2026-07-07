/**
 * lib/validation/schemas.ts
 * ─────────────────────────────────────────────────────────────
 * Zod schemas for every Route Handler's request body. Parse
 * with these BEFORE touching the database — never trust a
 * request body's shape just because TypeScript types say so;
 * types vanish at runtime, Zod doesn't.
 * ─────────────────────────────────────────────────────────────
 */

import { z } from 'zod';
import { USERNAME_REGEX } from '@/lib/auth/synthetic-email';
import { APP_ROLES } from '@/lib/auth/roles';

export const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(5, 'Username must be at least 5 characters.')
  .max(40, 'Username must be at most 40 characters.')
  .regex(
    USERNAME_REGEX,
    'Use lowercase letters, numbers, dots or hyphens. Must start and end with a letter or number.'
  );

/**
 * Base length check, always enforced regardless of the
 * "enforce password complexity" org setting — 12 characters is
 * a floor, not something that toggle should be able to weaken.
 * The toggle only controls whether character-class rules
 * (upper/lower/number/special) are additionally required.
 */
const passwordMinLength = z
  .string()
  .min(12, 'Password must be at least 12 characters.');

/**
 * Builds the password schema to use for a given org, based on
 * its enforce_password_complexity setting (read from
 * app_config — see getAppConfig()). Route Handlers that accept
 * a new password (set-password, invite acceptance) must call
 * this rather than using a single static schema, so the toggle
 * in /admin/settings actually has an effect.
 */
export function buildPasswordSchema(enforceComplexity: boolean) {
  if (!enforceComplexity) return passwordMinLength;

  return passwordMinLength
    .regex(/[a-z]/, 'Password must include a lowercase letter.')
    .regex(/[A-Z]/, 'Password must include an uppercase letter.')
    .regex(/[0-9]/, 'Password must include a number.')
    .regex(/[^a-zA-Z0-9]/, 'Password must include a special character.');
}

// Strictest variant, used wherever no org context is available yet
// (e.g. scripts/seed-admin.ts, which runs before any app_config row
// is guaranteed to exist). Prefer buildPasswordSchema() in any
// request-handling code that has access to the org's config.
export const passwordSchema = buildPasswordSchema(true);

export const loginSchema = z.object({
  username: usernameSchema,
  password: z.string().min(1, 'Password is required.'),
});
export type LoginInput = z.infer<typeof loginSchema>;

/**
 * Builds the set-password request schema for a given org's
 * complexity setting. See buildPasswordSchema() above — this
 * just wraps it with the token + confirmPassword fields shared
 * by both the invite-acceptance and admin-reset flows.
 */
export function buildSetPasswordSchema(enforceComplexity: boolean) {
  return z
    .object({
      token: z.string().min(16),
      password: buildPasswordSchema(enforceComplexity),
      confirmPassword: z.string(),
    })
    .refine((data: { password: string; confirmPassword: string }) => data.password === data.confirmPassword, {
      message: "Passwords don't match.",
      path: ['confirmPassword'],
    });
}

// Default export kept for any call site that hasn't been updated
// to look up the org's setting yet — defaults to strict
// complexity, the safer fallback.
export const setPasswordSchema = buildSetPasswordSchema(true);
export type SetPasswordInput = z.infer<ReturnType<typeof buildSetPasswordSchema>>;

export const inviteUserSchema = z.object({
  firstName: z.string().trim().min(1, 'First name is required.').max(80),
  lastName: z.string().trim().min(1, 'Last name is required.').max(80),
  username: usernameSchema,
  contactEmail: z
    .string()
    .trim()
    .email('Enter a valid email address.')
    .max(255)
    .optional()
    .or(z.literal('')),
  department: z.string().trim().max(120).optional().or(z.literal('')),
  role: z.enum(APP_ROLES),
});
export type InviteUserInput = z.infer<typeof inviteUserSchema>;

export const updateUserRoleSchema = z.object({
  role: z.enum(APP_ROLES),
});
export type UpdateUserRoleInput = z.infer<typeof updateUserRoleSchema>;

export const adminResetPasswordSchema = z.object({
  // Admin-triggered reset always sends a new setup link rather
  // than admin choosing the password directly, to avoid admins
  // ever knowing a user's live password.
  notifyUser: z.boolean().default(true),
});
export type AdminResetPasswordInput = z.infer<typeof adminResetPasswordSchema>;

export const appConfigUpdateSchema = z.object({
  appName: z.string().trim().min(1).max(80),
  supportEmail: z.string().trim().email().max(255).optional().or(z.literal('')),
  defaultLanguage: z.string().trim().min(2).max(10),
  timezone: z.string().trim().min(1).max(64),
  primaryColor: z
    .string()
    .trim()
    .regex(/^#[0-9a-fA-F]{6}$/, 'Must be a hex colour like #6c4de6.'),
  iconLetter: z.string().trim().min(1).max(2),
  logoUrl: z.string().trim().url().optional().or(z.literal('')),
  faviconUrl: z.string().trim().url().optional().or(z.literal('')),
  requirePasswordChangeOnFirstLogin: z.boolean(),
  sessionTimeoutMinutes: z.number().int().min(5).max(1440),
  enforcePasswordComplexity: z.boolean(),
  limitConcurrentSessions: z.boolean(),
});
export type AppConfigUpdateInput = z.infer<typeof appConfigUpdateSchema>;

/**
 * Small helper for Route Handlers: parses a request body against
 * a schema and returns either { success: true, data } or a
 * ready-to-return 400 NextResponse. Keeps handlers short and
 * consistent.
 */
export function formatZodError(error: z.ZodError): { field: string; message: string }[] {
  return error.issues.map((issue: z.ZodIssue) => ({
    field: issue.path.join('.') || '_root',
    message: issue.message,
  }));
}
