#!/usr/bin/env node
/**
 * receipt_swapper.js - Content-Addressable Tool Output Garbage Collection
 * Hashes terminal outputs and large payloads to disk and emits O(1) semantic receipts (<50 tokens).
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const RECEIPTS_DIR = path.join('.agent_execution', 'receipts');

function swapPayload(rawContent, action, target, summary = "", status = "success", exitCode = 0) {
    if (!fs.existsSync(RECEIPTS_DIR)) {
        fs.mkdirSync(RECEIPTS_DIR, { recursive: true });
    }

    const contentBuffer = Buffer.from(rawContent, 'utf-8');
    const contentHash = crypto.createHash('sha256').update(contentBuffer).digest('hex').substring(0, 16);

    const receiptFilename = `${contentHash}.log`;
    const receiptPath = path.join(RECEIPTS_DIR, receiptFilename).replace(/\\/g, '/');

    fs.writeFileSync(receiptPath, contentBuffer);

    const lineCount = rawContent.split(/\r?\n/).length;
    const byteSize = contentBuffer.length;

    if (!summary) {
        summary = `Executed ${action} on ${target}: ${lineCount} lines (${byteSize} bytes).`;
    }

    const receipt = {
        "$schema": "../schemas/receipt.schema.json",
        "status": status,
        "exit_code": exitCode,
        "action": action,
        "target": target,
        "summary": summary.substring(0, 200),
        "metrics": {
            "lines": lineCount,
            "bytes": byteSize
        },
        "receiptRef": receiptPath,
        "timestamp": new Date().toISOString()
    };

    return receipt;
}

const args = process.argv.slice(2);
if (args.length < 2) {
    console.error("Usage: node receipt_swapper.js <action> <target> [raw_content]");
    process.exit(1);
}

const actionArg = args[0];
const targetArg = args[1];
let rawContentArg = "";

if (args.length > 2) {
    rawContentArg = args.slice(2).join(" ");
    console.log(JSON.stringify(swapPayload(rawContentArg, actionArg, targetArg), null, 2));
} else {
    try {
        rawContentArg = fs.readFileSync(0, 'utf-8');
    } catch (e) {
        rawContentArg = "";
    }
    console.log(JSON.stringify(swapPayload(rawContentArg, actionArg, targetArg), null, 2));
}
