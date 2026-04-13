import { CommentThread, type TraficoNote } from '@/components/trafico/CommentThread'
import type { AvailableUser } from '@/components/trafico/MentionAutocomplete'

interface ComunicacionTabProps {
  traficoId: string
  notes: TraficoNote[]
  currentUserId: string
  availableUsers: AvailableUser[]
}

export function ComunicacionTab({
  traficoId,
  notes,
  currentUserId,
  availableUsers,
}: ComunicacionTabProps) {
  return (
    <CommentThread
      traficoId={traficoId}
      notes={notes}
      currentUserId={currentUserId}
      availableUsers={availableUsers}
    />
  )
}
