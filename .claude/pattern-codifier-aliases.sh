#!/bin/bash
# Pattern Codifier Convenience Aliases
# Source this file to get quick pattern codification commands:
#   source .claude/pattern-codifier-aliases.sh

# Quick pattern codification after review
alias codify='claude task pattern-codifier "Codify patterns from this session"'

# Codify from specific domain
alias codify-security='claude task pattern-codifier "Codify security patterns from this session to SECURITY_PATTERNS.md"'
alias codify-database='claude task pattern-codifier "Codify database patterns from this session to DATABASE_PATTERNS.md"'
alias codify-api='claude task pattern-codifier "Codify API patterns from this session to API_PATTERNS.md"'
alias codify-typescript='claude task pattern-codifier "Codify TypeScript patterns from this session to TYPESCRIPT_PATTERNS.md"'
alias codify-testing='claude task pattern-codifier "Codify testing patterns from this session to TESTING_PATTERNS.md"'

# Codify from recent commits
alias codify-recent='claude task pattern-codifier "Review commits from last 7 days and extract patterns worth documenting"'

# Codify from specific PR
function codify-pr() {
  if [ -z "$1" ]; then
    echo "Usage: codify-pr <PR_NUMBER>"
    echo "Example: codify-pr 123"
    return 1
  fi
  claude task pattern-codifier "Analyze PR #$1 and extract any patterns worth documenting"
}

# Update existing pattern
function codify-update() {
  if [ -z "$1" ] || [ -z "$2" ]; then
    echo "Usage: codify-update <PATTERN_FILE> <description>"
    echo "Example: codify-update DATABASE_PATTERNS 'Add SERIALIZABLE isolation example to Transaction Boundaries pattern'"
    return 1
  fi
  claude task pattern-codifier "Update $1: $2"
}

# Enable automatic pattern codification after code reviews
function enable-auto-codify() {
  echo "Enabling automatic pattern codification after code reviews..."

  # Check if jq is installed
  if ! command -v jq &> /dev/null; then
    echo "❌ Error: jq is not installed. Install with: brew install jq (macOS) or apt-get install jq (Linux)"
    return 1
  fi

  # Update hooks.json to enable post-code-review
  jq '.["post-code-review"].enabled = true' .claude/hooks.json > .claude/hooks.json.tmp
  mv .claude/hooks.json.tmp .claude/hooks.json

  echo "✅ Automatic pattern codification enabled!"
  echo "After code reviews, pattern-codifier will run automatically."
  echo "To disable: run disable-auto-codify"
}

# Disable automatic pattern codification
function disable-auto-codify() {
  echo "Disabling automatic pattern codification..."

  if ! command -v jq &> /dev/null; then
    echo "❌ Error: jq is not installed. Install with: brew install jq (macOS) or apt-get install jq (Linux)"
    return 1
  fi

  jq '.["post-code-review"].enabled = false' .claude/hooks.json > .claude/hooks.json.tmp
  mv .claude/hooks.json.tmp .claude/hooks.json

  echo "✅ Automatic pattern codification disabled!"
  echo "You can still run pattern codification manually with: codify"
}

# Show pattern codification status
function codify-status() {
  echo "📊 Pattern Codification Status"
  echo "================================"
  echo ""

  # Check if auto-codify is enabled
  if command -v jq &> /dev/null; then
    auto_enabled=$(jq -r '.["post-code-review"].enabled' .claude/hooks.json 2>/dev/null)
    if [ "$auto_enabled" = "true" ]; then
      echo "🤖 Automatic codification: ENABLED"
      echo "   Pattern-codifier runs after every code review"
    else
      echo "👤 Automatic codification: DISABLED (manual mode)"
      echo "   Run 'codify' command after reviews to extract patterns"
    fi
  else
    echo "⚠️  Cannot check auto-codify status (jq not installed)"
  fi

  echo ""
  echo "📚 Pattern Files:"
  wc -l docs/*_PATTERNS.md 2>/dev/null | tail -1 | awk '{print "   Total lines: " $1}'

  echo ""
  echo "📝 Available Commands:"
  echo "   codify                    - Quick codification from current session"
  echo "   codify-security           - Codify security patterns"
  echo "   codify-database           - Codify database patterns"
  echo "   codify-api                - Codify API patterns"
  echo "   codify-typescript         - Codify TypeScript patterns"
  echo "   codify-testing            - Codify testing patterns"
  echo "   codify-recent             - Codify from last 7 days of commits"
  echo "   codify-pr <NUMBER>        - Codify from specific PR"
  echo "   codify-update <FILE> <desc> - Update existing pattern"
  echo "   enable-auto-codify        - Enable automatic codification"
  echo "   disable-auto-codify       - Disable automatic codification"
  echo "   codify-status             - Show this status"
}

# Show welcome message
echo "✨ Pattern Codifier aliases loaded!"
echo "Run 'codify-status' to see available commands"
