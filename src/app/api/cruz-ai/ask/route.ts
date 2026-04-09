import { NextResponse } from 'next/server'

/**
 * CRUZ AI ask stub — returns placeholder until LLM quota resets.
 * POST { question: string } → { answer: string }
 */
export async function POST(req: Request) {
  try {
    const body = await req.json()
    const question = body?.question

    if (!question || typeof question !== 'string') {
      return NextResponse.json(
        { error: 'Pregunta requerida' },
        { status: 400 },
      )
    }

    // Stub response — wire to real LLM when quota resets
    return NextResponse.json({
      answer: 'Disponible proximamente. CRUZ AI estara listo pronto.',
    })
  } catch {
    return NextResponse.json(
      { error: 'Error al procesar la pregunta' },
      { status: 500 },
    )
  }
}
