require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fs = require('fs-extra');

// Import routes
const authRoutes = require('./routes/authRoutes');
const { router: buildRoutes, buildController } = require('./routes/buildRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging middleware
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
    next();
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
    });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/build', buildRoutes);

// Root endpoint with API documentation
app.get('/', (req, res) => {
    res.json({
        name: 'SVN Build & Deploy Service',
        version: '1.0.0',
        description: 'Automated SVN code fetching, building, and deployment service',
        endpoints: {
            authentication: {
                'POST /api/auth/login': 'User login',
                'GET /api/auth/credentials': 'Get default credentials',
                'POST /api/auth/verify': 'Verify token',
                'GET /api/auth/user': 'Get current user (protected)',
                'POST /api/auth/logout': 'User logout (protected)'
            },
            build: {
                'GET /api/build/status': 'Get current build status',
                'GET /api/build/health': 'Health check',
                'GET /api/build/history': 'Get build history',
                'GET /api/build/stats': 'Get build statistics',
                'GET /api/build/details/:buildId': 'Get specific build details',
                'GET /api/build/config': 'Get system configuration',
                'GET /api/build/svn-info': 'Get SVN repository information',
                'POST /api/build/trigger': 'Trigger new build (protected)',
                'POST /api/build/cancel': 'Cancel active build (protected)'
            }
        },
        configuration: {
            svnUrl: process.env.SVN_URL,
            deployPath: process.env.DEPLOY_PATH,
            environment: process.env.NODE_ENV || 'development'
        },
        defaultCredentials: {
            username: process.env.DEFAULT_USERNAME || 'admin',
            password: process.env.DEFAULT_PASSWORD || 'admin123',
            note: 'Change these credentials in production!'
        }
    });
});

// 404 handler
app.use('*', (req, res) => {
    res.status(404).json({
        success: false,
        message: 'Endpoint not found',
        availableEndpoints: [
            'GET /',
            'POST /api/auth/login',
            'GET /api/auth/credentials',
            'GET /api/build/status',
            'GET /api/build/health',
            'POST /api/build/trigger (protected)',
            'GET /api/build/history',
            'GET /api/build/stats'
        ]
    });
});

// Graceful shutdown handling
const gracefulShutdown = async (signal) => {
    console.log(`\nReceived ${signal}. Starting graceful shutdown...`);
    
    try {
        // Close build controller services
        if (buildController) {
            await buildController.close();
        }
        
        console.log('All services closed successfully');
        process.exit(0);
    } catch (error) {
        console.error('Error during graceful shutdown:', error);
        process.exit(1);
    }
};

// Handle shutdown signals
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    gracefulShutdown('UNCAUGHT_EXCEPTION');
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    gracefulShutdown('UNHANDLED_REJECTION');
});

// Initialize server
async function startServer() {
    try {
        // Ensure required directories exist
        await fs.ensureDir(process.env.WORKING_DIR || './temp_workspace');
        
        // Start the server
        const server = app.listen(PORT, () => {
            console.log('\n' + '='.repeat(50));
            console.log('🚀 SVN Build & Deploy Service Started');
            console.log('='.repeat(50));
            console.log(`🌐 Server running on port: ${PORT}`);
            console.log(`📁 Working directory: ${process.env.WORKING_DIR || './temp_workspace'}`);
            console.log(`🔗 SVN URL: ${process.env.SVN_URL}`);
            console.log(`📂 Deploy path: ${process.env.DEPLOY_PATH}`);
            console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
            console.log('\n📖 API Documentation available at: http://localhost:' + PORT);
            console.log('🔐 Default credentials: ' + (process.env.DEFAULT_USERNAME || 'admin') + ' / ' + (process.env.DEFAULT_PASSWORD || 'admin123'));
            console.log('\n✅ Ready to accept build requests!');
            console.log('='.repeat(50) + '\n');
        });

        // Handle server errors
        server.on('error', (error) => {
            console.error('Server error:', error);
            if (error.code === 'EADDRINUSE') {
                console.error(`Port ${PORT} is already in use. Please use a different port.`);
            }
            process.exit(1);
        });

    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
}

// Start the server
startServer();

module.exports = app;