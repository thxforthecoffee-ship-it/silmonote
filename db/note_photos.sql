-- Reviewed one-time migration draft. Do not re-run blindly.
-- Adds private photo attachments only. Existing note contents, roles and policies are unchanged.
-- Browser input is decoded and re-encoded as JPEG before upload (no original EXIF).
BEGIN;

CREATE TABLE public.note_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  kind text NOT NULL CHECK (kind IN ('english', 'korean')),
  english_note_id bigint REFERENCES public.notes(id),
  korean_note_id uuid REFERENCES public.korean_notes(id),
  slot smallint NOT NULL CHECK (slot BETWEEN 1 AND 3),
  size_bytes integer NOT NULL CHECK (size_bytes BETWEEN 1 AND 2097152),
  created_at timestamptz NOT NULL DEFAULT statement_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT statement_timestamp(),
  hidden_at timestamptz,
  storage_path text GENERATED ALWAYS AS (
    user_id::text || '/' || kind || '/' || id::text || '.jpg'
  ) STORED,
  CONSTRAINT note_photos_parent_check CHECK (
    (kind = 'english' AND english_note_id IS NOT NULL AND korean_note_id IS NULL) OR
    (kind = 'korean' AND korean_note_id IS NOT NULL AND english_note_id IS NULL)
  ),
  CONSTRAINT note_photos_path_unique UNIQUE (storage_path)
);
-- Three active slots per parent enforce the limit even during concurrent requests.
-- Hiding frees a slot. Restoring into an occupied slot fails safely with 23505.
CREATE UNIQUE INDEX note_photos_english_active_slot
  ON public.note_photos(english_note_id, slot) WHERE hidden_at IS NULL AND kind = 'english';
CREATE UNIQUE INDEX note_photos_korean_active_slot
  ON public.note_photos(korean_note_id, slot) WHERE hidden_at IS NULL AND kind = 'korean';
CREATE INDEX note_photos_owner ON public.note_photos(user_id);
CREATE INDEX note_photos_english_parent ON public.note_photos(english_note_id) WHERE english_note_id IS NOT NULL;
CREATE INDEX note_photos_korean_parent ON public.note_photos(korean_note_id) WHERE korean_note_id IS NOT NULL;
ALTER TABLE public.note_photos ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.note_photos FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.note_photos TO authenticated;
GRANT INSERT (id, user_id, kind, english_note_id, korean_note_id, slot, size_bytes)
  ON public.note_photos TO authenticated;
GRANT UPDATE (hidden_at) ON public.note_photos TO authenticated;

-- Invoker helper: existing parent-table RLS is always applied. No privileged RPC.
CREATE FUNCTION silmo_private.photo_parent_active(p_kind text, p_english_id bigint, p_korean_id uuid, p_owner uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
  SELECT CASE
    WHEN p_kind = 'english' AND p_english_id IS NOT NULL AND p_korean_id IS NULL THEN
      EXISTS (SELECT 1 FROM public.notes n WHERE n.id = p_english_id AND n.user_id = p_owner AND n.deleted_at IS NULL)
    WHEN p_kind = 'korean' AND p_korean_id IS NOT NULL AND p_english_id IS NULL THEN
      EXISTS (SELECT 1 FROM public.korean_notes n WHERE n.id = p_korean_id AND n.user_id = p_owner AND n.deleted_at IS NULL)
    ELSE false
  END;
$$;
REVOKE ALL ON FUNCTION silmo_private.photo_parent_active(text, bigint, uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION silmo_private.photo_parent_active(text, bigint, uuid, uuid) TO authenticated;

CREATE POLICY note_photos_select ON public.note_photos FOR SELECT TO authenticated
USING (
  ((SELECT silmo_private.is_admin()) OR
   (user_id = (SELECT auth.uid()) AND (SELECT silmo_private.is_approved_student())))
  AND silmo_private.photo_parent_active(kind, english_note_id, korean_note_id, user_id)
);
CREATE POLICY note_photos_insert ON public.note_photos FOR INSERT TO authenticated
WITH CHECK (
  user_id = (SELECT auth.uid())
  AND ((SELECT silmo_private.is_admin()) OR (SELECT silmo_private.is_approved_student()))
  AND hidden_at IS NULL
  AND silmo_private.photo_parent_active(kind, english_note_id, korean_note_id, user_id)
);
CREATE POLICY note_photos_update ON public.note_photos FOR UPDATE TO authenticated
USING (
  ((SELECT silmo_private.is_admin()) OR
   (user_id = (SELECT auth.uid()) AND (SELECT silmo_private.is_approved_student())))
  AND silmo_private.photo_parent_active(kind, english_note_id, korean_note_id, user_id)
)
WITH CHECK (
  ((SELECT silmo_private.is_admin()) OR
   (user_id = (SELECT auth.uid()) AND (SELECT silmo_private.is_approved_student())))
  AND silmo_private.photo_parent_active(kind, english_note_id, korean_note_id, user_id)
);

CREATE FUNCTION silmo_private.guard_note_photo() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.created_at := statement_timestamp();
    NEW.updated_at := statement_timestamp();
    RETURN NEW;
  END IF;
  IF ROW(NEW.id, NEW.user_id, NEW.kind, NEW.english_note_id, NEW.korean_note_id,
         NEW.slot, NEW.size_bytes, NEW.created_at)
     IS DISTINCT FROM
     ROW(OLD.id, OLD.user_id, OLD.kind, OLD.english_note_id, OLD.korean_note_id,
         OLD.slot, OLD.size_bytes, OLD.created_at) THEN
    RAISE EXCEPTION 'Photo identity, parent, slot and file metadata are immutable' USING ERRCODE = '42501';
  END IF;
  IF NEW.hidden_at IS DISTINCT FROM OLD.hidden_at AND NEW.hidden_at IS NOT NULL THEN
    NEW.hidden_at := statement_timestamp();
  END IF;
  NEW.updated_at := statement_timestamp();
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION silmo_private.guard_note_photo() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER guard_note_photo BEFORE INSERT OR UPDATE ON public.note_photos
FOR EACH ROW EXECUTE FUNCTION silmo_private.guard_note_photo();

-- Bucket is private. Fail rather than silently changing an existing bucket.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('note-photos', 'note-photos', false, 2097152, ARRAY['image/jpeg']::text[]);

-- Metadata SELECT RLS independently checks current approval, parent ownership and active state.
-- An exact reservation is required; another user's folder or a forged parent cannot be uploaded.
CREATE POLICY note_photos_storage_insert ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'note-photos'
  AND owner_id = (SELECT auth.uid())::text
  AND EXISTS (
    SELECT 1 FROM public.note_photos p
    WHERE p.storage_path = name AND p.user_id = (SELECT auth.uid()) AND p.hidden_at IS NULL
  )
);
CREATE POLICY note_photos_storage_select ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'note-photos'
  AND EXISTS (
    SELECT 1 FROM public.note_photos p
    WHERE p.storage_path = name AND p.hidden_at IS NULL
  )
);
-- Deliberately no storage UPDATE/DELETE, metadata DELETE, public URL or anon grants.
-- Hide/restore metadata only. Physical retention/cleanup requires separate approval.
COMMIT;
