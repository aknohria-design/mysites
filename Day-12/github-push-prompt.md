# Reusable Prompt: Push Files to GitHub

Use this prompt in Copilot Chat whenever you want the current workspace changes pushed to GitHub.

```text
Stage all tracked and untracked changes in this workspace, show me a short summary of what will be committed, create a git commit with this message: "<YOUR_COMMIT_MESSAGE>", and push it to the current branch's remote on GitHub.

Requirements:
- Run the necessary git commands for me.
- If the repository is not initialized, initialize git first.
- If no remote is configured, stop and tell me exactly what `git remote add origin ...` command I need to run.
- If there are no changes to commit, tell me and stop.
- If Git needs my identity, stop and tell me the exact `git config` commands to run.
- Do not use destructive commands.
- Before pushing, tell me which branch and remote you are using.
- After pushing, show me the commit hash and a short status summary.
```

## Faster Version

```text
Push my current workspace changes to GitHub safely.

Use this commit message: "<YOUR_COMMIT_MESSAGE>"

Steps:
1. Check git status.
2. Stage all changes.
3. Commit.
4. Push to the current branch.
5. Summarize the result.

Stop and tell me what is missing if git identity, remote, branch tracking, or authentication is not set up.
```

## Example

```text
Push my current workspace changes to GitHub safely.

Use this commit message: "Add reusable GitHub push prompt"

Steps:
1. Check git status.
2. Stage all changes.
3. Commit.
4. Push to the current branch.
5. Summarize the result.

Stop and tell me what is missing if git identity, remote, branch tracking, or authentication is not set up.
```