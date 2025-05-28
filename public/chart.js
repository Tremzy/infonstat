import { showMessageDialog, closeMessageDialog } from "./resource.js";

document.addEventListener("DOMContentLoaded", () => {
    let chart;
    let preventUpdate = false;
    let procList = [];
    async function updateChart() {
        if (preventUpdate) return;
        const currentPage = document.getElementById("app")?.dataset.page;
        if (currentPage != "performance") return;
        console.log("received call")
        const canvas = document.getElementById("memoryChart");
        const ctx = document.getElementById("memoryChart")?.getContext("2d");
        const res = await fetch("/api/memory-history");
        const data = await res.json();

        const labels = data.map(d => new Date(d.timestamp).toLocaleTimeString());
        const used = data.map(entry => (entry.used / 1024 / 1024).toFixed(2));
        const cpu = data.map(d => d.cpu);
        const total = data.map(t => Math.round(t.total / 1024 / 1024));
        procList = data.map(p => p.procList);

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
                            label: "Memory (MB)",
                            data: used,
                            borderColor: "blue",
                            backgroundColor: "rgba(0,0,255,0.1)",
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
                            max: Math.ceil(total[0] / 1000) * 1000,
                            ticks: {
                                callback: function(value) {
                                    return value + " MB";
                                }
                            }
                        },
                        y1: {
                            beginAtZero: true,
                            max: 100,
                            position: "right",
                            ticks: {
                                callback: function(value) {
                                    return value + "%";
                                }
                            }
                        }
                    },
                    onClick: (event, elements, chart) => {
                        if (elements[0]) {
                            const i = elements[0].index;
                            console.log(i)
                            console.log(procList.length)
                            if (!procList[i]) {
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
                            procList[i].forEach(e => {
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
            window.chart.data.labels = labels;
            window.chart.data.datasets[0].data = used;
            window.chart.data.datasets[1].data = cpu;
            window.chart.update();
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
            console.log("prevented update!!! ", preventUpdate);
        }
    })

    updateChart();
    setInterval(updateChart, 1000);
    window.updateChart = updateChart;
});
