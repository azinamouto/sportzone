import 'dotenv/config';
import { createHash, timingSafeEqual } from 'node:crypto';

export interface AdminAccount {
  email: string;
  password: string;
  name: string;
}

export class AdminConfigurationError extends Error {}

export function getAdminAccounts(): AdminAccount[] {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase() || '';
  const password = process.env.ADMIN_PASSWORD || '';
  if (!!email !== !!password) {
    throw new AdminConfigurationError('ADMIN_EMAIL and ADMIN_PASSWORD must be configured together.');
  }
  const accounts: AdminAccount[] = email && password
    ? [{ email: email.trim().toLowerCase(), password, name: 'Sports Zone Admin' }]
    : [];
  let additional: unknown;
  try {
    additional = JSON.parse(process.env.ADMIN_USERS || '[]');
  } catch {
    throw new AdminConfigurationError('ADMIN_USERS must contain valid JSON.');
  }
  if (!Array.isArray(additional)) throw new AdminConfigurationError('ADMIN_USERS must be a JSON array.');
  for (const account of additional) {
    if (!account || typeof account.email !== 'string' || !account.email.trim()
      || typeof account.password !== 'string' || !account.password
      || (account.name !== undefined && typeof account.name !== 'string')) {
      throw new AdminConfigurationError('Each ADMIN_USERS entry requires an email and password.');
    }
    const normalizedEmail = account.email.trim().toLowerCase();
    if (accounts.some(existing => existing.email === normalizedEmail)) {
      throw new AdminConfigurationError('Admin account emails must be unique.');
    }
    accounts.push({ email: normalizedEmail, password: account.password, name: account.name?.trim() || 'Sports Zone Admin' });
  }
  return accounts;
}

export function passwordMatches(provided: string, expected: string): boolean {
  const hash = (value: string) => createHash('sha256').update(value).digest();
  return timingSafeEqual(hash(provided), hash(expected));
}

// The identity prefix is public metadata. Authentication still requires a match
// against the stored hash of the ENTIRE token, including its random secret.
// This keeps shared sessions compatible with the existing database schema.
export function accountTokenPrefix(email: string): string {
  return `sz_admin_${createHash('sha256').update(email.trim().toLowerCase()).digest('hex')}_`;
}

export function sessionAccount(token: string): AdminAccount | undefined {
  const accounts = getAdminAccounts();
  const account = accounts.find(item => token.startsWith(accountTokenPrefix(item.email)));
  if (account) return account;
  // Sessions issued before multiple accounts were supported belong to the owner.
  if (/^sz_admin_[a-f0-9]{64}$/.test(token)) {
    const ownerEmail = process.env.ADMIN_EMAIL || '';
    return accounts.find(item => item.email === ownerEmail.trim().toLowerCase());
  }
  return undefined;
}

export function publicAdmin(account: AdminAccount) {
  return { email: account.email, name: account.name, role: 'administrator' };
}
