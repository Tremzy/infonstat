document.addEventListener("DOMContentLoaded", () => {
    let chart;
    let preventUpdate = false;
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
                        },
                        {
                            label: "CPU Usage (%)",
                            data: cpu,
                            borderColor: "lime",
                            backgroundColor: "rgba(0,255,0,0.1)",
                            yAxisID: "y1",
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
        if (e.target && e.target.matches("#pauseBtn"))
        preventUpdate = !preventUpdate;
        console.log("prevented update!!! ", preventUpdate);
    })

    updateChart();
    setInterval(updateChart, 1000);
    window.updateChart = updateChart;
});
