const express = require('express');
const { exec, execSync } = require('child_process');
const os = require('os');

const app = express();
app.use(express.json());
app.use(express.static('public'));


app.get('/api/performance', (req, res) => {
  const cpus = os.cpus();
  let totalIdle = 0, totalTick = 0;
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
    used: os.totalmem() - os.freemem() ,
  };

  res.json({ cpuUsagePercent: usagePercent.toFixed(2), memoryUsage });
});

app.get('/api/services', (req, res) => {
  exec('systemctl list-units --type=service --no-pager --no-legend', (err, stdout) => {
    if (err) return res.status(500).json({ error: err.message });
    const lines = stdout.trim().split('\n');
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
  const { name, action } = req.params;
  if (!['start', 'stop', 'restart'].includes(action)) {
    return res.status(400).json({ error: 'Invalid action' });
  }
  exec(`sudo systemctl ${action} ${name}`, (err) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ status: 'success' });
  });
});

let memoryHistory = [];

function getCpuTimes() {
    return os.cpus().map(cpu => ({ ...cpu.times }));
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

  memoryHistory.push({ timestamp, used, total, cpu });

  if (memoryHistory.length > 40) memoryHistory.shift();
}, 1000);

app.get("/api/memory-history", (req, res) => {
  res.json(memoryHistory);
});

const PORT = 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
