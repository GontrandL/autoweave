class ValidationError extends Error {
    constructor(message, field = null) {
        super(message);
        this.name = 'ValidationError';
        this.field = field;
    }
}

class Validator {
    static validateAgentDescription(description) {
        if (description === null || description === undefined) {
            throw new ValidationError('Description is required and must be a string', 'description');
        }

        if (typeof description !== 'string') {
            throw new ValidationError('Description is required and must be a string', 'description');
        }

        if (description.length < 20) {
            throw new ValidationError('Description must be at least 20 characters long', 'description');
        }

        if (description.length > 1000) {
            throw new ValidationError('Description must be less than 1000 characters', 'description');
        }

        return true;
    }

    static validateAgentName(name) {
        if (!name || typeof name !== 'string') {
            throw new ValidationError('Name is required and must be a string', 'name');
        }

        if (!/^[a-z0-9-]+$/.test(name)) {
            throw new ValidationError('Name must contain only lowercase letters, numbers, and hyphens', 'name');
        }

        if (name.length > 63) {
            throw new ValidationError('Name must be less than 63 characters (Kubernetes limit)', 'name');
        }

        return true;
    }

    static validateKubernetesName(name) {
        // Kubernetes resource name validation
        if (!/^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/.test(name)) {
            throw new ValidationError(
                'Invalid Kubernetes name. Must start and end with alphanumeric characters, may contain hyphens',
                'kubernetesName'
            );
        }
        return true;
    }
}

module.exports = { Validator, ValidationError };