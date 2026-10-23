# Phase 3 Engineering and Repository Review

Reviewed on 2026-10-23 on `repo-cleanup`, starting from commit `d8b2647`. Local implementation and regression checks are complete. Two release tasks remain: resolving a potentially private historical dataset and observing/enforcing the GitHub CI checks. This is a bounded review, not a certification that the repository or deployment is free of vulnerabilities.

## Changes and verification

- Added the root [security policy](../SECURITY.md) with private-reporting instructions, simulated-data boundaries, sensitive-data precautions, and exposure handling.
- Confirmed removal of the unused root npm manifest/lockfile; application lockfiles remain in `frontend/` and `backend/`.
- Fixed two extensionless imports used by frontend Node regressions and made the threshold API module tolerate the absence of Vite's `import.meta.env` in Node. Removed an unnecessary regex escape reported by ESLint; accepted characters are unchanged.
- On 2026-10-24, removed the Flutter CI job at the maintainer's request. The earlier local Flutter results below remain a record of the approved Phase 3 run; mobile checks are now performed locally.
- Corrected the email-timeout test fixture to keep its mocked transport alive until abort/completion, matching an actual in-flight request. This prevents Node 22 from cancelling the test before its unreferenced abort timer fires.
- On 2026-10-24, the corrected timeout test passed in isolation and all 188 backend / 19 frontend regressions passed again. No Flutter checks were rerun for the CI removal.
- [Test commands](testing.md) cover all existing Node, Python, and Flutter suites.

| Local check | Result |
| --- | --- |
| Frontend Node regressions | 19 passed |
| Backend Node regressions | 188 passed |
| Python synthetic forecasting regressions | 4 passed |
| Flutter tests | 99 passed |
| Frontend ESLint / production build | Passed |
| Backend JavaScript syntax | 141 files passed |
| Flutter analysis | No issues |

Local tools were Node `24.12.0`, Python `3.13.3` with pandas `2.2.3` / NumPy `2.2.5`, and Flutter `3.44.6` / Dart `3.12.2`. CI selects Node 22 and Python 3.12 with the forecasting requirements file; Flutter no longer runs in CI. Local passes do not establish that a clean Linux runner with CI's exact dependency versions passes. Existing dependencies were used; no package installation, migration, production forecast, provider message, or live data mutation was performed.

The backend HTTP fixture suite needed local loopback access, and Flutter needed its installed SDK cache. These tests passed after the execution sandbox restrictions were addressed; application checks were not disabled.

## Repository and history audit

The review covered 528 tracked files at the starting commit and all 162 commits reachable from the clone's available refs. The non-shallow clone contained 2,018 distinct file blobs: 1,929 decoded text blobs and 89 binary blobs. Filename checks also used the full reachable change history to catch files that shared content under different names.

Text checks looked for private-key blocks, recognizable provider/token formats, literal JWTs, credential-bearing connection strings, and sensitive environment/assignment values. Seven connection-string matches were deliberate test fixtures. The remaining reviewed literal matches were 50 test-fixture values and 44 password-label expressions. No confirmed live credentials were identified by these checks. Only `backend/.env.example` appeared among environment-file paths in the available history.

No private `.env`, raw workbook/CSV upload, database dump, signing key, dependency directory, Python cache, or application build output is tracked in the current tree. The larger tracked files are intentional geography resources and a documentation screenshot. Historical commits still contain removed Python caches, sample uploads, and workbook templates; deleting a current file does not erase those older snapshots.

Historical spreadsheet structures were examined without reproducing their records in this report. One removed case-level workbook contains identifiers and health/geographic fields, and the owner could not confirm that it was synthetic or approved for public release. **That finding remains open.** Treat it as potentially private until its historical copies are removed through an approved cleanup or its publication authorization is established. Detailed file/commit/ref locations are withheld from this public-facing document.

Four relevant report/user-management screenshots were spot-checked for obvious displayed secrets and report identifiers. Some show sample report labels and account aliases. This does not verify the provenance of every displayed record or replace the complete gallery review in Phase 4.

The audit used local pattern/structure checks, not an installed dedicated secret-scanning product. It did not perform OCR across every historical image, inspect unreachable objects, fetch unknown remote refs, validate candidate credentials against providers, or assess backups, forks, cached GitHub views, or shared CI artifacts. These limits are material; no blanket history-clean claim is made.

## GitHub checks and protection

Read-only GitHub inspection confirmed an active `Protect prod` ruleset targeting `production`, with PRs and conversation resolution required, force pushes and deletion blocked, zero required approvals, and no bypass actors. The ruleset does not yet require status checks. No Actions run for `repo-cleanup` was returned at review time.

The first [PR CI run](https://github.com/irleo/foodsafe-manila/actions/runs/39986974186), reviewed on 2026-10-24, used `d8b2647`. Frontend failed ESLint on the regex escape already corrected locally; backend passed 187 tests but cancelled the email-timeout test because the mocked transport did not keep the event loop active. Forecast and mobile jobs passed. The working tree's fixes were not included in that run. Mobile has since been removed from CI by request; the three remaining jobs require another remote run after the corrected changes are published.

After the approved history/data decision and branch publication, update the PR into `production`, inspect the three remaining jobs, and add their observed check names to the ruleset. Follow the [deployment guide](ci-cd-deployment-guide.md). Live Render settings and deployment behavior were not independently verified.

## Historical-data remediation boundary

A separate private review plan identifies the affected branches/tag and the narrow dataset-removal scope. It requires coordinating collaborators, preserving uncommitted work, validating an isolated rewritten clone, approving protected-ref updates, and addressing shared/cached copies where applicable. No history rewrite, forced update, ref deletion, repository setting change, or remote publication was performed during this review. See [GitHub's sensitive-data guidance](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/removing-sensitive-data-from-a-repository).
