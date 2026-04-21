'use client'

import { AnimatePresence } from 'framer-motion'
import { SwipeableActionCard, type ActionItem } from './SwipeableActionCard'

interface ActionStackProps {
  items: ActionItem[]
  onResolve: (id: string) => void
}

/**
 * Animated stack of broker action items.
 * Uses AnimatePresence for smooth entry/exit when items resolve or arrive.
 * Items must be pre-sorted by urgency before passing in.
 */
export function ActionStack({ items, onResolve }: ActionStackProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <AnimatePresence mode="popLayout">
        {items.map(item => (
          <SwipeableActionCard
            key={item.id}
            item={item}
            onResolve={onResolve}
          />
        ))}
      </AnimatePresence>
    </div>
  )
}
