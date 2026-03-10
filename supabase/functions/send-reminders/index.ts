// @ts-nocheck
// =====================================================
// Supabase Edge Function: send-reminders (v2)
// Sends real background push notifications at reminder times.
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
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
// @ts-ignore
import webpush from 'https://esm.sh/web-push@3.6.7';

// Time helpers — detect actual local CST/CDT offset dynamically
function getCST_Hour(): { h: number; m: number; day: number } {
    const now = new Date();
    // Use Intl to get current time in CST timezone (auto handles daylight saving)
    const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/Monterrey',
        hour: 'numeric',
        minute: 'numeric',
        weekday: 'short',
        hour12: false
    }).formatToParts(now);

    const h = parseInt(parts.find(p => p.type === 'hour')!.value);
    const m = parseInt(parts.find(p => p.type === 'minute')!.value);
    const weekdayStr = parts.find(p => p.type === 'weekday')!.value; // 'Sun', 'Mon', etc.
    const dayMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
    const day = dayMap[weekdayStr] ?? new Date().getUTCDay();

    return { h, m, day };
}

Deno.serve(async (_req: Request) => {
    const { h, m, day } = getCST_Hour();

    console.log(`[send-reminders] CST time: ${h}:${String(m).padStart(2, '0')} day=${day}`);

    // Reminder times (all in CST/CDT – Monterrey timezone)
    const reminderTimes: [number, number][] =
        day === 0
            ? [[9, 50], [17, 50]]                          // Sunday: before 10am & 6pm
            : [[4, 50], [8, 50], [17, 50], [18, 50], [20, 15]]; // Weekdays

    const isReminderTime = reminderTimes.some(([rh, rm]) => rh === h && rm === m);
    if (!isReminderTime) {
        return new Response(JSON.stringify({ skipped: true, h, m }), { status: 200 });
    }

    console.log(`[send-reminders] 🔔 Reminder time matched at ${h}:${String(m).padStart(2, '0')}!`);

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Configure web-push VAPID details
    const vapidPublic = Deno.env.get('VAPID_PUBLIC_KEY')!;
    const vapidPrivate = Deno.env.get('VAPID_PRIVATE_KEY')!;
    const vapidSubject = Deno.env.get('VAPID_SUBJECT') ?? 'mailto:lldm@app.com';

    webpush.setVapidDetails(vapidSubject, vapidPublic, vapidPrivate);

    // Get all push subscriptions
    const { data: subscriptions, error } = await supabase
        .from('push_subscriptions')
        .select('*');

    if (error) {
        console.error('[send-reminders] DB error:', error.message);
        return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }

    if (!subscriptions || subscriptions.length === 0) {
        console.warn('[send-reminders] No subscriptions found.');
        return new Response(JSON.stringify({ sent: 0, total: 0 }), { status: 200 });
    }

    const payload = JSON.stringify({
        title: '📿 Recordatorio de Asistencia',
        body: 'La Paz de Dios sea con usted. Si asistió hoy, recuerde registrar su asistencia en la App.'
    });

    let sent = 0;
    let failed = 0;

    for (const row of subscriptions) {
        try {
            await webpush.sendNotification(row.subscription, payload);
            sent++;
            console.log(`[send-reminders] ✅ Sent to: ${row.user_phone}`);
        } catch (e: unknown) {
            failed++;
            const msg = e instanceof Error ? e.message : String(e);
            console.warn(`[send-reminders] ❌ Failed for ${row.user_phone}:`, msg);

            // If subscription is expired/invalid (410 Gone), remove it
            if (msg.includes('410') || msg.includes('expired')) {
                await supabase.from('push_subscriptions').delete().eq('user_phone', row.user_phone);
                console.log(`[send-reminders] 🗑️ Removed expired subscription for: ${row.user_phone}`);
            }
        }
    }

    return new Response(JSON.stringify({ sent, failed, total: subscriptions.length }), { status: 200 });
});
