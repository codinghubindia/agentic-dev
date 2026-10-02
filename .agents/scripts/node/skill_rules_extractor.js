const fs = require('fs');
const path = require('path');

function extractRules(skillPath, maxChars = 3500) {
    if (!fs.existsSync(skillPath)) {
        console.error(`Error: ${skillPath} not found.`);
        process.exit(1);
    }

    const content = fs.readFileSync(skillPath, 'utf-8');
    const extracted = [];

    const patterns = [
        /(#+\s*.*(?:rule|invariant|anti-pattern|best practice|guideline|checklist).*?\n(?:(?!#+ ).)*)/gis,
        /(>\s*\[!(?:CAUTION|WARNING|IMPORTANT)\].*?\n(?:>.*?\n)*)/gis,
        /(```(?:tsx?|jsx?|typescript|bash|json).*?```)/gis
    ];

    for (const pat of patterns) {
        let match;
        while ((match = pat.exec(content)) !== null) {
            const text = match[1].trim();
            if (text && !extracted.includes(text)) {
                extracted.push(text);
            }
        }
    }

    let result = extracted.join('\n\n');
    if (result.length > maxChars) {
        result = result.slice(0, maxChars) + '\n\n...[Rules truncated to preserve token budget]...';
    }

    if (!result) {
        result = content.slice(0, maxChars);
    }

    console.log(result);
}

const args = process.argv.slice(2);
if (args.length < 1) {
    console.error('Usage: node skill_rules_extractor.js <path_to_SKILL.md>');
    process.exit(1);
}

extractRules(args[0]);
