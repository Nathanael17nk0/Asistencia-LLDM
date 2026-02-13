// DEBUG TRACER
// alert("DEBUG: Script Start");

// function startApp() { // REMOVED WRAPPER
// console.log("Starting App...");
// alert("DEBUG: App Starting (DOM Ready)");

// --- STATE MANAGEMENT ---
const STATE = {
    user: null,
    currentLocation: { lat: 0, lng: 0 },
    targetLocation: { lat: 0, lng: 0, radius: 50 }, // 50 meters
    inGeofence: false
};

// --- DOM ELEMENTS ---
// --- DOM ELEMENTS ---
const loginSection = document.getElementById('login-section');
// Pre-check if already declared (though in module/script scope it shouldn't matter unless reloaded in same context)
// But 'const' throws if redeclared. 
// We will assume this script runs once. If it runs twice, that's the issue.
// However, the user error says "Can't create duplicate variable". 
// This usually happens in Safari if a variable is global and script runs twice.
// Let's use var or just not redeclare if window.X exists? No, 'const' is block scoped but global here.
// I will change these key elements to 'var' to be safe against re-execution or just rely on IDs.
// actually, let's just use document.getElementById directly in functions or use 'var'.
var registerSection = document.getElementById('register-section');
var dashboardSection = document.getElementById('dashboard-section');

var loginForm = document.getElementById('login-form');
var registerForm = document.getElementById('register-form');

// Register specific
const dobInput = document.getElementById('reg-dob');
const ageInput = document.getElementById('reg-edad');

// Dashboard specific
const fingerprintBtn = document.getElementById('check-in-btn');

// --- INITIALIZATION ---
function initApp() {
    // Load settings
    const savedSettings = localStorage.getItem('nexus_settings');
    if (savedSettings) {
        const settings = JSON.parse(savedSettings);
        if (settings.targetLocation) {
            STATE.targetLocation = settings.targetLocation;
        }
    }

    // Check for ACTIVE SESSION
    const activeSession = localStorage.getItem('nexus_session');


    if (activeSession === 'active') {
        // Restore Account Data
        const accountData = localStorage.getItem('nexus_account');
        if (accountData) {
            try {
                const user = JSON.parse(accountData);
                STATE.user = user;
                showDashboard(user);
            } catch (e) {
                console.error("Account data corrupted", e);
                localStorage.removeItem('nexus_session'); // Clear session
                showLogin();
            }
        } else {
            // Session active but no account? Weird state.
            localStorage.removeItem('nexus_session');
            showLogin();
        }
    } else {
        // No active session. 
        // Check if account exists to show Login, else Register
        if (localStorage.getItem('nexus_account')) {
            showLogin();
        } else {
            showRegister();
        }
    }
}

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
        avatarEl.src = `https://ui-avatars.com/api/?name=${avatarName}&background=c5a059&color=fff&bold=true`;
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
    startLocationWatch();
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
if (showLoginBtn) showLoginBtn.addEventListener('click', (e) => { e.preventDefault(); showLogin(); });
if (showRegisterBtn) showRegisterBtn.addEventListener('click', (e) => { e.preventDefault(); showRegister(); });

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

        const fullName = `${nombre} ${apellidoP} ${apellidoM}`;

        const newUser = {
            id: 'user-' + Date.now(),
            phone: String(celular).trim(),
            password: String(password).trim(),
            role: 'user',
            full_name: fullName
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

            alert(`REGISTRO EXITOSO\nBienvenido, ${nombre}.\n\nTus credenciales se han guardado.`);

            // Direct Entry
            // showDashboard(newUser); 
            window.location.reload(); // Force reload to ensure clean state and initApp logic runs

        } catch (err) {
            alert("ERROR AL GUARDAR: " + err.message);
        }
    });
}

// --- LOGIN LOGIC ---
// --- LOGIN LOGIC ---
function handleLogin(e) {
    if (e) e.preventDefault(); // Safety

    const phoneInput = document.getElementById('login-phone');
    const passInput = document.getElementById('login-password');

    if (!phoneInput || !passInput) return alert("Error: Campos no encontrados");

    const phone = phoneInput.value;
    const password = passInput.value;

    const cleanPhone = String(phone).trim();
    const cleanPass = String(password).trim();

    console.log("Attempting login:", cleanPhone);

    // Check Admin Hardcoded
    if (cleanPhone === '0000' && cleanPass === 'admin') {
        const adminUser = { id: 'admin-1', full_name: 'Administrador', role: 'admin' };
        // Admin doesn't overwrite user account, just session -> WAIT, initApp NEEDS IT.
        // We MUST overwrite 'nexus_account' temporarily for this session to work on reload.
        localStorage.setItem('nexus_account', JSON.stringify(adminUser));
        localStorage.setItem('nexus_session', 'active');

        // IMMEDIATE VERIFICATION
        const verifyAcc = localStorage.getItem('nexus_account');
        const verifySess = localStorage.getItem('nexus_session');

        if (!verifyAcc || !verifySess) {
            alert("⚠️ AVISO: Modo 'Sin Persistencia' activado.\n\nEl navegador no está guardando datos de sesión.\nEntrando en modo directo...");
        }

        // DIRECT RENDER (Bypass Reload Error)
        STATE.user = adminUser;
        showDashboard(adminUser);
        alert("✅ MODO ADMIN ACTIVADO");

        // FORCE UI SWITCH immediately
        document.getElementById('login-section').classList.remove('active-section');
        document.getElementById('login-section').classList.add('hidden-section');

        document.getElementById('register-section').classList.remove('active-section');
        document.getElementById('register-section').classList.add('hidden-section');

        document.getElementById('dashboard-section').classList.remove('hidden-section');
        document.getElementById('dashboard-section').classList.add('active-section');

        // Show admin panel
        setTimeout(() => {
            const adminPanel = document.getElementById('admin-panel');
            if (adminPanel) adminPanel.classList.remove('hidden');
        }, 100);

        return; // STOP HERE. DO NOT RELOAD.
    }

    // Check Stored Account
    const accountData = localStorage.getItem('nexus_account');

    if (accountData) {
        try {
            const storedUser = JSON.parse(accountData);
            const storedPhone = String(storedUser.phone).trim();
            const storedPass = String(storedUser.password).trim();

            if (storedPhone === cleanPhone && storedPass === cleanPass) {
                // LOGIN SUCCESS
                STATE.user = storedUser;
                localStorage.setItem('nexus_session', 'active');
                // showDashboard(storedUser);
                window.location.reload();
            } else {
                alert("CREDENCIALES INCORRECTAS");
            }
        } catch (err) {
            alert("Error en datos de cuenta.");
        }
    } else {
        alert("NO EXISTE CUENTA REGISTRADA.\nPor favor, cree una cuenta primero.");
    }
}

// EXPOSE AND BIND
window.appHandleLogin = handleLogin;

if (loginForm) {
    loginForm.addEventListener('submit', handleLogin);
}

// Logout
const logoutBtn = document.getElementById('logout-btn');
if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
        if (confirm("¿Cerrar sesión?")) {
            // ONLY CLEAR SESSION, KEEP ACCOUNT
            localStorage.removeItem('nexus_session');
            location.reload();
        }
    });
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
function startLocationWatch() {
    if (!navigator.geolocation) return;
    navigator.geolocation.watchPosition((pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        STATE.currentLocation = { lat, lng };

        // Initialize Target if empty (TEMP FIX for testing)
        // In production, this should be hardcoded to Church logic.
        if (STATE.targetLocation.lat === 0 && STATE.targetLocation.lng === 0) {
            // For now, let's NOT auto-set to current processing, 
            // because that makes geofence always true.
            // Let's assume User will set it via Admin or code.
            // But for "User Testing" immediately without coords, 
            // maybe we default to a known location or 0,0 and warn?
            // User said: "Si no, puedo poner una temporal".
            // Let's leave it 0,0. Admin must set it.
            // OR, strictly for dev, if 0,0, allow check-in? 
            // No, User asked for strict.
            // Let's Log it.
            console.log("Current: ", lat, lng);
        }

        // Calculate Distance
        const dist = getDistanceInMeters(lat, lng, STATE.targetLocation.lat, STATE.targetLocation.lng);
        STATE.distance = dist; // Store for debug
        STATE.inGeofence = dist <= STATE.targetLocation.radius;

        // UI Feedback (Optional)
        const statusDiv = document.getElementById('location-status');
        if (statusDiv) {
            statusDiv.textContent = `Distancia: ${Math.round(dist)}m (${STATE.inGeofence ? 'DENTRO' : 'FUERA'})`;
            statusDiv.style.color = STATE.inGeofence ? 'green' : 'red';
        }

        // Trigger Button Update
        if (window.updateCheckInStatus) window.updateCheckInStatus();

    }, (err) => console.warn(err), { enableHighAccuracy: true });
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

                    // Assuming updateLocationStatus is a function that updates the UI
                    // If not, you might need to call loadTheme() or similar for location.
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

                        const newSchedule = JSON.parse(localStorage.getItem('nexus_schedule_db') || '{}');
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

        users.push({
            id: 'user-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
            phone: celular, // Can be empty
            password: password,
            role: 'user',
            full_name: fullName,
            colonia: colonia,
            age_label: ageLabel,
            dob: dobVal,
            createdAt: new Date().toISOString()
        });
        alert(`✅ ${fullName} registrado exitosamente.`);
    }

    localStorage.setItem('nexus_users', JSON.stringify(users));

    // Clear Fields
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
const searchInput = document.getElementById('admin-search-user');

if (serviceFilterSelect) {
    serviceFilterSelect.addEventListener('change', renderAdminUserList);
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

        if (!Array.isArray(log)) log = [];

        // Today check (YYYY-MM-DD)
        const todayISO = new Date().toISOString().split('T')[0];

        // Build map of who attended TODAY, specific to the filter
        const attendeesMap = new Map(); // userId -> attendanceEntry
        const currentFilter = serviceProps ? serviceProps.value : 'all';

        log.forEach(entry => {
            // Filter by Date (Today)
            if (!entry.timestamp.startsWith(todayISO)) return;
            // Filter by Service Slot (if selected)
            if (currentFilter !== 'all' && entry.serviceSlot !== currentFilter) return;

            attendeesMap.set(entry.userId, entry);
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

        // Update Count
        // Count depends on FILTER. If filter is active, we want to know how many attended THAT service vs total active users?
        // Actually, users count is always total. Attendance count is for current view.
        const userCount = users.filter(u => u.role !== 'admin').length;
        if (countSpan) countSpan.textContent = `${attendedIds.size}/${userCount}`;

        listContainer.innerHTML = '';

        if (userCount === 0) {
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
            const uid = u.id || u.phone;
            const isPresent = attendedIds.has(uid);
            const entry = attendeesMap.get(uid);

            const div = document.createElement('div');
            div.className = 'user-list-item';
            div.style.display = 'flex';
            div.style.alignItems = 'center';
            div.style.padding = '10px';
            div.style.borderBottom = '1px solid #eee';
            div.style.background = isPresent ? '#f0fff4' : '#fff';

            // Avatar
            const initials = (u.full_name || 'U').split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();

            // Status Text
            const statusText = isPresent ?
                `<span style="color:green; font-weight:bold; font-size:0.8rem;">✅ ${entry.serviceName || 'Asistió'}</span>` :
                `<span style="color:#aaa; font-size:0.8rem;">Falta</span>`;

            div.innerHTML = `
                    <div style="width:35px; height:35px; background:${isPresent ? 'var(--success)' : '#ddd'}; color:white; border-radius:50%; display:flex; align-items:center; justify-content:center; font-weight:bold; margin-right:10px;">
                        ${initials}
                    </div>
                    <div style="flex:1;">
                        <h4 style="margin:0; font-size:0.95rem;">${u.full_name || u.name}</h4>
                        <small style="color:#666;">ID: ${u.phone}</small>
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

                    // Remove today's entries for this user/slot
                    // Remove today's entries for this user/slot
                    const todayISO = new Date().toISOString().split('T')[0];
                    const newLog = log.filter(e => {
                        // Keep entry if: Different ID OR Different Date OR (Different Slot AND Not 'All' Filter)
                        // Actually, simplified: Reject if Match User AND Match Date AND Match Slot (if specific) or Any Slot (if 'all' - actually specific logic: remove from currently VIEWED list?)
                        // If logic says "Quitar asistencia de hoy for this user", usually implies checking the current slot.
                        // If Filter is 'all', removing "Asistencia" might be ambiguous. Let's assume removing specific entry shown?
                        // But in 'all' view, we show "Presente (Slot)".
                        // Let's rely on finding the Exact Entry if possible?
                        // For now, robust logic:
                        if (e.userId !== uid) return true;
                        if (!e.timestamp.startsWith(todayISO)) return true;
                        if (currentFilter !== 'all' && e.serviceSlot !== currentFilter) return true;

                        // If we are here, it matches User + Date + (Filter or All). 
                        // If Filter is All, we might delete ALL attendance for today? 
                        // Better to only delete the one for the "Current Slot" if we could know it.
                        // But UI shows "Presente".
                        return false;
                    });

                    localStorage.setItem('nexus_attendance_log', JSON.stringify(newLog));
                    renderAdminUserList();
                    showToast("Asistencia eliminada", "warning");
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

                        if (already) return showToast("Ya tiene asistencia en ese culto.", "error");

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

    // SUPABASE SYNC (Pull users from Cloud)
    if (window.DB) {
        try {
            const cloudUsers = await window.DB.fetchAllUsers();
            if (cloudUsers && cloudUsers.length > 0) {
                // Merge with local? Or Overwrite?
                // For simplicity: Overwrite local 'nexus_users' with Cloud (Source of Truth)
                // But keep 'nexus_account' untouched (session).
                localStorage.setItem('nexus_users', JSON.stringify(cloudUsers));
                console.log("Synced Users from Cloud:", cloudUsers.length);
            }

            // Sync Today's Attendance too?
            const cloudLogs = await window.DB.fetchTodayAttendance();
            if (cloudLogs && cloudLogs.length > 0) {
                // We should merge with local log or just rely on cloud?
                // Current app uses 'nexus_attendance_log' for everything (history, admin list).
                // Let's MERGE unique entries.
                const localLog = JSON.parse(localStorage.getItem('nexus_attendance_log') || '[]');

                // Add cloud entries that don't exist locally
                let changes = false;
                cloudLogs.forEach(c => {
                    const exists = localLog.find(l => l.userId === c.userId && l.timestamp === c.timestamp);
                    if (!exists) {
                        localLog.push(c);
                        changes = true;
                    }
                });

                if (changes) {
                    localStorage.setItem('nexus_attendance_log', JSON.stringify(localLog));
                    console.log("Synced Attendance from Cloud");
                }
            }

            // Sync Schedule
            const cloudSchedule = await window.DB.fetchSchedule();
            if (cloudSchedule) {
                console.log("✅ Schedule Found in Cloud:", Object.keys(cloudSchedule).length);
                localStorage.setItem('nexus_schedule_db', JSON.stringify(cloudSchedule));

                // FORCE UI UPDATE REFRESH
                if (typeof loadWeeklyTable === 'function') loadWeeklyTable();
                if (typeof loadTodaySchedule === 'function') loadTodaySchedule();
            } else {
                console.warn("⚠️ No Schedule in Cloud (or Fetch Error)");
            }

            // Subscribe to Changes
            window.DB.subscribeToChanges(
                // On Log Update
                (newLog, isRefresh) => {
                    if (isRefresh) {
                        // Reload today's log? Or just simple alert? 
                        // For simplicity, just re-fetch today's logs silently
                        window.DB.fetchTodayAttendance().then(logs => {
                            // Merge logic simplified: Just overwrite local cache for today? 
                            // Or complex merge. Let's just notify UI to refresh if on admin panel.
                            if (document.getElementById('admin-panel') && !document.getElementById('admin-panel').classList.contains('hidden')) {
                                renderAdminUserList();
                            }
                        });
                    } else if (newLog) {
                        // Append locally
                        const current = JSON.parse(localStorage.getItem('nexus_attendance_log') || '[]');
                        if (!current.find(c => c.timestamp === newLog.timestamp && c.userId === newLog.user_phone)) {
                            // Map DB format to App format
                            current.push({
                                userId: newLog.user_phone,
                                name: newLog.user_name,
                                timestamp: newLog.timestamp,
                                method: newLog.method,
                                serviceSlot: newLog.service_slot,
                                serviceName: newLog.service_name
                            });
                            localStorage.setItem('nexus_attendance_log', JSON.stringify(current));
                            // Refresh Admin UI if open
                            if (typeof renderAdminUserList === 'function') renderAdminUserList();
                        }
                    }
                },
                // On Config Update (Schedule, Theme, Location)
                (newConfig) => {
                    if (newConfig) {
                        if (newConfig.key === 'weekly_schedule') {
                            localStorage.setItem('nexus_schedule_db', JSON.stringify(newConfig.value));
                            console.log("Synced Schedule from Cloud");
                            // DEBUG ALERT FOR MOBILE
                            // alert("📅 Datos recibidos en el celular!\nActualizando tabla...");
                            if (typeof loadTodaySchedule === 'function') loadTodaySchedule();
                            if (typeof loadWeeklyTable === 'function') loadWeeklyTable();
                        }
                        if (newConfig.key === 'weekly_theme') {
                            localStorage.setItem('nexus_theme', newConfig.value.text);
                            console.log("Synced Theme from Cloud");
                            if (typeof loadTheme === 'function') loadTheme();
                        }
                        if (newConfig.key === 'church_location') {
                            // Location sync
                            const currentSettings = JSON.parse(localStorage.getItem('nexus_settings') || '{}');
                            currentSettings.targetLocation = newConfig.value;
                            localStorage.setItem('nexus_settings', JSON.stringify(currentSettings));
                            STATE.targetLocation = newConfig.value;
                            console.log("Synced Location from Cloud");
                            updateLocationStatus();
                        }
                    }
                }
            );

            // GLOBAL USER UPDATE HANDLER
            window.onUserUpdate = (newUser) => {
                if (newUser) {
                    const currentUsers = JSON.parse(localStorage.getItem('nexus_users') || '[]');
                    const exists = currentUsers.find(u => u.phone === newUser.phone);
                    if (!exists) {
                        currentUsers.push({
                            id: newUser.id,
                            phone: newUser.phone,
                            name: newUser.full_name,
                            role: newUser.role,
                            password: newUser.password
                        });
                        localStorage.setItem('nexus_users', JSON.stringify(currentUsers));
                        console.log("New User Synced from Cloud:", newUser.full_name);
                        // Updates Admin UI if visible
                        if (typeof renderAdminUserList === 'function') renderAdminUserList();
                        // Also update login dropdown if on login screen
                        const select = document.getElementById('login-phone');
                        if (select) populateUserSelect(select);
                    }
                }
            };

            // Force Sync Button Injection (for Debugging/Manual Sync)
            if (!document.getElementById('force-sync-btn')) {
                const btn = document.createElement('button');
                btn.id = 'force-sync-btn';
                btn.innerHTML = '🔄 Sincronizar';
                btn.style.cssText = "position:fixed; bottom:20px; left:20px; z-index:9999; background:rgba(0,0,0,0.6); color:white; border:1px solid #444; padding:5px 10px; border-radius:5px; font-size:0.8rem; cursor:pointer;";
                btn.onclick = async () => {
                    btn.innerHTML = "⏳ ...";
                    try {
                        await initApp(); // Re-run sync
                        alert("✅ Sincronización Forzada Completa");
                    } catch (e) { alert("Error: " + e.message); }
                    btn.innerHTML = "🔄 Sincronizar";
                };
                document.body.appendChild(btn);
            }

            // Diagnostic Button (Inspect Data)
            if (!document.getElementById('diag-btn')) {
                const btn = document.createElement('button');
                btn.id = 'diag-btn';
                btn.innerHTML = '🔍 Check Data';
                btn.style.cssText = "position:fixed; bottom:20px; left:140px; z-index:9999; background:rgba(0,0,0,0.6); color:yellow; border:1px solid #444; padding:5px 10px; border-radius:5px; font-size:0.8rem; cursor:pointer;";
                btn.onclick = () => {
                    const schedule = JSON.parse(localStorage.getItem('nexus_schedule_db') || '{}');
                    const keys = Object.keys(schedule).sort();
                    const count = keys.length;
                    const today = new Date().toISOString().split('T')[0];

                    // Check today
                    const hasToday = keys.includes(today);
                    const sample = keys.slice(0, 5).join('\n');

                    alert(`🔍 DATOS LOCALES:\n\n- Fechas en Memoria: ${count}\n- Tiene Hoy (${today})?: ${hasToday ? 'SÍ' : 'NO'}\n\nPrimeras 5 Fechas:\n${sample}`);
                };
                document.body.appendChild(btn);
            }

            // Initial Fetch of Configs
            const cloudTheme = await window.DB.fetchConfig('weekly_theme');
            if (cloudTheme) {
                localStorage.setItem('nexus_theme', cloudTheme.text);
                if (typeof loadTheme === 'function') loadTheme();
            }

            const cloudLoc = await window.DB.fetchConfig('church_location');
            if (cloudLoc) {
                const currentSettings = JSON.parse(localStorage.getItem('nexus_settings') || '{}');
                currentSettings.targetLocation = cloudLoc;
                localStorage.setItem('nexus_settings', JSON.stringify(currentSettings));
                STATE.targetLocation = cloudLoc;
                updateLocationStatus();
            }

        } catch (e) {
            console.warn("Cloud Sync Failed (Offline?)", e);
        }
    }

    // MIGRATION: Ensure all users have IDs
    const users = JSON.parse(localStorage.getItem('nexus_users') || '[]');
    let modified = false;
    users.forEach((u, index) => {
        if (!u.id) {
            u.id = 'user-' + Date.now() + '-' + index; // Unique ID
            modified = true;
        }
    });
    if (modified) {
        localStorage.setItem('nexus_users', JSON.stringify(users));
    }

    // Load settings
    const savedSettings = localStorage.getItem('nexus_settings');
    if (savedSettings) {
        const settings = JSON.parse(savedSettings);
        if (settings.targetLocation) {
            STATE.user = user;
            STATE.targetLocation = settings.targetLocation;
        }
    }

    // Check for ACTIVE SESSION
    const activeSession = localStorage.getItem('nexus_session');
    if (activeSession === 'active') {
        const accountData = localStorage.getItem('nexus_account');
        if (accountData) {
            try {
                const user = JSON.parse(accountData);
                STATE.user = user;

                // If ADMIN, Start Realtime Listener
                if (user.role === 'admin' && window.DB) {
                    window.DB.subscribeToChanges((newEntry, isDelete) => {
                        console.log("Realtime Update Recibido!");
                        // If delete, we might need to re-fetch or find and remove.
                        // Ideally: Re-sync today's log or just append if insert.
                        if (isDelete) {
                            // Quick hack: Reload all today's logs
                            // Or notify user "Data Changed"
                            showToast("♻️ Datos actualizados remotamente", "warning");
                            setTimeout(() => window.location.reload(), 1000); // Brute force sync
                        } else if (newEntry) {
                            // Append to local log
                            const localLog = JSON.parse(localStorage.getItem('nexus_attendance_log') || '[]');
                            // Check dupe
                            const exists = localLog.find(l => l.timestamp === newEntry.timestamp && l.userId === newEntry.user_phone);
                            if (!exists) {
                                localLog.push({
                                    userId: newEntry.user_phone,
                                    name: newEntry.user_name,
                                    timestamp: newEntry.timestamp,
                                    method: newEntry.method,
                                    serviceSlot: newEntry.service_slot,
                                    serviceName: newEntry.service_name
                                });
                                localStorage.setItem('nexus_attendance_log', JSON.stringify(localLog));
                                showToast(`📡 Nueva Asistencia: ${newEntry.user_name}`);
                                if (typeof renderAdminUserList === 'function') renderAdminUserList();
                            }
                        }
                    });
                }

                showDashboard(user);
            } catch (e) {
                console.error("Account data corrupted", e);
                localStorage.removeItem('nexus_session');
                showLogin();
            }
        } else {
            localStorage.removeItem('nexus_session');
            showLogin();
        }
    } else {
        if (localStorage.getItem('nexus_account')) {
            showLogin();
        } else {
            showRegister();
        }
    }
}

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

        // CHECK-IN BUTTON LOGIC
        if (fingerprintBtn) {
            // UI State Updater
            window.updateCheckInStatus = function () {
                if (!STATE.user) return; // Not logged in

                const now = new Date();
                const { isOpen } = getServiceSlot(now);
                const inFence = STATE.inGeofence || (STATE.user.role === 'admin'); // Admins bypass geo? User didn't specify, but nice to have. Assume strict for now unless admin.
                // Strict per user request: "si no estan dentro de la geocerca... mensaje"
                // Let's stick to strict logic for "Member Panel".

                const btnContainer = document.querySelector('.fingerprint-container');
                const instruction = document.querySelector('.instruction-text');

                if (isOpen && STATE.inGeofence) {
                    // ACTIVE STATE
                    if (btnContainer) {
                        btnContainer.classList.add('active'); // Pulse effect
                        btnContainer.classList.add('scanning'); // Scan line
                        btnContainer.style.opacity = '1';
                        btnContainer.style.cursor = 'pointer';
                        btnContainer.style.pointerEvents = 'auto'; // ENABLE CLICK
                        btnContainer.style.borderColor = 'var(--primary-gold)';
                    }
                    if (instruction) {
                        instruction.textContent = "DETECTANDO HUELLA... PRESIONA PARA REGISTRAR";
                        instruction.style.color = "var(--primary-gold)";
                    }
                } else {
                    // INACTIVE STATE
                    if (btnContainer) {
                        btnContainer.classList.remove('active');
                        btnContainer.classList.remove('scanning');
                        btnContainer.style.opacity = '0.5';
                        btnContainer.style.cursor = 'not-allowed';
                        btnContainer.style.pointerEvents = 'none'; // DISABLE CLICK
                        btnContainer.style.borderColor = '#ccc';
                    }
                    if (instruction) {
                        if (!isOpen) instruction.textContent = "FUERA DE HORARIO DE CULTO";
                        else if (!STATE.inGeofence) instruction.textContent = "BUSCANDO UBICACIÓN DEL TEMPLO...";
                        instruction.style.color = "var(--text-muted)";
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
                    const method = hasAttendedService.method === 'manual_admin' ? 'por el Administrador' : 'previamente';
                    alert(`⚠️ YA REGISTRADO\n\nYa marcaste asistencia para: ${slotName}.`);
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
    } // End of fingerprintBtn check

    // Register Logic
    if (registerForm) {
        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const nombre = document.getElementById('reg-nombre').value;
            const apellidoP = document.getElementById('reg-paterno').value;
            const apellidoM = document.getElementById('reg-materno').value;
            const celular = document.getElementById('reg-celular').value;
            const password = document.getElementById('reg-password').value;
            const fullName = `${nombre} ${apellidoP} ${apellidoM}`;

            const newUser = {
                id: 'user-' + Date.now(),
                phone: String(celular).trim(),
                password: String(password).trim(),
                role: 'user',
                full_name: fullName
            };

            try {
                // SUPABASE SYNC
                if (window.DB) {
                    await window.DB.registerUser(newUser);
                }

                localStorage.setItem('nexus_account', JSON.stringify(newUser));
                const allUsers = JSON.parse(localStorage.getItem('nexus_users') || '[]');
                if (!allUsers.find(u => u.phone === newUser.phone)) {
                    allUsers.push({ ...newUser, createdAt: new Date().toISOString() });
                    localStorage.setItem('nexus_users', JSON.stringify(allUsers));
                }
                localStorage.setItem('nexus_session', 'active');
                STATE.user = newUser;

                alert(`REGISTRO EXITOSO\nBienvenido, ${nombre}.`);

                // Direct Transition without Reload
                window.location.hash = ''; // Clear any hash
                initApp(); // Re-run init to set up UI
            } catch (err) {
                console.error("Register Error:", err);
                // Detailed alert for mobile debugging
                const msg = err.message || JSON.stringify(err);
                const hint = err.hint || err.details || '';
                alert(`❌ ERROR AL GUARDAR:\n\n${msg}\n\n${hint}`);
            }
        });
    }

    // Logout
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            if (confirm("¿Cerrar sesión?")) {
                localStorage.removeItem('nexus_session');
                location.reload();
            }
        });
    }

    // Init Logic
    try {
        seedScheduleData();
        initApp();
        initAdminFeatures();
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
