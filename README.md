**English** / [한국어](README.ko.md)

# igobot

An AI agent that interacts via Telegram Messenger. It communicates with the ChatGPT model using OpenAI's Codex OAuth authentication and can autonomously utilize various tools.

It's similar to OpenClaw but safer, lighter, and simpler.

> **This project is not official from OpenAI.** — The Codex OAuth method is implicitly allowed by OpenAI, but it could change at any time.

## Key Features

- The agent operates autonomously
- Asks for permission before performing write operations
- Supports skills and tools
- Works in an isolated environment
- Can control its own Firefox browser
- Can use many tools including terminal/files/browser
- And more...

## Requirements

- ChatGPT Plus or Pro subscription
- Telegram bot token (issued by [BotFather](https://t.me/BotFather))
- NodeJS 20+ (installed automatically)
- macOS or Debian, Fedora, Arch
- GUI desktop environment (for Linux only)

## How to Install

```bash
curl -fsSL https://raw.githubusercontent.com/gpdir16/igobot/refs/heads/main/install.sh | bash
```

1. Run the script above on macOS or Debian, Fedora, Arch.
2. When your operating system information is displayed, press Enter to continue.
3. After the installation is complete, you will automatically enter the settings page. Proceed with settings such as your Telegram bot token and language.
4. At the end of the setup, when prompted to log in to Codex OAuth, open the link in a browser and log in.
5. Run `igobot start` in the terminal.
6. When you send a message via Telegram, an approval command will be displayed. Run this command in the terminal on the computer where igobot is running.