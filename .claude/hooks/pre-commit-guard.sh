#!/usr/bin/env bash
# Pre-commit guard — scan staged files for secret/token patterns
# Installed as both .claude/hooks/ and .git/hooks/pre-commit

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Patterns that indicate leaked secrets
PATTERNS=(
  "ghp_[a-zA-Z0-9]{10,}"           # GitHub classic PAT
  "github_pat_[a-zA-Z0-9_]{10,}"  # GitHub fine-grained PAT
  "sk-[a-zA-Z0-9]{10,}"           # OpenAI/DeepSeek API key
  "sk-ant-[a-zA-Z0-9_-]{10,}"     # Anthropic API key
  "xox[bpras]-[a-zA-Z0-9-]{10,}"  # Slack token
  "AIza[0-9A-Za-z_-]{10,}"        # Google API key
  "secret_key=[\"']?[a-zA-Z0-9_]{10,}" # Generic secret key assignments
  "-----BEGIN (RSA|EC|OPENSSH|DSA) PRIVATE KEY-----"  # Private keys
)

FOUND=0
STAGED_FILES=$(git diff --cached --name-only --diff-filter=ACM 2>/dev/null || echo "")

if [ -z "$STAGED_FILES" ]; then
  exit 0
fi

for file in $STAGED_FILES; do
  # Skip binary files
  if file "$file" 2>/dev/null | grep -q "binary"; then
    continue
  fi
  while IFS= read -r pattern; do
    if grep -nE "$pattern" "$file" 2>/dev/null; then
      echo -e "${RED}[SECRET LEAK]${NC} Pattern matched in staged file: ${YELLOW}$file${NC}"
      FOUND=1
    fi
  done <<< "$(printf '%s\n' "${PATTERNS[@]}")"
done

if [ "$FOUND" -eq 1 ]; then
  echo ""
  echo -e "${RED}============================================${NC}"
  echo -e "${RED}  COMMIT BLOCKED: Possible secret leak detected!${NC}"
  echo -e "${RED}============================================${NC}"
  echo ""
  echo "If this is a false positive, run: git commit --no-verify"
  echo "But please verify the matched content is NOT a real secret."
  exit 1
fi

echo -e "${GREEN}[OK]${NC} No secret patterns detected in staged files."
exit 0
