import { permissionMatches, type SessionUser } from '@talento/shared';
import { create } from 'zustand';
import { apiGet, apiPost, setAccessToken, setUnauthenticatedHandler } from './api';

interface LoginResponse {
  accessToken: string;
  expiresIn: number;
  user: SessionUser;
}

interface AuthState {
  user: SessionUser | null;
  status: 'loading' | 'authenticated' | 'anonymous';
  login: (email: string, password: string, twoFactorCode?: string) => Promise<SessionUser>;
  logout: () => Promise<void>;
  bootstrap: () => Promise<void>;
  refreshUser: () => Promise<void>;
  switchCompany: (companyId: string) => Promise<void>;
  /** True when the user holds the permission (wildcards honoured). */
  can: (permission: string) => boolean;
  canAny: (...permissions: string[]) => boolean;
  hasModule: (moduleKey: string) => boolean;
  scopeOf: (permission: string) => 'own' | 'team' | 'area' | 'company' | null;
}

export const useAuth = create<AuthState>((set, get) => ({
  user: null,
  status: 'loading',

  async login(email, password, twoFactorCode) {
    const result = await apiPost<LoginResponse>('/auth/login', {
      email,
      password,
      ...(twoFactorCode ? { twoFactorCode } : {}),
    });
    setAccessToken(result.accessToken);
    applyBrand(result.user);
    set({ user: result.user, status: 'authenticated' });
    return result.user;
  },

  async logout() {
    await apiPost('/auth/logout').catch(() => undefined);
    setAccessToken(null);
    set({ user: null, status: 'anonymous' });
  },

  async bootstrap() {
    try {
      // The refresh cookie is httpOnly, so a silent refresh restores the session.
      const result = await apiPost<LoginResponse>('/auth/refresh', {});
      setAccessToken(result.accessToken);
      applyBrand(result.user);
      set({ user: result.user, status: 'authenticated' });
    } catch {
      set({ user: null, status: 'anonymous' });
    }
  },

  async refreshUser() {
    const user = await apiGet<SessionUser>('/auth/me');
    applyBrand(user);
    set({ user });
  },

  async switchCompany(companyId) {
    const result = await apiPost<LoginResponse>(`/auth/switch-company/${companyId}`);
    setAccessToken(result.accessToken);
    applyBrand(result.user);
    set({ user: result.user, status: 'authenticated' });
  },

  can(permission) {
    const user = get().user;
    if (!user) return false;
    if (user.isSuperadmin) return true;
    return user.permissions.some((granted) => permissionMatches(granted.code, permission));
  },

  canAny(...permissions) {
    return permissions.some((permission) => get().can(permission));
  },

  hasModule(moduleKey) {
    const user = get().user;
    if (!user) return false;
    if (user.isSuperadmin) return true;
    return user.modules.includes(moduleKey);
  },

  scopeOf(permission) {
    const user = get().user;
    if (!user) return null;
    const order = { own: 1, team: 2, area: 3, company: 4 } as const;
    let best: 'own' | 'team' | 'area' | 'company' | null = null;
    for (const granted of user.permissions) {
      if (!permissionMatches(granted.code, permission)) continue;
      if (!best || order[granted.scope] > order[best]) best = granted.scope;
    }
    return best;
  },
}));

/** Applies the company primary colour as the CSS brand token. */
function applyBrand(user: SessionUser | null): void {
  const root = document.documentElement;
  const color = user?.company?.primaryColor;
  if (!color) {
    root.removeAttribute('data-brand');
    return;
  }
  const hsl = hexToHsl(color);
  if (!hsl) return;
  root.setAttribute('data-brand', 'true');
  root.style.setProperty('--brand-primary', hsl);
}

function hexToHsl(hex: string): string | null {
  const match = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!match) return null;
  const r = parseInt(match[1], 16) / 255;
  const g = parseInt(match[2], 16) / 255;
  const b = parseInt(match[3], 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const lightness = (max + min) / 2;
  let hue = 0;
  let saturation = 0;
  if (max !== min) {
    const delta = max - min;
    saturation = lightness > 0.5 ? delta / (2 - max - min) : delta / (max + min);
    if (max === r) hue = ((g - b) / delta + (g < b ? 6 : 0)) / 6;
    else if (max === g) hue = ((b - r) / delta + 2) / 6;
    else hue = ((r - g) / delta + 4) / 6;
  }
  return `${Math.round(hue * 360)} ${Math.round(saturation * 100)}% ${Math.round(lightness * 100)}%`;
}

// A refresh that cannot be recovered sends the user back to the login screen.
setUnauthenticatedHandler(() => {
  setAccessToken(null);
  useAuth.setState({ user: null, status: 'anonymous' });
});
