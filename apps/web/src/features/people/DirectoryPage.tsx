import { useQuery } from '@tanstack/react-query';
import { Mail, Phone, Search, Users } from 'lucide-react';
import * as React from 'react';
import { Link } from 'react-router-dom';
import { apiGet, apiList } from '@/lib/api';
import {
  Avatar,
  Button,
  Card,
  CardContent,
  EmptyState,
  Input,
  NativeSelect,
  PageHeader,
  Skeleton,
} from '@/components/ui/primitives';

interface DirectoryRow {
  id: string;
  fullName: string;
  email: string;
  phone: string | null;
  extension: string | null;
  position: { name: string } | null;
  department: { name: string } | null;
  location: { name: string } | null;
}

export function DirectoryPage() {
  const [search, setSearch] = React.useState('');
  const [debounced, setDebounced] = React.useState('');
  const [departmentId, setDepartmentId] = React.useState('');
  const [page, setPage] = React.useState(1);

  React.useEffect(() => {
    const timer = setTimeout(() => {
      setDebounced(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const { data: departments } = useQuery({
    queryKey: ['organization', 'departments'],
    queryFn: () => apiGet<Array<{ id: string; name: string }>>('/organization/departments'),
    retry: false,
  });

  const { data, isLoading } = useQuery({
    queryKey: ['people', 'directory', { debounced, departmentId, page }],
    queryFn: () =>
      apiList<DirectoryRow>('/organization/directory', {
        search: debounced,
        departmentId,
        page,
        limit: 48,
      }),
  });

  const rows = data?.data ?? [];
  const total = data?.meta?.total ?? 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Directorio"
        description={`${total} colaboradores visibles en el directorio.`}
      />

      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Nombre, correo o cargo"
            className="pl-9"
          />
        </div>
        <NativeSelect
          value={departmentId}
          onChange={(event) => {
            setDepartmentId(event.target.value);
            setPage(1);
          }}
          className="sm:w-56"
        >
          <option value="">Todas las areas</option>
          {(departments ?? []).map((department) => (
            <option key={department.id} value={department.id}>
              {department.name}
            </option>
          ))}
        </NativeSelect>
      </div>

      {isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, index) => (
            <Skeleton key={index} className="h-28 w-full" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <EmptyState
          icon={Users}
          title="Sin resultados"
          description="Ajuste la busqueda o el filtro de area."
        />
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {rows.map((row) => (
              <Card key={row.id} className="transition-shadow hover:shadow-md">
                <CardContent className="p-4">
                  <Link to={`/people/employees/${row.id}`} className="flex items-start gap-3">
                    <Avatar name={row.fullName} size="lg" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{row.fullName}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {row.position?.name ?? '—'}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {row.department?.name ?? '—'}
                        {row.location?.name ? ` · ${row.location.name}` : ''}
                      </p>
                    </div>
                  </Link>
                  <div className="mt-3 space-y-1 text-xs text-muted-foreground">
                    <a
                      href={`mailto:${row.email}`}
                      className="flex items-center gap-1.5 hover:text-primary"
                    >
                      <Mail className="h-3.5 w-3.5" />
                      <span className="truncate">{row.email}</span>
                    </a>
                    {row.phone || row.extension ? (
                      <span className="flex items-center gap-1.5">
                        <Phone className="h-3.5 w-3.5" />
                        {row.phone ?? '—'}
                        {row.extension ? ` ext. ${row.extension}` : ''}
                      </span>
                    ) : null}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {total > 48 ? (
            <div className="flex items-center justify-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
              >
                Anterior
              </Button>
              <span className="text-xs text-muted-foreground">
                Pagina {page} de {Math.ceil(total / 48)}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= Math.ceil(total / 48)}
                onClick={() => setPage(page + 1)}
              >
                Siguiente
              </Button>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
