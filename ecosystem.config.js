module.exports = {
  apps: [
    {
      name: 'cruz-bot',
      script: 'scripts/telegram-bot.js',
      cwd: '/Users/' + require('os').userInfo().username + '/evco-portal',
      watch: false,
      autorestart: true,
      restart_delay: 5000,
      max_restarts: 10,
      env: {
        NODE_ENV: 'production'
      },
      error_file: '/tmp/cruz-bot-error.log',
      out_file: '/tmp/cruz-bot-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss'
    }
  ]
}
