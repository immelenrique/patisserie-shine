-- Imitation minimale du stockage de fichiers de Supabase (schéma storage), pour les bancs d'essai.
-- Seules les colonnes lues par la base (partie 4) sont reproduites ; en production, ces tables
-- appartiennent au service de stockage de Supabase.
CREATE SCHEMA storage;
CREATE TABLE storage.buckets (id text PRIMARY KEY, name text, public boolean DEFAULT false,
  file_size_limit bigint, allowed_mime_types text[]);
CREATE TABLE storage.objects (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), bucket_id text REFERENCES storage.buckets(id),
  name text NOT NULL, owner uuid, owner_id text, metadata jsonb, created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(), UNIQUE (bucket_id, name));
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('depenses-pieces-jointes', 'depenses-pieces-jointes', false, 10485760, ARRAY['image/*', 'application/pdf']);
