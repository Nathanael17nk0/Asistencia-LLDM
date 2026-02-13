// Supabase Service Layer
// Handles data sync between Local State and Cloud DB

const DB = {
    async registerUser(user) {
        if (!window.sbClient) return;
        const { error } = await window.sbClient
            .from('attendance_users')
            .upsert({
                id: user.id || 'user-' + Date.now(),
                phone: user.phone,
                full_name: user.full_name,
                password: user.password, // Ideally hashed, but storing plain per legacy app
                role: user.role,
                created_at: new Date().toISOString()
            }, { onConflict: 'phone' });

        if (error) throw error;
    },

    async logAttendance(entry) {
        if (!window.sbClient) return;
        const { error } = await window.sbClient
            .from('attendance_log')
            .insert({
                user_phone: entry.userId, // Mapping phone as ID
                user_name: entry.name, // Snapshot
                method: entry.method,
                service_slot: entry.serviceSlot,
                service_name: entry.serviceName,
                timestamp: entry.timestamp
            });

        if (error) throw error;
    },

    async fetchAllUsers() {
        if (!window.sbClient) return [];
        const { data, error } = await window.sbClient
            .from('attendance_users')
            .select('*');
        if (error) { console.error(error); return []; }
        return data;
    },

    async fetchTodayAttendance() {
        if (!window.sbClient) return [];
        const today = new Date().toISOString().split('T')[0];
        const { data, error } = await window.sbClient
            .from('attendance_log')
            .select('*')
            .gte('timestamp', today + 'T00:00:00')
            .lte('timestamp', today + 'T23:59:59');

        if (error) { console.error(error); return []; }

        // Map back to App format
        return data.map(d => ({
            userId: d.user_phone,
            name: d.user_name,
            timestamp: d.timestamp,
            method: d.method,
            serviceSlot: d.service_slot,
            serviceName: d.service_name
        }));
    },

    async removeAttendance(userId, slotId, dateStr) {
        if (!window.sbClient) return;
        // Delete rows matching criteria
        const { error } = await window.sbClient
            .from('attendance_log')
            .delete()
            .eq('user_phone', userId)
            .eq('service_slot', slotId)
            .ilike('timestamp', dateStr + '%'); // Rough date match

        if (error) throw error;
    },

    // Realtime Listener
    subscribeToChanges(onUpdate, onScheduleUpdate) {
        if (!window.sbClient) return;

        window.sbClient
            .channel('public:attendance')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'attendance_log' }, payload => {
                console.log('Log Change:', payload);
                if (onUpdate) onUpdate(payload.new, true);
            })
            // Listen for Any Config Changes
            .on('postgres_changes', { event: '*', schema: 'public', table: 'attendance_config' }, payload => {
                console.log('Config Change:', payload);
                if (onScheduleUpdate) onScheduleUpdate(payload.new); // Pass full row
            })
            // Listen for New Users (for Admin Panel Auto-Refresh)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'attendance_users' }, payload => {
                console.log('User Change:', payload);
                if (window.onUserUpdate) window.onUserUpdate(payload.new);
            })
            .subscribe();

        console.log("Subscribed to Realtime Changes (Log, Config & Users)");
    },

    // --- CONFIG / SCHEDULE SYNC ---
    async saveConfig(key, value) {
        if (!window.sbClient) return;

        // AUTO-FIX: NO UNIQUE CONSTRAINT ON 'key'
        // Since we saw duplicates, 'key' is likely not Unique in the DB.
        // 'upsert' fails or duplicates in this case.
        // We will force DELETE first, then INSERT.

        // 1. Delete Old
        const { error: delErr } = await window.sbClient
            .from('attendance_config')
            .delete()
            .eq('key', key);

        if (delErr) console.warn("Delete old config warning:", delErr);

        // 2. Insert New
        const { error } = await window.sbClient
            .from('attendance_config')
            .insert([{
                key: key,
                value: value,
                updated_at: new Date().toISOString()
            }]);

        if (error) {
            console.error(`Save ${key} Error`, error);
            if (key === 'weekly_schedule') alert(`❌ Error al SUBIR Horario:\n${error.message}`);
            throw error;
        } else {
            console.log(`Save ${key} OK`);
            if (key === 'weekly_schedule') alert("✅ Horario SUBIDO a la Nube correctamente. (Modo Forzado)");
        }
    },

    async fetchConfig(key) {
        if (!window.sbClient) {
            alert("❌ sbClient no inicializado");
            return null;
        }

        // Switching to .limit(1) to handle DUPLICATE KEYS gracefully.
        // PGRST116 error confirms multiple rows exist.
        const { data, error } = await window.sbClient
            .from('attendance_config')
            .select('value')
            .eq('key', key)
            .limit(1);

        if (error) {
            console.error(`Fetch ${key} Error`, error);
            if (key === 'weekly_schedule') {
                alert(`❌ Error Descarga (${key}):\n${error.message}\nCode: ${error.code}`);
            }
            return null;
        }

        // Data is an array [ { value: ... } ]
        const resultValue = (data && data.length > 0) ? data[0].value : null;

        if (!resultValue) {
            if (key === 'weekly_schedule') alert(`⚠️ Alerta: Supabase devolvió DATA VACÍA para ${key}`);
            return null;
        }

        // Debugging success
        if (key === 'weekly_schedule') {
            const keys = resultValue ? Object.keys(resultValue).length : 0;
            console.log(`Fetch Schedule OK. Days: ${keys}`);
            if (keys === 0) {
                alert("⚠️ Descarga OK, pero el horario está VACÍO (0 días).");
            }
        }

        return resultValue;
    },

    // Legacy Wrappers
    async saveSchedule(scheduleData) { return this.saveConfig('weekly_schedule', scheduleData); },
    async fetchSchedule() { return this.fetchConfig('weekly_schedule'); }
};

window.DB = DB;
