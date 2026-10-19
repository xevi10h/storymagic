// "This table / column is not in this database yet": the code shipped before its
// migration (supabase/migrations/20261019150000_reviews.sql). Callers degrade instead of
// failing: no reviews shown, no requests sent, the form answers "unavailable".

export function isMissingSchemaError(error: { code?: string | null } | null | undefined): boolean {
  // 42P01 undefined_table / 42703 undefined_column (Postgres), PGRST205 table not in the
  // schema cache, PGRST204 column not in the schema cache (PostgREST).
  return !!error?.code && ["42P01", "42703", "PGRST205", "PGRST204"].includes(error.code);
}
