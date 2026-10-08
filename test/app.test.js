const request = require("supertest");
const app = require("../src/app");

describe("Application API", () => {
    test("GET / should return 200", async () => {
        const response = await request(app).get("/");

        expect(response.statusCode).toBe(200);
        expect(response.body.message).toBe("DevOps Pipeline is running!");
    });

    test("GET /health should return OK", async () => {
        const response = await request(app).get("/health");

        expect(response.statusCode).toBe(200);
        expect(response.body.status).toBe("OK");
    });
});