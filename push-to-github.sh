#!/bin/bash

# This script will push your repository to GitHub
# You need to replace YOUR_PERSONAL_ACCESS_TOKEN with an actual GitHub personal access token
# You can generate one at: https://github.com/settings/tokens

# Replace this with your actual personal access token
TOKEN="YOUR_PERSONAL_ACCESS_TOKEN"

# Check if token has been replaced
if [ "$TOKEN" = "YOUR_PERSONAL_ACCESS_TOKEN" ]; then
    echo "Please edit this script and replace YOUR_PERSONAL_ACCESS_TOKEN with your actual GitHub personal access token."
    echo "You can generate one at: https://github.com/settings/tokens"
    exit 1
fi

# Set the remote URL with the token
git remote set-url origin https://FreesoSaiFared:${TOKEN}@github.com/FreesoSaiFared/generate-CDP-autoation.git

# Push to the repository
git push -u origin main

echo "Push completed successfully!"