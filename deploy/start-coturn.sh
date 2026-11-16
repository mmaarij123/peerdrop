#!/bin/sh
set -eu
umask 077

secret=$(cat /run/secrets/turn_shared_secret)
case "$secret" in
  ''|*[!a-fA-F0-9]*) echo 'TURN secret must contain exactly 64 hexadecimal characters' >&2; exit 1 ;;
esac
if [ "${#secret}" -ne 64 ]; then
  echo 'TURN secret must contain exactly 64 hexadecimal characters' >&2
  exit 1
fi

printf 'static-auth-secret=%s\n' "$secret" > /tmp/peerdrop-turn.conf
unset secret
exec turnserver -c /tmp/peerdrop-turn.conf "$@"
