const fs = require('fs');

function sliceCir(entityName, cirPath = '.agent_execution/cir.json') {
    if (!fs.existsSync(cirPath)) {
        console.error(`ERROR: ${cirPath} not found.`);
        process.exit(1);
    }
    
    try {
        const cir = JSON.parse(fs.readFileSync(cirPath, 'utf-8'));
        const sliced = {
            entity: entityName,
            models: [],
            endpoints: []
        };
        
        if (cir.models) {
            sliced.models = cir.models.filter(m => 
                (m.name || '').toLowerCase().includes(entityName.toLowerCase())
            );
        }
        
        if (cir.endpoints) {
            sliced.endpoints = cir.endpoints.filter(e => 
                (e.path || '').toLowerCase().includes(entityName.toLowerCase())
            );
        }
        
        console.log(JSON.stringify(sliced, null, 2));
    } catch (e) {
        console.error(`ERROR: Failed to slice CIR - ${e.message}`);
        process.exit(1);
    }
}

const args = process.argv.slice(2);
if (args.length < 1) {
    console.error("Usage: node cir_slicer.js <EntityName>");
    process.exit(1);
}

sliceCir(args[0]);
