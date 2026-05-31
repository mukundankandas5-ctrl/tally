/**
 * PM2 Ecosystem Config — Tally AI production server
 *
 * Usage (on the server at /home/ubuntu/tally-ai):
 *   pm2 start  tally-ecosystem.config.js   # first deploy
 *   pm2 reload tally-ecosystem.config.js   # zero-downtime restart after update
 *   pm2 stop   tally-ecosystem.config.js
 *   pm2 logs tally-ai                      # tail logs
 */

const REPO = '/home/ubuntu/tally-ai';

module.exports = {
  apps: [
    {
      name: 'tally-ai',
      script: 'node',
      args: 'src/index.js',
      cwd: `${REPO}/server`,
      interpreter: 'none',
      autorestart: true,
      watch: false,
      max_restarts: 5,
      min_uptime: '10s',
      restart_delay: 5000,
      env: {
        NODE_ENV: 'production',
        PORT: '4000',
      },
      out_file: `${REPO}/logs/tally_pm2_out.log`,
      error_file: `${REPO}/logs/tally_pm2_err.log`,
      merge_logs: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    },
  ],
};
