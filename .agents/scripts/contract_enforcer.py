import sys
import re
import os

def check_file(filepath):
    if not os.path.exists(filepath):
        print(f"ERROR: File {filepath} not found.")
        return False
        
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
        
    errors = []
    
    # Rule 1: Must not define generic 'type' or 'interface' that sounds like a domain model.
    # Leaf agents should import domain models from a central contract file (e.g. types.ts, schema.ts)
    # We will flag any export interface that doesn't end with 'Props' or 'State' (which are local UI contracts).
    rogue_interface_pattern = re.compile(r'export\s+(?:interface|type)\s+([A-Z][a-zA-Z0-9]*)(?!\s*Props|\s*State)\b')
    matches = rogue_interface_pattern.findall(content)
    
    for match in matches:
        if not match.endswith('Props') and not match.endswith('State') and not match.endswith('Response') and not match.endswith('Request'):
            errors.append(f"ROGUE TYPE DETECTED: '{match}'. Domain models and DTOs must be imported from the central Contract (types.ts/schema.ts), not defined locally by Leaf Agents.")
            
    if errors:
        print(f"\n❌ Contract Violation in {filepath}:")
        for err in errors:
            print(f"  - {err}")
        return False
        
    print(f"✅ {filepath} passed contract enforcement.")
    return True

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python contract_enforcer.py <filepath>")
        sys.exit(1)
        
    all_passed = True
    for file in sys.argv[1:]:
        if not check_file(file):
            all_passed = False
            
    if not all_passed:
        sys.exit(1)
    sys.exit(0)
