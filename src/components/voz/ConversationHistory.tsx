'use client'

import type { ConversationEntry } from './types'
import { COLORS } from './types'

interface ConversationHistoryProps {
  history: ConversationEntry[]
}

export default function ConversationHistory({ history }: ConversationHistoryProps) {
  if (history.length === 0) return null

  return (
    <div style={{
      width: '100%',
      marginTop: 8,
      display: 'flex',
      flexDirection: 'column',
      gap: 12,
      maxHeight: 180,
      overflowY: 'auto',
    }}>
      {history.slice(-3).map((entry) => (
        <div key={entry.id} style={{
          padding: '10px 14px',
          backgroundColor: 'rgba(255,255,255,0.03)',
          borderRadius: 8,
          borderLeft: `2px solid ${COLORS.goldDark}`,
        }}>
          <p style={{ color: COLORS.grayLight, fontSize: 12, margin: '0 0 4px' }}>
            {entry.userText}
          </p>
          <p style={{ color: COLORS.gold, fontSize: 13, margin: 0, opacity: 0.8 }}>
            {entry.assistantText.length > 100
              ? entry.assistantText.slice(0, 100) + '...'
              : entry.assistantText}
          </p>
        </div>
      ))}
    </div>
  )
}
