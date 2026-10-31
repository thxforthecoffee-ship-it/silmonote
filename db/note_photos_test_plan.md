# Private note photo migration test plan

Use synthetic records and transaction-local verified role contexts. Never edit existing note text, student identity, feedback, roles or permissions as probes. All DB probes must roll back. Storage byte upload is a separate real side effect; use only approved synthetic fixture and clean-up permission, not a student's photo. Do not report DB predicate tests as end-to-end Storage API verification.

1. Verify table and bucket do not preexist and current parent/helper definitions match assumptions before applying reviewed SQL.
2. Verify private bucket, JPEG-only, 2 MiB limit, metadata RLS enabled, authenticated column grants, no anon privileges, no DELETE or storage UPDATE/DELETE policies added.
3. Own approved student can reserve an English and Korean attachment to an active owned note; own admin can reserve only on their own note. Parent IDs accept exact English bigint strings and Korean UUIDs.
4. Wrong parent owner, other student's ID/path, unapproved/no-login context, wrong kind/FK pair, missing parent and trashed parent all fail.
5. Owner/admin can SELECT metadata and Storage row for active parent and visible attachment; other student/no-login gets zero. Hiding denies Storage SELECT. Parent trash denies both metadata and Storage SELECT; parent restoration permits prior visible photos again.
6. INSERT duplicate active slot or slot outside 1..3 fails. Simultaneous insert into same slot permits at most one. Hiding frees that slot; restoring old photo into occupied slot fails safely with 23505.
7. Owner/admin can update only hidden_at. Changes to ID, user_id, kind, parent ID, slot, size, path, timestamps fail via column grants/trigger. Ownership cannot be reassigned. Hidden rows remain selectable for restoration when parent active.
8. Storage INSERT requires exact reserved path and authenticated owner_id. Unknown path, forged owner, hidden attachment and foreign bucket fail. Existing object replacement and deletion fail. Do not infer correct byte MIME from a user-controlled metadata declaration; server bucket validates declared content type and client re-encodes raster bytes.
9. UI reserves metadata only after note save. On upload failure, retain text record and reservation; retry uses same immutable path with upsert=false, reconciles existing object before another attempt, and permits hiding failed reservation. Do not create duplicated note on retry.
10. Rerun security advisors and compare to baseline. Any new error must be resolved before publication. Ensure no new security-definer function or public/anon file access.

No runtime migration or probes executed by the drafting worker.
