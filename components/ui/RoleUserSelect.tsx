'use client';

import { useMemo, useState } from 'react';
import useSWR from 'swr';

type DirectoryUser = {
  id: string;
  name: string;
  email: string | null;
  role: string;
};

export type RoleUserOption = { id: string; label: string; displayLabel: string };

const fetcher = async (url: string) => {
  const res = await fetch(url, { credentials: 'include' });
  const json = await res.json().catch(() => null);
  if (!res.ok || !json?.ok) throw new Error(json?.error || 'Failed');
  return json as { ok: true; users: DirectoryUser[] };
};

export function RoleUserSelect({
  roles,
  value,
  onChange,
  placeholder = 'Сонгох...',
  className = '',
}: {
  roles: string[];
  value: string;
  onChange: (id: string, user: RoleUserOption | null) => void;
  placeholder?: string;
  className?: string;
}) {
  const q = useMemo(() => new URLSearchParams({ roles: roles.join(',') }).toString(), [roles]);
  const { data } = useSWR(`/api/user-directory?${q}`, fetcher, { keepPreviousData: true });
  const [selectedId, setSelectedId] = useState('');

  const options = useMemo(() => {
    const users = data?.users || [];
    const labels = users.map((u) => (u.name || '').trim() || u.email || 'Нэргүй хэрэглэгч');
    const labelCounts = new Map<string, number>();
    for (const label of labels) labelCounts.set(label, (labelCounts.get(label) ?? 0) + 1);
    return users
      .map((u, index) => {
        const label = labels[index];
        const duplicate = (labelCounts.get(label) ?? 0) > 1;
        return { id: u.id, label, displayLabel: duplicate ? `${label} — ${u.email || 'Имэйлгүй'}` : label };
      })
      .sort((a, b) => a.label.localeCompare(b.label, 'mn'));
  }, [data?.users]);

  const byId = options.find((o) => o.id === value);
  const byLabel = options.filter((o) => o.label === value);
  // Signature-only callers keep the displayed name; retain their explicit choice locally.
  const localOption = options.find((o) => o.id === selectedId && o.label === value);
  const matchingOption = byId ?? localOption ?? (byLabel.length === 1 ? byLabel[0] : undefined);

  return (
    <select
      value={matchingOption?.id ?? value}
      onChange={(e) => {
        const option = options.find((o) => o.id === e.target.value) ?? null;
        setSelectedId(option?.id ?? '');
        onChange(option?.id ?? '', option);
      }}
      className={
        'w-full px-3 py-2 rounded-xl border border-gray-200 bg-white text-sm outline-none focus:ring-2 focus:ring-orange-500/20 ' +
        className
      }
    >
      <option value="">{placeholder}</option>
      {value && !matchingOption && (
        <option value={value} disabled>{value}</option>
      )}
      {options.map((o) => (
        <option key={o.id} value={o.id}>
          {o.displayLabel}
        </option>
      ))}
    </select>
  );
}
