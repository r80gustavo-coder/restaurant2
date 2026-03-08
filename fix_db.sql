-- Script para corrigir permissões do banco de dados
-- Salve como fix_db.sql e rode: sudo mysql < fix_db.sql

CREATE DATABASE IF NOT EXISTS restaurant_db;

-- Remove o usuário se existir para recriar do zero (evita conflitos)
DROP USER IF EXISTS 'restaurant_user'@'localhost';

-- Cria o usuário com a senha EXATA que está no .env
CREATE USER 'restaurant_user'@'localhost' IDENTIFIED BY 'mudar123';

-- Garante todas as permissões
GRANT ALL PRIVILEGES ON restaurant_db.* TO 'restaurant_user'@'localhost';

-- Aplica
FLUSH PRIVILEGES;
