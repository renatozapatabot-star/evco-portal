Run these diagnostics:
1. pm2 list — report status of all processes
2. pm2 logs globalpc-sync --lines 5 --nostream
3. pm2 logs email-intelligence --lines 5 --nostream
4. pm2 logs email-intake --lines 5 --nostream
5. curl -s https://evco-portal.vercel.app/api/health
6. Report: which processes are online, which stopped, any errors
