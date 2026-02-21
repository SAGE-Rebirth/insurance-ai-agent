// PM2 Ecosystem Config — for direct EC2 deployment without Docker
// Usage: pm2 start ecosystem.config.js --env production

module.exports = {
    apps: [
        {
            name: 'insurevoice-backend',
            script: 'server/dist/index.js',
            instances: 'max',       // Cluster mode — one process per CPU core
            exec_mode: 'cluster',
            watch: false,
            max_memory_restart: '512M',

            // Graceful restart settings
            kill_timeout: 10000,    // 10s to allow graceful shutdown
            wait_ready: true,
            listen_timeout: 10000,

            // Logging
            log_date_format: 'YYYY-MM-DD HH:mm:ss',
            error_file: './logs/err.log',
            out_file: './logs/out.log',
            merge_logs: true,
            log_type: 'json',

            env: {
                NODE_ENV: 'development',
            },
            env_production: {
                NODE_ENV: 'production',
                PORT: 5000,
            },
        },
    ],
};
