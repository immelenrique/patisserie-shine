# Installation Rapide - Annulation de Ventes

## ⚡ Installation en 5 minutes

### Étape 1 : Base de données (2 min)

**Via Supabase Dashboard** (recommandé) :
1. Ouvrez [app.supabase.com](https://app.supabase.com)
2. Sélectionnez votre projet
3. Allez dans **SQL Editor**
4. Copiez-collez le contenu de `scripts/add_cancel_sales_feature.sql`
5. Cliquez sur **Run** (ou Ctrl+Enter)

✅ Vous devriez voir : "Success. No rows returned"

### Étape 2 : Vérification (1 min)

Exécutez cette requête SQL :

```sql
SELECT table_name FROM information_schema.tables
WHERE table_name = 'annulations_ventes';
```

✅ Résultat attendu : 1 ligne retournée avec `annulations_ventes`

### Étape 3 : Code déjà déployé (0 min)

Les fichiers suivants sont déjà présents dans votre projet :
- ✅ `src/services/cancelSaleService.js`
- ✅ `src/app/api/admin/cancel-sale/route.js`
- ✅ `src/components/caisse/CancelSaleModal.js`
- ✅ `src/components/caisse/HistoriqueEmployeVentes.js` (modifié)

### Étape 4 : Redémarrage (1 min)

```bash
# Arrêter le serveur (Ctrl+C)
# Redémarrer
npm run dev
```

### Étape 5 : Test (1 min)

1. Connectez-vous en tant qu'**admin**
2. Allez dans **Caisse** → **Tableau de bord admin** → **Historique des ventes**
3. Cherchez une vente récente (moins de 7 jours)
4. Vous devriez voir une icône rouge ❌ dans la colonne "Actions"
5. Cliquez dessus pour tester

✅ **Installation terminée !**

---

## 🔧 Commandes utiles

### Vérifier que tout fonctionne

```sql
-- 1. Table créée ?
SELECT COUNT(*) FROM annulations_ventes;

-- 2. RLS actif ?
SELECT tablename, rowsecurity
FROM pg_tables
WHERE tablename = 'annulations_ventes';
-- Résultat attendu : rowsecurity = true

-- 3. Index créés ?
SELECT indexname FROM pg_indexes
WHERE tablename = 'annulations_ventes';
-- Résultat attendu : 3 index
```

### Tester les permissions

```sql
-- En tant qu'admin (devrait réussir)
SELECT * FROM annulations_ventes LIMIT 1;

-- En tant que vendeur (devrait retourner 0 lignes)
SELECT * FROM annulations_ventes LIMIT 1;
```

---

## 🚨 Problèmes courants

### ❌ "relation annulations_ventes does not exist"

**Solution :**
```sql
-- Le script SQL n'a pas été exécuté
-- Relancez : scripts/add_cancel_sales_feature.sql
```

### ❌ "permission denied for table annulations_ventes"

**Solution :**
```sql
-- Vérifier le rôle
SELECT role FROM profiles WHERE id = auth.uid();

-- Si pas admin, mettre à jour
UPDATE profiles SET role = 'admin'
WHERE id = 'votre-user-id';
```

### ❌ Bouton d'annulation invisible

**Solution :**
- Vérifiez que vous êtes connecté en tant qu'**admin**
- Vérifiez que la vente a le statut **'validee'**
- Vérifiez que la vente date de **moins de 7 jours**

---

## 📚 Documentation complète

Pour plus de détails :
- **[Guide utilisateur](docs/ANNULATION_VENTES.md)** : Comment utiliser
- **[Guide d'installation détaillé](docs/INSTALLATION_ANNULATION_VENTES.md)** : Tout savoir
- **[README technique](ANNULATION_VENTES_README.md)** : Architecture et code

---

## ✅ Checklist finale

Avant de considérer l'installation comme terminée :

- [ ] Script SQL exécuté sans erreur
- [ ] Table `annulations_ventes` existe
- [ ] RLS activé (rowsecurity = true)
- [ ] 3 index créés
- [ ] Application redémarrée
- [ ] Connecté en tant qu'admin
- [ ] Bouton ❌ visible dans l'historique
- [ ] Modal s'ouvre au clic
- [ ] Test d'annulation réussi
- [ ] Stock restauré correctement

**Tout est coché ?** ✅ Félicitations, l'installation est terminée !

---

## 🆘 Besoin d'aide ?

1. Consultez la [documentation complète](docs/INSTALLATION_ANNULATION_VENTES.md)
2. Vérifiez les logs de l'application
3. Relisez ce guide
4. Contactez le support technique

---

**Installation en 5 minutes** ⏱️
**Mise en production immédiate** 🚀
