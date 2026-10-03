import { graph, jsonLdHtml } from '@/lib/jsonLd'

// Drop-in JSON-LD block for any Brew page. Pass schema.org nodes built with
// the helpers in lib/jsonLd.js; falsy entries are skipped.
export default function JsonLd({ nodes = [] }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={jsonLdHtml(graph(nodes))} />
}
