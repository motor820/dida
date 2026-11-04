#!/usr/bin/env bash
set -euo pipefail
export XDG_RUNTIME_DIR="${XDG_RUNTIME_DIR:-/run/user/$(id -u)}"
export DBUS_SESSION_BUS_ADDRESS="${DBUS_SESSION_BUS_ADDRESS:-unix:path=$XDG_RUNTIME_DIR/bus}"
case "${1:-status}" in
 start) systemctl --user start dida-sync.service dida-legacy-web.service dida-sync-backup.timer ;;
 stop) systemctl --user stop dida-sync-backup.timer dida-sync-backup.service dida-legacy-web.service dida-sync.service ;;
 restart) systemctl --user restart dida-sync.service dida-legacy-web.service ;;
 status) systemctl --user status dida-sync.service dida-legacy-web.service dida-sync-backup.timer --no-pager ;;
 logs) journalctl --user -u dida-sync.service -u dida-legacy-web.service -u dida-sync-backup.service -n 100 --no-pager ;;
 backup) systemctl --user start dida-sync-backup.service ;;
 check)
  systemctl --user is-active dida-sync.service dida-legacy-web.service dida-sync-backup.timer
  curl --fail --silent --show-error --max-time 10 --retry 5 --retry-connrefused --retry-delay 1 --retry-max-time 15 http://127.0.0.1:1430/healthz
  curl --fail --silent --show-error --max-time 10 --retry 5 --retry-connrefused --retry-delay 1 --retry-max-time 15 -o /dev/null http://192.168.1.3:1420/dida-export.html
  ;;
 *) echo 'Usage: dida.sh {start|stop|restart|status|logs|backup|check}' >&2; exit 2 ;;
esac
