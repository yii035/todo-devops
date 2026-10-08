const express = require("express");
const client = require("prom-client");

const app = express();
const port = process.env.PORT || 3000;

client.collectDefaultMetrics();

app.get("/", (req, res) => {
    res.json({
        message: "DevOps Pipeline is running!",
        version: "1.0.0"
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