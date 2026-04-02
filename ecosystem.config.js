const cwd = '/Users/' + require('os').userInfo().username + '/evco-portal'

module.exports = {
  apps: [
    {
      name: 'email-intake',
      script: 'scripts/email-intake.js',
      cwd,
      cron_restart: '*/15 * * * *',
      autorestart: false,
      watch: false,
      env: { NODE_ENV: 'production' },
      error_file: '/tmp/email-intake-error.log',
      out_file: '/tmp/email-intake-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss'
    },
    {
      name: 'cruz-bot',
      script: 'scripts/telegram-bot.js',
      cwd,
      watch: false,
      autorestart: true,
      restart_delay: 5000,
      max_restarts: 10,
      env: { NODE_ENV: 'production' },
      error_file: '/tmp/cruz-bot-error.log',
      out_file: '/tmp/cruz-bot-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss'
    },
    {
      name: 'completeness-checker',
      script: 'scripts/completeness-checker.js',
      cwd,
      cron_restart: '0 6 * * *',
      autorestart: false,
      watch: false,
      env: { NODE_ENV: 'production' },
      error_file: '/tmp/completeness-checker-error.log',
      out_file: '/tmp/completeness-checker-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss'
    },
    {
      name: 'risk-scorer',
      script: 'scripts/risk-scorer.js',
      cwd,
      cron_restart: '0 */2 * * *',
      autorestart: false,
      watch: false,
      env: { NODE_ENV: 'production' },
      error_file: '/tmp/risk-scorer-error.log',
      out_file: '/tmp/risk-scorer-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss'
    },
    {
      name: 'pipeline-postmortem',
      script: 'scripts/pipeline-postmortem.js',
      cwd,
      cron_restart: '0 2 * * *',
      autorestart: false,
      watch: false,
      env: { NODE_ENV: 'production' },
      error_file: '/tmp/pipeline-postmortem-error.log',
      out_file: '/tmp/pipeline-postmortem-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss'
    },
    {
      name: 'doc-prerequest',
      script: 'scripts/doc-prerequest.js',
      cwd,
      cron_restart: '0 6 * * *',
      autorestart: false,
      watch: false,
      env: { NODE_ENV: 'production' },
      error_file: '/tmp/doc-prerequest-error.log',
      out_file: '/tmp/doc-prerequest-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss'
    },
    {
      name: 'feedback-loop',
      script: 'scripts/feedback-loop.js',
      cwd,
      cron_restart: '0 4 * * *',
      autorestart: false,
      watch: false,
      env: { NODE_ENV: 'production' },
      error_file: '/tmp/feedback-loop-error.log',
      out_file: '/tmp/feedback-loop-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss'
    },
    {
      name: 'risk-feed',
      script: 'scripts/risk-feed.js',
      cwd,
      cron_restart: '0 * * * *',
      autorestart: false,
      watch: false,
      env: { NODE_ENV: 'production' },
      error_file: '/tmp/risk-feed-error.log',
      out_file: '/tmp/risk-feed-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss'
    }
  ]
}
