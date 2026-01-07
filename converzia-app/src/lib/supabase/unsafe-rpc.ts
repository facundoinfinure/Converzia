import type { PostgrestError } from "@supabase/supabase-js";

/**
 * Calls Supabase RPC bypassing generated function typings.
 *
 * Why: our `Database` types may not include all SQL functions, and `supabase.rpc`
 * then expects args to be `undefined`, which breaks typecheck in many routes/services.
 *
 * This helper keeps the return shape strongly typed and works with `rpcWithTimeout`.
 */
export function unsafeRpc<T>(
  // `rpc` is often overly strict (args typed as `undefined`) when Functions aren't generated.
  // Accept the real runtime signature and re-type the result.
  client: { rpc: (...args: any[]) => unknown },
  fn: string,
  params?: Record<string, unknown>
): PromiseLike<{ data: T | null; error: PostgrestError | null }> {
  return client.rpc(fn, params) as unknown as PromiseLike<{
    data: T | null;
    error: PostgrestError | null;
  }>;
}

