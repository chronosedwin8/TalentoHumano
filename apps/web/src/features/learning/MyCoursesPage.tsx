import { useQuery } from '@tanstack/react-query';
import { BookOpen, Clock, GraduationCap, Library } from 'lucide-react';
import { Link } from 'react-router-dom';
import { apiGet } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { formatDate, statusLabel, statusTone } from '@/lib/utils';
import {
  Badge,
  Button,
  Card,
  CardContent,
  EmptyState,
  PageHeader,
  Progress,
  Skeleton,
} from '@/components/ui/primitives';

interface EnrollmentRow {
  id: string;
  status: string;
  progress: number;
  dueDate: string | null;
  score: string | null;
  course: {
    id: string;
    title: string;
    summary: string | null;
    category: string | null;
    estimatedMinutes: number;
    isMandatory: boolean;
  };
}

export function MyCoursesPage() {
  const can = useAuth((state) => state.can);

  const { data, isLoading } = useQuery({
    queryKey: ['learning', 'my-courses'],
    queryFn: () => apiGet<EnrollmentRow[]>('/learning/my-courses'),
  });

  const rows = data ?? [];
  const pending = rows.filter((row) => row.status !== 'completed');
  const done = rows.filter((row) => row.status === 'completed');

  return (
    <div className="space-y-6">
      <PageHeader
        title="Mi formacion"
        description="Cursos asignados, obligatorios y de libre inscripcion."
        actions={
          can('learning.course.read') ? (
            <Button asChild variant="outline">
              <Link to="/learning/catalogo">
                <Library className="h-4 w-4" />
                Catalogo de cursos
              </Link>
            </Button>
          ) : null
        }
      />

      {isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={GraduationCap}
          title="Sin cursos asignados"
          description="Cuando se le asigne formacion aparecera aqui."
        />
      ) : (
        <>
          <section className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              En curso ({pending.length})
            </h2>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {pending.map((row) => (
                <CourseCard key={row.id} enrollment={row} />
              ))}
              {pending.length === 0 ? (
                <p className="text-sm text-muted-foreground">Esta al dia con su formacion.</p>
              ) : null}
            </div>
          </section>

          {done.length ? (
            <section className="space-y-3">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Completados ({done.length})
              </h2>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {done.map((row) => (
                  <CourseCard key={row.id} enrollment={row} />
                ))}
              </div>
            </section>
          ) : null}
        </>
      )}
    </div>
  );
}

function CourseCard({ enrollment }: { enrollment: EnrollmentRow }) {
  const overdue =
    enrollment.status !== 'completed' &&
    enrollment.dueDate &&
    new Date(enrollment.dueDate) < new Date();

  return (
    <Card className="transition-shadow hover:shadow-md">
      <CardContent className="space-y-3 p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate font-medium">{enrollment.course.title}</p>
            <p className="truncate text-xs text-muted-foreground">
              {enrollment.course.category ?? 'General'}
            </p>
          </div>
          {enrollment.course.isMandatory ? <Badge tone="warning">Obligatorio</Badge> : null}
        </div>

        {enrollment.course.summary ? (
          <p className="line-clamp-2 text-sm text-muted-foreground">{enrollment.course.summary}</p>
        ) : null}

        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" />
              {enrollment.course.estimatedMinutes} min
            </span>
            <span>{enrollment.progress}%</span>
          </div>
          <Progress
            value={enrollment.progress}
            tone={enrollment.progress === 100 ? 'success' : overdue ? 'danger' : 'default'}
          />
        </div>

        <div className="flex items-center justify-between">
          <Badge tone={overdue ? 'danger' : statusTone(enrollment.status)}>
            {overdue ? 'Vencido' : statusLabel(enrollment.status)}
          </Badge>
          {enrollment.dueDate ? (
            <span className="text-xs text-muted-foreground">
              Vence {formatDate(enrollment.dueDate)}
            </span>
          ) : null}
        </div>

        <Button asChild size="sm" className="w-full">
          <Link to={`/learning/courses/${enrollment.course.id}`}>
            <BookOpen className="h-4 w-4" />
            {enrollment.status === 'completed' ? 'Repasar' : 'Continuar'}
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
