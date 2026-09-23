import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, ShieldX } from 'lucide-react';
import * as React from 'react';
import { useParams } from 'react-router-dom';
import { apiGet } from '@/lib/api';
import { formatDateTime } from '@/lib/utils';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Skeleton,
} from '@/components/ui/primitives';
import { PublicShell } from './PublicShell';

interface Verification {
  valid: boolean;
  title?: string;
  company?: string;
  issuedAt?: string;
  issuedTo?: string | null;
}

/**
 * Landing page of the QR code printed on every generated document. It confirms
 * the document is genuine without exposing the holder's personal data.
 */
export function VerifyDocumentPage() {
  const { code = '' } = useParams();

  const { data, isLoading } = useQuery({
    queryKey: ['public', 'verify', code],
    queryFn: () => apiGet<Verification>(`/public/verify/${code}`),
    retry: false,
  });

  return (
    <PublicShell title="Verificacion de documento" className="max-w-xl">
      {isLoading ? (
        <Skeleton className="h-56 w-full" />
      ) : data?.valid ? (
        <Card className="border-emerald-500/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <CheckCircle2 className="h-5 w-5 text-emerald-500" />
              Documento autentico
            </CardTitle>
            <CardDescription>
              Este documento fue emitido por el sistema y no ha sido alterado.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Row label="Documento" value={data.title ?? '—'} />
            <Row label="Emitido por" value={data.company ?? '—'} />
            <Row label="A nombre de" value={data.issuedTo ?? 'No revelado'} />
            <Row
              label="Fecha de emision"
              value={data.issuedAt ? formatDateTime(data.issuedAt) : '—'}
            />
            <Row label="Codigo" value={<span className="font-mono">{code.toUpperCase()}</span>} />
          </CardContent>
        </Card>
      ) : (
        <Card className="border-destructive/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ShieldX className="h-5 w-5 text-destructive" />
              Documento no encontrado
            </CardTitle>
            <CardDescription>
              El codigo <span className="font-mono">{code.toUpperCase()}</span> no corresponde a
              ningun documento emitido. Verifique que lo haya transcrito completo.
            </CardDescription>
          </CardHeader>
        </Card>
      )}
    </PublicShell>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-3 border-b py-1.5 last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  );
}
