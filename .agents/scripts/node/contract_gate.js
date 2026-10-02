const { execSync } = require('child_process');
const fs = require('fs');

function checkContract(contractPath) {
    if (!fs.existsSync(contractPath)) {
        console.error(`❌ Contract file ${contractPath} does not exist!`);
        process.exit(1);
    }

    console.log(`🔍 Validating contract integrity for ${contractPath}...`);

    if (contractPath.endsWith('.ts') || contractPath.endsWith('.tsx')) {
        try {
            execSync(`npx tsc --noEmit "${contractPath}"`, { stdio: 'pipe' });
        } catch (err) {
            console.error(`❌ Contract syntax/type verification failed:\n${err.stdout || err.stderr}`);
            process.exit(1);
        }
    } else if (contractPath.endsWith('.prisma')) {
        try {
            execSync(`npx prisma validate --schema "${contractPath}"`, { stdio: 'pipe' });
        } catch (err) {
            console.error(`❌ Prisma contract validation failed:\n${err.stdout || err.stderr}`);
            process.exit(1);
        }
    }

    console.log(`✅ Contract ${contractPath} is structurally sound and verified!`);
    process.exit(0);
}

const args = process.argv.slice(2);
if (args.length < 1) {
    console.error('Usage: node contract_gate.js <contract_path>');
    process.exit(1);
}

checkContract(args[0]);
