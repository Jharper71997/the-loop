// Physical seats on the shuttle at any one pickup. This is the hard ceiling a
// single bar stop can board.
export const SHUTTLE_SEATS = 13

// The seat cap to enforce for a ticket type.
//
// A null `capacity` column means UNCAPPED, and every per-bar ticket type was
// created with it null — which is how a stop with 12 of 13 seats sold could
// still sell 10 more. Per-bar ticket types (those with a stop_index) fall back
// to the shuttle's physical cap so config drift can never uncap a stop.
//
// Ticket types WITHOUT a stop_index stay uncapped on purpose: private-charter
// custom tickets (the organizer self-limits, and parties can exceed 13) and
// marines walk-on fares (driver-managed). Returns null for those, meaning
// "no capacity check".
export function capacityForTicketType(tt) {
  if (!tt) return null
  if (tt.capacity != null) return tt.capacity
  return tt.stop_index != null ? SHUTTLE_SEATS : null
}
