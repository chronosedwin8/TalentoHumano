import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Save, ShieldCheck } from 'lucide-react';
import * as React from 'react';
import { apiGet, apiPatch, apiPost } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { formatDate } from '@/lib/utils';
import { toast } from '@/components/ui/overlays';
import {
  Avatar,
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Field,
  Input,
  PageHeader,
  Skeleton,
} from '@/components/ui/primitives';
import { Switch, Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/overlays';

interface MyProfile {
  id: string;
  fullName: string;
  employeeCode: string;
  email: string;
  personalEmail: string | null;
  phone: string | null;
  mobile: string | null;
  address: string | null;
  city: string | null;
  birthDate: string | null;
  documentType: string;
  documentNumber: string;
  hiredAt: string;
  hideCelebrations: boolean;
  directoryVisible: boolean;
  position: { name: string } | null;
  department: { name: string } | null;
  location: { name: string } | null;
  manager: { fullName: string } | null;
  emergencyContacts: Array<{ id: string; name: string; relationship: string; phone: string }>;
  education: Array<{ id: string; level: string; institution: string; degree: string | null }>;
  contracts: Array<{ id: string; contractType: string; startDate: string; endDate: string | null }>;
}

export function MyProfilePage() {
  const queryClient = useQueryClient();
  const { user, refreshUser } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ['portal', 'me'],
    queryFn: () => apiGet<MyProfile>('/portal/me'),
  });

  const [form, setForm] = React.useState<Record<string, unknown>>({});
  React.useEffect(() => {
    if (data) {
      setForm({
        phone: data.phone ?? '',
        mobile: data.mobile ?? '',
        personalEmail: data.personalEmail ?? '',
        address: data.address ?? '',
        city: data.city ?? '',
        hideCelebrations: data.hideCelebrations,
        directoryVisible: data.directoryVisible,
      });
    }
  }, [data]);

  const save = useMutation({
    mutationFn: (payload: Record<string, unknown>) => apiPatch('/portal/me', payload),
    onSuccess: (result: any) => {
      void queryClient.invalidateQueries({ queryKey: ['portal', 'me'] });
      if (result?.pendingApproval?.length) {
        toast.info(
          'Cambios enviados a aprobacion',
          'Los datos sensibles requieren validacion de Talento Humano.',
        );
      } else {
        toast.success('Datos actualizados');
      }
    },
    onError: (error: Error) => toast.error('No fue posible guardar', error.message),
  });

  const [passwords, setPasswords] = React.useState({ currentPassword: '', newPassword: '' });
  const changePassword = useMutation({
    mutationFn: () => apiPost('/auth/change-password', passwords),
    onSuccess: () => {
      toast.success('Contrasena actualizada', 'Se cerraron las demas sesiones.');
      setPasswords({ currentPassword: '', newPassword: '' });
    },
    onError: (error: Error) => toast.error('No fue posible cambiar la contrasena', error.message),
  });

  const [twoFactor, setTwoFactor] = React.useState<{ secret: string; otpauthUrl: string } | null>(
    null,
  );
  const [twoFactorCode, setTwoFactorCode] = React.useState('');

  const startTwoFactor = useMutation({
    mutationFn: () => apiPost<{ secret: string; otpauthUrl: string }>('/auth/2fa/setup'),
    onSuccess: (result) => setTwoFactor(result),
  });

  const confirmTwoFactor = useMutation({
    mutationFn: () =>
      apiPost<{ recoveryCodes: string[] }>('/auth/2fa/verify', { code: twoFactorCode }),
    onSuccess: async (result) => {
      toast.success(
        'Doble factor activado',
        `Guarde sus codigos: ${result.recoveryCodes.join(', ')}`,
      );
      setTwoFactor(null);
      setTwoFactorCode('');
      await refreshUser();
    },
    onError: (error: Error) => toast.error('Codigo invalido', error.message),
  });

  if (isLoading || !data) {
    return <Skeleton className="h-96 w-full" />;
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Mi perfil" description="Consulte y actualice sus datos personales." />

      <Card>
        <CardContent className="flex flex-col items-start gap-4 p-5 sm:flex-row sm:items-center">
          <Avatar name={data.fullName} size="xl" />
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-semibold">{data.fullName}</h2>
            <p className="text-sm text-muted-foreground">
              {data.position?.name ?? '—'} · {data.department?.name ?? '—'}
            </p>
            <div className="mt-2 flex flex-wrap gap-2 text-xs">
              <Badge tone="muted">Codigo {data.employeeCode}</Badge>
              <Badge tone="muted">Ingreso {formatDate(data.hiredAt)}</Badge>
              {data.location?.name ? <Badge tone="muted">{data.location.name}</Badge> : null}
              {data.manager ? <Badge tone="muted">Jefe: {data.manager.fullName}</Badge> : null}
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="datos">
        <TabsList>
          <TabsTrigger value="datos">Datos de contacto</TabsTrigger>
          <TabsTrigger value="laboral">Informacion laboral</TabsTrigger>
          <TabsTrigger value="seguridad">Seguridad</TabsTrigger>
        </TabsList>

        <TabsContent value="datos">
          <Card>
            <CardHeader>
              <CardTitle>Datos editables</CardTitle>
              <CardDescription>
                Los cambios de nombre o documento requieren aprobacion de Talento Humano.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <Field label="Telefono fijo">
                <Input
                  value={String(form.phone ?? '')}
                  onChange={(event) => setForm({ ...form, phone: event.target.value })}
                />
              </Field>
              <Field label="Celular">
                <Input
                  value={String(form.mobile ?? '')}
                  onChange={(event) => setForm({ ...form, mobile: event.target.value })}
                />
              </Field>
              <Field label="Correo personal">
                <Input
                  type="email"
                  value={String(form.personalEmail ?? '')}
                  onChange={(event) => setForm({ ...form, personalEmail: event.target.value })}
                />
              </Field>
              <Field label="Ciudad">
                <Input
                  value={String(form.city ?? '')}
                  onChange={(event) => setForm({ ...form, city: event.target.value })}
                />
              </Field>
              <Field label="Direccion" className="sm:col-span-2">
                <Input
                  value={String(form.address ?? '')}
                  onChange={(event) => setForm({ ...form, address: event.target.value })}
                />
              </Field>

              <label className="flex items-center justify-between gap-3 rounded-md border p-3 sm:col-span-2">
                <span className="text-sm">
                  Aparecer en el directorio de colaboradores
                  <span className="block text-xs text-muted-foreground">
                    Si lo desactiva, sus datos no se muestran en el directorio.
                  </span>
                </span>
                <Switch
                  checked={Boolean(form.directoryVisible)}
                  onCheckedChange={(checked) => setForm({ ...form, directoryVisible: checked })}
                />
              </label>

              <label className="flex items-center justify-between gap-3 rounded-md border p-3 sm:col-span-2">
                <span className="text-sm">
                  Ocultar mi cumpleanos y aniversario
                  <span className="block text-xs text-muted-foreground">
                    No se publicaran felicitaciones automaticas.
                  </span>
                </span>
                <Switch
                  checked={Boolean(form.hideCelebrations)}
                  onCheckedChange={(checked) => setForm({ ...form, hideCelebrations: checked })}
                />
              </label>

              <div className="sm:col-span-2">
                <Button loading={save.isPending} onClick={() => save.mutate(form)}>
                  <Save className="h-4 w-4" />
                  Guardar cambios
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="laboral">
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Contratos</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {data.contracts.map((contract) => (
                  <div key={contract.id} className="flex justify-between rounded-md border p-3">
                    <span className="capitalize">{contract.contractType.replace('_', ' ')}</span>
                    <span className="text-muted-foreground">
                      {formatDate(contract.startDate)} —{' '}
                      {contract.endDate ? formatDate(contract.endDate) : 'indefinido'}
                    </span>
                  </div>
                ))}
                {data.contracts.length === 0 ? (
                  <p className="text-muted-foreground">Sin contratos registrados.</p>
                ) : null}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Formacion academica</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {data.education.map((row) => (
                  <div key={row.id} className="rounded-md border p-3">
                    <p className="font-medium">{row.degree ?? row.level}</p>
                    <p className="text-muted-foreground">{row.institution}</p>
                  </div>
                ))}
                {data.education.length === 0 ? (
                  <p className="text-muted-foreground">Sin registros.</p>
                ) : null}
              </CardContent>
            </Card>

            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Contactos de emergencia</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {data.emergencyContacts.map((contact) => (
                  <div key={contact.id} className="flex justify-between rounded-md border p-3">
                    <span>
                      {contact.name}{' '}
                      <span className="text-muted-foreground">({contact.relationship})</span>
                    </span>
                    <span className="tabular-nums">{contact.phone}</span>
                  </div>
                ))}
                {data.emergencyContacts.length === 0 ? (
                  <p className="text-muted-foreground">Sin contactos registrados.</p>
                ) : null}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="seguridad">
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Cambiar contrasena</CardTitle>
                <CardDescription>Se cerraran sus demas sesiones activas.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Field label="Contrasena actual">
                  <Input
                    type="password"
                    value={passwords.currentPassword}
                    onChange={(event) =>
                      setPasswords({ ...passwords, currentPassword: event.target.value })
                    }
                  />
                </Field>
                <Field
                  label="Nueva contrasena"
                  hint="Minimo 10 caracteres con mayuscula, numero y simbolo"
                >
                  <Input
                    type="password"
                    value={passwords.newPassword}
                    onChange={(event) =>
                      setPasswords({ ...passwords, newPassword: event.target.value })
                    }
                  />
                </Field>
                <Button
                  loading={changePassword.isPending}
                  disabled={!passwords.currentPassword || !passwords.newPassword}
                  onClick={() => changePassword.mutate()}
                >
                  Actualizar contrasena
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4" />
                  Verificacion en dos pasos
                </CardTitle>
                <CardDescription>
                  {user?.twoFactorEnabled
                    ? 'Su cuenta tiene doble factor activo.'
                    : 'Agregue una capa adicional de seguridad con una app de autenticacion.'}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {user?.twoFactorEnabled ? (
                  <Badge tone="success">Activo</Badge>
                ) : twoFactor ? (
                  <>
                    <p className="text-sm text-muted-foreground">
                      Escanee este codigo en su aplicacion o ingrese la clave manualmente:
                    </p>
                    <code className="block break-all rounded-md bg-muted p-2 text-xs">
                      {twoFactor.secret}
                    </code>
                    <Field label="Codigo de 6 digitos">
                      <Input
                        value={twoFactorCode}
                        onChange={(event) =>
                          setTwoFactorCode(event.target.value.replace(/\D/g, ''))
                        }
                        maxLength={6}
                        className="tracking-[0.4em]"
                      />
                    </Field>
                    <Button
                      loading={confirmTwoFactor.isPending}
                      disabled={twoFactorCode.length !== 6}
                      onClick={() => confirmTwoFactor.mutate()}
                    >
                      Confirmar y activar
                    </Button>
                  </>
                ) : (
                  <Button
                    variant="outline"
                    loading={startTwoFactor.isPending}
                    onClick={() => startTwoFactor.mutate()}
                  >
                    Configurar doble factor
                  </Button>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
