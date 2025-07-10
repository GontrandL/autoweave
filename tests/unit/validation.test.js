const { Validator, ValidationError } = require('../../src/utils/validation');

describe('Validator', () => {
    describe('validateAgentDescription', () => {
        test('should accept valid descriptions', () => {
            const validDescription = 'This is a valid agent description that is long enough';
            expect(() => Validator.validateAgentDescription(validDescription)).not.toThrow();
        });

        test('should reject null or undefined descriptions', () => {
            expect(() => Validator.validateAgentDescription(null)).toThrow(ValidationError);
            expect(() => Validator.validateAgentDescription(undefined)).toThrow(ValidationError);
        });

        test('should reject non-string descriptions', () => {
            expect(() => Validator.validateAgentDescription(123)).toThrow(ValidationError);
            expect(() => Validator.validateAgentDescription({})).toThrow(ValidationError);
        });

        test('should reject too short descriptions', () => {
            expect(() => Validator.validateAgentDescription('short')).toThrow(ValidationError);
        });

        test('should reject too long descriptions', () => {
            const longDescription = 'a'.repeat(1001);
            expect(() => Validator.validateAgentDescription(longDescription)).toThrow(ValidationError);
        });
    });

    describe('validateAgentName', () => {
        test('should accept valid names', () => {
            expect(() => Validator.validateAgentName('valid-agent-name')).not.toThrow();
            expect(() => Validator.validateAgentName('agent123')).not.toThrow();
        });

        test('should reject invalid names', () => {
            expect(() => Validator.validateAgentName('Invalid Name')).toThrow(ValidationError);
            expect(() => Validator.validateAgentName('invalid_name')).toThrow(ValidationError);
            expect(() => Validator.validateAgentName('invalid.name')).toThrow(ValidationError);
        });
    });

    describe('validateKubernetesName', () => {
        test('should accept valid Kubernetes names', () => {
            expect(() => Validator.validateKubernetesName('valid-name')).not.toThrow();
            expect(() => Validator.validateKubernetesName('valid123')).not.toThrow();
            expect(() => Validator.validateKubernetesName('a')).not.toThrow();
        });

        test('should reject invalid Kubernetes names', () => {
            expect(() => Validator.validateKubernetesName('-invalid')).toThrow(ValidationError);
            expect(() => Validator.validateKubernetesName('invalid-')).toThrow(ValidationError);
            expect(() => Validator.validateKubernetesName('Invalid')).toThrow(ValidationError);
        });
    });
});