/**
 * Test du détecteur d'environnement OS
 */

const OSEnvironmentDetector = require('./src/utils/os-environment-detector');

async function testOSDetection() {
    console.log('🔍 Testing OS Environment Detection...');
    
    const detector = new OSEnvironmentDetector();
    
    try {
        const environment = await detector.detectComplete();
        
        console.log('\n📊 Environment Detection Results:');
        console.log('================================');
        
        // Basic info
        console.log(`\n🖥️ System: ${environment.basic.platform} ${environment.basic.arch}`);
        console.log(`📍 Distribution: ${environment.basic.distribution?.PRETTY_NAME || 'Unknown'}`);
        console.log(`👤 User: ${environment.permissions.currentUser} (UID: ${environment.permissions.uid})`);
        
        // Permissions
        console.log(`\n🔐 Permissions:`);
        console.log(`   - Is Root: ${environment.permissions.isRoot}`);
        console.log(`   - Can Sudo: ${environment.permissions.canSudo}`);
        console.log(`   - Is Sudoer: ${environment.permissions.isSudoer}`);
        console.log(`   - Can Su: ${environment.permissions.canSu}`);
        console.log(`   - Groups: ${environment.permissions.groups?.join(', ') || 'N/A'}`);
        
        if (environment.permissions.adminNote) {
            console.log(`   ⚠️  Note: ${environment.permissions.adminNote}`);
        }
        
        // Capabilities
        console.log(`\n🔧 Capabilities:`);
        console.log(`   - Package Managers: ${environment.capabilities.packageManagers?.length || 0}`);
        console.log(`   - Development Tools: ${environment.capabilities.development?.length || 0}`);
        console.log(`   - Container Tools: ${environment.capabilities.containerization?.length || 0}`);
        
        // Show some tools
        if (environment.capabilities.development?.length > 0) {
            console.log(`\n🛠️ Development Tools:`);
            environment.capabilities.development.slice(0, 5).forEach(tool => {
                console.log(`   - ${tool.name}: ${tool.version}`);
            });
        }
        
        // Network
        console.log(`\n🌐 Network:`);
        console.log(`   - Interfaces: ${Object.keys(environment.network?.interfaces || {}).length}`);
        console.log(`   - Listening Ports: ${environment.network?.ports?.listening?.length || 0}`);
        console.log(`   - DNS Servers: ${environment.network?.dns?.length || 0}`);
        
        // Storage
        console.log(`\n💾 Storage:`);
        console.log(`   - Filesystems: ${environment.storage?.filesystems?.length || 0}`);
        if (environment.storage?.filesystems?.length > 0) {
            const rootFs = environment.storage.filesystems.find(fs => fs.mountPoint === '/');
            if (rootFs) {
                console.log(`   - Root usage: ${rootFs.usePercent} (${rootFs.used}/${rootFs.size})`);
            }
        }
        
        // Generate documentation
        console.log('\n📝 Generating Claude Code environment documentation...');
        const docPath = await detector.saveEnvironmentDocumentation();
        console.log(`✅ Documentation saved to: ${docPath}`);
        
        return environment;
        
    } catch (error) {
        console.error('❌ OS detection failed:', error);
        throw error;
    }
}

// Run test
testOSDetection()
    .then(() => {
        console.log('\n🎉 OS detection test completed successfully!');
        process.exit(0);
    })
    .catch(error => {
        console.error('💥 Test failed:', error);
        process.exit(1);
    });