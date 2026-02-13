const SUPABASE_URL = "https://pmdqpkucejctdodmkoym.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBtZHFwa3VjZWpjdGRvZG1rb3ltIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA0NjM2MzMsImV4cCI6MjA4NjAzOTYzM30.KYOCRTl3y0kIQsCc5QK7uPcsxYfhus_sSuUVzv1mvNU";

// Init Client (Requires CDN Script in index.html)
// Note: The CDN exposes 'supabase' global object (or 'Supabase' depending on version, usually 'supabase' for v2).

// Initialize immediately if available, or wait for DOM (CDN might load async)
function initSupabase() {
    if (window.supabase && window.supabase.createClient && !window.sbClient) {
        window.sbClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        console.log("Supabase Client Initialized");
    }
}

initSupabase();
document.addEventListener('DOMContentLoaded', initSupabase);
window.addEventListener('load', initSupabase);
