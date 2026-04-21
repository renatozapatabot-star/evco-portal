import { redirect } from 'next/navigation'

export default async function TraficosSubpathRedirect({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string[] }>
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}) {
  const { slug } = await params
  const sp = (await searchParams) ?? {}
  const qs = new URLSearchParams()
  for (const [k, v] of Object.entries(sp)) {
    if (typeof v === 'string') qs.set(k, v)
    else if (Array.isArray(v) && v[0]) qs.set(k, v[0])
  }
  const path = slug.map(encodeURIComponent).join('/')
  const query = qs.toString()
  redirect(`/embarques/${path}${query ? `?${query}` : ''}`)
}
