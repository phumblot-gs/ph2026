-- Edge Function pour notifier les admins d'une nouvelle inscription
-- À déployer dans Supabase Functions

-- Cette fonction sera appelée automatiquement lors d'une nouvelle inscription
-- Elle récupère tous les super_admins et leur envoie un email

CREATE OR REPLACE FUNCTION notify_admins_new_member()
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  admin_record RECORD;
  new_member RECORD;
BEGIN
  -- Récupérer les infos du nouveau membre
  SELECT * INTO new_member
  FROM members
  WHERE role = 'pending'
  ORDER BY created_at DESC
  LIMIT 1;

  -- Pour chaque super_admin
  FOR admin_record IN
    SELECT email, first_name
    FROM members
    WHERE role = 'super_admin'
  LOOP
    -- Ici, on devrait appeler une Edge Function qui envoie l'email
    -- Pour l'instant, on stocke juste dans la table de notifications
    INSERT INTO admin_notifications (type, data, created_at)
    VALUES (
      'new_member_email',
      json_build_object(
        'to', admin_record.email,
        'subject', 'Nouvelle demande d''inscription - ' || new_member.first_name || ' ' || new_member.last_name,
        'member_name', new_member.first_name || ' ' || new_member.last_name,
        'member_email', new_member.email,
        'member_phone', new_member.phone,
        'created_at', new_member.created_at
      ),
      NOW()
    );
  END LOOP;
END;
$$;