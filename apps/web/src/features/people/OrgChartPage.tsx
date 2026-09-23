import { useQuery } from '@tanstack/react-query';
import { ChevronDown, ChevronRight, Network, Search } from 'lucide-react';
import * as React from 'react';
import { Link } from 'react-router-dom';
import { apiGet } from '@/lib/api';
import {
  Avatar,
  Badge,
  Card,
  CardContent,
  EmptyState,
  Input,
  PageHeader,
  Skeleton,
} from '@/components/ui/primitives';
import { cn } from '@/lib/utils';

interface OrgNode {
  id: string;
  name: string;
  employeeCode: string;
  positionName: string | null;
  departmentName: string | null;
  locationName: string | null;
  directReports: number;
  children: OrgNode[];
}

export function OrgChartPage() {
  const [search, setSearch] = React.useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['people', 'org-chart'],
    queryFn: () => apiGet<OrgNode[]>('/organization/org-chart'),
  });

  const filtered = React.useMemo(() => {
    if (!search.trim() || !data) return data ?? [];
    const term = search.toLowerCase();
    const matches: OrgNode[] = [];
    const walk = (nodes: OrgNode[]) => {
      for (const node of nodes) {
        if (
          node.name.toLowerCase().includes(term) ||
          (node.positionName ?? '').toLowerCase().includes(term) ||
          (node.departmentName ?? '').toLowerCase().includes(term)
        ) {
          matches.push(node);
        }
        walk(node.children);
      }
    };
    walk(data);
    return matches;
  }, [data, search]);

  const totalPeople = React.useMemo(() => {
    let count = 0;
    const walk = (nodes: OrgNode[]) => {
      for (const node of nodes) {
        count += 1;
        walk(node.children);
      }
    };
    walk(data ?? []);
    return count;
  }, [data]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Organigrama"
        description={`Jerarquia de reporte directo · ${totalPeople} colaboradores`}
        actions={
          <div className="relative w-full sm:w-72">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar persona, cargo o area"
              className="pl-9"
            />
          </div>
        }
      />

      {isLoading ? (
        <Skeleton className="h-96 w-full" />
      ) : (data ?? []).length === 0 ? (
        <EmptyState icon={Network} title="Sin datos de organigrama" />
      ) : search.trim() ? (
        <Card>
          <CardContent className="space-y-2 p-4">
            {filtered.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">Sin coincidencias.</p>
            ) : (
              filtered.map((node) => <PersonCard key={node.id} node={node} />)
            )}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="overflow-x-auto p-4">
            <ul className="space-y-1">
              {(data ?? []).map((node) => (
                <TreeNode key={node.id} node={node} depth={0} />
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function TreeNode({ node, depth }: { node: OrgNode; depth: number }) {
  const [open, setOpen] = React.useState(depth < 2);
  const hasChildren = node.children.length > 0;

  return (
    <li>
      <div
        className={cn('flex items-center gap-2 rounded-md py-1', depth > 0 && 'border-l pl-4')}
        style={{ marginLeft: depth > 0 ? depth * 8 : 0 }}
      >
        {hasChildren ? (
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            className="rounded p-1 text-muted-foreground hover:bg-accent"
            aria-label={open ? 'Contraer' : 'Expandir'}
          >
            {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </button>
        ) : (
          <span className="w-6" />
        )}
        <PersonCard node={node} compact />
      </div>
      {hasChildren && open ? (
        <ul className="space-y-1">
          {node.children.map((child) => (
            <TreeNode key={child.id} node={child} depth={depth + 1} />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

function PersonCard({ node, compact = false }: { node: OrgNode; compact?: boolean }) {
  return (
    <Link
      to={`/people/employees/${node.id}`}
      className={cn(
        'flex min-w-0 flex-1 items-center gap-3 rounded-md border p-2 transition-colors hover:bg-accent',
        compact ? 'py-1.5' : 'p-3',
      )}
    >
      <Avatar name={node.name} size="sm" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{node.name}</p>
        <p className="truncate text-xs text-muted-foreground">
          {node.positionName ?? '—'}
          {node.departmentName ? ` · ${node.departmentName}` : ''}
        </p>
      </div>
      {node.directReports > 0 ? (
        <Badge tone="muted" className="shrink-0">
          {node.directReports} reportes
        </Badge>
      ) : null}
    </Link>
  );
}
