const express = require("express");
const path = require("path");
const client = require("prom-client");

const app = express();
const port = process.env.PORT || 3000;

client.collectDefaultMetrics();

app.use(express.static(path.join(__dirname, "../public")));

app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "../public/index.html"));
});

app.get("/api/flow", (req, res) => {
    res.json({
        title: "Finance Workflow Dashboard",
        description: "Personal finance and debt management process flow.",
        nodes: [
            "Authenticated User",
            "Manage Budgets",
            "Manage Categories",
            "Manage Accounts",
            "Manage Transactions",
            "View Dashboard",
            "View Reports",
            "Manage Debts & Loans"
        ]
    });
});

app.get("/health", (req, res) => {
    res.status(200).json({
        status: "OK"
    });
});

app.get("/metrics", async (req, res) => {
    res.set("Content-Type", client.register.contentType);
    res.end(await client.register.metrics());
});

if (require.main === module) {
    app.listen(port, () => {
        console.log(`Server running on port ${port}`);
    });
}

module.exports = app;