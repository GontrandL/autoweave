# Guide d'interface utilisateur AutoWeave dans Appsmith

## 🎯 Objectif
Créer une interface utilisateur complète pour AutoWeave dans Appsmith permettant la gestion des agents, la création via chat, et le monitoring.

## 📋 Configuration Appsmith

### 1. Accès à Appsmith
```bash
# Port-forward pour accéder à Appsmith
kubectl port-forward -n appsmith-system svc/appsmith 8080:80

# Accéder à http://localhost:8080
```

### 2. API Datasource Configuration
**Nom**: AutoWeave API
**URL**: http://host.docker.internal:3000
**Headers**:
```json
{
  "Content-Type": "application/json",
  "Accept": "application/json"
}
```

## 🏗️ Structure de l'interface

### Page 1: Dashboard Principal
**Layout**: 3 colonnes
- **Colonne 1**: Statistiques et statut
- **Colonne 2**: Liste des agents actifs  
- **Colonne 3**: Actions rapides

#### Composants Dashboard:
1. **Widget Statut AutoWeave**
   - API: `GET /health`
   - Affichage: Status, timestamp, composants
   
2. **Widget Métriques**
   - Nombre total d'agents
   - Agents en fonctionnement
   - Dernière activité

3. **Liste des Agents**
   - API: `GET /api/agents`
   - Tableau avec colonnes: Nom, Status, Description, Actions
   - Boutons: Voir détails, Supprimer

### Page 2: Chat Interface
**Layout**: Interface de chat fullscreen

#### Composants Chat:
1. **Zone de Chat**
   - Input text pour messages
   - Historique des conversations
   - API: `POST /api/chat`

2. **Panel latéral Agents**
   - Liste des agents créés via chat
   - Bouton "Refresh"

### Page 3: Création d'Agent
**Layout**: Formulaire structuré

#### Composants Création:
1. **Formulaire Agent**
   - Champ: Description de l'agent
   - Sélecteur: Type d'agent (monitoring, coding, etc.)
   - Bouton: Créer Agent
   - API: `POST /api/agents`

2. **Prévisualisation**
   - Affichage du workflow généré
   - Validation avant déploiement

## 🔧 APIs AutoWeave pour Appsmith

### 1. Health Check
```javascript
// Query: checkHealth
{
  method: "GET",
  url: "/health"
}
```

### 2. List Agents
```javascript
// Query: getAgents  
{
  method: "GET",
  url: "/api/agents"
}
```

### 3. Create Agent
```javascript
// Query: createAgent
{
  method: "POST", 
  url: "/api/agents",
  body: {
    description: "{{DescriptionInput.text}}"
  }
}
```

### 4. Chat with AutoWeave
```javascript
// Query: chatWithAutoWeave
{
  method: "POST",
  url: "/api/chat", 
  body: {
    messages: [
      {
        role: "user",
        content: "{{ChatInput.text}}"
      }
    ]
  }
}
```

### 5. Delete Agent
```javascript
// Query: deleteAgent
{
  method: "DELETE",
  url: "/api/agents/{{Table1.selectedRow.id}}"
}
```

## 🎨 Design Guidelines

### Couleurs
- **Primary**: #4CAF50 (Vert AutoWeave)
- **Secondary**: #2196F3 (Bleu)
- **Danger**: #f44336 (Rouge)
- **Background**: #1a1a1a (Sombre)
- **Text**: #ffffff (Blanc)

### Icônes
- 🤖 Agent
- 📊 Dashboard  
- 💬 Chat
- ⚙️ Settings
- 🔄 Refresh
- ❌ Delete
- ✅ Success

## 📱 Pages Structure

### Navigation Menu
```
🏠 Dashboard
💬 Chat Interface  
🤖 Create Agent
📊 Monitoring
⚙️ Settings
```

### Dashboard Widgets
```
┌─────────────────┬─────────────────┬─────────────────┐
│   System Status │   Active Agents │  Quick Actions  │
│                 │                 │                 │
│ ✅ AutoWeave OK │ agent-1: Running│ + Create Agent  │
│ ✅ OpenAI OK    │ agent-2: Running│ 💬 Open Chat    │
│ ⚠️ Kagent Dev   │ agent-3: Stopped│ 🔄 Refresh All  │
└─────────────────┴─────────────────┴─────────────────┘
```

## 🔄 Actions et Workflows

### Workflow 1: Créer un Agent
1. Aller à "Create Agent"
2. Remplir description
3. Cliquer "Create"
4. Voir confirmation
5. Redirection vers Dashboard

### Workflow 2: Chat avec AutoWeave
1. Aller à "Chat Interface"
2. Taper message
3. Envoyer via API
4. Afficher réponse
5. Historique sauvé

### Workflow 3: Monitoring des Agents
1. Dashboard auto-refresh toutes les 30s
2. Notifications si agent down
3. Métriques en temps réel

## 🚀 Étapes d'implémentation

### Phase 1: Setup Base
1. ✅ Configurer datasource AutoWeave API
2. ✅ Créer navigation principale
3. ✅ Page Dashboard basique

### Phase 2: Core Features  
1. ✅ Widget liste agents
2. ✅ Widget création agent
3. ✅ Interface chat

### Phase 3: Advanced Features
1. ✅ Monitoring temps réel
2. ✅ Notifications
3. ✅ Thème sombre

## 📝 Code Snippets

### Auto-refresh Agents
```javascript
// Dans onPageLoad
setInterval(() => {
  getAgents.run();
}, 30000);
```

### Chat Message Handler
```javascript
// Dans onSubmit du chat
if (ChatInput.text.trim()) {
  chatWithAutoWeave.run().then(() => {
    ChatInput.setValue("");
    getAgents.run(); // Refresh si agent créé
  });
}
```

### Status Color Logic
```javascript
// Pour le widget status
{{
  Health.data.status === "healthy" ? "#4CAF50" : "#f44336"
}}
```

Cette interface Appsmith permettra une gestion complète d'AutoWeave avec une UX moderne et intuitive ! 🎨