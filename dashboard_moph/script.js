let allUnits = [];
let currentProvince = 'all';

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    if (typeof initialData !== 'undefined') {
        // Deep copy from data.js
        allUnits = JSON.parse(JSON.stringify(initialData));
        
        // Load and merge local modifications if any
        const localData = localStorage.getItem('moph_rates_db');
        if (localData) {
            const parsedLocal = JSON.parse(localData);
            allUnits.forEach(u => {
                const localUnit = parsedLocal.find(l => l.name === u.name);
                if (localUnit) {
                    // Restore admin-editable progress properties
                    if (localUnit.status !== undefined) u.status = localUnit.status;
                    if (localUnit.startDate) u.startDate = localUnit.startDate;
                    if (localUnit.updateDate) u.updateDate = localUnit.updateDate;
                    if (localUnit.fileLink) u.fileLink = localUnit.fileLink;
                    
                    // ONLY restore rates if user modified the status, or specifically for 'สำนักงานสาธารณสุขจังหวัดลำพูน'
                    if (localUnit.status > 0 || u.name === 'สำนักงานสาธารณสุขจังหวัดลำพูน') {
                        if (localUnit.rate_total !== undefined) u.rate_total = localUnit.rate_total;
                        
                        u.rate_lower_thai = localUnit.rate_lower_thai ?? localUnit.rate_lower ?? u.rate_lower_thai;
                        u.rate_equal_thai = localUnit.rate_equal_thai ?? localUnit.rate_equal ?? u.rate_equal_thai;
                        u.rate_higher_thai = localUnit.rate_higher_thai ?? localUnit.rate_higher ?? u.rate_higher_thai;
                        
                        u.rate_lower_inter = localUnit.rate_lower_inter ?? u.rate_lower_inter;
                        u.rate_equal_inter = localUnit.rate_equal_inter ?? u.rate_equal_inter;
                        u.rate_higher_inter = localUnit.rate_higher_inter ?? localUnit.rate_inter_higher ?? u.rate_higher_inter;
                    }
                }
            });
            localStorage.setItem('moph_rates_db', JSON.stringify(allUnits));
            console.log('Merged ' + allUnits.length + ' units with LocalStorage progress.');
        } else {
            console.log('Loaded ' + allUnits.length + ' units from initial data.js.');
        }
    } else {
        const localData = localStorage.getItem('moph_rates_db');
        if (localData) {
            allUnits = JSON.parse(localData);
            console.log('Loaded ' + allUnits.length + ' units strictly from LocalStorage.');
        }
    }

    if (document.getElementById('total-units')) {
        initDashboard();
    }
    if (document.getElementById('unit-select')) {
        initAdmin();
    }
});

// --- Dashboard Logic ---

function initDashboard() {
    updateStats();
    initProvinceCards();
    renderTable();
}

function updateStats() {
    const targetUnits = currentProvince === 'all' 
        ? allUnits 
        : allUnits.filter(u => u.province === currentProvince);

    const total = targetUnits.length;
    const completed = targetUnits.filter(u => u.status == 5).length;
    const noservice = targetUnits.filter(u => u.status == 6).length;
    const pending = targetUnits.filter(u => u.status >= 1 && (u.status <= 4 || u.status == 7)).length;

    if (document.getElementById('total-units')) {
        document.getElementById('total-units').textContent = total.toLocaleString();
        document.getElementById('completed-units').textContent = completed.toLocaleString();
        document.getElementById('noservice-units').textContent = noservice.toLocaleString();
        document.getElementById('pending-units').textContent = pending.toLocaleString();
    }
}

function initProvinceCards() {
    const provinceGrid = document.getElementById('province-grid');
    if (!provinceGrid) return;

    const provinces = [...new Set(allUnits.map(u => u.province))].filter(p => p && p !== 'None' && p !== 'ѧѴ').sort();
    
    provinceGrid.innerHTML = '';
    
    // "All" Card
    const allCard = createProvCard('ทุกจังหวัด', allUnits, 'all');
    provinceGrid.appendChild(allCard);

    provinces.forEach(prov => {
        const provUnits = allUnits.filter(u => u.province === prov);
        const card = createProvCard(prov, provUnits, prov);
        provinceGrid.appendChild(card);
    });
}

function createProvCard(name, units, value) {
    const card = document.createElement('div');
    card.className = `province-card ${currentProvince === value ? 'active' : ''}`;
    
    const notStarted = units.filter(u => !u.status || u.status == 0).length;
    const pending = units.filter(u => u.status >= 1 && (u.status <= 4 || u.status == 7)).length;
    const none = units.filter(u => u.status == 6).length;
    const done = units.filter(u => u.status == 5).length;

    card.innerHTML = `
        <h3>${name} <span style="font-size: 0.9rem; opacity: 0.7;">(${units.length})</span></h3>
        <div class="province-stats-row" style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem; text-align: left; font-size: 0.85rem; margin-top: 0.5rem;">
            <div class="p-stat" style="color: var(--danger); background: #fce4ec; padding: 4px; border-radius: 4px;">⏳ ยังไม่ได้ดำเนินการ: ${notStarted}</div>
            <div class="p-stat pending" style="color: var(--warning); background: #fffde7; padding: 4px; border-radius: 4px;">🔄 อยู่ระหว่างดำเนินการ: ${pending}</div>
            <div class="p-stat none" style="color: #666; background: #f5f5f5; padding: 4px; border-radius: 4px;">🚫 ไม่มีบริการ: ${none}</div>
            <div class="p-stat done" style="color: var(--success); background: #e8f5e9; padding: 4px; border-radius: 4px;">✅ เสร็จสิ้น: ${done}</div>
        </div>
    `;
    
    card.onclick = () => {
        currentProvince = value;
        document.querySelectorAll('.province-card').forEach(c => c.classList.remove('active'));
        card.classList.add('active');
        updateStats();
        renderTable();
    };
    
    return card;
}

function handleSearch() { renderTable(); }
function handleFilter() { renderTable(); }

function renderTable() {
    const tbody = document.getElementById('table-body');
    if (!tbody) return;

    const searchTerm = document.getElementById('search-input').value.toLowerCase();
    const statusFilter = document.getElementById('status-filter').value;
    
    tbody.innerHTML = '';
    
    let filtered = allUnits.filter(u => {
        const matchProv = currentProvince === 'all' || u.province === currentProvince;
        const matchSearch = u.name.toLowerCase().includes(searchTerm) || (u.code && u.code.includes(searchTerm));
        const matchStatus = statusFilter === 'all' || u.status.toString() === statusFilter;
        return matchProv && matchSearch && matchStatus;
    });

    // Sorting: 5 (Done), 1-4 (Pending), 6 (No Service), 0 (Initial)
    filtered.sort((a, b) => {
        const priority = (s) => {
            if (s == 5) return 10;
            if (s == 7) return 8; // high priority within pending items
            if (s >= 1 && s <= 4) return s + 2;
            if (s == 6) return 1;
            return 0;
        };
        return priority(b.status) - priority(a.status);
    });

    filtered.forEach(u => {
        const tr = document.createElement('tr');
        tr.className = 'animate-in';
        
        let rateHtml = '';
        if (u.status == 3 || u.rate_total > 0) {
            // Support legacy and new fields
            const lThai = u.rate_lower_thai ?? u.rate_lower ?? 0;
            const eThai = u.rate_equal_thai ?? u.rate_equal ?? 0;
            const hThai = u.rate_higher_thai ?? u.rate_higher ?? 0;
            
            const lInter = u.rate_lower_inter ?? 0;
            const eInter = u.rate_equal_inter ?? 0;
            const hInter = u.rate_higher_inter ?? u.rate_inter_higher ?? 0;
            
            rateHtml = `
                <div class="rate-details">
                    <div class="rate-item" style="margin-bottom: 2px;">👤 <b>ไทย:</b> ต่ำกว่า: <span style="color:var(--success)">${lThai}</span>, เท่ากับ: <span style="color:var(--success)">${eThai}</span>, สูงกว่า: <span style="color:var(--danger)">${hThai}</span></div>
                    <div class="rate-item">🌍 <b>ต่างชาติ:</b> ต่ำกว่า: <span style="color:var(--success)">${lInter}</span>, เท่ากับ: <span style="color:var(--success)">${eInter}</span>, สูงกว่า: <span style="color:var(--danger)">${hInter}</span></div>
                </div>
            `;
        }

        tr.innerHTML = `
            <td>
                <span class="unit-code" style="background:#e0f2f1; padding:4px 8px; border-radius:4px; font-size:0.9rem;">${u.code || '-'}</span>
            </td>
            <td>
                <span class="unit-name">${u.name}</span>
                <span class="unit-type">${u.type || '-'}</span>
                ${rateHtml}
            </td>
            <td><span style="font-weight: 700; color: var(--primary);">${u.province}</span></td>
            <td><span class="status-badge status-${u.status}">${getStatusText(u.status)}</span></td>
            <td style="font-weight: 600; color: var(--text-muted);">${u.updateDate || u.startDate || '-'}</td>
            <td>
                ${u.fileLink ? `<a href="${u.fileLink}" target="_blank" class="link-btn">🔗 ไฟล์</a>` : '-'}
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function getStatusText(s) {
    const texts = [
        '0. รอการตรวจสอบ/ยังไม่ได้รับข้อมูล',
        '1. ส่งเอกสารแล้ว (ตรวจ 7.1)',
        '2. กบรส. อยู่ระหว่างพิจารณา (7.2)',
        '3. อยู่ระหว่างคณะกรรมการกลั่นกรอง',
        '4. เสนอผู้ตรวจฯ พิจารณาอนุมัติ',
        '5. อนุมัติและดำเนินการเสร็จสิ้น',
        '6. เสร็จสิ้น (ไม่มีบริการ/ราคา)',
        '7. แจ้งแก้ไขข้อมูล'
    ];
    return texts[s] || 'Unknown';
}

// --- Admin Logic ---

const ADMIN_HASH = '4510feeff0c6864d291fcef1d4f86a496684097b24435615aa7e2e99d4e99838'; // 053890238-40

function login() {
    const pass = document.getElementById('password').value;
    const hash = CryptoJS.SHA256(pass).toString();
    
    if (hash === ADMIN_HASH) {
        document.getElementById('login-section').style.display = 'none';
        document.getElementById('admin-section').style.display = 'block';
    } else {
        document.getElementById('login-error').style.display = 'block';
    }
}

function initAdmin(filterText = '') {
    const datalist = document.getElementById('unit-options');
    if (!datalist) return;

    datalist.innerHTML = '';

    const sorted = [...allUnits].sort((a, b) => {
        if (a.province !== b.province) return a.province.localeCompare(b.province, 'th');
        return a.name.localeCompare(b.name, 'th');
    });

    sorted.forEach(u => {
        const opt = document.createElement('option');
        opt.value = u.name;
        opt.textContent = `[รหัส: ${u.code || '---'}] ${u.name} (จ.${u.province})`;
        datalist.appendChild(opt);
    });
}

function handleAdminSearch() {
    // No longer needed with datalist, search is built-in
}

function loadUnitData() {
    const name = document.getElementById('unit-select').value;
    const unit = allUnits.find(u => u.name === name);
    
    if (unit) {
        document.getElementById('unit-details').style.display = 'block';
        document.getElementById('display-unit-name').innerHTML = `<span style="background:var(--primary); color:white; padding:4px 8px; border-radius:6px; font-size:0.9rem; margin-right:8px;">รหัส: ${unit.code || 'ไม่มี'}</span> ${unit.name}`;
        document.getElementById('edit-status').value = unit.status || 0;
        document.getElementById('edit-start-date').value = unit.startDate || '';
        document.getElementById('edit-file-link').value = unit.fileLink || '';
        
        // Load rate details if exist
        document.getElementById('edit-rate-total').value = unit.rate_total || 0;
        document.getElementById('edit-rate-lower-thai').value = unit.rate_lower_thai ?? unit.rate_lower ?? 0;
        document.getElementById('edit-rate-equal-thai').value = unit.rate_equal_thai ?? unit.rate_equal ?? 0;
        document.getElementById('edit-rate-higher-thai').value = unit.rate_higher_thai ?? unit.rate_higher ?? 0;
        document.getElementById('edit-rate-lower-inter').value = unit.rate_lower_inter || 0;
        document.getElementById('edit-rate-equal-inter').value = unit.rate_equal_inter || 0;
        document.getElementById('edit-rate-higher-inter').value = unit.rate_higher_inter ?? unit.rate_inter_higher ?? 0;
    } else {
        document.getElementById('unit-details').style.display = 'none';
    }
}

function saveChange() {
    const name = document.getElementById('unit-select').value;
    const unitIndex = allUnits.findIndex(u => u.name === name);
    
    if (unitIndex !== -1) {
        const newStatus = parseInt(document.getElementById('edit-status').value);
        allUnits[unitIndex].status = newStatus;
        allUnits[unitIndex].startDate = document.getElementById('edit-start-date').value;
        allUnits[unitIndex].fileLink = document.getElementById('edit-file-link').value;
        
        let rTotal = parseInt(document.getElementById('edit-rate-total').value) || 0;
        let rLowerThai = parseInt(document.getElementById('edit-rate-lower-thai').value) || 0;
        let rEqualThai = parseInt(document.getElementById('edit-rate-equal-thai').value) || 0;
        let rHigherThai = parseInt(document.getElementById('edit-rate-higher-thai').value) || 0;
        let rLowerInter = parseInt(document.getElementById('edit-rate-lower-inter').value) || 0;
        let rEqualInter = parseInt(document.getElementById('edit-rate-equal-inter').value) || 0;
        let rHigherInter = parseInt(document.getElementById('edit-rate-higher-inter').value) || 0;
        
        // If status is 6 (ไม่มีการให้บริการ), reset rates to 0
        if (newStatus === 6) {
            rTotal = 0; rLowerThai = 0; rEqualThai = 0; rHigherThai = 0; rLowerInter = 0; rEqualInter = 0; rHigherInter = 0;
            document.getElementById('edit-rate-total').value = 0;
            document.getElementById('edit-rate-lower-thai').value = 0;
            document.getElementById('edit-rate-equal-thai').value = 0;
            document.getElementById('edit-rate-higher-thai').value = 0;
            document.getElementById('edit-rate-lower-inter').value = 0;
            document.getElementById('edit-rate-equal-inter').value = 0;
            document.getElementById('edit-rate-higher-inter').value = 0;
        }

        // Save rate details
        allUnits[unitIndex].rate_total = rTotal;
        allUnits[unitIndex].rate_lower_thai = rLowerThai;
        allUnits[unitIndex].rate_equal_thai = rEqualThai;
        allUnits[unitIndex].rate_higher_thai = rHigherThai;
        allUnits[unitIndex].rate_lower_inter = rLowerInter;
        allUnits[unitIndex].rate_equal_inter = rEqualInter;
        allUnits[unitIndex].rate_higher_inter = rHigherInter;
        
        // Unset old properties to avoid conflicts over time
        delete allUnits[unitIndex].rate_lower;
        delete allUnits[unitIndex].rate_equal;
        delete allUnits[unitIndex].rate_higher;
        delete allUnits[unitIndex].rate_inter_higher;
        
        // Updated date (display date chosen by admin)
        allUnits[unitIndex].updateDate = document.getElementById('edit-start-date').value || new Date().toISOString().split('T')[0];
        
        localStorage.setItem('moph_rates_db', JSON.stringify(allUnits));
        alert('บันทึกข้อมูลเรียบร้อยแล้ว!');
        renderTable();
        updateStats();
    }
}

function exportToFile() {
    const dataStr = 'const initialData = ' + JSON.stringify(allUnits, null, 2) + ';';
    const blob = new Blob([dataStr], { type: 'application/javascript' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'data.js';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}
