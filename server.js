const express = require('express');
const {
    exec,
    execSync
} = require('child_process');
const os = require('os');
const {
    platform
} = require('node:process');

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
    const used = os.totalmem() - os.freemem();
    const total = os.totalmem();
    const timestamp = Date.now();
    const cpu = getCpuUsagePercent();

    exec("pidstat -u -h 1 1", (err, stdout, stderr) => {
        if (err) {
            console.error("Error running ps:", err);
            return;
        }
        const lines = stdout.split("\n").slice(3).filter(line => line.trim() !== "" && !line.trim().includes("pidstat"));
        const procList = lines.map(line => {
            const parts = line.trim().split(" ").filter(p => p != "");
            const tokens = [];
            tokens.push(parts[2], parts[9], parts[7])
            return tokens;
        }).sort((a, b) => parseFloat(b[2]) - parseFloat(a[2])).slice(0, 6);


        memoryHistory.push({
            timestamp,
            used,
            total,
            cpu,
            procList
        });


        if (memoryHistory.length > 40) memoryHistory.shift();
    });
}, 1500);

app.get("/api/memory-history", (req, res) => {
    res.json(memoryHistory);
});

const PORT = 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));