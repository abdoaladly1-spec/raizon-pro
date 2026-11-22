import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://cifijxcmmnosocnfizra.supabase.co';
const SUPABASE_KEY = 'sb_publishable__oo-1NLPKUNyzQvv9-w2DQ_HeHWnqRl';

const client = createClient(SUPABASE_URL, SUPABASE_KEY);

async function check() {
  const [b, s, r, c, sys] = await Promise.all([
    client.from('branches').select('*'),
    client.from('staff').select('*'),
    client.from('reservations').select('*'),
    client.from('customers').select('id, name, phone').limit(5),
    client.from('booking_settings').select('*')
  ]);
  console.log('Branches:', b.data?.length ?? 'err', b.error?.message, b.data);
  console.log('Staff:', s.data?.length ?? 'err', s.error?.message, s.data);
  console.log('Reservations:', r.data?.length ?? 'err', r.error?.message, r.data?.slice(0, 3));
  console.log('Customers count:', c.data?.length, c.error?.message);
  console.log('Booking settings:', sys.data?.length ?? 'err', sys.error?.message);
}

check().catch(console.error);
