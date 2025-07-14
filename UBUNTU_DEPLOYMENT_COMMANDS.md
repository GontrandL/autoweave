# 🚀 Commandes de Déploiement Rapide AutoWeave sur Ubuntu

## Option 1 : Copier-Coller Rapide (Pour Ubuntu 20.04/22.04/24.04)

```bash
# Tout en une seule commande (après avoir votre clé OpenAI)
curl -fsSL https://raw.githubusercontent.com/GontrandL/autoweave-deployment/main/scripts/ubuntu-deploy.sh | bash -s -- --api-key YOUR_OPENAI_API_KEY
```

## Option 2 : Déploiement Manuel Étape par Étape

### 1️⃣ Installation des Prérequis
```bash
# Mettre à jour le système
sudo apt update && sudo apt upgrade -y

# Installer tous les prérequis d'un coup
sudo apt install -y curl git build-essential python3 python3-pip python3-venv docker.io docker-compose

# Installer Node.js 18
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Ajouter l'utilisateur au groupe docker
sudo usermod -aG docker $USER && newgrp docker
```

### 2️⃣ Installation de Kubernetes (Kind)
```bash
# Installer Kind
curl -Lo ./kind https://kind.sigs.k8s.io/dl/v0.20.0/kind-linux-amd64
chmod +x ./kind && sudo mv ./kind /usr/local/bin/kind

# Installer kubectl
curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl"
chmod +x kubectl && sudo mv kubectl /usr/local/bin/

# Créer le cluster
kind create cluster --name autoweave
```

### 3️⃣ Déploiement AutoWeave
```bash
# Cloner et installer
cd ~
git clone https://github.com/GontrandL/autoweave-deployment.git
cd autoweave-deployment

# Configurer l'environnement
cp .env.example .env
echo "OPENAI_API_KEY=sk-YOUR_KEY_HERE" >> .env

# Installer et démarrer
chmod +x install.sh start-autoweave.sh
./install.sh
./scripts/setup-memory-system.sh
./start-autoweave.sh
```

### 4️⃣ Vérification
```bash
# Tester l'API
curl http://localhost:3000/api/health

# Voir les logs
docker logs -f autoweave-core

# Vérifier les pods Kubernetes
kubectl get pods --all-namespaces
```

## 🔥 One-Liner pour les Pros

```bash
# Prérequis + AutoWeave en une commande (remplacer YOUR_API_KEY)
bash <(curl -s https://raw.githubusercontent.com/GontrandL/autoweave/main/quick-install.sh) YOUR_API_KEY
```

## 🐳 Docker Compose Seulement (Sans Kubernetes)

```bash
# Clone et configure
git clone https://github.com/GontrandL/autoweave-deployment.git && \
cd autoweave-deployment && \
cp .env.example .env && \
sed -i 's/YOUR_OPENAI_API_KEY/YOUR_ACTUAL_KEY/g' .env && \
docker-compose up -d
```

## 🆘 Commandes de Dépannage

```bash
# Vérifier les services
systemctl status docker
docker ps
kubectl get all -A

# Redémarrer AutoWeave
docker restart autoweave-core

# Voir les logs complets
journalctl -u docker -f

# Nettoyer et recommencer
kind delete cluster --name autoweave
docker system prune -a
```

## 📍 URLs Importantes

- **API** : http://localhost:3000
- **Health** : http://localhost:3000/api/health
- **Docs** : http://localhost:3000/api/docs
- **Qdrant** : http://localhost:6333/dashboard
- **Metrics** : http://localhost:3000/api/metrics

## 💾 Sauvegarde des Données

```bash
# Backup
tar -czf autoweave-backup-$(date +%Y%m%d).tar.gz ~/.autoweave/data

# Restore
tar -xzf autoweave-backup-20250711.tar.gz -C /
```