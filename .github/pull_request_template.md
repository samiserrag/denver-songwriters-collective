## Summary

<!-- Brief description of what this PR does -->

## Type of Change

- [ ] Bug fix (non-breaking change that fixes an issue)
- [ ] New feature (non-breaking change that adds functionality)
- [ ] Breaking change (fix or feature that would cause existing functionality to change)
- [ ] Migration / Cross-cutting UI change (requires full completion gate)
- [ ] Documentation update

---

## Completion Gate Checklist

**Required for all migrations and cross-cutting UI changes. Skip sections that don't apply to simple fixes.**

### Surface Inventory

- [ ] Header nav verified
- [ ] Footer nav verified
- [ ] Mobile nav verified
- [ ] CTAs/buttons linking to affected routes
- [ ] Filters (if applicable)
- [ ] Search results
- [ ] Email templates
- [ ] PWA manifest (`web/public/manifest.json`)
- [ ] Redirect behavior confirmed

### Contract-First Components

- [ ] Uses explicit variant/props (not CSS container hacks)
- [ ] Component defaults preserve existing behavior
- [ ] Contracts documented in `docs/CONTRACTS.md` (if new)

### Data Contract Verified

- [ ] No placeholder text from schema mismatch ("LIVE"/"TBA" artifacts)
- [ ] Derived labels verified with real database records

### Regression Guardrails

- [ ] Automated test added that would catch regression
- [ ] Test location: `src/__tests__/` or `src/components/__tests__/`

### Quality Gate

- [ ] `npm run lint` passes (0 errors)
- [ ] `npm run test` passes (all green)
- [ ] `npm run build` passes

### Acceptance Routes Checked

- [ ] `/happenings`
- [ ] `/happenings?type=open_mic`
- [ ] `/happenings?type=dsc`
- [ ] Detail page for each type (if applicable)

### Routing Rules

- [ ] No links to `/open-mics` (listing route - forbidden)
- [ ] No links to `/events` (listing route - forbidden)
- [ ] Only `/happenings` routes used for listings

---

## Testing Notes

<!-- How did you test this? Any specific scenarios to verify? -->

## Screenshots (if applicable)

<!-- Add screenshots for UI changes -->
