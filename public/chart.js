import { showMessageDialog, getSettings, loadSettings } from "./resource.js";

document.addEventListener("DOMContentLoaded", async () => {
    let chart;
    let preventUpdate = false;
    let procList = [];
    let settings = {}
    async function updateChart() {
        await loadSettings();
        settings = getSettings();

        if (preventUpdate) return;
        const currentPage = document.getElementById("app")?.dataset.page;
        if (currentPage != "performance") return;
        const canvas = document.getElementById("memoryChart");
        const ctx = document.getElementById("memoryChart")?.getContext("2d");
        const res = await fetch("/api/memory-history");
        const data = await res.json();

        console.log("settings: ", settings)
        const labels = data.map(d => new Date(d.timestamp).toLocaleTimeString());
        const cpu = data.map(d => d.cpu);

        let total;
        if (settings["chartRamScale"] == "MB") {
            total = data.map(t => Math.round(t.total / 1024 / 1024));
        }
        else if (settings["chartRamScale"] == "GB") {
            total = data.map(t => Math.round(t.total / 1024 / 1024 / 1024));
        }
        else {
            total = data.map(t => 100);
        }

        let used;
        if (settings["chartRamScale"] == "MB") {
            used = data.map(entry => (entry.used / 1024 / 1024).toFixed(2));
        }
        else if (settings["chartRamScale"] == "GB") {
            used = data.map(entry => (entry.used / 1024 / 1024 / 1024).toFixed(2));
        }
        else {
            used = data.map(entry => ((entry.used / entry.total) * 100).toFixed(2));
        }

        procList = data.map(p => p.procList);
        window.procList = data.map(p => p.procList);
        if (window.chart && window.chart.canvas !== canvas) {
            window.chart.destroy();
            window.chart = null;
        }

        if (!window.chart && ctx) {
            window.chart = new Chart(ctx, {
                type: "line",
                data: {
                    labels,
                    datasets: [
                        {
                            //label: "Memory (MB)",
                            label: settings["chartRamScale"] == "MB" ? "Memory (MB)" : settings["chartRamScale"] == "GB" ? "Memory (GB)" : "Memory (%)",
                            data: used,
                            borderColor: "#337aff",
                            backgroundColor: "rgba(24, 105, 255, 0.26)",
                            yAxisID: "y",
                            pointRadius: 4,
                            pointHoverRadius: 6
                        },
                        {
                            label: "CPU Usage (%)",
                            data: cpu,
                            borderColor: "lime",
                            backgroundColor: "rgba(0,255,0,0.1)",
                            yAxisID: "y1",
                            pointRadius: 4,
                            pointHoverRadius: 6
                        }
                    ],
                },
                options: {
                    responsive: true,
                    animation: false,
                    scales: {
                        y: {
                            beginAtZero: true,
                            max: settings["chartRamScale"] == "MB" ? Math.ceil(total[0] / 1000) * 1000 : settings["chartRamScale"] == "GB" ? total[0] : 100,
                            ticks: {
                                color: "#434343",
                                callback: function(value) {
                                    return settings["chartRamScale"] == "MB" ? value + "MB" : settings["chartRamScale"] == "GB" ? value + "GB" : value + "%";
                                }
                            }
                        },
                        x: {
                            ticks: {
                                color: "#434343",
                            }
                        },
                        y1: {
                            beginAtZero: true,
                            max: 100,
                            position: "right",
                            ticks: {
                                color: "#434343",
                                callback: function(value) {
                                    return value + "%";
                                }
                            }
                        }
                    },
                    onClick: (event, elements, chart) => {
                        if (elements[0]) {
                            const i = elements[0].index;

                            if (!window.procList[i]) {
                                console.warn(`No process list data for index ${i}`);
                                return; // exit early if no data
                            }
                            let messageText = `
                                <table>
                                    <thead>
                                        <tr>
                                            <th>PID</th>
                                            <th>pname</th>
                                            <th>load</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                            `;
                            window.procList[i].forEach(e => {
                                messageText += `
                                <tr>
                                    <td>${e[0]}</td>
                                    <td>${e[1]}</td> 
                                    <td>${e[2]}%</td>
                                </tr>
                                `;
                            });
                            messageText += "</tbody></table>"
                            showMessageDialog(`Data from: ${chart.data.labels[i]}`, messageText);
                        }
                    }
                },
            });
        } else if (window.chart) {
            console.log(window.theme)
            window.chart.data.labels = labels;
            window.chart.data.datasets[0].data = used;
            window.chart.data.datasets[1].data = cpu;
            window.chart.update();
        }
        if (window.theme) {
            if (window.theme == "dark") {
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

    document.addEventListener("click", (e)=>{
        if (e.target && e.target.matches("#pauseBtn")){
            if (!preventUpdate) {
                e.target.classList.remove("btn-outline-primary")
                e.target.classList.add("btn-outline-success")
                e.target.innerText = "Continue"
            }
            else {
                e.target.classList.remove("btn-outline-success")
                e.target.classList.add("btn-outline-primary")
                e.target.innerText = "Pause"
            }
            preventUpdate = !preventUpdate;
        }
    })

    await loadSettings();
    settings = getSettings();
    updateChart();
    setInterval(updateChart, settings["chartUpdateDelay"]);
    window.updateChart = updateChart;
});
