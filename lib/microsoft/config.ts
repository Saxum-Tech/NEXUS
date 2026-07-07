/**
 * lib/microsoft/config.ts
 * ─────────────────────────────────────────────────────────────
 * Server-side Microsoft / Graph configuration. This module turns
 * raw environment variables into a validated, typed config object
 * used by future OAuth callback and Graph Route Handlers.
 *
 * Do not import this module from client components.
 * ─────────────────────────────────────────────────────────────
 */

import 'server-only';

import { env } from '@/lib/env';
import {
  graphScopesToString,
  validateInitialGraphScopes,
} from '@/lib/microsoft/permissions';

export const MICROSOFT_LOGIN_BASE_URL = 'https://login.microsoftonline.com';
export const MICROSOFT_GRAPH_BASE_URL = 'https://graph.microsoft.com/v1.0';

export interface MicrosoftConfig {
  clientId: string;
  clientSecret: string;
  tenantId: string;
  authorityUrl: string;
  authorizeUrl: string;
  tokenUrl: string;
  redirectUri: string;
  postLogoutRedirectUri: string;
  graphBaseUrl: string;
  graphScopes: string[];
  graphScopesString: string;
  outlookAddInEnabled: boolean;
}

export interface MicrosoftAuthorizeUrlInput {
  config: MicrosoftConfig;
  state: string;
  nonce: string;
  prompt?: 'select_account' | 'consent' | 'none';
}

function requireMicrosoftValue(name: string, value: string | null): string {
  if (!value) {
    throw new Error(
      `Missing required Microsoft environment variable: ${name}. ` +
        'Microsoft Graph cannot be used until this is configured.'
    );
  }

  return value;
}

function normalizeTenantId(tenantId: string): string {
  const normalized = tenantId.trim();

  if (!normalized) {
    throw new Error('MICROSOFT_TENANT_ID cannot be blank.');
  }

  if (normalized === 'consumers') {
    throw new Error(
      'MICROSOFT_TENANT_ID=consumers is not supported. ' +
        'NEXUS is an enterprise Microsoft 365 platform and must use common, organizations, or a tenant id.'
    );
  }

  return normalized;
}

function assertHttpsUrl(name: string, value: string): string {
  let parsed: URL;

  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`${name} must be a valid absolute URL.`);
  }

  if (parsed.protocol !== 'https:' && parsed.hostname !== 'localhost') {
    throw new Error(`${name} must use HTTPS outside local development.`);
  }

  return parsed.toString();
}

export function getMicrosoftConfig(): MicrosoftConfig {
  const clientId = requireMicrosoftValue('MICROSOFT_CLIENT_ID', env.microsoftClientId);
  const clientSecret = requireMicrosoftValue(
    'MICROSOFT_CLIENT_SECRET',
    env.microsoftClientSecret
  );
  const redirectUri = assertHttpsUrl(
    'MICROSOFT_REDIRECT_URI',
    requireMicrosoftValue('MICROSOFT_REDIRECT_URI', env.microsoftRedirectUri)
  );
  const postLogoutRedirectUri = assertHttpsUrl(
    'MICROSOFT_POST_LOGOUT_REDIRECT_URI',
    requireMicrosoftValue(
      'MICROSOFT_POST_LOGOUT_REDIRECT_URI',
      env.microsoftPostLogoutRedirectUri
    )
  );
  const tenantId = normalizeTenantId(env.microsoftTenantId);
  const scopeValidation = validateInitialGraphScopes(env.microsoftGraphScopes);

  if (!scopeValidation.ok) {
    throw new Error(
      'Invalid MICROSOFT_GRAPH_SCOPES. ' +
        `Missing: ${scopeValidation.missing.join(', ') || 'none'}. ` +
        `Forbidden initial scopes: ${scopeValidation.forbidden.join(', ') || 'none'}.`
    );
  }

  const authorityUrl = `${MICROSOFT_LOGIN_BASE_URL}/${encodeURIComponent(tenantId)}`;

  return {
    clientId,
    clientSecret,
    tenantId,
    authorityUrl,
    authorizeUrl: `${authorityUrl}/oauth2/v2.0/authorize`,
    tokenUrl: `${authorityUrl}/oauth2/v2.0/token`,
    redirectUri,
    postLogoutRedirectUri,
    graphBaseUrl: MICROSOFT_GRAPH_BASE_URL,
    graphScopes: scopeValidation.scopes,
    graphScopesString: graphScopesToString(scopeValidation.scopes),
    outlookAddInEnabled: env.outlookAddInEnabled,
  };
}

export function buildMicrosoftAuthorizeUrl(input: MicrosoftAuthorizeUrlInput): string {
  const params = new URLSearchParams({
    client_id: input.config.clientId,
    response_type: 'code',
    redirect_uri: input.config.redirectUri,
    response_mode: 'query',
    scope: input.config.graphScopesString,
    state: input.state,
    nonce: input.nonce,
  });

  if (input.prompt) {
    params.set('prompt', input.prompt);
  }

  return `${input.config.authorizeUrl}?${params.toString()}`;
}
