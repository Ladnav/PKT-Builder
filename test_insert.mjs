
import { createClient } from '@supabase/supabase-js';

const supabase = createClient('https://apnvtfsmzjlwbdvrxclt.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFwbnZ0ZnNtempsd2JkdnJ4Y2x0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE3OTA1NzUsImV4cCI6MjA5NzM2NjU3NX0.9j8w_dkZkc6G1C6gXXtMfMPaQNrCcgJH0Iva1yBX7CI');

async function test() {
    const roomSettings = { size: 8, turnTimer: 45, shinies: true, weather: false, synergy: false, items: false };
    const code = 'TEST23';
    // Let's first auth as dummy user, or just see if the schema rejects it even before auth?
    // Actually, RLS will reject it, but the error should be 'new row violates row-level security policy' or something.
    console.log('Inserting into rooms...');
    const { data: room, error: roomError } = await supabase
      .from('rooms')
      .insert({
        code,
        host_id: '8ca53bd1-912b-45c1-92be-3c9edc5ef3ed',
        mode: 'type',
        status: 'waiting',
        max_players: 8,
        settings: roomSettings
      })
      .select()
      .single();
      
    if (roomError) {
        console.error('Room Error:', roomError);
    } else {
        console.log('Room inserted successfully:', room);
    }
}
test();
