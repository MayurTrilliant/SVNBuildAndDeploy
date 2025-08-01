const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const moment = require('moment');

class HistoryService {
    constructor() {
        this.dbPath = process.env.DB_PATH || './build_history.db';
        this.db = null;
        this.init();
    }

    /**
     * Initialize database connection and create tables
     */
    async init() {
        try {
            this.db = new sqlite3.Database(this.dbPath);
            await this.createTables();
            console.log('History database initialized successfully');
        } catch (error) {
            console.error('Error initializing history database:', error);
        }
    }

    /**
     * Create database tables if they don't exist
     */
    async createTables() {
        return new Promise((resolve, reject) => {
            const createBuildsTable = `
                CREATE TABLE IF NOT EXISTS builds (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    build_id TEXT UNIQUE NOT NULL,
                    started_at DATETIME NOT NULL,
                    completed_at DATETIME,
                    status TEXT NOT NULL,
                    project_type TEXT,
                    svn_revision TEXT,
                    svn_info TEXT,
                    build_logs TEXT,
                    deploy_logs TEXT,
                    error_message TEXT,
                    duration INTEGER,
                    triggered_by TEXT,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            `;

            const createBuildStepsTable = `
                CREATE TABLE IF NOT EXISTS build_steps (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    build_id TEXT NOT NULL,
                    step_name TEXT NOT NULL,
                    status TEXT NOT NULL,
                    started_at DATETIME NOT NULL,
                    completed_at DATETIME,
                    logs TEXT,
                    error_message TEXT,
                    duration INTEGER,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (build_id) REFERENCES builds (build_id)
                )
            `;

            this.db.serialize(() => {
                this.db.run(createBuildsTable, (err) => {
                    if (err) {
                        console.error('Error creating builds table:', err);
                        reject(err);
                        return;
                    }
                });

                this.db.run(createBuildStepsTable, (err) => {
                    if (err) {
                        console.error('Error creating build_steps table:', err);
                        reject(err);
                        return;
                    }
                    resolve();
                });
            });
        });
    }

    /**
     * Start a new build record
     * @param {string} buildId - Unique build identifier
     * @param {string} triggeredBy - User who triggered the build
     * @param {Object} svnInfo - SVN information
     * @returns {Promise<Object>} - Result
     */
    async startBuild(buildId, triggeredBy, svnInfo = {}) {
        return new Promise((resolve, reject) => {
            const query = `
                INSERT INTO builds (
                    build_id, started_at, status, svn_revision, 
                    svn_info, triggered_by
                ) VALUES (?, ?, ?, ?, ?, ?)
            `;

            const values = [
                buildId,
                new Date().toISOString(),
                'started',
                svnInfo.revision || null,
                JSON.stringify(svnInfo),
                triggeredBy
            ];

            this.db.run(query, values, function(err) {
                if (err) {
                    console.error('Error starting build record:', err);
                    reject(err);
                } else {
                    console.log(`Build record started for ${buildId}`);
                    resolve({ success: true, id: this.lastID });
                }
            });
        });
    }

    /**
     * Update build with completion information
     * @param {string} buildId - Build identifier
     * @param {Object} buildResult - Build result
     * @param {Object} deployResult - Deploy result
     * @returns {Promise<Object>} - Result
     */
    async completeBuild(buildId, buildResult, deployResult) {
        return new Promise((resolve, reject) => {
            const status = buildResult.success && deployResult.success ? 'completed' : 'failed';
            const errorMessage = buildResult.error || deployResult.error || null;
            const totalDuration = (buildResult.duration || 0) + (deployResult.duration || 0);

            const query = `
                UPDATE builds SET
                    completed_at = ?,
                    status = ?,
                    project_type = ?,
                    build_logs = ?,
                    deploy_logs = ?,
                    error_message = ?,
                    duration = ?
                WHERE build_id = ?
            `;

            const values = [
                new Date().toISOString(),
                status,
                buildResult.projectType || null,
                JSON.stringify(buildResult.logs || []),
                JSON.stringify(deployResult.logs || []),
                errorMessage,
                totalDuration,
                buildId
            ];

            this.db.run(query, values, function(err) {
                if (err) {
                    console.error('Error completing build record:', err);
                    reject(err);
                } else {
                    console.log(`Build record completed for ${buildId}`);
                    resolve({ success: true, changes: this.changes });
                }
            });
        });
    }

    /**
     * Record a build step
     * @param {string} buildId - Build identifier
     * @param {string} stepName - Name of the step
     * @param {string} status - Step status
     * @param {Object} stepData - Additional step data
     * @returns {Promise<Object>} - Result
     */
    async recordBuildStep(buildId, stepName, status, stepData = {}) {
        return new Promise((resolve, reject) => {
            const query = `
                INSERT INTO build_steps (
                    build_id, step_name, status, started_at, completed_at,
                    logs, error_message, duration
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `;

            const values = [
                buildId,
                stepName,
                status,
                stepData.startTime ? stepData.startTime.toISOString() : new Date().toISOString(),
                stepData.endTime ? stepData.endTime.toISOString() : new Date().toISOString(),
                JSON.stringify(stepData.logs || []),
                stepData.error || null,
                stepData.duration || 0
            ];

            this.db.run(query, values, function(err) {
                if (err) {
                    console.error('Error recording build step:', err);
                    reject(err);
                } else {
                    resolve({ success: true, id: this.lastID });
                }
            });
        });
    }

    /**
     * Get build history with pagination
     * @param {number} page - Page number (1-based)
     * @param {number} limit - Number of records per page
     * @param {string} status - Filter by status (optional)
     * @returns {Promise<Object>} - Build history
     */
    async getBuildHistory(page = 1, limit = 20, status = null) {
        return new Promise((resolve, reject) => {
            const offset = (page - 1) * limit;
            let query = `
                SELECT * FROM builds 
            `;
            let countQuery = `SELECT COUNT(*) as total FROM builds`;
            let params = [];

            if (status) {
                query += ` WHERE status = ?`;
                countQuery += ` WHERE status = ?`;
                params.push(status);
            }

            query += ` ORDER BY started_at DESC LIMIT ? OFFSET ?`;
            params.push(limit, offset);

            // Get total count first
            this.db.get(countQuery, status ? [status] : [], (err, countResult) => {
                if (err) {
                    console.error('Error getting build count:', err);
                    reject(err);
                    return;
                }

                // Get builds
                this.db.all(query, params, (err, rows) => {
                    if (err) {
                        console.error('Error getting build history:', err);
                        reject(err);
                    } else {
                        // Parse JSON fields
                        const builds = rows.map(row => ({
                            ...row,
                            svn_info: this.safeJsonParse(row.svn_info),
                            build_logs: this.safeJsonParse(row.build_logs),
                            deploy_logs: this.safeJsonParse(row.deploy_logs),
                            started_at_formatted: moment(row.started_at).format('YYYY-MM-DD HH:mm:ss'),
                            completed_at_formatted: row.completed_at ? moment(row.completed_at).format('YYYY-MM-DD HH:mm:ss') : null,
                            duration_formatted: this.formatDuration(row.duration)
                        }));

                        resolve({
                            builds: builds,
                            pagination: {
                                page: page,
                                limit: limit,
                                total: countResult.total,
                                totalPages: Math.ceil(countResult.total / limit)
                            }
                        });
                    }
                });
            });
        });
    }

    /**
     * Get specific build details including steps
     * @param {string} buildId - Build identifier
     * @returns {Promise<Object>} - Build details
     */
    async getBuildDetails(buildId) {
        return new Promise((resolve, reject) => {
            // Get build info
            const buildQuery = `SELECT * FROM builds WHERE build_id = ?`;
            
            this.db.get(buildQuery, [buildId], (err, buildRow) => {
                if (err) {
                    console.error('Error getting build details:', err);
                    reject(err);
                    return;
                }

                if (!buildRow) {
                    resolve({ build: null, steps: [] });
                    return;
                }

                // Get build steps
                const stepsQuery = `SELECT * FROM build_steps WHERE build_id = ? ORDER BY started_at ASC`;
                
                this.db.all(stepsQuery, [buildId], (err, stepRows) => {
                    if (err) {
                        console.error('Error getting build steps:', err);
                        reject(err);
                        return;
                    }

                    // Parse JSON fields
                    const build = {
                        ...buildRow,
                        svn_info: this.safeJsonParse(buildRow.svn_info),
                        build_logs: this.safeJsonParse(buildRow.build_logs),
                        deploy_logs: this.safeJsonParse(buildRow.deploy_logs),
                        started_at_formatted: moment(buildRow.started_at).format('YYYY-MM-DD HH:mm:ss'),
                        completed_at_formatted: buildRow.completed_at ? moment(buildRow.completed_at).format('YYYY-MM-DD HH:mm:ss') : null,
                        duration_formatted: this.formatDuration(buildRow.duration)
                    };

                    const steps = stepRows.map(row => ({
                        ...row,
                        logs: this.safeJsonParse(row.logs),
                        started_at_formatted: moment(row.started_at).format('YYYY-MM-DD HH:mm:ss'),
                        completed_at_formatted: row.completed_at ? moment(row.completed_at).format('YYYY-MM-DD HH:mm:ss') : null,
                        duration_formatted: this.formatDuration(row.duration)
                    }));

                    resolve({ build: build, steps: steps });
                });
            });
        });
    }

    /**
     * Get build statistics
     * @returns {Promise<Object>} - Build statistics
     */
    async getBuildStats() {
        return new Promise((resolve, reject) => {
            const queries = {
                total: `SELECT COUNT(*) as count FROM builds`,
                completed: `SELECT COUNT(*) as count FROM builds WHERE status = 'completed'`,
                failed: `SELECT COUNT(*) as count FROM builds WHERE status = 'failed'`,
                running: `SELECT COUNT(*) as count FROM builds WHERE status = 'started'`,
                avgDuration: `SELECT AVG(duration) as avg_duration FROM builds WHERE status = 'completed' AND duration IS NOT NULL`
            };

            const stats = {};
            let completed = 0;
            const total = Object.keys(queries).length;

            Object.entries(queries).forEach(([key, query]) => {
                this.db.get(query, [], (err, result) => {
                    if (err) {
                        console.error(`Error getting ${key} stats:`, err);
                        stats[key] = 0;
                    } else {
                        stats[key] = key === 'avgDuration' ? result.avg_duration || 0 : result.count || 0;
                    }

                    completed++;
                    if (completed === total) {
                        stats.avgDurationFormatted = this.formatDuration(stats.avgDuration);
                        resolve(stats);
                    }
                });
            });
        });
    }

    /**
     * Safely parse JSON string
     * @param {string} jsonString - JSON string to parse
     * @returns {Object|Array|null} - Parsed object or null
     */
    safeJsonParse(jsonString) {
        try {
            return jsonString ? JSON.parse(jsonString) : null;
        } catch (error) {
            return null;
        }
    }

    /**
     * Format duration in milliseconds to human readable format
     * @param {number} duration - Duration in milliseconds
     * @returns {string} - Formatted duration
     */
    formatDuration(duration) {
        if (!duration || duration === 0) return '0s';
        
        const seconds = Math.floor(duration / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);

        if (hours > 0) {
            return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
        } else if (minutes > 0) {
            return `${minutes}m ${seconds % 60}s`;
        } else {
            return `${seconds}s`;
        }
    }

    /**
     * Close database connection
     */
    close() {
        if (this.db) {
            this.db.close((err) => {
                if (err) {
                    console.error('Error closing database:', err);
                } else {
                    console.log('Database connection closed');
                }
            });
        }
    }
}

module.exports = HistoryService;