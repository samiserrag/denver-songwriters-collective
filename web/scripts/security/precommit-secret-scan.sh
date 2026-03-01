#!/usr/bin/env bash
set -euo pipefail

# Lightweight staged-diff secret scan for local pre-commit usage.
# Scope is intentionally narrow to reduce false positives while catching
# the most dangerous leaks (API keys, service-role keys, DB URLs, SMTP pass).

repo_root="$(git rev-parse --show-toplevel)"
cd "$repo_root"

if [[ -z "$(git diff --cached --name-only --diff-filter=ACM)" ]]; then
  exit 0
fi

has_hits=0

is_placeholder_line() {
  local line="$1"
  [[ "$line" == *"..."* ]] && return 0
  [[ "$line" == *"REDACTED"* ]] && return 0
  [[ "$line" == *"<"*">"* ]] && return 0
  [[ "$line" == *"example"* ]] && return 0
  [[ "$line" == *"placeholder"* ]] && return 0
  return 1
}

matches_secret_pattern() {
  local line="$1"
  echo "$line" | grep -Eiq \
    '(OPENAI_API_KEY\s*=\s*[^[:space:]]+|SUPABASE_SERVICE_ROLE_KEY\s*=\s*[^[:space:]]+|SMTP_PASSWORD\s*=\s*[^[:space:]]+|DATABASE_URL\s*=\s*postgres(ql)?:\/\/[^[:space:]]+|sk-proj-[A-Za-z0-9_-]{20,}|sk-[A-Za-z0-9_-]{20,}|BEGIN (RSA|EC|OPENSSH) PRIVATE KEY)'
}

while IFS= read -r file; do
  # Skip deleted/renamed targets that no longer exist.
  [[ -e "$file" ]] || continue

  # Skip binary files.
  if ! git show ":$file" | grep -Iq .; then
    continue
  fi

  while IFS= read -r line; do
    # Only look at added lines (and ignore patch metadata).
    [[ "$line" =~ ^\+ ]] || continue
    [[ "$line" =~ ^\+\+\+ ]] && continue
    line="${line#+}"

    is_placeholder_line "$line" && continue

    if matches_secret_pattern "$line"; then
      has_hits=1
      echo "SECRET SCAN: potential secret in staged file '$file':"
      echo "  + $line"
      echo
    fi
  done < <(git diff --cached -U0 -- "$file")
done < <(git diff --cached --name-only --diff-filter=ACM)

if [[ "$has_hits" -eq 1 ]]; then
  cat <<'EOF'
Commit blocked by pre-commit secret scan.

Next steps:
1) Remove the secret from staged files.
2) Store it only in local env / secret manager.
3) If this was a real key, rotate/revoke it immediately.
EOF
  exit 1
fi

exit 0
