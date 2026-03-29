Run quality gates and create a pull request for the current branch.

## Steps

1. **Type check** — `pnpm tsc --noEmit`
   - Fix any type errors before proceeding (remember: build ignores them)

2. **Lint** — `pnpm lint`
   - Fix any ESLint errors

3. **Build check** — `pnpm build`
   - Confirm production build succeeds

4. **Create PR** using `gh pr create` with:
   - Clear title (under 70 chars)
   - Summary of changes (what and why)
   - Test plan (manual steps to verify the feature/fix)
   - Note any known limitations or follow-up work

## PR Body Template

```
## Summary
- <bullet points of what changed>

## Test plan
- [ ] <manual verification step>
- [ ] <edge case to check>

🤖 Generated with [Claude Code](https://claude.com/claude-code)
```

If any quality gate fails, fix the issues before creating the PR.
