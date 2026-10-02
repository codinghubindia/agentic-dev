import sys
import os
import re

def extract_rules(skill_path, max_chars=3500):
    if not os.path.exists(skill_path):
        print(f"Error: {skill_path} not found.")
        sys.exit(1)
        
    with open(skill_path, 'r', encoding='utf-8') as f:
        content = f.read()

    extracted = []
    
    # 1. Extract rules/invariants/anti-patterns sections
    patterns = [
        r'(?i)(#+\s*.*(?:rule|invariant|anti-pattern|best practice|guideline|checklist).*?\n(?:(?!#+ ).)*)',
        r'(?i)(>\s*\[!(?:CAUTION|WARNING|IMPORTANT)\].*?\n(?:>.*?\n)*)',
        r'(```(?:tsx?|jsx?|typescript|bash|json).*?```)'
    ]
    
    for pat in patterns:
        for match in re.finditer(pat, content, re.DOTALL):
            text = match.group(1).strip()
            if text and text not in extracted:
                extracted.append(text)
                
    result = "\n\n".join(extracted)
    if len(result) > max_chars:
        result = result[:max_chars] + "\n\n...[Rules truncated to preserve token budget]..."
        
    if not result:
        # Fallback to first 3000 chars if no specific rule headers found
        result = content[:max_chars]

    print(result)

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python skill_rules_extractor.py <path_to_SKILL.md>")
        sys.exit(1)
    extract_rules(sys.argv[1])
