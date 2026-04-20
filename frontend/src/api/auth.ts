// User session context for Bolt auth integration
// Bolt controls auth/login — Emergent reads the authenticated email

const USER_EMAIL_KEY = 'ubuybox_user_email';

// Get the authenticated user email from:
// 1. URL parameter ?email= (Bolt redirect)
// 2. localStorage (persisted from previous session)
export function getAuthEmail(): string | null {
  // Check URL params first (Bolt may pass email on redirect)
  const params = new URLSearchParams(window.location.search);
  const emailParam = params.get('email');
  if (emailParam) {
    setAuthEmail(emailParam);
    // Clean URL without reload
    const url = new URL(window.location.href);
    url.searchParams.delete('email');
    window.history.replaceState({}, '', url.toString());
    return emailParam;
  }
  
  // Fall back to stored email
  return localStorage.getItem(USER_EMAIL_KEY);
}

export function setAuthEmail(email: string): void {
  localStorage.setItem(USER_EMAIL_KEY, email.toLowerCase().trim());
}

export function clearAuthEmail(): void {
  localStorage.removeItem(USER_EMAIL_KEY);
}

export function isAuthenticated(): boolean {
  return !!getAuthEmail();
}
