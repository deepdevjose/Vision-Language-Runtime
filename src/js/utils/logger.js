// @ts-check

/**
 * @typedef {'info' | 'warn' | 'error' | 'debug'} LogLevel
 * @typedef {Object} LogEntry
 * @property {LogLevel} level
 * @property {string} message
 * @property {string} timestamp
 * @property {Object} [context]
 */

/**
 * Advanced logging system with levels and export capability
 */
class Logger {
    constructor() {
        /** @type {LogEntry[]} */
        this.logs = [];
        this.maxLogs = 500; // Keep last 500 logs
        /** @type {LogLevel} */
        this.minLevel = 'info'; // Minimum level to log
        this.enabled = true;
    }

    /**
     * Set minimum log level
     * @param {LogLevel} level
     */
    setMinLevel(level) {
        this.minLevel = level;
    }

    /**
     * Enable or disable logging
     * @param {boolean} enabled
     */
    setEnabled(enabled) {
        this.enabled = enabled;
    }

    /**
     * Get level priority (for filtering)
     * @param {LogLevel} level
     * @returns {number}
     */
    getLevelPriority(level) {
        const priorities = { debug: 0, info: 1, warn: 2, error: 3 };
        return priorities[level] || 0;
    }

    /**
     * Check if should log based on level
     * @param {LogLevel} level
     * @returns {boolean}
     */
    shouldLog(level) {
        if (!this.enabled) return false;
        return this.getLevelPriority(level) >= this.getLevelPriority(this.minLevel);
    }

    /**
     * Add log entry
     * @param {LogLevel} level
     * @param {string} message
     * @param {Object} [context]
     */
    log(level, message, context) {
        if (!this.shouldLog(level)) return;

        const entry = {
            level,
            message,
            timestamp: new Date().toISOString(),
            ...(context && { context })
        };

        this.logs.push(entry);

        // Trim logs if exceeds max
        if (this.logs.length > this.maxLogs) {
            this.logs.shift();
        }

        // Console output with styling
        const styles = {
            debug: 'color: #888; font-weight: normal',
            info: 'color: #00a8ff; font-weight: bold',
            warn: 'color: #ffa500; font-weight: bold',
            error: 'color: #ff4444; font-weight: bold'
        };

        const prefix = {
            debug: '🔍',
            info: 'ℹ️',
            warn: '⚠️',
            error: '❌'
        };

        console[level === 'debug' ? 'log' : level](
            `%c${prefix[level]} [${level.toUpperCase()}] ${message}`,
            styles[level],
            context || ''
        );
    }

    /**
     * Log debug message
     * @param {string} message
     * @param {Object} [context]
     */
    debug(message, context) {
        this.log('debug', message, context);
    }

    /**
     * Log info message
     * @param {string} message
     * @param {Object} [context]
     */
    info(message, context) {
        this.log('info', message, context);
    }

    /**
     * Log warning message
     * @param {string} message
     * @param {Object} [context]
     */
    warn(message, context) {
        this.log('warn', message, context);
    }

    /**
     * Log error message
     * @param {string} message
     * @param {Object} [context]
     */
    error(message, context) {
        this.log('error', message, context);
    }

    /**
     * Get all logs
     * @param {LogLevel} [filterLevel] - Filter by minimum level
     * @returns {LogEntry[]}
     */
    getLogs(filterLevel) {
        if (!filterLevel) return [...this.logs];

        const minPriority = this.getLevelPriority(filterLevel);
        return this.logs.filter(log => 
            this.getLevelPriority(log.level) >= minPriority
        );
    }

    /**
     * Export logs as JSON
     * @param {LogLevel} [filterLevel]
     * @returns {string}
     */
    exportLogs(filterLevel) {
        const logs = this.getLogs(filterLevel);
        return JSON.stringify(logs, null, 2);
    }

    /**
     * Export logs as downloadable file
     * @param {LogLevel} [filterLevel]
     */
    downloadLogs(filterLevel) {
        const logsJson = this.exportLogs(filterLevel);
        const blob = new Blob([logsJson], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `vlm-runtime-logs-${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(url);
    }

    /**
     * Clear all logs
     */
    clear() {
        this.logs = [];
        console.clear();
        this.info('Logs cleared');
    }

    /**
     * Get log statistics
     * @returns {Object}
     */
    getStats() {
        const stats = {
            total: this.logs.length,
            debug: 0,
            info: 0,
            warn: 0,
            error: 0
        };

        this.logs.forEach(log => {
            stats[log.level]++;
        });

        return stats;
    }
}

// Export singleton instance
const logger = new Logger();
export default logger;
