import { revalidatePath } from 'next/cache'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const secret = request.nextUrl.searchParams.get('secret')
  const path = request.nextUrl.searchParams.get('path') || '/'

  if (secret !== process.env.REVALIDATE_SECRET) {
    return NextResponse.json({ error: 'Invalid secret' }, { status: 401 })
  }

  try {
    revalidatePath(path)
    return NextResponse.json({
      revalidated: true,
      path,
      timestamp: new Date().toISOString()
    })
  } catch (err) {
    return NextResponse.json({ error: 'Revalidation failed' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { secret, path = '/', paths } = body

    if (secret !== process.env.REVALIDATE_SECRET) {
      return NextResponse.json({ error: 'Invalid secret' }, { status: 401 })
    }

    // Support single path or array of paths
    const pathsToRevalidate = paths || [path]
    const results = []

    for (const p of pathsToRevalidate) {
      try {
        revalidatePath(p)
        results.push({ path: p, revalidated: true })
      } catch (err) {
        results.push({ path: p, revalidated: false })
      }
    }

    return NextResponse.json({
      results,
      timestamp: new Date().toISOString()
    })
  } catch (err) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
}
