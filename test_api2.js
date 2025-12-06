// Quick API test using http module
const http = require('http');

function get(url) {
    return new Promise((resolve, reject) => {
        http.get(url, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve(JSON.parse(data)));
        }).on('error', reject);
    });
}

async function test() {
    console.log('Testing API...');
    
    try {
        // Test provinces
        const prov = await get('http://localhost:3000/api/locations/provinces/ca-mb');
        console.log('\n=== Manitoba ===');
        console.log('Federal Ridings:', prov.federalRidings ? prov.federalRidings.length : 0);
        if (prov.federalRidings && prov.federalRidings.length > 0) {
            prov.federalRidings.slice(0, 5).forEach(r => {
                console.log('  - ' + r.id + ': ' + r.name);
            });
        }
        
        // Test ideas for Winnipeg South Centre
        const ideas = await get('http://localhost:3000/api/locations/federal-ridings/fr-mb-winnipeg-south-centre/ideas');
        console.log('\n=== Ideas from Winnipeg South Centre ===');
        console.log('Total ideas:', ideas.length);
        if (ideas.length > 0) {
            ideas.forEach(i => {
                console.log('  - ' + i.title + ' (' + i.supportCount + ' supporters)');
            });
        }
        
    } catch (e) {
        console.error('Error:', e.message);
    }
    
    console.log('\nDone!');
}
test();

