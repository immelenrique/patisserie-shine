import { useState, useEffect } from 'react';
import { permissionsService } from '@/services/permissionsService';

export function usePermission(permissionCode) {
  const [hasPermission, setHasPermission] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkPermission();
  }, [permissionCode]);

  const checkPermission = async () => {
    if (!permissionCode) {
      setHasPermission(false);
      setLoading(false);
      return;
    }

    try {
      const result = await permissionsService.checkPermission(permissionCode);
      setHasPermission(result);
    } catch (error) {
      console.error('Erreur vérification permission:', error);
      setHasPermission(false);
    } finally {
      setLoading(false);
    }
  };

  return { hasPermission, loading };
}
