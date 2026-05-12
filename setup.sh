#!/bin/bash
# Marveen - Bootstrap installer
# Usage:
#   curl -fsSL https://raw.githubusercontent.com/Szotasz/marveen/main/setup.sh | bash
#   wget -qO- https://raw.githubusercontent.com/Szotasz/marveen/main/setup.sh | bash
#   ./setup.sh   (if already inside the cloned repo)

set -e

BOLD='\033[1m'
DIM='\033[2m'
GREEN='\033[0;32m'
ORANGE='\033[0;33m'
RED='\033[0;31m'
NC='\033[0m'

ok()   { echo -e "  ${GREEN}✓${NC} $*"; }
warn() { echo -e "  ${ORANGE}!${NC} $*"; }
fail() { echo -e "  ${RED}✗${NC} $*"; exit 1; }

clear
echo ""
echo -e "${BOLD}  ▐▛███▜▌   Marveen${NC}"
echo -e "${BOLD} ▝▜█████▛▘  AI csapatod, ami fut amig te alszol.${NC}"
echo -e "${DIM}   ▘▘ ▝▝${NC}"
echo ""
echo -e "${DIM}  Bootstrap telepito - Linux (Ubuntu/Debian)${NC}"
echo ""

# ─────────────────────────────────────────────
# Platform check
# ─────────────────────────────────────────────
if ! command -v apt-get &>/dev/null; then
  fail "Ez a telepito csak Ubuntu/Debian rendszeren fut (apt-get szukseges)"
fi

# ─────────────────────────────────────────────
# System dependencies
# ─────────────────────────────────────────────
echo -e "${BOLD}[1/3] Rendszer-fuggosegek telepitese...${NC}"

APT_UPDATED=false
apt_install() {
  local pkg="$1"
  if dpkg -s "$pkg" &>/dev/null 2>&1; then
    ok "$pkg mar telepitve"
    return 0
  fi
  if [ "$APT_UPDATED" = "false" ]; then
    echo -e "  apt-get update..."
    sudo apt-get update -qq
    APT_UPDATED=true
  fi
  echo -e "  $pkg telepitese..."
  sudo apt-get install -y "$pkg" -qq
  ok "$pkg telepitve"
}

for pkg in curl wget git tmux; do
  apt_install "$pkg"
done

# Node.js v20+ -- nodesource-bol ha nincs meg
NODE_OK=false
if command -v node &>/dev/null; then
  NODE_VER=$(node -e 'process.stdout.write(process.version.slice(1).split(".")[0])' 2>/dev/null || echo "0")
  [ "$NODE_VER" -ge 20 ] && NODE_OK=true
fi

if $NODE_OK; then
  ok "node $(node --version)"
else
  echo -e "  Node.js v22 telepitese (nodesource)..."
  if [ "$APT_UPDATED" = "false" ]; then
    sudo apt-get update -qq
    APT_UPDATED=true
  fi
  curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash - >/dev/null 2>&1
  sudo apt-get install -y nodejs -qq
  ok "node $(node --version)"
fi

command -v npm &>/dev/null && ok "npm $(npm --version)" || fail "npm nem talalhato nodejs utan sem"

# ─────────────────────────────────────────────
# Repo elokeszitese
# ─────────────────────────────────────────────
echo ""
echo -e "${BOLD}[2/3] Marveen repo...${NC}"

# Ha a script a repobol fut (install-linux.sh a szomszedban): helyben hasznaljuk
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")" 2>/dev/null && pwd || echo "")"
if [ -f "${SCRIPT_DIR}/install-linux.sh" ]; then
  MARVEEN_DIR="$SCRIPT_DIR"
  ok "Repo mar megvan: $MARVEEN_DIR"
else
  # Curl-lel pipe-olt futtatás -- klonozzuk a repot
  MARVEEN_DIR="${MARVEEN_DIR:-$HOME/marveen}"
  if [ -d "$MARVEEN_DIR/.git" ]; then
    echo -e "  Frissites: git pull..."
    git -C "$MARVEEN_DIR" pull --ff-only -q
    ok "Repo frissitve: $MARVEEN_DIR"
  else
    echo -e "  Klonozas: $MARVEEN_DIR..."
    git clone --depth=1 https://github.com/stewie0425/marveen-kkv.git "$MARVEEN_DIR" -q
    ok "Repo klonozva: $MARVEEN_DIR"
  fi
fi

[ -f "$MARVEEN_DIR/install-linux.sh" ] || fail "install-linux.sh nem talalhato: $MARVEEN_DIR"
chmod +x "$MARVEEN_DIR/install-linux.sh"

# ─────────────────────────────────────────────
# Atadas az install-linux.sh-nak
# ─────────────────────────────────────────────
echo ""
echo -e "${BOLD}[3/3] Marveen telepito inditasa...${NC}"
echo ""

# Pipe módban (curl | bash) stdin a pipe -- /dev/tty-vel adjuk vissza
# a terminált, hogy a read parancsok interaktívan működjenek.
exec bash "$MARVEEN_DIR/install-linux.sh" </dev/tty
