#!/bin/bash

# Generate a dashboard HTML file with auto-merge metrics

REPO="GontrandL/autoweave"
OUTPUT_FILE="auto-merge-dashboard.html"

echo "📊 Generating Auto-Merge Dashboard..."

# Fetch recent data
WORKFLOW_DATA=$(curl -s "https://api.github.com/repos/$REPO/actions/runs?per_page=50" | \
    jq -r '.workflow_runs[] | select(.name | contains("Dependabot"))')

MERGED_PRS=$(curl -s "https://api.github.com/repos/$REPO/pulls?state=closed&per_page=50" | \
    jq -r '.[] | select(.user.login == "dependabot[bot]" and .merged_at != null)')

# Generate HTML dashboard
cat > "$OUTPUT_FILE" << 'EOF'
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>AutoWeave - Auto-Merge Dashboard</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            margin: 0;
            padding: 20px;
            background-color: #f5f5f5;
        }
        .container {
            max-width: 1200px;
            margin: 0 auto;
        }
        h1 {
            color: #333;
            text-align: center;
            margin-bottom: 30px;
        }
        .metrics-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
        }
        .metric-card {
            background: white;
            border-radius: 8px;
            padding: 20px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .metric-value {
            font-size: 36px;
            font-weight: bold;
            color: #2ecc71;
            margin: 10px 0;
        }
        .metric-label {
            color: #666;
            font-size: 14px;
        }
        .chart-container {
            background: white;
            border-radius: 8px;
            padding: 20px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            margin-bottom: 20px;
        }
        .status-badge {
            display: inline-block;
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 12px;
            font-weight: bold;
            margin: 2px;
        }
        .status-success { background-color: #2ecc71; color: white; }
        .status-failure { background-color: #e74c3c; color: white; }
        .status-pending { background-color: #f39c12; color: white; }
        table {
            width: 100%;
            border-collapse: collapse;
        }
        th, td {
            padding: 12px;
            text-align: left;
            border-bottom: 1px solid #ddd;
        }
        th {
            background-color: #f8f9fa;
            font-weight: 600;
        }
        .refresh-info {
            text-align: center;
            color: #666;
            margin-top: 20px;
            font-size: 14px;
        }
    </style>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
</head>
<body>
    <div class="container">
        <h1>🤖 AutoWeave Auto-Merge Dashboard</h1>
        
        <div class="metrics-grid">
            <div class="metric-card">
                <div class="metric-label">Total Workflow Runs (7d)</div>
                <div class="metric-value" id="total-runs">-</div>
            </div>
            <div class="metric-card">
                <div class="metric-label">Success Rate</div>
                <div class="metric-value" id="success-rate">-</div>
            </div>
            <div class="metric-card">
                <div class="metric-label">Auto-Merged PRs (30d)</div>
                <div class="metric-value" id="auto-merged">-</div>
            </div>
            <div class="metric-card">
                <div class="metric-label">Avg Merge Time</div>
                <div class="metric-value" id="avg-merge-time">-</div>
            </div>
        </div>

        <div class="chart-container">
            <h2>Workflow Performance Trend</h2>
            <canvas id="performanceChart"></canvas>
        </div>

        <div class="chart-container">
            <h2>Recent Dependabot PRs</h2>
            <table id="prs-table">
                <thead>
                    <tr>
                        <th>PR</th>
                        <th>Title</th>
                        <th>Status</th>
                        <th>Created</th>
                        <th>Merged</th>
                    </tr>
                </thead>
                <tbody id="prs-tbody">
                </tbody>
            </table>
        </div>

        <div class="refresh-info">
            Dashboard generated at: <span id="timestamp"></span>
        </div>
    </div>

    <script>
        // Set timestamp
        document.getElementById('timestamp').textContent = new Date().toLocaleString();

        // Mock data for demonstration
        document.getElementById('total-runs').textContent = '24';
        document.getElementById('success-rate').textContent = '96%';
        document.getElementById('auto-merged').textContent = '18';
        document.getElementById('avg-merge-time').textContent = '1.5h';

        // Performance chart
        const ctx = document.getElementById('performanceChart').getContext('2d');
        new Chart(ctx, {
            type: 'line',
            data: {
                labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
                datasets: [{
                    label: 'Success Rate (%)',
                    data: [100, 95, 100, 90, 100, 100, 95],
                    borderColor: '#2ecc71',
                    backgroundColor: 'rgba(46, 204, 113, 0.1)',
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                scales: {
                    y: {
                        beginAtZero: true,
                        max: 100
                    }
                }
            }
        });

        // Add sample PR data
        const prsData = [
            { number: 12, title: 'Bump jest from 29.5.0 to 29.7.0', status: 'merged', created: '2024-01-14', merged: '2024-01-14' },
            { number: 11, title: 'Bump @types/node from 20.11.30 to 20.19.7', status: 'merged', created: '2024-01-14', merged: '2024-01-14' },
            { number: 10, title: 'Bump typescript from 5.4.3 to 5.6.3', status: 'open', created: '2024-01-14', merged: '-' }
        ];

        const tbody = document.getElementById('prs-tbody');
        prsData.forEach(pr => {
            const row = tbody.insertRow();
            row.innerHTML = `
                <td>#${pr.number}</td>
                <td>${pr.title}</td>
                <td><span class="status-badge status-${pr.status === 'merged' ? 'success' : 'pending'}">${pr.status}</span></td>
                <td>${pr.created}</td>
                <td>${pr.merged}</td>
            `;
        });
    </script>
</body>
</html>
EOF

echo "✅ Dashboard generated: $OUTPUT_FILE"
echo "📂 Open the file in your browser to view the dashboard"