import subprocess
import json
import sys
import os

def resolve_skill(tech_query):
    print(f"🔍 [Skill Resolver] Searching registry for skill: '{tech_query}'...")
    
    # 1. First search via npx skills find
    try:
        find_cmd = ["npx", "skills", "find", tech_query]
        find_res = subprocess.run(find_cmd, capture_output=True, text=True, shell=True)
        lines = find_res.stdout.splitlines()
        
        candidates = []
        for line in lines:
            line = line.strip()
            if "@" in line and not line.startswith("http") and not line.startswith("Install"):
                pkg_match = line.split()[0]
                candidates.append(pkg_match)

        if candidates:
            top_choice = candidates[0]
            print(f"📦 [Skill Resolver] Found candidate: '{top_choice}'. Installing via npx skills add...")
            add_cmd = ["npx", "skills", "add", top_choice, "-y"]
            add_res = subprocess.run(add_cmd, capture_output=True, text=True, shell=True)
            if add_res.returncode == 0:
                print(f"✅ [Skill Resolver] Successfully installed '{top_choice}' into .agents/skills/!")
                return True
            else:
                print(f"⚠️ [Skill Resolver] Failed to install '{top_choice}': {add_res.stderr}")
    except Exception as e:
        print(f"⚠️ [Skill Resolver] npx skills search encountered error: {e}")

    # 2. Check npm alternative (e.g. ui-skills, custom packs)
    print(f"ℹ️ [Skill Resolver] No official package found on skills.sh for '{tech_query}'.")
    print(f"🛡️ [Skill Resolver] Triggering fallback: rely on type definitions & base training knowledge with compiler gate.")
    return False

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python skill_resolver.py <technology_or_package>")
        sys.exit(1)
        
    success = resolve_skill(sys.argv[1])
    sys.exit(0 if success else 1)
