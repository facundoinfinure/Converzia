// Supabase Database Types Extension
// This file provides type hints for tables not in the auto-generated types

import { SupabaseClient as BaseSupabaseClient } from "@supabase/supabase-js";

// Extend the Supabase client to allow any table operations
declare module "@supabase/supabase-js" {
  interface SupabaseClient {
    from(table: string): any;
  }
}

// Database helper types
export interface Database {
  public: {
    Tables: {
      [key: string]: {
        Row: any;
        Insert: any;
        Update: any;
      };
    };
  };
}


