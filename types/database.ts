/**
 * types/database.ts
 * ─────────────────────────────────────────────────────────────
 * Hand-written to match supabase/migrations/0001_init_schema.sql
 * exactly. In a real project, replace this with the output of:
 *
 *     npx supabase gen types typescript --local > types/database.ts
 *
 * Run that after every migration so this file can never drift
 * from the real schema. Keeping it hand-written here only for
 * template portability (no live Supabase project to generate
 * against in this environment).
 * ─────────────────────────────────────────────────────────────
 */

export type AppRole = 'super_admin' | 'admin' | 'editor' | 'viewer';
export type UserStatus = 'active' | 'invited' | 'suspended';

export interface Database {
  public: {
    Tables: {
      organisations: {
        Row: {
          id: string;
          slug: string;
          name: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          slug: string;
          name: string;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['organisations']['Insert']>;
      };

      profiles: {
        Row: {
          id: string;
          org_id: string;
          username: string;
          display_name: string;
          first_name: string;
          last_name: string;
          contact_email: string | null;
          role: AppRole;
          status: UserStatus;
          department: string | null;
          must_change_password: boolean;
          invited_by: string | null;
          invited_at: string | null;
          activated_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          org_id: string;
          username: string;
          display_name: string;
          first_name: string;
          last_name: string;
          contact_email?: string | null;
          role?: AppRole;
          status?: UserStatus;
          department?: string | null;
          must_change_password?: boolean;
          invited_by?: string | null;
          invited_at?: string | null;
          activated_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['profiles']['Insert']>;
      };

      app_config: {
        Row: {
          org_id: string;
          app_name: string;
          support_email: string | null;
          default_language: string;
          timezone: string;
          logo_url: string | null;
          favicon_url: string | null;
          primary_color: string;
          icon_letter: string;
          allow_public_registration: boolean;
          require_password_change_on_first_login: boolean;
          session_timeout_minutes: number;
          enforce_password_complexity: boolean;
          limit_concurrent_sessions: boolean;
          updated_by: string | null;
          updated_at: string;
        };
        Insert: {
          org_id: string;
          app_name?: string;
          support_email?: string | null;
          default_language?: string;
          timezone?: string;
          logo_url?: string | null;
          favicon_url?: string | null;
          primary_color?: string;
          icon_letter?: string;
          allow_public_registration?: boolean;
          require_password_change_on_first_login?: boolean;
          session_timeout_minutes?: number;
          enforce_password_complexity?: boolean;
          limit_concurrent_sessions?: boolean;
          updated_by?: string | null;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['app_config']['Insert']>;
      };

      audit_log: {
        Row: {
          id: number;
          org_id: string;
          actor_id: string | null;
          actor_username: string | null;
          actor_role: AppRole | null;
          action: string;
          target_type: string | null;
          target_id: string | null;
          metadata: Record<string, unknown>;
          ip_address: string | null;
          user_agent: string | null;
          created_at: string;
        };
        Insert: {
          id?: number;
          org_id: string;
          actor_id?: string | null;
          actor_username?: string | null;
          actor_role?: AppRole | null;
          action: string;
          target_type?: string | null;
          target_id?: string | null;
          metadata?: Record<string, unknown>;
          ip_address?: string | null;
          user_agent?: string | null;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['audit_log']['Insert']>;
      };

      invite_tokens: {
        Row: {
          id: string;
          profile_id: string;
          token_hash: string;
          expires_at: string;
          used_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          profile_id: string;
          token_hash: string;
          expires_at: string;
          used_at?: string | null;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['invite_tokens']['Insert']>;
      };
    };
    Views: Record<string, never>;
    Functions: {
      current_org_id: { Args: Record<string, never>; Returns: string };
      current_role: { Args: Record<string, never>; Returns: AppRole };
      is_admin_or_above: { Args: Record<string, never>; Returns: boolean };
      is_super_admin: { Args: Record<string, never>; Returns: boolean };
    };
    Enums: {
      app_role: AppRole;
      user_status: UserStatus;
    };
  };
}
