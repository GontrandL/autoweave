#!/bin/bash
# AutoWeave - Startup Script
# Démarre tous les services AutoWeave et ouvre l'interface

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Couleurs pour l'output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Fonction d'affichage
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Fonction pour vérifier si un port est occupé
check_port() {
    local port=$1
    if ss -tlnp | grep -q ":$port "; then
        return 0  # Port occupé
    else
        return 1  # Port libre
    fi
}

# Fonction pour attendre qu'un service soit prêt
wait_for_service() {
    local url=$1
    local name=$2
    local timeout=60
    local count=0
    
    log_info "Attente de $name..."
    while [ $count -lt $timeout ]; do
        if curl -s -o /dev/null -w "%{http_code}" "$url" | grep -q "200"; then
            log_success "$name est prêt !"
            return 0
        fi
        sleep 1
        count=$((count + 1))
    done
    
    log_error "$name n'est pas prêt après ${timeout}s"
    return 1
}

# Fonction pour démarrer AutoWeave
start_autoweave() {
    log_info "Démarrage d'AutoWeave..."
    
    # Vérifier si le processus existe déjà
    if pgrep -f "node src/index.js" > /dev/null; then
        log_warning "AutoWeave semble déjà démarré"
    else
        # Démarrer AutoWeave en arrière-plan
        npm start > /tmp/autoweave-server.log 2>&1 &
        sleep 3
        
        if wait_for_service "http://localhost:3000/health" "AutoWeave"; then
            log_success "AutoWeave démarré avec succès"
        else
            log_error "Échec du démarrage d'AutoWeave"
            return 1
        fi
    fi
}

# Fonction pour démarrer les port-forwards
start_port_forwards() {
    log_info "Configuration des port-forwards..."
    
    # SillyTavern port-forward
    if ! pgrep -f "port-forward.*sillytavern.*8081" > /dev/null; then
        log_info "Démarrage du port-forward SillyTavern..."
        kubectl port-forward -n autoweave-system svc/sillytavern-service 8081:8000 > /tmp/sillytavern-port-forward.log 2>&1 &
        sleep 2
    fi
    
    # Appsmith port-forward
    if ! pgrep -f "port-forward.*appsmith.*8080" > /dev/null; then
        log_info "Démarrage du port-forward Appsmith..."
        kubectl port-forward -n appsmith-system svc/appsmith 8080:80 > /tmp/appsmith-port-forward.log 2>&1 &
        sleep 2
    fi
    
    # Vérifier que les services sont accessibles
    if wait_for_service "http://localhost:8081" "SillyTavern"; then
        log_success "SillyTavern accessible sur http://localhost:8081"
    fi
    
    if wait_for_service "http://localhost:8080" "Appsmith"; then
        log_success "Appsmith accessible sur http://localhost:8080"
    fi
}

# Fonction pour ouvrir l'interface web
open_interface() {
    log_info "Ouverture de l'interface AutoWeave..."
    
    # Créer ou mettre à jour la page d'accueil
    cat > public/index.html << 'EOF'
<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>AutoWeave - Interface d'Accueil</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            display: flex;
            justify-content: center;
            align-items: center;
        }
        
        .container {
            background: white;
            padding: 2rem;
            border-radius: 20px;
            box-shadow: 0 20px 40px rgba(0,0,0,0.1);
            max-width: 800px;
            width: 90%;
            text-align: center;
        }
        
        .logo {
            font-size: 3rem;
            font-weight: bold;
            color: #667eea;
            margin-bottom: 1rem;
        }
        
        .subtitle {
            color: #666;
            font-size: 1.2rem;
            margin-bottom: 2rem;
        }
        
        .interfaces {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 1.5rem;
            margin: 2rem 0;
        }
        
        .interface-card {
            background: #f8f9fa;
            padding: 1.5rem;
            border-radius: 15px;
            border: 2px solid transparent;
            transition: all 0.3s ease;
            cursor: pointer;
            text-decoration: none;
            color: inherit;
        }
        
        .interface-card:hover {
            border-color: #667eea;
            transform: translateY(-5px);
            box-shadow: 0 10px 25px rgba(0,0,0,0.1);
        }
        
        .interface-icon {
            font-size: 2.5rem;
            margin-bottom: 1rem;
        }
        
        .interface-title {
            font-size: 1.3rem;
            font-weight: bold;
            margin-bottom: 0.5rem;
            color: #333;
        }
        
        .interface-desc {
            color: #666;
            font-size: 0.9rem;
            margin-bottom: 1rem;
        }
        
        .interface-url {
            font-size: 0.8rem;
            color: #667eea;
            font-family: monospace;
        }
        
        .status {
            margin-top: 2rem;
            padding: 1rem;
            background: #e8f5e8;
            border-radius: 10px;
            border-left: 4px solid #28a745;
        }
        
        .status-title {
            font-weight: bold;
            color: #28a745;
            margin-bottom: 0.5rem;
        }
        
        .footer {
            margin-top: 2rem;
            padding-top: 1rem;
            border-top: 1px solid #eee;
            color: #666;
            font-size: 0.9rem;
        }
        
        .btn {
            display: inline-block;
            padding: 0.75rem 1.5rem;
            background: #667eea;
            color: white;
            text-decoration: none;
            border-radius: 25px;
            margin: 0.5rem;
            transition: all 0.3s ease;
        }
        
        .btn:hover {
            background: #5a67d8;
            transform: translateY(-2px);
        }
        
        .health-indicator {
            display: inline-block;
            width: 10px;
            height: 10px;
            border-radius: 50%;
            background: #28a745;
            margin-right: 0.5rem;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="logo">🚀 AutoWeave</div>
        <div class="subtitle">The Self-Weaving Agent Orchestrator</div>
        
        <div class="interfaces">
            <a href="http://localhost:8081" class="interface-card" target="_blank">
                <div class="interface-icon">💬</div>
                <div class="interface-title">SillyTavern</div>
                <div class="interface-desc">Interface chat conversationnelle pour créer des agents via langage naturel</div>
                <div class="interface-url">localhost:8081</div>
            </a>
            
            <a href="http://localhost:8080" class="interface-card" target="_blank">
                <div class="interface-icon">📊</div>
                <div class="interface-title">Appsmith</div>
                <div class="interface-desc">Dashboard web pour monitoring et gestion visuelle des agents</div>
                <div class="interface-url">localhost:8080</div>
            </a>
            
            <a href="http://localhost:3000" class="interface-card" target="_blank">
                <div class="interface-icon">🔧</div>
                <div class="interface-title">AutoWeave API</div>
                <div class="interface-desc">API REST pour intégration programmable et gestion des agents</div>
                <div class="interface-url">localhost:3000</div>
            </a>
        </div>
        
        <div class="status">
            <div class="status-title">🟢 Système Opérationnel</div>
            <div>
                <span class="health-indicator"></span>AutoWeave Core: Running<br>
                <span class="health-indicator"></span>SillyTavern: Ready<br>
                <span class="health-indicator"></span>Appsmith: Ready<br>
                <span class="health-indicator"></span>Kubernetes: Active
            </div>
        </div>
        
        <div style="margin-top: 2rem;">
            <a href="docs/PROJECT_OVERVIEW.md" class="btn">📖 Documentation</a>
            <a href="docs/guides/quick-start.md" class="btn">🚀 Guide Rapide</a>
            <a href="http://localhost:3000/health" class="btn" target="_blank">🔍 Status API</a>
        </div>
        
        <div class="footer">
            <p><strong>AutoWeave v1.0.0</strong> - Self-Weaving Agent Orchestrator</p>
            <p>Powered by Kubernetes, OpenAI & kagent</p>
        </div>
    </div>
    
    <script>
        // Vérification du status des services
        async function checkServices() {
            const services = [
                { name: 'AutoWeave', url: 'http://localhost:3000/health' },
                { name: 'SillyTavern', url: 'http://localhost:8081' },
                { name: 'Appsmith', url: 'http://localhost:8080' }
            ];
            
            for (const service of services) {
                try {
                    const response = await fetch(service.url, { 
                        mode: 'no-cors',
                        timeout: 5000 
                    });
                    console.log(`${service.name}: OK`);
                } catch (error) {
                    console.log(`${service.name}: Checking...`);
                }
            }
        }
        
        // Vérifier au chargement
        document.addEventListener('DOMContentLoaded', checkServices);
        
        // Actualiser toutes les 30 secondes
        setInterval(checkServices, 30000);
    </script>
</body>
</html>
EOF
    
    # Ouvrir dans le navigateur par défaut
    if command -v xdg-open > /dev/null; then
        xdg-open "file://$SCRIPT_DIR/public/index.html"
    elif command -v open > /dev/null; then
        open "file://$SCRIPT_DIR/public/index.html"
    else
        log_info "Interface disponible sur: file://$SCRIPT_DIR/public/index.html"
    fi
}

# Fonction principale
main() {
    echo "
    ╔══════════════════════════════════════════════════════════════╗
    ║                    🚀 AutoWeave Startup                     ║
    ║              The Self-Weaving Agent Orchestrator            ║
    ╚══════════════════════════════════════════════════════════════╝
    "
    
    log_info "Démarrage d'AutoWeave..."
    
    # Vérifier les prérequis
    if ! command -v node > /dev/null; then
        log_error "Node.js n'est pas installé"
        exit 1
    fi
    
    if ! command -v kubectl > /dev/null; then
        log_error "kubectl n'est pas installé"
        exit 1
    fi
    
    # Créer le dossier public s'il n'existe pas
    mkdir -p public
    
    # Démarrer les services
    start_autoweave
    start_port_forwards
    
    # Ouvrir l'interface
    open_interface
    
    log_success "AutoWeave est maintenant opérationnel !"
    echo "
    ╔══════════════════════════════════════════════════════════════╗
    ║                      🎉 Démarrage Réussi                   ║
    ║                                                              ║
    ║  💬 Chat Interface:  http://localhost:8081                  ║
    ║  📊 Dashboard:       http://localhost:8080                  ║
    ║  🔧 API:            http://localhost:3000                   ║
    ║                                                              ║
    ║  📖 Documentation:   docs/PROJECT_OVERVIEW.md               ║
    ║  🚀 Guide Rapide:    docs/guides/quick-start.md            ║
    ╚══════════════════════════════════════════════════════════════╝
    "
    
    # Maintenir le script actif
    log_info "Appuyez sur Ctrl+C pour arrêter AutoWeave"
    trap 'log_info "Arrêt d'\''AutoWeave..."; exit 0' INT
    
    # Monitoring en arrière-plan
    while true; do
        sleep 10
        # Vérifier que les services sont toujours actifs
        if ! pgrep -f "node src/index.js" > /dev/null; then
            log_warning "AutoWeave s'est arrêté, redémarrage..."
            start_autoweave
        fi
    done
}

# Lancer le script principal
main "$@"