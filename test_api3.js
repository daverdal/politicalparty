// Quick sync test
const http = require('http');

console.log('Testing API...');
console.log('Calling health endpoint...');

const req = http.get('http://localhost:3000/api/health', { timeout: 5000 }, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
        console.log('Health:', data);
        
        // Now test provinces
        console.log('\nCalling provinces endpoint...');
        http.get('http://localhost:3000/api/locations/provinces/ca-mb', { timeout: 5000 }, (res2) => {
            let data2 = '';
            res2.on('data', chunk => data2 += chunk);
            res2.on('end', () => {
                try {
                    const prov = JSON.parse(data2);
                    console.log('Province:', prov.name);
                    console.log('Federal Ridings:', prov.federalRidings ? prov.federalRidings.length : 0);
                    if (prov.federalRidings) {
                        prov.federalRidings.slice(0, 3).forEach(r => console.log('  -', r.id));
                    }
                } catch (e) {
                    console.log('Parse error:', e.message);
                    console.log('Raw:', data2.substring(0, 200));
                }
                process.exit(0);
            });
        }).on('error', e => { console.log('Province error:', e.message); process.exit(1); });
    });
});

req.on('error', e => { console.log('Health error:', e.message); process.exit(1); });
req.on('timeout', () => { console.log('Timeout!'); req.destroy(); process.exit(1); });

