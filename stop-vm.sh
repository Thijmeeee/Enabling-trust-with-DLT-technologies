#!/bin/bash

echo "🛑 Stopping Services..."
podman-compose -f deployment/compose.yaml down

if [[ "$*" == *"--remove-db"* ]]; then
    echo "🗑️ Removing Data and Logs..."
    # Remove volumes (project name usually defaults to the directory name)
    podman volume rm deployment_pg_data deployment_caddy_data deployment_caddy_config 2>/dev/null || true
    # Clear local logs
    rm -rf deployment/did-logs/*
    echo "✅ Database and logs removed."
fi

echo "✅ All services stopped."
