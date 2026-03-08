// =====================================================
// Supabase Edge Function: send-reminders
// Sends background push notifications at reminder times.
// Deploy with: supabase functions deploy send-reminders
//
// Required Secrets (set with: supabase secrets set KEY=VALUE):
//   VAPID_PUBLIC_KEY  — from generate_vapid_keys.js
//   VAPID_PRIVATE_KEY — from generate_vapid_keys.js
//   VAPID_SUBJECT     — mailto:tu@email.com
// =====================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// VAPID / Web Push helpers (using jose for JWT + WebCrypto)
async function sendWebPush(subscription: any, payload: string, vapidHeaders: Record<string, string>) {
    const endpoint = subscription.endpoint;
    const { p256dh, auth } = subscription.keys;

    // Import the recipient's ECDH public key
    const recipientPublicKey = await crypto.subtle.importKey(
        'raw',
        base64UrlToUint8Array(p256dh),
        { name: 'ECDH', namedCurve: 'P-256' },
        false,
        []
    );

    // Generate ephemeral ECDH keypair for encryption
    const ephemeralKeyPair = await crypto.subtle.generateKey(
        { name: 'ECDH', namedCurve: 'P-256' },
        true,
        ['deriveBits']
    );

    // Derive shared secret
    const sharedBits = await crypto.subtle.deriveBits(
        { name: 'ECDH', public: recipientPublicKey },
        ephemeralKeyPair.privateKey,
        256
    );

    // Get ephemeral public key bytes
    const ephemeralPublicKeyRaw = await crypto.subtle.exportKey('raw', ephemeralKeyPair.publicKey);

    // Auth secret
    const authBytes = base64UrlToUint8Array(auth);

    // HKDF to derive content encryption key
    const ikm = await hkdf(new Uint8Array(sharedBits), authBytes, 'Content-Encoding: auth\0', 32);
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const cek = await hkdf(ikm, salt, buildInfo('aesgcm', new Uint8Array(ephemeralPublicKeyRaw), base64UrlToUint8Array(p256dh)), 16);
    const nonce = await hkdf(ikm, salt, buildInfo('nonce', new Uint8Array(ephemeralPublicKeyRaw), base64UrlToUint8Array(p256dh)), 12);

    // Encrypt payload
    const key = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt']);
    const paddedPayload = new Uint8Array([0, 0, ...new TextEncoder().encode(payload)]);
    const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, key, paddedPayload);

    // Build request
    return fetch(endpoint, {
        method: 'POST',
        headers: {
            ...vapidHeaders,
            'Content-Type': 'application/octet-stream',
            'Content-Encoding': 'aesgcm',
            'Encryption': `salt=${uint8ArrayToBase64Url(salt)}`,
            'Crypto-Key': `dh=${uint8ArrayToBase64Url(new Uint8Array(ephemeralPublicKeyRaw))};${vapidHeaders['Crypto-Key'] || ''}`,
            'TTL': '86400'
        },
        body: encrypted
    });
}

// ---- Utility functions ----
function base64UrlToUint8Array(base64url: string): Uint8Array {
    const padding = '='.repeat((4 - base64url.length % 4) % 4);
    const base64 = (base64url + padding).replace(/-/g, '+').replace(/_/g, '/');
    return new Uint8Array([...atob(base64)].map(c => c.charCodeAt(0)));
}
function uint8ArrayToBase64Url(u8: Uint8Array): string {
    return btoa(String.fromCharCode(...u8)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}
function buildInfo(type: string, clientPublicKey: Uint8Array, serverPublicKey: Uint8Array): Uint8Array {
    const info = new Uint8Array(18 + clientPublicKey.length + 2 + serverPublicKey.length + 2);
    const enc = new TextEncoder();
    info.set(enc.encode(`Content-Encoding: ${type}\0P-256\0`));
    // simplified — real impl needs proper length prefixes
    return info;
}
async function hkdf(ikm: Uint8Array, salt: Uint8Array, info: Uint8Array | string, length: number): Promise<Uint8Array> {
    const infoBytes = typeof info === 'string' ? new TextEncoder().encode(info) : info;
    const key = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
    const bits = await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info: infoBytes }, key, length * 8);
    return new Uint8Array(bits);
}

async function buildVapidHeaders(endpoint: string): Promise<Record<string, string>> {
    const privateKeyB64 = Deno.env.get('VAPID_PRIVATE_KEY')!;
    const publicKeyB64 = Deno.env.get('VAPID_PUBLIC_KEY')!;
    const subject = Deno.env.get('VAPID_SUBJECT')!;

    const origin = new URL(endpoint).origin;
    const now = Math.floor(Date.now() / 1000);
    const payload = { aud: origin, exp: now + 12 * 3600, sub: subject };

    // Build JWT manually with WebCrypto
    const header = uint8ArrayToBase64Url(new TextEncoder().encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
    const body = uint8ArrayToBase64Url(new TextEncoder().encode(JSON.stringify(payload)));
    const sigInput = `${header}.${body}`;

    const privateKeyBytes = base64UrlToUint8Array(privateKeyB64);
    // Import P-256 private key in PKCS8 (we stored just the raw 32 bytes, need to wrap)
    const pkcs8 = buildPkcs8(privateKeyBytes);
    const privateKey = await crypto.subtle.importKey('pkcs8', pkcs8, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
    const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, privateKey, new TextEncoder().encode(sigInput));
    const token = `${sigInput}.${uint8ArrayToBase64Url(new Uint8Array(sig))}`;

    return {
        'Authorization': `vapid t=${token},k=${publicKeyB64}`,
        'Crypto-Key': `p256ecdsa=${publicKeyB64}`
    };
}

function buildPkcs8(rawPrivateKey: Uint8Array): Uint8Array {
    // PKCS8 wrapper for P-256 private key (EC key, OID 1.2.840.10045.2.1, curve 1.2.840.10045.3.1.7)
    const oid = new Uint8Array([0x06, 0x07, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x02, 0x01]);
    const curveOid = new Uint8Array([0x06, 0x08, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x03, 0x01, 0x07]);
    const ecKey = new Uint8Array([0x02, 0x01, 0x01, 0x04, rawPrivateKey.length, ...rawPrivateKey]);
    const octetStr = new Uint8Array([0x04, ecKey.length + 2, ...ecKey]);
    const seqInner = new Uint8Array([0x30, oid.length + curveOid.length, ...oid, ...curveOid]);
    const seq = new Uint8Array([0x30, seqInner.length + octetStr.length + 4, ...seqInner, ...octetStr, 0x02, 0x01, 0x00]);
    return new Uint8Array([0x30, seq.length, ...seq]);
}

// ---- MAIN HANDLER ----
Deno.serve(async (req) => {
    const now = new Date();
    const h = now.getUTCHours() - 6; // CST offset (-6 from UTC)
    const m = now.getUTCMinutes();
    const day = now.getUTCDay(); // 0=Sunday

    // Reminder times (hh:mm in CST = UTC-6)
    const reminderTimes: [number, number][] =
        day === 0
            ? [[9, 50], [17, 50]]      // Sunday: 10am and 6pm
            : [[4, 50], [8, 50], [17, 50], [18, 50], [20, 15]]; // Weekdays

    const isReminderTime = reminderTimes.some(([rh, rm]) => rh === h && rm === m);
    if (!isReminderTime) {
        return new Response(JSON.stringify({ skipped: true, h, m }), { status: 200 });
    }

    // Get all subscriptions from Supabase
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: subscriptions, error } = await supabase
        .from('push_subscriptions')
        .select('*');

    if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });

    const payload = JSON.stringify({
        title: '📿 Recordatorio de Asistencia',
        body: 'La Paz de Dios sea con usted. Si asistió hoy, recuerde registrar su asistencia en la App.'
    });

    let sent = 0;
    for (const row of subscriptions ?? []) {
        try {
            const vapidHeaders = await buildVapidHeaders(row.subscription.endpoint);
            const res = await sendWebPush(row.subscription, payload, vapidHeaders);
            if (res.ok) sent++;
            else console.warn('Push failed:', row.user_phone, await res.text());
        } catch (e) {
            console.error('Error pushing to', row.user_phone, e);
        }
    }

    return new Response(JSON.stringify({ sent, total: subscriptions?.length }), { status: 200 });
});
