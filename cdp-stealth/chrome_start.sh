#!/bin/bash

# Chrome Stealth Launcher
# This script launches Chrome with anti-detection flags to bypass automation detection
#
# CRITICAL: These flags are specifically chosen to bypass Google's detection mechanisms
# Each flag serves a specific purpose in making the browser appear as a normal user session

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Create user data directory if it doesn't exist
USER_DATA_DIR="${SCRIPT_DIR}/chrome-user-data"
mkdir -p "$USER_DATA_DIR"

# Path to Chrome executable - adjust for your system
# Try common Chrome installations
if command -v google-chrome-stable &> /dev/null; then
    CHROME_CMD="google-chrome-stable"
elif command -v google-chrome &> /dev/null; then
    CHROME_CMD="google-chrome"
elif command -v chromium-browser &> /dev/null; then
    CHROME_CMD="chromium-browser"
elif command -v chromium &> /dev/null; then
    CHROME_CMD="chromium"
elif [[ -d "/Applications/Google Chrome.app/Contents/MacOS" ]]; then
    CHROME_CMD="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
elif [[ -d "/Applications/Chromium.app/Contents/MacOS" ]]; then
    CHROME_CMD="/Applications/Chromium.app/Contents/MacOS/Chromium"
else
    echo "Error: Chrome/Chromium not found. Please install Chrome or specify the path."
    exit 1
fi

# Load the CDP stealth extension
EXTENSION_PATH="${SCRIPT_DIR}/extensions/cdp-stealth"
if [[ ! -d "$EXTENSION_PATH" ]]; then
    echo "Warning: CDP stealth extension not found at $EXTENSION_PATH"
    echo "Please ensure the extension is properly installed."
fi

# CRITICAL FLAGS EXPLANATION:
# These flags are carefully selected to bypass detection mechanisms:
#
# 1. --disable-blink-features=AutomationControlled
#    Removes the navigator.webdriver property that is the #1 detection vector
#
# 2. --exclude-switches=enable-automation
#    Removes automation-related command line switches from navigator.plugins
#
# 3. --disable-automation
#    Disables Chrome's automation infrastructure that can be detected
#
# 4. --disable-ipc-flooding-protection
#    Prevents IPC flooding protection that can interfere with CDP communication
#
# 5. CRITICAL: NO --remote-debugging-port flag
#    Remote debugging ports are easily detected and blocked
#    We use extension-based communication instead
#
# 6. --user-data-dir
#    Creates isolated profile to avoid contamination with existing Chrome data
#
# 7. --no-first-run
#    Skips first-run setup pages that could interfere with automation
#
# 8. --no-default-browser-check
#    Prevents default browser check dialogs

# Build the Chrome command with stealth flags
CHROME_ARGS=(
    --user-data-dir="$USER_DATA_DIR"
    --disable-blink-features=AutomationControlled
    --exclude-switches=enable-automation
    --disable-automation
    --disable-ipc-flooding-protection
    --no-first-run
    --no-default-browser-check
    --disable-background-timer-throttling
    --disable-backgrounding-occluded-windows
    --disable-renderer-backgrounding
    --disable-features=TranslateUI
    --disable-ipc-flooding-protection
    --password-store=basic
    --use-mock-keychain
)

# Add extension if it exists
if [[ -d "$EXTENSION_PATH" ]]; then
    CHROME_ARGS+=(--load-extension="$EXTENSION_PATH")
fi

# Optional: Add proxy settings if environment variables are set
if [[ -n "$CHROME_PROXY" ]]; then
    CHROME_ARGS+=(--proxy-server="$CHROME_PROXY")
fi

# Optional: Add custom window size
if [[ -n "$CHROME_WINDOW_SIZE" ]]; then
    CHROME_ARGS+=(--window-size="$CHROME_WINDOW_SIZE")
else
    # Default to a common resolution
    CHROME_ARGS+=(--window-size=1366,768)
fi

# Optional: Add user agent if specified
if [[ -n "$CHROME_USER_AGENT" ]]; then
    CHROME_ARGS+=(--user-agent="$CHROME_USER_AGENT")
fi

# Launch Chrome with the stealth configuration
echo "Launching Chrome with stealth configuration..."
echo "User data directory: $USER_DATA_DIR"
echo "Chrome command: $CHROME_CMD"
echo "Arguments: ${CHROME_ARGS[*]}"

# Execute Chrome with all arguments
exec "$CHROME_CMD" "${CHROME_ARGS[@]}" "$@"