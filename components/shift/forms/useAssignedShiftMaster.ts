'use client';

import { useEffect, useState } from 'react';

export function useAssignedShiftMaster({
  shiftDate,
  shiftType,
  stationCode,
  operatorUid,
}: {
  shiftDate: string;
  shiftType: string;
  stationCode: string;
  operatorUid: string;
}) {
  const [assignedMasterName, setAssignedMasterName] = useState('');

  useEffect(() => {
    let cancelled = false;
    const loadAssignedMaster = async () => {
      try {
        const qs = new URLSearchParams({
          queryType: 'assigned_master',
          shiftDate,
          shiftType,
          stationCode,
          operatorUid,
        });
        const res = await fetch(`/api/operator-schedules?${qs.toString()}`, { credentials: 'include' });
        const data = await res.json().catch(() => null);
        if (cancelled || !res.ok || !data?.ok) return;
        setAssignedMasterName(String(data.master?.masterName || '').trim());
      } catch {
        if (!cancelled) setAssignedMasterName('');
      }
    };
    loadAssignedMaster();
    return () => {
      cancelled = true;
    };
  }, [shiftDate, shiftType, stationCode, operatorUid]);

  return assignedMasterName;
}
