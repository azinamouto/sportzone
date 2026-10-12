import crypto from 'node:crypto';
import { supabaseClient } from './supabase.ts';

const localSessions = new Map<string, number>();
const tokenHash = (token: string) => crypto.createHash('sha256').update(token).digest('hex');

export const Sessions = {
  async create(): Promise<string> {
    const token = `sz_admin_${crypto.randomBytes(32).toString('hex')}`;
    const expires = Date.now() + 8 * 60 * 60 * 1000;
    if (supabaseClient) {
      const { error } = await supabaseClient.from('admin_sessions').insert({
        token_hash: tokenHash(token),
        expires_at: new Date(expires).toISOString(),
      });
      if (error) throw error;
    } else {
      if (process.env.VERCEL) throw new Error('Supabase is required for admin sessions on Vercel.');
      localSessions.set(tokenHash(token), expires);
    }
    return token;
  },

  async has(token: string): Promise<boolean> {
    if (supabaseClient) {
      const { data, error } = await supabaseClient.from('admin_sessions')
        .select('expires_at').eq('token_hash', tokenHash(token)).maybeSingle();
      if (error) throw error;
      return !!data && Date.parse(data.expires_at) > Date.now();
    }
    if (process.env.VERCEL) throw new Error('Supabase is required for admin sessions on Vercel.');
    const hash = tokenHash(token);
    const expires = localSessions.get(hash) || 0;
    if (expires <= Date.now()) localSessions.delete(hash);
    return expires > Date.now();
  },

  async delete(token: string): Promise<void> {
    if (supabaseClient) {
      const { error } = await supabaseClient.from('admin_sessions')
        .delete().eq('token_hash', tokenHash(token));
      if (error) throw error;
      return;
    }
    localSessions.delete(tokenHash(token));
  },
};
