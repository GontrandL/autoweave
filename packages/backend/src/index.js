/**
 * @autoweave/backend - API and service management
 */

import express from 'express';
import { Logger } from '@autoweave/shared';
import routes from './routes/index.js';

const logger = new Logger('Backend');

// Create Express app
const app = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Mount routes
app.use('/api', routes);

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', service: 'backend' });
});

// Error handling
app.use((err, req, res, next) => {
    logger.error('Unhandled error:', err);
    res.status(500).json({ error: 'Internal server error' });
});

// Export app for testing
export default app;

// Start server if run directly
if (import.meta.url === `file://${process.argv[1]}`) {
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
        logger.info(`Backend server listening on port ${PORT}`);
    });
}