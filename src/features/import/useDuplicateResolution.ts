import { useEffect, useMemo, useState } from "react";
import type { PreviewRow, RowOverride } from "./types";
import { buildDuplicateConfirmGroups } from "./utils";

export function useDuplicateResolution(
  rows: PreviewRow[],
  setOverrides: React.Dispatch<React.SetStateAction<Record<string, RowOverride>>>,
  setSelectedIds: React.Dispatch<React.SetStateAction<Set<string>>>,
) {
  const [closedDuplicateGroupId, setClosedDuplicateGroupId] = useState("");
  const [autoOpenedDuplicateGroupId, setAutoOpenedDuplicateGroupId] = useState("");
  const [duplicateSelectionState, setDuplicateSelectionState] = useState<{ groupId: string; ids: Set<string> }>({
    groupId: "",
    ids: new Set(),
  });

  const duplicateConfirmGroups = useMemo(() => buildDuplicateConfirmGroups(rows), [rows]);
  const activeDuplicateGroup = duplicateConfirmGroups[0] ?? null;
  const hasActiveDuplicateGroup = Boolean(activeDuplicateGroup);
  const activeDuplicateGroupId = activeDuplicateGroup
    ? `${activeDuplicateGroup.key}:${activeDuplicateGroup.rows.map((row) => row.id).join(",")}:${activeDuplicateGroup.existingCount}`
    : "";
  const duplicateDialogOpen = hasActiveDuplicateGroup && closedDuplicateGroupId !== activeDuplicateGroupId;
  const duplicateSelection = duplicateSelectionState.groupId === activeDuplicateGroupId
    ? duplicateSelectionState.ids
    : new Set<string>();

  useEffect(() => {
    if (!activeDuplicateGroupId || autoOpenedDuplicateGroupId === activeDuplicateGroupId) {
      return;
    }
    const timer = window.setTimeout(() => {
      setClosedDuplicateGroupId("");
      setAutoOpenedDuplicateGroupId(activeDuplicateGroupId);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [activeDuplicateGroupId, autoOpenedDuplicateGroupId]);

  function resetAutoOpen() {
    setAutoOpenedDuplicateGroupId("");
  }

  function selectDuplicateCandidate(id: string, checked: boolean) {
    setDuplicateSelectionState((current) => {
      const currentIds = current.groupId === activeDuplicateGroupId ? current.ids : new Set<string>();
      const next = new Set(currentIds);
      if (checked) {
        if (activeDuplicateGroup && next.size >= activeDuplicateGroup.existingCount) {
          return current;
        }
        next.add(id);
      } else {
        next.delete(id);
      }
      return { groupId: activeDuplicateGroupId, ids: next };
    });
  }

  function resolveDuplicateGroup(duplicateIds: Set<string>) {
    if (!activeDuplicateGroup) {
      return;
    }
    const ids = activeDuplicateGroup.rows.map((row) => row.id);
    setOverrides((current) => {
      const next = { ...current };
      ids.forEach((id) => {
        next[id] = {
          ...next[id],
          duplicateExisting: duplicateIds.has(id),
          duplicateKey: activeDuplicateGroup.key,
        };
      });
      return next;
    });
    setSelectedIds(new Set());
    setClosedDuplicateGroupId(activeDuplicateGroupId);
  }

  return {
    duplicateConfirmGroups,
    activeDuplicateGroup,
    duplicateDialogOpen,
    duplicateSelection,
    activeDuplicateGroupId,
    closedDuplicateGroupId,
    setClosedDuplicateGroupId,
    resetAutoOpen,
    selectDuplicateCandidate,
    resolveDuplicateGroup,
  };
}
