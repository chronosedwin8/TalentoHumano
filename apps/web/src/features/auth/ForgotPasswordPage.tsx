import { CheckCircle2 } from 'lucide-react';
import * as React from 'react';
import { Link } from 'react-router-dom';
import { apiPost } from '@/lib/api';
import { useT } from '@/lib/i18n';
import { Button, Field, Input } from '@/components/ui/primitives';
import { AuthShell } from './LoginPage';

export function ForgotPasswordPage() {
  const t = useT();
  const [email, setEmail] = React.useState('');
  const [sent, setSent] = React.useState(false);
  const [loading, setLoading] = React.useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    // The API always answers 204 so the endpoint cannot enumerate accounts.
    await apiPost('/auth/forgot-password', { email }).catch(() => undefined);
    setLoading(false);
    setSent(true);
  };

  return (
    <AuthShell>
      {sent ? (
        <div className="space-y-4 text-center">
          <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-500" />
          <div className="space-y-1">
            <h1 className="text-lg font-semibold">{t('auth.forgotTitle')}</h1>
            <p className="text-sm text-muted-foreground">{t('auth.forgotSent')}</p>
          </div>
          <Button asChild variant="outline" className="w-full">
            <Link to="/auth/ingresar">{t('auth.back')}</Link>
          </Button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <h1 className="text-xl font-semibold tracking-tight">{t('auth.forgotTitle')}</h1>
            <p className="text-sm text-muted-foreground">{t('auth.forgotSubtitle')}</p>
          </div>
          <Field label={t('auth.email')} htmlFor="email" required>
            <Input
              id="email"
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="nombre@empresa.com"
            />
          </Field>
          <Button type="submit" className="w-full" loading={loading}>
            Enviar instrucciones
          </Button>
          <div className="text-center">
            <Link to="/auth/ingresar" className="text-sm text-primary hover:underline">
              {t('auth.back')}
            </Link>
          </div>
        </form>
      )}
    </AuthShell>
  );
}
