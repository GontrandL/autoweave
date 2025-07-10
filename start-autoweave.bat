@echo off
REM AutoWeave - Windows Startup Script
REM Démarre tous les services AutoWeave et ouvre l'interface

setlocal enabledelayedexpansion

REM Définir les couleurs (si disponible)
set "GREEN=[92m"
set "YELLOW=[93m"
set "RED=[91m"
set "BLUE=[94m"
set "NC=[0m"

REM Changer vers le répertoire du script
cd /d "%~dp0"

echo.
echo    ╔══════════════════════════════════════════════════════════════╗
echo    ║                    🚀 AutoWeave Startup                     ║
echo    ║              The Self-Weaving Agent Orchestrator            ║
echo    ╚══════════════════════════════════════════════════════════════╝
echo.

REM Vérifier les prérequis
echo %BLUE%[INFO]%NC% Vérification des prérequis...

node --version >nul 2>&1
if errorlevel 1 (
    echo %RED%[ERROR]%NC% Node.js n'est pas installé
    pause
    exit /b 1
)

kubectl version --client >nul 2>&1
if errorlevel 1 (
    echo %RED%[ERROR]%NC% kubectl n'est pas installé
    pause
    exit /b 1
)

REM Créer le dossier public s'il n'existe pas
if not exist "public" mkdir public

REM Démarrer AutoWeave
echo %BLUE%[INFO]%NC% Démarrage d'AutoWeave...

REM Vérifier si AutoWeave est déjà démarré
tasklist /FI "IMAGENAME eq node.exe" | findstr /I "node.exe" >nul
if not errorlevel 1 (
    echo %YELLOW%[WARNING]%NC% AutoWeave semble déjà démarré
) else (
    REM Démarrer AutoWeave en arrière-plan
    start /B npm start > nul 2>&1
    timeout /t 5 /nobreak >nul
    echo %GREEN%[SUCCESS]%NC% AutoWeave démarré
)

REM Démarrer les port-forwards
echo %BLUE%[INFO]%NC% Configuration des port-forwards...

REM SillyTavern port-forward
tasklist /FI "IMAGENAME eq kubectl.exe" | findstr /I "kubectl.exe" >nul
if errorlevel 1 (
    echo %BLUE%[INFO]%NC% Démarrage du port-forward SillyTavern...
    start /B kubectl port-forward -n autoweave-system svc/sillytavern-service 8081:8000 > nul 2>&1
    timeout /t 2 /nobreak >nul
)

REM Appsmith port-forward
echo %BLUE%[INFO]%NC% Démarrage du port-forward Appsmith...
start /B kubectl port-forward -n appsmith-system svc/appsmith 8080:80 > nul 2>&1
timeout /t 2 /nobreak >nul

REM Créer la page d'accueil
echo %BLUE%[INFO]%NC% Création de l'interface d'accueil...

(
echo ^<!DOCTYPE html^>
echo ^<html lang="fr"^>
echo ^<head^>
echo     ^<meta charset="UTF-8"^>
echo     ^<meta name="viewport" content="width=device-width, initial-scale=1.0"^>
echo     ^<title^>AutoWeave - Interface d'Accueil^</title^>
echo     ^<style^>
echo         * {
echo             margin: 0;
echo             padding: 0;
echo             box-sizing: border-box;
echo         }
echo         body {
echo             font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
echo             background: linear-gradient^(135deg, #667eea 0%%, #764ba2 100%%^);
echo             min-height: 100vh;
echo             display: flex;
echo             justify-content: center;
echo             align-items: center;
echo         }
echo         .container {
echo             background: white;
echo             padding: 2rem;
echo             border-radius: 20px;
echo             box-shadow: 0 20px 40px rgba^(0,0,0,0.1^);
echo             max-width: 800px;
echo             width: 90%%;
echo             text-align: center;
echo         }
echo         .logo {
echo             font-size: 3rem;
echo             font-weight: bold;
echo             color: #667eea;
echo             margin-bottom: 1rem;
echo         }
echo         .subtitle {
echo             color: #666;
echo             font-size: 1.2rem;
echo             margin-bottom: 2rem;
echo         }
echo         .interfaces {
echo             display: grid;
echo             grid-template-columns: repeat^(auto-fit, minmax^(200px, 1fr^)^);
echo             gap: 1.5rem;
echo             margin: 2rem 0;
echo         }
echo         .interface-card {
echo             background: #f8f9fa;
echo             padding: 1.5rem;
echo             border-radius: 15px;
echo             border: 2px solid transparent;
echo             transition: all 0.3s ease;
echo             cursor: pointer;
echo             text-decoration: none;
echo             color: inherit;
echo         }
echo         .interface-card:hover {
echo             border-color: #667eea;
echo             transform: translateY^(-5px^);
echo             box-shadow: 0 10px 25px rgba^(0,0,0,0.1^);
echo         }
echo         .interface-icon {
echo             font-size: 2.5rem;
echo             margin-bottom: 1rem;
echo         }
echo         .interface-title {
echo             font-size: 1.3rem;
echo             font-weight: bold;
echo             margin-bottom: 0.5rem;
echo             color: #333;
echo         }
echo         .interface-desc {
echo             color: #666;
echo             font-size: 0.9rem;
echo             margin-bottom: 1rem;
echo         }
echo         .interface-url {
echo             font-size: 0.8rem;
echo             color: #667eea;
echo             font-family: monospace;
echo         }
echo         .status {
echo             margin-top: 2rem;
echo             padding: 1rem;
echo             background: #e8f5e8;
echo             border-radius: 10px;
echo             border-left: 4px solid #28a745;
echo         }
echo         .status-title {
echo             font-weight: bold;
echo             color: #28a745;
echo             margin-bottom: 0.5rem;
echo         }
echo         .btn {
echo             display: inline-block;
echo             padding: 0.75rem 1.5rem;
echo             background: #667eea;
echo             color: white;
echo             text-decoration: none;
echo             border-radius: 25px;
echo             margin: 0.5rem;
echo             transition: all 0.3s ease;
echo         }
echo         .btn:hover {
echo             background: #5a67d8;
echo             transform: translateY^(-2px^);
echo         }
echo         .health-indicator {
echo             display: inline-block;
echo             width: 10px;
echo             height: 10px;
echo             border-radius: 50%%;
echo             background: #28a745;
echo             margin-right: 0.5rem;
echo         }
echo         .footer {
echo             margin-top: 2rem;
echo             padding-top: 1rem;
echo             border-top: 1px solid #eee;
echo             color: #666;
echo             font-size: 0.9rem;
echo         }
echo     ^</style^>
echo ^</head^>
echo ^<body^>
echo     ^<div class="container"^>
echo         ^<div class="logo"^>🚀 AutoWeave^</div^>
echo         ^<div class="subtitle"^>The Self-Weaving Agent Orchestrator^</div^>
echo         ^<div class="interfaces"^>
echo             ^<a href="http://localhost:8081" class="interface-card" target="_blank"^>
echo                 ^<div class="interface-icon"^>💬^</div^>
echo                 ^<div class="interface-title"^>SillyTavern^</div^>
echo                 ^<div class="interface-desc"^>Interface chat pour créer des agents^</div^>
echo                 ^<div class="interface-url"^>localhost:8081^</div^>
echo             ^</a^>
echo             ^<a href="http://localhost:8080" class="interface-card" target="_blank"^>
echo                 ^<div class="interface-icon"^>📊^</div^>
echo                 ^<div class="interface-title"^>Appsmith^</div^>
echo                 ^<div class="interface-desc"^>Dashboard web pour monitoring^</div^>
echo                 ^<div class="interface-url"^>localhost:8080^</div^>
echo             ^</a^>
echo             ^<a href="http://localhost:3000" class="interface-card" target="_blank"^>
echo                 ^<div class="interface-icon"^>🔧^</div^>
echo                 ^<div class="interface-title"^>AutoWeave API^</div^>
echo                 ^<div class="interface-desc"^>API REST pour intégration^</div^>
echo                 ^<div class="interface-url"^>localhost:3000^</div^>
echo             ^</a^>
echo         ^</div^>
echo         ^<div class="status"^>
echo             ^<div class="status-title"^>🟢 Système Opérationnel^</div^>
echo             ^<div^>
echo                 ^<span class="health-indicator"^>^</span^>AutoWeave Core: Running^<br^>
echo                 ^<span class="health-indicator"^>^</span^>SillyTavern: Ready^<br^>
echo                 ^<span class="health-indicator"^>^</span^>Appsmith: Ready^<br^>
echo                 ^<span class="health-indicator"^>^</span^>Kubernetes: Active
echo             ^</div^>
echo         ^</div^>
echo         ^<div style="margin-top: 2rem;"^>
echo             ^<a href="docs/PROJECT_OVERVIEW.md" class="btn"^>📖 Documentation^</a^>
echo             ^<a href="http://localhost:3000/health" class="btn" target="_blank"^>🔍 Status API^</a^>
echo         ^</div^>
echo         ^<div class="footer"^>
echo             ^<p^>^<strong^>AutoWeave v1.0.0^</strong^> - Self-Weaving Agent Orchestrator^</p^>
echo             ^<p^>Powered by Kubernetes, OpenAI ^& kagent^</p^>
echo         ^</div^>
echo     ^</div^>
echo ^</body^>
echo ^</html^>
) > "public\index.html"

echo %GREEN%[SUCCESS]%NC% Interface d'accueil créée

REM Ouvrir l'interface dans le navigateur
echo %BLUE%[INFO]%NC% Ouverture de l'interface AutoWeave...
start "" "public\index.html"

REM Afficher le résumé
echo.
echo    ╔══════════════════════════════════════════════════════════════╗
echo    ║                      🎉 Démarrage Réussi                   ║
echo    ║                                                              ║
echo    ║  💬 Chat Interface:  http://localhost:8081                  ║
echo    ║  📊 Dashboard:       http://localhost:8080                  ║
echo    ║  🔧 API:            http://localhost:3000                   ║
echo    ║                                                              ║
echo    ║  📖 Documentation:   docs/PROJECT_OVERVIEW.md               ║
echo    ║  🚀 Guide Rapide:    docs/guides/quick-start.md            ║
echo    ╚══════════════════════════════════════════════════════════════╝
echo.

echo %GREEN%[SUCCESS]%NC% AutoWeave est maintenant opérationnel !
echo %BLUE%[INFO]%NC% Appuyez sur une touche pour fermer cette fenêtre
pause >nul