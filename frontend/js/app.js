// ==================== State ====================
let currentUser = null;
let provinces = [];
let locationTypes = [];

// ==================== API Helper ====================
async function api(endpoint, options = {}) {
    const response = await fetch(`${API_URL}/api${endpoint}`, {
        ...options,
        credentials: 'include',
        headers: {
            'Content-Type': 'application/json',
            ...options.headers
        }
    });
    
    const data = await response.json();
    
    if (!response.ok) {
        throw new Error(data.error || 'เกิดข้อผิดพลาด');
    }
    
    return data;
}

// ==================== UI Helpers ====================
function showLoading() {
    document.getElementById('loading').classList.add('show');
}

function hideLoading() {
    document.getElementById('loading').classList.remove('show');
}

function showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = `toast ${type} show`;
    
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

function showPage(pageId) {
    document.querySelectorAll('.page').forEach(page => {
        page.classList.remove('active');
    });
    document.getElementById(pageId).classList.add('active');
}

function showModal(modalId) {
    document.getElementById(modalId).classList.add('show');
}

function closeModal(modalId) {
    document.getElementById(modalId).classList.remove('show');
}

// ==================== Google Maps Helper ====================
function openGoogleMaps(lat, lng, name) {
    if (lat && lng) {
        // Open with coordinates
        window.open(`https://www.google.com/maps/search/?api=1&query=${lat},${lng}`, '_blank');
    } else if (name) {
        // Open with address search
        window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(name)}`, '_blank');
    }
}

function getGoogleMapsLink(location) {
    if (location.coordinates && location.coordinates.lat && location.coordinates.lng) {
        return `https://www.google.com/maps/search/?api=1&query=${location.coordinates.lat},${location.coordinates.lng}`;
    }
    
    // Construct address for search
    let address = location.name || '';
    if (location.address) address += ' ' + location.address;
    if (location.subdistrict?.name_th) address += ' ' + location.subdistrict.name_th;
    if (location.district?.name_th) address += ' ' + location.district.name_th;
    if (location.province?.name_th) address += ' ' + location.province.name_th;
    
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
}

// ==================== Tab Navigation ====================
document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', function() {
        const tabGroup = this.closest('.container');
        
        tabGroup.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        tabGroup.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        
        this.classList.add('active');
        const tabId = this.dataset.tab;
        document.getElementById(tabId).classList.add('active');
        
        // Load data for specific tabs
        if (tabId === 'myRecordsTab') {
            loadMyRecords();
        } else if (tabId === 'interestedTab') {
            loadAdminInterests('interested');
        } else if (tabId === 'notInterestedTab') {
            loadAdminInterests('not_interested');
        } else if (tabId === 'usersTab') {
            loadUsers();
        } else if (tabId === 'locationsTab') {
            loadAdminLocations();
        }
    });
});

// ==================== Auth Functions ====================
async function checkAuth() {
    try {
        const response = await fetch(`${API_URL}/api/auth/me`, {
            credentials: 'include'
        });
        
        if (!response.ok) {
            showPage('loginPage');
            return;
        }
        
        const data = await response.json();
        currentUser = data.user;
        
        if (currentUser.role === 'admin') {
            document.getElementById('adminUserName').textContent = currentUser.full_name;
            showPage('adminPage');
            await initAdminPage();
        } else {
            document.getElementById('userName').textContent = currentUser.full_name;
            showPage('employeePage');
            await initEmployeePage();
        }
    } catch (error) {
        showPage('loginPage');
    }
}

// Login form
document.getElementById('loginForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    showLoading();
    
    try {
        const data = await api('/auth/login', {
            method: 'POST',
            body: JSON.stringify({
                username: document.getElementById('loginUsername').value,
                password: document.getElementById('loginPassword').value
            })
        });
        
        currentUser = data.user;
        showToast('เข้าสู่ระบบสำเร็จ', 'success');
        this.reset();
        
        if (currentUser.role === 'admin') {
            document.getElementById('adminUserName').textContent = currentUser.full_name;
            showPage('adminPage');
            await initAdminPage();
        } else {
            document.getElementById('userName').textContent = currentUser.full_name;
            showPage('employeePage');
            await initEmployeePage();
        }
    } catch (error) {
        showToast(error.message, 'error');
    } finally {
        hideLoading();
    }
});

// Register form
document.getElementById('registerForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    showLoading();
    
    try {
        await api('/auth/register', {
            method: 'POST',
            body: JSON.stringify({
                username: document.getElementById('regUsername').value,
                password: document.getElementById('regPassword').value,
                full_name: document.getElementById('regFullName').value,
                email: document.getElementById('regEmail').value,
                phone: document.getElementById('regPhone').value
            })
        });
        
        showToast('สมัครสมาชิกสำเร็จ กรุณาเข้าสู่ระบบ', 'success');
        this.reset();
        showPage('loginPage');
    } catch (error) {
        showToast(error.message, 'error');
    } finally {
        hideLoading();
    }
});

async function logout() {
    try {
        await api('/auth/logout', { method: 'POST' });
        currentUser = null;
        showPage('loginPage');
        showToast('ออกจากระบบแล้ว', 'success');
    } catch (error) {
        showToast(error.message, 'error');
    }
}

// ==================== Thailand Location API ====================
// Cache Thailand data locally for faster access
let thailandData = {
    provinces: [],
    amphures: [],
    tambons: []
};

// Load all Thailand data at once (faster than multiple requests)
async function loadAllThailandData() {
    try {
        showLoading();
        const data = await api('/thailand/all');
        thailandData.provinces = data.provinces || [];
        thailandData.amphures = data.amphures || [];
        thailandData.tambons = data.tambons || [];
        provinces = thailandData.provinces;
        console.log(`✅ Thailand data loaded: ${provinces.length} provinces`);
        return data;
    } catch (error) {
        console.error('Error loading Thailand data:', error);
        // Fallback to individual loading
        await loadProvinces();
        return null;
    } finally {
        hideLoading();
    }
}

async function loadProvinces() {
    try {
        if (thailandData.provinces.length > 0) {
            provinces = thailandData.provinces;
            return provinces;
        }
        provinces = await api('/thailand/provinces');
        thailandData.provinces = provinces;
        return provinces;
    } catch (error) {
        console.error('Error loading provinces:', error);
        return [];
    }
}

function getAmphuresByProvince(provinceId) {
    return thailandData.amphures.filter(a => a.province_id === parseInt(provinceId));
}

function getTambonsByAmphure(amphureId) {
    return thailandData.tambons.filter(t => t.amphure_id === parseInt(amphureId));
}

async function loadAmphures(provinceId) {
    try {
        // Use cached data if available
        if (thailandData.amphures.length > 0) {
            return getAmphuresByProvince(provinceId);
        }
        return await api(`/thailand/amphures/${provinceId}`);
    } catch (error) {
        console.error('Error loading amphures:', error);
        return [];
    }
}

async function loadTambons(amphureId) {
    try {
        // Use cached data if available
        if (thailandData.tambons.length > 0) {
            return getTambonsByAmphure(amphureId);
        }
        return await api(`/thailand/tambons/${amphureId}`);
    } catch (error) {
        console.error('Error loading tambons:', error);
        return [];
    }
}

async function loadLocationTypes() {
    try {
        locationTypes = await api('/location-types');
        return locationTypes;
    } catch (error) {
        console.error('Error loading location types:', error);
        return [];
    }
}

// ==================== Employee Functions ====================
async function initEmployeePage() {
    await loadAllThailandData();
    await loadLocationTypes();
    populateSearchFilters();
    populateAddLocationForm();
    await searchLocations();
}

function populateSearchFilters() {
    // Populate province select
    const provinceSelect = document.getElementById('searchProvince');
    provinceSelect.innerHTML = '<option value="">-- ทั้งหมด --</option>';
    provinces.forEach(p => {
        provinceSelect.innerHTML += `<option value="${p.name_th}" data-id="${p.id}">${p.name_th}</option>`;
    });
    
    // Populate type select
    const typeSelect = document.getElementById('searchType');
    typeSelect.innerHTML = '<option value="">-- ทั้งหมด --</option>';
    locationTypes.forEach(t => {
        typeSelect.innerHTML += `<option value="${t.name}">${t.name}</option>`;
    });
    
    // Helper function to clear results
    function clearLocationResults() {
        const container = document.getElementById('locationResults');
        if (container) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="icon">🔍</div>
                    <p>เลือกตัวกรองแล้วกดค้นหา</p>
                </div>
            `;
        }
    }
    
    // Province change event
    provinceSelect.addEventListener('change', async function() {
        const districtSelect = document.getElementById('searchDistrict');
        districtSelect.innerHTML = '<option value="">-- ทั้งหมด --</option>';
        
        // Clear old results when province changes
        clearLocationResults();
        
        const selectedOption = this.options[this.selectedIndex];
        const provinceId = selectedOption.dataset.id;
        
        if (provinceId) {
            const amphures = await loadAmphures(provinceId);
            amphures.forEach(d => {
                districtSelect.innerHTML += `<option value="${d.name_th}">${d.name_th}</option>`;
            });
        }
    });
    
    // District change event - clear results
    document.getElementById('searchDistrict').addEventListener('change', function() {
        clearLocationResults();
    });
    
    // Type change event - clear results
    typeSelect.addEventListener('change', function() {
        clearLocationResults();
    });
}

function populateAddLocationForm() {
    // Populate province select for add location form
    const provinceSelect = document.getElementById('newLocProvince');
    provinceSelect.innerHTML = '<option value="">-- เลือก --</option>';
    provinces.forEach(p => {
        provinceSelect.innerHTML += `<option value="${p.id}" data-name="${p.name_th}" data-name-en="${p.name_en}">${p.name_th}</option>`;
    });
    
    // Populate type select
    const typeSelect = document.getElementById('newLocType');
    typeSelect.innerHTML = '<option value="">-- เลือก --</option>';
    locationTypes.forEach(t => {
        typeSelect.innerHTML += `<option value="${t.name}">${t.name}</option>`;
    });
    
    // Province change event
    provinceSelect.addEventListener('change', async function() {
        const districtSelect = document.getElementById('newLocDistrict');
        const subdistrictSelect = document.getElementById('newLocSubdistrict');
        
        districtSelect.innerHTML = '<option value="">-- เลือก --</option>';
        subdistrictSelect.innerHTML = '<option value="">-- เลือกอำเภอก่อน --</option>';
        
        if (this.value) {
            const amphures = await loadAmphures(this.value);
            amphures.forEach(d => {
                districtSelect.innerHTML += `<option value="${d.id}" data-name="${d.name_th}" data-name-en="${d.name_en}">${d.name_th}</option>`;
            });
        }
    });
    
    // District change event
    document.getElementById('newLocDistrict').addEventListener('change', async function() {
        const subdistrictSelect = document.getElementById('newLocSubdistrict');
        subdistrictSelect.innerHTML = '<option value="">-- เลือก --</option>';
        
        if (this.value) {
            const tambons = await loadTambons(this.value);
            tambons.forEach(t => {
                subdistrictSelect.innerHTML += `<option value="${t.id}" data-name="${t.name_th}" data-name-en="${t.name_en}" data-zip="${t.zip_code}">${t.name_th}</option>`;
            });
        }
    });
    
    // Subdistrict change event - auto fill postal code
    document.getElementById('newLocSubdistrict').addEventListener('change', function() {
        const selectedOption = this.options[this.selectedIndex];
        const zipCode = selectedOption.dataset.zip;
        if (zipCode) {
            document.getElementById('newLocPostalCode').value = zipCode;
        }
    });
}

function getCurrentLocation() {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            (position) => {
                document.getElementById('newLocLat').value = position.coords.latitude.toFixed(6);
                document.getElementById('newLocLng').value = position.coords.longitude.toFixed(6);
                showToast('ได้รับตำแหน่งแล้ว', 'success');
            },
            (error) => {
                showToast('ไม่สามารถรับตำแหน่งได้', 'error');
            }
        );
    } else {
        showToast('เบราว์เซอร์ไม่รองรับ GPS', 'error');
    }
}

// Add location form
document.getElementById('addLocationForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    showLoading();
    
    try {
        const provinceSelect = document.getElementById('newLocProvince');
        const districtSelect = document.getElementById('newLocDistrict');
        const subdistrictSelect = document.getElementById('newLocSubdistrict');
        
        const provinceOption = provinceSelect.options[provinceSelect.selectedIndex];
        const districtOption = districtSelect.options[districtSelect.selectedIndex];
        const subdistrictOption = subdistrictSelect.options[subdistrictSelect.selectedIndex];
        
        const locationData = {
            name: document.getElementById('newLocName').value,
            address: document.getElementById('newLocAddress').value,
            province: provinceOption.value ? {
                code: provinceOption.value,
                name_th: provinceOption.dataset.name,
                name_en: provinceOption.dataset.nameEn
            } : null,
            district: districtOption.value ? {
                code: districtOption.value,
                name_th: districtOption.dataset.name,
                name_en: districtOption.dataset.nameEn
            } : null,
            subdistrict: subdistrictOption.value ? {
                code: subdistrictOption.value,
                name_th: subdistrictOption.dataset.name,
                name_en: subdistrictOption.dataset.nameEn
            } : null,
            postal_code: document.getElementById('newLocPostalCode').value,
            location_type: document.getElementById('newLocType').value,
            coordinates: {
                lat: parseFloat(document.getElementById('newLocLat').value) || null,
                lng: parseFloat(document.getElementById('newLocLng').value) || null
            }
        };
        
        await api('/locations', {
            method: 'POST',
            body: JSON.stringify(locationData)
        });
        
        showToast('เพิ่มสถานที่สำเร็จ', 'success');
        this.reset();
        
        // Switch to search tab and refresh
        document.querySelector('[data-tab="searchTab"]').click();
        await searchLocations();
    } catch (error) {
        showToast(error.message, 'error');
    } finally {
        hideLoading();
    }
});

async function searchLocations() {
    showLoading();
    
    try {
        const province = document.getElementById('searchProvince').value;
        const district = document.getElementById('searchDistrict').value;
        const type = document.getElementById('searchType').value;
        const search = document.getElementById('searchText')?.value;
        
        if (!province) {
            showToast('กรุณาเลือกจังหวัด', 'warning');
            hideLoading();
            return;
        }
        
        if (!type || type === '-- ทั้งหมด --') {
            showToast('กรุณาเลือกประเภทสถานที่', 'warning');
            hideLoading();
            return;
        }
        
        // Search using Overpass API directly from frontend
        const locations = await searchFromOverpass(province, district, type);
        
        // Also get custom locations from database
        const params = new URLSearchParams();
        if (province) params.append('province', province);
        if (district) params.append('district', district);
        if (type) params.append('type', type);
        if (search) params.append('search', search);
        
        try {
            const dbLocations = await api(`/locations/custom?${params.toString()}`);
            // Combine: DB first, then Overpass results
            const allLocations = [...dbLocations, ...locations];
            renderLocations(allLocations);
        } catch (dbError) {
            // If DB fails, just show Overpass results
            renderLocations(locations);
        }
        
    } catch (error) {
        console.error('Search error:', error);
        showToast('เกิดข้อผิดพลาดในการค้นหา', 'error');
        renderLocations([]);
    } finally {
        hideLoading();
    }
}

// Province coordinates for Overpass bounding box
const provinceCoordinates = {
    'กรุงเทพมหานคร': { lat: 13.7563, lon: 100.5018 },
    'สมุทรปราการ': { lat: 13.5991, lon: 100.5998 },
    'นนทบุรี': { lat: 13.8621, lon: 100.5144 },
    'ปทุมธานี': { lat: 14.0208, lon: 100.5250 },
    'พระนครศรีอยุธยา': { lat: 14.3532, lon: 100.5683 },
    'อ่างทอง': { lat: 14.5896, lon: 100.4549 },
    'ลพบุรี': { lat: 14.7995, lon: 100.6534 },
    'สิงห์บุรี': { lat: 14.8936, lon: 100.3967 },
    'ชัยนาท': { lat: 15.1851, lon: 100.1251 },
    'สระบุรี': { lat: 14.5289, lon: 100.9108 },
    'ชลบุรี': { lat: 13.3611, lon: 100.9847 },
    'ระยอง': { lat: 12.6833, lon: 101.2378 },
    'จันทบุรี': { lat: 12.6114, lon: 102.1039 },
    'ตราด': { lat: 12.2428, lon: 102.5177 },
    'ฉะเชิงเทรา': { lat: 13.6904, lon: 101.0779 },
    'ปราจีนบุรี': { lat: 14.0509, lon: 101.3717 },
    'นครนายก': { lat: 14.2069, lon: 101.2131 },
    'สระแก้ว': { lat: 13.8240, lon: 102.0645 },
    'นครราชสีมา': { lat: 14.9799, lon: 102.0977 },
    'บุรีรัมย์': { lat: 14.9930, lon: 103.1029 },
    'สุรินทร์': { lat: 14.8818, lon: 103.4936 },
    'ศรีสะเกษ': { lat: 15.1186, lon: 104.3220 },
    'อุบลราชธานี': { lat: 15.2287, lon: 104.8564 },
    'ยโสธร': { lat: 15.7922, lon: 104.1452 },
    'ชัยภูมิ': { lat: 15.8068, lon: 102.0316 },
    'อำนาจเจริญ': { lat: 15.8656, lon: 104.6257 },
    'บึงกาฬ': { lat: 18.3609, lon: 103.6466 },
    'หนองบัวลำภู': { lat: 17.2218, lon: 102.4260 },
    'ขอนแก่น': { lat: 16.4322, lon: 102.8236 },
    'อุดรธานี': { lat: 17.4156, lon: 102.7872 },
    'เลย': { lat: 17.4860, lon: 101.7223 },
    'หนองคาย': { lat: 17.8783, lon: 102.7420 },
    'มหาสารคาม': { lat: 16.1851, lon: 103.3006 },
    'ร้อยเอ็ด': { lat: 16.0538, lon: 103.6520 },
    'กาฬสินธุ์': { lat: 16.4314, lon: 103.5058 },
    'สกลนคร': { lat: 17.1545, lon: 104.1348 },
    'นครพนม': { lat: 17.3920, lon: 104.7695 },
    'มุกดาหาร': { lat: 16.5453, lon: 104.7235 },
    'เชียงใหม่': { lat: 18.7883, lon: 98.9853 },
    'ลำพูน': { lat: 18.5744, lon: 99.0087 },
    'ลำปาง': { lat: 18.2888, lon: 99.4906 },
    'อุตรดิตถ์': { lat: 17.6200, lon: 100.0993 },
    'แพร่': { lat: 18.1445, lon: 100.1403 },
    'น่าน': { lat: 18.7756, lon: 100.7730 },
    'พะเยา': { lat: 19.1664, lon: 99.9019 },
    'เชียงราย': { lat: 19.9105, lon: 99.8406 },
    'แม่ฮ่องสอน': { lat: 19.3020, lon: 97.9654 },
    'นครสวรรค์': { lat: 15.7030, lon: 100.1367 },
    'อุทัยธานี': { lat: 15.3835, lon: 100.0245 },
    'กำแพงเพชร': { lat: 16.4827, lon: 99.5226 },
    'ตาก': { lat: 16.8840, lon: 99.1258 },
    'สุโขทัย': { lat: 17.0078, lon: 99.8265 },
    'พิษณุโลก': { lat: 16.8211, lon: 100.2659 },
    'พิจิตร': { lat: 16.4429, lon: 100.3487 },
    'เพชรบูรณ์': { lat: 16.4190, lon: 101.1591 },
    'ราชบุรี': { lat: 13.5283, lon: 99.8134 },
    'กาญจนบุรี': { lat: 14.0227, lon: 99.5328 },
    'สุพรรณบุรี': { lat: 14.4744, lon: 100.1177 },
    'นครปฐม': { lat: 13.8196, lon: 100.0445 },
    'สมุทรสาคร': { lat: 13.5475, lon: 100.2747 },
    'สมุทรสงคราม': { lat: 13.4098, lon: 100.0022 },
    'เพชรบุรี': { lat: 13.1119, lon: 99.9398 },
    'ประจวบคีรีขันธ์': { lat: 11.8126, lon: 99.7957 },
    'นครศรีธรรมราช': { lat: 8.4304, lon: 99.9631 },
    'กระบี่': { lat: 8.0863, lon: 98.9063 },
    'พังงา': { lat: 8.4511, lon: 98.5256 },
    'ภูเก็ต': { lat: 7.8804, lon: 98.3923 },
    'สุราษฎร์ธานี': { lat: 9.1382, lon: 99.3217 },
    'ระนอง': { lat: 9.9528, lon: 98.6085 },
    'ชุมพร': { lat: 10.4931, lon: 99.1800 },
    'สงขลา': { lat: 7.1897, lon: 100.5954 },
    'สตูล': { lat: 6.6238, lon: 100.0673 },
    'ตรัง': { lat: 7.5563, lon: 99.6114 },
    'พัทลุง': { lat: 7.6167, lon: 100.0743 },
    'ปัตตานี': { lat: 6.8691, lon: 101.2508 },
    'ยะลา': { lat: 6.5400, lon: 101.2800 },
    'นราธิวาส': { lat: 6.4318, lon: 101.8231 }
};

// OSM place types mapping - multiple queries for better results
const osmPlaceTypes = {
    'บ้านพักอาศัย': { 
        queries: [
            '["building"="apartments"]',
            '["building"="residential"]',
            '["landuse"="residential"]'
        ],
        icon: '🏠' 
    },
    'อาคารพาณิชย์': { 
        queries: [
            '["building"="office"]',
            '["office"]',
            '["building"="commercial"]'
        ],
        icon: '🏢' 
    },
    'โรงงาน': { 
        queries: [
            '["man_made"="works"]',
            '["industrial"]',
            '["landuse"="industrial"]'
        ],
        icon: '🏭' 
    },
    'ห้างสรรพสินค้า': { 
        queries: [
            '["shop"="mall"]',
            '["shop"="department_store"]',
            '["shop"="supermarket"]'
        ],
        icon: '🛒' 
    },
    'โรงแรม': { 
        queries: [
            '["tourism"="hotel"]',
            '["tourism"="guest_house"]',
            '["tourism"="motel"]'
        ],
        icon: '🏨' 
    },
    'โรงเรียน': { 
        queries: [
            '["amenity"="school"]',
            '["amenity"="university"]',
            '["amenity"="college"]'
        ],
        icon: '🏫' 
    },
    'โรงพยาบาล': { 
        queries: [
            '["amenity"="hospital"]',
            '["amenity"="clinic"]',
            '["healthcare"]'
        ],
        icon: '🏥' 
    },
    'อื่นๆ': { 
        queries: [
            '["amenity"="place_of_worship"]',
            '["amenity"="community_centre"]'
        ],
        icon: '📍' 
    }
};

// Search from Overpass API (OpenStreetMap) directly
async function searchFromOverpass(province, district, type) {
    const coords = provinceCoordinates[province];
    if (!coords) {
        console.error('Province coordinates not found:', province);
        return [];
    }
    
    const osmType = osmPlaceTypes[type];
    if (!osmType) {
        console.error('OSM type not found:', type);
        return [];
    }
    
    // Create bounding box (roughly 25km radius for better coverage)
    const delta = district ? 0.15 : 0.25;
    const bbox = `${coords.lat - delta},${coords.lon - delta},${coords.lat + delta},${coords.lon + delta}`;
    
    // Build Overpass query with multiple tag queries
    const queryParts = osmType.queries.map(q => `
        node${q}(${bbox});
        way${q}(${bbox});
    `).join('');
    
    const overpassQuery = `
        [out:json][timeout:30];
        (
            ${queryParts}
        );
        out body center 150;
    `;
    
    // Multiple Overpass servers for fallback
    const overpassServers = [
        'https://overpass-api.de/api/interpreter',
        'https://overpass.kumi.systems/api/interpreter',
        'https://maps.mail.ru/osm/tools/overpass/api/interpreter'
    ];
    
    for (const server of overpassServers) {
        try {
            console.log(`Trying Overpass server: ${server}`);
            const url = `${server}?data=${encodeURIComponent(overpassQuery)}`;
            
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 15000);
            
            const response = await fetch(url, { signal: controller.signal });
            clearTimeout(timeoutId);
            
            if (!response.ok) continue;
            
            const data = await response.json();
            
            if (data.elements && data.elements.length > 0) {
                console.log(`✅ Found ${data.elements.length} places from ${server}`);
                
                return data.elements.map(el => {
                    const tags = el.tags || {};
                    let lat = el.lat, lng = el.lon;
                    if (el.center) { lat = el.center.lat; lng = el.center.lon; }
                    
                    return {
                        _id: `osm_${el.id}`,
                        name: tags['name:th'] || tags.name || 'ไม่ระบุชื่อ',
                        address: tags['addr:full'] || tags['addr:street'] || '',
                        location_type: type,
                        coordinates: { lat, lng },
                        province: { name_th: tags['addr:province'] || province },
                        district: { name_th: tags['addr:district'] || district || '' },
                        subdistrict: { name_th: tags['addr:subdistrict'] || '' },
                        postal_code: tags['addr:postcode'] || '',
                        phone: tags.phone || '',
                        website: tags.website || '',
                        source: 'openstreetmap'
                    };
                }).filter(p => p.name !== 'ไม่ระบุชื่อ');
            }
            
            return [];
            
        } catch (error) {
            console.warn(`Server ${server} failed:`, error.message);
            continue;
        }
    }
    
    console.error('All Overpass servers failed');
    return [];
}

function renderLocations(locations) {
    const container = document.getElementById('locationResults');
    
    if (locations.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="icon">📍</div>
                <p>ไม่พบสถานที่</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = locations.map(loc => {
        const provinceName = loc.province?.name_th || '';
        const districtName = loc.district?.name_th || '';
        const mapLink = getGoogleMapsLink(loc);
        
        return `
            <div class="location-card">
                <h4>${loc.name}</h4>
                <div class="location-meta">
                    ${provinceName ? `<span>📍 ${provinceName}${districtName ? ' / ' + districtName : ''}</span>` : ''}
                    <span>🏠 ${loc.location_type || 'ไม่ระบุ'}</span>
                </div>
                ${loc.address ? `<p class="text-muted mb-2">${loc.address}</p>` : ''}
                <div class="location-actions">
                    <button class="btn btn-sm btn-interested" onclick="markInterested('${loc._id}')">
                        ✓ สนใจ
                    </button>
                    <button class="btn btn-sm btn-not-interested" onclick="markNotInterested('${loc._id}')">
                        ✗ ไม่สนใจ
                    </button>
                    <a href="${mapLink}" target="_blank" class="btn btn-sm btn-outline">
                        🗺️ ดู Google Maps
                    </a>
                </div>
            </div>
        `;
    }).join('');
}

function markInterested(locationId) {
    document.getElementById('interestLocationId').value = locationId;
    document.getElementById('interestForm').reset();
    document.getElementById('interestLocationId').value = locationId;
    showModal('interestModal');
}

async function markNotInterested(locationId) {
    if (!confirm('ยืนยันว่าลูกค้าไม่สนใจ?')) return;
    
    showLoading();
    
    try {
        await api('/interests', {
            method: 'POST',
            body: JSON.stringify({
                location_id: locationId,
                status: 'not_interested'
            })
        });
        
        showToast('บันทึกข้อมูลสำเร็จ', 'success');
    } catch (error) {
        showToast(error.message, 'error');
    } finally {
        hideLoading();
    }
}

// Interest form
document.getElementById('interestForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    showLoading();
    
    try {
        await api('/interests', {
            method: 'POST',
            body: JSON.stringify({
                location_id: document.getElementById('interestLocationId').value,
                status: 'interested',
                customer_name: document.getElementById('customerName').value || null,
                monthly_electric_bill: document.getElementById('monthlyBill').value || null,
                electricity_usage: document.getElementById('electricityUsage').value || null,
                customer_phone: document.getElementById('customerPhone').value || null,
                notes: document.getElementById('interestNotes').value || null
            })
        });
        
        showToast('บันทึกข้อมูลสำเร็จ', 'success');
        closeModal('interestModal');
    } catch (error) {
        showToast(error.message, 'error');
    } finally {
        hideLoading();
    }
});

async function loadMyRecords() {
    showLoading();
    
    try {
        const records = await api('/my-interests');
        renderMyRecords(records);
    } catch (error) {
        showToast(error.message, 'error');
    } finally {
        hideLoading();
    }
}

function renderMyRecords(records) {
    const container = document.getElementById('myRecordsList');
    
    if (records.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="icon">📋</div>
                <p>ยังไม่มีรายการที่บันทึก</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = records.map(rec => {
        const loc = rec.location || {};
        const mapLink = getGoogleMapsLink(loc);
        const provinceName = loc.province?.name_th || '';
        const districtName = loc.district?.name_th || '';
        
        return `
            <div class="record-card">
                <div style="display: flex; justify-content: space-between; align-items: start; flex-wrap: wrap; gap: 8px;">
                    <h4>${loc.name || 'ไม่ทราบชื่อ'}</h4>
                    <span class="status-badge ${rec.status === 'interested' ? 'status-interested' : 'status-not-interested'}">
                        ${rec.status === 'interested' ? 'สนใจ' : 'ไม่สนใจ'}
                    </span>
                </div>
                <div class="record-meta">
                    ${provinceName ? `<span>📍 ${provinceName}${districtName ? ' / ' + districtName : ''}</span>` : ''}
                    <span>🏠 ${loc.location_type || 'ไม่ระบุ'}</span>
                    <span>📅 ${new Date(rec.createdAt).toLocaleDateString('th-TH')}</span>
                </div>
                ${rec.status === 'interested' ? `
                    <div class="interest-details">
                        ${rec.customer_name ? `<p><strong>ชื่อลูกค้า:</strong> ${rec.customer_name}</p>` : ''}
                        ${rec.monthly_electric_bill ? `<p><strong>ค่าไฟ/เดือน:</strong> ${Number(rec.monthly_electric_bill).toLocaleString()} บาท</p>` : ''}
                        ${rec.electricity_usage ? `<p><strong>ใช้ไฟช่วง:</strong> ${getUsageText(rec.electricity_usage)}</p>` : ''}
                        ${rec.customer_phone ? `<p><strong>เบอร์ลูกค้า:</strong> ${rec.customer_phone}</p>` : ''}
                        ${rec.notes ? `<p><strong>หมายเหตุ:</strong> ${rec.notes}</p>` : ''}
                    </div>
                ` : ''}
                <div class="record-actions mt-2">
                    <a href="${mapLink}" target="_blank" class="btn btn-sm btn-outline">
                        🗺️ ดู Google Maps
                    </a>
                </div>
                ${rec.is_approved ? `<span class="status-badge status-approved mt-2">✓ อนุมัติแล้ว</span>` : ''}
            </div>
        `;
    }).join('');
}

function getUsageText(usage) {
    const map = {
        'day': 'กลางวัน',
        'night': 'กลางคืน',
        'both': 'ทั้งสองช่วง'
    };
    return map[usage] || usage;
}

// ==================== Admin Functions ====================
async function initAdminPage() {
    await loadAllThailandData();
    await loadLocationTypes();
    await loadAdminStats();
    await loadEmployeeFilter();
    await loadAdminInterests('interested');
}

async function loadAdminStats() {
    try {
        const stats = await api('/admin/stats');
        document.getElementById('statInterested').textContent = stats.totalInterested;
        document.getElementById('statNotInterested').textContent = stats.totalNotInterested;
        document.getElementById('statApproved').textContent = stats.totalApproved;
        document.getElementById('statEmployees').textContent = stats.totalEmployees;
    } catch (error) {
        console.error('Error loading stats:', error);
    }
}

async function loadEmployeeFilter() {
    try {
        const users = await api('/admin/users');
        const employees = users.filter(u => u.role === 'employee');
        
        const select = document.getElementById('filterEmployee');
        select.innerHTML = '<option value="">พนักงานทั้งหมด</option>';
        employees.forEach(emp => {
            select.innerHTML += `<option value="${emp._id}">${emp.full_name}</option>`;
        });
        
        select.addEventListener('change', () => loadAdminInterests('interested'));
    } catch (error) {
        console.error('Error loading employees:', error);
    }
}

async function loadAdminInterests(status) {
    showLoading();
    
    try {
        const params = new URLSearchParams();
        params.append('status', status);
        
        const employeeId = document.getElementById('filterEmployee')?.value;
        if (employeeId) params.append('employee_id', employeeId);
        
        const interests = await api(`/admin/interests?${params.toString()}`);
        
        if (status === 'interested') {
            renderAdminInterests(interests, 'interestedList');
        } else {
            renderAdminInterests(interests, 'notInterestedList');
        }
    } catch (error) {
        showToast(error.message, 'error');
    } finally {
        hideLoading();
    }
}

function renderAdminInterests(interests, containerId) {
    const container = document.getElementById(containerId);
    
    if (interests.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="icon">📋</div>
                <p>ไม่มีรายการ</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = interests.map(item => {
        const loc = item.location || {};
        const mapLink = getGoogleMapsLink(loc);
        const provinceName = loc.province?.name_th || '';
        const districtName = loc.district?.name_th || '';
        
        return `
            <div class="admin-card">
                <div style="display: flex; justify-content: space-between; align-items: start; flex-wrap: wrap; gap: 8px;">
                    <h4>${loc.name || 'ไม่ทราบชื่อ'}</h4>
                    <div>
                        <span class="status-badge ${item.status === 'interested' ? 'status-interested' : 'status-not-interested'}">
                            ${item.status === 'interested' ? 'สนใจ' : 'ไม่สนใจ'}
                        </span>
                        ${item.is_approved ? `<span class="status-badge status-approved">✓ อนุมัติแล้ว</span>` : ''}
                    </div>
                </div>
                <div class="admin-meta">
                    ${provinceName ? `<span>📍 ${provinceName}${districtName ? ' / ' + districtName : ''}</span>` : ''}
                    <span>🏠 ${loc.location_type || 'ไม่ระบุ'}</span>
                    <span>👤 ${item.employee?.full_name || 'ไม่ทราบ'}</span>
                    <span>📅 ${new Date(item.createdAt).toLocaleDateString('th-TH')}</span>
                </div>
                ${loc.address ? `<p class="text-muted mb-2">${loc.address}</p>` : ''}
                ${item.status === 'interested' ? `
                    <div class="interest-details">
                        ${item.customer_name ? `<p><strong>ชื่อลูกค้า:</strong> ${item.customer_name}</p>` : ''}
                        ${item.monthly_electric_bill ? `<p><strong>ค่าไฟ/เดือน:</strong> ${Number(item.monthly_electric_bill).toLocaleString()} บาท</p>` : ''}
                        ${item.electricity_usage ? `<p><strong>ใช้ไฟช่วง:</strong> ${getUsageText(item.electricity_usage)}</p>` : ''}
                        ${item.customer_phone ? `<p><strong>เบอร์ลูกค้า:</strong> ${item.customer_phone}</p>` : ''}
                        ${item.notes ? `<p><strong>หมายเหตุ:</strong> ${item.notes}</p>` : ''}
                    </div>
                    <div class="admin-actions mt-2">
                        ${!item.is_approved ? `
                            <button class="btn btn-sm btn-success" onclick="approveInterest('${item._id}')">
                                ✓ Approve (นัดหมาย)
                            </button>
                        ` : `
                            <span class="text-muted">
                                อนุมัติโดย: ${item.approved_by?.full_name || '-'} 
                                (${item.approved_at ? new Date(item.approved_at).toLocaleDateString('th-TH') : '-'})
                            </span>
                        `}
                        <a href="${mapLink}" target="_blank" class="btn btn-sm btn-outline">
                            🗺️ ดู Google Maps
                        </a>
                    </div>
                ` : `
                    <div class="admin-actions mt-2">
                        <a href="${mapLink}" target="_blank" class="btn btn-sm btn-outline">
                            🗺️ ดู Google Maps
                        </a>
                    </div>
                `}
            </div>
        `;
    }).join('');
}

async function approveInterest(id) {
    if (!confirm('ยืนยันการอนุมัติ?')) return;
    
    showLoading();
    
    try {
        await api(`/admin/interests/${id}/approve`, { method: 'PUT' });
        showToast('อนุมัติสำเร็จ', 'success');
        await loadAdminInterests('interested');
        await loadAdminStats();
    } catch (error) {
        showToast(error.message, 'error');
    } finally {
        hideLoading();
    }
}

// ==================== User Management ====================
async function loadUsers() {
    showLoading();
    
    try {
        const users = await api('/admin/users');
        renderUsers(users);
    } catch (error) {
        showToast(error.message, 'error');
    } finally {
        hideLoading();
    }
}

function renderUsers(users) {
    const container = document.getElementById('usersList');
    
    container.innerHTML = users.map(user => `
        <div class="admin-card">
            <div style="display: flex; justify-content: space-between; align-items: start; flex-wrap: wrap; gap: 8px;">
                <div class="user-info">
                    <h4>${user.full_name}</h4>
                    <span class="username">@${user.username}</span>
                    ${user.email ? `<span class="email">${user.email}</span>` : ''}
                </div>
                <div>
                    <span class="role-badge ${user.role === 'admin' ? 'role-admin' : 'role-employee'}">
                        ${user.role === 'admin' ? 'Admin' : 'พนักงาน'}
                    </span>
                    <span class="status-badge ${user.is_active ? 'status-active' : 'status-inactive'}">
                        ${user.is_active ? 'ใช้งาน' : 'ปิดใช้งาน'}
                    </span>
                </div>
            </div>
            <div class="admin-meta">
                ${user.phone ? `<span>📞 ${user.phone}</span>` : ''}
                <span>📅 สมัคร: ${new Date(user.createdAt).toLocaleDateString('th-TH')}</span>
            </div>
            <div class="admin-actions mt-2">
                <button class="btn btn-sm btn-outline" onclick="editUser('${user._id}', '${user.full_name}', '${user.email || ''}', '${user.phone || ''}', '${user.role}', ${user.is_active})">
                    แก้ไข
                </button>
                <button class="btn btn-sm btn-danger" onclick="deleteUser('${user._id}', '${user.full_name}')">
                    ลบ
                </button>
            </div>
        </div>
    `).join('');
}

function showAddUserModal() {
    document.getElementById('addUserForm').reset();
    showModal('addUserModal');
}

document.getElementById('addUserForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    showLoading();
    
    try {
        await api('/admin/users', {
            method: 'POST',
            body: JSON.stringify({
                username: document.getElementById('newUsername').value,
                password: document.getElementById('newPassword').value,
                full_name: document.getElementById('newFullName').value,
                email: document.getElementById('newEmail').value || null,
                phone: document.getElementById('newPhone').value || null,
                role: document.getElementById('newRole').value
            })
        });
        
        showToast('เพิ่มสมาชิกสำเร็จ', 'success');
        closeModal('addUserModal');
        await loadUsers();
        await loadAdminStats();
    } catch (error) {
        showToast(error.message, 'error');
    } finally {
        hideLoading();
    }
});

function editUser(id, fullName, email, phone, role, isActive) {
    document.getElementById('editUserId').value = id;
    document.getElementById('editFullName').value = fullName;
    document.getElementById('editEmail').value = email;
    document.getElementById('editPhone').value = phone;
    document.getElementById('editRole').value = role;
    document.getElementById('editIsActive').value = isActive.toString();
    showModal('editUserModal');
}

document.getElementById('editUserForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    showLoading();
    
    try {
        const userId = document.getElementById('editUserId').value;
        
        await api(`/admin/users/${userId}`, {
            method: 'PUT',
            body: JSON.stringify({
                full_name: document.getElementById('editFullName').value,
                email: document.getElementById('editEmail').value || null,
                phone: document.getElementById('editPhone').value || null,
                role: document.getElementById('editRole').value,
                is_active: document.getElementById('editIsActive').value === 'true'
            })
        });
        
        showToast('อัปเดตข้อมูลสำเร็จ', 'success');
        closeModal('editUserModal');
        await loadUsers();
    } catch (error) {
        showToast(error.message, 'error');
    } finally {
        hideLoading();
    }
});

async function deleteUser(id, name) {
    if (!confirm(`ยืนยันการลบ "${name}"?`)) return;
    
    showLoading();
    
    try {
        await api(`/admin/users/${id}`, { method: 'DELETE' });
        showToast('ลบสมาชิกสำเร็จ', 'success');
        await loadUsers();
        await loadAdminStats();
    } catch (error) {
        showToast(error.message, 'error');
    } finally {
        hideLoading();
    }
}

// ==================== Admin Locations ====================
async function loadAdminLocations() {
    showLoading();
    
    try {
        // Use custom endpoint (DB only, no Overpass API search)
        const locations = await api('/locations/custom');
        renderAdminLocations(locations);
    } catch (error) {
        showToast(error.message, 'error');
    } finally {
        hideLoading();
    }
}

function renderAdminLocations(locations) {
    const container = document.getElementById('adminLocationsList');
    
    if (locations.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="icon">📍</div>
                <p>ยังไม่มีสถานที่</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = locations.map(loc => {
        const mapLink = getGoogleMapsLink(loc);
        const provinceName = loc.province?.name_th || '';
        const districtName = loc.district?.name_th || '';
        
        return `
            <div class="admin-card">
                <h4>${loc.name}</h4>
                <div class="admin-meta">
                    ${provinceName ? `<span>📍 ${provinceName}${districtName ? ' / ' + districtName : ''}</span>` : ''}
                    <span>🏠 ${loc.location_type || 'ไม่ระบุ'}</span>
                    <span>📅 ${new Date(loc.createdAt).toLocaleDateString('th-TH')}</span>
                </div>
                ${loc.address ? `<p class="text-muted">${loc.address}</p>` : ''}
                <div class="admin-actions mt-2">
                    <a href="${mapLink}" target="_blank" class="btn btn-sm btn-outline">
                        🗺️ ดู Google Maps
                    </a>
                </div>
            </div>
        `;
    }).join('');
}

// ==================== Search on Enter ====================
document.getElementById('searchText')?.addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
        searchLocations();
    }
});

// ==================== Initialize ====================
document.addEventListener('DOMContentLoaded', checkAuth);
