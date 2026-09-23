import { useQuery } from '@tanstack/react-query';
import { BookOpen, FileText, LifeBuoy, Search, Users } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { apiList } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import {
  Avatar,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  EmptyState,
  PageHeader,
  Skeleton,
} from '@/components/ui/primitives';

/** Global search across the entities the user is allowed to read. */
export function SearchPage() {
  const [params] = useSearchParams();
  const term = params.get('q') ?? '';
  const { can, hasModule } = useAuth();

  const employees = useQuery({
    queryKey: ['search', 'employees', term],
    queryFn: () => apiList<any>('/people/employees', { search: term, limit: 6 }),
    enabled: Boolean(term) && can('people.employee.read'),
    retry: false,
  });

  const wiki = useQuery({
    queryKey: ['search', 'wiki', term],
    queryFn: () => apiList<any>('/communication/wiki', { search: term, limit: 6 }),
    enabled: Boolean(term) && hasModule('communication'),
    retry: false,
  });

  const kb = useQuery({
    queryKey: ['search', 'kb', term],
    queryFn: () => apiList<any>('/helpdesk/kb', { search: term, limit: 6 }),
    enabled: Boolean(term) && hasModule('helpdesk'),
    retry: false,
  });

  const tickets = useQuery({
    queryKey: ['search', 'tickets', term],
    queryFn: () => apiList<any>('/helpdesk/tickets', { search: term, limit: 6 }),
    enabled: Boolean(term) && can('helpdesk.ticket.read'),
    retry: false,
  });

  const isLoading = employees.isLoading || wiki.isLoading || kb.isLoading || tickets.isLoading;
  const totalResults =
    (employees.data?.data.length ?? 0) +
    (wiki.data?.data.length ?? 0) +
    (kb.data?.data.length ?? 0) +
    (tickets.data?.data.length ?? 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Resultados de busqueda"
        description={term ? `Para "${term}"` : undefined}
      />

      {!term ? (
        <EmptyState icon={Search} title="Escriba algo para buscar" />
      ) : isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : totalResults === 0 ? (
        <EmptyState
          icon={Search}
          title="Sin resultados"
          description="Intente con otras palabras o revise sus permisos de acceso."
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {employees.data?.data.length ? (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-sm">
                  <Users className="h-4 w-4" />
                  Colaboradores
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1">
                {employees.data.data.map((row: any) => (
                  <Link
                    key={row.id}
                    to={`/people/employees/${row.id}`}
                    className="flex items-center gap-3 rounded-md p-2 text-sm hover:bg-accent"
                  >
                    <Avatar name={row.fullName} size="sm" />
                    <div className="min-w-0">
                      <p className="truncate font-medium">{row.fullName}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {row.position?.name ?? '—'}
                      </p>
                    </div>
                  </Link>
                ))}
              </CardContent>
            </Card>
          ) : null}

          {wiki.data?.data.length ? (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-sm">
                  <BookOpen className="h-4 w-4" />
                  Wiki
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1">
                {wiki.data.data.map((row: any) => (
                  <Link
                    key={row.id}
                    to={`/communication/wiki?slug=${row.slug}`}
                    className="block rounded-md p-2 text-sm hover:bg-accent"
                  >
                    <p className="font-medium">{row.title}</p>
                    {row.summary ? (
                      <p className="line-clamp-1 text-xs text-muted-foreground">{row.summary}</p>
                    ) : null}
                  </Link>
                ))}
              </CardContent>
            </Card>
          ) : null}

          {kb.data?.data.length ? (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-sm">
                  <FileText className="h-4 w-4" />
                  Base de conocimiento
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1">
                {kb.data.data.map((row: any) => (
                  <Link
                    key={row.id}
                    to="/helpdesk/conocimiento"
                    className="block rounded-md p-2 text-sm hover:bg-accent"
                  >
                    <p className="font-medium">{row.title}</p>
                  </Link>
                ))}
              </CardContent>
            </Card>
          ) : null}

          {tickets.data?.data.length ? (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-sm">
                  <LifeBuoy className="h-4 w-4" />
                  Tickets
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1">
                {tickets.data.data.map((row: any) => (
                  <Link
                    key={row.id}
                    to={`/helpdesk/tickets/${row.id}`}
                    className="block rounded-md p-2 text-sm hover:bg-accent"
                  >
                    <p className="font-medium">
                      #{row.number} {row.subject}
                    </p>
                  </Link>
                ))}
              </CardContent>
            </Card>
          ) : null}
        </div>
      )}
    </div>
  );
}
