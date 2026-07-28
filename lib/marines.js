// Shared constants for The Loop (Marines) verified-rider flow. Kept in lib so
// pages/routes don't import from each other's route handlers.

// Cookie set by /api/marines/verify once a rider clears with a valid 10-digit
// DoD ID; read by the ride page + checkout to confirm they're cleared to ride.
export const MARINES_VERIFIED_COOKIE = 'marines_verified'
