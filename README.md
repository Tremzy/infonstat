# 🖥️ Info 'n Stat — Web-Based Performance Profiler for Unix-like Systems

Info 'n Stat is a responsive, web-based performance profiling dashboard tailored for Unix-like systems — especially servers. It provides real-time system statistics, service management tools, and powerful logging utilities, all accessible from a clean, Bootstrap-powered interface.

## 🧰 System Requirements

Ensure the following system packages are installed on your Unix-like system:

- `sysstat` — for `pidstat`
- `nodejs` —  to run the backend
- `npm` — to install nodejs packages
- `express` — the backend router

On Debian/Ubuntu:

```bash
sudo apt update && sudo apt install -y curl sysstat && curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash - && sudo apt install -y nodejs && npm install express
```

On Arch:

```bash
sudo pacman -Sy --noconfirm sysstat nodejs npm && npm install express
```

On Fedora:

```bash
sudo dnf install -y sysstat nodejs npm && npm install express
```

# 🚀 Features

## 📊 Dashboard

Overview of key system metrics

Service management (Start / Stop / Restart) for tracked services

Snapshot of current average CPU load and memory usage

## 🔍 Performance Page

Detailed system monitoring including:

Live average CPU load

Memory usage

Real-time line chart of CPU and RAM usage over time

Per-core CPU usage

Clickable chart points with instant snapshots of top CPU-consuming processes at that moment

## 📁 Logs

View pre-defined log files

Add/remove custom log sources (requires backend read permission)

Real-time log streaming using Server-Sent Events (SSE)

## ⚙️ Settings

Configure chart update intervals

Set line buffer limits for logs

Define system load warning thresholds

Toggle dark/light mode (available globally from the sidebar)

## 🛠️ Tech Stack

Frontend: HTML, CSS, JavaScript, Chart.js, Bootstrap 5

Backend: Node.js + Express

Realtime Streaming: Server-Sent Events (SSE)

Target Systems: Linux/Unix-like operating systems (tested on server environments)

## 🌙 Dark Mode

A built-in dark/light mode toggle is always accessible at the bottom of the sidebar, saving your preferences across sessions.

## 📎 Notes

Ensure the Node.js backend has read access to any custom logs added.

Intended for self-hosted environments and internal server monitoring.
