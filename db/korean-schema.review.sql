-- REVIEW DRAFT. Apply only after explicit approval. No existing tables or roles are changed.
-- Requires the existing silmo_private.is_admin() / is_approved_student() helpers.
-- New Korean data only; never copies or relabels English records.
BEGIN;

CREATE TABLE public.korean_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  exam_title text NOT NULL CHECK (char_length(btrim(exam_title)) BETWEEN 1 AND 200),
  test_date date,
  content jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(content) = 'object' AND pg_column_size(content) <= 65536),
  teacher_status text NOT NULL DEFAULT 'unreviewed' CHECK (teacher_status IN ('unreviewed','confirmed','followup')),
  teacher_area text NOT NULL DEFAULT '' CHECK (char_length(teacher_area) <= 100),
  teacher_tags text[] NOT NULL DEFAULT ARRAY[]::text[] CHECK (cardinality(teacher_tags) <= 20),
  teacher_comment text NOT NULL DEFAULT '' CHECK (char_length(teacher_comment) <= 10000),
  recheck_task text NOT NULL DEFAULT '' CHECK (char_length(recheck_task) <= 10000),
  recheck_result text NOT NULL DEFAULT '' CHECK (char_length(recheck_result) <= 10000),
  recheck_done boolean NOT NULL DEFAULT false,
  reviewed_at timestamptz,
  delete_requested boolean NOT NULL DEFAULT false,
  deleted_at timestamptz,
  deleted_by uuid,
  CONSTRAINT korean_notes_trash_pair CHECK ((deleted_at IS NULL) = (deleted_by IS NULL))
);
ALTER TABLE public.korean_notes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.korean_notes FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.korean_notes TO authenticated;
CREATE INDEX korean_notes_owner_created ON public.korean_notes(user_id, created_at DESC, id DESC);
CREATE POLICY korean_select ON public.korean_notes FOR SELECT TO authenticated
  USING ((SELECT silmo_private.is_admin()) OR (deleted_at IS NULL AND user_id = (SELECT auth.uid()) AND (SELECT silmo_private.is_approved_student())));
CREATE POLICY korean_insert ON public.korean_notes FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()) AND ((SELECT silmo_private.is_admin()) OR (SELECT silmo_private.is_approved_student()))
    AND deleted_at IS NULL AND deleted_by IS NULL AND teacher_status = 'unreviewed'
    AND teacher_area = '' AND cardinality(teacher_tags) = 0 AND teacher_comment = ''
    AND recheck_task = '' AND recheck_result = '' AND NOT recheck_done AND reviewed_at IS NULL);
CREATE POLICY korean_update ON public.korean_notes FOR UPDATE TO authenticated
  USING ((SELECT silmo_private.is_admin()) OR (deleted_at IS NULL AND user_id = (SELECT auth.uid()) AND (SELECT silmo_private.is_approved_student())))
  WITH CHECK ((SELECT silmo_private.is_admin()) OR (deleted_at IS NULL AND user_id = (SELECT auth.uid()) AND (SELECT silmo_private.is_approved_student())));

CREATE TABLE public.korean_score_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  exam_title text NOT NULL CHECK (char_length(btrim(exam_title)) BETWEEN 1 AND 200),
  test_date date,
  content jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(content) = 'object' AND pg_column_size(content) <= 65536),
  teacher_status text NOT NULL DEFAULT 'unreviewed' CHECK (teacher_status IN ('unreviewed','confirmed','followup')),
  teacher_area text NOT NULL DEFAULT '' CHECK (char_length(teacher_area) <= 100),
  teacher_tags text[] NOT NULL DEFAULT ARRAY[]::text[] CHECK (cardinality(teacher_tags) <= 20),
  teacher_comment text NOT NULL DEFAULT '' CHECK (char_length(teacher_comment) <= 10000),
  recheck_task text NOT NULL DEFAULT '' CHECK (char_length(recheck_task) <= 10000),
  recheck_result text NOT NULL DEFAULT '' CHECK (char_length(recheck_result) <= 10000),
  recheck_done boolean NOT NULL DEFAULT false,
  reviewed_at timestamptz,
  delete_requested boolean NOT NULL DEFAULT false,
  deleted_at timestamptz,
  deleted_by uuid,
  CONSTRAINT korean_score_reports_trash_pair CHECK ((deleted_at IS NULL) = (deleted_by IS NULL))
);
ALTER TABLE public.korean_score_reports ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.korean_score_reports FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.korean_score_reports TO authenticated;
CREATE INDEX korean_score_reports_owner_created ON public.korean_score_reports(user_id, created_at DESC, id DESC);
CREATE POLICY korean_select ON public.korean_score_reports FOR SELECT TO authenticated
  USING ((SELECT silmo_private.is_admin()) OR (deleted_at IS NULL AND user_id = (SELECT auth.uid()) AND (SELECT silmo_private.is_approved_student())));
CREATE POLICY korean_insert ON public.korean_score_reports FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()) AND ((SELECT silmo_private.is_admin()) OR (SELECT silmo_private.is_approved_student()))
    AND deleted_at IS NULL AND deleted_by IS NULL AND teacher_status = 'unreviewed'
    AND teacher_area = '' AND cardinality(teacher_tags) = 0 AND teacher_comment = ''
    AND recheck_task = '' AND recheck_result = '' AND NOT recheck_done AND reviewed_at IS NULL);
CREATE POLICY korean_update ON public.korean_score_reports FOR UPDATE TO authenticated
  USING ((SELECT silmo_private.is_admin()) OR (deleted_at IS NULL AND user_id = (SELECT auth.uid()) AND (SELECT silmo_private.is_approved_student())))
  WITH CHECK ((SELECT silmo_private.is_admin()) OR (deleted_at IS NULL AND user_id = (SELECT auth.uid()) AND (SELECT silmo_private.is_approved_student())));

-- Invoker-only trigger. No new credentials, administrators or security-definer APIs.
CREATE FUNCTION silmo_private.guard_korean_submission() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE is_admin boolean := silmo_private.is_admin();
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.created_at := statement_timestamp();
    NEW.updated_at := statement_timestamp();
    RETURN NEW;
  END IF;
  IF NEW.id IS DISTINCT FROM OLD.id OR NEW.user_id IS DISTINCT FROM OLD.user_id
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'Submission identity and ownership are immutable' USING ERRCODE = '42501';
  END IF;
  IF OLD.deleted_at IS NOT NULL AND
     (to_jsonb(NEW) - ARRAY['deleted_at','deleted_by','updated_at']) IS DISTINCT FROM
     (to_jsonb(OLD) - ARRAY['deleted_at','deleted_by','updated_at']) THEN
    RAISE EXCEPTION 'Restore before editing' USING ERRCODE = '42501';
  END IF;
  IF ROW(NEW.teacher_status,NEW.teacher_area,NEW.teacher_tags,NEW.teacher_comment,NEW.recheck_task,NEW.recheck_result,NEW.recheck_done,NEW.reviewed_at)
     IS DISTINCT FROM ROW(OLD.teacher_status,OLD.teacher_area,OLD.teacher_tags,OLD.teacher_comment,OLD.recheck_task,OLD.recheck_result,OLD.recheck_done,OLD.reviewed_at) THEN
    IF NOT is_admin THEN
      RAISE EXCEPTION 'Only the administrator may change teacher review' USING ERRCODE = '42501';
    END IF;
    NEW.reviewed_at := statement_timestamp();
  END IF;
  IF NEW.deleted_at IS DISTINCT FROM OLD.deleted_at OR NEW.deleted_by IS DISTINCT FROM OLD.deleted_by THEN
    IF NOT is_admin THEN
      RAISE EXCEPTION 'Only the administrator may move or restore submissions' USING ERRCODE = '42501';
    END IF;
    IF NEW.deleted_at IS NOT NULL AND NEW.deleted_by IS DISTINCT FROM auth.uid() THEN
      RAISE EXCEPTION 'Invalid trash actor' USING ERRCODE = '42501';
    END IF;
  END IF;
  -- Student revisions retain the teacher text but require a fresh review.
  IF NEW.content IS DISTINCT FROM OLD.content OR NEW.exam_title IS DISTINCT FROM OLD.exam_title OR NEW.test_date IS DISTINCT FROM OLD.test_date THEN
    NEW.teacher_status := 'unreviewed';
    NEW.reviewed_at := NULL;
    NEW.recheck_done := false;
  END IF;
  NEW.updated_at := statement_timestamp();
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION silmo_private.guard_korean_submission() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER guard_korean_notes BEFORE INSERT OR UPDATE ON public.korean_notes FOR EACH ROW EXECUTE FUNCTION silmo_private.guard_korean_submission();
CREATE TRIGGER guard_korean_score_reports BEFORE INSERT OR UPDATE ON public.korean_score_reports FOR EACH ROW EXECUTE FUNCTION silmo_private.guard_korean_submission();
COMMIT;
