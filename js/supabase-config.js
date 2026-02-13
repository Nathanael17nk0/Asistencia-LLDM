const SUPABASE_URL = "https://pmdqpkucejctdodmkoym.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBtZHFwa3VjZWpjdGRvZG1rb3ltIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA0NjM2MzMsImV4cCI6MjA4NjAzOTYzM30.KYOCRTl3y0kIQsCc5QK7uPcsxYfhus_sSuUVzv1mvNU";

// Robust Initialization
function initSupabase() {
    if (window.sbClient) return; // Already init

    if (typeof window.supabase !== 'undefined' && window.supabase.createClient) {
        try {
            // Force Clean Slate for Mobile Fix
            // Remove ANY potential stale keys that start with 'sb-'
            Object.keys(localStorage).forEach(k => {
                if (k.startsWith('sb-') || k.includes('supabase')) localStorage.removeItem(k);
            });

            window.sbClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
                auth: { persistSession: false } // Force Anon / Fresh connection every time
            });
            console.log("✅ Supabase Client Initialized (Clean/Anon)");
            // alert("🧹 Limpieza de Conexión: OK"); // Debug confirm
        } catch (e) {
            console.error("❌ Failed to initialize Supabase:", e);
            alert("❌ Error Conexión: " + e.message);
        }
    } else {
        console.warn("⏳ Supabase SDK not loaded yet...");
    }
}

// Try immediately
initSupabase();

// Retry on load events
document.addEventListener('DOMContentLoaded', initSupabase);
window.addEventListener('load', initSupabase);

// Safe-check poller (for slow connections)
const sbPoller = setInterval(() => {
    if (window.sbClient) clearInterval(sbPoller);
    else initSupabase();
}, 500);
