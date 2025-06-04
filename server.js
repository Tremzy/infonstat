const express = require('express');
const {
    exec,
    execSync,
    spawn
} = require('child_process');
const os = require('os');
const {
    platform
} = require('node:process');

const semver = require('semver');
const { version: localVersion } = require('./package.json');
const https = require('https');

const fs = require('fs');
const { decode } = require('node:punycode');

const app = express();
app.use(express.json());
app.use(express.static('public'));

app.get("/api/platform", (req, res) => {
    res.json({
        userOS: platform
    });
});

app.get('/api/performance', (req, res) => {
    const cpus = os.cpus();
    let totalIdle = 0,
        totalTick = 0;
    cpus.forEach(cpu => {
        for (type in cpu.times) {
            totalTick += cpu.times[type];
        }
        totalIdle += cpu.times.idle;
    });
    const idle = totalIdle / cpus.length;
    const total = totalTick / cpus.length;
    const usagePercent = 100 - (idle / total) * 100;

    const memoryUsage = {
        total: os.totalmem(),
        free: os.freemem(),
        used: os.totalmem() - os.freemem(),
    };

    res.json({
        cpuUsagePercent: usagePercent.toFixed(2),
        memoryUsage
    });
});

app.get('/api/services', (req, res) => {
    exec('systemctl list-units --type=service -all --no-pager --no-legend', (err, stdout) => {
        if (err) return res.status(500).json({
            error: err.message
        });
        const blacklist = ["systemd", "not-found", "emergency", "swap", "container", "dev-"];
        const lines = stdout.trim().split('\n').filter(line => !blacklist.some(kw => line.includes(kw)));
        const services = lines.map(line => {
            const parts = line.trim().split(/\s+/);
            return {
                name: parts[0],
                load: parts[1],
                active: parts[2],
                sub: parts[3],
            };
        });
        res.json(services);
    });
});

function isValidServiceName(name) {
  const allowedChars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_.";
  for (let i = 0; i < name.length; i++) {
    if (!allowedChars.includes(name[i])) {
      return false;
    }
  }
  return true;
}

app.post('/api/service/:name/:action', (req, res) => {
    const {
        name,
        action
    } = req.params;
    if (!['start', 'stop', 'restart'].includes(action)) {
        return res.status(400).json({
            error: 'Invalid action'
        });
    }
    if (!isValidServiceName(name)) {
        return res.status(400).json({
            error: "Invalid name"
        });
    }
    exec(`sudo systemctl ${action} ${name}`, (err) => {
        if (err) return res.status(500).json({
            error: err.message
        });
        res.json({
            status: 'success'
        });
    });
});

let memoryHistory = [];

function getCpuTimes() {
    return os.cpus().map(cpu => ({
        ...cpu.times
    }));
}

function calculateCpuLoad(prev, curr) {
    return curr.map((core, idx) => {
        const prevCore = prev[idx];
        const idleDelta = core.idle - prevCore.idle;
        const totalDelta = Object.keys(core).reduce((acc, key) => acc + (core[key] - prevCore[key]), 0);
        const usage = 100 - Math.round((idleDelta / totalDelta) * 100);
        return usage;
    });
}

let previousCpu = getCpuTimes();

const currentCpu = getCpuTimes();
global.cpuCoreUsage = calculateCpuLoad(previousCpu, currentCpu);
previousCpu = currentCpu;

setInterval(() => {
    const currentCpu = getCpuTimes();
    global.cpuCoreUsage = calculateCpuLoad(previousCpu, currentCpu);
    previousCpu = currentCpu;
}, 1000);

app.get("/api/cpu-load", (req, res) => {
    res.json(global.cpuCoreUsage || []);
});

function getCpuUsagePercent() {
    let loadSum = 0;
    global.cpuCoreUsage.forEach(load => loadSum += load);
    return (loadSum / global.cpuCoreUsage.length).toFixed(2);
}


setInterval(() => {
    exec("pidstat -u -h 1 1", (err, stdout, stderr) => {
        const cpu = getCpuUsagePercent();
        if (err) {
            console.error("Error running ps:", err);
            return;
        }
        const lines = stdout.split("\n").slice(3).filter(line => line.trim() !== "" && !line.trim().includes("pidstat"));
        const procList = lines.map(line => {
            const parts = line.trim().split(" ").filter(p => p != "");
            const tokens = [];
            //length = 10
            tokens.push(parts[parts.length - 8], parts[parts.length - 1], parts[parts.length - 3])
            return tokens;
        }).sort((a, b) => parseFloat(b[2]) - parseFloat(a[2])).slice(0, 6);

        const used = os.totalmem() - os.freemem();
        const total = os.totalmem();
        const timestamp = Date.now();

        memoryHistory.push({
            timestamp,
            used,
            total,
            cpu,
            procList
        });


        if (memoryHistory.length > 40) memoryHistory.shift();
    });
}, 1000);

app.get("/api/memory-history", (req, res) => {
    res.json(memoryHistory);
});

app.get("/api/logs/", (req, res) => {
    const logPath = decodeURIComponent(req.query.path);
    if (!logPath || logPath.includes("..")) {
        res.status(400).send("Invalid path");
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    const tail = spawn("tail", ["-n", "20", "-f", logPath]);

    tail.stdout.on("data", (data) => {
        console.log("Tail chunk:", data.toString().length);
        res.write(`data: ${data.toString().replaceAll("\n", "\\n")}\n\n`);
    })

    tail.stderr.on('data', (data) => {
        console.error('Tail error:', data.toString());
        res.write(`data: Tail error: ${data.toString()}\n\n`);
    });

    req.on("close", () => {
        tail.kill()
        res.end();
    });
})

app.post("/api/addlog/", (req, res) => {
    const logname = decodeURIComponent(req.query.name);
    const logpath = decodeURIComponent(req.query.path);

    if (!fs.existsSync(logpath)) {
        return res.status(400).send("Invalid path");
    }

    const logsJson = "./public/logs.json";
    let logs = {};

    if (fs.existsSync(logsJson)) {
        try {
            const data = fs.readFileSync(logsJson, "utf-8");
            logs = JSON.parse(data || "{}");
        } catch (err) {
            return res.status(500).send("Failed to read or parse logs.json");
        }
    }

    logs[logname] = logpath;

    fs.writeFile(logsJson, JSON.stringify(logs, null, 4), (err) => {
        if (err) {
            return res.status(500).send("Error while writing to logs.json");
        }
        return res.status(200).send("Log added successfully");
    });
})

app.post("/api/deletelog/:name", (req, res) => {
    const logname = decodeURIComponent(req.params.name);

    const logsJson = "./public/logs.json";
    let logs = {}

    if (fs.existsSync(logsJson)) {
        try {
            const data = fs.readFileSync(logsJson, "utf-8");
            logs = JSON.parse(data || "{}");
        } catch (err) {
            return res.status(500).send("Failed to read or parse logs.json");
        }
    }

    delete logs[logname];

    fs.writeFile(logsJson, JSON.stringify(logs, null, 4), (err) => {
        if (err) {
            return res.status(500).send("Error while writing to logs.json");
        }
        return res.status(200).send("Log deleted successfully");
    });
})

app.get("/api/getsettings/", (req, res) => {
    const settingsJson = "./public/settings.json";

    if (fs.existsSync(settingsJson)) {
        try {
            const data = fs.readFileSync(settingsJson, "utf-8");
            const settings = JSON.parse(data || "{}");
            return res.json(settings);
        }
        catch (err) {
            return res.status(500).send("Failed to read settings.json");
        }
    }
    else {
        return res.status(404).send("settings.json does not exist");
    }
})

app.post("/api/setsettings", (req, res) => {
    const settingsData = req.body;
    const settingsJson = "./public/settings.json";

    if (fs.existsSync(settingsJson)) {
        fs.writeFile(settingsJson, JSON.stringify(settingsData, null, 4), (err) => {
            if (err) {
                return res.status(500).send("Couldnt overwrite settings.json");
            }
            return res.status(200).send("Successfully saved config");
        });
    }
    else {
        return res.status(404).send("settings.json does not exist");
    }
})

function getLatestGitHubVersion(repoOwner, repoName) {
  return new Promise((resolve, reject) => {
    https.get(
      `https://api.github.com/repos/${repoOwner}/${repoName}/releases/latest`,
      {
        headers: { 'User-Agent': 'Node.js' }
      },
      (res) => {
        let data = '';
        res.on('data', chunk => (data += chunk));
        res.on('end', () => {
          if (res.statusCode === 200) {
            try {
              const release = JSON.parse(data);
              resolve(release.tag_name);
            } catch (e) {
              reject(e);
            }
          } else {
            reject(new Error(`GitHub API status: ${res.statusCode}`));
          }
        });
      }
    ).on('error', reject);
  });
}

async function checkVersion() {
  try {
    const latestVersion = await getLatestGitHubVersion('Tremzy', 'infonstat');
    if (semver.lt(localVersion, latestVersion)) {
      console.warn(`⚠️ Your version (${localVersion}) is outdated. Latest version is ${latestVersion}. Please update!`);
    } else {
      console.log('You are running the latest version.');
    }
  } catch (err) {
    console.error('Version check failed:', err.message);
  }
}

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`)
    checkVersion();
});