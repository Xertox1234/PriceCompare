#!/usr/bin/env node
/**
 * N+1 Query Pattern Detector
 * 
 * Scans server code for potential N+1 query anti-patterns:
 * - `for...of` loops with `await storage.*` or `await db.*` inside
 * - Sequential database calls that should be batched
 * 
 * Run: npx tsx scripts/detect-n-plus-one.ts
 * 
 * Exit codes:
 *   0 - No issues found (or all have suppress comments)
 *   1 - Potential N+1 patterns detected
 */

import * as fs from 'fs';
import * as path from 'path';
import { glob } from 'glob';

interface Detection {
  file: string;
  line: number;
  code: string;
  pattern: 'for-of-await' | 'map-async-await';
  callTarget: string;
  suppressed: boolean;
}

const SUPPRESS_COMMENT = '// N+1-OK:';
const DATABASE_PATTERNS = [
  /await\s+storage\.\w+\(/,
  /await\s+db\.\w+\(/,
  /await\s+this\.db\.\w+\(/,
  /await\s+this\.storage\.\w+\(/,
  /await\s+redisClient\.\w+\(/,
  /await\s+redis\.\w+\(/,
];

/**
 * Extract what's being called (e.g., "storage.getUser")
 */
function extractCallTarget(line: string): string {
  const match = line.match(/await\s+((?:storage|db|this\.db|this\.storage|redisClient|redis)\.\w+)/);
  return match ? match[1] : 'unknown';
}

/**
 * Check if line contains a database call
 */
function containsDatabaseCall(line: string): boolean {
  return DATABASE_PATTERNS.some(pattern => pattern.test(line));
}

/**
 * Check if previous lines contain suppression comment
 * Also checks at loop start for for...of patterns
 */
function hasSuppressComment(lines: string[], lineIndex: number, loopStartLine?: number): boolean {
  // Check current line and up to 5 lines before
  for (let i = Math.max(0, lineIndex - 5); i <= lineIndex; i++) {
    if (lines[i].includes(SUPPRESS_COMMENT) || lines[i].includes('eslint-disable')) {
      return true;
    }
  }
  
  // Also check around the loop start line if provided
  if (loopStartLine !== undefined) {
    for (let i = Math.max(0, loopStartLine - 5); i <= loopStartLine; i++) {
      if (lines[i].includes(SUPPRESS_COMMENT) || lines[i].includes('eslint-disable')) {
        return true;
      }
    }
  }
  
  return false;
}

/**
 * Detect N+1 patterns in a file
 */
function detectInFile(filePath: string): Detection[] {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const detections: Detection[] = [];
  
  // Track nesting level for for...of loops
  let forOfDepth = 0;
  let forOfStartLines: number[] = [];
  
  // Simple brace tracking for scope
  let braceStack: { type: 'for-of' | 'other'; line: number }[] = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    
    // Skip comments and empty lines
    if (trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed === '') {
      continue;
    }
    
    // Detect for...of start
    if (/for\s*\(\s*(const|let|var)\s+\w+\s+of\s+/.test(line)) {
      forOfDepth++;
      forOfStartLines.push(i + 1);
      
      // Track opening brace
      if (line.includes('{')) {
        braceStack.push({ type: 'for-of', line: i + 1 });
      }
    }
    
    // Track braces for for...of scope
    if (forOfDepth > 0) {
      // Count braces on this line (simplified)
      const openBraces = (line.match(/\{/g) || []).length;
      const closeBraces = (line.match(/\}/g) || []).length;
      
      // If we see closing braces, check if we're exiting a for...of
      if (closeBraces > openBraces) {
        const diff = closeBraces - openBraces;
        for (let j = 0; j < diff && braceStack.length > 0; j++) {
          const popped = braceStack.pop();
          if (popped?.type === 'for-of') {
            forOfDepth--;
            forOfStartLines.pop();
          }
        }
      }
      
      // If we're inside a for...of and find a database call
      if (forOfDepth > 0 && containsDatabaseCall(line)) {
        const loopStartLine = forOfStartLines[forOfStartLines.length - 1];
        detections.push({
          file: filePath,
          line: i + 1,
          code: trimmed.substring(0, 100),
          pattern: 'for-of-await',
          callTarget: extractCallTarget(line),
          suppressed: hasSuppressComment(lines, i, loopStartLine - 1),
        });
      }
    }
    
    // Detect .map(async with database calls (simplified detection)
    if (/\.map\(\s*async/.test(line)) {
      // Look ahead in the same map block for database calls
      let braceCount = 0;
      let mapStarted = false;
      
      for (let j = i; j < Math.min(i + 30, lines.length); j++) {
        const mapLine = lines[j];
        
        if (mapLine.includes('{')) {
          braceCount += (mapLine.match(/\{/g) || []).length;
          mapStarted = true;
        }
        if (mapLine.includes('}')) {
          braceCount -= (mapLine.match(/\}/g) || []).length;
        }
        
        // Check for database calls inside the map
        if (mapStarted && containsDatabaseCall(mapLine)) {
          detections.push({
            file: filePath,
            line: j + 1,
            code: mapLine.trim().substring(0, 100),
            pattern: 'map-async-await',
            callTarget: extractCallTarget(mapLine),
            suppressed: hasSuppressComment(lines, j, i),
          });
        }
        
        // Exit when map block closes
        if (mapStarted && braceCount <= 0) {
          break;
        }
      }
    }
  }
  
  return detections;
}

async function main() {
  console.log('🔍 Scanning for N+1 query patterns...\n');
  
  // Find all TypeScript files in server directory (excluding tests)
  const files = await glob('server/**/*.ts', {
    cwd: process.cwd(),
    ignore: ['**/__tests__/**', '**/*.test.ts', '**/*.spec.ts', '**/test/**'],
  });
  
  let allDetections: Detection[] = [];
  
  for (const file of files) {
    const detections = detectInFile(file);
    allDetections.push(...detections);
  }
  
  // Separate suppressed and unsuppressed
  const unsuppressed = allDetections.filter(d => !d.suppressed);
  const suppressed = allDetections.filter(d => d.suppressed);
  
  // Report findings
  if (unsuppressed.length > 0) {
    console.log('❌ Potential N+1 Query Patterns Found:\n');
    
    for (const d of unsuppressed) {
      console.log(`  ${d.file}:${d.line}`);
      console.log(`    Pattern: ${d.pattern === 'for-of-await' ? 'for...of with await' : '.map(async) with await'}`);
      console.log(`    Call: ${d.callTarget}`);
      console.log(`    Code: ${d.code}`);
      console.log();
    }
    
    console.log(`\n📊 Summary: ${unsuppressed.length} potential N+1 patterns found`);
    console.log(`   ${suppressed.length} suppressed with // N+1-OK: comment`);
    console.log(`\n💡 To suppress false positives, add a comment explaining why:`);
    console.log(`   // N+1-OK: Intentional sequential processing for rate limiting`);
    console.log(`   for (const item of items) { await db.update(...); }\n`);
    
    process.exit(1);
  } else {
    console.log('✅ No unsuppressed N+1 patterns found!');
    if (suppressed.length > 0) {
      console.log(`   ${suppressed.length} patterns suppressed with // N+1-OK: comment`);
    }
    console.log(`   Scanned ${files.length} files`);
    process.exit(0);
  }
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
