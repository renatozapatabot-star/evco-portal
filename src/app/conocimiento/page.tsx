import { createClient } from '@supabase/supabase-js'
import { GOLD, RED, GREEN, AMBER } from '@/lib/design-system'

export const dynamic = 'force-dynamic'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export default async function ConocimientoPage() {
  const { data: knowledge } = await supabase
    .from('institutional_knowledge')
    .select('*')
    .order('confidence', { ascending: false })
    .limit(50)

  const typeIcons: Record<string, string> = {
    classification: '🏷️',
    compliance: '🛡️',
    carrier: '🚛',
    supplier: '📦',
    regulatory: '🏛️',
    operational: '⚙️',
  }

  const typeColors: Record<string, string> = {
    classification: GOLD,
    compliance: RED,
    carrier: GREEN,
    supplier: AMBER,
    regulatory: '#3B82F6',
    operational: '#9C9690',
  }

  return (
    <div style={{ padding: '24px 28px', fontFamily: "'DM Sans', sans-serif", color: '#E8E6E0' }}>
      <h1 style={{ fontSize: 22, fontWeight: 800, margin: '0 0 4px' }}>Base de Conocimiento</h1>
      <p style={{ color: '#666', fontSize: 13, margin: '0 0 24px' }}>
        Memoria institucional de CRUZ &middot; {(knowledge || []).length} precedentes
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {(knowledge || []).map((k: any) => (
          <div key={k.id} style={{
            background: '#161616', border: '1px solid #2A2A2A', borderRadius: 12,
            padding: '16px 20px', borderLeft: `4px solid ${typeColors[k.knowledge_type] || '#666'}`
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span>{typeIcons[k.knowledge_type] || '📄'}</span>
                <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: typeColors[k.knowledge_type] || '#666' }}>
                  {k.knowledge_type}
                </span>
              </div>
              <span style={{ fontSize: 11, color: '#666', fontFamily: 'monospace' }}>{k.confidence}% confianza</span>
            </div>
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 6 }}>{k.title}</div>
            <div style={{ fontSize: 13, color: '#9C9690', lineHeight: 1.5 }}>{k.content}</div>
            {k.tags && (
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
                {k.tags.map((tag: string) => (
                  <span key={tag} style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, background: '#1A1A1A', border: '1px solid #2A2A2A', color: '#9C9690' }}>{tag}</span>
                ))}
              </div>
            )}
          </div>
        ))}
        {(!knowledge || knowledge.length === 0) && (
          <div style={{ textAlign: 'center', padding: 40, color: '#666' }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>📚</div>
            <div>Base de conocimiento vacía. Ejecuta el seed SQL para poblar.</div>
          </div>
        )}
      </div>
    </div>
  )
}
