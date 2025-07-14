class RetryHelper {
    static async withRetry(operation, options = {}) {
        const {
            maxAttempts = 3,
            delay = 1000,
            backoff = 2,
            shouldRetry = () => true
        } = options;

        let lastError;

        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
                return await operation();
            } catch (error) {
                lastError = error;

                if (attempt === maxAttempts || !shouldRetry(error)) {
                    throw error;
                }

                const waitTime = delay * Math.pow(backoff, attempt - 1);
                await new Promise(resolve => setTimeout(resolve, waitTime));
            }
        }

        throw lastError;
    }
}

module.exports = { RetryHelper };