import { useQuery } from '@tanstack/react-query';
import { Star } from 'lucide-react';
import * as React from 'react';
import { DataTable, type Column } from '@/components/DataTable';
import { apiList } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import { Avatar, Badge, PageHeader } from '@/components/ui/primitives';

interface CandidateRow {
  id: string;
  fullName: string;
  email: string;
  phone: string | null;
  city: string | null;
  source: string;
  rating: number | null;
  createdAt: string;
  retentionUntil: string | null;
  tags: Array<{ id: string; tag: string }>;
  _count: { applications: number };
}

export function CandidatesPage() {
  const [page, setPage] = React.useState(1);
  const [search, setSearch] = React.useState('');
  const [debounced, setDebounced] = React.useState('');

  React.useEffect(() => {
    const timer = setTimeout(() => {
      setDebounced(search);
      setPage(1);
    }, 350);
    return () => clearTimeout(timer);
  }, [search]);

  const { data, isLoading } = useQuery({
    queryKey: ['recruiting', 'candidates', { page, debounced }],
    queryFn: () =>
      apiList<CandidateRow>('/recruiting/candidates', { page, limit: 25, search: debounced }),
  });

  const columns: Array<Column<CandidateRow>> = [
    {
      key: 'fullName',
      header: 'Candidato',
      render: (row) => (
        <div className="flex items-center gap-3">
          <Avatar name={row.fullName} size="sm" />
          <div className="min-w-0">
            <p className="truncate font-medium">{row.fullName}</p>
            <p className="truncate text-xs text-muted-foreground">{row.email}</p>
          </div>
        </div>
      ),
    },
    { key: 'city', header: 'Ciudad', hideOnMobile: true, render: (row) => row.city ?? '—' },
    {
      key: 'source',
      header: 'Fuente',
      hideOnMobile: true,
      render: (row) => <Badge tone="muted">{row.source}</Badge>,
    },
    {
      key: 'applications',
      header: 'Postulaciones',
      render: (row) => row._count.applications,
    },
    {
      key: 'rating',
      header: 'Valoracion',
      hideOnMobile: true,
      render: (row) =>
        row.rating ? (
          <span className="flex items-center gap-1 text-amber-500">
            <Star className="h-3.5 w-3.5 fill-current" />
            {row.rating}
          </span>
        ) : (
          '—'
        ),
    },
    {
      key: 'tags',
      header: 'Etiquetas',
      hideOnMobile: true,
      render: (row) => (
        <div className="flex flex-wrap gap-1">
          {row.tags.slice(0, 3).map((tag) => (
            <Badge key={tag.id} tone="info" className="text-[10px]">
              {tag.tag}
            </Badge>
          ))}
        </div>
      ),
    },
    {
      key: 'retentionUntil',
      header: 'Retencion hasta',
      hideOnMobile: true,
      render: (row) => formatDate(row.retentionUntil),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Banco de candidatos"
        description="Talent pool con busqueda por texto del CV. Los datos se anonimizan al vencer la retencion (Habeas Data)."
      />

      <DataTable
        columns={columns}
        rows={data?.data ?? []}
        loading={isLoading}
        total={data?.meta?.total ?? 0}
        page={page}
        limit={25}
        onPageChange={setPage}
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Nombre, correo, documento o contenido del CV"
        emptyTitle="Sin candidatos"
        emptyDescription="Los candidatos se crean desde el portal publico de empleos o manualmente."
      />
    </div>
  );
}
