# 🚀 Prompt de Déploiement AutoWeave pour Claude Code sur Ubuntu

Copier ce prompt dans Claude Code sur votre machine Ubuntu :

---

## Mission : Déployer AutoWeave sur Ubuntu

Je vais t'aider à déployer l'écosystème AutoWeave complet sur cette machine Ubuntu. AutoWeave est un orchestrateur d'agents IA modulaire avec 7 composants principaux.

### 📋 Informations du Projet

**Repositories GitHub** :
- Main : https://github.com/GontrandL/autoweave
- Core : https://github.com/GontrandL/autoweave-core
- Memory : https://github.com/GontrandL/autoweave-memory
- Integrations : https://github.com/GontrandL/autoweave-integrations
- Agents : https://github.com/GontrandL/autoweave-agents
- UI : https://github.com/GontrandL/autoweave-ui
- CLI : https://github.com/GontrandL/autoweave-cli
- Deployment : https://github.com/GontrandL/autoweave-deployment

### 🎯 Objectifs

1. **Vérifier et installer les prérequis**
2. **Cloner et organiser les modules**
3. **Configurer l'environnement**
4. **Déployer l'infrastructure (Docker/K8s)**
5. **Lancer AutoWeave**
6. **Tester le système**

### 📝 Instructions Étape par Étape

#### Phase 1 : Préparation du Système

```bash
# 1. Vérifier la version Ubuntu
lsb_release -a

# 2. Mettre à jour le système
sudo apt update && sudo apt upgrade -y

# 3. Installer les prérequis de base
sudo apt install -y \
    curl \
    git \
    build-essential \
    python3 \
    python3-pip \
    python3-venv \
    docker.io \
    docker-compose

# 4. Installer Node.js 18+
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# 5. Vérifier les versions
node --version  # Should be 18+
npm --version
python3 --version  # Should be 3.8+
docker --version
```

#### Phase 2 : Configuration Docker et Kubernetes

```bash
# 1. Ajouter l'utilisateur au groupe docker
sudo usermod -aG docker $USER
# NOTE: Déconnecter/reconnecter ou utiliser: newgrp docker

# 2. Installer Kind (Kubernetes in Docker)
curl -Lo ./kind https://kind.sigs.k8s.io/dl/v0.20.0/kind-linux-amd64
chmod +x ./kind
sudo mv ./kind /usr/local/bin/kind

# 3. Installer kubectl
curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl"
chmod +x kubectl
sudo mv kubectl /usr/local/bin/

# 4. Créer le cluster Kind
kind create cluster --name autoweave
```

#### Phase 3 : Cloner et Organiser AutoWeave

```bash
# 1. Créer la structure
mkdir -p ~/autoweave-deployment
cd ~/autoweave-deployment

# 2. Cloner le module de déploiement principal
git clone https://github.com/GontrandL/autoweave-deployment.git deployment
cd deployment

# 3. Exécuter l'installateur
chmod +x install.sh
./install.sh

# NOTE: L'installateur va automatiquement :
# - Cloner tous les modules nécessaires
# - Installer les dépendances
# - Configurer l'environnement
```

#### Phase 4 : Configuration de l'Environnement

```bash
# 1. Créer le fichier .env
cp .env.example .env

# 2. IMPORTANT : Éditer .env et ajouter ta clé OpenAI
nano .env
# Ajouter : OPENAI_API_KEY=sk-...

# 3. Configurer Python pour mem0
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

#### Phase 5 : Déployer l'Infrastructure

```bash
# 1. Déployer le système de mémoire (Qdrant + Memgraph)
./scripts/setup-memory-system.sh

# 2. Vérifier les pods
kubectl get pods -n autoweave-memory

# 3. Déployer Redis ML Cache
docker-compose -f docker/redis-ml.yml up -d

# 4. Vérifier les services
docker ps
kubectl get services -n autoweave-memory
```

#### Phase 6 : Lancer AutoWeave

```bash
# 1. Démarrer AutoWeave
./start-autoweave.sh

# 2. Dans un autre terminal, vérifier les logs
docker logs autoweave-core -f

# 3. Tester l'API
curl http://localhost:3000/api/health
```

#### Phase 7 : Tests et Validation

```bash
# 1. Test de création d'agent via CLI
cd ~/autoweave-deployment/cli
npm install -g .
autoweave create "Create a simple hello world agent"

# 2. Test via API
curl -X POST http://localhost:3000/api/agents \
  -H "Content-Type: application/json" \
  -d '{"description": "Create a file processing agent"}'

# 3. Test de l'interface WebSocket
# Ouvrir dans un navigateur : http://localhost:3000

# 4. Test du système de mémoire
curl -X POST http://localhost:3000/api/memory/search \
  -H "Content-Type: application/json" \
  -d '{"query": "test", "user_id": "system"}'
```

### 🔧 Configuration des Hooks Claude (Bonus)

Si tu veux activer le système génétique sur cette machine :

```bash
# 1. Cloner le module agents
cd ~
git clone https://github.com/GontrandL/autoweave-agents.git
cd autoweave-agents

# 2. Installer les hooks
mkdir -p ~/.claude/hooks
cp -r hooks/* ~/.claude/hooks/

# 3. Installer les dépendances Python
pip install qdrant-client openai
```

### 🚨 Troubleshooting

**Si Docker ne fonctionne pas** :
```bash
sudo systemctl start docker
sudo systemctl enable docker
```

**Si les ports sont occupés** :
```bash
# Vérifier les ports
sudo lsof -i :3000
sudo lsof -i :6333
sudo lsof -i :7687
```

**Si le cluster Kind a des problèmes** :
```bash
kind delete cluster --name autoweave
kind create cluster --name autoweave
```

### 📊 Vérification Finale

Une fois tout déployé, tu devrais avoir :
- ✅ API sur http://localhost:3000
- ✅ Health check qui retourne "healthy"
- ✅ Qdrant sur http://localhost:6333
- ✅ Pods Kubernetes running
- ✅ Création d'agents fonctionnelle

### 💡 Tips

1. **Utilise tmux ou screen** pour garder les services actifs
2. **Monitore avec** : `kubectl logs -f -n autoweave-memory`
3. **Sauvegarde régulièrement** : Les données sont dans `~/.autoweave/data`

Commence par la Phase 1 et dis-moi quand tu es prêt pour la suite !

---

## Notes pour Claude Code

- Exécute chaque phase séquentiellement
- Vérifie les prérequis avant de continuer
- Crée des checkpoints après chaque phase réussie
- Si une erreur survient, debug avant de continuer
- Documente tous les problèmes rencontrés
- Utilise les TodoWrite pour tracker la progression