import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Save } from 'lucide-react';
import * as React from 'react';
import { apiGet, apiPatch } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { toast } from '@/components/ui/overlays';
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Field,
  Input,
  NativeSelect,
  Skeleton,
  Textarea,
} from '@/components/ui/primitives';

interface Company {
  id: string;
  name: string;
  slug: string;
  legalName: string | null;
  taxId: string | null;
  logoUrl: string | null;
  faviconUrl: string | null;
  primaryColor: string;
  accentColor: string;
  country: string;
  timezone: string;
  locale: string;
  address: string | null;
  city: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  privacyPolicy: string | null;
}

export function CompanyTab() {
  const queryClient = useQueryClient();
  const can = useAuth((state) => state.can);

  const { data, isLoading } = useQuery({
    queryKey: ['settings', 'company'],
    queryFn: () => apiGet<Company>('/settings/company'),
  });

  const [form, setForm] = React.useState<Partial<Company>>({});

  React.useEffect(() => {
    if (data) setForm(data);
  }, [data]);

  const save = useMutation({
    mutationFn: () =>
      apiPatch('/settings/company', {
        name: form.name,
        legalName: form.legalName || null,
        taxId: form.taxId || null,
        logoUrl: form.logoUrl || null,
        faviconUrl: form.faviconUrl || null,
        primaryColor: form.primaryColor,
        accentColor: form.accentColor,
        country: form.country,
        timezone: form.timezone,
        locale: form.locale,
        address: form.address || null,
        city: form.city || null,
        phone: form.phone || null,
        email: form.email || null,
        website: form.website || null,
        privacyPolicy: form.privacyPolicy || null,
      }),
    onSuccess: () => {
      toast.success('Configuracion guardada');
      void queryClient.invalidateQueries({ queryKey: ['settings', 'company'] });
      void queryClient.invalidateQueries({ queryKey: ['auth', 'me'] });
    },
    onError: (error: Error) => toast.error('No fue posible guardar', error.message),
  });

  if (isLoading || !data) return <Skeleton className="h-96 w-full" />;

  const editable = can('settings.company.update');
  const set = (patch: Partial<Company>) => setForm({ ...form, ...patch });

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Identificacion</CardTitle>
          <CardDescription>
            Portal publico de empleo: <span className="font-mono">/careers/{data.slug}</span> ·
            canal de denuncias: <span className="font-mono">/ethics/{data.slug}</span>
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <Field label="Nombre comercial" required>
            <Input
              value={form.name ?? ''}
              disabled={!editable}
              onChange={(event) => set({ name: event.target.value })}
            />
          </Field>
          <Field label="Razon social">
            <Input
              value={form.legalName ?? ''}
              disabled={!editable}
              onChange={(event) => set({ legalName: event.target.value })}
            />
          </Field>
          <Field label="NIT">
            <Input
              value={form.taxId ?? ''}
              disabled={!editable}
              onChange={(event) => set({ taxId: event.target.value })}
            />
          </Field>
          <Field label="Pais">
            <NativeSelect
              value={form.country ?? 'CO'}
              disabled={!editable}
              onChange={(event) => set({ country: event.target.value })}
            >
              <option value="CO">Colombia</option>
              <option value="MX">Mexico</option>
              <option value="PE">Peru</option>
              <option value="CL">Chile</option>
              <option value="AR">Argentina</option>
              <option value="EC">Ecuador</option>
              <option value="ES">Espana</option>
            </NativeSelect>
          </Field>
          <Field label="Zona horaria">
            <Input
              value={form.timezone ?? ''}
              disabled={!editable}
              onChange={(event) => set({ timezone: event.target.value })}
            />
          </Field>
          <Field label="Idioma por defecto">
            <NativeSelect
              value={form.locale ?? 'es'}
              disabled={!editable}
              onChange={(event) => set({ locale: event.target.value })}
            >
              <option value="es">Espanol</option>
              <option value="en">English</option>
              <option value="de">Deutsch</option>
            </NativeSelect>
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Marca</CardTitle>
          <CardDescription>
            El logo y los colores se aplican a la interfaz y a los portales publicos.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <Field label="URL del logo">
            <Input
              value={form.logoUrl ?? ''}
              disabled={!editable}
              onChange={(event) => set({ logoUrl: event.target.value })}
              placeholder="https://..."
            />
          </Field>
          <Field label="URL del favicon">
            <Input
              value={form.faviconUrl ?? ''}
              disabled={!editable}
              onChange={(event) => set({ faviconUrl: event.target.value })}
            />
          </Field>
          <Field label="Color primario">
            <div className="flex gap-2">
              <input
                type="color"
                value={form.primaryColor ?? '#2a78d6'}
                disabled={!editable}
                onChange={(event) => set({ primaryColor: event.target.value })}
                className="h-10 w-14 rounded-md border border-input"
              />
              <Input
                value={form.primaryColor ?? ''}
                disabled={!editable}
                onChange={(event) => set({ primaryColor: event.target.value })}
              />
            </div>
          </Field>
          <Field label="Color de acento">
            <div className="flex gap-2">
              <input
                type="color"
                value={form.accentColor ?? '#1baf7a'}
                disabled={!editable}
                onChange={(event) => set({ accentColor: event.target.value })}
                className="h-10 w-14 rounded-md border border-input"
              />
              <Input
                value={form.accentColor ?? ''}
                disabled={!editable}
                onChange={(event) => set({ accentColor: event.target.value })}
              />
            </div>
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Contacto</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <Field label="Direccion">
            <Input
              value={form.address ?? ''}
              disabled={!editable}
              onChange={(event) => set({ address: event.target.value })}
            />
          </Field>
          <Field label="Ciudad">
            <Input
              value={form.city ?? ''}
              disabled={!editable}
              onChange={(event) => set({ city: event.target.value })}
            />
          </Field>
          <Field label="Telefono">
            <Input
              value={form.phone ?? ''}
              disabled={!editable}
              onChange={(event) => set({ phone: event.target.value })}
            />
          </Field>
          <Field label="Correo">
            <Input
              value={form.email ?? ''}
              disabled={!editable}
              onChange={(event) => set({ email: event.target.value })}
            />
          </Field>
          <Field label="Sitio web" className="sm:col-span-2">
            <Input
              value={form.website ?? ''}
              disabled={!editable}
              onChange={(event) => set({ website: event.target.value })}
            />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Politica de tratamiento de datos</CardTitle>
          <CardDescription>
            Se muestra en los portales publicos para el consentimiento de la Ley 1581 de 2012.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Textarea
            value={form.privacyPolicy ?? ''}
            disabled={!editable}
            onChange={(event) => set({ privacyPolicy: event.target.value })}
            rows={8}
          />
        </CardContent>
      </Card>

      {editable ? (
        <div className="flex justify-end">
          <Button loading={save.isPending} onClick={() => save.mutate()}>
            <Save className="h-4 w-4" />
            Guardar cambios
          </Button>
        </div>
      ) : null}
    </div>
  );
}
