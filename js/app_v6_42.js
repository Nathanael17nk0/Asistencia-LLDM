// DEBUG TRACER
// alert("DEBUG: Script Start");

// function startApp() { // REMOVED WRAPPER
// console.log("Starting App...");
// --- STATE MANAGEMENT ---
const STATE = {
    user: null,
    currentLocation: { lat: 0, lng: 0 },
    // HARDCODED GEOFENCE (Templo) - v6.35
    targetLocation: {
        lat: 26.096836,
        lng: -98.291939,
        radius: 35
    },
    inGeofence: false
};

// --- DOM ELEMENTS ---
// --- DOM ELEMENTS ---
// --- DOM ELEMENTS ---
// --- DOM ELEMENTS ---
const loginSection = document.getElementById('login-section');
const registerSection = document.getElementById('register-section');
const dashboardSection = document.getElementById('dashboard-section');

const loginForm = document.getElementById('login-form');
const registerForm = document.getElementById('register-form');

// Register specific
const dobInput = document.getElementById('reg-dob');
const ageInput = document.getElementById('reg-edad');

// Dashboard specific
const fingerprintBtn = document.getElementById('check-in-btn');

// --- INITIALIZATION ---

// --- NAVIGATION HELPERS ---
function hideAllSections() {
    loginSection.classList.add('hidden-section');
    loginSection.classList.remove('active-section');
    registerSection.classList.add('hidden-section');
    registerSection.classList.remove('active-section');
    dashboardSection.classList.add('hidden-section');
    dashboardSection.classList.remove('active-section');
}

function showDashboard(user) {
    hideAllSections();
    dashboardSection.classList.remove('hidden-section');
    dashboardSection.classList.add('active-section');

    document.getElementById('user-name').textContent = user.full_name || 'Usuario';

    const avatarName = user.full_name ? user.full_name.replace(/ /g, '+') : 'User';
    const avatarEl = document.getElementById('user-avatar');
    if (avatarEl) {
        avatarEl.src = user.photo_url || `https://ui-avatars.com/api/?name=${avatarName}&background=c5a059&color=fff&bold=true`;
    }

    if (user.role === 'admin') {
        // Admin Special UI
        // 1. Show Toggle (optional/fallback)
        document.getElementById('admin-controls').classList.remove('hidden');

        // 2. Hide Fingerprint
        const fpBtn = document.getElementById('check-in-btn');
        if (fpBtn) fpBtn.classList.add('hidden');
        const instructions = document.querySelector('.instruction-text');
        if (instructions) instructions.classList.add('hidden');

        // 3. Auto-Open Admin Panel
        const adminPanel = document.getElementById('admin-panel');
        if (adminPanel) adminPanel.classList.remove('hidden');
    } else {
        // Ensure fingerprint is visible for non-admins
        const fpBtn = document.getElementById('check-in-btn');
        if (fpBtn) fpBtn.classList.remove('hidden');
        const instructions = document.querySelector('.instruction-text');
        if (instructions) instructions.classList.remove('hidden');
    }
    if (user.role !== 'admin') {
        startLocationWatch();
    } else {
        console.log("📍 Location Watch Skipped for Admin");
    }
}

function showRegister() {
    hideAllSections();
    registerSection.classList.remove('hidden-section');
    registerSection.classList.add('active-section');
}

function showLogin() {
    hideAllSections();
    loginSection.classList.remove('hidden-section');
    loginSection.classList.add('active-section');
}
window.appShowLogin = showLogin; // EXPOSE GLOBAL

const showLoginBtn = document.getElementById('show-login');
const showRegisterBtn = document.getElementById('show-register');
// MOVED TO DOMContentLoaded BINDING TO PREVENT NULL ERRORS
// if (showLoginBtn) showLoginBtn.addEventListener('click', (e) => { e.preventDefault(); showLogin(); });
// if (showRegisterBtn) showRegisterBtn.addEventListener('click', (e) => { e.preventDefault(); showRegister(); });

// --- REGISTER LOGIC ---
// Age Calc
if (dobInput) {
    dobInput.addEventListener('change', () => {
        const dob = new Date(dobInput.value);
        if (isNaN(dob.getTime())) { ageInput.value = ''; return; }
        const today = new Date();
        let age = today.getFullYear() - dob.getFullYear();
        if (today.getMonth() < dob.getMonth() || (today.getMonth() === dob.getMonth() && today.getDate() < dob.getDate())) { age--; }
        ageInput.value = age + " años";
    });
}

// Pass Toggle
const togglePassBtn = document.getElementById('toggle-reg-pass');
if (togglePassBtn) {
    togglePassBtn.addEventListener('click', function () {
        const passInput = document.getElementById('reg-password');
        const type = passInput.type === 'password' ? 'text' : 'password';
        passInput.type = type;
        this.className = type === 'password' ? 'ri-eye-line password-toggle' : 'ri-eye-off-line password-toggle';
    });
}

// Submit Register
if (registerForm) {
    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const nombre = document.getElementById('reg-nombre').value;
        const apellidoP = document.getElementById('reg-paterno').value;
        const apellidoM = document.getElementById('reg-materno').value;
        const celular = document.getElementById('reg-celular').value;
        const password = document.getElementById('reg-password').value;

        const dob = document.getElementById('reg-dob')?.value || '';
        const age = document.getElementById('reg-edad')?.value || '';
        const colonia = document.getElementById('reg-colonia')?.value || '';
        const direccion = document.getElementById('reg-address')?.value || '';
        const profesion = document.getElementById('reg-profession')?.value || '';
        const grado_estudios = document.getElementById('reg-study-level')?.value || '';
        const baptism_date = document.getElementById('reg-baptism-date')?.value || '';
        const holy_spirit_date = document.getElementById('reg-holy-spirit-date')?.value || '';

        const fullName = `${nombre} ${apellidoP} ${apellidoM}`;

        const newUser = {
            id: 'user-' + Date.now(),
            phone: String(celular).trim(),
            password: String(password).trim(),
            role: 'user',
            full_name: fullName,
            dob: dob,
            age_label: age,
            colonia: colonia,
            direccion: direccion,
            profesion: profesion,
            grado_estudios: grado_estudios,
            baptism_date: baptism_date,
            holy_spirit_date: holy_spirit_date
        };

        try {
            // 1. SAVE ACCOUNT (Permanent for this device)
            localStorage.setItem('nexus_account', JSON.stringify(newUser));

            // 2. REGISTER IN CENTRAL DATABASE (nexus_users)
            const allUsers = JSON.parse(localStorage.getItem('nexus_users') || '[]');
            const existingUser = allUsers.find(u => u.phone === newUser.phone);

            if (!existingUser) {
                allUsers.push({
                    ...newUser,
                    createdAt: new Date().toISOString()
                });
                localStorage.setItem('nexus_users', JSON.stringify(allUsers));
            } else {
                // Update existing if found (optional, but good for re-registration)
                // For now, we prefer not to overwrite unless necessary, but let's assume valid update
                // actually, let's just warn or skip. But finding it means they already exist.
                // If they are registering, they might have lost local data. We should ensure they are in the list.
            }

            // 3. SET ACTIVE SESSION (Transient)
            localStorage.setItem('nexus_session', 'active');

            STATE.user = newUser;

            // 4. CLOUD SYNC (Critical for Admin Visibility)
            if (window.DB) {
                try {
                    await window.DB.registerUser(newUser);
                    console.log("✅ Self-Registration Synced to Cloud");
                } catch (dbErr) {
                    console.error("⚠️ Cloud Register Error:", dbErr);

                    // HANDLE DUPLICATE USER (ZOMBIE)
                    if (dbErr.message && (dbErr.message.includes('duplicate key') || dbErr.code === '23505')) {
                        alert("⚠️ ESTE NÚMERO YA ESTÁ REGISTRADO\n\nEntrando como usuarios local...");

                        // 1. Force Save Account (Again, to be sure)
                        localStorage.setItem('nexus_account', JSON.stringify(newUser));
                        localStorage.setItem('nexus_session', 'active');

                        // 2. Direct Entry (Skip Reload/Init check)
                        hideAllSections();
                        if (typeof showDashboard === 'function') {
                            showDashboard(newUser);
                        } else {
                            window.location.reload(); // Fallback
                        }
                        return;
                    }

                    alert("Aviso: Tu cuenta se creó localmente, pero hubo error en nube: " + dbErr.message);
                }
            }

            alert(`REGISTRO EXITOSO\nBienvenido, ${nombre}.\n\nTus credenciales se han guardado.`);
            window.location.reload();

        } catch (err) {
            // BACKUP CATCH (For critical failures)
            if (err.message && (err.message.includes('duplicate key') || err.message.code === '23505')) {
                alert("⚠️ CUENTA EXISTENTE\n\nRedirigiendo...");
                localStorage.setItem('nexus_session', 'active');
                window.location.reload();
                return;
            }
            alert("ERROR AL GUARDAR: " + err.message);
        }
    });
}

// --- LOGIN LOGIC ---
// --- LOGIN LOGIC ---
async function handleLogin(e) {
    if (e) e.preventDefault(); // Safety

    try {
        const phoneInput = document.getElementById('login-phone');
        const passInput = document.getElementById('login-password');
        const btnContent = document.querySelector('#login-form button .btn-content');
        const originalBtnText = btnContent ? btnContent.innerHTML : 'INGRESAR';

        if (!phoneInput || !passInput) return alert("Error: Campos no encontrados");

        const phone = phoneInput.value;
        const password = passInput.value;

        const cleanPhone = String(phone).trim();
        const cleanPass = String(password).trim();

        console.log("Attempting login:", cleanPhone);

        // Helper to Restore Button
        const resetButton = () => {
            if (btnContent) btnContent.innerHTML = originalBtnText;
        };

        // Check Admin Hardcoded
        if (cleanPhone === '0000' && cleanPass === 'admin') {
            const adminUser = {
                id: 'admin-1',
                full_name: 'Administrador',
                role: 'admin',
                phone: '0000',
                createdAt: new Date().toISOString(),
                colonia: 'Sede',
                age_label: 'N/A'
            };
            localStorage.setItem('nexus_account', JSON.stringify(adminUser));
            localStorage.setItem('nexus_session', 'active');

            // Force Save to Users List too (to avoid confusion)
            const allUsers = JSON.parse(localStorage.getItem('nexus_users') || '[]');
            if (!allUsers.find(u => u.phone === '0000')) {
                allUsers.push(adminUser);
                localStorage.setItem('nexus_users', JSON.stringify(allUsers));
            }

            STATE.user = adminUser; // Set global state immediately
            alert("✅ MODO ADMIN ACTIVADO");

            // DIRECT ENTRY (No Reload)
            console.log("🚀 Admin Direct Entry...");
            hideAllSections();
            showDashboard(adminUser); // This handles UI switching

            // Trigger Admin Panel Show after UI update
            setTimeout(() => {
                const adminPanel = document.getElementById('admin-panel');
                if (adminPanel) adminPanel.classList.remove('hidden');
            }, 500);

            return;
        }

        // --- SEARCH LOGIC ---
        // 1. Local Search
        let allUsers = JSON.parse(localStorage.getItem('nexus_users') || '[]');
        let foundUser = allUsers.find(u =>
            String(u.phone).trim() === cleanPhone &&
            String(u.password).trim() === cleanPass
        );

        if (foundUser) {
            doLoginSuccess(foundUser);
            return;
        }

        // 2. Cloud Fallback (If not found locally)
        if (window.DB && window.sbClient) {
            try {
                if (btnContent) btnContent.innerHTML = 'BUSCANDO EN NUBE... <i class="ri-loader-4-line ri-spin"></i>';
                console.log("⚠️ Local login failed. Trying Cloud...");

                // Force fetch
                const cloudUsers = await window.DB.fetchAllUsers();
                if (cloudUsers && cloudUsers.length > 0) {
                    // Update Local
                    localStorage.setItem('nexus_users', JSON.stringify(cloudUsers.map(u => ({
                        id: u.id,
                        phone: u.phone,
                        full_name: u.full_name,
                        role: u.role,
                        age_label: u.age || '',
                        dob: u.dob || '',
                        colonia: u.colony || u.colonia || '',
                        direccion: u.direccion || '',
                        profesion: u.profesion || '',
                        grado_estudios: u.grado_estudios || '',
                        baptism_date: u.baptism_date || '',
                        holy_spirit_date: u.holy_spirit_date || '',
                        photo_url: u.photo_url || null,
                        password: u.password,
                        createdAt: u.created_at
                    }))));

                    // Retry Search
                    allUsers = JSON.parse(localStorage.getItem('nexus_users') || '[]');
                    foundUser = allUsers.find(u =>
                        String(u.phone).trim() === cleanPhone &&
                        String(u.password).trim() === cleanPass
                    );

                    if (foundUser) {
                        console.log("✅ Cloud Fallback Success!");
                        resetButton();
                        doLoginSuccess(foundUser);
                        return;
                    }
                }
            } catch (err) {
                console.error("Cloud Fallback Error:", err);
            }
        }

        // 3. Final Fallback: Legacy Local Account
        const accountData = localStorage.getItem('nexus_account');
        if (accountData) {
            const storedUser = JSON.parse(accountData);
            if (String(storedUser.phone).trim() === cleanPhone && String(storedUser.password).trim() === cleanPass) {
                resetButton();
                doLoginSuccess(storedUser);
                return;
            }
        }

        if (window.DB && !window.sbClient) {
            // DB exists but Client missing?
            console.warn("Supabase Client missing in handleLogin");
        }

        resetButton();
        if (!window.DB || !window.sbClient) {
            alert("⚠️ SIN CONEXIÓN A LA NUBE\n\nNo encontramos este usuario localmente y no hay conexión con la base de datos.\n\nPor favor:\n1. Revisa tu internet.\n2. Recarga la página.\n3. Si eres Admin, usa '0000'.");
        } else {
            alert("❌ CREDENCIALES INCORRECTAS\n\nNo encontramos este usuario ni localmente ni en la nube.\nVerifica el número y contraseña.");
        }
    } catch (criticalErr) {
        alert("CRITICAL LOGIN ERROR: " + criticalErr.message);
        console.error(criticalErr);
    }
}

function doLoginSuccess(user) {
    console.log("✅ Login Success:", user.full_name);
    STATE.user = user;
    localStorage.setItem('nexus_account', JSON.stringify(user));
    localStorage.setItem('nexus_session', 'active');

    // Toast or Alert
    // 3. DIRECT ENTRY (No Reload to prevent state loss)
    console.log("🚀 Direct Entry to Dashboard...");
    hideAllSections();
    if (typeof showDashboard === 'function') {
        showDashboard(user);
    } else {
        console.warn("showDashboard missing, reloading...");
        window.location.reload();
    }
}

// EXPOSE AND BIND
window.appHandleLogin = handleLogin;

if (loginForm) {
    loginForm.addEventListener('submit', handleLogin);
}


// --- FINGERPRINT CHECK-IN ---
if (fingerprintBtn) {
    fingerprintBtn.addEventListener('click', () => {
        if (!STATE.user) return showLogin();

        // 1. Detect Service Slot
        const now = new Date();
        const { slotId, slotName } = getServiceSlot(now);

        // 2. Check Previous Attendance (For THIS service)
        const log = JSON.parse(localStorage.getItem('nexus_attendance_log') || '[]');
        const todayISO = now.toISOString().split('T')[0];

        const hasAttendedService = log.find(e =>
            e.userId === STATE.user.phone &&
            e.timestamp.startsWith(todayISO) &&
            e.serviceSlot === slotId
        );

        if (hasAttendedService) {
            const method = hasAttendedService.method === 'manual_admin' ? 'por el Administrador' : 'previamente';
            alert(`⚠️ YA REGISTRADO\n\nYa marcaste asistencia para: ${slotName}.`);
            return;
        }

        // 3. Simulate Scan
        const scanner = document.querySelector('.scanner-container');
        const icon = document.querySelector('.fingerprint-icon');

        icon.style.color = 'cyan';
        // Simple animation
        setTimeout(() => {
            icon.style.color = 'var(--success)';
            // Log it
            log.push({
                userId: STATE.user.phone,
                name: STATE.user.full_name,
                timestamp: new Date().toISOString(),
                method: 'self',
                serviceSlot: slotId,
                serviceName: slotName
            });
            localStorage.setItem('nexus_attendance_log', JSON.stringify(log));

            // Show Success Popup
            const popup = document.getElementById('success-message');
            const timeEl = document.getElementById('time-stamp');
            timeEl.textContent = new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
            popup.classList.remove('hidden');

            // Hide after 3s
            setTimeout(() => {
                popup.classList.add('hidden');
                icon.style.color = ''; // Reset
            }, 3000);

        }, 1500);
    });
}

// --- SCHEDULE LOGIC ---
const scheduleToggle = document.getElementById('schedule-toggle');
const scheduleOverlay = document.getElementById('schedule-overlay');
const closeSchedule = document.getElementById('close-schedule');
const viewWeeklyBtn = document.getElementById('view-weekly-btn');
const backToTodayBtn = document.getElementById('back-to-today');
const weeklyTableContainer = document.getElementById('weekly-table-container');
const scheduleGrid = document.querySelector('.schedule-grid');

if (scheduleToggle) {
    scheduleToggle.addEventListener('click', () => {
        scheduleOverlay.classList.remove('hidden');
        loadTodaySchedule();
    });
}

if (closeSchedule) {
    closeSchedule.addEventListener('click', () => {
        scheduleOverlay.classList.add('hidden');
    });
}

if (viewWeeklyBtn) {
    viewWeeklyBtn.addEventListener('click', () => {
        scheduleGrid.classList.add('hidden');
        viewWeeklyBtn.classList.add('hidden');
        weeklyTableContainer.classList.remove('hidden');
        loadWeeklyTable();
    });
}

if (backToTodayBtn) {
    backToTodayBtn.addEventListener('click', () => {
        weeklyTableContainer.classList.add('hidden');
        scheduleGrid.classList.remove('hidden');
        viewWeeklyBtn.classList.remove('hidden');
        loadTodaySchedule();
    });
}

function getStorageKey(date) {
    // Simple YYYY-MM-DD format
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function formatDate(date) {
    const options = { weekday: 'long', day: 'numeric', month: 'long' };
    return date.toLocaleDateString('es-ES', options).toUpperCase();
}

function loadTodaySchedule() {
    const today = new Date();
    const dateKey = getStorageKey(today);
    const fullSchedule = JSON.parse(localStorage.getItem('nexus_schedule_db') || '{}');
    const todayData = fullSchedule[dateKey] || {};

    ['5am', '9am', '7pm', 'special'].forEach(slot => {
        const card = document.querySelector(`.schedule-card[data-slot="${slot}"]`);
        if (!card) return;

        const nameEl = card.querySelector('.assigned-name');
        nameEl.textContent = todayData[slot] || '-- Sin Asignar --';

        // Admin features
        const editBtn = card.querySelector('.edit-role-btn');
        if (STATE.user && STATE.user.role === 'admin') {
            editBtn.classList.remove('hidden');
            editBtn.onclick = () => {
                const newName = prompt(`Asignar para HOY (${slot}):`, todayData[slot] || '');
                if (newName !== null) {
                    todayData[slot] = newName;
                    fullSchedule[dateKey] = todayData;
                    localStorage.setItem('nexus_schedule_db', JSON.stringify(fullSchedule));
                    nameEl.textContent = newName || '-- Sin Asignar --';
                }
            };
        } else {
            if (editBtn) editBtn.classList.add('hidden');
        }
    });
}

function loadWeeklyTable() {
    // alert("DEBUG: 1. Entrando a loadWeeklyTable");
    const tbody = document.getElementById('weekly-tbody');
    if (!tbody) {
        alert("CRITICAL: No existe element 'weekly-tbody' en el HTML");
        return;
    }
    tbody.innerHTML = '';

    const todayStr = new Date().toISOString().split('T')[0]; // Moved to top
    const fullSchedule = JSON.parse(localStorage.getItem('nexus_schedule_db') || '{}');
    const sortedDates = Object.keys(fullSchedule).sort();

    // DEBUG INFO REMOVED FOR PRODUCTION
    // const debugRow = document.createElement('tr'); ... 

    // DEBUG TRACE
    console.log("Rendering Weekly Table...");
    // alert("DEBUG: Iniciando loadWeeklyTable"); // Uncomment if desperate

    if (sortedDates.length === 0) {
        // alert("DEBUG: No hay fechas en localStorage"); 
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:20px;">No hay horarios cargados. Sube una foto o Excel desde Admin.</td></tr>';
        return;
    }

    // alert(`DEBUG: Fechas encontradas: ${sortedDates.length}`);

    // Filter to show from Today onwards (or show everything? "Ver Roles" implies seeing the plan)
    // Let's show everything from Today onwards, plus maybe the last few? 
    // User probably wants to see upcoming.

    // Sort keys properly just in case
    sortedDates.sort();

    sortedDates.forEach(dateKey => {
        // Parse YYYY-MM-DD
        const parts = dateKey.split('-');
        if (parts.length !== 3) return; // Invalid key

        const [y, m, d] = parts.map(Number);
        const dateObj = new Date(y, m - 1, d);

        // Optional: Skip past dates? 
        // if (dateKey < todayStr) return; 

        const dayData = fullSchedule[dateKey];
        const tr = document.createElement('tr');

        // Date Cell
        const tdDate = document.createElement('td');
        // Format: "Lunes 25/01"
        const options = { weekday: 'long', day: 'numeric', month: 'numeric' };
        try {
            tdDate.textContent = dateObj.toLocaleDateString('es-MX', options);
        } catch (e) { tdDate.textContent = dateKey; }

        tr.appendChild(tdDate);

        // Slots
        ['5am', '9am', '7pm', 'special'].forEach(slot => {
            const td = document.createElement('td');
            td.textContent = dayData[slot] || '';

            // Allow Edit if Admin
            if (STATE.user && STATE.user.role === 'admin') {
                td.classList.add('editable');
                td.onclick = () => {
                    const newName = prompt(`Editar ${slot} (${dateKey}):`, dayData[slot] || '');
                    if (newName !== null) {
                        dayData[slot] = newName;
                        fullSchedule[dateKey] = dayData;
                        localStorage.setItem('nexus_schedule_db', JSON.stringify(fullSchedule));

                        // Cloud Sync
                        if (window.DB) {
                            window.DB.saveSchedule(fullSchedule).catch(console.error);
                        }

                        loadWeeklyTable(); // Refresh table
                    }
                };
            }
            tr.appendChild(td);
        });

        tbody.appendChild(tr);
    });
}



// --- HISTORY MODAL LOGIC ---
function showUserHistory(user) {
    const log = JSON.parse(localStorage.getItem('nexus_attendance_log') || '[]');
    let history = log.filter(e => e.userId === user.phone);

    // Deduplicate logic: Same timestamp (up to minute) + same slot??
    // Or just exact timestamp match + slot match.
    // The issue "2 entries" suggests they have essentially the same data.
    // Let's filter unique composite keys: date + slot
    const seen = new Set();
    history = history.filter(h => {
        const key = h.timestamp.split('T')[0] + '|' + h.serviceSlot;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });

    const modal = document.getElementById('history-modal');
    const content = document.getElementById('history-content');

    if (!modal || !content) return alert("Error: Modal no encontrado");

    if (history.length === 0) {
        content.innerHTML = `<p style="text-align:center; padding:20px;">Sin asistencias registradas.</p>`;
    } else {
        // Sort new to old
        history.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

        const list = history.map(h => {
            const date = new Date(h.timestamp);
            const dateStr = date.toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric', month: 'short' });
            const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            return `
                <div style="border-bottom:1px solid #eee; padding:10px 0; display:flex; align-items:center; gap:10px;">
                    <div style="background:var(--bg-color); padding:5px 8px; border-radius:5px; font-weight:bold; font-size:0.8rem; text-align:center; min-width:50px;">
                        ${dateStr.split(' ')[1]}<br><small>${dateStr.split(' ')[0]}</small>
                    </div>
                    <div>
                        <div style="font-weight:bold; color:var(--secondary-navy);">${h.serviceName || h.serviceSlot || 'Desconocido'}</div>
                        <div style="font-size:0.8rem; color:var(--text-muted);">🕒 ${timeStr} &bull; ${h.method === 'manual_admin' ? 'Manual' : 'Escáner'}</div>
                    </div>
                </div>
            `;
        }).join('');

        content.innerHTML = `<h5 style="margin-bottom:10px; border-bottom:1px solid var(--primary-gold); padding-bottom:5px;">${user.full_name}</h5>` + list;
    }

    modal.classList.remove('hidden');
    modal.style.display = 'flex';
}

// --- DATA SEEDING (FROM IMAGE) ---
// --- THEME LOGIC ---
function loadTheme() {
    const theme = localStorage.getItem('nexus_theme') || 'LA RESTAURACIÓN DE LA IGLESIA';
    const display = document.getElementById('current-theme-text');
    const input = document.getElementById('admin-theme-input');

    if (display) display.textContent = theme;
    if (input) input.value = theme;
}

function saveTheme(e) {
    if (e) {
        e.preventDefault();
        e.stopPropagation();
    }
    const input = document.getElementById('admin-theme-input');
    if (!input) return;

    const newTheme = input.value.trim().toUpperCase();
    if (newTheme) {
        localStorage.setItem('nexus_theme', newTheme);
        loadTheme();
        alert('Tema actualizado');
        // Close admin panel if desired
        document.getElementById('admin-panel').classList.add('hidden');
    }
}

// Initialize Theme
document.addEventListener('DOMContentLoaded', () => {
    loadTheme();

    const saveBtn = document.getElementById('save-theme-btn');
    if (saveBtn) saveBtn.addEventListener('click', saveTheme);

    // Admin Toggle Logic
    const adminToggle = document.getElementById('admin-toggle');
    const adminPanel = document.getElementById('admin-panel');
    const closeAdmin = document.getElementById('close-admin');

    if (adminToggle && adminPanel) {
        adminToggle.addEventListener('click', () => {
            adminPanel.classList.toggle('hidden');
        });
    }
    if (closeAdmin && adminPanel) {
        closeAdmin.addEventListener('click', () => {
            adminPanel.classList.add('hidden');
        });
    }
});

// Seed data
function seedScheduleData() {
    if (localStorage.getItem('nexus_schedule_db')) return; // Only seed if empty

    const seedData = {
        "2026-01-25": { // Domingo 25
            "9am": "DOMINICAL",
            "7pm": "S: ABIMAEL CASTAÑEDA\nD: JOSÉ LUIS MAYA\nC: TEODORO HERNÁNDEZ",
            "special": "URIEL HERNÁNDEZ"
        },
        "2026-01-26": { // Lunes 26
            "5am": "ANDRÉS TURRUBIATES",
            "9am": "ANA BELTRÁN",
            "7pm": "CARLOS MAYA",
            "special": "JOSUÉ RAMÍREZ"
        },
        "2026-01-27": { // Martes 27
            "5am": "DOMINGO ÁLVAREZ",
            "9am": "ADAMI DE LA ROSA\nYOLANDA ESPARZA",
            "7pm": "ARMANDO MAYA CASTRO\n(Tema: Matrimonio)",
            "special": "JOSÉ GARCÍA"
        },
        "2026-01-28": { // Miércoles 28
            "5am": "JEZREEL GARCÍA",
            "9am": "MARCELA OVALLE",
            "7pm": "FELICIANO GALARZA",
            "special": "ZIMRI MORALES"
        },
        "2026-01-29": { // Jueves 29
            "5am": "MANUEL GARCÍA",
            "9am": "EDNA HERNÁNDEZ",
            "7pm": "S: TITO HERNÁNDEZ\nD: ARMANDO MAYA\nC: CÉSAR BADILLO",
            "special": "FERNANDO GARCÍA"
        },
        "2026-01-30": { // Viernes 30
            "5am": "AMRAM GARCÍA",
            "9am": "REINA MORALES",
            "7pm": "SANTIAGO SALAZAR",
            "special": "HEBER DOMÍNGUEZ"
        },
        "2026-01-31": { // Sábado 31 (HOY)
            "5am": "ABISAI COMPEAN",
            "9am": "ANGÉLICA RIZO",
            "7pm": "S NIÑOS: ABRAHAM M.\nD: PEDRO COMPEAN\nC: BETSAIDA MARTÍNEZ",
            "special": "JOCSAN CASTAÑEDA"
        },
        "2026-02-01": { // Domingo 1 Feb
            "5am": "JOB CASTRO",
            "9am": "DOMINICAL"
        }
    };

    // DISABLED SEEDING to allow clean slate
    // localStorage.setItem('nexus_schedule_db', JSON.stringify(seedData));
    console.log("Schedule seeding disabled (User request).");
}

// --- GEOLOCATION ---
// --- GEOLOCATION (OPTIMIZED FOR HEAT/BATTERY) ---
// GLOBAL LOCATION CHECK (Callable from Realtime)
window.checkLocationStatus = function () {
    if (!navigator.geolocation) return;
    console.log("📍 Checking Location Status...");

    navigator.geolocation.getCurrentPosition((pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        STATE.currentLocation = { lat, lng };

        // console.log("📍 Location Acquired:", lat, lng);

        // Validation Logic
        if (STATE.targetLocation && STATE.targetLocation.lat !== 0) {
            const dist = getDistanceInMeters(lat, lng, STATE.targetLocation.lat, STATE.targetLocation.lng);
            STATE.distance = dist;
            STATE.inGeofence = dist <= STATE.targetLocation.radius;

            // Debug Logs (Optional)
            // console.log(`📏 Dist: ${Math.round(dist)}m, Target: ${STATE.targetLocation.radius}m, In: ${STATE.inGeofence}`);

            if (typeof updateLocationStatus === 'function') {
                updateLocationStatus();
            }
        }
    }, (err) => console.warn("Geo Error:", err), { enableHighAccuracy: true, timeout: 5000, maximumAge: 10000 });
};

function startLocationWatch() {
    // 1. Initial Check
    if (window.checkLocationStatus) window.checkLocationStatus();

    // 2. Poll every 20 seconds (Battery Efficient but Responsive)
    // Clear existing to avoid dupes
    if (window.locationInterval) clearInterval(window.locationInterval);

    // 3. Force check on App Resume (Fix for background issue)
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
            console.log("👁️ App Resumed - Forcing Location Check");
            if (window.checkLocationStatus) window.checkLocationStatus();
        }
    });

    window.locationInterval = setInterval(() => {
        if (window.checkLocationStatus) window.checkLocationStatus();
    }, 20000);
}

// --- ADMIN FEATURES (OCR & MANUAL) ---
// --- ADMIN FEATURES (OCR & MANUAL) ---
function initAdminFeatures() {
    console.log("Initializing Admin Features...");

    // AUTO-OPEN PANEL FOR ADMINS ONLY (Double Check)
    const activeSession = localStorage.getItem('nexus_session');
    const accountData = JSON.parse(localStorage.getItem('nexus_account') || '{}');
    const panel = document.getElementById('admin-panel');

    if (panel && activeSession === 'active' && accountData.role === 'admin') {
        panel.classList.remove('hidden');
    } else if (panel) {
        // Ensure closed if not admin
        panel.classList.add('hidden');
    }
    const closeBtn = document.getElementById('close-admin-btn');
    if (closeBtn) {
        closeBtn.onclick = () => {
            panel.classList.add('hidden');
        };
    }

    // DEBUG INPUTS (Touch fix?)


    // 1. OCR Logic
    console.log("Initializing Admin Features...");

    // 0. Location Config
    const setLocBtn = document.getElementById('set-location-btn');
    const locStatus = document.getElementById('location-status-admin');

    // Update status initially
    if (locStatus) {
        if (STATE.targetLocation.lat !== 0) {
            locStatus.textContent = `Configurado: ${STATE.targetLocation.lat.toFixed(4)}, ${STATE.targetLocation.lng.toFixed(4)}`;
            locStatus.style.color = 'green';
        } else {
            locStatus.textContent = 'Sin configurar (0,0)';
        }
    }

    // Theme Save
    const saveThemeBtn = document.getElementById('save-theme-btn');
    if (saveThemeBtn) {
        saveThemeBtn.addEventListener('click', () => {
            const val = document.getElementById('admin-theme-input').value;
            if (val) {
                localStorage.setItem('nexus_theme', val);
                loadTheme();
                if (window.DB) window.DB.saveConfig('weekly_theme', { text: val }).catch(console.error);
                alert("Tema actualizado y sincronizado.");
            }
        });
    }

    // Set Location
    // This function is called when the admin clicks the "Set Location" button
    // It uses the current device's GPS location to set the church's target location.
    if (setLocBtn) {
        setLocBtn.addEventListener('click', () => {
            if (navigator.geolocation) {
                navigator.geolocation.getCurrentPosition(pos => {
                    const loc = {
                        lat: pos.coords.latitude,
                        lng: pos.coords.longitude,
                        timestamp: new Date().toISOString()
                    };

                    const settings = JSON.parse(localStorage.getItem('nexus_settings') || '{}');
                    settings.targetLocation = loc;
                    localStorage.setItem('nexus_settings', JSON.stringify(settings));
                    STATE.targetLocation = loc;

                    if (window.DB) window.DB.saveConfig('church_location', loc).catch(console.error);

                    // --- LOCATION UI ---
                    function updateLocationStatus() {
                        const statusEl = document.getElementById('location-status');
                        const registerBtn = document.getElementById('register-btn');
                        const distEl = document.getElementById('distance-display');

                        if (!STATE.targetLocation || STATE.targetLocation.lat === 0) return;

                        // Calculate if not already done
                        if (STATE.currentLocation.lat !== 0) {
                            const dist = getDistanceInMeters(
                                STATE.currentLocation.lat, STATE.currentLocation.lng,
                                STATE.targetLocation.lat, STATE.targetLocation.lng
                            );
                            STATE.distance = dist;
                            STATE.inGeofence = dist <= STATE.targetLocation.radius;
                        }

                        const distDisplay = STATE.distance ? Math.round(STATE.distance) + "m" : "--";

                        // UPDATE UI
                        const fingerprintDiv = document.querySelector('.fingerprint-container');
                        const messageDiv = document.querySelector('.geofence-message'); // "ACÉRCATE AL TEMPLO..."

                        if (STATE.inGeofence) {
                            // IN RANGE
                            if (fingerprintDiv) fingerprintDiv.classList.remove('hidden-geo');
                            if (messageDiv) messageDiv.style.display = 'none'; // Hide message
                            if (registerBtn) registerBtn.disabled = false;
                        } else {
                            // OUT OF RANGE
                            if (fingerprintDiv) fingerprintDiv.classList.add('hidden-geo');

                            if (messageDiv) {
                                messageDiv.style.display = 'block';
                                messageDiv.innerHTML = `
                ACÉRCATE AL TEMPLO PARA REGISTRAR<br>
                <small>Distancia: ${distDisplay}</small><br>
                <button onclick="window.checkLocationStatus()" style="background:#333; color:white; border:none; padding:5px 10px; border-radius:10px; margin-top:5px; font-size:0.8rem;">
                    <i class="ri-refresh-line"></i> Actualizar GPS
                </button>
            `;
                            }
                        }
                    }                   // If not, you might need to call loadTheme() or similar for location.
                    // For now, let's just update the locStatus text directly.
                    if (locStatus) {
                        locStatus.textContent = `✅ Fijado: ${loc.lat.toFixed(4)}, ${loc.lng.toFixed(4)}`;
                        locStatus.style.color = 'green';
                    }
                    alert(`✅ Ubicación de la Iglesia FIJADA:\n${loc.lat}, ${loc.lng}`);
                }, (err) => {
                    console.error("Error getting location:", err);
                    alert("Error al obtener la ubicación. Asegúrate de permitir el GPS.");
                });
            } else {
                alert("GPS no disponible en este dispositivo.");
            }
        });
    }

    // 1. OCR Upload
    const fileInput = document.getElementById('schedule-file-input');
    const uploadBtn = document.getElementById('upload-schedule-btn');
    const ocrStatus = document.getElementById('ocr-status');

    // Close Button Removed

    if (uploadBtn && fileInput) {
        uploadBtn.addEventListener('click', () => fileInput.click());

        fileInput.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            ocrStatus.classList.remove('hidden');
            ocrStatus.innerHTML = '<span class="spinner">⏳</span> Analizando imagen...';

            if (typeof Tesseract === 'undefined' || typeof XLSX === 'undefined') {
                // It's okay if Tesseract is missing for Excel, or XLSX missing for Image, 
                // but let's just warn generic.
                // Actually, let's proceed and check later.
            }

            // CHECK FILE TYPE
            if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
                // --- EXCEL MODE ---
                ocrStatus.innerHTML = '<span class="spinner">📊</span> Leyendo Excel...';

                const reader = new FileReader();
                reader.onload = function (e) {
                    try {
                        const data = new Uint8Array(e.target.result);
                        const workbook = XLSX.read(data, { type: 'array' });
                        const firstSheetName = workbook.SheetNames[0];
                        const worksheet = workbook.Sheets[firstSheetName];

                        // Get JSON (array of arrays)
                        const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

                        let newSchedule = JSON.parse(localStorage.getItem('nexus_schedule_db') || '{}');

                        // CRITICAL FIX: Ensure it is an Object, not an Array.
                        // Arrays with named properties evaluate to JSON "[]" or "[{}]", losing data.
                        if (Array.isArray(newSchedule)) {
                            console.warn("Detected Corrupt Schedule (Array). Resetting to Object.");
                            newSchedule = {};
                        }

                        let updatesCount = 0;
                        let foundDates = []; // Track found dates for debugging

                        // Variables for Date parsing
                        const today = new Date();
                        const currentMonth = today.getMonth();
                        const currentYear = today.getFullYear();

                        // Regex for detecting date in first column
                        const simpleDateRegex = /(Lunes|Martes|Miércoles|Miercoles|Jueves|Viernes|Sábado|Sabado|Domingo)[\s.,:]+(\d{1,2})/i;

                        rows.forEach((row, index) => {
                            if (row.length === 0) return;

                            // Assume Column 0 is Date.
                            let col0 = row[0];
                            let dayMatch = null;
                            let targetMonth = currentMonth;
                            let targetYear = currentYear;
                            let dayNum = 0;

                            // CASE 1: Excel Serial Number (e.g. 45678)
                            if (typeof col0 === 'number') {
                                // Excel epoch is Dec 30 1899 usually (1900 date system)
                                // Using SheetJS helper if available or simple math
                                // Math: (Serial - 25569) * 86400 * 1000
                                const jsDate = new Date((col0 - 25569) * 86400 * 1000);
                                // Adjust for timezone offset approx?
                                // Better: use explicit YMD from it
                                // Actually, let's just use it directly
                                // Add 1 day buffer for leap year bug in Excel? Usually SheetJS handles if we used cellDates:true option in read.
                                // But we used type:'array'. 
                                // Let's try to interpret common 2024/2025 dates.
                                // If serial is > 45000 (year 2023+), likely valid.
                                if (col0 > 40000) {
                                    // 1 day correction often needed for JS math vs Excel
                                    jsDate.setSeconds(jsDate.getSeconds() + 10); // add a bit to be safe inside the day
                                    targetMonth = jsDate.getUTCMonth();
                                    targetYear = jsDate.getUTCFullYear();
                                    dayNum = jsDate.getUTCDate();

                                    // If conversion looks wrong (year 1900), fall back.
                                    if (targetYear > 2000) {
                                        dayMatch = ['Serial', 'Serial', dayNum];
                                    }
                                }
                            }

                            // CASE 2: String Parsing
                            if (!dayMatch) {
                                const strVal = String(col0).trim();

                                // A: "Lunes 1"
                                dayMatch = strVal.match(simpleDateRegex);

                                // B: "1/2", "01/02", "1-Feb"
                                if (!dayMatch) {
                                    // Match DD/MM or DD-MM
                                    const slashMatch = strVal.match(/^(\d{1,2})[/-](\d{1,2})/);
                                    if (slashMatch) {
                                        dayNum = parseInt(slashMatch[1]);
                                        const mNum = parseInt(slashMatch[2]);
                                        if (mNum >= 1 && mNum <= 12) {
                                            targetMonth = mNum - 1;
                                            dayMatch = ['SlashDate', 'Slash', dayNum];
                                        }
                                    }
                                }

                                // C: "1 de Febrero" Fuzzy (AND Abbreviations)
                                if (!dayMatch) {
                                    // Supports: "1 de Febrero", "1 Feb", "01 Ene", etc.
                                    const fuzzyRegex = /(\d{1,2})\s+(de\s+)?(ene|feb|mar|abr|may|jun|jul|ago|sep|oct|nov|dic|enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)/i;
                                    const fuzzyMatch = strVal.match(fuzzyRegex);
                                    if (fuzzyMatch) {
                                        dayMatch = [fuzzyMatch[0], 'FuzzyDay', fuzzyMatch[1]];
                                        console.log("Fuzzy Date Match:", strVal, "Day:", dayMatch[2]);
                                    }
                                }
                            }

                            if (dayMatch) {
                                if (dayMatch[1] !== 'Serial' && dayMatch[1] !== 'Slash') {
                                    dayNum = parseInt(dayMatch[2]);
                                }

                                // ... Continue with Month Logic ...
                                // Removed duplicate declarations that caused ReferenceError

                                // Month detection logic

                                // Month detection logic
                                if (today.getDate() > 20 && dayNum < 10) {
                                    targetMonth++;
                                    if (targetMonth > 11) { targetMonth = 0; targetYear++; }
                                }

                                // Check for explicit month names in the cell (including abbreviations)
                                const monthNames = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
                                const monthAbbrs = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

                                const lowerVal = String(col0).toLowerCase();

                                // Check full names first
                                monthNames.forEach((m, i) => {
                                    if (lowerVal.includes(m)) {
                                        targetMonth = i;
                                        if (currentMonth == 11 && i == 0) targetYear++;
                                    }
                                });

                                // Check abbreviations
                                monthAbbrs.forEach((m, i) => {
                                    if (lowerVal.includes(m)) {
                                        // Safety: Avoid matching 'mar' in 'martes'
                                        if (m === 'mar' && lowerVal.includes('martes')) return;
                                        if (m === 'ago' && lowerVal.includes('agosto')) return; // handled by full name, but safe duplicate

                                        // Only apply if targetMonth wasn't already set by full name (optional, but good practice)
                                        // Actually, just overwriting is fine as they map to same index.

                                        targetMonth = i;
                                        if (currentMonth == 11 && i == 0) targetYear++;
                                    }
                                });

                                const dateObj = new Date(targetYear, targetMonth, dayNum);
                                const yyyy = dateObj.getFullYear();
                                const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
                                const dd = String(dateObj.getDate()).padStart(2, '0');
                                const currentDateKey = `${yyyy}-${mm}-${dd}`;

                                // Log for user diagnosis
                                foundDates.push(`${currentDateKey} (Fila ${index}, Texto: "${col0}")`);

                                if (!newSchedule[currentDateKey]) newSchedule[currentDateKey] = {};

                                // ASSIGN COLUMNS (Assuming standard layout)
                                // Col 1: 5am
                                // Col 2: 9am
                                // Col 3: 7pm
                                // Col 4: Special

                                if (row[1]) { newSchedule[currentDateKey]['5am'] = String(row[1]).trim(); updatesCount++; }
                                if (row[2]) { newSchedule[currentDateKey]['9am'] = String(row[2]).trim(); updatesCount++; }
                                if (row[3]) { newSchedule[currentDateKey]['7pm'] = String(row[3]).trim(); updatesCount++; }
                                if (row[4]) { newSchedule[currentDateKey]['special'] = String(row[4]).trim(); updatesCount++; }
                            }
                        });

                        localStorage.setItem('nexus_schedule_db', JSON.stringify(newSchedule));

                        // CLOUD SYNC (Missing Step Added)
                        if (window.DB) {
                            window.DB.saveSchedule(newSchedule)
                                .then(() => console.log("Excel Schedule Saved to Cloud"))
                                .catch(err => alert("Advertencia: Se guardó en Mac pero falló al subir a Nube:\n" + err.message));
                        }

                        // Force Refresh
                        if (typeof loadWeeklyTable === 'function') loadWeeklyTable();
                        if (typeof loadDailySchedule === 'function') loadDailySchedule();

                        ocrStatus.innerHTML = `✅ Excel Importado (${updatesCount} slots).`;
                        alert(`¡Excel importado con éxito!\n\nSe actualizaron ${updatesCount} horarios.\n\nFechas leídas:\n${foundDates.slice(0, 15).join('\n')}`);

                    } catch (err) {
                        console.error(err);
                        alert("Error leyendo Excel: " + err.message);
                        ocrStatus.innerHTML = '❌ Error Excel';
                    }
                };
                reader.readAsArrayBuffer(file);
                return; // Stop processing, don't do OCR
            }

            if (typeof Tesseract === 'undefined') {
                alert("Cargando motor de lectura... Espere unos segundos e intente de nuevo.");
                return;
            }

            try {
                ocrStatus.innerHTML = '<span class="spinner">⏳</span> Iniciando motor inteligente...';

                // 1. Create Worker
                const worker = await Tesseract.createWorker('spa');

                // 2. Set Parameters (Safe Mode)
                // We use string '1' for true. PSM 6 is usually good for uniform blocks, 
                // but we'll stick to default PSM for now to avoid enum errors.
                await worker.setParameters({
                    preserve_interword_spaces: '1',
                });

                ocrStatus.innerHTML = '<span class="spinner">👀</span> Leyendo imagen...';
                const { data: { text } } = await worker.recognize(file);

                ocrStatus.innerHTML = '<span class="spinner">🧹</span> Limpiando datos...';
                await worker.terminate();

                console.log("TEXTO OCR (Espacios Preservados):", text);

                // Split lines but keep empty ones for structure logic? 
                // No, empty lines usually noise.
                const lines = text.split('\n');

                let currentDateKey = null;
                const newSchedule = JSON.parse(localStorage.getItem('nexus_schedule_db') || '{}');
                let updatesCount = 0;
                let foundDates = [];

                let currentSlotIndex = -1; // -1: waiting for date, 0:5am, 1:9am, 2:7pm, 3:special
                let lastDateKey = null;

                // Restore Missing Variables
                const simpleDateRegex = /(Lunes|Martes|Miércoles|Miercoles|Jueves|Viernes|Sábado|Sabado|Domingo)[\s.,:]+(\d{1,2})/i;
                const today = new Date();
                const currentMonth = today.getMonth();
                const currentYear = today.getFullYear();

                let debugLog = [];

                lines.forEach((line, index) => {
                    let cleanLine = line.trim();
                    if (cleanLine.length < 2) return; // Skip incredibly short noise

                    // Debug log for raw line
                    // debugLog.push(`RAW: "${cleanLine}"`); // Too verbose?

                    // 1. Detect Date

                    // 1. Detect Date
                    let dayMatch = line.match(simpleDateRegex);
                    let isFuzzyDate = false;

                    // Fallback: Fuzzy Date (e.g. "1 de Febrero", "02 Febrero", or just "1" if strictly formatted?)
                    // We'll trust "Num de Month" pattern highly.
                    if (!dayMatch) {
                        const fuzzyRegex = /(\d{1,2})\s+(de\s+)?(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)/i;
                        const fuzzyMatch = line.match(fuzzyRegex);
                        if (fuzzyMatch) {
                            dayMatch = [fuzzyMatch[0], 'FuzzyDay', fuzzyMatch[1]]; // Mock the array structure [full, dayName, dayNum]
                            isFuzzyDate = true;
                        }
                    }

                    if (dayMatch) {
                        const dayNum = parseInt(dayMatch[2]);
                        let targetMonth = currentMonth;
                        let targetYear = currentYear;

                        // Month detection logic (same as before)
                        if (today.getDate() > 20 && dayNum < 10) {
                            targetMonth++;
                            if (targetMonth > 11) { targetMonth = 0; targetYear++; }
                        }

                        // Specific check for Month Names to strip them
                        const monthNames = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
                        monthNames.forEach((m, i) => {
                            if (cleanLine.toLowerCase().includes(m)) {
                                targetMonth = i;
                                // If we are in Dec and see Jan, next year
                                if (currentMonth == 11 && i == 0) targetYear++;
                            }
                        });

                        const dateObj = new Date(targetYear, targetMonth, dayNum);
                        const yyyy = dateObj.getFullYear();
                        const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
                        const dd = String(dateObj.getDate()).padStart(2, '0');

                        currentDateKey = `${yyyy}-${mm}-${dd}`;

                        if (!newSchedule[currentDateKey]) newSchedule[currentDateKey] = {};
                        foundDates.push(`${isFuzzyDate ? '(Mal escrito)' : dayMatch[1]} ${dayNum} -> ${currentDateKey}`);
                        debugLog.push(`\n📅 FECHA DETECTADA: ${dayMatch[0]} (${currentDateKey})`);

                        currentSlotIndex = 0; // Reset for new date

                        // cleanup line to remove date string
                        cleanLine = cleanLine.replace(dayMatch[0], '');
                        // Remove month name too (with or without 'de')
                        cleanLine = cleanLine.replace(/de/gi, '').replace(new RegExp(monthNames.join('|'), 'gi'), '').replace(/\d{4}/, '').trim();

                        // Relaxed filter: Only continue if text remains, but don't return if it's just a date line
                        if (cleanLine.length < 1) return;
                    } else {
                        // If no date found, and no current date key, log skip
                        if (!currentDateKey && cleanLine.length > 3) {
                            debugLog.push(`   ⛔ Saltado (Sin fecha): "${cleanLine}"`);
                        }
                    }

                    // 2. Assign Slots
                    // If we are in a valid date context
                    if (currentDateKey && currentSlotIndex < 4) {
                        if (cleanLine.length < 1) return; // Skip empty lines
                        if (/^\d{1,2}:\d{2}$/.test(cleanLine)) return; // Skip "5:00" isolated headers

                        // HEURISTIC: Force split signals for anchors
                        // If "Dominical" or "S:" are glued to other text, separate them
                        cleanLine = cleanLine.replace(/(Dominical)/gi, '   $1   ');
                        cleanLine = cleanLine.replace(/([SDCsdc]:)/g, '   $1');
                        cleanLine = cleanLine.replace(/(Tema:)/gi, '   $1');

                        // Split line by multiple spaces to detect columns?
                        let parts = cleanLine.split(/\||\t|\s{2,}/);
                        parts = parts.map(p => p.trim()).filter(p => p.length > 0); // Relaxed filter for parts

                        // ANCHORS
                        if (/dominical/i.test(cleanLine)) {
                            currentSlotIndex = 1; // Force 9am
                            debugLog.push(`   ⚓ Ancla 'Dominical' -> Saltando a 9am`);
                        } else if (/^[SDCsdc]:/.test(cleanLine) || /Tema:/i.test(cleanLine)) {
                            currentSlotIndex = 2; // Force 7pm
                            debugLog.push(`   ⚓ Ancla 'S/D/C/Tema' -> Saltando a 7pm`);
                        }

                        if (parts.length > 1) {
                            // Multi-column
                            parts.forEach(part => {
                                if (currentSlotIndex >= 4) return;

                                if (/dominical/i.test(part)) currentSlotIndex = 1;
                                if (/^[SDCsdc]:/.test(part)) currentSlotIndex = 2;

                                const slots = ['5am', '9am', '7pm', 'special'];
                                const slotName = slots[currentSlotIndex];

                                newSchedule[currentDateKey][slotName] = part;
                                debugLog.push(`   ✅ Asignado [${slotName}]: "${part}"`);

                                currentSlotIndex++;
                                updatesCount++;
                            });
                        } else {
                            // Single Column
                            const val = parts[0];
                            const slots = ['5am', '9am', '7pm', 'special'];

                            // Special Handling for 7pm (Multi-line)
                            if (currentSlotIndex === 2) {
                                const slotName = '7pm';

                                // Heuristic to detect if we moved to Consagración (Column 4)
                                // If line does NOT start with S/D/C/Tema, AND 7pm is already full...
                                // AND it looks like a name?
                                if (!/^[SDCsdc]:/.test(val) && !/Tema:/i.test(val) && newSchedule[currentDateKey]['7pm']) {
                                    currentSlotIndex++; // Move to Special
                                    newSchedule[currentDateKey]['special'] = val;
                                    debugLog.push(`   ✅ Asignado [special]: "${val}" (Inferido tras 7pm)`);
                                    updatesCount++;
                                    currentSlotIndex++;
                                } else {
                                    // Still in 7pm (appending)
                                    if (newSchedule[currentDateKey]['7pm']) {
                                        newSchedule[currentDateKey]['7pm'] += '\n' + val;
                                        debugLog.push(`   ➕ Anexado a [7pm]: "${val}"`);
                                    } else {
                                        newSchedule[currentDateKey]['7pm'] = val;
                                        debugLog.push(`   ✅ Asignado [7pm]: "${val}"`);
                                    }
                                    // Stay in 7pm until we see non-S/D/C line
                                }

                            } else {
                                // 5am or 9am or Special
                                if (currentSlotIndex >= 4) return;

                                const slotName = slots[currentSlotIndex];
                                if (newSchedule[currentDateKey][slotName]) {
                                    // Conflict? Auto-increment to next?
                                    debugLog.push(`   ⚠️ Conflicto en [${slotName}] (ya tiene "${newSchedule[currentDateKey][slotName]}"). Pasando a siguiente.`);
                                    currentSlotIndex++;
                                    if (currentSlotIndex < 4) {
                                        newSchedule[currentDateKey][slots[currentSlotIndex]] = val;
                                        debugLog.push(`   ✅ Asignado [${slots[currentSlotIndex]}]: "${val}"`);
                                        updatesCount++;
                                    }
                                } else {
                                    newSchedule[currentDateKey][slotName] = val;
                                    debugLog.push(`   ✅ Asignado [${slotName}]: "${val}"`);
                                    updatesCount++;
                                    // Assume 1 line per slot for 5am/9am
                                    if (currentSlotIndex !== 2) currentSlotIndex++;
                                }
                            }
                        }
                    }
                });

                // Debug Summary in Alert (First 300 chars)
                const logSummary = debugLog.join('\n').substring(0, 500) + '...';

                // Update DB
                localStorage.setItem('nexus_schedule_db', JSON.stringify(newSchedule));

                // Cloud Sync
                if (window.DB) {
                    window.DB.saveSchedule(newSchedule)
                        .then(() => console.log("Schedule Saved to Cloud"))
                        .catch(err => alert("Error saving schedule to cloud: " + err.message));
                }

                // Force Refresh
                if (typeof loadWeeklyTable === 'function') loadWeeklyTable();
                if (typeof loadTodaySchedule === 'function') loadTodaySchedule();

                ocrStatus.innerHTML = `✅ Actualizado (${updatesCount} slots).`;
                alert(`¡Lectura Completa!\n\nReg: ${updatesCount}\n\nTRACE:\n${logSummary}`);

            } catch (err) {
                console.error(err);
                ocrStatus.innerHTML = '❌ Error: ' + err.message;
                alert('Error técnico: ' + err.message + '\n\n' + err.stack);
            }
        });
    }

    // Clear Schedule Button Logic
    const clearBtn = document.getElementById('clear-schedule-btn');
    if (clearBtn) {
        clearBtn.addEventListener('click', () => {
            if (confirm("¿Seguro que quieres borrar TODA la lista de oraciones?")) {
                localStorage.removeItem('nexus_schedule_db');
                if (typeof loadWeeklyTable === 'function') loadWeeklyTable();
                alert("Calendario borrado. Sube la foto nueva.");
            }
        });
    }

    // 4. View Schedule Logic (Admin) - HANDLED BY INLINE ONCLICK (window.manuallyOpenSchedule)
    /*
    const adminSchedBtn = document.getElementById('admin-view-schedule-btn');
    if (adminSchedBtn) {
        adminSchedBtn.addEventListener('click', () => { ... });
    }
    */

    // 4b. View Schedule Logic (User) - HANDLED BY INLINE ONCLICK
    /*
    const userSchedBtn = document.getElementById('user-view-schedule-btn');
    if (userSchedBtn) {
        userSchedBtn.addEventListener('click', () => { ... });
    }
    */

    // 2. Full Admin Registration
    const manualBtn = document.getElementById('manual-register-btn');
    // Admin Age Calc
    const adminDobInput = document.getElementById('admin-reg-dob');
    const adminAgeInput = document.getElementById('admin-reg-edad');

    if (adminDobInput && adminAgeInput) {
        adminDobInput.addEventListener('change', () => {
            const dob = new Date(adminDobInput.value);
            if (isNaN(dob.getTime())) { adminAgeInput.value = ''; return; }
            const today = new Date();
            let age = today.getFullYear() - dob.getFullYear();
            if (today.getMonth() < dob.getMonth() || (today.getMonth() === dob.getMonth() && today.getDate() < dob.getDate())) { age--; }
            adminAgeInput.value = age + " años";
        });
    }

    // CANCEL EDIT
    const cancelEditBtn = document.getElementById('cancel-edit-btn');
    if (cancelEditBtn) {
        cancelEditBtn.addEventListener('click', () => {
            document.getElementById('admin-reg-nombre').value = '';
            document.getElementById('admin-reg-paterno').value = '';
            document.getElementById('admin-reg-materno').value = '';
            document.getElementById('admin-reg-celular').value = '';
            document.getElementById('admin-reg-colonia').value = '';
            document.getElementById('admin-reg-dob').value = '';
            if (adminAgeInput) adminAgeInput.value = '';

            document.getElementById('editing-user-id').value = '';
            document.getElementById('manual-register-btn').textContent = "REGISTRAR HERMANO";
            cancelEditBtn.classList.add('hidden');
        });
    }

    // GLOBAL EDIT FUNCTION (Called from HTML)
    window.editUser = function (userId) {
        const users = JSON.parse(localStorage.getItem('nexus_users') || '[]');
        const user = users.find(u => u.id === userId);
        if (!user) return alert("Usuario no encontrado");

        // Split Name
        const parts = user.full_name.split(' ');
        const nombre = parts[0] || '';
        const paterno = parts[1] || '';
        const materno = parts.slice(2).join(' ') || '';

        document.getElementById('admin-reg-nombre').value = nombre;
        document.getElementById('admin-reg-paterno').value = paterno;
        document.getElementById('admin-reg-materno').value = materno;
        document.getElementById('admin-reg-celular').value = user.phone;
        document.getElementById('admin-reg-colonia').value = user.colonia || '';
        document.getElementById('admin-reg-dob').value = user.dob || '';
        const ageEl = document.getElementById('admin-reg-edad');
        if (ageEl) {
            ageEl.value = user.age_label || '';
            // Trigger calc if needed
            document.getElementById('admin-reg-dob').dispatchEvent(new Event('change'));
        }

        document.getElementById('editing-user-id').value = user.id;
        document.getElementById('manual-register-btn').textContent = "GUARDAR CAMBIOS";
        document.getElementById('cancel-edit-btn').classList.remove('hidden');

        // Scroll to Form
        document.getElementById('admin-panel').scrollTo({ top: 300, behavior: 'smooth' }); // Approx
    };

    // REMOVE FRAGILE LISTENER - USE DELEGATION
}

// ---------------------------------------------------------
// GLOBAL DELEGATION FOR MANUAL REGISTER (FIXED)
// ---------------------------------------------------------
document.addEventListener('click', (e) => {
    // Manual Register Button
    if (e.target && e.target.id === 'manual-register-btn') {
        e.preventDefault(); // Stop form submission if any
        // Remove focus from any active input to prevent double-firing events (if that's the cause)
        if (document.activeElement) document.activeElement.blur();
        handleManualRegister();
    }
});

function handleManualRegister() {
    const nombre = document.getElementById('admin-reg-nombre').value.trim();
    const paterno = document.getElementById('admin-reg-paterno').value.trim();
    const materno = document.getElementById('admin-reg-materno').value.trim();
    const celular = document.getElementById('admin-reg-celular').value.trim();
    const colonia = document.getElementById('admin-reg-colonia').value.trim();
    const dobVal = document.getElementById('admin-reg-dob').value;
    const ageLabel = document.getElementById('admin-reg-edad').value;
    let password = document.getElementById('admin-reg-pass').value.trim();

    const editingId = document.getElementById('editing-user-id').value;

    if (!nombre) {
        return alert('El campo "Nombre" es obligatorio (los demás son opcionales).');
    }

    if (!password) password = '1234';

    const fullName = `${nombre} ${paterno} ${materno}`.trim();
    let users = JSON.parse(localStorage.getItem('nexus_users') || '[]');

    if (editingId) {
        // EDIT EXISTING
        const userIndex = users.findIndex(u => u.id === editingId);
        if (userIndex !== -1) {
            users[userIndex].full_name = fullName;
            users[userIndex].phone = celular;
            users[userIndex].colonia = colonia;
            users[userIndex].dob = dobVal;
            users[userIndex].age_label = ageLabel;
            if (password !== '1234') users[userIndex].password = password;

            alert(`✅ Usuario actualizado: ${fullName}`);
        } else {
            alert("Error: Usuario no encontrado.");
        }
    } else {
        // CREATE NEW
        // Check duplicate ONLY if phone provided
        if (celular && users.find(u => u.phone === celular)) {
            return alert('Ya existe un usuario con este celular.');
        }

        const newUser = {
            id: 'user-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
            phone: celular,
            password: password,
            role: 'user',
            full_name: fullName,
            colonia: colonia,
            age_label: ageLabel,
            dob: dobVal,
            createdAt: new Date().toISOString()
        };

        // SAVE LOCAL
        users.push(newUser);
        localStorage.setItem('nexus_users', JSON.stringify(users));

        // SYNC TO CLOUD
        if (window.DB) {
            window.DB.registerUser(newUser)
                .then(() => alert(`✅ Registrado y Sincronizado: ${fullName}`))
                .catch(err => alert(`⚠️ Guardado local, pero error en nube: ${err.message}`));
        } else {
            alert(`✅ Usuario registrado (Local): ${fullName}`);
        }
    }

    // Refresh List
    if (typeof renderAdminUserList === 'function') renderAdminUserList();

    // Reset Form
    document.getElementById('admin-manual-form').classList.add('hidden');
    document.getElementById('admin-reg-nombre').value = '';
    document.getElementById('admin-reg-paterno').value = '';
    document.getElementById('admin-reg-materno').value = '';
    document.getElementById('admin-reg-celular').value = '';
    document.getElementById('admin-reg-colonia').value = '';

    document.getElementById('admin-reg-dob').value = '';
    const aa = document.getElementById('admin-reg-edad');
    if (aa) aa.value = '';
    document.getElementById('admin-reg-pass').value = '';

    // Reset Edit Mode
    document.getElementById('editing-user-id').value = '';
    document.getElementById('manual-register-btn').textContent = "REGISTRAR HERMANO";
    document.getElementById('cancel-edit-btn').classList.add('hidden');

    // Refresh List
    if (typeof populateUserSelect === 'function') populateUserSelect();
    if (typeof renderAdminUserList === 'function') renderAdminUserList();
}

// 3. Attendance Manager Logic
const serviceFilterSelect = document.getElementById('admin-service-filter');
const statusFilterSelect = document.getElementById('admin-status-filter');
const searchInput = document.getElementById('admin-search-user');

if (serviceFilterSelect) {
    serviceFilterSelect.addEventListener('change', renderAdminUserList);
    if (statusFilterSelect) statusFilterSelect.addEventListener('change', renderAdminUserList);
    searchInput.addEventListener('input', renderAdminUserList);

    // AUTO-SELECT CURRENT SLOT
    try {
        const now = new Date();
        const { slotId } = getServiceSlot(now);
        // Map slotId to options if possible, or just select 'all' if no match/not found
        // The options in HTML are likely: all, 5am, 9am, 6pm.
        // getServiceSlot returns '5am', '9am', '18pm' (check this!)?
        // Let's assume standard IDs.

        // We need to match the SELECT options.
        // Let's quickly verify options. If no match, default 'all'.
        if (slotId) {
            // Check if option exists
            if (serviceFilterSelect.querySelector(`option[value="${slotId}"]`)) {
                serviceFilterSelect.value = slotId;
            }
        }
    } catch (e) { console.warn("Auto-select slot failed", e); }
}

renderAdminUserList();

function renderAdminUserList() {
    console.log("Rendering Admin List...");
    try {
        const listContainer = document.getElementById('admin-user-list');
        if (!listContainer) {
            alert("FATAL: No se encontró el contenedor admin-user-list");
            return;
        }

        const countSpan = document.getElementById('attendance-count');
        const searchInput = document.getElementById('admin-search-user');
        const serviceProps = document.getElementById('admin-service-filter');

        const searchVal = searchInput ? searchInput.value.toLowerCase() : '';
        const filterVal = serviceProps ? serviceProps.value : 'all';

        if (!listContainer) return;

        let users = JSON.parse(localStorage.getItem('nexus_users') || '[]');
        let log = JSON.parse(localStorage.getItem('nexus_attendance_log') || '[]');

        if (!Array.isArray(users)) users = [];
        if (!Array.isArray(log)) log = [];

        // SAFETY: Filter out bad records (null IDs)
        users = users.filter(u => u && u.id && u.id !== 'null');


        if (!Array.isArray(log)) log = [];

        // Today check (Local YYYY-MM-DD)
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const todayLocal = `${year}-${month}-${day}`;

        // Get Active Slot for auto-filtering
        let { slotId: currentSlotId, isOpen } = getServiceSlot(now);
        let targetSlotId = currentSlotId;

        // CRITICAL UPDATE: If service is CLOSED, we usually want a "clean list".
        // BUT if Admin manually registers someone for an UPCOMING service (or just finished one), they want to see it green.
        // So, if !isOpen, we try to guess the "Relevant Manual Slot".
        if (!isOpen) {
            // Check if we are "pre-service" (e.g. 30 mins before next one) or "post-service" logic is handled by getServiceSlot usually returning 'general'.
            // Let's iterate through slots to find the Next one today?
            // Simple heuristic used by User: "Marked manually -> Green".
            // If manual attendance is for "7pm", and we are at "5pm", we want to see it.
            // If manual attendance is for "5am" (passed), do we show it? User said "limpia la lista".

            // LOGIC: If 'All' is selected, show Green for ANY entry that matches 'Today' AND is NOT a 'past' service?
            // No, that's hard to define.
            // BETTER: Show Green for the NEAREST FUTURE slot if closed.
            // And if manual is entered, it usually matches a real slot ID.

            // QUICK IMPLEMENTATION: 
            // If !isOpen, we look for the next slot.
            // (Re-using getServiceSlot logic bits or just hardcoding the cycle for robustness)
            // Actually, let's just use a loose matching for manual entries:
            // "If !isOpen, show Green if entry.timestamp is created within last 2 hours?" 
            // No, that's messy.

            // Let's stick to the "Upcoming/Active" rule.
            // If !isOpen, find next slot.
            const hour = now.getHours() + (now.getMinutes() / 60);

            // Simple Lookahead (Matches getServiceSlot logic roughly)
            if (hour < 5) targetSlotId = '5am';
            else if (hour < 9) targetSlotId = '9am'; // After 5am ends
            else if (hour < 10) targetSlotId = '10am_dom'; // Sunday? Logic complex.
            else if (hour < 18) {
                // Afternoon lull. Target evening service.
                const day = now.getDay();
                if (day === 4) targetSlotId = '6pm_jue';
                else if (day === 0) targetSlotId = '6pm_dom';
                else targetSlotId = '7pm';
            }
            // If it's late night (after 9pm), targetSlotId might be '5am' tomorrow? 
            // But we filter by Today's date, so '5am' attendance for Today (past) would show? 
            // This contradicts "Clean list". 
            // If I look at 10PM, and target is 'tomorrow', then today's 5am is NOT next. 
            // So if I set targetSlotId = 'general' (default), nobody is green.
            // The User wants to see MANUAL adds. Manual adds usually require picking a specific slot.
            // If they pick "7pm" and it is 5pm, it will show if we set target = '7pm'.
        }

        // Build map of who attended TODAY, specific to the filter
        const attendeesMap = new Map(); // userId -> attendanceEntry
        const currentFilter = serviceProps ? serviceProps.value : 'all';

        log.forEach(entry => {
            // Filter by Date (Today Local)
            if (!entry || !entry.timestamp) return;

            const entryDate = new Date(entry.timestamp);
            const eYear = entryDate.getFullYear();
            const eMonth = String(entryDate.getMonth() + 1).padStart(2, '0');
            const eDay = String(entryDate.getDate()).padStart(2, '0');
            const entryLocal = `${eYear}-${eMonth}-${eDay}`;

            if (entryLocal !== todayLocal) return;

            // Filter logic
            if (currentFilter !== 'all') {
                // Manual filter active: Show whomever attended that specific slot
                if (entry.serviceSlot !== currentFilter) return;
            } else {
                // Default 'All' view:
                if (isOpen) {
                    // OPEN: Strict check for CURRENT slot.
                    if (entry.serviceSlot !== currentSlotId) return;
                } else {
                    // CLOSED: "Clean List" preference vs "See Manual" preference.
                    // Compromise: Match the Target (Upcoming) slot.
                    if (entry.serviceSlot !== targetSlotId) return;
                }
            }

            attendeesMap.set(String(entry.userId), entry);
        });

        const attendedIds = new Set(attendeesMap.keys());

        // Sort (SAFE)
        users.sort((a, b) => {
            const nameA = a.full_name || a.name || 'Sin Nombre';
            const nameB = b.full_name || b.name || 'Sin Nombre';
            return nameA.localeCompare(nameB);
        });

        const filteredUsers = users.filter(u => {
            if (u.role === 'admin') return false;
            const name = (u.full_name || u.name || '').toLowerCase();
            const matchesSearch = name.includes(searchVal);
            return matchesSearch;
        });

        // UPDATE DOM COUNT
        // In order to get the correct view count, we need to count how many elements we ACTUALLY rendered vs total users.
        // We defer count update to the end, but wait, count is total attendees vs total members today.
        const totalAttendeesForFilter = attendedIds.size;
        const totalUserCount = users.filter(u => u.role !== 'admin').length;
        if (countSpan) countSpan.textContent = `${totalAttendeesForFilter}/${totalUserCount}`;

        if (totalUserCount === 0) {
            listContainer.innerHTML = '<p style="text-align:center; color:#666; padding:20px;">No hay hermanos registrados.</p>';
            return;
        }

        if (filteredUsers.length === 0) {
            listContainer.innerHTML = '<p style="text-align:center; color:#999; padding:20px;">Sin resultados de búsqueda.</p>';
            return;
        }

        filteredUsers.forEach(u => {
            // CRITICAL FIX: Use ID if available, fallback to phone (legacy), but ID is safer for manual users without phone.
            // Reg users have ID. 
            // IMPORTANT: If u.phone is undefined and entry.userId is undefined, they match! Strict check needed.
            const uid = u.id || u.phone;

            let isPresent = false;
            let entry = null;

            if (uid) {
                // FORCE STRING COMPARISON
                const sUid = String(uid);

                // Check direct or stringified key
                if (attendedIds.has(sUid)) {
                    isPresent = true;
                    entry = attendeesMap.get(sUid);
                } else if (attendedIds.has(Number(sUid))) {
                    // Fallback for number keys
                    isPresent = true;
                    entry = attendeesMap.get(Number(sUid));
                }
            } else {
                // If user has NO ID and NO PHONE, they cannot be tracked. Skip log matching.
                // console.warn("User without ID or Phone found in list", u);
            }

            // Apply Status Filter
            if (currentStatusFilter === 'present' && !isPresent) return;
            if (currentStatusFilter === 'absent' && isPresent) return;

            const div = document.createElement('div');
            div.className = 'user-list-item';
            div.style.display = 'flex';
            div.style.alignItems = 'center';
            div.style.padding = '4px 8px'; // Reduced Padding
            div.style.borderBottom = '1px solid #eee';
            div.style.background = isPresent ? '#f0fff4' : '#fff';

            // Avatar (Smaller)
            const avatarName = (u.full_name || 'U').replace(/ /g, '+');
            const isPresentColor = isPresent ? '2ecc71' : 'dddddd'; // Hex without #
            const avatarSrc = u.photo_url || `https://ui-avatars.com/api/?name=${avatarName}&background=${isPresentColor}&color=fff&bold=true`;

            // Status Text (Smaller)
            const statusText = isPresent ?
                `<span style="color:green; font-weight:bold; font-size:0.75rem;">✅ ${entry.serviceName || 'Asistió'}</span>` :
                `<span style="color:#bbb; font-size:0.75rem;">Falta</span>`;

            div.innerHTML = `
                    <div onclick="if(window.openAdminMemberModal) window.openAdminMemberModal('${uid}')" style="display:flex; align-items:center; flex:1; cursor:pointer;" title="Ver Perfil">
                        <img src="${avatarSrc}" style="width:28px; height:28px; border-radius:50%; object-fit:cover; border:1px solid ${isPresent ? 'var(--success)' : '#ddd'}; margin-right:8px; background:#fff;" alt="Avatar">
                        <div style="flex:1;">
                            <h4 style="margin:0; font-size:0.85rem; line-height:1.2;">${u.full_name || u.name}</h4>
                            <small style="color:#888; font-size:0.75rem;">ID: ${u.phone}</small>
                        </div>
                    </div>
                    <div style="text-align:right;">
                        ${statusText}
                    </div>
                `;

            if (isPresent) {
                const undoBtn = document.createElement('button');
                undoBtn.innerHTML = '<i class="ri-delete-bin-line"></i>';
                undoBtn.className = 'cyber-btn sm danger';
                undoBtn.style.padding = '2px 8px';
                undoBtn.style.marginLeft = '5px';
                undoBtn.title = "Quitar Asistencia";
                undoBtn.onclick = () => {
                    if (!confirm("¿Quitar asistencia de hoy para este hermano?")) return;

                    const todayISO = new Date().toISOString().split('T')[0];

                    // 1. Identify entries to remove
                    const entriesToRemove = log.filter(e => {
                        if (e.userId !== uid) return false;
                        if (!e.timestamp.startsWith(todayISO)) return false;
                        if (currentFilter !== 'all' && e.serviceSlot !== currentFilter) return false;
                        return true;
                    });

                    // 2. Remove from Local Log
                    const newLog = log.filter(e => !entriesToRemove.includes(e));
                    localStorage.setItem('nexus_attendance_log', JSON.stringify(newLog));

                    // 3. Remove from Cloud (Iterate in case of multiple slots in 'all' view)
                    if (window.DB) {
                        entriesToRemove.forEach(entry => {
                            const logId = entry.id || null;
                            window.DB.removeAttendance(uid, entry.serviceSlot, todayISO, logId)
                                .catch(err => console.error("Cloud delete error:", err)); // Passive error to not block UI
                        });
                    }

                    renderAdminUserList();
                    showToast("Asistencia eliminada (Nube y Local)", "warning");
                };
                div.appendChild(undoBtn);
            } else {
                const markBtn = document.createElement('button');
                markBtn.textContent = 'ASISTIR';
                markBtn.className = 'cyber-btn sm';
                markBtn.style.padding = '2px 8px';
                markBtn.style.marginLeft = '5px';
                markBtn.style.fontSize = '0.7rem';
                markBtn.onclick = () => {
                    openServiceModal((selectedSlot, selectedName) => {
                        const currentLog = JSON.parse(localStorage.getItem('nexus_attendance_log') || '[]');
                        const already = currentLog.find(e => e.userId === uid && e.serviceSlot === selectedSlot && e.timestamp.startsWith(new Date().toISOString().split('T')[0]));

                        if (already) {
                            if (confirm(`¿QUISTAR ASISTENCIA de ${u.full_name || u.name} para ${selectedName}?`)) {
                                // REMOVE LOCAL
                                const idx = currentLog.findIndex(e => e === already);
                                if (idx > -1) currentLog.splice(idx, 1);
                                localStorage.setItem('nexus_attendance_log', JSON.stringify(currentLog));

                                // REMOVE CLOUD
                                if (window.DB) {
                                    // Pass ID if available for robust delete
                                    const logId = already.id || null;
                                    window.DB.removeAttendance(uid, selectedSlot, new Date().toISOString().split('T')[0], logId)
                                        .catch(err => alert("Error borrando de nube: " + err.message));
                                }

                                renderAdminUserList();
                                showToast(`🗑️ Asistencia Eliminada`, "warning");
                            }
                            return;
                        }

                        currentLog.push({
                            userId: uid, // Use ID!
                            name: u.full_name || u.name, // Snapshot name logic
                            timestamp: new Date().toISOString(),
                            method: 'manual_admin',
                            serviceSlot: selectedSlot,
                            serviceName: selectedName
                        });

                        // SUPABASE SYNC
                        if (window.DB) {
                            window.DB.logAttendance({
                                userId: uid,
                                name: u.full_name || u.name,
                                method: 'manual_admin',
                                serviceSlot: selectedSlot,
                                serviceName: selectedName,
                                timestamp: new Date().toISOString()
                            }).catch(console.error);
                        }
                        localStorage.setItem('nexus_attendance_log', JSON.stringify(currentLog));
                        renderAdminUserList();
                        showToast(`✅ Asistencia: ${selectedName}`, "success");
                    });
                };
                div.appendChild(markBtn);
            }

            // HISTORY BUTTON
            const histBtn = document.createElement('button');
            histBtn.innerHTML = '<i class="ri-time-line"></i>';
            histBtn.className = 'cyber-btn sm secondary';
            histBtn.style.padding = '2px 8px';
            histBtn.style.marginLeft = '5px';
            histBtn.onclick = () => showUserHistory(u);
            div.appendChild(histBtn);

            // DELETE BUTTON (To kill Zombies)
            const delBtn = document.createElement('button');
            delBtn.innerHTML = '<i class="ri-close-circle-line"></i>';
            delBtn.className = 'cyber-btn sm danger';
            delBtn.style.padding = '2px 8px';
            delBtn.style.marginLeft = '5px';
            delBtn.title = "Eliminar Usuario (Nube y Local)";
            delBtn.onclick = async (e) => {
                e.stopPropagation();
                if (confirm(`⚠️ PELIGRO ⚠️\n\n¿Seguro que quieres ELIMINAR A ${u.full_name || u.name}?\n\n- Se borrará de la lista LOCAL.\n- Se borrará de la NUBE (Supabase).\n- Se borrará su historial.\n\nEsta acción no se puede deshacer.`)) {
                    try {
                        // 1. Delete from Cloud
                        if (window.DB && window.DB.deleteUser) {
                            // PASS ID AND PHONE to ensure we catch Zombies with same phone but different ID
                            await window.DB.deleteUser(uid, u.phone);
                            showToast("🗑️ Eliminado de Nube");
                        }

                        // 2. Delete from Local
                        const currentUsers = JSON.parse(localStorage.getItem('nexus_users') || '[]');
                        // Filter by ID AND Phone to be sure
                        const newUsers = currentUsers.filter(user => user.id !== uid && user.phone !== u.phone);
                        localStorage.setItem('nexus_users', JSON.stringify(newUsers));

                        // 3. Remove Logs
                        const currentLog = JSON.parse(localStorage.getItem('nexus_attendance_log') || '[]');
                        const newLog = currentLog.filter(l => l.userId !== uid && l.userId !== u.phone);
                        localStorage.setItem('nexus_attendance_log', JSON.stringify(newLog));

                        renderAdminUserList();
                        showToast("✅ Usuario Eliminado Completo");
                    } catch (err) {
                        alert("Error eliminando: " + err.message);
                    }
                }
            };
            div.appendChild(delBtn);

            listContainer.appendChild(div);
        });
    } catch (e) {
        console.error(e);
        alert("Error cargando lista admin: " + e.message);
    }
}


// Toast Notification System
window.showToast = function (msg, type = 'success') {
    const toast = document.createElement('div');
    toast.textContent = msg;
    toast.style.position = 'fixed';
    toast.style.bottom = '20px';
    toast.style.left = '50%';
    toast.style.transform = 'translateX(-50%)';
    toast.style.background = type === 'error' ? 'var(--danger)' : (type === 'warning' ? '#f59e0b' : 'var(--success)');
    toast.style.color = 'white';
    toast.style.padding = '10px 20px';
    toast.style.borderRadius = '30px';
    toast.style.zIndex = '5000';
    toast.style.boxShadow = '0 4px 6px rgba(0,0,0,0.2)';
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
};

function showUserHistory(user) {
    const log = JSON.parse(localStorage.getItem('nexus_attendance_log') || '[]');
    // Match ID or Phone (Legacy)
    const uid = user.id || user.phone;
    const history = log.filter(e => e.userId === uid || (user.phone && e.userId === user.phone));

    if (history.length === 0) {
        alert(`Historial de ${user.full_name || user.name}:\n\nSin asistencias registradas.`);
        return;
    }


    // Sort new to old
    history.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    const report = history.map(h => {
        const date = new Date(h.timestamp);
        const dateStr = date.toLocaleDateString();
        const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        return `📅 ${dateStr} ${timeStr} - ${h.serviceName || h.serviceSlot || 'Desconocido'} (${h.method === 'manual_admin' ? 'Manual' : 'Escáner'})`;
    }).join('\n');

    alert(`Historial de ${user.full_name || user.name} (${history.length}):\n\n${report}`);
}

function populateUserSelect() {
    const select = document.getElementById('user-select-list');
    if (!select) return;

    const users = JSON.parse(localStorage.getItem('nexus_users') || '[]');
    select.innerHTML = '<option value="">-- Seleccionar Hermano --</option>';

    users.forEach(u => {
        if (u.role === 'admin') return;
        const opt = document.createElement('option');
        opt.value = u.phone;
        opt.textContent = u.name;
        select.appendChild(opt);
    });
}



// --- DOM ELEMENTS ---
// (Defined inside initApp or lazily)

// --- INITIALIZATION ---
// --- INITIALIZATION ---
async function initApp() {
    console.log("Initializing App...");
    // alert("DEBUG: initApp Running"); // CONFIRMED RUNNING

    // 1. IMMEDIATE SESSION RESTORE (Sticky Login)
    // We check this FIRST so user sees Dashboard immediately, without waiting for Cloud.
    const activeSession = localStorage.getItem('nexus_session');
    const accountData = localStorage.getItem('nexus_account');

    console.log(`🔍 Init Check: Session=${activeSession}, Account=${accountData ? 'YES' : 'NO'}`);

    let userLoggedIn = false;

    if (accountData) {
        try {
            const user = JSON.parse(accountData);
            STATE.user = user;

            // Self-Healing
            if (activeSession !== 'active') {
                localStorage.setItem('nexus_session', 'active');
            }

            console.log("✅ Auto-Login Successful (Local):", user.full_name);
            showDashboard(user);
            userLoggedIn = true;
        } catch (e) {
            console.error("Session Corrupt:", e);
            localStorage.removeItem('nexus_session');
            localStorage.removeItem('nexus_account');
        }
    }

    // 2. CLOUD SYNC (Background)
    // Only block if NOT logged in, so we can check if user exists in cloud for Login/Register decision.
    // If logged in, we sync in background.

    if (!userLoggedIn) {
        // Not logged in? We MUST wait to see if we have users to decide Login vs Register
        // But we can check local users first to be fast.
        const localUsers = JSON.parse(localStorage.getItem('nexus_users') || '[]');
        if (localUsers.length > 0) {
            showLogin();
        } else {
            // No local data, maybe fresh install. Wait a bit for cloud.
            // But don't block forever.
        }
    }

    // Now start the Sync Process (Async)
    (async () => {
        // Wait for Supabase Client (Non-blocking for Dashboard)
        let attempts = 0;
        while (!window.sbClient && attempts < 10) {
            await new Promise(r => setTimeout(r, 500));
            attempts++;
        }

        if (window.DB && window.sbClient) {
            try {
                console.log("☁️ Syncing metadata from Cloud...");
                const users = await window.DB.fetchAllUsers();
                const attendance = await window.DB.fetchTodayAttendance();
                const cloudSchedule = await window.DB.fetchSchedule();
                const cloudTheme = await window.DB.fetchConfig('weekly_theme');
                const cloudLoc = await window.DB.fetchConfig('church_location');

                // Update Location (FIX v6.30 - HARDCODED OVERRIDE)
                /* 
                if (cloudLoc && cloudLoc.lat && cloudLoc.lng) {
                    console.log("📍 Location synced from Cloud:", cloudLoc);
                    STATE.targetLocation = cloudLoc;
                }
                */
                // Update Location (FIX v6.24)
                if (cloudLoc && cloudLoc.lat && cloudLoc.lng) {
                    console.log("📍 Location synced from Cloud:", cloudLoc);
                    STATE.targetLocation = cloudLoc;

                    // Persist to local settings
                    const settings = JSON.parse(localStorage.getItem('nexus_settings') || '{}');
                    settings.targetLocation = cloudLoc;
                    localStorage.setItem('nexus_settings', JSON.stringify(settings));
                }

                // Update Users
                if (users && users.length > 0) {
                    localStorage.setItem('nexus_users', JSON.stringify(users));

                    // UX FIX: If we are on Register screen (default) and we found users, switch to Login!
                    // This handles the "Fresh Load" case where we didn't know we had users yet.
                    if (!userLoggedIn) {
                        const currentSection = document.querySelector('.active-section');
                        if (currentSection && currentSection.id === 'register-section') {
                            console.log("🔄 Users found in Cloud -> Switching to Login");
                            showLogin();
                        }
                    }
                }

                // Update Attendance
                if (attendance && attendance.length > 0) {
                    localStorage.setItem('nexus_attendance_log', JSON.stringify(attendance));
                }

                // Update Schedule
                if (cloudSchedule) {
                    localStorage.setItem('nexus_schedule_db', JSON.stringify(cloudSchedule));
                }

                // Update Theme
                if (cloudTheme) {
                    localStorage.setItem('nexus_theme', cloudTheme.text);
                    if (typeof loadTheme === 'function') loadTheme();
                }

                // Trigger UI Refresh if on Dashboard using the new data
                if (userLoggedIn) {
                    // Refresh Admin List if active
                    if (typeof renderAdminUserList === 'function' && document.getElementById('admin-panel') && !document.getElementById('admin-panel').classList.contains('hidden')) {
                        renderAdminUserList();
                    }
                } else {
                    // If we were waiting on Register screen, maybe now we have users?
                    // Re-evaluate
                    const updatedUsers = JSON.parse(localStorage.getItem('nexus_users') || '[]');
                    if (updatedUsers.length > 0 && !document.getElementById('login-section').classList.contains('active-section')) {
                        // Only switch if we are not already in a specific flow? 
                        // Safer to just let user navigate using the buttons.
                        // But we can enable login if it was hidden.
                    }
                }

                // Start Realtime
                // Start Realtime
                // Start Realtime
                const startRealtime = () => {
                    // 1. Setup Global User Listener (handled internally by supabase-service)
                    window.onUserUpdate = (newUser) => {
                        console.log("👤 User Update Root:", newUser);
                        // Refresh Admin User List if needed
                        if (typeof renderAdminUserList === 'function' && document.getElementById('admin-panel') && !document.getElementById('admin-panel').classList.contains('hidden')) {
                            renderAdminUserList();
                        }
                    };

                    // 2. Subscribe to Logs and Config
                    window.DB.subscribeToChanges(
                        (newLog) => {
                            console.log("🔔 Realtime Attendance:", newLog);
                            // 1. Update Local Log (to match report)
                            const currentLog = JSON.parse(localStorage.getItem('nexus_attendance_log') || '[]');
                            // Avoid dupes
                            if (!currentLog.find(e => e.id === newLog.id || (e.timestamp === newLog.timestamp && e.userId === newLog.user_phone))) {
                                currentLog.push({
                                    userId: newLog.user_phone,
                                    name: newLog.user_name,
                                    timestamp: newLog.timestamp,
                                    method: newLog.method,
                                    serviceSlot: newLog.service_slot,
                                    serviceName: newLog.service_name,
                                    id: newLog.id
                                });
                                localStorage.setItem('nexus_attendance_log', JSON.stringify(currentLog));
                            }

                            // 2. Refresh Admin UI (Green Status)
                            if (typeof renderAdminUserList === 'function' &&
                                document.getElementById('admin-panel') &&
                                !document.getElementById('admin-panel').classList.contains('hidden')) {
                                renderAdminUserList();
                            }

                            // 3. Refresh User UI (If it's me!)
                            if (window.updateCheckInStatus) window.updateCheckInStatus();
                        },
                        (newConfig) => {
                            console.log("🔔 Realtime Config Update:", newConfig);
                            if (newConfig.key === 'church_location') {
                                // SKIP CLOUD SYNC IF HARDCODED
                                // console.log("📍 Cloud Location Update Ignored (Hardcoded Mode)");
                            }
                            if (newConfig.key === 'weekly_theme') {
                                console.log("🎨 Updating Theme from Cloud", newConfig.value);
                                // Handle both Object {text: "..."} and String "..."
                                const text = (typeof newConfig.value === 'object' && newConfig.value.text)
                                    ? newConfig.value.text
                                    : newConfig.value;

                                localStorage.setItem('nexus_theme', text);
                                if (typeof loadTheme === 'function') loadTheme();
                            }
                        }
                    );
                };
                startRealtime();

            } catch (e) {
                console.warn("⚠️ Cloud Sync Warning:", e);
            }
        }
    })();
}
// [Orphaned Session Logic Removed v6.23]

// BIND EVENTS ON DOM CONTENT LOADED
document.addEventListener('DOMContentLoaded', () => {
    console.log("DOM Loaded - Binding Events");

    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    const fingerprintBtn = document.getElementById('check-in-btn');
    const showLoginBtn = document.getElementById('show-login');
    const showRegisterBtn = document.getElementById('show-register');
    const dobInput = document.getElementById('reg-dob');
    const logoutBtn = document.getElementById('logout-btn');

    if (loginForm) loginForm.addEventListener('submit', handleLogin);

    if (showLoginBtn) showLoginBtn.addEventListener('click', (e) => { e.preventDefault(); showLogin(); });
    if (showRegisterBtn) showRegisterBtn.addEventListener('click', (e) => { e.preventDefault(); showRegister(); });

    if (fingerprintBtn) {
        // GPS Permission Nudge
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                () => console.log("GPS Access Granted"),
                (err) => {
                    console.warn("GPS Access Denied/Error", err);
                    alert("⚠️ ATENCIÓN: La app necesita acceso a tu GPS para registrar tu asistencia.\n\nPor favor, permite el acceso a la ubicación cuando el navegador te lo pida.");
                },
                { enableHighAccuracy: true, timeout: 5000 }
            );
        }
    }

    // CHECK-IN BUTTON LOGIC
    if (fingerprintBtn) {
        // UI State Updater
        // UI State Updater (Rewritten v6.47)
        window.updateCheckInStatus = function () {
            if (!STATE.user) return; // Guard: Must be logged in

            const now = new Date();
            const { isOpen, slotId, slotName } = getServiceSlot(now);

            // 1. Persistence Check
            const log = JSON.parse(localStorage.getItem('nexus_attendance_log') || '[]');
            const todayISO = now.toISOString().split('T')[0];

            const hasAttended = log.find(e =>
                e.userId === STATE.user.phone &&
                e.timestamp.startsWith(todayISO) &&
                e.serviceSlot === slotId
            );

            const btnContainer = document.querySelector('.fingerprint-container');
            const instruction = document.querySelector('.instruction-text');
            const messageDiv = document.querySelector('.geofence-message');
            const icon = document.querySelector('.fingerprint-icon');

            if (hasAttended && isOpen) {
                // SUCCESS STATE
                if (btnContainer) {
                    btnContainer.className = 'fingerprint-container success-state';
                    btnContainer.classList.remove('hidden-geo');
                    btnContainer.style.opacity = '1';
                    btnContainer.style.cursor = 'pointer';
                }
                if (instruction) {
                    instruction.innerHTML = `✅ ASISTENCIA REGISTRADA<br><small>${slotName || 'Culto'}</small>`;
                    instruction.classList.remove('hidden');
                    instruction.className = "instruction-text success-text";
                    instruction.style.color = "var(--success)";
                }
                if (messageDiv) messageDiv.style.display = 'none';
                return; // EXIT
            }

            // 2. Geofence & Service Logic
            const inFence = STATE.inGeofence || (STATE.user && STATE.user.role === 'admin');

            if (isOpen && inFence) {
                // READY TO SCAN
                if (btnContainer) {
                    btnContainer.className = 'fingerprint-container active scanning ready-glow';
                    btnContainer.classList.remove('hidden-geo');
                    btnContainer.style.opacity = '1';
                    btnContainer.style.cursor = 'pointer';
                    btnContainer.style.pointerEvents = 'auto';
                }
                if (instruction) {
                    instruction.textContent = "PRESIONA PARA REGISTRAR";
                    instruction.className = "instruction-text";
                    instruction.classList.remove('hidden');
                    instruction.style.color = "var(--primary-gold)";
                }
                if (messageDiv) messageDiv.style.display = 'none';

            } else if (isOpen && !inFence) {
                // OUT OF RANGE
                if (btnContainer) {
                    btnContainer.className = 'fingerprint-container';
                    btnContainer.classList.add('hidden-geo');
                }
                if (messageDiv) {
                    messageDiv.style.display = 'block';
                    messageDiv.innerHTML = `<i class="ri-map-pin-user-fill"></i> ACÉRCATE AL TEMPLO<br><small>Estás a ${Math.round(STATE.distance || 0)}m</small>`;
                }
                if (instruction) instruction.classList.add('hidden');
                if (icon) {
                    icon.className = "ri-fingerprint-line fingerprint-icon";
                    icon.style.color = "";
                }

            } else {
                // CLOSED
                if (btnContainer) {
                    btnContainer.className = 'fingerprint-container';
                    btnContainer.classList.add('hidden-geo');
                }
                if (messageDiv) messageDiv.style.display = 'none';
                if (instruction) {
                    instruction.innerHTML = "No hay servicio activo en este momento.";
                    instruction.classList.remove('hidden');
                    instruction.className = "instruction-text";
                    instruction.style.color = "var(--text-muted)";
                }
                if (icon) {
                    icon.className = "ri-fingerprint-line fingerprint-icon";
                    icon.style.color = "";
                }
            }
        };

        // Run update loop
        setInterval(updateCheckInStatus, 5000);

        fingerprintBtn.addEventListener('click', () => {
            // 0. Login Check
            if (!STATE.user) return showLogin();

            const now = new Date();
            const { slotId, slotName, isOpen } = getServiceSlot(now);

            // 1. Time Check
            if (!isOpen) {
                alert("⛔ FUERA DE HORARIO\n\nEl registro solo está activo 15 min antes y hasta 20 min después del culto.");
                return;
            }

            // 2. Geolocation Check
            // Bypass for Admin if needed? User didn't say. Let's enforce for everyone on this panel logic.
            if (!STATE.inGeofence) {
                // If mocked or 0,0, might be annoying.
                // Assuming STATE.inGeofence is correctly calculated in separate watcher.
                alert("📍 NO ESTÁS EN EL TEMPLO\n\nDebes estar dentro de las instalaciones para registrar asistencia.");
                return;
            }

            // 3. Check Previous Attendance (For THIS service)
            const log = JSON.parse(localStorage.getItem('nexus_attendance_log') || '[]');
            const todayISO = now.toISOString().split('T')[0];

            const hasAttendedService = log.find(e =>
                e.userId === STATE.user.phone &&
                e.timestamp.startsWith(todayISO) &&
                e.serviceSlot === slotId
            );

            if (hasAttendedService) {
                if (confirm(`⚠️ YA REGISTRADO\n\n¿Deseas CANCELAR tu asistencia de hoy para: ${slotName}?`)) {
                    // REMOVE LOCAL
                    const idx = log.findIndex(e => e === hasAttendedService);
                    if (idx > -1) log.splice(idx, 1);
                    localStorage.setItem('nexus_attendance_log', JSON.stringify(log));

                    // REMOVE CLOUD
                    if (window.DB) {
                        const logId = hasAttendedService.id || null;
                        window.DB.removeAttendance(STATE.user.phone, slotId, todayISO, logId)
                            .catch(console.error);
                    }

                    // UI UPDATE
                    alert("🗑️ Asistencia Cancelada.");
                    updateCheckInStatus();
                }
                return;
            }

            // 4. Register
            const confirmMsg = `¿Registrar asistencia para ${slotName}?`;
            if (confirm(confirmMsg)) {
                log.push({
                    userId: STATE.user.phone,
                    timestamp: new Date().toISOString(),
                    method: 'fingerprint_scan',
                    serviceSlot: slotId,
                    serviceName: slotName
                });
                // SUPABASE SYNC
                if (window.DB) {
                    try {
                        window.DB.logAttendance({
                            userId: STATE.user.phone,
                            name: STATE.user.full_name || STATE.user.name,
                            method: 'fingerprint_scan',
                            serviceSlot: slotId,
                            serviceName: slotName,
                            timestamp: new Date().toISOString()
                        });
                    } catch (e) {
                        console.error("Supabase Log Error", e);
                        // Continue to local storage even if online fails?
                    }
                }

                localStorage.setItem('nexus_attendance_log', JSON.stringify(log));

                // Success UI
                const successMsg = document.getElementById('success-message');
                const timeStamp = document.getElementById('time-stamp');
                if (successMsg) {
                    successMsg.classList.remove('hidden');
                    if (timeStamp) timeStamp.textContent = new Date().toLocaleTimeString();
                    setTimeout(() => successMsg.classList.add('hidden'), 3000);
                }
                alert("✅ ASISTENCIA REGISTRADA EXITOSAMENTE");

                // Refresh UI immediately
                updateCheckInStatus();
            }
        });
    }


    // Duplicate Register Logic Removed to Prevent Data Loss

    // Logout
    if (logoutBtn) {
        logoutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (confirm("¿Cerrar sesión?")) {
                localStorage.removeItem('nexus_session');
                localStorage.removeItem('nexus_account'); // FIXED: prevent auto-login
                STATE.user = null; // Clear state
                window.location.replace(window.location.pathname); // Hard redirect to force clean state without hash
            }
        });
    }

    // --- DEBUG BUTTON (To diagnose Cloud Sync) ---
    const debugBtn = document.createElement('button');
    debugBtn.innerHTML = '☁️ Checar Nube';
    debugBtn.className = 'cyber-btn sm secondary';
    debugBtn.style.cssText = "margin-top:10px; width:100%; background:#2c3e50;";
    debugBtn.onclick = async (e) => {
        e.preventDefault();
        debugBtn.innerText = "⏳ Buscando...";
        try {
            const users = await window.DB.fetchAllUsers();
            alert(`🔍 DIAGNÓSTICO NUBE:\n\nUsuarios Encontrados: ${users.length}\n\nSi es 0, hay un error de permisos.`);
            debugBtn.innerText = `✅ Encontrados: ${users.length}`;

            // If users found, force reload to let initApp handle it
            if (users.length > 0) {
                if (confirm("¡Datos encontrados! ¿Recargar para entrar?")) window.location.reload();
            }
        } catch (err) {
            alert("❌ ERROR CONEXIÓN: " + err.message);
            debugBtn.innerText = "❌ Error";
        }
    };
    // Append to Register Form container (bottom)
    if (registerForm) registerForm.parentElement.appendChild(debugBtn);
    // --- END DEBUG ---

    // Init Logic
    try {
        seedScheduleData();
        // UNSTUCK LOADING (Always run, even if init fails)
        initApp()
            .then(() => {
                initAdminFeatures();
            })
            .catch(err => {
                console.error("Init Failed:", err);
                alert("Error iniciando app: " + err.message);
            })
            .finally(() => {
                const loader = document.getElementById('loading-screen');
                if (loader) loader.style.display = 'none';
            });
    } catch (e) {
        console.error(e);
        alert("ERROR CRITICO AL INICIAR APP:\n" + e.message);
    }
});



/**
* LOGICA DE HORARIOS (CULTOS)
* Detecta qué culto es basado en la hora actual y el día.
* RETORNA: { slotId, slotName, isOpen, message }
* Reglas: Check-in permitido 15 min antes y 20 min después.
*/
function getServiceSlot(date) {
    const day = date.getDay(); // 0=Domingo, 1=Lunes, ... 4=Jueves, 6=Sabado
    const hour = date.getHours();
    const minutes = date.getMinutes();
    const timeVal = hour + (minutes / 60); // Hora decimal

    let slot = null;

    // DEFINICION DE HORARIOS (Inicio - Fin Real)
    // Se usa buffer: -15 min (start - 0.25) y +20 min (end + 0.33)

    // 5am (5:00 - 5:45) -> Ventana: 4:45 - 6:05 (4.75 - 6.08)
    // Pero el usuario dijo 5am termina 5:45.
    // Ventana Open: 4:45 am a 6:05 am.
    if (timeVal >= 4.75 && timeVal < 6.1) {
        slot = { id: '5am', name: 'Culto 5:00 AM' };
    }

    // 9am (9:00 - 10:00) -> Ventana: 8:45 - 10:20 (8.75 - 10.33)
    // Lunes a Sabado
    else if (day !== 0 && timeVal >= 8.75 && timeVal < 10.33) {
        slot = { id: '9am', name: 'Culto 9:00 AM' };
    }

    // Domingo 10am (10:00 - 12:20) -> Ventana: 9:45 - 12:40 (9.75 - 12.66)
    else if (day === 0 && timeVal >= 9.75 && timeVal < 12.66) {
        slot = { id: '10am_dom', name: 'Culto 10:00 AM (Dom)' };
    }

    // Jueves 6pm (18:00 - 20:30) -> Ventana: 17:45 - 20:50 (17.75 - 20.83)
    else if (day === 4 && timeVal >= 17.75 && timeVal < 20.83) {
        slot = { id: '6pm_jue', name: 'Culto 6:00 PM (Jue)' };
    }

    // Domingo 6pm (18:00 - 20:30) -> Ventana: 17:45 - 20:50 (17.75 - 20.83)
    else if (day === 0 && timeVal >= 17.75 && timeVal < 20.83) {
        slot = { id: '6pm_dom', name: 'Culto 6:00 PM (Dom)' };
    }

    // Otros dias 7pm (19:00 - 20:30) -> Ventana: 18:45 - 20:50 (18.75 - 20.83)
    else if (day !== 0 && day !== 4 && timeVal >= 18.75 && timeVal < 20.83) {
        slot = { id: '7pm', name: 'Culto 7:00 PM' };
    }

    if (slot) {
        return { slotId: slot.id, slotName: slot.name, isOpen: true };
    }

    // Si no cae en ninguna ventana
    return { slotId: 'general', slotName: 'Fuera de Horario', isOpen: false };
}

/**
 * HELPER: Calcular distancia entre dos coordenadas (Haversine)
 * Retorna metros.
 */
function getDistanceInMeters(lat1, lon1, lat2, lon2) {
    const R = 6371e3; // Radio tierra en metros
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
        Math.cos(φ1) * Math.cos(φ2) *
        Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
}





// ==========================================
// MÓDULO DE REPORTES (Excel y Estadísticas)
// ==========================================

window.toggleReportsModal = function () {
    const el = document.getElementById('reports-overlay');
    if (el) {
        if (el.classList.contains('hidden')) {
            el.classList.remove('hidden');
            el.style.display = 'flex'; // Ensure flex for centering
            setReportDate('today'); // Default to today
        } else {
            el.classList.add('hidden');
            el.style.display = 'none';
        }
    }
};

window.setReportDate = function (range) {
    const startEl = document.getElementById('report-start');
    const endEl = document.getElementById('report-end');

    // Safety check if elements exist
    if (!startEl || !endEl) return;

    const today = new Date();
    const endStr = today.toISOString().split('T')[0];
    let startStr = endStr;

    if (range === 'week') {
        // Last 7 days
        const past = new Date();
        past.setDate(today.getDate() - 6);
        startStr = past.toISOString().split('T')[0];
    } else if (range === 'month') {
        // First day of current month
        const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
        startStr = firstDay.toISOString().split('T')[0];
    }

    startEl.value = startStr;
    endEl.value = endStr;
};

// State to hold data for export
let reportDataExport = [];

window.generateReportPreview = function () {
    const startVal = document.getElementById('report-start').value;
    const endVal = document.getElementById('report-end').value;
    const previewEl = document.getElementById('report-preview');
    const exportBtn = document.getElementById('btn-export-excel');

    if (!startVal || !endVal) return alert("Selecciona fechas.");

    const log = JSON.parse(localStorage.getItem('nexus_attendance_log') || '[]');
    const users = JSON.parse(localStorage.getItem('nexus_users') || '[]');

    // 1. FILTER
    const filtered = log.filter(entry => {
        const dateStr = entry.timestamp.split('T')[0];
        return dateStr >= startVal && dateStr <= endVal;
    });

    if (filtered.length === 0) {
        previewEl.innerHTML = '<p style="color:orange;">No hay datos en este rango.</p>';
        exportBtn.style.display = 'none';
        return;
    }

    // 2. AGGREGATE
    const totalChecks = filtered.length;
    const uniqueIds = new Set(filtered.map(e => e.userId)).size;

    // Breakdown by Slot
    const slots = {};
    filtered.forEach(e => {
        const k = e.serviceSlot || 'Desconocido';
        slots[k] = (slots[k] || 0) + 1;
    });

    // 3. RENDER PREVIEW
    let html = `
        <div style="display:flex; justify-content:space-around; margin-bottom:10px;">
            <div style="text-align:center;">
                <h2 style="margin:0; color:var(--primary);">${totalChecks}</h2>
                <small>Asistencias</small>
            </div>
            <div style="text-align:center;">
                <h2 style="margin:0; color:var(--primary);">${uniqueIds}</h2>
                <small>Hermanos Únicos</small>
            </div>
        </div>
        <hr style="border-color:#444;">
        <ul style="list-style:none; padding:0; margin-top:10px;">
    `;

    for (const [slot, count] of Object.entries(slots)) {
        html += `<li style="display:flex; justify-content:space-between; padding:5px 0;">
                    <span>${slot}</span>
                    <span style="font-weight:bold;">${count}</span>
                 </li>`;
    }
    html += '</ul>';

    previewEl.innerHTML = html;
    exportBtn.style.display = 'block';

    // 4. PREPARE EXPORT DATA (Global for export function)
    reportDataExport = filtered.map(entry => {
        // Find user by ID matching phone (primary key in this app)
        const u = users.find(x => x.phone === entry.userId) || users.find(x => x.id === entry.userId) || {};
        const serviceName = entry.serviceName || entry.serviceSlot;

        return {
            "Nombre Completo": u.full_name || u.name || 'Desconocido', // FIRST COLUMN
            "Culto": serviceName,
            "Hora Check-in": new Date(entry.timestamp).toLocaleTimeString(),
            "Fecha": entry.timestamp.split('T')[0],
            "ID / Celular": entry.userId,
            "Rol": u.role || 'user'
        };
    });
};

window.exportReportToExcel = function () {
    if (reportDataExport.length === 0) return alert("No hay datos para exportar. Genera la vista previa primero.");

    // Create Workbook
    const wb = XLSX.utils.book_new();

    // Group by 'Culto'
    const groups = {};
    reportDataExport.forEach(row => {
        const key = row["Culto"] || "Otros";
        if (!groups[key]) groups[key] = [];
        groups[key].push(row);
    });

    // Create a Sheet for each Group
    Object.keys(groups).forEach(serviceName => {
        // Sanitize sheet name (max 31 chars, no special chars ideally)
        let sheetName = serviceName.replace(/[:\/\\?*\[\]]/g, "").substring(0, 30);
        if (!sheetName) sheetName = "Sheet1";

        const ws = XLSX.utils.json_to_sheet(groups[serviceName]);

        // Auto-width columns (simple heuristic)
        const wscols = [
            { wch: 30 }, // Nombre
            { wch: 20 }, // Culto
            { wch: 15 }, // Hora
            { wch: 15 }, // Fecha
            { wch: 15 }, // ID
            { wch: 10 }  // Rol
        ];
        ws['!cols'] = wscols;

        XLSX.utils.book_append_sheet(wb, ws, sheetName);
    });

    // File Name
    const startVal = document.getElementById('report-start').value;
    const endVal = document.getElementById('report-end').value;
    const filename = `Asistencia_LLDM_${startVal}_al_${endVal}.xlsx`;

    // Download
    XLSX.writeFile(wb, filename);
};


// ==========================================
// SERVICE SELECTION MODAL LOGIC
// ==========================================
let currentServiceCallback = null;

window.openServiceModal = function (callback) {
    currentServiceCallback = callback;
    const modal = document.getElementById('service-select-modal');
    const container = document.getElementById('service-options-container');

    if (!modal || !container) return;

    // Clear prev buttons
    container.innerHTML = '';

    const options = [
        { id: '5am', name: 'Culto 5:00 AM' },
        { id: '9am', name: 'Culto 9:00 AM' },
        { id: '10am_dom', name: 'Culto 10:00 AM (Dom)' },
        { id: '6pm_jue', name: 'Culto 6:00 PM (Jue)' },
        { id: '6pm_dom', name: 'Culto 6:00 PM (Dom)' },
        { id: '7pm', name: 'Culto 7:00 PM' }
    ];

    options.forEach(opt => {
        const btn = document.createElement('button');
        btn.className = 'cyber-btn sm';
        btn.textContent = opt.name;
        btn.style.width = '100%';
        btn.style.marginBottom = '5px';
        btn.onclick = (e) => {
            e.stopPropagation(); // Prevent bubbling
            console.log("Service selected:", opt.id);
            if (currentServiceCallback) {
                currentServiceCallback(opt.id, opt.name);
                currentServiceCallback = null; // Clear immediately
            }
            closeServiceModal();
        };
        container.appendChild(btn);
    });

    modal.classList.remove('hidden');
    modal.style.display = 'flex';
    console.log("Service Modal Opened");
};

window.closeServiceModal = function () {
    const modal = document.getElementById('service-select-modal');
    if (modal) {
        modal.classList.add('hidden');
        modal.style.display = 'none';
    }
    currentServiceCallback = null; // Ensure clear
};

// FINAL DEBUG CHECK
console.log("App.js loaded successfully.");

// INIT APP ON LOAD
document.addEventListener('DOMContentLoaded', () => {
    console.log("🚀 App Launching via EventListener");

    // REALTIME STATUS INDICATOR (DEBUG)
    const statusDiv = document.createElement('div');
    statusDiv.id = 'realtime-status';
    statusDiv.style.cssText = "position:fixed; bottom:10px; left:10px; background:rgba(0,0,0,0.8); color:white; padding:5px 10px; border-radius:20px; font-size:10px; z-index:9999; pointer-events:none;";
    statusDiv.innerHTML = "🔴 Conectando...";
    document.body.appendChild(statusDiv);

    // FORCE SUBSCRIBE NOW
    // FORCE SUBSCRIBE REMOVED - It was blocking the real logic due to Singleton check.
    // Realtime logic is now strictly handled in initApp().

    // Initial Status
    const st = document.getElementById('realtime-status');
    if (st) st.innerHTML = "⏳ Iniciando...";

    if (typeof initApp === 'function') {
        setTimeout(initApp, 500); // Small delay to let Supabase Init
    } else {
        console.error("initApp not found!");
    }

    // SAFETY RE-BIND
    const btnAdmin = document.getElementById('admin-view-schedule-btn');
    if (btnAdmin) btnAdmin.onclick = window.manuallyOpenSchedule;

    const btnUser = document.getElementById('user-view-schedule-btn');
    if (btnUser) btnUser.onclick = window.manuallyOpenSchedule;

    // CLOSE BUTTON HANDLER RE-BIND
    const btnClose = document.getElementById('close-schedule');
    if (btnClose) {
        btnClose.onclick = function () {
            document.getElementById('schedule-overlay').classList.add('hidden');
            // Check if we should restore admin panel
            const currentUser = JSON.parse(localStorage.getItem('nexus_user') || '{}');
            if (currentUser.role === 'admin') {
                const adminPanel = document.getElementById('admin-panel');
                if (adminPanel) adminPanel.classList.remove('hidden');
            }
        };
    }
});
// alert("Sistema Cargado Correctamente ✅"); // Uncomment if needed for extreme debugging

// --- EMERGENCY GLOBAL FUNCTIONS ---
// --- EMERGENCY GLOBAL FUNCTIONS ---
window.manuallyOpenSchedule = function () {
    // console.log("🟢 Manual Open Schedule Triggered");

    // 1. Check Data
    const schedule = JSON.parse(localStorage.getItem('nexus_schedule_db') || '{}');
    const keys = Object.keys(schedule);

    if (keys.length === 0) {
        alert("⚠️ ATENCIÓN: No hay horario en el celular.\n\n1. Dale a '🔄 Sincronizar'.\n2. Si sigue fallando, pídele al Admin que suba la lista de nuevo.");
    }

    // 2. Open Modal
    const modal = document.getElementById('schedule-overlay');

    if (modal) {
        modal.classList.remove('hidden');
        modal.style.display = 'flex';
        modal.style.zIndex = '9999';
        modal.style.opacity = '1';
        modal.style.visibility = 'visible';

        // 3. UI ELEMENTS
        const grid = document.querySelector('.schedule-grid');
        const weeklyContainer = document.getElementById('weekly-table-container');
        const viewWeeklyBtn = document.getElementById('view-weekly-btn');
        const backToTodayBtn = document.getElementById('back-to-today');
        const adminPanel = document.getElementById('admin-panel');

        // HIDE ADMIN PANEL
        if (adminPanel && !adminPanel.classList.contains('hidden')) {
            adminPanel.classList.add('hidden');
            console.log("🟢 Admin Panel Hidden");
        }

        // RESET VIEW TO DEFAULT (GRID / TODAY)
        if (grid) {
            grid.classList.remove('hidden');
            grid.style.display = 'grid'; // Restore Grid Layout
        }
        if (weeklyContainer) {
            weeklyContainer.classList.add('hidden');
            weeklyContainer.style.display = 'none'; // Ensure hidden
            weeklyContainer.removeAttribute('style'); // Remove the forced style from before
            weeklyContainer.style.display = 'none';
        }
        if (viewWeeklyBtn) viewWeeklyBtn.classList.remove('hidden');

        // BIND SWITCH LISTENERS (Re-bind to ensure they work)
        if (viewWeeklyBtn) {
            viewWeeklyBtn.onclick = function () {
                if (grid) {
                    grid.classList.add('hidden');
                    grid.style.display = 'none';
                }
                if (weeklyContainer) {
                    weeklyContainer.classList.remove('hidden');
                    weeklyContainer.style.display = 'block';
                }
                viewWeeklyBtn.classList.add('hidden'); // Hide self

                // Load Table Data
                if (typeof loadWeeklyTable === 'function') loadWeeklyTable();
            };
        }

        if (backToTodayBtn) {
            backToTodayBtn.onclick = function () {
                if (weeklyContainer) {
                    weeklyContainer.classList.add('hidden');
                    weeklyContainer.style.display = 'none';
                }
                if (grid) {
                    grid.classList.remove('hidden');
                    grid.style.display = 'grid';
                }
                if (viewWeeklyBtn) viewWeeklyBtn.classList.remove('hidden');
            };
        }

        // 4. Load Data for Today (Grid)
        if (typeof loadTodaySchedule === 'function') {
            loadTodaySchedule();
        }

    } else {
        alert("Error Crítico: No encuentro el modal 'schedule-overlay'");
    }
};

window.checkCloudData = async function () {
    if (!window.DB) return alert("Error: DB no inicializada");

    // Show Loading
    const btn = document.querySelector('button[onclick="checkCloudData()"]');
    const oldText = btn ? btn.innerHTML : '';
    if (btn) btn.innerHTML = "⏳ Consultando...";

    try {
        const sched = await window.DB.fetchConfig('weekly_schedule');
        const keys = sched ? Object.keys(sched).length : 0;

        if (keys > 0) {
            alert(`✅ LA NUBE TIENE DATOS.\n\nSe encontraron ${keys} días guardados en Supabase.\n\nSi tu celular no los ve:\n1. Dale a 'Forzar Descarga'.\n2. Cierra y abre la app.`);
        } else {
            alert(`⚠️ LA NUBE ESTÁ VACÍA.\n\nSupabase no tiene horarios guardados.\n\nSOLUCIÓN:\nVe a la Mac (Admin) y sube el horario de nuevo.`);
        }
    } catch (e) {
        alert("❌ Error Conexión: " + e.message);
    }

    if (btn) btn.innerHTML = oldText;
};

// --- INIT APP ON LOAD ---
document.addEventListener('DOMContentLoaded', () => {
    console.log("🚀 App Launching via EventListener");

    // EVENT DELEGATION
    document.body.addEventListener('click', (e) => {
        // Admin View Schedule
        if (e.target && (e.target.id === 'admin-view-schedule-btn' || e.target.closest('#admin-view-schedule-btn'))) {
            e.preventDefault();
            console.log("🟢 Global Delegated Click: Admin Schedule");
            window.manuallyOpenSchedule();
        }
        // User View Schedule
        if (e.target && (e.target.id === 'user-view-schedule-btn' || e.target.closest('#user-view-schedule-btn'))) {
            e.preventDefault();
            console.log("🟢 Global Delegated Click: User Schedule");
            window.manuallyOpenSchedule();
        }
    });

    if (typeof initApp === 'function') {
        setTimeout(initApp, 500);
    } else {
        console.error("initApp not found!");
    }
});

// --- VERSION INDICATOR (v6.19) ---
// --- VERSION INDICATOR (v6.53) ---
setTimeout(() => {
    let v = document.getElementById('app-version');
    if (!v) {
        v = document.createElement('div');
        v.id = 'app-version';
        document.body.appendChild(v);
    }
    v.innerText = "v6.72 (Admin Tabs & Filters)";
    v.style.cssText = "position:fixed; bottom:2px; right:2px; color:white; font-weight:bold; font-size:9px; z-index:9999; pointer-events:none; background:rgba(0,128,0,0.9); padding:2px; border-radius:3px;";
    document.body.appendChild(v);
});

// --- USER PROFILE MODAL LOGIC ---
window.closeProfileModal = function () {
    const modal = document.getElementById('profile-modal');
    if (modal) {
        modal.style.display = 'none';
        modal.classList.add('hidden');
    }
};

// --- ADMIN TABS LOGIC ---
window.switchAdminTab = function (tabName) {
    const tabAsistencia = document.getElementById('admin-tab-asistencia');
    const tabSuperAdmin = document.getElementById('admin-tab-superadmin');
    const btnAsistencia = document.getElementById('tab-btn-asistencia');
    const btnSuperAdmin = document.getElementById('tab-btn-superadmin');

    if (!tabAsistencia || !tabSuperAdmin) return;

    if (tabName === 'asistencia') {
        tabAsistencia.style.display = 'flex';
        tabSuperAdmin.style.display = 'none';
        tabAsistencia.classList.remove('hidden');
        tabSuperAdmin.classList.add('hidden');
        btnAsistencia.classList.add('active');
        btnSuperAdmin.classList.remove('active');
    } else if (tabName === 'superadmin') {
        tabAsistencia.style.display = 'none';
        tabSuperAdmin.style.display = 'flex';
        tabAsistencia.classList.add('hidden');
        tabSuperAdmin.classList.remove('hidden');
        btnSuperAdmin.classList.add('active');
        btnAsistencia.classList.remove('active');
    }
};

window.openProfileModal = function () {
    if (!STATE.user) return;

    // FORCED RE-SYNC from local users list in case STATE.user is stale
    const allUsers = JSON.parse(localStorage.getItem('nexus_users') || '[]');
    const latestUser = allUsers.find(u => String(u.id) === String(STATE.user.id) || String(u.phone) === String(STATE.user.phone));
    if (latestUser) {
        STATE.user = { ...STATE.user, ...latestUser }; // Merge to ensure no missing fields
        // Also update the session cache to stay consistent
        localStorage.setItem('nexus_account', JSON.stringify(STATE.user));
    }

    const user = STATE.user;

    document.getElementById('profile-name').value = user.full_name || '';
    document.getElementById('profile-phone').value = user.phone || '';
    document.getElementById('profile-dob').value = user.dob || '';

    // Calculate Age on the fly in case age_label is missing or outdated
    let displayAge = user.age_label || user.age || '';
    if (user.dob) {
        const dobDate = new Date(user.dob);
        if (!isNaN(dobDate.getTime())) {
            const today = new Date();
            let ageNum = today.getFullYear() - dobDate.getFullYear();
            if (today.getMonth() < dobDate.getMonth() || (today.getMonth() === dobDate.getMonth() && today.getDate() < dobDate.getDate())) {
                ageNum--;
            }
            displayAge = ageNum + " años";
        }
    }
    document.getElementById('profile-age').value = displayAge;
    document.getElementById('profile-baptism-date').value = user.baptism_date || '';
    document.getElementById('profile-holy-spirit-date').value = user.holy_spirit_date || '';
    document.getElementById('profile-address').value = user.direccion || '';
    document.getElementById('profile-colony').value = user.colonia || user.colony || '';
    document.getElementById('profile-profession').value = user.profesion || '';
    document.getElementById('profile-education').value = user.grado_estudios || '';
    document.getElementById('profile-password').value = user.password || '';

    const avatarName = user.full_name ? user.full_name.replace(/ /g, '+') : 'User';
    const defaultAvatar = `https://ui-avatars.com/api/?name=${avatarName}&background=c5a059&color=fff&bold=true`;
    document.getElementById('profile-modal-avatar').src = user.photo_url || defaultAvatar;

    document.getElementById('profile-modal').style.display = 'flex';
    document.getElementById('profile-modal').classList.remove('hidden');
};

// Handle Photo Upload (Base64 + Resize)
window.handleProfilePhotoUpload = function (event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function (e) {
        const img = new Image();
        img.onload = function () {
            const canvas = document.createElement('canvas');
            const MAX_SIZE = 250;
            let width = img.width;
            let height = img.height;

            if (width > height) {
                if (width > MAX_SIZE) {
                    height *= MAX_SIZE / width;
                    width = MAX_SIZE;
                }
            } else {
                if (height > MAX_SIZE) {
                    width *= MAX_SIZE / height;
                    height = MAX_SIZE;
                }
            }
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);

            const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
            document.getElementById('profile-modal-avatar').src = dataUrl;

            if (STATE.user) {
                STATE.user.photo_url = dataUrl;
            }
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
};

// Form Save
setTimeout(() => {
    const profileForm = document.getElementById('profile-edit-form');
    if (profileForm) {
        profileForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (!STATE.user) return;

            STATE.user.phone = document.getElementById('profile-phone').value.trim();
            STATE.user.dob = document.getElementById('profile-dob').value;

            if (STATE.user.dob) {
                const dob = new Date(STATE.user.dob);
                const today = new Date();
                let age = today.getFullYear() - dob.getFullYear();
                if (today.getMonth() < dob.getMonth() || (today.getMonth() === dob.getMonth() && today.getDate() < dob.getDate())) {
                    age--;
                }
                STATE.user.age_label = age + " años";
                document.getElementById('profile-age').value = STATE.user.age_label;
            }

            STATE.user.direccion = document.getElementById('profile-address').value.trim();
            STATE.user.colonia = document.getElementById('profile-colony').value.trim();
            STATE.user.profesion = document.getElementById('profile-profession').value.trim();
            STATE.user.grado_estudios = document.getElementById('profile-education').value.trim();
            STATE.user.password = document.getElementById('profile-password').value.trim();
            STATE.user.baptism_date = document.getElementById('profile-baptism-date').value || '';
            STATE.user.holy_spirit_date = document.getElementById('profile-holy-spirit-date').value || '';

            localStorage.setItem('nexus_account', JSON.stringify(STATE.user));

            const allUsers = JSON.parse(localStorage.getItem('nexus_users') || '[]');
            const userIndex = allUsers.findIndex(u => u.id === STATE.user.id);
            if (userIndex !== -1) {
                allUsers[userIndex] = STATE.user;
                localStorage.setItem('nexus_users', JSON.stringify(allUsers));
            }

            if (window.DB) {
                const submitBtn = profileForm.querySelector('button[type="submit"]');
                const oldText = submitBtn.innerText;
                try {
                    submitBtn.innerText = "GUARDANDO...";
                    await window.DB.registerUser(STATE.user);
                    submitBtn.innerText = oldText;
                    alert("¡Perfil actualizado correctamente!");

                    if (typeof window.closeProfileModal === 'function') window.closeProfileModal();
                    else document.getElementById('profile-modal').style.display = 'none';

                    if (typeof showDashboard === 'function') showDashboard(STATE.user);

                } catch (err) {
                    submitBtn.innerText = oldText;
                    console.error("Profile save error:", err);
                    alert("Guardado localmente. Error al sincronizar con la nube: " + err.message);
                }
            } else {
                alert("¡Perfil actualizado localmente!");
                if (typeof window.closeProfileModal === 'function') window.closeProfileModal();
                else document.getElementById('profile-modal').style.display = 'none';

                if (typeof showDashboard === 'function') showDashboard(STATE.user);
            }
        });
    }
}, 1000);

// --- ADMIN MEMBER MODAL LOGIC ---
window.openAdminMemberModal = function (uid) {
    const users = JSON.parse(localStorage.getItem('nexus_users') || '[]');
    const user = users.find(u => String(u.id) === String(uid) || String(u.phone) === String(uid));
    if (!user) {
        alert("Usuario no encontrado.");
        return;
    }

    document.getElementById('admin-member-name').innerText = user.full_name || user.name || 'N/A';
    document.getElementById('admin-member-phone').innerText = user.phone || 'N/A';
    document.getElementById('admin-member-dob').innerText = user.dob || 'No especificada';
    document.getElementById('admin-member-age').innerText = user.age_label || user.age || 'N/A';

    // Format dates to be more readable
    const formatDate = (dateString) => dateString ? new Date(dateString + 'T12:00:00Z').toLocaleDateString('es-MX') : 'N/A';
    document.getElementById('admin-member-baptism').innerText = formatDate(user.baptism_date);
    document.getElementById('admin-member-holy-spirit').innerText = formatDate(user.holy_spirit_date);

    document.getElementById('admin-member-address').innerText = user.direccion || 'N/A';
    document.getElementById('admin-member-colony').innerText = user.colony || user.colonia || 'N/A';
    document.getElementById('admin-member-profession').innerText = user.profesion || 'N/A';
    document.getElementById('admin-member-education').innerText = user.grado_estudios || 'N/A';
    document.getElementById('admin-member-password').innerText = user.password || 'N/A';
    document.getElementById('admin-member-role').innerText = user.role || 'user';

    let joined = 'N/A';
    if (user.created_at || user.createdAt) {
        joined = new Date(user.created_at || user.createdAt).toLocaleDateString('es-MX');
    }
    document.getElementById('admin-member-joined').innerText = joined;

    const avatarName = (user.full_name || 'U').replace(/ /g, '+');
    const defaultAvatar = `https://ui-avatars.com/api/?name=${avatarName}&background=c5a059&color=fff&bold=true`;
    document.getElementById('admin-member-avatar').src = user.photo_url || defaultAvatar;

    document.getElementById('admin-member-modal').style.display = 'flex';
    document.getElementById('admin-member-modal').classList.remove('hidden');
};
