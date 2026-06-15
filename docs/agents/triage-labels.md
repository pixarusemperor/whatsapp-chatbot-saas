# Triage Labels

GitHub labels on `pixarusemperor/whatsapp-chatbot-saas`:

| Canonical Role | GitHub Label | Description |
|---|---|---|
| `needs-triage` | `needs-triage` | Maintainer needs to evaluate and classify |
| `needs-info` | `needs-info` | Waiting on reporter for clarification |
| `ready-for-agent` | `ready-for-agent` | Fully specified, ready for AFK agent |
| `ready-for-human` | `ready-for-human` | Needs human implementation |
| `wontfix` | `wontfix` | Will not be actioned |
| `bug` | `bug` | Something is broken |
| `enhancement` | `enhancement` | New feature or improvement |

## State Machine

```
unlabeled
  → needs-triage (maintainer evaluates)
      → needs-info (ask reporter for details)
          → needs-triage (back after info received)
      → ready-for-agent (spec complete, AFK-ready)
      → ready-for-human (needs human touch)
      → wontfix (rejected)
```

Every issue must carry **exactly one** category label (`bug` or `enhancement`) and **exactly one** state label from the table above.

## Rejected Enhancements

When labeling an enhancement as `wontfix`, document the reasoning in `docs/adr/OUT-OF-SCOPE.md` if the decision has architectural significance.
