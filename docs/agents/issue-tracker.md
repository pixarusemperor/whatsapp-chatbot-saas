# Issue Tracker

This project uses **GitHub Issues** on the repository `pixarusemperor/whatsapp-chatbot-saas`.

## Reading Issues

```bash
# View a specific issue
gh issue view <number> --repo pixarusemperor/whatsapp-chatbot-saas

# List open issues
gh issue list --repo pixarusemperor/whatsapp-chatbot-saas

# Search issues by label
gh issue list --repo pixarusemperor/whatsapp-chatbot-saas --label "ready-for-agent,bug"

# View issue with comments
gh issue view <number> --repo pixarusemperor/whatsapp-chatbot-saas --comments
```

## Creating Issues

```bash
# Create from markdown body
gh issue create \
  --repo pixarusemperor/whatsapp-chatbot-saas \
  --title "Descriptive title" \
  --label "needs-triage,enhancement" \
  --body "..."
```

## Labeling and Closing

```bash
# Add a label
gh issue edit <number> --repo pixarusemperor/whatsapp-chatbot-saas --add-label "ready-for-agent"

# Close an issue
gh issue close <number> --repo pixarusemperor/whatsapp-chatbot-saas
```

## Important: Multiple Repos

This project has a sibling `wassflow-personal` (soon to be archived). When creating issues for work that spans both repos, create them in `whatsapp-chatbot-saas` and reference the sibling in the body.
