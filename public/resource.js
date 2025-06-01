export function closeMessageDialog() {
    const ov_bg = document.querySelector(".overlay-background");
    ov_bg.classList.remove("visible");
    const ov_desc = document.querySelector(".ol-description");
    ov_desc.className = "ol-description";
    ov_desc.innerHTML = "";
}

export function showMessageDialog(title, description) {
    closeMessageDialog();
    document.querySelector(".ol-title").innerHTML = title;
    document.querySelector(".ol-description").innerHTML = description;
    document.querySelector(".overlay-background").classList.add("visible");
}

import "./chart.js";

window.prevIndex = 0;
let eventSource = null;
let settings = {};

export async function loadSettings() {
    const res = await fetch("/api/getsettings");
    settings = await res.json();
}

export function getSettings() {
    return settings;
}

window.loadSettings = loadSettings;
window.getSettings = getSettings;

document.addEventListener("DOMContentLoaded", async () => {
    /*
    await loadSettings();
    settings = getSettings();
    */
    async function checkOS() {
        const res = await fetch("/api/platform")
        const data = await res.json();
        const os = data.userOS;
        console.log(os)
        if (os != "linux") {
            showMessageDialog("Unsupported OS", "You are using an <b>unsupported operating system</b>. This tool was made for <b>unix-like</b> (linux) systems. Some features <b>wont work</b> properly");
        }
    }

    async function loadPerformance() {
        const currentPage = document.getElementById("app").dataset.page;
        const res = await fetch("/api/performance");
        const data = await res.json();

        const resp = await fetch("/api/cpu-load");
        const loads = await resp.json();

        let loadSum = 0;
        loads.forEach(load => loadSum += load);
        const avgCpuLoad = loadSum / loads.length;

        if (currentPage === "dashboard") {
            document.getElementById("performance").innerHTML = `
                <strong>CPU Usage:</strong> ${avgCpuLoad.toFixed(1)}%<br>
                <strong>Memory:</strong> ${(data.memoryUsage.used / 1024 / 1024 / 1024).toFixed(2)} GB /
                ${(data.memoryUsage.total / 1024 / 1024 / 1024).toFixed(2)} GB
            `;
        }
        else if (currentPage === "performance") {
            const avgCpuLoadDiv = document.getElementById("perf-cpu");
            const ramDiv = document.getElementById("perf-ram");
            const cpuContainer = document.getElementById("perf-cpu-dist");

            avgCpuLoadDiv.textContent = `Average CPU load: ${avgCpuLoad.toFixed(1)}%`;
            avgCpuLoadDiv.className = "mt-2 fs-4";

            if (avgCpuLoad > settings["dangerousCpuUsage"]) {
                avgCpuLoadDiv.classList.add("text-danger");
            } else if (avgCpuLoad > settings["cautiousCpuUsage"]) {
                avgCpuLoadDiv.classList.add("text-warning");
            } else {
                avgCpuLoadDiv.classList.add("text-success");
            }

            const ramPercent = (data.memoryUsage.used / data.memoryUsage.total) * 100;
            ramDiv.textContent = `Memory (RAM) usage: ${(data.memoryUsage.used / 1024 / 1024).toFixed(0)} MB`;
            ramDiv.className = "fs-5";

            if (ramPercent > settings["dangerousRamUsage"]) {
                ramDiv.classList.add("text-danger");
            } else if (ramPercent > settings["cautiousRamUsage"]) {
                ramDiv.classList.add("text-warning");
            } else {
                ramDiv.classList.add("text-success");
            }

            cpuContainer.innerHTML = "";
            loads.forEach((load, idx) => {
                const div = document.createElement("div");
                div.className = "core-load fs-5";
                div.innerText = `Core ${idx}: ${load.toFixed(1)}%`;

                if (load > 75) {
                    div.classList.add("text-danger");
                } else if (load > 50) {
                    div.classList.add("text-warning");
                } else {
                    div.classList.add("text-success");
                }

                cpuContainer.appendChild(div);
            });
        }
    }

    async function loadServices() {
        const currentPage = document.getElementById("app").dataset.page;
        if (currentPage !== "dashboard") return;

        const res = await fetch("/api/services");
        const services = await res.json();
        const tbody = document.getElementById("sv-tbody");
        tbody.innerHTML = "";
        services.forEach((svc) => {
            const row = document.createElement("tr");
            row.innerHTML = `
                <td>${svc.name}</td>
                <td>${svc.active}/${svc.sub}</td>
                <td class="user-select-none">
                    <button class="btn btn-sm btn-success">Start</button>
                    <button class="btn btn-sm btn-danger">Stop</button>
                    <button class="btn btn-sm btn-warning">Restart</button>
                </td>
            `;
            const startBtn = row.querySelector(".btn-success");
            startBtn.addEventListener("click", () => controlService(svc.name, "start"));

            const stopBtn = row.querySelector(".btn-danger");
            stopBtn.addEventListener("click", () => controlService(svc.name, "stop"));

            const restartBtn = row.querySelector(".btn-warning");
            restartBtn.addEventListener("click", () => controlService(svc.name, "restart"));
            tbody.appendChild(row);
        });
    }

    async function controlService(name, action) {
        const res = await fetch(`/api/service/${name}/${action}`, { method: "POST" });
        const result = await res.json();
        showMessageDialog("Success!", `Successfully ${action}ed ${name}`);
        loadServices();
    }

    async function updateLogSelector() { 
        const logSelector = document.getElementById("log-selector");
        const res = await fetch("./logs.json");
        const data = await res.json();

        logSelector.innerHTML = "";
        for (const [name, path] of Object.entries(data)) {
            const option = document.createElement("option");
            option.setAttribute("value", path);
            option.innerText = name;
            logSelector.appendChild(option)
        }

        fetchLog(logSelector.children[0].getAttribute("value"));
    }

    async function deleteLogEntry() {
        const selector = document.getElementById("log-selector");
        const selectedLogName = selector.children[selector.selectedIndex].textContent;
        const res = await fetch(`/api/deletelog/${encodeURIComponent(selectedLogName)}`, { method: "POST" })
        if (res.status == 200) {
            showMessageDialog("Success!", `Successfully deleted "${selectedLogName}" log`);
        }
        else {
            showMessageDialog("Error", `Couldnt delete "${selectedLogName}" log`);
        }
    }

    async function addLogEntry() {
        document.querySelector(".overlay-background").classList.add("visible");
        document.querySelector(".ol-title").innerHTML = "Add new log entry";
        const ol_desc = document.querySelector(".ol-description");
        ol_desc.classList.add("d-flex", "flex-column");

        const lognameinput = document.createElement("input");
        lognameinput.type = "text";
        lognameinput.placeholder = "My log 1";
        lognameinput.id = "add-log-name";
        lognameinput.classList.add("p-2", "my-2", "rounded", "fs-5", "border", "border-secondary");

        const logpath = document.createElement("input");
        logpath.type = "text";
        logpath.placeholder = "/var/log/mylog";
        logpath.id = "add-log-path";
        logpath.classList.add("p-2", "my-2", "rounded", "fs-5", "border", "border-secondary");

        const submit = document.createElement("input");
        submit.type = "submit";
        submit.id = "log-add-submit";
        submit.classList.add("my-4", "btn", "btn-outline-primary");

        ol_desc.appendChild(lognameinput);
        ol_desc.appendChild(logpath);
        ol_desc.appendChild(submit);
    }

    async function fetchLog(logPath) {
        const logOutput = document.getElementById("log-output");
        logOutput.innerText = "";
        document.getElementById("log-path-display").innerText = logPath;
        if (eventSource) {
            eventSource.close();
            eventSource = null;
        }

        eventSource = new EventSource(`/api/logs?path=${encodeURIComponent(logPath)}`);
        eventSource.onmessage = (event) => {
            console.log("Received log line:", event.data);
            const decoded = event.data.replaceAll("\\n", "\n")
            logOutput.textContent += `${decoded}`;
            const maxlines = settings["logOutputBuffer"];
            const lines = logOutput.textContent.split("\n");
            if (lines.length > maxlines) {
                logOutput.textContent = lines.slice(lines.length - maxlines).join("\n");
            }
            logOutput.scrollTop = logOutput.scrollHeight;
        }
        eventSource.onerror = (err) => {
            console.error(`Eventsource error: ${err}`);
            eventSource.close();
        }
    }

    async function fetchSettings() {
        const res = await fetch("/api/getsettings");
        const data = await res.json();
        settings = data;

        try {
            for (const key in data) {
                console.log(`key: ${key}\nwindow theme: ${window.theme}\ndata[key]: ${data[key]}`)
                const element = document.getElementById(key);
                if (element) {
                    if (element.tagName == "SELECT") {
                        element.value = data[key];
                    }
                    else {
                        element.value = data[key];
                    }
                }
                else {
                    if (key == "theme") {
                        if (window.theme != data[key]) {
                            switchTheme(data[key]);
                            window.theme = data[key];
                            document.getElementById("themeSwitch").checked = window.theme == "dark" ? true : false;
                            console.log("fetched theme: ", window.theme)
                        }
                    }
                }
            }
        }
        catch(err) {
            //ignore
        }
    }

    function switchTheme(mode) {
        const htmlBody = document.querySelector("body");
        const currentmode = htmlBody.classList.contains("dark-mode");
        console.log("currentmode: ", currentmode)
        console.log("givenmode: ", mode)
        if (mode == "dark" && !currentmode) {
            htmlBody.classList.add("dark-mode");
        }
        else {
            htmlBody.classList.remove("dark-mode")
        }
        if (window.chart) {
            if (mode == "dark" && !currentmode) {
                window.chart.options.scales.y.grid.color = "rgba(224, 224, 224, 0.405)";
                window.chart.options.scales.x.grid.color = "rgba(224, 224, 224, 0.405)";
                window.chart.options.scales.y1.grid.color = "rgba(224, 224, 224, 0.405)";

                window.chart.options.scales.y.ticks.color = "#fff";
                window.chart.options.scales.x.ticks.color = "#fff";
                window.chart.options.scales.y1.ticks.color = "#fff";

                window.chart.update();
            }
            else {
                window.chart.options.scales.y.grid.color = "rgba(56, 56, 56, 0.405)";
                window.chart.options.scales.x.grid.color = "rgba(56, 56, 56, 0.405)";
                window.chart.options.scales.y1.grid.color = "rgba(56, 56, 56, 0.405)";

                window.chart.options.scales.y.ticks.color = "#434343";
                window.chart.options.scales.x.ticks.color = "#434343";
                window.chart.options.scales.y1.ticks.color = "#434343";

                window.chart.update();
            }
        }
    }

    async function saveSettings() {
        const data = {}
        const inputs = document.getElementById("settings-form").querySelectorAll("input, select");

        inputs.forEach(input => {
            data[input.id] = input.value;
        });

        data["theme"] = window.theme ? window.theme : "light";
        console.log(`data[theme]: ${data["theme"]}\nwindow.theme: ${window.theme}`);

        const res = await fetch("/api/setsettings", { 
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(data)
        });

        if (res.status == 200) {
            showMessageDialog("Success!", "Successfully saved settings!");
        }
        else {
            showMessageDialog("Error", "An error occured while trying to save");
        }
    }

    document.addEventListener("click", async (e)=>{
        if (e.target && e.target.matches(".close-ol")){
            closeMessageDialog();
        }
        else if (e.target && e.target.matches("#log-selector")) {
            if (e.target.selectedIndex != window.prevIndex) {
                const selectedElementValue = e.target.children[e.target.selectedIndex].getAttribute("value");
                console.log(selectedElementValue)
                fetchLog(selectedElementValue);
                window.prevIndex = e.target.selectedIndex;
            }
        }
        else if (e.target && e.target.matches("#add-log-entry")) {
            addLogEntry();
        }
        else if (e.target && e.target.matches("#log-add-submit")) {
            console.log("sending data")
            const newlogname = document.getElementById("add-log-name").value;
            const newlogpath = document.getElementById("add-log-path").value;
            
            const res = await fetch(`/api/addlog?name=${encodeURIComponent(newlogname)}&path=${encodeURIComponent(newlogpath)}`, { method: "POST" });
            if (res.status == 200) {
                showMessageDialog("Success!", "Successfully added new log tracking");
                updateLogSelector();
            }
            else if (res.status == 400) {
                showMessageDialog("Error", "Provided path does not exist");
            }
        }
        else if (e.target && e.target.matches("#del-log-entry")) {
            deleteLogEntry();
            updateLogSelector();
        }
        else if (e.target && e.target.matches("#save-form-settings")) {
            e.preventDefault();
            saveSettings();
        }
        else if (e.target && e.target.matches("#themeSwitch")) {
            const htmlBody = document.querySelector("body");
            htmlBody.classList.contains("dark-mode") ? window.theme = "light" : window.theme = "dark";
            console.log(htmlBody.classList.contains("dark-mode"))
            console.log(window.theme)
            switchTheme(window.theme);
        }
    })
    
    
    //IMPORTANT!!!
    fetchSettings();
    window.fetchSettings = fetchSettings;

    const currentPage = document.getElementById("app").dataset.page;
    if ( currentPage == "log" ) updateLogSelector();
    window.updateLogSelector = updateLogSelector;
    checkOS();
    setInterval(loadPerformance, 1000);
    setInterval(loadServices, 3000);
});
