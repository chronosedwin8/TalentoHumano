import { useQuery } from '@tanstack/react-query';
import { Check, ChevronsUpDown, X } from 'lucide-react';
import * as React from 'react';
import { apiList } from '@/lib/api';
import { cn, debounce } from '@/lib/utils';
import { Avatar, Button, Input } from '@/components/ui/primitives';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/overlays';

export interface PickableEmployee {
  id: string;
  fullName: string;
  employeeCode: string;
  position: { id: string; name: string } | string | null;
}

function positionName(position: PickableEmployee['position']): string | null {
  if (!position) return null;
  return typeof position === 'string' ? position : position.name;
}

interface EmployeePickerProps {
  value: string | null;
  onChange: (employeeId: string | null, employee?: PickableEmployee) => void;
  placeholder?: string;
  /** Restricts the search to the manager's own team. */
  scope?: 'all' | 'team';
  disabled?: boolean;
  className?: string;
}

/**
 * Searchable single-employee selector used wherever a form needs to point at a
 * person. It always searches server side so scopes and permissions apply.
 */
export function EmployeePicker({
  value,
  onChange,
  placeholder = 'Buscar colaborador',
  scope = 'all',
  disabled,
  className,
}: EmployeePickerProps) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState('');
  const [debounced, setDebounced] = React.useState('');
  const [selected, setSelected] = React.useState<PickableEmployee | null>(null);

  const push = React.useMemo(() => debounce((next: string) => setDebounced(next), 300), []);

  const { data, isLoading } = useQuery({
    queryKey: ['people', 'picker', debounced, scope],
    queryFn: () =>
      apiList<PickableEmployee>('/people/employees', {
        search: debounced,
        limit: 20,
        status: 'active',
        ...(scope === 'team' ? { scope: 'team' } : {}),
      }),
    enabled: open,
    retry: false,
  });

  // Resolves the label when the picker is mounted with a pre-selected value.
  const { data: current } = useQuery({
    queryKey: ['people', 'picker', 'one', value],
    queryFn: () => apiList<PickableEmployee>('/people/employees', { ids: value, limit: 1 }),
    enabled: Boolean(value) && !selected,
    retry: false,
  });

  React.useEffect(() => {
    if (!value) setSelected(null);
    else if (selected && selected.id !== value) setSelected(null);
    else if (!selected && current?.data?.[0]) setSelected(current.data[0]);
  }, [value, current, selected]);

  const label = selected?.fullName ?? (value ? 'Colaborador seleccionado' : placeholder);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          className={cn(
            'w-full justify-between font-normal',
            !value && 'text-muted-foreground',
            className,
          )}
        >
          <span className="flex min-w-0 items-center gap-2">
            {selected ? <Avatar name={selected.fullName} className="h-5 w-5 text-[10px]" /> : null}
            <span className="truncate">{label}</span>
          </span>
          {value ? (
            <span
              role="button"
              tabIndex={-1}
              onClick={(event) => {
                event.stopPropagation();
                setSelected(null);
                onChange(null);
              }}
              className="rounded p-0.5 hover:bg-accent"
              aria-label="Quitar seleccion"
            >
              <X className="h-3.5 w-3.5" />
            </span>
          ) : (
            <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[min(24rem,90vw)] p-2" align="start">
        <Input
          autoFocus
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            push(event.target.value);
          }}
          placeholder="Nombre, codigo o cargo"
        />
        <div className="mt-2 max-h-64 overflow-y-auto">
          {isLoading ? (
            <p className="p-2 text-sm text-muted-foreground">Buscando...</p>
          ) : (data?.data ?? []).length === 0 ? (
            <p className="p-2 text-sm text-muted-foreground">Sin resultados</p>
          ) : (
            (data?.data ?? []).map((employee) => (
              <button
                key={employee.id}
                type="button"
                onClick={() => {
                  setSelected(employee);
                  onChange(employee.id, employee);
                  setOpen(false);
                }}
                className="flex w-full items-center gap-2 rounded-md p-2 text-left text-sm hover:bg-accent"
              >
                <Avatar name={employee.fullName} className="h-7 w-7 text-xs" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate">{employee.fullName}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {employee.employeeCode}
                    {positionName(employee.position) ? ` · ${positionName(employee.position)}` : ''}
                  </span>
                </span>
                {value === employee.id ? <Check className="h-4 w-4 text-primary" /> : null}
              </button>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
