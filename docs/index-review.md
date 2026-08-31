# MongoDB index review

Run the read-only review against a representative database with:

```powershell
cd backend
npm run indexes:explain
```

The script uses the same filters and sort order as the prioritized application
queries and reports the winning index, documents examined, keys examined, and
execution time. It does not create or remove indexes.

## 2026-08-03 review

The configured database was reachable, but the prioritized collections did not
contain representative rows. Existing index metadata confirmed:

- `officialCases` already has `barangayNo + year + month` and
  `district + year + month` compound indexes.
- `reports` already has `exposureBarangayNo + reportedAt + isCounted`; the
  counted/date query selected the `reportedAt` index in the empty database.
- `predictionRuns` already has
  `model + granularity + datasetScope + generatedAt` and
  `basisDatasetId + basisYear + generatedAt` indexes. The newest-run queries
  now sort by `generatedAt` alone so the existing compound index covers the
  sort without adding another index.
- `notifications` already has indexes for `createdAt` and `unread`; newest-first
  queries selected the `createdAt` index.

No index was added because zero-row execution statistics cannot establish
selectivity or read-cost improvement. Re-run after loading production-like data.
Only add a candidate when `totalDocsExamined` is materially larger than
`nReturned` and the candidate removes an in-memory sort or reduces examined
documents enough to justify its write/storage cost.
