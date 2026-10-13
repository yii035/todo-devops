const request = require("supertest");
const app = require("../src/app");

describe("Application API", () => {
    test("GET / should return the dashboard page", async () => {
        const response = await request(app).get("/");

        expect(response.statusCode).toBe(200);
        expect(response.headers["content-type"]).toContain("text/html");
        expect(response.text).toContain("Finance Workflow Dashboard");
    });

    test("GET /api/flow should return workflow metadata", async () => {
        const response = await request(app).get("/api/flow");

        expect(response.statusCode).toBe(200);
        expect(response.body.title).toBe("Finance Workflow Dashboard");
        expect(response.body.nodes).toContain("Manage Budgets");
    });

    test("GET /health should return OK", async () => {
        const response = await request(app).get("/health");

        expect(response.statusCode).toBe(200);
        expect(response.body.status).toBe("OK");
    });
});