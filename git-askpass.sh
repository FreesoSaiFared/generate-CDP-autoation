#!/bin/bash
if [ "$1" = "Username for 'https://github.com':" ]; then
    echo "FreesoSaiFared"
else
    # Read token from .env file for security
    if [ -f .env ]; then
        source .env
        echo "$GITHUB_TOKEN"
    else
        echo "Error: .env file not found"
        exit 1
    fi
fi