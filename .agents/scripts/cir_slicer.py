import json
import sys
import os

def slice_cir(entity_name, cir_path=".agent_execution/cir.json"):
    if not os.path.exists(cir_path):
        print(f"ERROR: {cir_path} not found.")
        sys.exit(1)
        
    try:
        with open(cir_path, 'r', encoding='utf-8') as f:
            cir = json.load(f)
            
        sliced = {
            "entity": entity_name,
            "models": [],
            "endpoints": []
        }
        
        # Extract models related to entity
        if "models" in cir:
            for model in cir["models"]:
                if entity_name.lower() in model.get("name", "").lower():
                    sliced["models"].append(model)
                    
        # Extract endpoints related to entity
        if "endpoints" in cir:
            for ep in cir["endpoints"]:
                if entity_name.lower() in ep.get("path", "").lower():
                    sliced["endpoints"].append(ep)
                    
        print(json.dumps(sliced, indent=2))
        
    except Exception as e:
        print(f"ERROR: Failed to slice CIR - {str(e)}")
        sys.exit(1)

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python cir_slicer.py <EntityName>")
        sys.exit(1)
        
    slice_cir(sys.argv[1])
