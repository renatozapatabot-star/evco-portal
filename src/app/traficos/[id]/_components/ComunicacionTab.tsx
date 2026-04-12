import { MessageSquare } from 'lucide-react'
import { TEXT_MUTED, TEXT_SECONDARY } from '@/lib/design-system'

export function ComunicacionTab() {
  // Block 7 will mount CommentThread + MentionAutocomplete here.
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 10,
        padding: '32px 16px',
      }}
    >
      <MessageSquare size={24} color={TEXT_MUTED} />
      <div style={{ fontSize: 13, color: TEXT_SECONDARY, fontWeight: 600 }}>
        Hilo de comunicación
      </div>
      <div style={{ fontSize: 11, color: TEXT_MUTED, textAlign: 'center', maxWidth: 340 }}>
        El hilo de comentarios con @menciones y autocompletado estará disponible
        próximamente (Bloque 7 del V1 Polish Pack).
      </div>
    </div>
  )
}
