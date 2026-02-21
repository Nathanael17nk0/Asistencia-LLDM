// Supabase Service Layer
// Handles data sync between Local State and Cloud DB

const DB = {
    async registerUser(user) {
        if (!window.sbClient) return;
        const { error } = await window.sbClient
            .from('attendance_users')
            .upsert({
                id: user.id || 'user-' + Date.now(),
                phone: user.phone || null, // Allow nulls if DB allows unique violation on nulls (Supabase does)
                full_name: user.full_name,
                password: user.password,
                role: user.role,
                dob: user.dob || null,
                age: user.age_label || null,
                colony: user.colonia || null,
                direccion: user.direccion || null,
                profesion: user.profesion || null,
                grado_estudios: user.grado_estudios || null,
                photo_url: user.photo_url || null,
                created_at: new Date().toISOString()
            }, { onConflict: 'phone' }); // FIX: Key on Phone to prevent duplicate constraint violation

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
        try {
            // TIMEOUT WRAPPER (5s max)
            const fetchPromise = window.sbClient
                .from('attendance_users')
                .select('*');

            const timeoutPromise = new Promise((_, reject) =>
                setTimeout(() => reject(new Error('Timeout DB')), 8000)
            );

            const { data, error } = await Promise.race([fetchPromise, timeoutPromise]);

            if (error) { console.error(error); return []; }
            return data;
        } catch (e) {
            console.error("Fetch Users Error/Timeout:", e);
            // Fallback: Return empty or whatever is in cache? 
            // Better to return empty so UI knows sync failed.
            return [];
        }
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
            serviceName: d.service_name,
            id: d.id // CRITICAL: Required for robust delete
        }));
    },

    // --- REALTIME SUBSCRIPTION (Consolidated) ---
    // (See below for actual implementation)

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

    // Realtime Listener (Consolidated)
    subscribeToChanges(onUpdate, onConfigUpdate) {
        if (!window.sbClient) return;

        // SINGLETON CHECK (Removed for now to force reconnect attempts)
        if (this.currentSubscription) {
            window.sbClient.removeChannel(this.currentSubscription);
        }

        this.currentSubscription = window.sbClient
            .channel('public:attendance_main')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'attendance_log' }, payload => {
                console.log('Log Change (Raw):', payload);

                // TRANSFORM PAYLOAD (Snake -> Camel)
                if (payload.new && payload.eventType !== 'DELETE') {
                    payload.new = {
                        userId: payload.new.user_phone,
                        name: payload.new.user_name,
                        serviceSlot: payload.new.service_slot,
                        serviceName: payload.new.service_name,
                        timestamp: payload.new.timestamp,
                        method: payload.new.method,
                        id: payload.new.id
                    };
                }
                if (onUpdate) onUpdate(payload.new); // Sending payload.new directly to match app.js expectation
            })
            // Listen for Config Changes (Theme, Location)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'attendance_config' }, payload => {
                console.log('Config Change:', payload);
                if (onConfigUpdate) onConfigUpdate(payload.new);
            })
            // Listen for New Users
            .on('postgres_changes', { event: '*', schema: 'public', table: 'attendance_users' }, payload => {
                console.log('User Change:', payload);
                if (window.onUserUpdate) window.onUserUpdate(payload.new);
            })
            .subscribe((status) => {
                console.log("Realtime Status:", status);
            });

        console.log("Subscribed to Realtime Changes (Main Channel)");
    },

    // NEW: Remove Attendance with ID support
    async removeAttendance(userId, serviceSlot, dateStr, logId = null) {
        if (!window.sbClient) return;

        let query = window.sbClient.from('attendance_log').delete();

        if (logId) {
            // BEST WAY: Delete by ID
            console.log("Deleting by ID:", logId);
            query = query.eq('id', logId);
        } else {
            // FALLBACK: Match columns
            console.log("Deleting by Match:", userId, serviceSlot);
            query = query
                .eq('user_phone', String(userId))
                .eq('service_slot', serviceSlot)
                .gte('timestamp', `${dateStr}T00:00:00`)
                .lte('timestamp', `${dateStr}T23:59:59`);
        }

        const { error } = await query;

        if (error) {
            console.error("Remove Error", error);
            alert("Error borrando de nube: " + error.message);
            throw error;
        } else {
            console.log("✅ Attendance Removed from Cloud");
        }
    },

    // --- DELETE USER ---
    async deleteUser(userId, userPhone) {
        if (!window.sbClient) return;

        console.log(`🗑️ Deleting User: ID=${userId}, Phone=${userPhone}`);

        // 1. Delete Attendance Logs first (by phone or user_id)
        if (userPhone) {
            await window.sbClient.from('attendance_log').delete().eq('user_phone', userPhone);
        }
        await window.sbClient.from('attendance_log').delete().eq('userId', userId); // Cleanup legacy

        // 2. Delete User (Try BOTH ID and Phone to catch Zombies)
        const queries = [];
        if (userId) queries.push(`id.eq.${userId}`);
        if (userPhone && String(userPhone).length > 4) queries.push(`phone.eq.${userPhone}`);

        if (queries.length === 0) return;

        // Execute deletes
        const { error } = await window.sbClient
            .from('attendance_users')
            .delete()
            .or(queries.join(','));

        if (error) {
            console.error("Delete failed:", error);
            throw error;
        }
        console.log(`🗑️ Deleted from Cloud.`);
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
            console.warn("⚠️ sbClient not ready for fetchConfig(" + key + ")");
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

        return resultValue; // RETURN JSON DATA, NOT ARRAY
    },

    // Legacy Wrappers
    async saveSchedule(scheduleData) { return this.saveConfig('weekly_schedule', scheduleData); },
    async fetchSchedule() { return this.fetchConfig('weekly_schedule'); }
};

window.DB = DB;
