import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Lock } from 'lucide-react';
import * as React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { BarChart } from '@/components/charts';
import { apiGet } from '@/lib/api';
import { formatPercent, formatNumber } from '@/lib/utils';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  NativeSelect,
  PageHeader,
  Skeleton,
  StatCard,
} from '@/components/ui/primitives';

interface Results {
  survey: {
    id: string;
    title: string;
    kind: string;
    status: string;
    isAnonymous: boolean;
    minSegmentResponses: number;
  };
  invited: number;
  responses: number;
  participationRate: number;
  enps: number | null;
  climateIndex: number | null;
  byQuestion: Array<{
    key: string;
    label: string;
    type: string;
    dimension: string | null;
    responses: number;
    average: number | null;
    distribution: Record<string, number>;
    textAnswers?: Array<string | null>;
  }>;
  segments: Array<{ segment: string; responses: number; average: number | null; hidden: boolean }>;
}

export function SurveyResultsPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const [segmentBy, setSegmentBy] = React.useState('department');

  const { data, isLoading } = useQuery({
    queryKey: ['surveys', 'results', id, segmentBy],
    queryFn: () => apiGet<Results>(`/surveys/${id}/results`, { segmentBy }),
    enabled: Boolean(id),
  });

  const openQuestion = data?.byQuestion.find((question) => question.textAnswers?.length);

  const { data: words } = useQuery({
    queryKey: ['surveys', 'text-analysis', id, openQuestion?.key],
    queryFn: () =>
      apiGet<{ words: Array<{ word: string; count: number }> }>(`/surveys/${id}/text-analysis`, {
        questionKey: openQuestion?.key,
      }),
    enabled: Boolean(id && openQuestion?.key),
    retry: false,
  });

  if (isLoading || !data) return <Skeleton className="h-96 w-full" />;

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" onClick={() => navigate('/surveys')}>
        <ArrowLeft className="h-4 w-4" />
        Volver a encuestas
      </Button>

      <PageHeader
        title={data.survey.title}
        description={`Resultados agregados · umbral de anonimato: ${data.survey.minSegmentResponses} respuestas`}
        actions={data.survey.isAnonymous ? <Badge tone="info">Encuesta anonima</Badge> : null}
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Invitados" value={data.invited} />
        <StatCard label="Respuestas" value={data.responses} />
        <StatCard label="Participacion" value={formatPercent(data.participationRate)} />
        {data.enps !== null ? (
          <StatCard
            label="eNPS"
            value={formatNumber(data.enps, 0)}
            hint="Promotores menos detractores"
            tone={data.enps >= 30 ? 'success' : data.enps >= 0 ? 'warning' : 'danger'}
          />
        ) : data.climateIndex !== null ? (
          <StatCard label="Indice de clima" value={formatPercent(data.climateIndex)} />
        ) : null}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Resultados por pregunta</CardTitle>
          <CardDescription>Promedio y distribucion de respuestas.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {data.byQuestion
            .filter((question) => Object.keys(question.distribution).length > 0)
            .map((question) => (
              <div key={question.key} className="space-y-2">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="text-sm font-medium">{question.label}</p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    {question.dimension ? <Badge tone="muted">{question.dimension}</Badge> : null}
                    <span>{question.responses} respuestas</span>
                    {question.average !== null ? (
                      <span className="font-medium text-foreground">
                        promedio {formatNumber(question.average, 2)}
                      </span>
                    ) : null}
                  </div>
                </div>
                <BarChart
                  data={Object.entries(question.distribution)
                    .map(([label, value]) => ({ label, value }))
                    .sort((a, b) => a.label.localeCompare(b.label))}
                  height={180}
                />
              </div>
            ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <CardTitle className="text-sm">Resultados por segmento</CardTitle>
              <CardDescription>
                Los segmentos con menos de {data.survey.minSegmentResponses} respuestas se ocultan
                para proteger el anonimato.
              </CardDescription>
            </div>
            <NativeSelect
              value={segmentBy}
              onChange={(event) => setSegmentBy(event.target.value)}
              className="w-44"
            >
              <option value="department">Por area</option>
              <option value="locationId">Por sede</option>
              <option value="seniority">Por antiguedad</option>
            </NativeSelect>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {data.segments.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin datos segmentados.</p>
          ) : (
            data.segments.map((segment) => (
              <div
                key={segment.segment}
                className="flex items-center gap-3 rounded-md border p-3 text-sm"
              >
                <span className="min-w-0 flex-1 truncate">{segment.segment}</span>
                {segment.hidden ? (
                  <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Lock className="h-3.5 w-3.5" />
                    Oculto por umbral de anonimato
                  </span>
                ) : (
                  <>
                    <span className="text-xs text-muted-foreground">
                      {segment.responses} respuestas
                    </span>
                    <span className="font-medium tabular-nums">
                      {segment.average !== null ? formatNumber(segment.average, 2) : '—'}
                    </span>
                  </>
                )}
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {words?.words?.length ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Temas en respuestas abiertas</CardTitle>
            <CardDescription>
              Frecuencia de palabras (heuristica). La interfaz permite conectar un modelo de
              lenguaje.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {words.words.slice(0, 40).map((word) => (
              <span
                key={word.word}
                className="rounded-full bg-muted px-2.5 py-1"
                style={{ fontSize: `${Math.min(22, 11 + word.count)}px` }}
              >
                {word.word}
              </span>
            ))}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
