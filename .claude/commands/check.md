Run lint and tests on all projects affected by current changes.

Execute these commands in order and report the results:

```bash
nx affected --target=lint --base=main
```

Then:

```bash
nx affected --target=test --base=main
```

If $ARGUMENTS is provided, run on that specific project instead:
```bash
nx lint $ARGUMENTS
nx test $ARGUMENTS
```

After running, summarize:
1. Which projects were checked
2. Any lint errors (file, line, rule)
3. Any failing tests (test name, error message)
4. Suggested fixes for each issue found
