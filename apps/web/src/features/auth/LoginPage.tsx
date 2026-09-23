import { ERROR_CODES } from '@talento/shared';
import { ShieldCheck } from 'lucide-react';
import * as React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ApiRequestError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useT } from '@/lib/i18n';
import { Button, Card, Field, Input } from '@/components/ui/primitives';

export function LoginPage() {
  const t = useT();
  const navigate = useNavigate();
  const location = useLocation();
  const login = useAuth((state) => state.login);

  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [twoFactorCode, setTwoFactorCode] = React.useState('');
  const [needsTwoFactor, setNeedsTwoFactor] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(email, password, needsTwoFactor ? twoFactorCode : undefined);
      const target = (location.state as { from?: string } | null)?.from ?? '/dashboard';
      navigate(target, { replace: true });
    } catch (caught) {
      if (caught instanceof ApiRequestError) {
        if (caught.code === ERROR_CODES.TWO_FACTOR_REQUIRED) {
          setNeedsTwoFactor(true);
          setError(null);
        } else {
          setError(caught.message);
        }
      } else {
        setError(t('common.error'));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold tracking-tight">{t('auth.signInTitle')}</h1>
          <p className="text-sm text-muted-foreground">{t('auth.signInSubtitle')}</p>
        </div>

        <Field label={t('auth.email')} htmlFor="email" required>
          <Input
            id="email"
            type="email"
            autoComplete="username"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="nombre@empresa.com"
          />
        </Field>

        <Field label={t('auth.password')} htmlFor="password" required>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </Field>

        {needsTwoFactor ? (
          <Field label={t('auth.twoFactor')} htmlFor="code" hint={t('auth.twoFactorHint')} required>
            <Input
              id="code"
              inputMode="numeric"
              pattern="\d{6}"
              maxLength={6}
              required
              value={twoFactorCode}
              onChange={(event) => setTwoFactorCode(event.target.value.replace(/\D/g, ''))}
              className="tracking-[0.5em]"
              autoFocus
            />
          </Field>
        ) : null}

        {error ? (
          <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
        ) : null}

        <Button type="submit" className="w-full" loading={loading}>
          {t('auth.signIn')}
        </Button>

        <div className="text-center">
          <Link to="/auth/recuperar" className="text-sm text-primary hover:underline">
            {t('auth.forgot')}
          </Link>
        </div>
      </form>
    </AuthShell>
  );
}

export function AuthShell({ children }: { children: React.ReactNode }) {
  const t = useT();
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="relative hidden flex-col justify-between bg-primary p-10 text-primary-foreground lg:flex">
        <div className="flex items-center gap-2 text-lg font-semibold">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/15">T</span>
          {t('app.name')}
        </div>
        <div className="space-y-4">
          <h2 className="text-3xl font-semibold leading-tight">
            Todo el ciclo de vida del colaborador en un solo lugar
          </h2>
          <p className="max-w-md text-primary-foreground/80">
            Atraccion, seleccion, ingreso, desarrollo, desempeno, bienestar, comunicacion, servicio
            y salida. Sin nomina, sin contabilidad: solo talento humano.
          </p>
          <ul className="space-y-2 text-sm text-primary-foreground/80">
            {[
              'Multiempresa con aislamiento total de datos',
              'Permisos granulares por rol y alcance',
              'Trazabilidad y privacidad por diseno',
            ].map((item) => (
              <li key={item} className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4" />
                {item}
              </li>
            ))}
          </ul>
        </div>
        <p className="text-xs text-primary-foreground/60">
          Ley 1581 de 2012 (Habeas Data) · Decreto 1072 de 2015 (SST) · Ley 2466 de 2025
        </p>
      </div>

      <div className="flex items-center justify-center p-6">
        <Card className="w-full max-w-md p-6 sm:p-8">{children}</Card>
      </div>
    </div>
  );
}
