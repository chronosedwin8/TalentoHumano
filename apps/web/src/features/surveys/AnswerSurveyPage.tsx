import type { FormField, FormSchema } from '@talento/shared';
import { useMutation, useQuery } from '@tanstack/react-query';
import { ArrowLeft, CheckCircle2, ShieldCheck } from 'lucide-react';
import * as React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { apiGet, apiPost } from '@/lib/api';
import { toast } from '@/components/ui/overlays';
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  PageHeader,
  Skeleton,
  Textarea,
} from '@/components/ui/primitives';
import { cn } from '@/lib/utils';

interface SurveyDetail {
  id: string;
  title: string;
  description: string | null;
  isAnonymous: boolean;
  status: string;
  versions: Array<{ id: string; schema: FormSchema }>;
}

export function AnswerSurveyPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const [answers, setAnswers] = React.useState<Record<string, unknown>>({});
  const [done, setDone] = React.useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['surveys', 'detail', id],
    queryFn: () => apiGet<SurveyDetail>(`/surveys/${id}`),
    enabled: Boolean(id),
  });

  const submit = useMutation({
    mutationFn: () => apiPost(`/surveys/${id}/responses`, { answers, completed: true }),
    onSuccess: () => {
      setDone(true);
      toast.success('Respuesta enviada', 'Gracias por su participacion.');
    },
    onError: (error: Error) => toast.error('No fue posible enviar', error.message),
  });

  if (isLoading || !data) return <Skeleton className="h-96 w-full" />;

  const schema = data.versions[0]?.schema;
  const fields = schema?.fields ?? [];
  const requiredFields = fields.filter((field) => field.required);
  const complete = requiredFields.every(
    (field) => answers[field.key] !== undefined && answers[field.key] !== '',
  );

  if (done) {
    return (
      <div className="mx-auto max-w-lg py-16 text-center">
        <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-500" />
        <h1 className="mt-4 text-xl font-semibold">Respuesta registrada</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Gracias por participar. Sus respuestas se analizan de forma agregada.
        </p>
        <Button className="mt-6" onClick={() => navigate('/surveys')}>
          Volver a encuestas
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Button variant="ghost" size="sm" onClick={() => navigate('/surveys')}>
        <ArrowLeft className="h-4 w-4" />
        Volver
      </Button>

      <PageHeader title={data.title} description={data.description ?? undefined} />

      {data.isAnonymous ? (
        <Card className="border-sky-500/30 bg-sky-500/5">
          <CardContent className="flex gap-3 p-4 text-sm">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-sky-600" />
            <p className="text-muted-foreground">
              Esta encuesta es anonima: no se guarda ninguna relacion entre usted y sus respuestas.
              Los resultados por area solo se muestran cuando hay suficientes participantes.
            </p>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">{schema?.title ?? 'Cuestionario'}</CardTitle>
          {schema?.description ? <CardDescription>{schema.description}</CardDescription> : null}
        </CardHeader>
        <CardContent className="space-y-6">
          {fields.map((field, index) => (
            <QuestionField
              key={field.key}
              field={field}
              index={index}
              value={answers[field.key]}
              onChange={(value) => setAnswers({ ...answers, [field.key]: value })}
            />
          ))}

          <Button
            className="w-full"
            loading={submit.isPending}
            disabled={!complete}
            onClick={() => submit.mutate()}
          >
            Enviar respuestas
          </Button>
          {!complete ? (
            <p className="text-center text-xs text-muted-foreground">
              Responda todas las preguntas obligatorias para enviar.
            </p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}

function QuestionField({
  field,
  index,
  value,
  onChange,
}: {
  field: FormField;
  index: number;
  value: unknown;
  onChange: (value: unknown) => void;
}) {
  const label = (
    <p className="text-sm font-medium">
      {index + 1}. {field.label}
      {field.required ? <span className="ml-0.5 text-destructive">*</span> : null}
    </p>
  );

  switch (field.type) {
    case 'likert': {
      const labels = field.scaleLabels ?? [
        'Muy en desacuerdo',
        'En desacuerdo',
        'Neutral',
        'De acuerdo',
        'Muy de acuerdo',
      ];
      return (
        <div className="space-y-2">
          {label}
          <div className="grid grid-cols-5 gap-1.5">
            {labels.map((text, position) => (
              <button
                key={position}
                type="button"
                onClick={() => onChange(position + 1)}
                className={cn(
                  'rounded-md border p-2 text-[11px] leading-tight transition-colors',
                  value === position + 1
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'hover:bg-accent',
                )}
              >
                {text}
              </button>
            ))}
          </div>
        </div>
      );
    }

    case 'nps':
      return (
        <div className="space-y-2">
          {label}
          <div className="flex flex-wrap gap-1.5">
            {Array.from({ length: 11 }, (_, score) => (
              <button
                key={score}
                type="button"
                onClick={() => onChange(score)}
                className={cn(
                  'h-9 w-9 rounded-md border text-sm font-medium transition-colors',
                  value === score
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'hover:bg-accent',
                )}
              >
                {score}
              </button>
            ))}
          </div>
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Nada probable</span>
            <span>Muy probable</span>
          </div>
        </div>
      );

    case 'select':
    case 'radio':
      return (
        <div className="space-y-2">
          {label}
          <div className="space-y-1.5">
            {(field.options ?? []).map((option) => (
              <label
                key={option.value}
                className="flex cursor-pointer items-center gap-2 rounded-md border p-2 text-sm hover:bg-accent"
              >
                <input
                  type="radio"
                  name={field.key}
                  checked={value === option.value}
                  onChange={() => onChange(option.value)}
                  className="h-4 w-4"
                />
                {option.label}
              </label>
            ))}
          </div>
        </div>
      );

    case 'textarea':
      return (
        <div className="space-y-2">
          {label}
          <Textarea
            value={String(value ?? '')}
            onChange={(event) => onChange(event.target.value)}
            rows={4}
            placeholder={field.placeholder}
          />
        </div>
      );

    case 'number':
    case 'rating':
      return (
        <div className="space-y-2">
          {label}
          <Input
            type="number"
            value={String(value ?? '')}
            onChange={(event) => onChange(Number(event.target.value))}
          />
        </div>
      );

    case 'section':
      return <h3 className="border-b pb-1 text-sm font-semibold">{field.label}</h3>;

    default:
      return (
        <div className="space-y-2">
          {label}
          <Input
            value={String(value ?? '')}
            onChange={(event) => onChange(event.target.value)}
            placeholder={field.placeholder}
          />
        </div>
      );
  }
}
