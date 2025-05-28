import "./chart.js";

document.addEventListener("DOMContentLoaded", () => {

    function showMessageDialog(title, description) {
        document.querySelector(".ol-title").innerHTML = title;
        document.querySelector(".ol-description").innerHTML = description;
        document.querySelector(".overlay-background").classList.add("visible");
    }

    function closeMessageDialog() {
        document.querySelector(".overlay-background").classList.remove("visible");
    }

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

            if (avgCpuLoad > 75) {
                avgCpuLoadDiv.classList.add("text-danger");
            } else if (avgCpuLoad > 50) {
                avgCpuLoadDiv.classList.add("text-warning");
            } else {
                avgCpuLoadDiv.classList.add("text-success");
            }

            const ramPercent = (data.memoryUsage.used / data.memoryUsage.total) * 100;
            ramDiv.textContent = `Memory (RAM) usage: ${(data.memoryUsage.used / 1024 / 1024).toFixed(0)} MB`;
            ramDiv.className = "fs-5";

            if (ramPercent > 75) {
                ramDiv.classList.add("text-danger");
            } else if (ramPercent > 50) {
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
                    <button class="btn btn-sm btn-success" onclick="controlService('${svc.name}', 'start')">Start</button>
                    <button class="btn btn-sm btn-danger" onclick="controlService('${svc.name}', 'stop')">Stop</button>
                    <button class="btn btn-sm btn-warning" onclick="controlService('${svc.name}', 'restart')">Restart</button>
                </td>
            `;
            tbody.appendChild(row);
        });
    }

    async function controlService(name, action) {
        const res = await fetch(`/api/service/${name}/${action}`, { method: "POST" });
        const result = await res.json();
        alert(result.status || result.error);
        loadServices();
    }

    document.addEventListener("click", (e)=>{
        if (e.target && e.target.matches(".close-ol")){
            closeMessageDialog();
        }
    })

    checkOS();
    setInterval(loadPerformance, 1000);
    setInterval(loadServices, 3000);
});
