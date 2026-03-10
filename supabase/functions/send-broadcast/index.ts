// @ts-nocheck
// =====================================================
// Sends dynamic background push notifications from the Admin Panel.
//
// Dependencies are loaded via esm.sh (no install needed):
//   - @supabase/supabase-js@2
//   - web-push (via esm.sh)
//
// Required Secrets (set in Supabase Dashboard → Edge Functions → Secrets):
//   VAPID_PUBLIC_KEY   = BGQU4DHdRr97qTqTT0hclHRBFNEdCTiVRTYJ3v6gpVdPLIfLdU2ibbPF1XJQ__XDLtPgTmfFj4r2_hmE6M1Qq8c
//   VAPID_PRIVATE_KEY  = pAPt-LMlSbWY3vl0iAzGcqF76tBfCwhOt-UlpP3kPwk
//   VAPID_SUBJECT      = mailto:lldm@app.com
// =====================================================

// @ts-ignore
import { createClient } from 'npm:@supabase/supabase-js@2';
// @ts-ignore
import webpush from 'npm:web-push@3.6.7';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req: Request) => {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        if (req.method !== 'POST') throw new Error('Method not allowed');
        
        const { message } = await req.json();
        if (!message) throw new Error('Message is required');

        console.log(`[send-broadcast] 🔔 Broadcasting message: "${message}"`);

        // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Configure web-push VAPID details
    const vapidPublic = Deno.env.get('VAPID_PUBLIC_KEY')!;
    const vapidPrivate = Deno.env.get('VAPID_PRIVATE_KEY')!;
    let vapidSubject = Deno.env.get('VAPID_SUBJECT') ?? 'mailto:lldm@app.com';
    if (!vapidSubject.startsWith('mailto:') && !vapidSubject.startsWith('https:')) {
        vapidSubject = `mailto:${vapidSubject}`;
    }

    webpush.setVapidDetails(vapidSubject, vapidPublic, vapidPrivate);

    // Get all push subscriptions
    const { data: subscriptions, error } = await supabase
        .from('push_subscriptions')
        .select('*');

    if (error) {
        console.error('[send-broadcast] DB error:', error.message);
        return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
    }

    if (!subscriptions || subscriptions.length === 0) {
        console.warn('[send-broadcast] No subscriptions found.');
        return new Response(JSON.stringify({ sent: 0, total: 0 }), { status: 200, headers: corsHeaders });
    }

    const payload = JSON.stringify({
        title: '🔔 Aviso de la Iglesia',
        body: message
    });

    let sent = 0;
    let failed = 0;

    for (const row of subscriptions) {
        try {
            await webpush.sendNotification(row.subscription, payload);
            sent++;
            console.log(`[send-broadcast] ✅ Sent to: ${row.user_phone}`);
        } catch (e: unknown) {
            failed++;
            const msg = e instanceof Error ? e.message : String(e);
            console.warn(`[send-broadcast] ❌ Failed for ${row.user_phone}:`, msg);

            // If subscription is expired/invalid (410 Gone), remove it
            if (msg.includes('410') || msg.includes('expired')) {
                await supabase.from('push_subscriptions').delete().eq('user_phone', row.user_phone);
                console.log(`[send-broadcast] 🗑️ Removed expired subscription for: ${row.user_phone}`);
            }
        }
    }

    return new Response(JSON.stringify({ sent, failed, total: subscriptions.length }), { status: 200, headers: corsHeaders });
    } catch (err: any) {
        console.error('[send-broadcast] Function error:', err);
        return new Response(JSON.stringify({ error: err.message }), { status: 400, headers: corsHeaders });
    }
});
