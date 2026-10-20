# Korean learning records

`korean.html` is a separate Korean-subject workspace. English records remain in `notes` / `score_reports`; Korean records live only in `korean_notes` / `korean_score_reports`. Existing English logic and `app-access.js` are unchanged. The existing student approval and administrator model is reused, without adding accounts or roles.

## Scope

- Students submit and revise their own exam analyses and question reflections.
- Reflections distinguish the student's remembered/pre-explanation reasoning from what they learned after reading the explanation. The explanation status must be selected explicitly.
- Record areas and learning-point tags are provisional study categories, not an expert-validated diagnostic scale. Student guesses and teacher-confirmed points are stored separately.
- Existing administrators select a student, review their records, enter independent feedback and recheck tasks/results, and move records to/restored from the Korean trash.
- A cumulative report displays stored score history, confirmed teacher-point counts, student plans and teacher feedback/recheck history. It can be printed using the browser's print/PDF function.
- Raw score, maximum score and entered grade are kept separate. No Korean grade is inferred from a score. Score percentages are not percentiles. Recorded questions are not used to infer whole-exam accuracy or ability.

## Data and access controls

`db/korean-schema.review.sql` contains the exact additive schema and protection rules. Apply it once through a reviewed migration before publishing the page. It deliberately does not modify any English table, English policy, existing user, existing administrator, or shared authentication helper.

Both new tables have RLS. Approved students can read and update only their active records and insert only for their own account. Existing administrators can review all Korean records. Teacher fields and trash fields are guarded by the database trigger, not merely hidden in the UI. Hard deletion is not granted. Record ID, ownership and submission time are immutable. A student's content revision resets the teacher confirmation status and recheck completion while retaining the historical teacher text.

The UI uses server-backed inserts and updates, not localStorage. Updates are conditional on the last observed `updated_at` value to detect concurrent changes. New records carry a stable client UUID so a repeated request cannot silently create a duplicate. A failed save leaves the form in place. The cumulative view is calculated from saved rows and labels partial pagination explicitly; it is not a separately saved report snapshot.

## Files

- `korean.html`, `korean.css`: Korean workspace and responsive/print styles.
- `korean.js`: authenticated data access, record editor, teacher review and report UI.
- `korean-core.js`: pure validation and aggregation rules.
- `tests/korean-core.test.cjs`: validation and aggregation regressions; run with `node tests/korean-core.test.cjs`.
- `tests/korean-browser.test.cjs`: synthetic-data Playwright regression, with network requests for the Supabase SDK intercepted. Run with `node tests/korean-browser.test.cjs`; set `CHROMIUM_PATH` for another locally installed Chromium executable.

The browser regression requires an environment that permits Chromium to create local sockets. A blocked browser launch is not a successful visual or authenticated-production test. Test fixtures are fictional; tests must not write real student records.

## Deployment and verification

1. Review the schema, apply it once, and verify RLS, policies, triggers and grants.
2. Run the validation and UI tests. Check that existing English/auth scripts remain unchanged.
3. Publish the new files plus the small subject-navigation additions to `main.html`, `admin.html` and `history.html`.
4. Verify the exact GitHub commit and its Pages build, then check the public page and asset responses.
5. A public URL check verifies publication only. It does not establish a real signed-in student save or a teacher review unless that flow is separately exercised with authorized test accounts.
