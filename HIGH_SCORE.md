# High Score — Update PR Quick Checks

This is a **supplement**, not a replacement, for the canonical contribution flow in:

- `AGENTS.md`
- `.claude/skills/metagraphed/SKILL.md`
- `.claude/skills/metagraphed/reference.md`

Use this file to run a fast duplicate/scope pre-flight before editing and again before opening the PR.

## 1) Pre-flight duplication scan (open PRs)

```bash
# Optional but recommended before every PR.
# Dump open PR changed paths and compare target files manually.
for pr in $(gh api 'repos/JSONbored/metagraphed/pulls?state=open' --paginate --jq '.[].number'); do
  echo "#${pr}"
  gh api repos/JSONbored/metagraphed/pulls/$pr/files --paginate --jq '.[].filename'
  echo
done
```

If you are adding a surface in `registry/subnets/<slug>.json`, confirm that same file is not already changing in another open PR.

## 2) Scoped overlap check

When your target is `registry/subnets/<slug>.json`, verify this exact file is not already listed in any other open PR touching the same subnet.

```bash
TARGET="registry/subnets/<slug>.json"
for pr in $(gh api 'repos/JSONbored/metagraphed/pulls?state=open' --paginate --jq '.[].number'); do
  if gh api repos/JSONbored/metagraphed/pulls/$pr/files --paginate --jq ".[].filename" | grep -Fxq "$TARGET"; then
    echo "Overlap detected: PR #$pr touches $TARGET"
  fi
done
```

## 3) What to record before opening the PR

- Canonical source of truth was read (`AGENTS.md`, `.claude/.../SKILL.md`, `.claude/.../reference.md`).
- Duplicate-scope scan output for open PR overlap.
- Validation/test commands run locally.
