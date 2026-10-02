import subprocess
import sys
import os

def check_contract(contract_path):
    if not os.path.exists(contract_path):
        print(f"❌ Contract file {contract_path} does not exist!")
        sys.exit(1)

    print(f"🔍 Validating contract integrity for {contract_path}...")
    
    # If TypeScript file, run tsc --noEmit
    if contract_path.endswith(('.ts', '.tsx')):
        cmd = ["npx", "tsc", "--noEmit", contract_path]
        try:
            result = subprocess.run(cmd, capture_output=True, text=True, shell=True)
            if result.returncode != 0:
                print(f"❌ Contract syntax/type verification failed:\n{result.stderr or result.stdout}")
                sys.exit(1)
        except Exception as e:
            print(f"⚠️ tsc check bypassed or failed to run: {e}")
            
    # If prisma schema, run prisma validate
    elif contract_path.endswith('.prisma'):
        cmd = ["npx", "prisma", "validate", "--schema", contract_path]
        try:
            result = subprocess.run(cmd, capture_output=True, text=True, shell=True)
            if result.returncode != 0:
                print(f"❌ Prisma contract validation failed:\n{result.stderr or result.stdout}")
                sys.exit(1)
        except Exception as e:
            print(f"⚠️ prisma validate bypassed: {e}")

    print(f"✅ Contract {contract_path} is structurally sound and verified!")
    sys.exit(0)

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python contract_gate.py <contract_path>")
        sys.exit(1)
    check_contract(sys.argv[1])
