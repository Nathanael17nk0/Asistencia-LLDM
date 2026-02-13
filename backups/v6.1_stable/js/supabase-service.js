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
    subscribeToChanges(onUpdate) {
        if (!window.sbClient) return;

        window.sbClient
            .channel('public:attendance_log')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'attendance_log' }, payload => {
                console.log('New Attendance:', payload);
                if (onUpdate) onUpdate(payload.new);
            })
            .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'attendance_log' }, payload => {
                console.log('Removed Attendance:', payload);
                // Trigger full refresh for simplicity
                if (onUpdate) onUpdate(null, true);
            })
            .subscribe();

        console.log("Subscribed to Realtime Changes");
    }
};

window.DB = DB;
