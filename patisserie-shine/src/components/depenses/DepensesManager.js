import React, { useState, useEffect } from 'react';
import { 
  DollarSign, Plus, Search, Filter, Calendar, 
  FileText, Download, Trash2, Edit2, Save, X,
  AlertCircle, TrendingUp, TrendingDown, Receipt,
  Upload, File, Image, Eye, Paperclip
} from 'lucide-react';
import { supabase } from '../../lib/supabase';

const DepensesManager = ({ currentUser }) => {
  const [depenses, setDepenses] = useState([]);
  const [filteredDepenses, setFilteredDepenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [selectedDepense, setSelectedDepense] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [dateDebut, setDateDebut] = useState('');
  const [dateFin, setDateFin] = useState('');
  const [typeFilter, setTypeFilter] = useState('tous');
  const [uploadingFile, setUploadingFile] = useState(false);
  const [statistics, setStatistics] = useState({
    total: 0,
    parType: {}
  });

  // Types de dépenses disponibles
  const typesDepenses = [
    { value: 'achat_stock', label: '📦 Achat Stock', color: 'blue' },
    { value: 'reapprovisionnement_stock', label: '🔄 Réapprovisionnement', color: 'green' },
    { value: 'frais_generaux', label: '🏢 Frais Généraux', color: 'orange' },
    { value: 'salaires', label: '👥 Salaires', color: 'purple' },
    { value: 'loyer', label: '🏠 Loyer', color: 'red' },
    { value: 'electricite', label: '⚡ Électricité', color: 'yellow' },
    { value: 'eau', label: '💧 Eau', color: 'cyan' },
    { value: 'transport', label: '🚗 Transport', color: 'indigo' },
    { value: 'marketing', label: '📢 Marketing', color: 'pink' },
    { value: 'maintenance', label: '🔧 Maintenance', color: 'teal' },
    { value: 'fournitures', label: '📋 Fournitures Bureau', color: 'gray' },
    { value: 'autre', label: '📝 Autre', color: 'slate' }
  ];

  const [formData, setFormData] = useState({
    type_depense: 'frais_generaux',
    description: '',
    montant: '',
    date_depense: new Date().toISOString().split('T')[0],
    commentaire: '',
    pieces_jointes: [],
    numero_facture: ''
  });

  const [filesToUpload, setFilesToUpload] = useState([]);

  useEffect(() => {
    chargerDepenses();
  }, []);

  useEffect(() => {
    filtrerDepenses();
  }, [depenses, searchTerm, dateDebut, dateFin, typeFilter]);

  const chargerDepenses = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('depenses_comptables')
        .select(`
          *,
          utilisateur:profiles(nom, username)
        `)
        .order('date_depense', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) throw error;

      setDepenses(data || []);
      calculerStatistiques(data || []);
    } catch (error) {
      console.error('Erreur chargement dépenses:', error);
      alert('Erreur lors du chargement des dépenses');
    } finally {
      setLoading(false);
    }
  };

  const calculerStatistiques = (data) => {
    const total = data.reduce((sum, d) => sum + parseFloat(d.montant || 0), 0);
    const parType = {};

    data.forEach(d => {
      const type = d.type_depense || 'autre';
      if (!parType[type]) {
        parType[type] = { count: 0, montant: 0 };
      }
      parType[type].count++;
      parType[type].montant += parseFloat(d.montant || 0);
    });

    setStatistics({ total, parType });
  };

  const filtrerDepenses = () => {
    let filtered = [...depenses];

    if (searchTerm) {
      filtered = filtered.filter(d =>
        d.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        d.commentaire?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        d.numero_facture?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        d.type_depense?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (typeFilter !== 'tous') {
      filtered = filtered.filter(d => d.type_depense === typeFilter);
    }

    if (dateDebut) {
      filtered = filtered.filter(d => d.date_depense >= dateDebut);
    }
    if (dateFin) {
      filtered = filtered.filter(d => d.date_depense <= dateFin);
    }

    setFilteredDepenses(filtered);
    calculerStatistiques(filtered);
  };

  const handleFileSelect = (event) => {
    const files = Array.from(event.target.files);
    const validFiles = files.filter(file => {
      const isImage = file.type.startsWith('image/');
      const isPDF = file.type === 'application/pdf';
      const isValidSize = file.size <= 10 * 1024 * 1024; // 10 MB max

      if (!isImage && !isPDF) {
        alert(`${file.name}: Format non supporté. Seuls les images et PDF sont acceptés.`);
        return false;
      }

      if (!isValidSize) {
        alert(`${file.name}: Fichier trop volumineux. Taille max: 10 MB`);
        return false;
      }

      return true;
    });

    setFilesToUpload(prev => [...prev, ...validFiles]);
  };

  const removeFileFromList = (index) => {
    setFilesToUpload(prev => prev.filter((_, i) => i !== index));
  };

  const uploadFiles = async (depenseId) => {
    if (filesToUpload.length === 0) return [];

    setUploadingFile(true);
    const uploadedFiles = [];

    try {
      for (const file of filesToUpload) {
        const fileExt = file.name.split('.').pop();
        const fileName = `${currentUser.id}/${depenseId}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

        const { data, error } = await supabase.storage
          .from('depenses-pieces-jointes')
          .upload(fileName, file, {
            cacheControl: '3600',
            upsert: false
          });

        if (error) {
          console.error('Erreur upload fichier:', error);
          throw error;
        }

        uploadedFiles.push({
          nom: file.name,
          chemin: data.path,
          type: file.type,
          taille: file.size,
          date_upload: new Date().toISOString()
        });
      }

      return uploadedFiles;
    } catch (error) {
      console.error('Erreur lors de l\'upload:', error);
      alert('Erreur lors de l\'upload des fichiers');
      return [];
    } finally {
      setUploadingFile(false);
    }
  };

  const ajouterDepense = async () => {
    try {
      if (!formData.description || !formData.montant || parseFloat(formData.montant) <= 0) {
        alert('Veuillez remplir tous les champs obligatoires (Description et Montant)');
        return;
      }

      // Créer d'abord la dépense
      const { data: depense, error } = await supabase
        .from('depenses_comptables')
        .insert({
          type_depense: formData.type_depense,
          description: formData.description,
          montant: parseFloat(formData.montant),
          date_depense: formData.date_depense,
          commentaire: formData.commentaire || null,
          numero_facture: formData.numero_facture || null,
          utilisateur_id: currentUser.id,
          pieces_jointes: []
        })
        .select()
        .single();

      if (error) throw error;

      // Upload des fichiers si présents
      if (filesToUpload.length > 0) {
        const uploadedFiles = await uploadFiles(depense.id);

        if (uploadedFiles.length > 0) {
          // Mettre à jour la dépense avec les fichiers uploadés
          const { error: updateError } = await supabase
            .from('depenses_comptables')
            .update({ pieces_jointes: uploadedFiles })
            .eq('id', depense.id);

          if (updateError) {
            console.error('Erreur mise à jour pièces jointes:', updateError);
          }
        }
      }

      alert('✅ Dépense ajoutée avec succès');
      setShowAddModal(false);
      resetForm();
      chargerDepenses();
    } catch (error) {
      console.error('Erreur ajout dépense:', error);
      alert('Erreur lors de l\'ajout de la dépense');
    }
  };

  const modifierDepense = async () => {
    try {
      if (!formData.description || !formData.montant || parseFloat(formData.montant) <= 0) {
        alert('Veuillez remplir tous les champs obligatoires');
        return;
      }

      let piecesJointes = selectedDepense.pieces_jointes || [];

      // Upload des nouveaux fichiers si présents
      if (filesToUpload.length > 0) {
        const newFiles = await uploadFiles(selectedDepense.id);
        piecesJointes = [...piecesJointes, ...newFiles];
      }

      const { error } = await supabase
        .from('depenses_comptables')
        .update({
          type_depense: formData.type_depense,
          description: formData.description,
          montant: parseFloat(formData.montant),
          date_depense: formData.date_depense,
          commentaire: formData.commentaire || null,
          numero_facture: formData.numero_facture || null,
          pieces_jointes: piecesJointes,
          updated_at: new Date().toISOString()
        })
        .eq('id', selectedDepense.id);

      if (error) throw error;

      alert('✅ Dépense modifiée avec succès');
      setShowEditModal(false);
      setSelectedDepense(null);
      resetForm();
      chargerDepenses();
    } catch (error) {
      console.error('Erreur modification dépense:', error);
      alert('Erreur lors de la modification de la dépense');
    }
  };

  const supprimerFichier = async (depenseId, fichierChemin, fichierIndex) => {
    if (!window.confirm('Voulez-vous vraiment supprimer ce fichier ?')) {
      return;
    }

    try {
      // Supprimer du storage
      const { error: storageError } = await supabase.storage
        .from('depenses-pieces-jointes')
        .remove([fichierChemin]);

      if (storageError) {
        console.error('Erreur suppression storage:', storageError);
      }

      // Mettre à jour la dépense
      const depense = depenses.find(d => d.id === depenseId);
      const newPiecesJointes = (depense.pieces_jointes || []).filter((_, i) => i !== fichierIndex);

      const { error } = await supabase
        .from('depenses_comptables')
        .update({ pieces_jointes: newPiecesJointes })
        .eq('id', depenseId);

      if (error) throw error;

      alert('✅ Fichier supprimé');
      chargerDepenses();
    } catch (error) {
      console.error('Erreur suppression fichier:', error);
      alert('Erreur lors de la suppression du fichier');
    }
  };

  const telechargerFichier = async (fichierChemin, fichierNom) => {
    try {
      const { data, error } = await supabase.storage
        .from('depenses-pieces-jointes')
        .download(fichierChemin);

      if (error) throw error;

      const url = URL.createObjectURL(data);
      const link = document.createElement('a');
      link.href = url;
      link.download = fichierNom;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Erreur téléchargement:', error);
      alert('Erreur lors du téléchargement du fichier');
    }
  };

  const visualiserFichier = async (fichierChemin) => {
    try {
      const { data, error } = await supabase.storage
        .from('depenses-pieces-jointes')
        .createSignedUrl(fichierChemin, 3600); // URL valide 1h

      if (error) throw error;

      window.open(data.signedUrl, '_blank');
    } catch (error) {
      console.error('Erreur visualisation:', error);
      alert('Erreur lors de la visualisation du fichier');
    }
  };

  const supprimerDepense = async (depense) => {
    if (!window.confirm(`Voulez-vous vraiment supprimer cette dépense ?\n${depense.description}\nMontant: ${formatCFA(depense.montant)}`)) {
      return;
    }

    try {
      // Supprimer les fichiers associés
      if (depense.pieces_jointes && depense.pieces_jointes.length > 0) {
        const filePaths = depense.pieces_jointes.map(f => f.chemin);
        await supabase.storage
          .from('depenses-pieces-jointes')
          .remove(filePaths);
      }

      // Supprimer la dépense
      const { error } = await supabase
        .from('depenses_comptables')
        .delete()
        .eq('id', depense.id);

      if (error) throw error;

      alert('✅ Dépense supprimée avec succès');
      chargerDepenses();
    } catch (error) {
      console.error('Erreur suppression dépense:', error);
      alert('Erreur lors de la suppression de la dépense');
    }
  };

  const ouvrirModification = (depense) => {
    setSelectedDepense(depense);
    setFormData({
      type_depense: depense.type_depense,
      description: depense.description,
      montant: depense.montant,
      date_depense: depense.date_depense,
      commentaire: depense.commentaire || '',
      numero_facture: depense.numero_facture || '',
      pieces_jointes: depense.pieces_jointes || []
    });
    setFilesToUpload([]);
    setShowEditModal(true);
  };

  const ouvrirVisualisation = (depense) => {
    setSelectedDepense(depense);
    setShowViewModal(true);
  };

  const resetForm = () => {
    setFormData({
      type_depense: 'frais_generaux',
      description: '',
      montant: '',
      date_depense: new Date().toISOString().split('T')[0],
      commentaire: '',
      pieces_jointes: [],
      numero_facture: ''
    });
    setFilesToUpload([]);
  };

  const exporterDepenses = () => {
    const csv = [
      ['Date', 'Type', 'Description', 'Commentaire', 'N° Facture', 'Montant (FCFA)', 'Pièces jointes', 'Ajouté par'],
      ...filteredDepenses.map(d => [
        d.date_depense,
        typesDepenses.find(t => t.value === d.type_depense)?.label || d.type_depense,
        d.description,
        d.commentaire || '',
        d.numero_facture || '',
        d.montant,
        (d.pieces_jointes || []).length > 0 ? `${d.pieces_jointes.length} fichier(s)` : 'Aucun',
        d.utilisateur?.nom || d.utilisateur?.username || 'N/A'
      ])
    ].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');

    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `depenses_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  const formatCFA = (montant) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'XOF',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(montant || 0);
  };

  const formatTailleFichier = (taille) => {
    if (taille < 1024) return taille + ' B';
    if (taille < 1024 * 1024) return (taille / 1024).toFixed(1) + ' KB';
    return (taille / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const getTypeInfo = (type) => {
    return typesDepenses.find(t => t.value === type) || { label: type, color: 'gray' };
  };

  const getFileIcon = (type) => {
    if (type.startsWith('image/')) return <Image size={16} className="text-blue-500" />;
    if (type === 'application/pdf') return <File size={16} className="text-red-500" />;
    return <File size={16} className="text-gray-500" />;
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* En-tête avec statistiques */}
      <div className="bg-gradient-to-r from-orange-500 to-amber-500 rounded-lg shadow-lg p-6 text-white">
        <div className="flex justify-between items-start">
          <div>
            <h2 className="text-2xl font-bold mb-2 flex items-center">
              <Receipt className="mr-3" size={32} />
              Gestion des Dépenses
            </h2>
            <p className="text-orange-100">
              Suivi complet de toutes vos dépenses administratives
            </p>
          </div>
          <div className="text-right">
            <p className="text-sm text-orange-100">Total dépenses</p>
            <p className="text-3xl font-bold">{formatCFA(statistics.total)}</p>
            <p className="text-sm text-orange-100 mt-1">
              {filteredDepenses.length} dépense(s)
            </p>
          </div>
        </div>
      </div>

      {/* Barre d'outils */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-3 text-gray-400" size={20} />
            <input
              type="text"
              placeholder="Rechercher..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 w-full border rounded-lg focus:ring-2 focus:ring-orange-500"
            />
          </div>

          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500"
          >
            <option value="tous">Tous les types</option>
            {typesDepenses.map(type => (
              <option key={type.value} value={type.value}>{type.label}</option>
            ))}
          </select>

          <input
            type="date"
            value={dateDebut}
            onChange={(e) => setDateDebut(e.target.value)}
            placeholder="Date début"
            className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500"
          />

          <input
            type="date"
            value={dateFin}
            onChange={(e) => setDateFin(e.target.value)}
            placeholder="Date fin"
            className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500"
          />
        </div>

        <div className="flex justify-between items-center mt-4 pt-4 border-t">
          <button
            onClick={() => {
              setSearchTerm('');
              setTypeFilter('tous');
              setDateDebut('');
              setDateFin('');
            }}
            className="text-gray-600 hover:text-gray-800 flex items-center"
          >
            <X size={16} className="mr-1" />
            Réinitialiser filtres
          </button>

          <div className="flex space-x-2">
            <button
              onClick={exporterDepenses}
              className="flex items-center px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600"
            >
              <Download size={16} className="mr-2" />
              Exporter CSV
            </button>
            <button
              onClick={() => {
                resetForm();
                setShowAddModal(true);
              }}
              className="flex items-center px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600"
            >
              <Plus size={16} className="mr-2" />
              Nouvelle Dépense
            </button>
          </div>
        </div>
      </div>

      {/* Statistiques par type */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        {Object.entries(statistics.parType).map(([type, stats]) => {
          const typeInfo = getTypeInfo(type);
          return (
            <div key={type} className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
              <p className="text-xs text-gray-600 mb-1">{typeInfo.label}</p>
              <p className="text-lg font-bold text-gray-900">{formatCFA(stats.montant)}</p>
              <p className="text-xs text-gray-500">{stats.count} dépense(s)</p>
            </div>
          );
        })}
      </div>

      {/* Liste des dépenses */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {filteredDepenses.length === 0 ? (
          <div className="text-center py-12">
            <AlertCircle className="mx-auto text-gray-400 mb-4" size={48} />
            <p className="text-gray-500">Aucune dépense trouvée</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                    <Paperclip size={14} className="inline" />
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Montant</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Ajouté par</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredDepenses.map((depense) => {
                  const typeInfo = getTypeInfo(depense.type_depense);
                  const nbPieces = (depense.pieces_jointes || []).length;
                  return (
                    <tr key={depense.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {new Date(depense.date_depense).toLocaleDateString('fr-FR')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="px-2 py-1 text-xs rounded-full bg-gray-100 text-gray-800">
                          {typeInfo.label}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900 max-w-xs truncate">
                        {depense.description}
                        {depense.numero_facture && (
                          <span className="block text-xs text-gray-500">
                            N° {depense.numero_facture}
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-center">
                        {nbPieces > 0 && (
                          <span className="inline-flex items-center text-xs text-blue-600">
                            <Paperclip size={12} className="mr-1" />
                            {nbPieces}
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-right text-gray-900">
                        {formatCFA(depense.montant)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {depense.utilisateur?.nom || depense.utilisateur?.username || 'N/A'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <div className="flex justify-center space-x-2">
                          <button
                            onClick={() => ouvrirVisualisation(depense)}
                            className="text-green-600 hover:text-green-800"
                            title="Voir détails"
                          >
                            <Eye size={16} />
                          </button>
                          <button
                            onClick={() => ouvrirModification(depense)}
                            className="text-blue-600 hover:text-blue-800"
                            title="Modifier"
                          >
                            <Edit2 size={16} />
                          </button>
                          <button
                            onClick={() => supprimerDepense(depense)}
                            className="text-red-600 hover:text-red-800"
                            title="Supprimer"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal Ajout */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b">
              <h3 className="text-xl font-bold flex items-center">
                <Plus className="mr-2" />
                Nouvelle Dépense
              </h3>
            </div>

            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Type de dépense *
                  </label>
                  <select
                    value={formData.type_depense}
                    onChange={(e) => setFormData({ ...formData, type_depense: e.target.value })}
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500"
                  >
                    {typesDepenses.map(type => (
                      <option key={type.value} value={type.value}>{type.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Date de la dépense *
                  </label>
                  <input
                    type="date"
                    value={formData.date_depense}
                    onChange={(e) => setFormData({ ...formData, date_depense: e.target.value })}
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description *
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows="2"
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500"
                  placeholder="Décrivez la dépense..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Commentaire (optionnel)
                </label>
                <textarea
                  value={formData.commentaire}
                  onChange={(e) => setFormData({ ...formData, commentaire: e.target.value })}
                  rows="2"
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500"
                  placeholder="Ajoutez des détails supplémentaires..."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Montant (FCFA) *
                  </label>
                  <input
                    type="number"
                    value={formData.montant}
                    onChange={(e) => setFormData({ ...formData, montant: e.target.value })}
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500"
                    placeholder="0"
                    min="0"
                    step="1"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    N° Facture/Reçu (optionnel)
                  </label>
                  <input
                    type="text"
                    value={formData.numero_facture}
                    onChange={(e) => setFormData({ ...formData, numero_facture: e.target.value })}
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500"
                    placeholder="Ex: FAC-2025-001"
                  />
                </div>
              </div>

              {/* Zone d'upload de fichiers */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Pièces jointes (images ou PDF)
                </label>
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-orange-500 transition-colors">
                  <input
                    type="file"
                    id="fileInput"
                    multiple
                    accept="image/*,application/pdf"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                  <label
                    htmlFor="fileInput"
                    className="cursor-pointer flex flex-col items-center"
                  >
                    <Upload className="text-gray-400 mb-2" size={32} />
                    <p className="text-sm text-gray-600">
                      Cliquez pour sélectionner des fichiers
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      Images ou PDF - Max 10 MB par fichier
                    </p>
                  </label>
                </div>

                {/* Liste des fichiers sélectionnés */}
                {filesToUpload.length > 0 && (
                  <div className="mt-4 space-y-2">
                    <p className="text-sm font-medium text-gray-700">
                      Fichiers sélectionnés ({filesToUpload.length}) :
                    </p>
                    {filesToUpload.map((file, index) => (
                      <div key={index} className="flex items-center justify-between bg-gray-50 p-2 rounded">
                        <div className="flex items-center space-x-2">
                          {getFileIcon(file.type)}
                          <span className="text-sm text-gray-700">{file.name}</span>
                          <span className="text-xs text-gray-500">
                            ({formatTailleFichier(file.size)})
                          </span>
                        </div>
                        <button
                          onClick={() => removeFileFromList(index)}
                          className="text-red-500 hover:text-red-700"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="p-6 border-t flex justify-end space-x-3">
              <button
                onClick={() => {
                  setShowAddModal(false);
                  resetForm();
                }}
                className="px-6 py-2 border rounded-lg hover:bg-gray-50"
                disabled={uploadingFile}
              >
                Annuler
              </button>
              <button
                onClick={ajouterDepense}
                disabled={uploadingFile}
                className="px-6 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
              >
                {uploadingFile ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2"></div>
                    Upload en cours...
                  </>
                ) : (
                  <>
                    <Save className="mr-2" size={16} />
                    Enregistrer
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Modification */}
      {showEditModal && selectedDepense && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b">
              <h3 className="text-xl font-bold flex items-center">
                <Edit2 className="mr-2" />
                Modifier la Dépense
              </h3>
            </div>

            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Type de dépense *
                  </label>
                  <select
                    value={formData.type_depense}
                    onChange={(e) => setFormData({ ...formData, type_depense: e.target.value })}
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500"
                  >
                    {typesDepenses.map(type => (
                      <option key={type.value} value={type.value}>{type.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Date de la dépense *
                  </label>
                  <input
                    type="date"
                    value={formData.date_depense}
                    onChange={(e) => setFormData({ ...formData, date_depense: e.target.value })}
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description *
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows="2"
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500"
                  placeholder="Décrivez la dépense..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Commentaire (optionnel)
                </label>
                <textarea
                  value={formData.commentaire}
                  onChange={(e) => setFormData({ ...formData, commentaire: e.target.value })}
                  rows="2"
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500"
                  placeholder="Ajoutez des détails supplémentaires..."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Montant (FCFA) *
                  </label>
                  <input
                    type="number"
                    value={formData.montant}
                    onChange={(e) => setFormData({ ...formData, montant: e.target.value })}
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500"
                    placeholder="0"
                    min="0"
                    step="1"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    N° Facture/Reçu (optionnel)
                  </label>
                  <input
                    type="text"
                    value={formData.numero_facture}
                    onChange={(e) => setFormData({ ...formData, numero_facture: e.target.value })}
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500"
                    placeholder="Ex: FAC-2025-001"
                  />
                </div>
              </div>

              {/* Fichiers existants */}
              {selectedDepense.pieces_jointes && selectedDepense.pieces_jointes.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Pièces jointes existantes
                  </label>
                  <div className="space-y-2">
                    {selectedDepense.pieces_jointes.map((fichier, index) => (
                      <div key={index} className="flex items-center justify-between bg-gray-50 p-2 rounded">
                        <div className="flex items-center space-x-2">
                          {getFileIcon(fichier.type)}
                          <span className="text-sm text-gray-700">{fichier.nom}</span>
                          <span className="text-xs text-gray-500">
                            ({formatTailleFichier(fichier.taille)})
                          </span>
                        </div>
                        <div className="flex space-x-2">
                          <button
                            onClick={() => visualiserFichier(fichier.chemin)}
                            className="text-blue-500 hover:text-blue-700"
                            title="Visualiser"
                          >
                            <Eye size={16} />
                          </button>
                          <button
                            onClick={() => telechargerFichier(fichier.chemin, fichier.nom)}
                            className="text-green-500 hover:text-green-700"
                            title="Télécharger"
                          >
                            <Download size={16} />
                          </button>
                          <button
                            onClick={() => supprimerFichier(selectedDepense.id, fichier.chemin, index)}
                            className="text-red-500 hover:text-red-700"
                            title="Supprimer"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Zone d'upload de nouveaux fichiers */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Ajouter des pièces jointes
                </label>
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center hover:border-orange-500 transition-colors">
                  <input
                    type="file"
                    id="fileInputEdit"
                    multiple
                    accept="image/*,application/pdf"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                  <label
                    htmlFor="fileInputEdit"
                    className="cursor-pointer flex flex-col items-center"
                  >
                    <Upload className="text-gray-400 mb-2" size={24} />
                    <p className="text-sm text-gray-600">
                      Cliquez pour ajouter des fichiers
                    </p>
                  </label>
                </div>

                {filesToUpload.length > 0 && (
                  <div className="mt-4 space-y-2">
                    <p className="text-sm font-medium text-gray-700">
                      Nouveaux fichiers à ajouter ({filesToUpload.length}) :
                    </p>
                    {filesToUpload.map((file, index) => (
                      <div key={index} className="flex items-center justify-between bg-blue-50 p-2 rounded">
                        <div className="flex items-center space-x-2">
                          {getFileIcon(file.type)}
                          <span className="text-sm text-gray-700">{file.name}</span>
                          <span className="text-xs text-gray-500">
                            ({formatTailleFichier(file.size)})
                          </span>
                        </div>
                        <button
                          onClick={() => removeFileFromList(index)}
                          className="text-red-500 hover:text-red-700"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="p-6 border-t flex justify-end space-x-3">
              <button
                onClick={() => {
                  setShowEditModal(false);
                  setSelectedDepense(null);
                  resetForm();
                }}
                className="px-6 py-2 border rounded-lg hover:bg-gray-50"
                disabled={uploadingFile}
              >
                Annuler
              </button>
              <button
                onClick={modifierDepense}
                disabled={uploadingFile}
                className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
              >
                {uploadingFile ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2"></div>
                    Upload en cours...
                  </>
                ) : (
                  <>
                    <Save className="mr-2" size={16} />
                    Enregistrer
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Visualisation */}
      {showViewModal && selectedDepense && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b">
              <h3 className="text-xl font-bold flex items-center">
                <Eye className="mr-2" />
                Détails de la Dépense
              </h3>
            </div>

            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-gray-500">Type</p>
                  <p className="text-base font-semibold">
                    {getTypeInfo(selectedDepense.type_depense).label}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Date</p>
                  <p className="text-base font-semibold">
                    {new Date(selectedDepense.date_depense).toLocaleDateString('fr-FR')}
                  </p>
                </div>
              </div>

              <div>
                <p className="text-sm font-medium text-gray-500">Description</p>
                <p className="text-base">{selectedDepense.description}</p>
              </div>

              {selectedDepense.commentaire && (
                <div>
                  <p className="text-sm font-medium text-gray-500">Commentaire</p>
                  <p className="text-base text-gray-700">{selectedDepense.commentaire}</p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-gray-500">Montant</p>
                  <p className="text-2xl font-bold text-orange-600">
                    {formatCFA(selectedDepense.montant)}
                  </p>
                </div>
                {selectedDepense.numero_facture && (
                  <div>
                    <p className="text-sm font-medium text-gray-500">N° Facture</p>
                    <p className="text-base font-semibold">{selectedDepense.numero_facture}</p>
                  </div>
                )}
              </div>

              <div>
                <p className="text-sm font-medium text-gray-500">Ajouté par</p>
                <p className="text-base">
                  {selectedDepense.utilisateur?.nom || selectedDepense.utilisateur?.username || 'N/A'}
                </p>
                <p className="text-xs text-gray-500">
                  Le {new Date(selectedDepense.created_at).toLocaleDateString('fr-FR')} à{' '}
                  {new Date(selectedDepense.created_at).toLocaleTimeString('fr-FR')}
                </p>
              </div>

              {/* Pièces jointes */}
              {selectedDepense.pieces_jointes && selectedDepense.pieces_jointes.length > 0 && (
                <div>
                  <p className="text-sm font-medium text-gray-500 mb-3">
                    Pièces jointes ({selectedDepense.pieces_jointes.length})
                  </p>
                  <div className="space-y-2">
                    {selectedDepense.pieces_jointes.map((fichier, index) => (
                      <div key={index} className="flex items-center justify-between bg-gray-50 p-3 rounded-lg">
                        <div className="flex items-center space-x-3">
                          {getFileIcon(fichier.type)}
                          <div>
                            <p className="text-sm font-medium text-gray-700">{fichier.nom}</p>
                            <p className="text-xs text-gray-500">
                              {formatTailleFichier(fichier.taille)} •{' '}
                              {new Date(fichier.date_upload).toLocaleDateString('fr-FR')}
                            </p>
                          </div>
                        </div>
                        <div className="flex space-x-2">
                          <button
                            onClick={() => visualiserFichier(fichier.chemin)}
                            className="p-2 text-blue-500 hover:bg-blue-50 rounded transition-colors"
                            title="Visualiser"
                          >
                            <Eye size={18} />
                          </button>
                          <button
                            onClick={() => telechargerFichier(fichier.chemin, fichier.nom)}
                            className="p-2 text-green-500 hover:bg-green-50 rounded transition-colors"
                            title="Télécharger"
                          >
                            <Download size={18} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {(!selectedDepense.pieces_jointes || selectedDepense.pieces_jointes.length === 0) && (
                <div className="text-center py-6 bg-gray-50 rounded-lg">
                  <Paperclip className="mx-auto text-gray-400 mb-2" size={32} />
                  <p className="text-sm text-gray-500">Aucune pièce jointe</p>
                </div>
              )}
            </div>

            <div className="p-6 border-t flex justify-end">
              <button
                onClick={() => {
                  setShowViewModal(false);
                  setSelectedDepense(null);
                }}
                className="px-6 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DepensesManager;
