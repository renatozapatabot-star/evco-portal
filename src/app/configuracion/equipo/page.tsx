'use client'

import { useState } from 'react'
import { Users2, Plus, Mail } from 'lucide-react'

interface TeamMember {
  id: string
  name: string
  email: string
  role: 'admin' | 'editor' | 'viewer'
  status: 'active' | 'invited'
  lastLogin: string | null
}

const MOCK_TEAM: TeamMember[] = [
  { id: '1', name: 'Ursula Banda', email: 'ursula@evcoplastics.com', role: 'admin', status: 'active', lastLogin: '2026-04-10' },
  { id: '2', name: 'Carlos Martínez', email: 'carlos@evcoplastics.com', role: 'viewer', status: 'active', lastLogin: '2026-04-09' },
]

const ROLE_LABELS = { admin: 'Administrador', editor: 'Editor', viewer: 'Solo lectura' }

export default function EquipoPage() {
  const [team] = useState<TeamMember[]>(MOCK_TEAM)
  const [showInvite, setShowInvite] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<'editor' | 'viewer'>('viewer')

  return (
    <div style={{ maxWidth: 700, margin: '0 auto', padding: '24px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 'var(--aguila-fs-headline)', fontWeight: 700, color: '#E6EDF3', marginBottom: 4 }}>Equipo</h1>
          <p style={{ fontSize: 'var(--aguila-fs-body)', color: '#64748b' }}>Gestiona quién tiene acceso al portal de tu empresa.</p>
        </div>
        <button
          onClick={() => setShowInvite(!showInvite)}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '10px 20px', borderRadius: 12,
            background: '#E8EAED', color: '#05070B', fontWeight: 700, fontSize: 'var(--aguila-fs-body)',
            border: 'none', cursor: 'pointer', minHeight: 44,
          }}
        >
          <Plus size={16} /> Invitar
        </button>
      </div>

      {showInvite && (
        <div className="cc-card" style={{ padding: 20, borderRadius: 16, marginBottom: 16 }}>
          <div style={{ fontSize: 'var(--aguila-fs-section)', fontWeight: 600, color: '#E6EDF3', marginBottom: 12 }}>Invitar nuevo usuario</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <input
              type="email"
              value={inviteEmail}
              onChange={e => setInviteEmail(e.target.value)}
              placeholder="correo@empresa.com"
              style={{
                flex: 1, minWidth: 200, padding: '10px 14px', borderRadius: 8,
                background: 'rgba(255,255,255,0.045)', border: '1px solid rgba(192,197,206,0.3)',
                color: '#E6EDF3', fontSize: 'var(--aguila-fs-section)', outline: 'none',
              }}
            />
            <select
              value={inviteRole}
              onChange={e => setInviteRole(e.target.value as 'editor' | 'viewer')}
              style={{
                padding: '10px 14px', borderRadius: 8,
                background: 'rgba(255,255,255,0.045)', border: '1px solid rgba(192,197,206,0.3)',
                color: '#E6EDF3', fontSize: 'var(--aguila-fs-section)',
              }}
            >
              <option value="viewer">Solo lectura</option>
              <option value="editor">Editor</option>
            </select>
            <button style={{
              padding: '10px 20px', borderRadius: 8,
              background: '#E8EAED', color: '#05070B', fontWeight: 700, fontSize: 'var(--aguila-fs-body)',
              border: 'none', cursor: 'pointer', minHeight: 44,
            }}>
              <Mail size={14} style={{ marginRight: 4 }} /> Enviar invitación
            </button>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {team.map(member => (
          <div key={member.id} className="cc-card" style={{
            padding: '14px 20px', borderRadius: 14,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{
                width: 36, height: 36, borderRadius: '50%',
                background: 'rgba(192,197,206,0.15)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontWeight: 700, color: '#C0C5CE', fontSize: 'var(--aguila-fs-section)',
              }}>
                {member.name.charAt(0)}
              </div>
              <div>
                <div style={{ fontSize: 'var(--aguila-fs-section)', fontWeight: 600, color: '#E6EDF3' }}>{member.name}</div>
                <div style={{ fontSize: 'var(--aguila-fs-compact)', color: '#64748b' }}>{member.email}</div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{
                fontSize: 'var(--aguila-fs-meta)', fontWeight: 600, padding: '4px 10px', borderRadius: 6,
                background: member.role === 'admin' ? 'rgba(192,197,206,0.1)' : 'rgba(255,255,255,0.04)',
                color: member.role === 'admin' ? '#C0C5CE' : '#94a3b8',
              }}>
                {ROLE_LABELS[member.role]}
              </span>
              <span style={{ fontSize: 'var(--aguila-fs-meta)', color: '#475569' }}>
                {member.status === 'invited' ? 'Pendiente' : member.lastLogin ? `Último: ${member.lastLogin}` : ''}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
