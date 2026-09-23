import { useQuery } from '@tanstack/react-query';
import { Briefcase, Clock, MapPin, Search } from 'lucide-react';
import * as React from 'react';
import { Link, useParams } from 'react-router-dom';
import { apiGet } from '@/lib/api';
import { formatCurrency, formatDate, statusLabel } from '@/lib/utils';
import {
  Badge,
  Card,
  CardContent,
  EmptyState,
  Input,
  NativeSelect,
  Skeleton,
} from '@/components/ui/primitives';
import { PublicShell, type PublicCompany } from './PublicShell';

interface Posting {
  id: string;
  slug: string;
  code: string;
  title: string;
  description: string | null;
  workModality: string;
  contractType: string;
  openings: number;
  publishedAt: string | null;
  closesAt: string | null;
  salaryVisible: boolean;
  salaryRangeMin: number | null;
  salaryRangeMax: number | null;
  department: { name: string } | null;
  location: { name: string; city: string | null } | null;
}

export function CareersPage() {
  const { companySlug = '' } = useParams();
  const [search, setSearch] = React.useState('');
  const [modality, setModality] = React.useState('');
  const [city, setCity] = React.useState('');

  const { data, isLoading, isError } = useQuery({
    queryKey: ['public', 'careers', companySlug],
    queryFn: () =>
      apiGet<{ company: PublicCompany; postings: Posting[] }>(`/public/careers/${companySlug}`),
    retry: false,
  });

  const postings = (data?.postings ?? []).filter((posting) => {
    if (
      search &&
      !`${posting.title} ${posting.department?.name ?? ''}`
        .toLowerCase()
        .includes(search.toLowerCase())
    ) {
      return false;
    }
    if (modality && posting.workModality !== modality) return false;
    if (city && posting.location?.city !== city) return false;
    return true;
  });

  const cities = [
    ...new Set((data?.postings ?? []).map((posting) => posting.location?.city).filter(Boolean)),
  ] as string[];

  if (isError) {
    return (
      <PublicShell title="Portal de empleo">
        <EmptyState
          icon={Briefcase}
          title="Empresa no encontrada"
          description="Verifique el enlace."
        />
      </PublicShell>
    );
  }

  return (
    <PublicShell
      company={data?.company}
      title="Trabaje con nosotros"
      subtitle={`${postings.length} ${postings.length === 1 ? 'vacante abierta' : 'vacantes abiertas'}`}
    >
      <div className="mb-6 flex flex-wrap gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar por cargo o area"
            className="pl-9"
          />
        </div>
        <NativeSelect
          value={modality}
          onChange={(event) => setModality(event.target.value)}
          className="w-44"
        >
          <option value="">Toda modalidad</option>
          <option value="presencial">Presencial</option>
          <option value="hibrido">Hibrido</option>
          <option value="remoto">Remoto</option>
        </NativeSelect>
        {cities.length ? (
          <NativeSelect
            value={city}
            onChange={(event) => setCity(event.target.value)}
            className="w-44"
          >
            <option value="">Toda ciudad</option>
            {cities.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </NativeSelect>
        ) : null}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }, (_, index) => (
            <Skeleton key={index} className="h-28 w-full" />
          ))}
        </div>
      ) : postings.length === 0 ? (
        <EmptyState
          icon={Briefcase}
          title="No hay vacantes publicadas"
          description="Vuelva pronto: publicamos nuevas oportunidades con frecuencia."
        />
      ) : (
        <div className="space-y-3">
          {postings.map((posting) => (
            <Link key={posting.id} to={`/careers/${companySlug}/${posting.slug}`} className="block">
              <Card className="transition-colors hover:border-primary/50">
                <CardContent className="space-y-2 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <h2 className="text-base font-semibold">{posting.title}</h2>
                    {posting.openings > 1 ? (
                      <Badge tone="info">{posting.openings} vacantes</Badge>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                    {posting.location ? (
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3.5 w-3.5" />
                        {posting.location.city ?? posting.location.name}
                      </span>
                    ) : null}
                    <Badge tone="muted">{statusLabel(posting.workModality)}</Badge>
                    <Badge tone="muted">{statusLabel(posting.contractType)}</Badge>
                    {posting.department ? <span>{posting.department.name}</span> : null}
                    {posting.closesAt ? (
                      <span className="flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5" />
                        Cierra {formatDate(posting.closesAt)}
                      </span>
                    ) : null}
                  </div>
                  {posting.salaryVisible && posting.salaryRangeMin ? (
                    <p className="text-sm font-medium">
                      {formatCurrency(posting.salaryRangeMin)}
                      {posting.salaryRangeMax ? ` — ${formatCurrency(posting.salaryRangeMax)}` : ''}
                    </p>
                  ) : null}
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </PublicShell>
  );
}
