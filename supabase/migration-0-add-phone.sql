-- Script 0 : Ajouter la colonne phone si elle n'existe pas
-- EXÉCUTEZ CE SCRIPT EN PREMIER SI LA COLONNE PHONE N'EXISTE PAS

-- Ajouter la colonne phone à la table members si elle n'existe pas déjà
ALTER TABLE members 
ADD COLUMN IF NOT EXISTS phone VARCHAR(20);