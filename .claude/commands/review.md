Review the current staged/unstaged changes in this Angular/Nx monorepo. $ARGUMENTS

Read the diff with `git diff HEAD` and evaluate against these project-specific criteria:

## Architecture
- [ ] Feature libs follow domain → infrastructure → presenter layering (no cross-layer imports)
- [ ] Components only import from `@catalogohoy/*`, `@shared/*`, or `@ui` path aliases — no relative `../../` imports across library boundaries
- [ ] New services have an abstract class in `domain/` and concrete implementation in `infrastructure/`

## State management
- [ ] Stores use `signalStore` + `withState` + `withMethods` + `patchState`
- [ ] No direct state mutation (must go through `patchState`)
- [ ] Computed values use `withComputed`, not logic inside templates

## Error handling
- [ ] Service methods return `Promise<Either<Error, T>>` — no raw throws
- [ ] `E.left(new Error(...))` used for Supabase errors, not thrown exceptions
- [ ] Components handle both `.mapRight` and `.mapLeft` branches

## Angular specifics
- [ ] All components are standalone (`standalone: true`)
- [ ] `inject()` used instead of constructor injection
- [ ] No `ngOnInit` when signal-based lifecycle is sufficient
- [ ] Lazy routes use `loadComponent()` or `loadChildren()`
- [ ] i18n strings use `transloco` pipe or service, not hardcoded Spanish

## Multi-tenancy
- [ ] Tenant slug is read from `localStorage` / query params, not hardcoded
- [ ] Supabase queries filter by `slug` where applicable

## Code quality
- [ ] No `any` types
- [ ] No commented-out code left in
- [ ] Exported public API updated in `index.ts` for new symbols

Provide a concise list of issues found, grouped by category, with file and line references.
