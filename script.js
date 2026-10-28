let allUnits = [];
let currentProvince = 'all';

// Google Apps Script API — แหล่งข้อมูลจริงเพียงแหล่งเดียวของระบบ (แก้ไขข้อมูลที่ Google Sheet โดยตรง)
const GOOGLE_SHEET_API = 'https://script.google.com/macros/s/AKfycbxRA6nelIcu7EhHX7Et-aBLCr9tgQu00zYFz619ocKeFrvDTb__hfsXa08Q2ItW99Zd/exec';

// cache ไว้แสดงผลตอน Apps Script ล่ม/ช้า เท่านั้น — ไม่ใช่ที่เก็บข้อมูลแก้ไข
const CACHE_KEY = 'moph_rates_cache';
const CACHE_TIME_KEY = 'moph_rates_cache_time';

// Apps Script ตอบกลับช้า 4-10 วิ และส่ง no-store ทุกครั้ง (cache ชั้นไหนก็ไม่ช่วย)
// ความถี่นี้จึงเท่ากับจำนวนครั้งที่สคริปต์ถูกรันจริง — อย่าลดต่ำกว่านี้โดยไม่วัดผลก่อน
const REFRESH_INTERVAL = 90000;

let lastDataHash = null;
let lastFetchAt = 0;
let refreshTimer = null;

// --- Data Loading ---

async function fetchFromSheet() {
    const res = await fetch(GOOGLE_SHEET_API, { cache: 'no-store' });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) throw new Error('ข้อมูลที่ได้รับว่างเปล่า');
    return data;
}

function readCache() {
    try {
        const raw = localStorage.getItem(CACHE_KEY);
        if (!raw) return null;
        const data = JSON.parse(raw);
        if (!Array.isArray(data) || data.length === 0) return null;
        return { data, time: localStorage.getItem(CACHE_TIME_KEY) };
    } catch (err) {
        console.warn('อ่าน cache ไม่สำเร็จ:', err);
        return null;
    }
}

function writeCache(data) {
    try {
        localStorage.setItem(CACHE_KEY, JSON.stringify(data));
        localStorage.setItem(CACHE_TIME_KEY, new Date().toISOString());
    } catch (err) {
        console.warn('เขียน cache ไม่สำเร็จ:', err);
    }
}

async function loadData(isInitial = false) {
    try {
        const data = await fetchFromSheet();
        lastFetchAt = Date.now();
        writeCache(data);

        const hash = calculateDataHash(data);
        if (isInitial || hash !== lastDataHash) {
            allUnits = data;
            lastDataHash = hash;
            renderAll();
        }
        setDataStatus('live', new Date().toISOString());
    } catch (err) {
        console.error('ดึงข้อมูลจาก Google Sheet ไม่สำเร็จ:', err);

        if (!isInitial) {
            setDataStatus('stale', localStorage.getItem(CACHE_TIME_KEY));
            return;
        }

        const cached = readCache();
        if (cached) {
            allUnits = cached.data;
            lastDataHash = calculateDataHash(allUnits);
            renderAll();
            setDataStatus('cache', cached.time);
        } else {
            setDataStatus('error', null);
            showTableMessage('❌ โหลดข้อมูลไม่สำเร็จ และไม่มีข้อมูลสำรองในเครื่องนี้ — กรุณารีเฟรชหน้าอีกครั้ง');
        }
    }
}

function calculateDataHash(data) {
    return JSON.stringify(data).split('').reduce((a, b) => {
        a = ((a << 5) - a) + b.charCodeAt(0);
        return a & a;
    }, 0).toString();
}

function startAutoRefresh() {
    if (refreshTimer) clearInterval(refreshTimer);

    refreshTimer = setInterval(() => {
        if (document.hidden) return; // แท็บไม่ได้เปิดอยู่ ไม่ต้องรบกวน Apps Script
        loadData();
    }, REFRESH_INTERVAL);

    document.addEventListener('visibilitychange', () => {
        if (!document.hidden && Date.now() - lastFetchAt > REFRESH_INTERVAL) {
            loadData();
        }
    });
}

// --- Data Status Badge ---

function formatThaiDateTime(iso) {
    if (!iso) return '-';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '-';
    const months = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear() + 543} ${hh}:${mm} น.`;
}

function setDataStatus(state, iso) {
    const el = document.getElementById('data-status');
    if (!el) return;

    const when = formatThaiDateTime(iso);
    const states = {
        loading: ['ds-loading', '⏳ กำลังโหลดข้อมูลจาก Google Sheet...'],
        live: ['ds-live', `🟢 ข้อมูลล่าสุดจาก Google Sheet ณ ${when}`],
        cache: ['ds-cache', `🟡 เชื่อมต่อ Google Sheet ไม่สำเร็จ — กำลังแสดงข้อมูลสำรองในเครื่อง ณ ${when}`],
        stale: ['ds-cache', `🟡 รีเฟรชล่าสุดไม่สำเร็จ — ข้อมูลที่แสดงอยู่คือ ณ ${when}`],
        error: ['ds-error', '🔴 โหลดข้อมูลไม่สำเร็จ และไม่มีข้อมูลสำรองในเครื่องนี้']
    };

    const [cls, text] = states[state] || states.error;
    el.className = 'data-status ' + cls;
    el.textContent = text;
}

// --- Initialize ---

document.addEventListener('DOMContentLoaded', () => {
    // ล้าง cache รุ่นเก่าที่เคยปนข้อมูลที่แก้จาก Admin Panel ในเครื่อง (เลิกใช้แล้ว)
    try { localStorage.removeItem('moph_rates_db'); } catch (err) { /* โหมดส่วนตัวอาจบล็อก */ }

    if (!document.getElementById('total-units')) return;

    initDashboard();
    setDataStatus('loading', null);
    showTableMessage('⏳ กำลังโหลดข้อมูลจาก Google Sheet...');
    loadData(true);
    startAutoRefresh();
});

// --- Dashboard Logic ---

function initDashboard() {
    const searchInput = document.getElementById('search-input');
    const statusFilter = document.getElementById('status-filter');

    if (searchInput) {
        searchInput.addEventListener('input', debounce(() => renderTable(), 250));
    }
    if (statusFilter) {
        statusFilter.addEventListener('change', () => renderTable());
    }
}

function renderAll() {
    updateStats();
    initProvinceCards();
    renderTable();
}

function showTableMessage(msg) {
    const tbody = document.getElementById('table-body');
    if (!tbody) return;
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:3rem; color:var(--text-muted); font-weight:600;">${msg}</td></tr>`;
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

    const provinces = [...new Set(allUnits.map(u => u.province))].filter(p => p && p !== 'None').sort();

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

function renderTable() {
    const tbody = document.getElementById('table-body');
    if (!tbody) return;

    const searchTerm = document.getElementById('search-input').value.toLowerCase().trim();
    const statusFilter = document.getElementById('status-filter').value;

    tbody.innerHTML = '';

    let filtered = allUnits.filter(u => {
        const matchProv = currentProvince === 'all' || u.province === currentProvince;
        const matchSearch = termMatches(u, searchTerm);
        const matchStatus = statusFilter === 'all' || u.status.toString() === statusFilter;
        return matchProv && matchSearch && matchStatus;
    });

    // Sorting
    filtered.sort((a, b) => {
        const priority = (s) => {
            if (s == 5) return 10;
            if (s == 7) return 8;
            if (s >= 1 && s <= 4) return s + 2;
            if (s == 6) return 1;
            return 0;
        };
        return priority(b.status) - priority(a.status);
    });

    if (filtered.length === 0) {
        showTableMessage(allUnits.length === 0
            ? '⏳ กำลังโหลดข้อมูลจาก Google Sheet...'
            : '🔍 ไม่พบหน่วยบริการที่ตรงกับเงื่อนไขที่เลือก');
        return;
    }

    // Batch DOM updates using DocumentFragment
    const fragment = document.createDocumentFragment();

    // Performance: Limit initial render to 250 rows if searching (keeps UI fluid)
    const displayLimit = searchTerm ? 250 : filtered.length;
    const itemsToShow = filtered.slice(0, displayLimit);

    itemsToShow.forEach(u => {
        const tr = document.createElement('tr');
        tr.className = 'animate-in';

        let rateHtml = '';
        if (u.status == 3 || u.rate_total > 0) {
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
            <td><span class="unit-code" style="background:#e0f2f1; padding:4px 8px; border-radius:4px; font-size:0.9rem;">${u.code || '-'}</span></td>
            <td>
                <span class="unit-name">${u.name}</span>
                <span class="unit-type">${u.type || '-'}</span>
                ${rateHtml}
            </td>
            <td><span style="font-weight: 700; color: var(--primary);">${u.province}</span></td>
            <td><span class="status-badge status-${u.status}">${getStatusText(u.status)}</span></td>
            <td style="font-weight: 600; color: var(--text-muted);">${u.updateDate || u.startDate || '-'}</td>
            <td>${u.fileLink ? `<a href="${u.fileLink}" target="_blank" class="link-btn">🔗 ไฟล์</a>` : '-'}</td>
        `;
        fragment.appendChild(tr);
    });

    tbody.appendChild(fragment);

    // If results were capped, add a note
    if (filtered.length > displayLimit) {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td colspan="6" style="text-align:center; padding: 2rem; color: var(--text-muted);">
            แสดงผล ${displayLimit} รายการแรกจากทั้งหมด ${filtered.length} รายการ (กรุณาพิมพ์เพื่อระบุหน่วยบริการที่เจาะจงมากขึ้น)
        </td>`;
        tbody.appendChild(tr);
    }
}

// Utility: term matching
function termMatches(u, term) {
    if (!term) return true;
    return u.name.toLowerCase().includes(term) ||
           (u.code && u.code.includes(term)) ||
           u.province.toLowerCase().includes(term);
}

// Utility: Debounce
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
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
