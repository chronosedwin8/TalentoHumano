import * as React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { PageHeader } from '@/components/ui/primitives';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/overlays';
import { CompanyTab } from './tabs/CompanyTab';
import { OrganizationTab } from './tabs/OrganizationTab';
import { UsersTab } from './tabs/UsersTab';
import { RolesTab } from './tabs/RolesTab';
import { ModulesTab } from './tabs/ModulesTab';
import { CatalogsTab } from './tabs/CatalogsTab';
import { CustomFieldsTab } from './tabs/CustomFieldsTab';
import { IntegrationsTab } from './tabs/IntegrationsTab';
import { AuditTab } from './tabs/AuditTab';

interface TabDefinition {
  value: string;
  label: string;
  permission: string;
  render: () => React.ReactNode;
}

const TABS: TabDefinition[] = [
  {
    value: 'empresa',
    label: 'Empresa',
    permission: 'settings.company.read',
    render: () => <CompanyTab />,
  },
  {
    value: 'organizacion',
    label: 'Organizacion',
    permission: 'settings.department.read',
    render: () => <OrganizationTab />,
  },
  {
    value: 'usuarios',
    label: 'Usuarios',
    permission: 'settings.user.read',
    render: () => <UsersTab />,
  },
  {
    value: 'roles',
    label: 'Roles y permisos',
    permission: 'settings.role.read',
    render: () => <RolesTab />,
  },
  {
    value: 'modulos',
    label: 'Modulos',
    permission: 'settings.module.manage',
    render: () => <ModulesTab />,
  },
  {
    value: 'catalogos',
    label: 'Catalogos',
    permission: 'settings.catalog.manage',
    render: () => <CatalogsTab />,
  },
  {
    value: 'campos',
    label: 'Campos personalizados',
    permission: 'settings.customfield.manage',
    render: () => <CustomFieldsTab />,
  },
  {
    value: 'integraciones',
    label: 'Integraciones',
    permission: 'settings.integration.manage',
    render: () => <IntegrationsTab />,
  },
  {
    value: 'auditoria',
    label: 'Auditoria',
    permission: 'settings.audit.read',
    render: () => <AuditTab />,
  },
];

export function SettingsPage() {
  const { tab } = useParams();
  const navigate = useNavigate();
  const can = useAuth((state) => state.can);

  const available = TABS.filter((item) => can(item.permission));
  const active = available.find((item) => item.value === tab)?.value ?? available[0]?.value;

  if (!available.length) {
    return (
      <PageHeader
        title="Configuracion"
        description="Su rol no tiene acceso a ninguna seccion de configuracion."
      />
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Configuracion"
        description="Empresa, organizacion, usuarios, permisos y trazabilidad."
      />

      <Tabs value={active} onValueChange={(value) => navigate(`/settings/${value}`)}>
        <TabsList className="flex-wrap">
          {available.map((item) => (
            <TabsTrigger key={item.value} value={item.value}>
              {item.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {available.map((item) => (
          <TabsContent key={item.value} value={item.value}>
            <div className="pt-4">{item.render()}</div>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
