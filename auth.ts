import { supabase } from '../../lib/supabase';
import { User, AuthFormData } from '../../types/users';
import { Session } from '@supabase/supabase-js';

export const authService = {
  supabase,

  async signUp({ email, password, full_name }: { email: string; password: string; full_name?: string }) {
    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, full_name }),
      });

      const data = await res.json();
      return { user: null, session: null, error: res.ok ? null : data.error };
    } catch {
      return { user: null, session: null, error: 'Connection error during sign up' };
    }
  },

  async signIn({ email, password }: AuthFormData): Promise<{ user: User | null; session: Session | null; error: string | null }> {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      return { user: null, session: null, error: error.message };
    }

    return { user: data.user as unknown as User, session: data.session, error: null };
  },

  async signOut(): Promise<{ error: string | null }> {
    const { error } = await supabase.auth.signOut();
    return { error: error?.message || null };
  },

  async getCurrentUser(): Promise<{ user: User | null; error: string | null }> {
    const { data: { user }, error } = await supabase.auth.getUser();

    if (error) return { user: null, error: error.message };

    if (user) {
      const { data: profile } = await supabase
        .from('users')
        .select('*')
        .eq('id', user.id)
        .single();

      const mappedUser = {
        ...user,
        full_name: profile?.full_name || user.user_metadata?.full_name || '',
        phone: profile?.phone || user.phone || '',
        email_confirmed_at: user.email_confirmed_at || null,
        role: profile?.role || 'user',
      } as User;

      return { user: mappedUser, error: null };
    }

    return { user: null, error: null };
  },

  async getUserProfile(userId: string): Promise<{ profile: User | null; error: string | null }> {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (error) return { profile: null, error: error.message };
    return { profile: data as unknown as User, error: null };
  },

  async updateProfile(userId: string, updates: Partial<User>): Promise<{ profile: User | null; error: string | null }> {
    const { data, error } = await supabase
      .from('users')
      .upsert({
        id: userId,
        updated_at: new Date().toISOString(),
        ...updates,
      })
      .select()
      .single();

    if (error) return { profile: null, error: error.message };
    return { profile: data as unknown as User, error: null };
  },

  async resetPasswordForEmail(email: string, lang?: string): Promise<{ error: string | null }> {
    try {
      const res = await fetch('/api/auth/recover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, lang }),
      });

      const data = await res.json();
      return { error: res.ok ? null : (data.error || 'Failed to send recovery email') };
    } catch {
      return { error: 'Connection error during password reset' };
    }
  },

  async updatePassword(newPassword: string): Promise<{ error: string | null }> {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    return { error: error?.message || null };
  },

  async resendVerificationEmail(email: string, lang?: string): Promise<{ error: string | null }> {
    try {
      const res = await fetch('/api/auth/resend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, lang }),
      });

      const data = await res.json();
      return { error: res.ok ? null : (data.error || 'Failed to resend verification email') };
    } catch {
      return { error: 'Connection error during email resend' };
    }
  },
};
