import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Enums } from './types.gen';

/** Cliente Supabase tipado com o schema do Chavi. */
export type ChaviClient = SupabaseClient<Database>;

export type MembershipRole = Enums<'membership_role'>;
export type JobOutboxStatus = Enums<'job_outbox_status'>;
