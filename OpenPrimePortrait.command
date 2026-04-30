#!/bin/zsh
set -e

APP_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$APP_DIR"

echo "PrimePortrait Maker"
echo "Project: $APP_DIR"
echo

if ! command -v npm >/dev/null 2>&1; then
  echo "npm was not found. Install Node.js first, then run this file again."
  echo "https://nodejs.org/"
  read -k 1 "?Press any key to close..."
  exit 1
fi

if [ ! -d "node_modules" ]; then
  echo "Installing dependencies..."
  npm install
  echo
fi

echo "Building production app..."
npm run build
echo

URL="http://localhost:3000"
echo "Starting PrimePortrait Maker in production mode at $URL"
echo "Leave this Terminal window open while using the app."
echo "Press Control-C here to stop the server."
echo

(sleep 2 && open "$URL") >/dev/null 2>&1 &
npm run start
