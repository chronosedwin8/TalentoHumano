import { passwordSchema } from '@talento/shared';
import { CheckCircle2 } from 'lucide-react';
import * as React from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ApiRequestError, apiPost } from '@/lib/api';
import { useT } from '@/lib/i18n';
import { Button, Field, Input } from '@/components/ui/primitives';
import { AuthShell } from './LoginPage';

export function ResetPasswordPage() {
  const t = useT();
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';

  const [password, setPassword] = React.useState('');
  const [confirm, setConfirm] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const [done, setDone] = React.useState(false);
  const [loading, setLoading] = React.useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    const parsed = passwordSchema.safeParse(password);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'La contrasena no cumple la politica');
      return;
    }
    if (password !== confirm) {
      setError('Las contrasenas no coinciden');
      return;
    }

    setLoading(true);
    try {
      await apiPost('/auth/reset-password', { token, password });
      setDone(true);
    } catch (caught) {
      setError(caught instanceof ApiRequestError ? caught.message : t('common.error'));
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <AuthShell>
        <div className="space-y-4 text-center">
          <p className="text-sm text-muted-foreground">El enlace no es valido o esta incompleto.</p>
          <Button asChild variant="outline" className="w-full">
            <Link to="/auth/recuperar">Solicitar uno nuevo</Link>
          </Button>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      {done ? (
        <div className="space-y-4 text-center">
          <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-500" />
          <p className="text-sm text-muted-foreground">{t('auth.resetSuccess')}</p>
          <Button asChild className="w-full">
            <Link to="/auth/ingresar">{t('auth.signIn')}</Link>
          </Button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <h1 className="text-xl font-semibold tracking-tight">{t('auth.resetTitle')}</h1>
            <p className="text-sm text-muted-foreground">
              Minimo 10 caracteres, con mayuscula, minuscula, numero y caracter especial.
            </p>
          </div>
          <Field label="Nueva contrasena" htmlFor="password" required>
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </Field>
          <Field label="Confirmar contrasena" htmlFor="confirm" required>
            <Input
              id="confirm"
              type="password"
              autoComplete="new-password"
              required
              value={confirm}
              onChange={(event) => setConfirm(event.target.value)}
            />
          </Field>
          {error ? (
            <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          ) : null}
          <Button type="submit" className="w-full" loading={loading}>
            Guardar contrasena
          </Button>
        </form>
      )}
    </AuthShell>
  );
}
