import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const ROUTINES_DIR = join(process.cwd(), 'src/app/api/routines')

function listRoutineFiles(): Array<{ name: string; path: string; source: string }> {
  return readdirSync(ROUTINES_DIR)
    .filter(name => statSync(join(ROUTINES_DIR, name)).isDirectory() && !name.startsWith('__'))
    .map(name => {
      const path = join(ROUTINES_DIR, name, 'route.ts')
      return { name, path, source: readFileSync(path, 'utf8') }
    })
}

describe('routines — structural smoke tests (no routine ships without the auth gate)', () => {
  const routines = listRoutineFiles()

  it('discovers the expected 5 routines', () => {
    const names = routines.map(r => r.name).sort()
    expect(names).toEqual([
      'anomaly-detector',
      'morning-briefing',
      'nightly-sync-audit',
      'semaforo-rojo',
      'weekly-client-reports',
    ])
  })

  for (const { name, source } of routines) {
    it(`${name}: imports verifyRoutineRequest from @/lib/routines/auth`, () => {
      expect(source).toMatch(/import[^;]*verifyRoutineRequest[^;]*from\s+['"]@\/lib\/routines\/auth['"]/)
    })

    it(`${name}: exports a POST handler`, () => {
      expect(source).toMatch(/export\s+async\s+function\s+POST\s*\(/)
    })

    it(`${name}: calls verifyRoutineRequest with its own name before anything else`, () => {
      const callMatch = source.match(/verifyRoutineRequest\s*\(\s*request\s*,\s*['"]([^'"]+)['"]\s*\)/)
      expect(callMatch, `${name} must call verifyRoutineRequest(request, '${name}')`).not.toBeNull()
      expect(callMatch![1]).toBe(name)
    })

    it(`${name}: returns auth.response early on auth failure`, () => {
      expect(source).toMatch(/if\s*\(\s*!auth\.ok\s*\)\s*return\s+auth\.response/)
    })

    it(`${name}: uses service-role supabase client (never anon key for cross-tenant reads)`, () => {
      expect(source).toMatch(/SUPABASE_SERVICE_ROLE_KEY/)
      expect(source).not.toMatch(/NEXT_PUBLIC_SUPABASE_ANON_KEY/)
    })

    it(`${name}: declares force-dynamic (no ISR caching on routine endpoints)`, () => {
      expect(source).toMatch(/export\s+const\s+dynamic\s*=\s*['"]force-dynamic['"]/)
    })
  }
})
