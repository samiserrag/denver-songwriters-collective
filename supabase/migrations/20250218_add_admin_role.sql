-- Add admin role to enum if it doesn't exist
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'admin';
