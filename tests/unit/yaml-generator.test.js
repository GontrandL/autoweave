const { KagentYAMLGenerator } = require('../../src/kagent/yaml-generator');

describe('KagentYAMLGenerator', () => {
    let generator;

    beforeEach(() => {
        generator = new KagentYAMLGenerator();
    });

    describe('generateFromWorkflow', () => {
        test('should generate valid kagent YAML structure', () => {
            const workflow = {
                id: 'test-123',
                name: 'test-agent',
                description: 'Test agent for unit testing',
                requiredModules: [
                    { name: 'file-reader', type: 'file_system', description: 'Read files' }
                ],
                steps: [
                    { action: 'read_file', description: 'Read and process file' }
                ],
                modelConfig: { name: 'gpt-4', temperature: 0.7 }
            };

            const result = generator.generateFromWorkflow(workflow);

            expect(result).toBeDefined();
            expect(result.agent).toBeDefined();
            expect(result.agent.apiVersion).toBe('kagent.dev/v1alpha1');
            expect(result.agent.kind).toBe('Agent');
            expect(result.agent.metadata.name).toBe('test-agent');
            expect(result.agent.metadata.labels['autoweave.dev/generated']).toBe('true');
        });

        test('should sanitize workflow name for Kubernetes', () => {
            const workflow = {
                id: 'test-123',
                name: 'Test Agent With Spaces!',
                description: 'Test agent',
                requiredModules: [{ name: 'test', type: 'test' }],
                steps: []
            };

            const result = generator.generateFromWorkflow(workflow);
            expect(result.agent.metadata.name).toBe('test-agent-with-spaces');
        });
    });

    describe('sanitizeName', () => {
        test('should sanitize names correctly', () => {
            expect(generator.sanitizeName('test-agent')).toBe('test-agent');
            expect(generator.sanitizeName('Test Agent!')).toBe('test-agent');
            expect(generator.sanitizeName('UPPERCASE')).toBe('uppercase');
            expect(generator.sanitizeName('multiple---dashes')).toBe('multiple-dashes');
            expect(generator.sanitizeName('-start-dash')).toBe('start-dash');
            expect(generator.sanitizeName('end-dash-')).toBe('end-dash');
        });
    });

    describe('mapWorkflowTools', () => {
        test('should map module types to appropriate tools', () => {
            const workflow = {
                requiredModules: [
                    { name: 'file-ops', type: 'file_system' },
                    { name: 'k8s-ops', type: 'kubernetes' },
                    { name: 'coding', type: 'coding_assistant' }
                ]
            };

            const tools = generator.mapWorkflowTools(workflow);

            expect(tools).toContain('file-reader');
            expect(tools).toContain('file-writer');
            expect(tools).toContain('kubectl');
            expect(tools).toContain('code-analyzer');
        });
    });
});