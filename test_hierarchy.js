const http = require('http');

function get(url) {
    return new Promise((resolve, reject) => {
        http.get(url, { timeout: 10000 }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try { resolve(JSON.parse(data)); }
                catch (e) { reject(new Error(data.substring(0, 300))); }
            });
        }).on('error', reject);
    });
}

async function test() {
    console.log('\n=== HIERARCHY BUBBLING TEST ===\n');
    
    try {
        // Test Brandon Souris (specific riding)
        console.log('1. Brandon Souris (riding):');
        const brandon = await get('http://localhost:3000/api/locations/federal-ridings/fr-mb-brandon-souris/ideas');
        console.log('   Ideas:', brandon.length);
        brandon.forEach(i => console.log('   -', i.title));
        
        // Test Manitoba (should include Brandon Souris)
        console.log('\n2. Manitoba (province - should include above):');
        const manitoba = await get('http://localhost:3000/api/locations/provinces/ca-mb/ideas');
        console.log('   Ideas:', manitoba.length);
        manitoba.forEach(i => console.log('   -', i.title));
        
        // Test Canada (should include all)
        console.log('\n3. Canada (country - should include all):');
        const canada = await get('http://localhost:3000/api/locations/countries/ca/ideas');
        console.log('   Ideas:', canada.length);
        canada.slice(0, 8).forEach(i => console.log('   -', i.title, '(' + i.supportCount + ' supporters)'));
        if (canada.length > 8) console.log('   ... and', canada.length - 8, 'more');
        
    } catch (e) {
        console.error('Error:', e.message);
    }
    
    console.log('\n=== TEST COMPLETE ===\n');
    process.exit(0);
}

test();

