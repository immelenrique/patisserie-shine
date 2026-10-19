-- ANNULATION de partie1_contrainte_annulee.sql : échoue si une ligne de demande est au statut « annulee ».
BEGIN;
SET LOCAL lock_timeout = '5s';
ALTER TABLE public.demandes ADD CONSTRAINT valid_statut_demande
  CHECK (((statut)::text = ANY (ARRAY[('en_attente'::character varying)::text, ('validee'::character varying)::text, ('refusee'::character varying)::text, ('partiellement_validee'::character varying)::text])));
COMMIT;
