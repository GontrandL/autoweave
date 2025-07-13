#!/usr/bin/env python3
"""
Test du Système de Déduplication Intelligent
============================================
"""

import os
import sys
from pathlib import Path

# Ajouter le chemin du projet
project_root = Path(__file__).parent.parent
sys.path.append(str(project_root / 'scripts'))

from intelligent_deduplication import IntelligentDeduplicator

def test_deduplication_intelligence():
    """Tester l'intelligence de déduplication"""
    
    dedup = IntelligentDeduplicator(str(project_root))
    
    # Test 1: Deux fonctions identiques
    print("🧪 Test 1: Détection de doublons exacts...")
    
    gene1 = {
        'name': 'calculateSum',
        'type': 'function',
        'content': """
        function calculateSum(a, b) {
            return a + b;
        }
        """
    }
    
    gene2 = {
        'name': 'calculateSum',
        'type': 'function', 
        'content': """
        function calculateSum(a, b) {
            return a + b;
        }
        """
    }
    
    is_dup1, rep_id1 = dedup.is_duplicate(gene1)
    result1 = dedup.register_gene(gene1, "GENE-001", "file1.js")
    
    is_dup2, rep_id2 = dedup.is_duplicate(gene2)
    result2 = dedup.register_gene(gene2, "GENE-002", "file2.js")
    
    print(f"   Premier gène: Doublon={is_dup1}, Action={result1['action']}")
    print(f"   Deuxième gène: Doublon={is_dup2}, ID représentant={rep_id2}")
    
    # Test 2: Fonctions similaires mais différentes
    print("\n🧪 Test 2: Détection de mutations vs doublons...")
    
    gene3 = {
        'name': 'calculateSum',
        'type': 'function',
        'content': """
        function calculateSum(a, b, c = 0) {
            return a + b + c;
        }
        """
    }
    
    is_dup3, rep_id3 = dedup.is_duplicate(gene3)
    mutation_analysis = dedup.detect_mutations(gene1, gene3)
    
    print(f"   Fonction modifiée: Doublon={is_dup3}")
    print(f"   Type de changement: {mutation_analysis['type']}")
    print(f"   Similarité: {mutation_analysis.get('similarity', 0):.2f}")
    
    # Test 3: Génération du rapport
    print("\n📊 Rapport de déduplication:")
    report = dedup.get_duplication_report()
    
    for key, value in report['summary'].items():
        print(f"   {key}: {value}")
    
    print("\n💡 Recommandations:")
    for rec in report['recommendation']:
        print(f"   {rec}")
    
    return report

def create_test_files_and_test():
    """Créer des fichiers de test et tester la déduplication en action"""
    
    print("\n🔬 Test avec de vrais fichiers...")
    
    # Créer des fichiers de test avec du code dupliqué
    test_dir = project_root / "test_dedup"
    test_dir.mkdir(exist_ok=True)
    
    # Fichier 1 - fonction originale
    (test_dir / "util1.js").write_text("""
// Utility functions
function formatDate(date) {
    return date.toISOString().split('T')[0];
}

function parseJSON(str) {
    try {
        return JSON.parse(str);
    } catch (e) {
        return null;
    }
}
""")
    
    # Fichier 2 - même fonction dupliquée
    (test_dir / "util2.js").write_text("""
// Duplicate utilities
function formatDate(date) {
    return date.toISOString().split('T')[0];
}

function validateEmail(email) {
    return email.includes('@');
}
""")
    
    # Fichier 3 - fonction légèrement modifiée
    (test_dir / "util3.js").write_text("""
// Modified utilities  
function formatDate(date, includeTime = false) {
    if (includeTime) {
        return date.toISOString();
    }
    return date.toISOString().split('T')[0];
}
""")
    
    print(f"   Créé {len(list(test_dir.glob('*.js')))} fichiers de test")
    
    # Test avec le hook génétique
    print("   Test de détection automatique en cours...")
    
    # Simuler le traitement par le hook
    from genetic_pre_tool_use import GeneticCodeTracker
    
    try:
        tracker = GeneticCodeTracker()
        if hasattr(tracker, 'deduplicator') and tracker.deduplicator:
            print("   ✅ Hook génétique avec déduplication initialisé")
            
            # Analyser un fichier
            genes = tracker.extract_genes(str(test_dir / "util1.js"))
            print(f"   Trouvé {len(genes)} gènes dans util1.js")
            
            for gene in genes:
                print(f"      - {gene['name']} ({gene['type']})")
        else:
            print("   ⚠️ Déduplicateur non initialisé dans le hook")
    except Exception as e:
        print(f"   ❌ Erreur hook: {e}")
    
    # Nettoyer
    import shutil
    shutil.rmtree(test_dir)
    print("   Fichiers de test nettoyés")

if __name__ == "__main__":
    print("🧬 Test du Système de Déduplication Intelligent AutoWeave")
    print("=" * 60)
    
    try:
        # Test de base
        report = test_deduplication_intelligence()
        
        # Test avec fichiers réels
        create_test_files_and_test()
        
        print("\n✅ Tous les tests de déduplication terminés avec succès!")
        
        # Afficher les statistiques finales
        if report['summary']['efficiency_percentage'] > 90:
            print(f"🎉 Excellente efficacité: {report['summary']['efficiency_percentage']:.1f}%")
        else:
            print(f"⚠️ Efficacité à améliorer: {report['summary']['efficiency_percentage']:.1f}%")
            
    except Exception as e:
        print(f"❌ Erreur lors des tests: {e}")
        sys.exit(1)