const axios = require('axios');
const fs = require('fs');
const path = require('path');

const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';
const delay = (ms) => new Promise(r => setTimeout(r, ms));

async function fetchPlaces(amenityType, limitCount = 1000) {
    const query = `
        [out:json][timeout:180];
        area["name:en"="Thailand"]->.th;
        (
            nwr["amenity"="${amenityType}"](area.th);
        );
        out center ${limitCount};
    `;

    console.log(`🔍 Fetching ${amenityType}...`);
    
    try {
        const response = await axios.post(OVERPASS_URL, `data=${encodeURIComponent(query)}`, {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            timeout: 200000
        });
        
        const elements = response.data.elements || [];
        console.log(`   ✅ Got ${elements.length} items`);
        return elements;
    } catch (error) {
        console.error(`   ❌ Error: ${error.message}`);
        return [];
    }
}

async function fetchShops(shopType, limitCount = 500) {
    const query = `
        [out:json][timeout:180];
        area["name:en"="Thailand"]->.th;
        (
            nwr["shop"="${shopType}"](area.th);
        );
        out center ${limitCount};
    `;

    console.log(`🔍 Fetching shop:${shopType}...`);
    
    try {
        const response = await axios.post(OVERPASS_URL, `data=${encodeURIComponent(query)}`, {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            timeout: 200000
        });
        
        const elements = response.data.elements || [];
        console.log(`   ✅ Got ${elements.length} items`);
        return elements;
    } catch (error) {
        console.error(`   ❌ Error: ${error.message}`);
        return [];
    }
}

async function fetchTourism(tourismType, limitCount = 500) {
    const query = `
        [out:json][timeout:180];
        area["name:en"="Thailand"]->.th;
        (
            nwr["tourism"="${tourismType}"](area.th);
        );
        out center ${limitCount};
    `;

    console.log(`🔍 Fetching tourism:${tourismType}...`);
    
    try {
        const response = await axios.post(OVERPASS_URL, `data=${encodeURIComponent(query)}`, {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            timeout: 200000
        });
        
        const elements = response.data.elements || [];
        console.log(`   ✅ Got ${elements.length} items`);
        return elements;
    } catch (error) {
        console.error(`   ❌ Error: ${error.message}`);
        return [];
    }
}

function processElement(element, locationType, locationTypeId) {
    const tags = element.tags || {};
    const name = tags['name:th'] || tags.name || tags['name:en'];
    
    if (!name) return null;
    
    let lat, lon;
    if (element.type === 'node') {
        lat = element.lat;
        lon = element.lon;
    } else if (element.center) {
        lat = element.center.lat;
        lon = element.center.lon;
    }
    
    if (!lat || !lon) return null;
    
    return {
        name,
        name_en: tags['name:en'] || '',
        address: tags['addr:full'] || tags['addr:street'] || '',
        location_type: locationType,
        location_type_id: locationTypeId,
        coordinates: { lat, lng: lon },
        province: tags['addr:province'] || '',
        district: tags['addr:district'] || tags['addr:city'] || '',
        subdistrict: tags['addr:subdistrict'] || '',
        postal_code: tags['addr:postcode'] || '',
        phone: tags.phone || '',
        website: tags.website || '',
        osm_id: element.id
    };
}

async function main() {
    // Load existing data
    let allPlaces = [];
    const outputPath = path.join(__dirname, '../data/places.json');
    
    try {
        allPlaces = JSON.parse(fs.readFileSync(outputPath, 'utf8'));
        console.log(`📂 Loaded ${allPlaces.length} existing places`);
    } catch (e) {
        console.log('📂 Starting fresh');
    }
    
    const existingTypes = new Set(allPlaces.map(p => p.location_type));
    console.log('Existing types:', [...existingTypes]);
    
    // Fetch schools if not exists
    if (!existingTypes.has('โรงเรียน')) {
        const schools = await fetchPlaces('school', 2000);
        schools.forEach(el => {
            const place = processElement(el, 'โรงเรียน', 6);
            if (place) allPlaces.push(place);
        });
        console.log(`Total after schools: ${allPlaces.length}`);
        await delay(10000);
    }
    
    // Fetch malls
    if (!existingTypes.has('ห้างสรรพสินค้า')) {
        const malls = await fetchShops('mall', 500);
        malls.forEach(el => {
            const place = processElement(el, 'ห้างสรรพสินค้า', 4);
            if (place) allPlaces.push(place);
        });
        
        await delay(10000);
        
        const supermarkets = await fetchShops('supermarket', 500);
        supermarkets.forEach(el => {
            const place = processElement(el, 'ห้างสรรพสินค้า', 4);
            if (place) allPlaces.push(place);
        });
        console.log(`Total after malls: ${allPlaces.length}`);
        await delay(10000);
    }
    
    // Fetch hotels
    if (!existingTypes.has('โรงแรม')) {
        const hotels = await fetchTourism('hotel', 1500);
        hotels.forEach(el => {
            const place = processElement(el, 'โรงแรม', 5);
            if (place) allPlaces.push(place);
        });
        console.log(`Total after hotels: ${allPlaces.length}`);
    }
    
    // Remove duplicates
    const seen = new Set();
    const uniquePlaces = allPlaces.filter(p => {
        const key = `${p.name}-${p.coordinates.lat.toFixed(4)}-${p.coordinates.lng.toFixed(4)}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
    
    console.log(`\n✅ Total unique places: ${uniquePlaces.length}`);
    
    // Save
    fs.writeFileSync(outputPath, JSON.stringify(uniquePlaces, null, 2), 'utf8');
    console.log(`💾 Saved to ${outputPath}`);
    
    // Summary
    const byType = {};
    uniquePlaces.forEach(p => {
        byType[p.location_type] = (byType[p.location_type] || 0) + 1;
    });
    console.log('\n📊 Summary:');
    Object.entries(byType).forEach(([t, c]) => console.log(`   ${t}: ${c}`));
}

main();
