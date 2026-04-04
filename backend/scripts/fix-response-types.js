/**
 * Script to automatically add Response type annotations to route handlers
 * This fixes TypeScript errors for missing Response type annotations
 */

const fs = require('fs');
const path = require('path');
const glob = require('glob');

// Patterns to match route handler function signatures
const routeHandlerPatterns = [
  // Pattern: router.get('/', authenticate, async (req: AuthRequest, res) => {
  /router\.(get|post|put|delete|patch)\([^,]+,\s*(?:authenticate|requireAdmin|checkPermission|requireAuth|requirePermission)?[^,]*,\s*async\s*\(\s*req[^,]*,\s*res\s*\)\s*=>/g,
  // Pattern: router.get('/', async (req: AuthRequest, res) => {
  /router\.(get|post|put|delete|patch)\([^,]+,\s*async\s*\(\s*req[^,]*,\s*res\s*\)\s*=>/g,
  // Pattern: async (req, res) => {
  /async\s*\(\s*req[^,]*,\s*res\s*\)\s*=>/g,
  // Pattern: (req, res) => {
  /\(\s*req[^,]*,\s*res\s*\)\s*=>/g,
];

function fixFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;

  // Check if Response is already imported
  const hasResponseImport = /import.*Response.*from ['"]express['"]/.test(content);
  
  // Add Response import if not present
  if (!hasResponseImport && content.includes('from \'express\'')) {
    content = content.replace(
      /(import\s+(?:\w+\s+from\s+)?['"]express['"])/,
      'import { Response } from \'express\''
    );
    modified = true;
  } else if (!hasResponseImport && content.includes('import express')) {
    content = content.replace(
      /import express(?!.*\{.*Response)/,
      'import express, { Response }'
    );
    modified = true;
  }

  // Fix route handlers - replace res) with res: Response)
  const patterns = [
    // Pattern 1: async (req: Type, res) =>
    {
      regex: /async\s*\(\s*(req[^,)]+),\s*res\s*\)\s*=>/g,
      replacement: (match, reqPart) => {
        if (!reqPart.includes('Response')) {
          return `async (${reqPart}, res: Response) =>`;
        }
        return match;
      }
    },
    // Pattern 2: (req: Type, res) =>
    {
      regex: /\(\s*(req[^,)]+),\s*res\s*\)\s*=>/g,
      replacement: (match, reqPart) => {
        if (!reqPart.includes('Response') && !match.includes('async')) {
          return `(${reqPart}, res: Response) =>`;
        }
        return match;
      }
    },
  ];

  patterns.forEach(({ regex, replacement }) => {
    const newContent = content.replace(regex, replacement);
    if (newContent !== content) {
      content = newContent;
      modified = true;
    }
  });

  if (modified) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Fixed: ${filePath}`);
    return true;
  }
  return false;
}

// Find all route files
const routeFiles = glob.sync('backend/src/routes/**/*.ts');

console.log(`Found ${routeFiles.length} route files to check...`);

let fixedCount = 0;
routeFiles.forEach(file => {
  if (fixFile(file)) {
    fixedCount++;
  }
});

console.log(`\nFixed ${fixedCount} files.`);

