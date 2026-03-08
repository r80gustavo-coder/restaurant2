#!/bin/bash

# Script para corrigir e rodar o projeto no VPS

echo "1. Corrigindo permissões do banco de dados..."
sudo mysql < fix_db.sql

echo "2. Instalando dependências..."
npm install

echo "3. Compilando o frontend (Build)..."
npm run build

echo "4. Reiniciando o servidor..."
pm2 restart restaurant-app || pm2 start npm --name "restaurant-app" -- run start

echo "5. Verificando logs..."
pm2 logs restaurant-app --lines 20
