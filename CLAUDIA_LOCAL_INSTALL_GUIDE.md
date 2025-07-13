# Guide d'Installation de Claudia GUI sur Machine Locale

Ce guide vous explique comment installer et lancer Claudia sur votre machine locale avec interface graphique.

## Prérequis

- Système d'exploitation avec interface graphique (Windows, macOS, Linux Desktop)
- Connexion internet
- Au moins 4GB de RAM disponible
- ~2GB d'espace disque libre

## Installation Étape par Étape

### 1. Cloner le Repository Claudia

```bash
# Ouvrez un terminal sur votre machine locale
cd ~
git clone https://github.com/getAsterisk/claudia.git
cd claudia
```

### 2. Installer Bun (Runtime JavaScript)

#### Sur macOS/Linux :
```bash
curl -fsSL https://bun.sh/install | bash
source ~/.bashrc  # ou ~/.zshrc sur macOS
```

#### Sur Windows :
```powershell
# Dans PowerShell en mode administrateur
irm bun.sh/install.ps1 | iex
```

### 3. Installer Rust (Requis pour Tauri)

#### Sur macOS/Linux :
```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source "$HOME/.cargo/env"
```

#### Sur Windows :
Téléchargez et exécutez : https://win.rustup.rs/

### 4. Installer les Dépendances Système

#### Sur Ubuntu/Debian :
```bash
sudo apt update
sudo apt install -y \
  libwebkit2gtk-4.1-dev \
  build-essential \
  curl \
  wget \
  file \
  libssl-dev \
  libgtk-3-dev \
  libayatana-appindicator3-dev \
  librsvg2-dev
```

#### Sur Fedora :
```bash
sudo dnf install -y \
  webkit2gtk4.1-devel \
  openssl-devel \
  gtk3-devel \
  libappindicator-gtk3-devel \
  librsvg2-devel
```

#### Sur macOS :
```bash
# Installez Xcode Command Line Tools si nécessaire
xcode-select --install
```

#### Sur Windows :
- Installez Visual Studio 2022 avec "Desktop development with C++"
- Installez WebView2 (généralement déjà installé avec Windows 10/11)

### 5. Installer les Dépendances du Projet

```bash
# Dans le dossier claudia
bun install
```

### 6. Installer Tauri CLI

```bash
# Option 1 : Via Cargo (recommandé)
cargo install tauri-cli --version "^2.0.0"

# Option 2 : Via npm (alternative)
npm install -g @tauri-apps/cli@next
```

### 7. Configurer Claude Code

Claudia a besoin de savoir où se trouvent vos fichiers Claude :

#### Sur Linux/macOS :
Les fichiers Claude sont dans `~/.claude/`

#### Sur Windows :
Les fichiers Claude sont dans `%USERPROFILE%\.claude\`

Si le dossier n'existe pas, créez-le :
```bash
# Linux/macOS
mkdir -p ~/.claude/projects

# Windows PowerShell
New-Item -ItemType Directory -Force -Path "$env:USERPROFILE\.claude\projects"
```

### 8. Lancer Claudia

```bash
# Dans le dossier claudia
bun run tauri dev
```

## 🎉 Première Utilisation

1. **Au premier lancement**, Claudia va :
   - Télécharger les binaires Claude Code
   - Compiler l'application
   - Ouvrir la fenêtre GUI

2. **Configuration initiale** :
   - Allez dans Settings → Claude Code Installation
   - Vérifiez que Claude Code est détecté
   - Si non, installez Claude Code via : `npm install -g @anthropic-ai/claude-code`

3. **Utilisation** :
   - **Projects** : Parcourez vos projets Claude Code
   - **Sessions** : Visualisez l'historique des sessions
   - **Agents** : Créez des agents personnalisés
   - **Analytics** : Suivez votre utilisation

## 🔧 Résolution de Problèmes

### Erreur "window.__TAURI_INTERNALS__ is undefined"
- Assurez-vous de lancer avec `bun run tauri dev`, pas juste `bun run dev`

### Erreur de compilation Rust
```bash
# Mettez à jour Rust
rustup update
```

### Erreur WebKit sur Linux
```bash
# Réinstallez les dépendances WebKit
sudo apt reinstall libwebkit2gtk-4.1-dev
```

### Performance lente au premier lancement
C'est normal, Tauri compile l'application. Les lancements suivants seront plus rapides.

## 📦 Build de Production

Pour créer une version installable :

```bash
# Build pour votre plateforme actuelle
bun run tauri build

# Les installateurs seront dans src-tauri/target/release/bundle/
```

## 🔗 Intégration avec AutoWeave

Pour utiliser Claudia avec votre projet AutoWeave local :

1. Clonez AutoWeave sur votre machine locale
2. Configurez AutoWeave comme serveur MCP dans `~/.config/claude/claude_desktop_config.json`
3. Utilisez Claudia pour gérer vos sessions AutoWeave

## 📚 Resources

- [Documentation Claudia](https://claudiacode.com)
- [Documentation Tauri](https://tauri.app)
- [Documentation Bun](https://bun.sh)
- [Issues GitHub](https://github.com/getAsterisk/claudia/issues)

---

**Note** : Ce guide assume que vous avez les permissions administrateur sur votre machine pour installer les dépendances système.