import { useQuery } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { apiGet } from '@/lib/api';
import { useChartPalette } from '@/components/charts';
import {
  Avatar,
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  PageHeader,
  Skeleton,
} from '@/components/ui/primitives';

interface Placement {
  id: string;
  performance: number;
  potential: number;
  box: number;
  notes: string | null;
  employee: {
    id: string;
    fullName: string;
    position: { name: string } | null;
    department: { name: string } | null;
  };
}

/** Box 1 is bottom-left (low/low) and box 9 is top-right (high/high). */
const BOX_LABELS: Record<number, string> = {
  9: 'Estrella',
  8: 'Alto potencial',
  7: 'Enigma',
  6: 'Alto desempeno',
  5: 'Colaborador clave',
  4: 'Potencial por desarrollar',
  3: 'Especialista confiable',
  2: 'Desempeno inconsistente',
  1: 'Riesgo / plan de accion',
};

export function NineBoxPage() {
  const { cycleId = '' } = useParams();
  const navigate = useNavigate();
  const { sequential } = useChartPalette();

  const { data, isLoading } = useQuery({
    queryKey: ['performance', 'nine-box', cycleId],
    queryFn: () => apiGet<Record<string, Placement[]>>(`/performance/cycles/${cycleId}/nine-box`),
    enabled: Boolean(cycleId),
  });

  if (isLoading) return <Skeleton className="h-96 w-full" />;

  const grid = data ?? {};
  const total = Object.values(grid).reduce((acc, list) => acc + list.length, 0);
  const max = Math.max(1, ...Object.values(grid).map((list) => list.length));

  // Rows are potential (high to low), columns are performance (low to high).
  const rows = [3, 2, 1];
  const columns = [1, 2, 3];

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" onClick={() => navigate('/performance/ciclos')}>
        <ArrowLeft className="h-4 w-4" />
        Volver a ciclos
      </Button>

      <PageHeader
        title="Matriz 9-box"
        description={`Desempeno por potencial · ${total} colaboradores ubicados`}
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Distribucion</CardTitle>
          <CardDescription>
            El eje vertical es potencial y el horizontal es desempeno. La intensidad del color
            indica cuantas personas hay en cada casilla.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3">
            <div className="flex flex-col justify-around py-2 text-xs font-medium text-muted-foreground">
              <span className="rotate-180 [writing-mode:vertical-rl]">Potencial</span>
            </div>

            <div className="min-w-0 flex-1 space-y-2">
              {rows.map((potential) => (
                <div key={potential} className="grid grid-cols-3 gap-2">
                  {columns.map((performance) => {
                    const box = (potential - 1) * 3 + performance;
                    const people = grid[String(box)] ?? [];
                    const intensity = people.length / max;
                    const step =
                      people.length === 0
                        ? 'hsl(var(--muted))'
                        : sequential[
                            Math.min(
                              sequential.length - 1,
                              Math.floor(intensity * (sequential.length - 1)),
                            )
                          ];
                    const light = intensity > 0.6;

                    return (
                      <div
                        key={box}
                        className="min-h-[140px] rounded-lg border p-2"
                        style={{ backgroundColor: step, color: light ? '#fff' : undefined }}
                      >
                        <div className="mb-1 flex items-center justify-between">
                          <p className="text-xs font-semibold">{BOX_LABELS[box]}</p>
                          <Badge
                            tone="muted"
                            className="bg-background/70 text-[10px] text-foreground"
                          >
                            {people.length}
                          </Badge>
                        </div>
                        <ul className="space-y-1">
                          {people.slice(0, 4).map((placement) => (
                            <li
                              key={placement.id}
                              className="flex items-center gap-1.5 text-[11px]"
                            >
                              <Avatar
                                name={placement.employee.fullName}
                                size="sm"
                                className="h-5 w-5 text-[8px]"
                              />
                              <span className="truncate">{placement.employee.fullName}</span>
                            </li>
                          ))}
                          {people.length > 4 ? (
                            <li className="text-[10px] opacity-80">+{people.length - 4} mas</li>
                          ) : null}
                        </ul>
                      </div>
                    );
                  })}
                </div>
              ))}

              <div className="grid grid-cols-3 gap-2 text-center text-xs text-muted-foreground">
                <span>Desempeno bajo</span>
                <span>Desempeno esperado</span>
                <span>Desempeno alto</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
