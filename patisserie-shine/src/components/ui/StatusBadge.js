export function StatusBadge({ status }) {
  const variants = {
    'en_attente': 'bg-yellow-100 text-yellow-800',
    'validee': 'bg-green-100 text-green-800',
    'refusee': 'bg-red-100 text-red-800',
    'termine': 'bg-blue-100 text-blue-800',
    'en_cours': 'bg-orange-100 text-orange-800',
    'annule': 'bg-gray-100 text-gray-800',
    'rupture': 'bg-red-100 text-red-800',
    'critique': 'bg-red-100 text-red-800',
    'faible': 'bg-yellow-100 text-yellow-800',
    'normal': 'bg-green-100 text-green-800'
  };

  const labels = {
    'en_attente': 'En attente',
    'validee': 'Validée',
    'refusee': 'Refusée',
    'termine': 'Terminé',
    'en_cours': 'En cours',
    'annule': 'Annulé',
    'rupture': 'Rupture',
    'critique': 'Critique',
    'faible': 'Faible',
    'normal': 'Normal'
  };

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${variants[status] || 'bg-gray-100 text-gray-800'}`}>
      {labels[status] || status}
    </span>
  );
}
