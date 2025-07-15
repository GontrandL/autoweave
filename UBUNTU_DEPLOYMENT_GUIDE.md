# 🚀 Guide de Déploiement AutoWeave sur Ubuntu

## 📋 Prérequis Système

**Systèmes supportés :**
- Ubuntu 20.04 LTS / 22.04 LTS / 24.04 LTS
- Minimum 4GB RAM, 20GB espace disque
- Accès sudo/root

## 🚀 Installation Automatique (Recommandé)

### Méthode 1: Script d'installation complet

```bash
# 1. Télécharger et exécuter l'installateur
curl -fsSL https://raw.githubusercontent.com/GontrandL/autoweave/feat/typescript-migration/install.sh | bash

# 2. Configurer l'environnement
cd ~/autoweave
cp .env.example .env
nano .env  # Ajouter votre clé OpenAI
```

### Méthode 2: Clone et installation manuelle

```bash
# 1. Cloner le repository
git clone https://github.com/GontrandL/autoweave.git
cd autoweave
git checkout feat/typescript-migration

# 2. Installer les dépendances
npm install

# 3. Configuration
cp .env.example .env
# Éditer .env avec vos clés API

# 4. Démarrer AutoWeave
./start-autoweave.sh
```

## 🔧 Installation Manuelle des Prérequis

Si le script automatique échoue, installez manuellement :

### 1. Prérequis système
```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl git build-essential python3 python3-pip python3-venv
```

### 2. Node.js 18+
```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs
node --version  # Doit être >= 18.0.0
```

### 3. Docker
```bash
sudo apt install -y docker.io docker-compose
sudo usermod -aG docker $USER
newgrp docker
```

### 4. Kubernetes (Kind)
```bash
# Installer Kind
curl -Lo ./kind https://kind.sigs.k8s.io/dl/v0.20.0/kind-linux-amd64
chmod +x ./kind && sudo mv ./kind /usr/local/bin/kind

# Installer kubectl
curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl"
chmod +x kubectl && sudo mv kubectl /usr/local/bin/
```

### 5. Redis (optionnel pour BullMQ)
```bash
sudo apt install -y redis-server
sudo systemctl enable redis-server
```

## ⚙️ Configuration

### 1. Variables d'environnement (.env)
```bash
# Copier et éditer le fichier d'environnement
cp .env.example .env
```

**Variables critiques à configurer :**
```env
# API Keys (OBLIGATOIRE)
OPENAI_API_KEY=sk-proj-votre-cle-openai-ici

# Optionnel mais recommandé
GITHUB_TOKEN=ghp_votre-token-github-ici
ANTHROPIC_API_KEY=sk-ant-api03-votre-cle-anthropic-ici

# Configuration par défaut (ne pas modifier sauf besoin)
NODE_ENV=production
PORT=3000
LOG_LEVEL=info
```

### 2. Configuration Kubernetes
```bash
# Créer le cluster Kind
kind create cluster --name autoweave

# Vérifier que kubectl fonctionne
kubectl cluster-info
```

## 🚀 Démarrage AutoWeave

### Méthode 1: Script de démarrage
```bash
./start-autoweave.sh
```

### Méthode 2: Démarrage manuel
```bash
# 1. Installer les packages
npm install

# 2. Builder les packages
npm run build

# 3. Démarrer les services de base
npm run dev

# 4. Dans un autre terminal, démarrer le système mémoire
./scripts/setup-memory-system.sh
```

## 🧪 Vérification du Déploiement

### 1. Health Check
```bash
# Vérifier que l'API répond
curl http://localhost:3000/api/health

# Réponse attendue:
# {"status":"ok","timestamp":"...","services":{"core":"running"}}
```

### 2. Interface Web
Ouvrir dans votre navigateur :
- **API principale** : http://localhost:3000
- **Health Check** : http://localhost:3000/api/health
- **Documentation API** : http://localhost:3000/api/docs

### 3. Test de création d'agent
```bash
curl -X POST http://localhost:3000/api/agents \
  -H "Content-Type: application/json" \
  -d '{"description": "Create a simple hello world agent"}'
```

### 4. Vérification Kubernetes
```bash
# Voir les pods déployés
kubectl get pods --all-namespaces

# Vérifier les services AutoWeave
kubectl get pods -l app=autoweave
```

## 📊 Monitoring et Logs

### Logs AutoWeave
```bash
# Logs du serveur principal
npm run logs

# Logs Docker
docker logs autoweave-core

# Logs système
journalctl -u autoweave -f
```

### Monitoring des services
```bash
# Status des ports
ss -tlnp | grep -E ':(3000|6333|7687|6379)'

# Utilisation des ressources
htop
docker stats
```

## 🔧 Dépannage

### Problèmes courants

#### 1. Port 3000 déjà utilisé
```bash
# Trouver le processus
sudo netstat -tlnp | grep :3000
# Tuer le processus
sudo kill -9 <PID>
```

#### 2. Erreur de permissions Docker
```bash
sudo usermod -aG docker $USER
newgrp docker
# Redémarrer la session
```

#### 3. Échec de création du cluster Kind
```bash
# Nettoyer et recréer
kind delete cluster --name autoweave
kind create cluster --name autoweave
```

#### 4. Erreur "Module not found"
```bash
# Nettoyer et réinstaller
rm -rf node_modules package-lock.json
npm install
```

#### 5. Erreur de mémoire lors du build
```bash
# Augmenter la mémoire Node.js
export NODE_OPTIONS="--max-old-space-size=4096"
npm run build
```

### Logs de débogage
```bash
# Mode debug complet
DEBUG=* npm start

# Logs détaillés
LOG_LEVEL=debug npm start

# Analyse des performances
npm run test:performance
```

## 🔒 Sécurité

### 1. Firewall (recommandé)
```bash
sudo ufw allow 3000
sudo ufw allow 22  # SSH
sudo ufw enable
```

### 2. SSL/TLS (production)
```bash
# Utiliser nginx ou caddy comme reverse proxy
sudo apt install nginx
# Configurer SSL avec Let's Encrypt
```

### 3. Variables d'environnement sécurisées
- Ne jamais committer le fichier `.env`
- Utiliser des secrets Kubernetes en production
- Changer les clés par défaut

## 📦 Services Additionnels

### Memory System complet
```bash
# Déployer Qdrant, Memgraph, Redis
./scripts/setup-memory-system.sh

# Vérifier les services mémoire
curl http://localhost:6333/dashboard  # Qdrant
curl http://localhost:7687  # Memgraph
redis-cli ping  # Redis
```

### Monitoring complet
```bash
# Déployer Prometheus + Grafana
kubectl apply -f k8s/monitoring/

# Accéder aux dashboards
kubectl port-forward svc/grafana 3001:3000
# http://localhost:3001 (admin/admin)
```

## 🚀 Mise en Production

### 1. Variables d'environnement production
```env
NODE_ENV=production
LOG_LEVEL=warn
OTEL_EXPORTER_OTLP_ENDPOINT=http://your-jaeger:14268
```

### 2. Optimisations
```bash
# Build optimisé
npm run build:prod

# PM2 pour la gestion des processus
npm install -g pm2
pm2 start npm --name "autoweave" -- start
pm2 startup
pm2 save
```

### 3. Backup automatique
```bash
# Créer un script de backup
./scripts/backup-autoweave.sh

# Crontab pour backup automatique
0 2 * * * /path/to/autoweave/scripts/backup-autoweave.sh
```

## 📞 Support

En cas de problème :
1. Vérifier les logs : `npm run logs`
2. Consulter la documentation : https://github.com/GontrandL/autoweave
3. Issues GitHub : https://github.com/GontrandL/autoweave/issues

## 🎯 URLs Importantes

- **Repository GitHub** : https://github.com/GontrandL/autoweave
- **Branch actuelle** : feat/typescript-migration
- **Pull Request** : https://github.com/GontrandL/autoweave/pull/6
- **Documentation** : Voir README.md dans le repository

---

**AutoWeave v1.0.0** - Transforming natural language into cloud-native AI agents 🚀