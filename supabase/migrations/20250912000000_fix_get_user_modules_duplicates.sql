-- ============================================
-- Migration pour corriger les doublons dans get_user_modules
-- Date: 2025-09-12
-- Description: Mise à jour de la fonction get_user_modules pour éviter les modules en double
-- ============================================

-- Mise à jour de la fonction pour obtenir les modules accessibles à un utilisateur
-- Cette version agrège les permissions pour éviter les doublons
CREATE OR REPLACE FUNCTION public.get_user_modules(user_uuid UUID DEFAULT auth.uid())
RETURNS TABLE(
  module_id UUID,
  module_name TEXT,
  display_name TEXT,
  description TEXT,
  icon TEXT,
  sort_order INTEGER,
  can_read BOOLEAN,
  can_write BOOLEAN,
  can_admin BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    m.id,
    m.name,
    m.display_name,
    m.description,
    m.icon,
    m.sort_order,
    -- Agréger les permissions : un utilisateur a une permission s'il l'a dans au moins un de ses groupes
    MAX(gm.can_read::int)::boolean AS can_read,
    MAX(gm.can_write::int)::boolean AS can_write,
    MAX(gm.can_admin::int)::boolean AS can_admin
  FROM public.modules m
  JOIN public.group_modules gm ON m.id = gm.module_id
  JOIN public.user_groups ug ON gm.group_id = ug.group_id
  WHERE ug.user_id = user_uuid
    AND m.is_active = true
  GROUP BY m.id, m.name, m.display_name, m.description, m.icon, m.sort_order
  ORDER BY m.sort_order ASC, m.display_name ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;