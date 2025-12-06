// Quick API test
async function test() {
    try {
        // Test provinces
        const provRes = await fetch('http://localhost:3000/api/locations/provinces/ca-mb');
        const prov = await provRes.json();
        console.log('\n=== Manitoba ===');
        console.log('Federal Ridings:', prov.federalRidings?.length || 0);
        if (prov.federalRidings) {
            prov.federalRidings.slice(0, 5).forEach(r => {
                console.log(`  - ${r.id}: ${r.name}`);
            });
        }
        
        // Test ideas for Winnipeg South Centre
        const ideasRes = await fetch('http://localhost:3000/api/locations/federal-ridings/fr-mb-winnipeg-south-centre/ideas');
        const ideas = await ideasRes.json();
        console.log('\n=== Ideas from Winnipeg South Centre ===');
        console.log('Total ideas:', ideas.length);
        ideas.forEach(i => {
            console.log(`  - ${i.title} (${i.supportCount} supporters)`);
        });
        
    } catch (e) {
        console.error('Error:', e.message);
    }
}
test();

