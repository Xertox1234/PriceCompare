#!/bin/bash
# Security checks script
# Run this before committing code

set -e

echo "🔒 Running security checks..."
echo ""

# Check 1: npm audit
echo "📦 Checking for vulnerable dependencies..."
npm audit --audit-level=moderate || {
  echo "⚠️  Warning: Vulnerabilities found in dependencies"
  echo "   Run 'npm audit fix' to resolve"
}
echo ""

# Check 2: Type checking
echo "📝 Running TypeScript type checking..."
npm run check || {
  echo "❌ TypeScript errors found"
  exit 1
}
echo "✅ Type checking passed"
echo ""

# Check 3: Look for common security issues
echo "🔍 Scanning for security patterns..."

# Check for password hash exposure
if grep -r "passwordHash:" server/ --include="*.ts" | grep -v "SECURITY:" | grep -v "// " > /dev/null; then
  echo "⚠️  Warning: Potential password hash exposure detected"
  grep -n "passwordHash:" server/ --include="*.ts" | grep -v "SECURITY:" | grep -v "// "
fi

# Check for 'as any' type casts
if grep -r "as any" server/ --include="*.ts" | grep -v "SECURITY:" | grep -v "// " > /dev/null; then
  echo "⚠️  Warning: Unsafe 'as any' type casts found"
  grep -n "as any" server/ --include="*.ts" | grep -v "SECURITY:" | grep -v "// " | head -5
fi

# Check for parseInt without validation
if grep -r "parseInt(" server/ --include="*.ts" | grep -v "parseIntSafe\|parseIntOptional\|SECURITY:" | grep -v "// " > /dev/null; then
  echo "⚠️  Warning: Unsafe parseInt() calls found (use parseIntSafe instead)"
  grep -n "parseInt(" server/ --include="*.ts" | grep -v "parseIntSafe\|parseIntOptional\|SECURITY:" | grep -v "// " | head -5
fi

# Check for raw error message exposure
if grep -r "error\.message" server/ --include="*.ts" | grep -v "sanitizeErrorMessage\|createErrorResponse\|console\|SECURITY:" | grep -v "// " > /dev/null; then
  echo "⚠️  Warning: Potential raw error message exposure (use sanitizeErrorMessage)"
  grep -n "error\.message" server/ --include="*.ts" | grep -v "sanitizeErrorMessage\|createErrorResponse\|console\|SECURITY:" | grep -v "// " | head -5
fi

# Check for endpoints without authentication
if grep -r "app\.\(get\|post\|put\|delete\)" server/ --include="*.ts" | grep -v "requireAuth\|requireAdmin" | grep "/api/" > /dev/null; then
  echo "⚠️  Warning: Potential endpoints without authentication"
  grep -n "app\.\(get\|post\|put\|delete\)" server/ --include="*.ts" | grep -v "requireAuth\|requireAdmin" | grep "/api/" | head -5
fi

echo ""
echo "✅ Security checks complete!"
