// Awaited so callers read it as data (like a fetch) rather than an impure
// `Date.now()` call during render — which `react-hooks/purity` flags. Use in
// server components that feed a `renderedAt` timestamp to <LiveStamp>:
//
//   const renderedAt = await serverNow()
//   ...
//   <LiveStamp renderedAt={renderedAt} />
export async function serverNow() {
  return Date.now()
}
