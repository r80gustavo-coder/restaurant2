# Guia de Deploy no VPS (Ubuntu/Debian)

Este guia explica como configurar o seu servidor VPS do zero para rodar a aplicação e o banco de dados MySQL.

## Passo 1: Atualizar o Servidor e Instalar Dependências

Conecte-se ao seu VPS via SSH e rode os seguintes comandos:

```bash
# Atualizar os pacotes do sistema
sudo apt update && sudo apt upgrade -y

# Instalar o Node.js (versão 20) e npm
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Instalar o MySQL Server
sudo apt install -y mysql-server

# Instalar o PM2 (Gerenciador de processos para manter o app rodando)
sudo npm install -g pm2
```

## Passo 2: Configurar o Banco de Dados MySQL

Agora vamos criar o banco de dados e o usuário para a aplicação.

1. Acesse o terminal do MySQL:
```bash
sudo mysql
```

2. Dentro do MySQL, rode os seguintes comandos (substitua `sua_senha_aqui` por uma senha forte):
```sql
-- Criar o banco de dados
CREATE DATABASE restaurant_db;

-- Criar um usuário para a aplicação
CREATE USER 'restaurant_user'@'localhost' IDENTIFIED BY 'sua_senha_aqui';

-- Dar todas as permissões do banco para este usuário
GRANT ALL PRIVILEGES ON restaurant_db.* TO 'restaurant_user'@'localhost';

-- Aplicar as mudanças e sair
FLUSH PRIVILEGES;
EXIT;
```

## Passo 3: Configurar o Projeto

Vá para a pasta onde você colocou os arquivos do projeto (ex: `/var/www/meu-app`):

```bash
cd /caminho/para/sua/pasta
```

1. Instale as dependências do projeto:
```bash
npm install
```

2. Crie o arquivo de configuração `.env`:
```bash
cp .env.example .env
nano .env
```

3. Edite o arquivo `.env` com as credenciais que você acabou de criar:
```env
PORT=3000
NODE_ENV=production
JWT_SECRET=uma_chave_secreta_muito_longa_e_aleatoria_aqui

# Configurações do Banco de Dados MySQL
DB_HOST=localhost
DB_USER=restaurant_user
DB_PASSWORD=sua_senha_aqui
DB_NAME=restaurant_db
DB_PORT=3306

# URL da API para o Frontend (Coloque o IP do seu VPS ou seu Domínio)
VITE_API_URL=http://SEU_IP_OU_DOMINIO:3000/api
```
*(Pressione `Ctrl+O`, `Enter` para salvar e `Ctrl+X` para sair do nano)*

## Passo 4: Fazer o Build e Rodar a Aplicação

1. Compile o frontend (React/Vite) para produção:
```bash
npm run build
```

2. Inicie o servidor usando o PM2 (isso garante que o app reinicie se o servidor reiniciar):
```bash
# Iniciar a aplicação
pm2 start npm --name "restaurant-app" -- run start

# Salvar a configuração do PM2 para iniciar com o sistema
pm2 save
pm2 startup
```

## Passo 5: Acessar a Aplicação

Pronto! O servidor já deve estar rodando e as tabelas do banco de dados foram criadas automaticamente na primeira execução.

Acesse no seu navegador:
`http://IP_DO_SEU_VPS:3000`

### Usuário Padrão do Sistema:
- **Email:** admin@admin.com
- **Senha:** admin123

---

## (Opcional) Passo 6: Configurar um Domínio e HTTPS (Nginx)

Se você quiser acessar o sistema por um domínio (ex: `meusistema.com`) sem precisar digitar a porta `:3000`, instale o Nginx:

```bash
sudo apt install -y nginx
```

Crie um arquivo de configuração:
```bash
sudo nano /etc/nginx/sites-available/restaurant-app
```

Cole a seguinte configuração (substitua `seu-dominio.com`):
```nginx
server {
    listen 80;
    server_name seu-dominio.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Ative a configuração e reinicie o Nginx:
```bash
sudo ln -s /etc/nginx/sites-available/restaurant-app /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```
