#!/bin/bash

# Secure Git push script that reads token from .env file

if [ ! -f .env ]; then
    echo "Error: .env file not found"
    exit 1
fi

# Source the .env file
source .env

if [ -z "$GITHUB_TOKEN" ]; then
    echo "Error: GITHUB_TOKEN not found in .env file"
    exit 1
fi

# Set up git credential helper
export GIT_ASKPASS="./git-askpass.sh"

# Push to remote using the token
git push https://$GITHUB_TOKEN@github.com/FreesoSaiFared/generate-CDP-autoation.git main