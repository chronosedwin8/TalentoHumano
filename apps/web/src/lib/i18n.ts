import { create } from 'zustand';
import de from '@/locales/de.json';
import en from '@/locales/en.json';
import es from '@/locales/es.json';

export type Locale = 'es' | 'en' | 'de';

const DICTIONARIES: Record<Locale, Record<string, unknown>> = { es, en, de };

function lookup(dictionary: Record<string, unknown>, key: string): string | undefined {
  const value = key
    .split('.')
    .reduce<unknown>(
      (acc, part) =>
        acc && typeof acc === 'object' ? (acc as Record<string, unknown>)[part] : undefined,
      dictionary,
    );
  return typeof value === 'string' ? value : undefined;
}

interface I18nState {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  /** Translates a key, falling back to Spanish and then to the key itself. */
  t: (key: string, params?: Record<string, string | number>) => string;
}

const STORAGE_KEY = 'talento.locale';

export const useI18n = create<I18nState>((set, get) => ({
  locale: ((localStorage.getItem(STORAGE_KEY) as Locale) || 'es') as Locale,

  setLocale(locale) {
    localStorage.setItem(STORAGE_KEY, locale);
    document.documentElement.lang = locale;
    set({ locale });
  },

  t(key, params) {
    const { locale } = get();
    const text = lookup(DICTIONARIES[locale], key) ?? lookup(DICTIONARIES.es, key) ?? key;
    if (!params) return text;
    return Object.entries(params).reduce(
      (acc, [name, value]) => acc.replace(new RegExp(`{{\\s*${name}\\s*}}`, 'g'), String(value)),
      text,
    );
  },
}));

/** Shorthand for components: `const t = useT();` */
export function useT() {
  return useI18n((state) => state.t);
}

document.documentElement.lang = useI18n.getState().locale;
