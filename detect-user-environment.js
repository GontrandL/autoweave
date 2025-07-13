/**
 * Script pour détecter l'environnement sous l'utilisateur gontrand
 */

const OSEnvironmentDetector = require('./src/utils/os-environment-detector');
const { spawn } = require('child_process');
const fs = require('fs').promises;
const path = require('path');

async function detectAsUser() {
    console.log('🔍 Detecting environment as user gontrand...');
    
    try {
        // Exécuter la détection en tant qu'utilisateur gontrand
        const result = await runAsUser('gontrand', [
            'node', 
            path.join(__dirname, 'test-os-detection.js')
        ]);
        
        console.log('📊 Detection as user gontrand:');
        console.log(result.stdout);
        
        if (result.stderr) {
            console.error('⚠️ Warnings:', result.stderr);
        }
        
        // Lire la documentation générée
        try {
            const userDoc = await fs.readFile('/home/gontrand/AutoWeave/OS_ENVIRONMENT_FOR_CLAUDE.md', 'utf-8');
            console.log('\n📄 User environment documentation created');
            
            // Extraire les informations importantes pour Claude
            const lines = userDoc.split('\n');
            const userLine = lines.find(l => l.includes('**Utilisateur actuel**:'));
            const sudoLine = lines.find(l => l.includes('**Peut utiliser sudo**:'));
            const suLine = lines.find(l => l.includes('**Peut utiliser su**:'));
            
            console.log('\n🔑 Key permissions for Claude Code:');
            if (userLine) console.log('   ', userLine);
            if (sudoLine) console.log('   ', sudoLine);
            if (suLine) console.log('   ', suLine);
            
        } catch (error) {
            console.error('Could not read user documentation:', error.message);
        }
        
        return result;
        
    } catch (error) {
        console.error('❌ Failed to detect as user:', error);
        throw error;
    }
}

function runAsUser(username, command) {
    return new Promise((resolve, reject) => {
        // Utiliser su pour basculer vers l'utilisateur
        const process = spawn('su', ['-', username, '-c', command.join(' ')], {
            stdio: ['pipe', 'pipe', 'pipe']
        });
        
        let stdout = '';
        let stderr = '';
        
        process.stdout.on('data', (data) => {
            stdout += data.toString();
        });
        
        process.stderr.on('data', (data) => {
            stderr += data.toString();
        });
        
        process.on('close', (code) => {
            resolve({
                code,
                stdout,
                stderr
            });
        });
        
        process.on('error', (error) => {
            reject(error);
        });
        
        // Timeout après 30 secondes
        setTimeout(() => {
            process.kill();
            reject(new Error('Command timeout'));
        }, 30000);
    });
}

async function compareEnvironments() {
    console.log('🔄 Comparing root vs user environments...');
    
    try {
        // Détection en tant que root (actuel)
        console.log('\n1️⃣ Current (root) environment:');
        const detector = new OSEnvironmentDetector();
        const rootEnv = await detector.detectComplete();
        
        console.log(`   User: ${rootEnv.permissions.currentUser}`);
        console.log(`   Is Root: ${rootEnv.permissions.isRoot}`);
        console.log(`   Can Sudo: ${rootEnv.permissions.canSudo}`);
        console.log(`   Can Su: ${rootEnv.permissions.canSu}`);
        
        // Sauvegarder en tant que root
        await fs.writeFile('root-environment.json', JSON.stringify(rootEnv, null, 2));
        
        // Détection en tant qu'utilisateur gontrand
        console.log('\n2️⃣ User gontrand environment:');
        await detectAsUser();
        
        console.log('\n📋 Environment comparison completed');
        console.log('📁 Root environment saved to: root-environment.json');
        console.log('📁 User environment saved to: OS_ENVIRONMENT_FOR_CLAUDE.md');
        
    } catch (error) {
        console.error('Comparison failed:', error);
    }
}

// Vérifier si on veut juste détecter en tant qu'utilisateur ou comparer
const action = process.argv[2];

if (action === 'user') {
    detectAsUser()
        .then(() => process.exit(0))
        .catch(() => process.exit(1));
} else if (action === 'compare') {
    compareEnvironments()
        .then(() => process.exit(0))
        .catch(() => process.exit(1));
} else {
    console.log('Usage:');
    console.log('  node detect-user-environment.js user     # Detect as user gontrand');
    console.log('  node detect-user-environment.js compare  # Compare root vs user');
    process.exit(1);
}