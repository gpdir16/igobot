#!/bin/bash

# igobot Installation Script with TUI

set -o pipefail

# 설정
REPO_URL="https://github.com/gpdir16/igobot.git"
INSTALL_DIR="${INSTALL_DIR:-$HOME/.igobot}"
BIN_DIR="/usr/local/bin"
NODE_MAJOR=20
LANG_CODE="en"
ENV_BACKUP=""

# 색상
RED=$(tput setaf 1 2>/dev/null || echo "")
GREEN=$(tput setaf 2 2>/dev/null || echo "")
YELLOW=$(tput setaf 3 2>/dev/null || echo "")
CYAN=$(tput setaf 6 2>/dev/null || echo "")
BOLD=$(tput bold 2>/dev/null || echo "")
RESET=$(tput sgr0 2>/dev/null || echo "")

# 다국어 텍스트
txt() {
    local key="$1"
    if [ "$LANG_CODE" = "ko" ]; then
        case "$key" in
            title) echo "igobot 설치 스크립트" ;;
            select_lang) echo "언어 선택" ;;
            detected_os) echo "감지된 OS" ;;
            prereq) echo "필수 요구사항 확인" ;;
            checking_git) echo "Git 확인 중" ;;
            checking_node) echo "Node.js 확인 중" ;;
            checking_npm) echo "npm 확인 중" ;;
            installing) echo "설치 중" ;;
            installing_git) echo "Git 설치 중" ;;
            installing_node) echo "Node.js 설치 중" ;;
            installing_homebrew) echo "Homebrew 설치 중" ;;
            cloning) echo "저장소 복제 중" ;;
            deps) echo "의존성 설치 중" ;;
            playwright) echo "Playwright 설치 중" ;;
            global_cmd) echo "명령어 등록 중" ;;
            config) echo "설정 파일 생성 중" ;;
            existing) echo "기존 설치 발견" ;;
            remove_ask) echo "삭제 후 재설치?" ;;
            cancel) echo "설치 취소됨" ;;
            complete) echo "설치 완료!" ;;
            next) echo "다음 단계" ;;
            step1) echo "Codex OAuth 로그인" ;;
            step2) echo ".env 파일 설정" ;;
            step3) echo "봇 시작" ;;
            cmds) echo "명령어" ;;
            path) echo "설치 경로" ;;
            uninstall) echo "제거 중" ;;
            uninstall_done) echo "제거 완료" ;;
            err_git) echo "Git 설치 실패" ;;
            err_node) echo "Node.js 설치 실패" ;;
            err_npm) echo "npm 설치 실패" ;;
            err_bin) echo "bin/igobot.js 없음" ;;
            err_os) echo "지원하지 않는 OS" ;;
            yes) echo "예" ;;
            no) echo "아니오" ;;
            continue) echo "아무 키나 누르세요" ;;
            navigate) echo "↑/↓ 이동  Enter 선택" ;;
            setup_now) echo "설정 마법사를 시작합니다..." ;;
            *) echo "$key" ;;
        esac
    else
        case "$key" in
            title) echo "igobot Installation Script" ;;
            select_lang) echo "Select Language" ;;
            detected_os) echo "Detected OS" ;;
            prereq) echo "Checking Prerequisites" ;;
            checking_git) echo "Checking Git" ;;
            checking_node) echo "Checking Node.js" ;;
            checking_npm) echo "Checking npm" ;;
            installing) echo "Installing" ;;
            installing_git) echo "Installing Git" ;;
            installing_node) echo "Installing Node.js" ;;
            installing_homebrew) echo "Installing Homebrew" ;;
            cloning) echo "Cloning Repository" ;;
            deps) echo "Installing Dependencies" ;;
            playwright) echo "Installing Playwright" ;;
            global_cmd) echo "Installing Command" ;;
            config) echo "Creating Configuration" ;;
            existing) echo "Existing installation found" ;;
            remove_ask) echo "Remove and reinstall?" ;;
            cancel) echo "Installation cancelled" ;;
            complete) echo "Installation Complete!" ;;
            next) echo "Next Steps" ;;
            step1) echo "Codex OAuth login" ;;
            step2) echo "Configure .env file" ;;
            step3) echo "Start the bot" ;;
            cmds) echo "Commands" ;;
            path) echo "Install path" ;;
            uninstall) echo "Uninstalling" ;;
            uninstall_done) echo "Uninstallation complete" ;;
            err_git) echo "Failed to install Git" ;;
            err_node) echo "Failed to install Node.js" ;;
            err_npm) echo "Failed to install npm" ;;
            err_bin) echo "bin/igobot.js not found" ;;
            err_os) echo "Unsupported OS" ;;
            yes) echo "Yes" ;;
            no) echo "No" ;;
            continue) echo "Press any key to continue" ;;
            navigate) echo "↑/↓ Navigate  Enter Select" ;;
            setup_now) echo "Starting setup wizard..." ;;
            *) echo "$key" ;;
        esac
    fi
}

# OS 감지
detect_os() {
    case "$OSTYPE" in
        darwin*) echo "macos" ;;
        linux*)
            if command -v apt-get &>/dev/null; then echo "debian"
            elif command -v dnf &>/dev/null; then echo "fedora"
            elif command -v yum &>/dev/null; then echo "rhel"
            elif command -v pacman &>/dev/null; then echo "arch"
            else echo "linux"
            fi
            ;;
        *) echo "unknown" ;;
    esac
}

OS=$(detect_os)

has() {
    command -v "$1" >/dev/null 2>&1
}

get_git_version() {
    git --version | cut -d' ' -f3
}

get_node_version() {
    node -v
}

get_node_major_version() {
    get_node_version | cut -d'v' -f2 | cut -d'.' -f1
}

get_npm_version() {
    npm -v
}

show_step_progress() {
    local current="$1"
    local total="$2"
    local step_key="$3"
    local status="${4:-running}"
    local message="${5:-$(txt "$step_key")}"

    show_progress "$(txt "$step_key")" "$current" "$total" "$message" "$status"
}

ensure_homebrew() {
    if has brew; then
        return 0
    fi

    show_step_progress 0 3 installing_homebrew running
    /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)" || return 1

    if [[ -f "/opt/homebrew/bin/brew" ]]; then
        eval "$(/opt/homebrew/bin/brew shellenv)"
    fi

    has brew
}

install_system_packages() {
    case $OS in
        debian) sudo apt-get install -y "$@" || return 1 ;;
        fedora) sudo dnf install -y "$@" || return 1 ;;
        rhel) sudo yum install -y "$@" || return 1 ;;
        arch) sudo pacman -S --noconfirm "$@" || return 1 ;;
        *) return 1 ;;
    esac
}

setup_nodesource() {
    case $OS in
        debian)
            curl -fsSL https://deb.nodesource.com/setup_${NODE_MAJOR}.x | sudo -E bash - || return 1
            ;;
        fedora|rhel)
            curl -fsSL https://rpm.nodesource.com/setup_${NODE_MAJOR}.x | sudo bash - || return 1
            ;;
        *) return 1 ;;
    esac
}

run_with_sudo_fallback() {
    "$@" || sudo "$@"
}

backup_env_file() {
    if [ -f "$INSTALL_DIR/.env" ]; then
        ENV_BACKUP=$(mktemp "${TMPDIR:-/tmp}/igobot-env.XXXXXX") || return 1
        cp "$INSTALL_DIR/.env" "$ENV_BACKUP" || return 1
    fi
}

restore_env_file() {
    if [ -n "$ENV_BACKUP" ] && [ -f "$ENV_BACKUP" ]; then
        cp "$ENV_BACKUP" "$INSTALL_DIR/.env" || return 1
        rm -f "$ENV_BACKUP"
        ENV_BACKUP=""
    fi
}

cleanup() {
    if [ -n "$ENV_BACKUP" ] && [ -f "$ENV_BACKUP" ]; then
        rm -f "$ENV_BACKUP"
    fi
    restore_screen
}

# 화면 초기화
init_screen() {
    tput smcup 2>/dev/null
    tput civis 2>/dev/null
    clear
}

# 화면 복원
restore_screen() {
    tput cnorm 2>/dev/null
    tput rmcup 2>/dev/null
}

# 헤더 표시
show_header() {
    clear
    echo "${CYAN}╔════════════════════════════════════════════════════════════════╗${RESET}"
    echo "${CYAN}║${RESET} ${BOLD}$(txt title)${RESET}"
    echo "${CYAN}╠════════════════════════════════════════════════════════════════╣${RESET}"
    echo ""
}

# 푸터 표시
show_footer() {
    echo ""
    echo "${CYAN}╚════════════════════════════════════════════════════════════════╝${RESET}"
}

# 메뉴 표시
show_menu() {
    local title="$1"
    shift
    local options=("$@")
    local selected=0
    local count=${#options[@]}
    local key

    while true; do
        show_header
        echo "  ${BOLD}$title${RESET}"
        echo ""
        echo ""

        for i in "${!options[@]}"; do
            if [ $i -eq $selected ]; then
                echo "  ${GREEN}▶ ${options[$i]}${RESET}"
            else
                echo "    ${options[$i]}"
            fi
        done

        echo ""
        echo ""
        echo "  ${YELLOW}$(txt navigate)${RESET}"
        show_footer

        IFS= read -rsn1 key
        case "$key" in
            $'\x1b')
                read -rsn2 -t1 key
                case "$key" in
                    '[A') ((selected--)); [ $selected -lt 0 ] && selected=$((count - 1)) ;;
                    '[B') ((selected++)); [ $selected -ge $count ] && selected=0 ;;
                esac
                ;;
            '') return $selected ;;
        esac
    done
}

# 확인 대화상자
show_confirm() {
    local message="$1"
    local selected=0
    local key

    while true; do
        show_header
        echo "  ${YELLOW}$message${RESET}"
        echo ""
        echo ""

        if [ $selected -eq 0 ]; then
            echo "  ${GREEN}▶ $(txt yes)${RESET}"
            echo "    $(txt no)"
        else
            echo "    $(txt yes)"
            echo "  ${GREEN}▶ $(txt no)${RESET}"
        fi

        echo ""
        echo ""
        echo "  ${YELLOW}$(txt navigate)${RESET}"
        show_footer

        IFS= read -rsn1 key
        case "$key" in
            $'\x1b')
                read -rsn2 -t1 key
                case "$key" in
                    '[A'|'[D'|'[B'|'[C') selected=$((1 - selected)) ;;
                esac
                ;;
            '') return $selected ;;
        esac
    done
}

# 진행 상태
show_progress() {
    local step="$1"
    local current="$2"
    local total="$3"
    local message="$4"
    local status="${5:-running}"

    show_header

    echo "  ${BOLD}[$current/$total] $step${RESET}"
    echo ""

    # 프로그레스 바
    local bar_width=40
    local filled=$((current * bar_width / total))
    local pct=$((current * 100 / total))

    printf "  ["
    for ((i=0; i<bar_width; i++)); do
        if [ $i -lt $filled ]; then printf "${GREEN}█${RESET}"
        else printf "░"
        fi
    done
    printf "] %3d%%\n" $pct

    echo ""
    echo ""

    # 상태 아이콘
    local icon msg_color
    case "$status" in
        running) icon="⟳"; msg_color="$CYAN" ;;
        done) icon="✓"; msg_color="$GREEN" ;;
        error) icon="✗"; msg_color="$RED" ;;
        warning) icon="!"; msg_color="$YELLOW" ;;
    esac

    echo "  ${msg_color}$icon $message${RESET}"

    show_footer
}

# 에러 표시
show_error() {
    local message="$1"

    show_header
    echo ""
    echo "  ${RED}✗ $message${RESET}"
    echo ""
    echo ""
    echo "  ${YELLOW}$(txt continue)${RESET}"
    show_footer

    read -rsn1
    restore_screen
    exit 1
}

# Node.js 설치
install_node() {
    show_step_progress 0 3 installing_node

    case $OS in
        macos)
            ensure_homebrew || return 1
            brew install node || return 1
            ;;
        debian|fedora|rhel)
            setup_nodesource || return 1
            install_system_packages nodejs || return 1
            ;;
        arch)
            install_system_packages nodejs npm || return 1
            ;;
        *)
            show_error "$(txt err_os): $OSTYPE"
            ;;
    esac
    return 0
}

# Git 확인
check_git() {
    show_step_progress 1 6 checking_git running "$(txt checking_git)..."

    if has git; then
        show_step_progress 1 6 checking_git done "Git $(get_git_version)"
        return 0
    fi

    show_step_progress 1 6 installing_git warning "$(txt installing_git)..."

    case $OS in
        macos) xcode-select --install 2>/dev/null || true ;;
        *) install_system_packages git || return 1 ;;
    esac

    sleep 2

    if has git; then
        show_step_progress 1 6 checking_git done "Git $(get_git_version)"
    else
        show_error "$(txt err_git)"
    fi
}

# Node.js 확인
check_node() {
    show_step_progress 2 6 checking_node running "$(txt checking_node)..."

    if has node; then
        local ver=$(get_node_major_version)
        if [ "$ver" -ge $NODE_MAJOR ]; then
            show_step_progress 2 6 checking_node done "Node.js $(get_node_version)"
            return 0
        fi
    fi

    if ! install_node; then
        show_error "$(txt err_node)"
    fi

    if has node; then
        show_step_progress 2 6 checking_node done "Node.js $(get_node_version)"
    else
        show_error "$(txt err_node)"
    fi
}

# npm 확인
check_npm() {
    show_step_progress 3 6 checking_npm running "$(txt checking_npm)..."

    if has npm; then
        show_step_progress 3 6 checking_npm done "npm $(get_npm_version)"
        return 0
    fi

    case $OS in
        macos)
            ensure_homebrew || return 1
            brew install npm || return 1
            ;;
        *) install_system_packages npm || return 1 ;;
    esac

    if has npm; then
        show_step_progress 3 6 checking_npm done "npm $(get_npm_version)"
    else
        show_error "$(txt err_npm)"
    fi
}

# 기존 설치 확인
check_existing() {
    if [ -d "$INSTALL_DIR" ]; then
        if show_confirm "$(txt existing): $INSTALL_DIR"; then
            backup_env_file || show_error "Failed to back up existing .env"
            rm -rf "$INSTALL_DIR"
            rm -f "$BIN_DIR/igobot"
        else
            show_header
            echo ""
            echo "  ${YELLOW}$(txt cancel)${RESET}"
            echo ""
            echo ""
            echo "  ${YELLOW}$(txt continue)${RESET}"
            show_footer
            read -rsn1
            restore_screen
            exit 0
        fi
    fi
}

# 저장소 클론
clone_repo() {
    show_step_progress 4 6 cloning running "$(txt cloning)..."

    if git clone "$REPO_URL" "$INSTALL_DIR"; then
        cd "$INSTALL_DIR"
        restore_env_file || show_error "Failed to restore existing .env"
        show_step_progress 4 6 cloning done
    else
        show_error "$(txt cloning) failed"
    fi
}

# 의존성 설치
install_deps() {
    show_step_progress 5 6 deps running "$(txt deps)..."

    cd "$INSTALL_DIR"

    if npm install --omit=dev; then
        show_step_progress 5 6 deps done
    else
        show_error "$(txt deps) failed"
    fi

    show_step_progress 5 6 playwright running "$(txt playwright)..."

    if npx playwright install firefox; then
        show_step_progress 5 6 playwright done
    else
        show_error "$(txt playwright) failed"
    fi
}

# 전역 명령어 설치
install_global() {
    show_step_progress 6 6 global_cmd running "$(txt global_cmd)..."

    if [ ! -f "$INSTALL_DIR/bin/igobot.js" ]; then
        show_error "$(txt err_bin)"
    fi

    chmod +x "$INSTALL_DIR/bin/igobot.js"

    run_with_sudo_fallback ln -sf "$INSTALL_DIR/bin/igobot.js" "$BIN_DIR/igobot" || show_error "$(txt global_cmd) failed"

    show_step_progress 6 6 global_cmd done
}

# 설정 파일 생성
setup_config() {
    cd "$INSTALL_DIR"
    [ -f ".env.example" ] && [ ! -f ".env" ] && cp .env.example .env
    mkdir -p data/memory data/workspace logs
}

# 완료 화면 (일반 출력)
show_complete() {
    restore_screen
    trap - EXIT

    echo ""
    echo "${GREEN}$(txt complete)${RESET}"
    echo ""
    echo "$(txt path): ${CYAN}$INSTALL_DIR${RESET}"
    echo ""
    echo "${BOLD}$(txt cmds)${RESET}"
    echo ""
    echo "  ${GREEN}igobot start${RESET}   - Start in background"
    echo "  ${GREEN}igobot stop${RESET}    - Stop the bot"
    echo "  ${GREEN}igobot status${RESET}  - Check status"
    echo "  ${GREEN}igobot logs${RESET}    - View logs"
    echo ""
    echo "${CYAN}▶ $(txt setup_now)${RESET}"
    echo ""
}

# 제거
do_uninstall() {
    init_screen

    show_header
    echo "  $(txt uninstall)..."
    echo ""
    echo ""

    if [ -d "$INSTALL_DIR" ]; then
        rm -rf "$INSTALL_DIR"
        echo "  ${GREEN}✓${RESET} Removed $INSTALL_DIR"
    fi

    if run_with_sudo_fallback rm -f "$BIN_DIR/igobot"; then
        echo "  ${GREEN}✓${RESET} Removed $BIN_DIR/igobot"
    fi

    echo ""
    echo ""
    echo "  ${GREEN}$(txt uninstall_done)${RESET}"

    show_footer
    read -rsn1
    restore_screen
    exit 0
}

# 종료 시 화면 복원
trap cleanup EXIT

# 메인
main() {
    if [ "$1" = "--uninstall" ]; then
        LANG_CODE="en"
        do_uninstall
    fi

    init_screen

    # 언어 선택
    local langs=("English" "한국어")
    show_menu "$(txt select_lang)" "${langs[@]}"
    local lang_choice=$?
    [ $lang_choice -eq 1 ] && LANG_CODE="ko" || LANG_CODE="en"

    # OS 표시
    show_header
    echo "  ${BOLD}$(txt detected_os): $OS${RESET}"
    echo ""
    echo ""
    echo "  ${YELLOW}$(txt continue)${RESET}"
    show_footer
    read -rsn1

    # 설치 과정
    check_existing
    check_git
    check_node
    check_npm
    clone_repo
    install_deps
    install_global
    setup_config
    show_complete
    igobot setup
}

main "$@"
