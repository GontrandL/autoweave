const path = require('path');

describe('@autoweave/core', () => {
    test('package exports are defined', () => {
        // Test that the package can be required
        const corePath = path.join(__dirname, '../src/index.js');
        expect(() => require(corePath)).not.toThrow();
    });

    test('core components exist', () => {
        const fs = require('fs');
        const srcPath = path.join(__dirname, '../src');
        
        const expectedFiles = [
            'autoweave.js',
            'agent-weaver.js',
            'config-intelligence.js',
            'logger.js',
            'index.js'
        ];
        
        expectedFiles.forEach(file => {
            const filePath = path.join(srcPath, file);
            expect(fs.existsSync(filePath)).toBe(true);
        });
    });
});