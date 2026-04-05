/**
 * DataStory — renders a plain-language narrative below KPIs/charts.
 * The story IS the insight. The chart is supporting evidence.
 */

interface DataStoryProps {
  text: string
}

export function DataStory({ text }: DataStoryProps) {
  if (!text) return null

  return (
    <p style={{
      fontSize: 13,
      color: '#6B6B6B',
      lineHeight: 1.6,
      fontStyle: 'italic',
      maxWidth: 600,
      margin: '0 0 20px',
    }}>
      {text}
    </p>
  )
}
