#!/usr/bin/env node
/**
 * preflight_contract_validator.js - Contract & Relational Integrity Validator (Node.js Mirror)
 * Validates CIR contracts, cross-entity relationships, foreign keys, and boundary disjointness.
 */

const fs = require('fs');
const path = require('path');

function validateCir(cirPath) {
  if (!fs.existsSync(cirPath)) {
    return {
      valid: false,
      errors: [`CIR file not found at path: ${cirPath}`]
    };
  }

  let cirData;
  try {
    cirData = JSON.parse(fs.readFileSync(cirPath, 'utf8'));
  } catch (err) {
    return {
      valid: false,
      errors: [`Malformed JSON in CIR file: ${err.message}`]
    };
  }

  const errors = [];
  const warnings = [];
  const checksPassed = [];

  // 1. Structural Checks
  const requiredKeys = ['version', 'projectName', 'techStack', 'entities', 'endpoints', 'fileBoundaries'];
  for (const k of requiredKeys) {
    if (!cirData[k]) {
      errors.append ? errors.append(`Missing required top-level key: '${k}'`) : errors.push(`Missing required top-level key: '${k}'`);
    }
  }

  if (errors.length > 0) {
    return { valid: false, errors, warnings };
  }

  checksPassed.push('Top-level CIR structure verified');

  // 2. Entity and Relational Integrity Checks
  const entities = cirData.entities || [];
  const entityNames = new Set();

  for (const ent of entities) {
    const name = ent.name;
    if (!name) {
      errors.push('Encountered entity without a name');
    } else if (entityNames.has(name)) {
      errors.push(`Duplicate entity name: '${name}'`);
    } else {
      entityNames.add(name);
    }
  }

  for (const ent of entities) {
    const entName = ent.name || 'Unknown';
    const relations = ent.relations || [];
    for (const rel of relations) {
      const target = rel.targetEntity;
      const relType = rel.type;
      if (!entityNames.has(target)) {
        errors.push(`Entity '${entName}' specifies unknown relation target: '${target}'`);
      }
      if (!['one-to-one', 'one-to-many', 'many-to-one', 'many-to-many'].includes(relType)) {
        errors.push(`Entity '${entName}' relation to '${target}' has invalid type: '${relType}'`);
      }
    }
  }

  checksPassed.push(`Verified ${entities.length} entities and cross-relational foreign keys`);

  // 3. Endpoint Schema & Owner Worker Checks
  const endpoints = cirData.endpoints || [];
  const validWorkers = new Set(['strike-worker-backend', 'strike-worker-frontend', 'strike-worker-infra', 'conductor']);

  for (const ep of endpoints) {
    const { path: epPath, method, ownerWorker } = ep;
    if (!epPath || !method) {
      errors.push(`Endpoint missing path or method: ${JSON.stringify(ep)}`);
    }
    if (!validWorkers.has(ownerWorker)) {
      errors.push(`Endpoint '${method} ${epPath}' assigned to invalid worker '${ownerWorker}'`);
    }
  }

  checksPassed.push(`Verified ${endpoints.length} API endpoints and worker assignments`);

  // 4. Disjoint File Boundary Collision Check
  const fileBoundaries = cirData.fileBoundaries || {};
  const workers = Object.keys(fileBoundaries);
  const collisions = [];

  for (let i = 0; i < workers.length; i++) {
    for (let j = i + 1; j < workers.length; j++) {
      const w1 = workers[i];
      const w2 = workers[j];
      const set1 = new Set(fileBoundaries[w1]);
      const set2 = new Set(fileBoundaries[w2]);

      for (const f of set1) {
        if (set2.has(f)) {
          collisions.push({
            file: f,
            workers: [w1, w2],
            type: 'exact_overlap'
          });
        }
      }
    }
  }

  if (collisions.length > 0) {
    for (const c of collisions) {
      warnings.push(
        `File boundary overlap on '${c.file}' between ${c.workers[0]} and ${c.workers[1]}. ` +
        `Must collapse execution mode to SEQUENTIAL or route through ast_surgery.`
      );
    }
  }

  checksPassed.push('File boundary disjointness audited');

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    checksPassed,
    hasBoundaryCollisions: collisions.length > 0,
    boundaryCollisions: collisions
  };
}

// CLI Execution
const cirFile = process.argv[2];
if (!cirFile) {
  console.log('Usage: node preflight_contract_validator.js <path_to_cir.json>');
  process.exit(1);
}

const result = validateCir(cirFile);
console.log(JSON.stringify(result, null, 2));
process.exit(result.valid ? 0 : 2);
