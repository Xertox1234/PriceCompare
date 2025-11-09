#!/bin/bash

# Security Scanner Script
# Runs comprehensive security checks on the codebase

set -e

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔒 PriceCompare Security Scanner"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

FAILED=0
WARNINGS=0

# 1. Dependency Audit
echo "${BLUE}[1/6] 📦 Scanning dependencies for vulnerabilities...${NC}"
if npm audit --audit-level=high > /dev/null 2>&1; then
  echo "${GREEN}✅ No high/critical vulnerabilities in dependencies${NC}"
else
  echo "${YELLOW}⚠️  Vulnerabilities found in dependencies${NC}"
  npm audit --audit-level=moderate || true
  WARNINGS=$((WARNINGS + 1))
fi
echo ""

# 2. Secret Scanning
echo "${BLUE}[2/6] 🔐 Scanning for hardcoded secrets...${NC}"
SECRET_FOUND=0

# Define patterns
PATTERNS=(
  'password.*[:=].*["'\''][^"'\'']+["'\'']'
  'api[_-]?key.*[:=].*["'\''][^"'\'']+["'\'']'
  'secret.*[:=].*["'\''][a-zA-Z0-9]{20,}["'\'']'
  'AKIA[0-9A-Z]{16}'
  '-----BEGIN.*PRIVATE KEY-----'
)

for pattern in "${PATTERNS[@]}"; do
  if grep -rE "$pattern" server/ client/ --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" 2>/dev/null | grep -v "process.env" | grep -v "CHANGE_THIS" | grep -v "your_" | grep -v "example" | grep -v ".env.example" | grep -v "getRequiredEnv" | grep -v "getOptionalEnv" | head -5; then
    SECRET_FOUND=1
  fi
done

if [ $SECRET_FOUND -eq 0 ]; then
  echo "${GREEN}✅ No hardcoded secrets detected${NC}"
else
  echo "${RED}❌ Hardcoded secrets found!${NC}"
  FAILED=1
fi
echo ""

# 3. Vulnerable Code Patterns
echo "${BLUE}[3/6] 🛡️  Scanning for vulnerable code patterns...${NC}"
VULNERABLE=0

# SQL Injection
if grep -rE '(query|execute).*\+.*req\.(body|params|query)' server/ --include="*.ts" --include="*.js" 2>/dev/null | head -3; then
  echo "${RED}❌ Potential SQL injection pattern detected${NC}"
  VULNERABLE=1
fi

# XSS via dangerouslySetInnerHTML
if grep -r "dangerouslySetInnerHTML" client/ --include="*.tsx" --include="*.jsx" 2>/dev/null | head -3; then
  echo "${YELLOW}⚠️  dangerouslySetInnerHTML detected - ensure sanitization${NC}"
  WARNINGS=$((WARNINGS + 1))
fi

# eval() usage
if grep -rE '\beval\s*\(' server/ client/ --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" 2>/dev/null; then
  echo "${RED}❌ eval() usage detected!${NC}"
  VULNERABLE=1
fi

# Insecure randomness for security
if grep -rE 'Math\.random\(\)' server/ --include="*.ts" --include="*.js" 2>/dev/null | grep -iE '(password|token|secret|key|salt)'; then
  echo "${RED}❌ Insecure Math.random() for security-sensitive value${NC}"
  VULNERABLE=1
fi

if [ $VULNERABLE -eq 0 ]; then
  echo "${GREEN}✅ No obvious vulnerable patterns detected${NC}"
else
  FAILED=1
fi
echo ""

# 4. Environment Variable Validation
echo "${BLUE}[4/6] 🌍 Checking environment variable usage...${NC}"
ENV_ISSUES=0

# Check for direct process.env usage on critical secrets
if grep -r "process.env.SESSION_SECRET" server/ --include="*.ts" 2>/dev/null | grep -v "getRequiredEnv" | grep -v "validation.ts" | grep -v "SECURITY:"; then
  echo "${YELLOW}⚠️  SESSION_SECRET should use getRequiredEnv()${NC}"
  ENV_ISSUES=1
fi

if grep -r "process.env.CSRF_SECRET" server/ --include="*.ts" 2>/dev/null | grep -v "getRequiredEnv" | grep -v "validation.ts" | grep -v "SECURITY:"; then
  echo "${YELLOW}⚠️  CSRF_SECRET should use getRequiredEnv()${NC}"
  ENV_ISSUES=1
fi

# Check for fallback values
if grep -rE 'process\.env\.[A-Z_]+\s*\|\|' server/ --include="*.ts" 2>/dev/null | grep -v "getOptionalEnv" | grep -v "localhost" | grep -v "development" | head -3; then
  echo "${YELLOW}⚠️  Env var fallback detected - use getOptionalEnv()${NC}"
  WARNINGS=$((WARNINGS + 1))
fi

if [ $ENV_ISSUES -eq 0 ]; then
  echo "${GREEN}✅ Environment variable usage is secure${NC}"
else
  WARNINGS=$((WARNINGS + 1))
fi
echo ""

# 5. TypeScript Type Check
echo "${BLUE}[5/6] 🔧 Running TypeScript type checking...${NC}"
if npm run check > /dev/null 2>&1; then
  echo "${GREEN}✅ TypeScript compilation successful${NC}"
else
  echo "${YELLOW}⚠️  TypeScript type errors detected${NC}"
  WARNINGS=$((WARNINGS + 1))
fi
echo ""

# 6. Security TODO Check
echo "${BLUE}[6/6] 📝 Checking for security TODOs...${NC}"
if grep -rE "(TODO|FIXME|XXX).*(security|password|secret|vulnerability)" server/ client/ --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" 2>/dev/null | head -5; then
  echo "${YELLOW}⚠️  Security-related TODOs found${NC}"
  WARNINGS=$((WARNINGS + 1))
else
  echo "${GREEN}✅ No security TODOs found${NC}"
fi
echo ""

# Summary
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 Security Scan Summary"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if [ $FAILED -eq 0 ] && [ $WARNINGS -eq 0 ]; then
  echo "${GREEN}✅ All security checks passed!${NC}"
  echo "   No issues detected"
  exit 0
elif [ $FAILED -eq 0 ]; then
  echo "${YELLOW}⚠️  Security scan completed with $WARNINGS warning(s)${NC}"
  echo "   Please review warnings above"
  exit 0
else
  echo "${RED}❌ Security scan failed!${NC}"
  echo "   Critical issues found - please fix before deploying"
  exit 1
fi
