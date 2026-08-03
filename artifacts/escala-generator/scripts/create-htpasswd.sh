#!/usr/bin/env sh
set -eu

if [ "$#" -ne 2 ]; then
  echo "Usage: $0 /path/to/.htpasswd username" >&2
  exit 2
fi

HTPASSWD_FILE=$1
USERNAME=$2

case "$USERNAME" in
  ""|*:*)
    echo "Invalid username. Use a non-empty value without ':' or new lines." >&2
    exit 2
    ;;
esac

if [ "$(printf '%s' "$USERNAME" | wc -l)" -ne 0 ]; then
  echo "Invalid username. Use a non-empty value without ':' or new lines." >&2
  exit 2
fi

if ! command -v htpasswd >/dev/null 2>&1; then
  echo "htpasswd was not found. Install apache2-utils first." >&2
  exit 127
fi

umask 077
mkdir -p "$(dirname "$HTPASSWD_FILE")"

if [ -f "$HTPASSWD_FILE" ]; then
  htpasswd -B "$HTPASSWD_FILE" "$USERNAME"
else
  htpasswd -B -c "$HTPASSWD_FILE" "$USERNAME"
fi

chmod 600 "$HTPASSWD_FILE"
