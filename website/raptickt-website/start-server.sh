#!/usr/bin/env bash
# Linux / macOS: ./start-server.sh   (needs PHP 7.4+)
cd "$(dirname "$0")"
command -v php >/dev/null || { echo "PHP not found. Install it (e.g. sudo apt install php-cli) and try again."; exit 1; }
(command -v xdg-open >/dev/null && xdg-open http://localhost:8000/ || command -v open >/dev/null && open http://localhost:8000/) >/dev/null 2>&1 &
php -S localhost:8000 router.php
