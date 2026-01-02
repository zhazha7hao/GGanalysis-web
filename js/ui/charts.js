/**
 * charts.js
 * Global Namespace: GG
 */

(function (global) {
    global.GG = global.GG || {};

    class ChartWrapper {
        constructor(canvas) {
            this.ctx = canvas.getContext('2d');
            this.chart = null;
        }

        render(dist) {
            if (this.chart) {
                this.chart.destroy();
            }

            const cdf = dist.cdf; // Access getter

            const labels = [];
            const dataPDF = [];
            const dataCDF = [];

            // Range determination
            // Find effective range 0.01% - 99.99% for display
            let start = 0;
            let end = dist.length - 1;

            // Start where CDF > 0.0001
            while (start < dist.length && cdf[start] < 0.0001) start++;
            // End where CDF > 0.9999
            while (end > start && cdf[end] > 0.9999) end--;

            start = Math.max(0, start - 10);
            end = Math.min(dist.length - 1, end + 10);

            // Check spacing. If range > 200, sample it?
            const step = Math.ceil((end - start) / 300);

            for (let i = start; i <= end; i += step) {
                labels.push(i);
                dataPDF.push(dist.dist[i]); // Note: PDF might be tiny at step points if discrete.
                // For direct line chart of discrete mass, step skipping might miss peaks.
                // But for "Luck" curves usually dense enough.
                // Better to use exact indices if range small.
                // If skipping, PDF visualization is inaccurate. CDF is fine.
                // Let's assume range isn't getting massive (<= 2000?) usually. 
                // ChartJS handles <2000 points fine.
            }

            // Re-generate full data if step=1
            if (step > 1) {
                // Warning: sparse sampling PDF is bad.
                // Let's just push all points?
                // Browser can lag with 2000+ points.
                // let's stick to full data for now.
            }

            // Re-loop for safety
            labels.length = 0;
            dataPDF.length = 0;
            dataCDF.length = 0;

            for (let i = start; i <= end; i++) {
                labels.push(i);
                dataPDF.push(dist.dist[i]);
                dataCDF.push(cdf[i] * 100); // Percentage
            }

            this.chart = new Chart(this.ctx, {
                type: 'line',
                data: {
                    labels: labels,
                    datasets: [
                        {
                            label: '概率密度 (PDF)',
                            data: dataPDF,
                            borderColor: '#6200ea',
                            backgroundColor: 'rgba(98, 0, 234, 0.2)',
                            yAxisID: 'y',
                            fill: true,
                            pointRadius: 0
                        },
                        {
                            label: '累计概率 (CDF %)',
                            data: dataCDF,
                            borderColor: '#03dac6',
                            borderDash: [5, 5],
                            yAxisID: 'y1',
                            fill: false,
                            pointRadius: 0
                        }
                    ]
                },
                options: {
                    responsive: true,
                    interaction: {
                        mode: 'index',
                        intersect: false,
                    },
                    scales: {
                        x: {
                            title: { display: true, text: '抽数 (Pulls)' },
                            grid: { color: '#333' },
                            ticks: { color: '#aaa' }
                        },
                        y: {
                            type: 'linear',
                            display: true,
                            position: 'left',
                            title: { display: true, text: '本次概率 (Prob)' },
                            grid: { color: '#333' }
                        },
                        y1: {
                            type: 'linear',
                            display: true,
                            position: 'right',
                            title: { display: true, text: '累计概率 (%)' },
                            grid: { drawOnChartArea: false }, // only want the grid lines for one axis to show up
                            min: 0,
                            max: 100
                        }
                    },
                    plugins: {
                        legend: { labels: { color: '#fff' } },
                        tooltip: {
                            callbacks: {
                                label: function (context) {
                                    let label = context.dataset.label || '';
                                    if (label) {
                                        label += ': ';
                                    }
                                    if (context.raw !== null) {
                                        if (context.datasetIndex === 1) {
                                            label += context.raw.toFixed(2) + '%';
                                        } else {
                                            label += (context.raw * 100).toFixed(4) + '%';
                                        }
                                    }
                                    return label;
                                }
                            }
                        }
                    }
                }
            });
        }
    }

    global.GG.ChartWrapper = ChartWrapper;

})(window);
