#!/bin/sh
# Génère config.js à partir de la variable d'environnement API_URL
# (injectée par compose/dashboard.yml) juste avant de démarrer nginx.
# C'est ce qui permet à la même image de pointer vers des API différentes
# selon l'environnement (onprem, azure, ovh) sans rebuild.
set -eu

cat > /usr/share/nginx/html/config.js << EOF
window.APP_CONFIG = {
  API_URL: "${API_URL:-}"
};
EOF

exec nginx -g "daemon off;"
