export function personalize(template, rider) {
  if (!template) return ''
  return template
    .replace(/\{first_name\}/gi, rider?.first_name || '')
    .replace(/\{last_name\}/gi, rider?.last_name || '')
    .replace(/\{name\}/gi, [rider?.first_name, rider?.last_name].filter(Boolean).join(' '))
}
