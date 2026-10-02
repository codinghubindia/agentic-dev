const { execSync } = require('child_process');

function resolveSkill(techQuery) {
    console.log(`🔍 [Skill Resolver] Searching registry for skill: '${techQuery}'...`);

    try {
        const findOut = execSync(`npx skills find "${techQuery}"`, { stdio: 'pipe' }).toString();
        const lines = findOut.split('\n');
        const candidates = [];

        for (let line of lines) {
            line = line.trim();
            if (line.includes('@') && !line.startsWith('http') && !line.startsWith('Install')) {
                candidates.push(line.split(' ')[0]);
            }
        }

        if (candidates.length > 0) {
            const topChoice = candidates[0];
            console.log(`📦 [Skill Resolver] Found candidate: '${topChoice}'. Installing via npx skills add...`);
            execSync(`npx skills add "${topChoice}" -y`, { stdio: 'pipe' });
            console.log(`✅ [Skill Resolver] Successfully installed '${topChoice}' into .agents/skills/!`);
            process.exit(0);
        }
    } catch (err) {
        // Continue to fallback
    }

    console.log(`ℹ️ [Skill Resolver] No official package found on skills.sh for '${techQuery}'.`);
    console.log(`🛡️ [Skill Resolver] Triggering fallback: rely on type definitions & base training knowledge with compiler gate.`);
    process.exit(1);
}

const args = process.argv.slice(2);
if (args.length < 1) {
    console.error('Usage: node skill_resolver.js <technology_or_package>');
    process.exit(1);
}

resolveSkill(args[0]);
