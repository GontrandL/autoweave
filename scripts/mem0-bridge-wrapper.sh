#!/bin/bash
# Wrapper pour mem0-bridge.py qui charge automatiquement l'environnement

# Charger les variables d'environnement depuis .env
if [ -f /home/gontrand/AutoWeave/.env ]; then
    export $(grep -v '^#' /home/gontrand/AutoWeave/.env | xargs)
fi

# Exécuter le script Python avec l'environnement virtuel
exec /home/gontrand/AutoWeave/venv/bin/python /home/gontrand/AutoWeave/scripts/mem0-bridge.py "$@"