/**
 * Lazy PDF renderer loader.
 *
 * `@react-pdf/renderer` is ~2.5MB. Top-level imports add that cost to every
 * cold start of the serverless function even when the route doesn't need
 * PDF output. This helper wraps a dynamic import + memo so the first PDF
 * request pays the cost and subsequent requests don't.
 *
 * Usage inside a PDF route handler:
 *   const { renderToBuffer } = await loadPdfRenderer()
 *   const buffer = await renderToBuffer(MyPDF(...))
 */

type RenderToBuffer = (element: React.ReactElement) => Promise<Buffer>

let cached: Promise<{ renderToBuffer: RenderToBuffer }> | null = null

export function loadPdfRenderer(): Promise<{ renderToBuffer: RenderToBuffer }> {
  if (!cached) {
    cached = import('@react-pdf/renderer').then((mod) => ({
      renderToBuffer: mod.renderToBuffer as unknown as RenderToBuffer,
    }))
  }
  return cached
}
