const fs = require('fs');
const path = require('path');

// Read raw data
const rawData = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/raw_thailand.json'), 'utf8'));

console.log(`Total records: ${rawData.length}`);

// Extract unique provinces
const provincesMap = new Map();
const amphuresMap = new Map();
const tambonsMap = new Map();

rawData.forEach(item => {
    // Province
    if (!provincesMap.has(item.province_code)) {
        provincesMap.set(item.province_code, {
            id: parseInt(item.province_code),
            name_th: item.province,
            name_en: ''
        });
    }
    
    // Amphure
    if (!amphuresMap.has(item.amphoe_code)) {
        amphuresMap.set(item.amphoe_code, {
            id: parseInt(item.amphoe_code),
            name_th: item.amphoe,
            name_en: '',
            province_id: parseInt(item.province_code)
        });
    }
    
    // Tambon
    if (!tambonsMap.has(item.district_code)) {
        tambonsMap.set(item.district_code, {
            id: parseInt(item.district_code),
            name_th: item.district,
            name_en: '',
            amphure_id: parseInt(item.amphoe_code),
            zip_code: item.zipcode
        });
    }
});

// Convert to arrays and sort
const provinces = Array.from(provincesMap.values()).sort((a, b) => a.id - b.id);
const amphures = Array.from(amphuresMap.values()).sort((a, b) => a.id - b.id);
const tambons = Array.from(tambonsMap.values()).sort((a, b) => a.id - b.id);

// Add English names for provinces
const provinceEnglishNames = {
    10: 'Bangkok', 11: 'Samut Prakan', 12: 'Nonthaburi', 13: 'Pathum Thani',
    14: 'Phra Nakhon Si Ayutthaya', 15: 'Ang Thong', 16: 'Lop Buri', 17: 'Sing Buri',
    18: 'Chai Nat', 19: 'Saraburi', 20: 'Chon Buri', 21: 'Rayong',
    22: 'Chanthaburi', 23: 'Trat', 24: 'Chachoengsao', 25: 'Prachin Buri',
    26: 'Nakhon Nayok', 27: 'Sa Kaeo', 30: 'Nakhon Ratchasima', 31: 'Buri Ram',
    32: 'Surin', 33: 'Si Sa Ket', 34: 'Ubon Ratchathani', 35: 'Yasothon',
    36: 'Chaiyaphum', 37: 'Amnat Charoen', 38: 'Bueng Kan', 39: 'Nong Bua Lam Phu',
    40: 'Khon Kaen', 41: 'Udon Thani', 42: 'Loei', 43: 'Nong Khai',
    44: 'Maha Sarakham', 45: 'Roi Et', 46: 'Kalasin', 47: 'Sakon Nakhon',
    48: 'Nakhon Phanom', 49: 'Mukdahan', 50: 'Chiang Mai', 51: 'Lamphun',
    52: 'Lampang', 53: 'Uttaradit', 54: 'Phrae', 55: 'Nan',
    56: 'Phayao', 57: 'Chiang Rai', 58: 'Mae Hong Son', 60: 'Nakhon Sawan',
    61: 'Uthai Thani', 62: 'Kamphaeng Phet', 63: 'Tak', 64: 'Sukhothai',
    65: 'Phitsanulok', 66: 'Phichit', 67: 'Phetchabun', 70: 'Ratchaburi',
    71: 'Kanchanaburi', 72: 'Suphan Buri', 73: 'Nakhon Pathom', 74: 'Samut Sakhon',
    75: 'Samut Songkhram', 76: 'Phetchaburi', 77: 'Prachuap Khiri Khan',
    80: 'Nakhon Si Thammarat', 81: 'Krabi', 82: 'Phang Nga', 83: 'Phuket',
    84: 'Surat Thani', 85: 'Ranong', 86: 'Chumphon', 90: 'Songkhla',
    91: 'Satun', 92: 'Trang', 93: 'Phatthalung', 94: 'Pattani',
    95: 'Yala', 96: 'Narathiwat'
};

provinces.forEach(p => {
    p.name_en = provinceEnglishNames[p.id] || p.name_th;
});

console.log(`Provinces: ${provinces.length}`);
console.log(`Amphures: ${amphures.length}`);
console.log(`Tambons: ${tambons.length}`);

// Write output files
const dataDir = path.join(__dirname, '../data');

fs.writeFileSync(
    path.join(dataDir, 'provinces.json'),
    JSON.stringify(provinces, null, 2),
    'utf8'
);

fs.writeFileSync(
    path.join(dataDir, 'amphures.json'),
    JSON.stringify(amphures, null, 2),
    'utf8'
);

fs.writeFileSync(
    path.join(dataDir, 'tambons.json'),
    JSON.stringify(tambons, null, 2),
    'utf8'
);

// Create combined file for faster loading
const combined = {
    provinces,
    amphures,
    tambons
};

fs.writeFileSync(
    path.join(dataDir, 'thailand.json'),
    JSON.stringify(combined, null, 2),
    'utf8'
);

console.log('\n✅ Files created:');
console.log('- data/provinces.json');
console.log('- data/amphures.json');
console.log('- data/tambons.json');
console.log('- data/thailand.json (combined)');
