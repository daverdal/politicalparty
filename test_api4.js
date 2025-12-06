const http = require('http');

console.log('Testing simpler endpoints...\n');

// Test federal ridings only (simpler query)
const req = http.get('http://localhost:3000/api/locations/provinces/ca-mb/federal-ridings', { timeout: 10000 }, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
        try {
            const ridings = JSON.parse(data);
            console.log('Federal Ridings in Manitoba:', ridings.length);
            ridings.slice(0, 5).forEach(r => console.log('  -', r.id, ':', r.name));
            
            // Now test ideas
            const id = ridings.find(r => r.name.includes('Winnipeg South'))?.id;
            if (id) {
                console.log('\nTesting ideas for:', id);
                http.get('http://localhost:3000/api/locations/federal-ridings/' + id + '/ideas', { timeout: 10000 }, (res2) => {
                    let data2 = '';
                    res2.on('data', chunk => data2 += chunk);
                    res2.on('end', () => {
                        const ideas = JSON.parse(data2);
                        console.log('Ideas:', ideas.length);
                        ideas.forEach(i => console.log('  -', i.title, '(' + i.supportCount + ' supporters)'));
                        process.exit(0);
                    });
                }).on('error', e => { console.log('Ideas error:', e.message); process.exit(1); });
            } else {
                console.log('Winnipeg South riding not found');
                process.exit(0);
            }
        } catch (e) {
            console.log('Parse error:', e.message);
            console.log('Raw:', data.substring(0, 500));
            process.exit(1);
        }
    });
});
req.on('error', e => { console.log('Error:', e.message); process.exit(1); });
req.on('timeout', () => { console.log('Timeout!'); req.destroy(); process.exit(1); });

