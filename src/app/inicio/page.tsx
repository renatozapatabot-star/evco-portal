// AGUILA · /inicio — canonical client cockpit route.
// V1-approved nav lists /inicio as the client landing. The dashboard
// lives at /, so this route forwards there and preserves the contract.
import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default function InicioPage() {
  redirect('/')
}
