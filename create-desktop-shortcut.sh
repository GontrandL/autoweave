#!/bin/bash
# Script pour créer un raccourci bureau AutoWeave

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DESKTOP_DIR="$HOME/Desktop"
MENU_DIR="$HOME/.local/share/applications"

# Créer le dossier du menu si nécessaire
mkdir -p "$MENU_DIR"

# Créer le fichier .desktop
cat > "$MENU_DIR/autoweave.desktop" << EOF
[Desktop Entry]
Version=1.0
Type=Application
Name=AutoWeave
Comment=The Self-Weaving Agent Orchestrator
Exec=$SCRIPT_DIR/start-autoweave.sh
Icon=$SCRIPT_DIR/public/autoweave-icon.png
Terminal=false
StartupWMClass=autoweave
Categories=Development;AI;Kubernetes;
Keywords=AI;Agent;Kubernetes;Orchestrator;
StartupNotify=true
EOF

# Créer une icône simple (si elle n'existe pas)
if [ ! -f "$SCRIPT_DIR/public/autoweave-icon.png" ]; then
    # Créer une icône SVG simple
    cat > "$SCRIPT_DIR/public/autoweave-icon.svg" << 'EOF'
<svg width="64" height="64" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="grad1" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#667eea;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#764ba2;stop-opacity:1" />
    </linearGradient>
  </defs>
  <rect width="64" height="64" rx="12" fill="url(#grad1)"/>
  <text x="32" y="40" font-family="Arial, sans-serif" font-size="24" fill="white" text-anchor="middle">🚀</text>
</svg>
EOF
    
    # Convertir en PNG si ImageMagick est disponible
    if command -v convert > /dev/null; then
        convert "$SCRIPT_DIR/public/autoweave-icon.svg" "$SCRIPT_DIR/public/autoweave-icon.png"
    else
        # Utiliser une icône par défaut du système
        echo "Icon=/usr/share/icons/hicolor/48x48/apps/utilities-terminal.png" >> "$MENU_DIR/autoweave.desktop"
    fi
fi

# Rendre le fichier .desktop exécutable
chmod +x "$MENU_DIR/autoweave.desktop"

# Copier sur le bureau si le dossier existe
if [ -d "$DESKTOP_DIR" ]; then
    cp "$MENU_DIR/autoweave.desktop" "$DESKTOP_DIR/"
    chmod +x "$DESKTOP_DIR/autoweave.desktop"
    echo "✅ Raccourci bureau créé: $DESKTOP_DIR/autoweave.desktop"
fi

echo "✅ Raccourci menu créé: $MENU_DIR/autoweave.desktop"
echo "🔄 Mise à jour du cache des applications..."

# Mettre à jour le cache des applications
if command -v update-desktop-database > /dev/null; then
    update-desktop-database "$MENU_DIR" 2>/dev/null || true
fi

echo "🎉 AutoWeave est maintenant disponible dans le menu des applications !"
echo "📱 Vous pouvez également double-cliquer sur l'icône du bureau pour démarrer"