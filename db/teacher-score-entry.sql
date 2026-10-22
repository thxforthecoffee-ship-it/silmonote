-- Applied in two reviewed transactions. Existing student data is not backfilled.
-- One-time schema change; inspect existing objects before any reapplication.
BEGIN;
ALTER TABLE public.score_reports ADD COLUMN exam_date date;
ALTER TABLE public.score_reports ADD COLUMN record_kind text NOT NULL DEFAULT 'analysis';
ALTER TABLE public.score_reports ADD CONSTRAINT score_reports_record_kind_check CHECK (record_kind IN ('analysis','score_only'));
ALTER TABLE public.score_reports ADD COLUMN exam_date_precision text NOT NULL DEFAULT 'exact' CHECK (exam_date_precision IN ('exact','month'));
GRANT INSERT(exam_date,record_kind,exam_date_precision) ON public.score_reports TO authenticated;
-- Students retain their previous own-analysis behavior, not access to new protected metadata.
ALTER POLICY silmo_score_insert ON public.score_reports WITH CHECK (
 user_id=(SELECT auth.uid()) AND deleted_at IS NULL AND deleted_by IS NULL AND teacher_comment IS NULL
 AND ((SELECT silmo_private.is_approved_student()) OR (SELECT silmo_private.is_admin()))
 AND ((SELECT silmo_private.is_admin()) OR (record_kind='analysis' AND exam_date IS NULL AND exam_date_precision='exact'))
);
CREATE POLICY silmo_admin_score_only_insert ON public.score_reports FOR INSERT TO authenticated WITH CHECK (
 (SELECT silmo_private.is_admin()) AND record_kind='score_only'
 AND deleted_at IS NULL AND deleted_by IS NULL AND teacher_comment IS NULL
 AND EXISTS(SELECT 1 FROM public.profiles p WHERE p.id=score_reports.user_id AND p.is_approved IS TRUE)
);
COMMIT;
