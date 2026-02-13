
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

    // 4. PREPARE EXPORT DATA
    reportDataExport = filtered.map(entry => {
        const u = users.find(x => x.id === entry.userId) || {};
        const serviceName = entry.serviceName || entry.serviceSlot;

        return {
            Fecha: entry.timestamp.split('T')[0],
            Hora: new Date(entry.timestamp).toLocaleTimeString(),
            Nombre: u.full_name || u.name || 'Desconocido',
            ID: entry.userId,
            Culto: serviceName,
            Rol: u.role || 'user'
        };
    });
};

window.exportReportToExcel = function () {
    if (reportDataExport.length === 0) return alert("No hay datos para exportar.");

    // Create Worksheet
    const ws = XLSX.utils.json_to_sheet(reportDataExport);

    // Create Workbook
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Reporte Asistencia");

    // File Name
    const startVal = document.getElementById('report-start').value;
    const endVal = document.getElementById('report-end').value;
    const filename = `Asistencia_LLDM_${startVal}_al_${endVal}.xlsx`;

    // Download
    XLSX.writeFile(wb, filename);
};
