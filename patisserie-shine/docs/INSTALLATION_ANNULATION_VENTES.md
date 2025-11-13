# Guide d'Installation - Annulation de Ventes

## Prérequis

- Accès administrateur à la base de données Supabase
- Droits d'exécution de scripts SQL
- Application Patisserie Shine déployée

## Étapes d'installation

### 1. Créer la structure de base de données

#### Option A : Via Supabase Dashboard (Recommandé)

1. Connectez-vous à [Supabase Dashboard](https://app.supabase.com)
2. Sélectionnez votre projet
3. Allez dans **SQL Editor**
4. Créez une nouvelle requête
5. Copiez le contenu du fichier `scripts/add_cancel_sales_feature.sql`
6. Exécutez le script

#### Option B : Via ligne de commande

```bash
# Depuis la racine du projet
psql "postgresql://[USER]:[PASSWORD]@[HOST]:[PORT]/[DATABASE]" \
  -f scripts/add_cancel_sales_feature.sql
```

### 2. Vérifier la création de la table

```sql
-- Vérifier que la table existe
SELECT table_name
FROM information_schema.tables
WHERE table_name = 'annulations_ventes';

-- Vérifier la structure
\d annulations_ventes
```

Résultat attendu :
```
                Table "public.annulations_ventes"
     Column      |           Type           | Nullable |      Default
-----------------+--------------------------+----------+-------------------
 id              | uuid                     | not null | gen_random_uuid()
 vente_id        | uuid                     | not null |
 numero_ticket   | character varying(50)    | not null |
 montant_annule  | numeric(10,2)            | not null |
 motif           | text                     | not null |
 annule_par      | uuid                     | not null |
 annule_le       | timestamp with time zone | not null | now()
 created_at      | timestamp with time zone |          | now()
```

### 3. Vérifier les politiques RLS

```sql
-- Vérifier que RLS est activé
SELECT tablename, rowsecurity
FROM pg_tables
WHERE tablename = 'annulations_ventes';

-- Vérifier les politiques
SELECT policyname, roles, cmd
FROM pg_policies
WHERE tablename = 'annulations_ventes';
```

Résultat attendu :
- RLS activé : `rowsecurity = true`
- 2 politiques :
  1. "Seuls les admins peuvent voir les annulations" (SELECT)
  2. "Seuls les admins peuvent créer des annulations" (INSERT)

### 4. Tester les permissions

#### Test 1 : Admin peut créer une annulation

```sql
-- En tant qu'admin
INSERT INTO annulations_ventes (
  vente_id,
  numero_ticket,
  montant_annule,
  motif,
  annule_par
) VALUES (
  'uuid-vente-existante',
  'V-TEST-123',
  5000,
  'Test d''annulation - ne pas prendre en compte',
  auth.uid()
);

-- Devrait réussir ✅
```

#### Test 2 : Admin peut consulter les annulations

```sql
-- En tant qu'admin
SELECT * FROM annulations_ventes LIMIT 5;

-- Devrait retourner des résultats ✅
```

#### Test 3 : Non-admin ne peut pas accéder

```sql
-- En tant qu'utilisateur non-admin (vendeur)
SELECT * FROM annulations_ventes;

-- Devrait retourner 0 lignes ou erreur ❌
```

### 5. Vérifier le code déployé

Assurez-vous que les fichiers suivants sont présents :

```bash
# Vérifier les fichiers
ls -la src/services/cancelSaleService.js
ls -la src/app/api/admin/cancel-sale/route.js
ls -la src/components/caisse/CancelSaleModal.js
```

### 6. Redémarrer l'application

```bash
# En développement
npm run dev

# En production
npm run build
npm start
```

### 7. Test fonctionnel complet

1. **Connexion en tant qu'admin**
   - Email : votre-admin@example.com
   - Mot de passe : votre mot de passe

2. **Naviguer vers l'historique**
   - Caisse → Tableau de bord admin → Historique des ventes

3. **Créer une vente de test**
   - Allez dans Caisse
   - Créez une vente simple (1-2 articles)
   - Notez le numéro de ticket

4. **Annuler la vente de test**
   - Retournez à l'historique
   - Trouvez la vente créée
   - Cliquez sur l'icône rouge ❌
   - Saisissez un motif : "Test d'annulation"
   - Confirmez

5. **Vérifier le résultat**
   - La vente doit avoir le statut "Annulée"
   - Le stock doit être restauré
   - Une ligne doit apparaître dans `annulations_ventes`

```sql
-- Vérifier l'annulation
SELECT * FROM annulations_ventes
WHERE numero_ticket = 'V-VOTRE-TICKET';

-- Vérifier le statut de la vente
SELECT statut FROM ventes
WHERE numero_ticket = 'V-VOTRE-TICKET';
-- Devrait retourner 'annulee'

-- Vérifier le mouvement de stock
SELECT * FROM mouvements_stock
WHERE type_mouvement = 'annulation_vente'
ORDER BY created_at DESC LIMIT 5;
```

## Rollback (en cas de problème)

Si vous devez annuler l'installation :

```sql
-- Supprimer les politiques RLS
DROP POLICY IF EXISTS "Seuls les admins peuvent voir les annulations" ON annulations_ventes;
DROP POLICY IF EXISTS "Seuls les admins peuvent créer des annulations" ON annulations_ventes;

-- Supprimer les index
DROP INDEX IF EXISTS idx_annulations_ventes_vente_id;
DROP INDEX IF EXISTS idx_annulations_ventes_annule_par;
DROP INDEX IF EXISTS idx_annulations_ventes_annule_le;

-- Supprimer la table
DROP TABLE IF EXISTS annulations_ventes;

-- Supprimer l'index sur ventes.statut (optionnel)
DROP INDEX IF EXISTS idx_ventes_statut;
```

## Dépannage

### Erreur : "relation annulations_ventes does not exist"

**Cause :** La table n'a pas été créée correctement

**Solution :**
1. Vérifiez que le script SQL s'est exécuté sans erreur
2. Vérifiez que vous êtes sur la bonne base de données
3. Réexécutez le script `add_cancel_sales_feature.sql`

### Erreur : "permission denied for table annulations_ventes"

**Cause :** RLS bloque l'accès

**Solution :**
1. Vérifiez que l'utilisateur est bien admin :
```sql
SELECT role FROM profiles WHERE id = auth.uid();
```
2. Si le rôle n'est pas 'admin', mettez-le à jour :
```sql
UPDATE profiles SET role = 'admin' WHERE id = 'votre-user-id';
```

### Erreur : "Cannot read property 'auth' of undefined"

**Cause :** Supabase client non initialisé dans CancelSaleModal

**Solution :**
1. Vérifiez que `window.supabase` est disponible
2. Importez le client Supabase :
```javascript
import { supabase } from '../../lib/supabase-client';
// Utilisez supabase au lieu de window.supabase
```

### Les stocks ne sont pas restaurés

**Cause :** Erreur dans la logique de mise à jour

**Solution :**
1. Vérifiez les logs serveur
2. Vérifiez que les produits existent dans `stock_boutique`
3. Vérifiez manuellement :
```sql
SELECT
  sb.produit_id,
  sb.nom_produit,
  sb.quantite_disponible,
  sb.quantite_vendue,
  (sb.quantite_disponible - sb.quantite_vendue) as stock_reel
FROM stock_boutique sb
WHERE sb.produit_id IN (
  SELECT lv.produit_id
  FROM lignes_vente lv
  WHERE lv.vente_id = 'id-vente-annulee'
);
```

## Maintenance

### Archivage des anciennes annulations

Après 1 an, vous pouvez archiver les anciennes annulations :

```sql
-- Créer une table d'archive
CREATE TABLE annulations_ventes_archive AS
SELECT * FROM annulations_ventes
WHERE annule_le < NOW() - INTERVAL '1 year';

-- Supprimer les anciennes annulations
DELETE FROM annulations_ventes
WHERE annule_le < NOW() - INTERVAL '1 year';
```

### Monitoring

Requête pour surveiller les annulations :

```sql
-- Nombre d'annulations par jour (7 derniers jours)
SELECT
  DATE(annule_le) as date,
  COUNT(*) as nb_annulations,
  SUM(montant_annule) as total_annule
FROM annulations_ventes
WHERE annule_le >= NOW() - INTERVAL '7 days'
GROUP BY DATE(annule_le)
ORDER BY date DESC;

-- Admins qui annulent le plus
SELECT
  p.nom as admin,
  COUNT(*) as nb_annulations,
  SUM(a.montant_annule) as total_annule
FROM annulations_ventes a
JOIN profiles p ON p.id = a.annule_par
GROUP BY p.nom
ORDER BY nb_annulations DESC
LIMIT 10;
```

## Support

En cas de problème non résolu :
1. Consultez les logs : `/var/log/patisserie-shine/` ou logs Vercel/Supabase
2. Vérifiez la documentation : `docs/ANNULATION_VENTES.md`
3. Contactez le support technique

## Checklist finale

Avant de considérer l'installation terminée, vérifiez :

- [ ] Script SQL exécuté avec succès
- [ ] Table `annulations_ventes` créée
- [ ] Index créés
- [ ] Politiques RLS actives
- [ ] Permissions admin testées
- [ ] Permissions non-admin testées (doivent échouer)
- [ ] Composants React déployés
- [ ] API route accessible
- [ ] Test fonctionnel complet réussi
- [ ] Stocks correctement restaurés lors d'un test
- [ ] Documentation lue et comprise

✅ Installation terminée avec succès !
