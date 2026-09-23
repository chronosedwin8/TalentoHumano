import type { BlockDocument } from '@talento/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, CheckCircle2 } from 'lucide-react';
import * as React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { BlockProgress, BlockRenderer } from '@/components/blocks/BlockRenderer';
import { apiGet, apiPost } from '@/lib/api';
import { toast } from '@/components/ui/overlays';
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  PageHeader,
  Skeleton,
} from '@/components/ui/primitives';

interface Lesson {
  id: string;
  title: string;
  estimatedMinutes: number;
  module: { id: string; title: string; courseId: string };
  content: { blocks: BlockDocument; isPublished: boolean } | null;
  quizzes: Array<{
    id: string;
    title: string;
    passingScore: number;
    maxAttempts: number;
    questions: Array<{
      id: string;
      text: string;
      type: string;
      options: Array<{ id: string; text: string }>;
    }>;
  }>;
}

export function LessonViewerPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [completed, setCompleted] = React.useState<Record<string, boolean>>({});
  const [answers, setAnswers] = React.useState<Record<string, string>>({});
  const [result, setResult] = React.useState<{ score: number; passed: boolean } | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['learning', 'lesson', id],
    queryFn: () => apiGet<Lesson>(`/learning/lessons/${id}`),
    enabled: Boolean(id),
  });

  const { data: enrollments } = useQuery({
    queryKey: ['learning', 'my-courses'],
    queryFn: () => apiGet<Array<{ id: string; course: { id: string } }>>('/learning/my-courses'),
    retry: false,
  });

  const enrollmentId = React.useMemo(
    () => (enrollments ?? []).find((row) => row.course.id === data?.module.courseId)?.id ?? null,
    [enrollments, data?.module.courseId],
  );

  const { data: providers } = useQuery({
    queryKey: ['learning', 'embed-providers'],
    queryFn: () =>
      apiGet<Array<{ domain: string; isActive: boolean }>>('/learning/embed-providers'),
    retry: false,
  });

  const track = useMutation({
    mutationFn: (payload: { blockId?: string; completed?: boolean }) =>
      apiPost('/learning/progress', {
        enrollmentId,
        lessonId: id,
        ...payload,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['learning', 'my-courses'] });
    },
  });

  const submitQuiz = useMutation({
    mutationFn: (quizId: string) =>
      apiPost<{ score: number; passed: boolean; attemptsLeft: number }>(
        `/learning/quizzes/${quizId}/submit`,
        { answers, enrollmentId },
      ),
    onSuccess: (response) => {
      setResult(response);
      toast[response.passed ? 'success' : 'error'](
        response.passed ? 'Evaluacion aprobada' : 'Evaluacion no aprobada',
        `Puntaje: ${response.score}%`,
      );
      void queryClient.invalidateQueries({ queryKey: ['learning'] });
    },
    onError: (error: Error) => toast.error('No fue posible enviar la evaluacion', error.message),
  });

  if (isLoading || !data) return <Skeleton className="h-96 w-full" />;

  const handleBlockComplete = (blockId: string) => {
    setCompleted((current) => ({ ...current, [blockId]: true }));
    if (enrollmentId) track.mutate({ blockId });
  };

  const requiredBlocks = (data.content?.blocks.blocks ?? []).filter((block) => block.required);
  const allRequiredDone =
    requiredBlocks.length === 0 || requiredBlocks.every((block) => completed[block.id]);

  return (
    <div className="space-y-6">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => navigate(`/learning/courses/${data.module.courseId}`)}
      >
        <ArrowLeft className="h-4 w-4" />
        Volver al curso
      </Button>

      <PageHeader
        title={data.title}
        description={`${data.module.title} · ${data.estimatedMinutes} min`}
      />

      <div className="grid gap-4 lg:grid-cols-4">
        <Card className="lg:col-span-3">
          <CardContent className="p-6">
            <BlockRenderer
              document={data.content?.blocks}
              options={{
                allowedEmbedDomains: (providers ?? [])
                  .filter((provider) => provider.isActive)
                  .map((provider) => provider.domain),
                onBlockComplete: handleBlockComplete,
                completedBlocks: completed,
              }}
            />
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Progreso de la leccion</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <BlockProgress document={data.content?.blocks} completed={completed} />
              <Button
                className="w-full"
                disabled={!allRequiredDone || !enrollmentId}
                onClick={() => {
                  track.mutate({ completed: true });
                  toast.success('Leccion completada');
                }}
              >
                <CheckCircle2 className="h-4 w-4" />
                Marcar como completada
              </Button>
              {!enrollmentId ? (
                <p className="text-xs text-muted-foreground">
                  No esta inscrito en este curso, por lo que no se registra progreso.
                </p>
              ) : null}
            </CardContent>
          </Card>
        </div>
      </div>

      {data.quizzes.map((quiz) => (
        <Card key={quiz.id}>
          <CardHeader>
            <CardTitle className="text-base">{quiz.title}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {quiz.questions.map((question, index) => (
              <div key={question.id} className="space-y-2">
                <p className="text-sm font-medium">
                  {index + 1}. {question.text}
                </p>
                <div className="space-y-1.5">
                  {question.options.map((option) => (
                    <label
                      key={option.id}
                      className="flex cursor-pointer items-center gap-2 rounded-md border p-2 text-sm hover:bg-accent"
                    >
                      <input
                        type="radio"
                        name={question.id}
                        checked={answers[question.id] === option.id}
                        onChange={() => setAnswers({ ...answers, [question.id]: option.id })}
                        className="h-4 w-4"
                      />
                      {option.text}
                    </label>
                  ))}
                </div>
              </div>
            ))}

            {result ? (
              <div
                className={`rounded-md p-3 text-sm ${
                  result.passed
                    ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                    : 'bg-destructive/10 text-destructive'
                }`}
              >
                Puntaje obtenido: {result.score}% ·{' '}
                {result.passed ? 'aprobado' : `se requiere ${quiz.passingScore}%`}
              </div>
            ) : null}

            <Button
              loading={submitQuiz.isPending}
              disabled={Object.keys(answers).length < quiz.questions.length}
              onClick={() => submitQuiz.mutate(quiz.id)}
            >
              Enviar evaluacion
            </Button>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
