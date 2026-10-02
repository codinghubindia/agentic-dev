const fs = require('fs');
const path = require('path');

function checkFile(filepath) {
    if (!fs.existsSync(filepath)) {
        console.error(`ERROR: File ${filepath} not found.`);
        return false;
    }

    const content = fs.readFileSync(filepath, 'utf-8');
    const errors = [];

    // Regex to match "export interface <Name>" or "export type <Name>"
    const rogueInterfacePattern = /export\s+(?:interface|type)\s+([A-Z][a-zA-Z0-9]*)\b/g;
    
    let match;
    while ((match = rogueInterfacePattern.exec(content)) !== null) {
        const typeName = match[1];
        if (!typeName.endsWith('Props') && 
            !typeName.endsWith('State') && 
            !typeName.endsWith('Response') && 
            !typeName.endsWith('Request')) {
            errors.push(`ROGUE TYPE DETECTED: '${typeName}'. Domain models and DTOs must be imported from the central Contract (types.ts/schema.ts), not defined locally by Leaf Agents.`);
        }
    }

    if (errors.length > 0) {
        console.error(`\n❌ Contract Violation in ${filepath}:`);
        errors.forEach(err => console.error(`  - ${err}`));
        return false;
    }

    console.log(`✅ ${filepath} passed contract enforcement.`);
    return true;
}

const args = process.argv.slice(2);
if (args.length === 0) {
    console.error("Usage: node contract_enforcer.js <filepath>");
    process.exit(1);
}

let allPassed = true;
for (const file of args) {
    if (!checkFile(file)) {
        allPassed = false;
    }
}

if (!allPassed) {
    process.exit(1);
}
process.exit(0);
