import { default as migrate, createMigrationsTable } from "./migrate.js";
import pg from "pg";

const db = new pg.Client();
const dbNoCreate = new pg.Client({ user: "test_db01" });
const dbNoSelect = new pg.Client({ user: "test_db02" });

const dbClean = async () => {
    await db.query("DROP TABLE IF EXISTS cinemas;");
    await db.query("DROP TABLE IF EXISTS distributors;");
    await db.query("DROP TABLE IF EXISTS films;");
    await db.query("DROP TABLE IF EXISTS migrations;");
}

const fetchTables = async () => {
    const res = await db.query(
        `SELECT schemaname, tablename
            FROM pg_catalog.pg_tables
            WHERE schemaname != 'pg_catalog' 
              AND schemaname != 'information_schema';
        `
    );
    return res.rows.map(row => row.tablename).sort();
}

describe("migrate", () => {
    beforeAll(async () => {
        await db.connect();
        await dbNoCreate.connect();
        await dbNoSelect.connect();
    });

    beforeEach(async () => {
        await dbClean();
    });

    afterAll(async () => {
        await dbClean();
        await db.end();
        await dbNoCreate.end();
        await dbNoSelect.end();
    });

    test("executes SQL in the specified directory", async () => {
        const directory = new URL("./test/migrations", import.meta.url).pathname;
        const table = "migrations";
        const res = await migrate(db, directory, table);
        expect(res.success).toBe(true);
        expect(res.count).toBe(2);
        expect(res.lastRun).toBe("0002_create-table-distributors.sql");

        const tableNames = await fetchTables();
        expect(tableNames).toEqual(["distributors", "films", "migrations"]);
    });

    test("has no effect when no new migrations are added to the directory", async () => {
        const directory = new URL("./test/migrations", import.meta.url).pathname;
        const table = "migrations";
        const res1 = await migrate(db, directory, table);
        expect(res1.success).toBe(true);
        expect(res1.count).toBe(2);
        expect(res1.lastRun).toBe("0002_create-table-distributors.sql");

        const res2 = await migrate(db, directory, table);
        expect(res2.success).toBe(true);
        expect(res2.count).toBe(0);
        expect(res2.lastRun).toBe(null);
    });

    test("executes only new migrations on subsequent runs", async () => {
        const directory1 = new URL("./test/migrations", import.meta.url).pathname;
        const table = "migrations";
        const res1 = await migrate(db, directory1, table);
        expect(res1.success).toBe(true);
        expect(res1.count).toBe(2);
        expect(res1.lastRun).toBe("0002_create-table-distributors.sql");

        const directory2 = new URL("./test/migrations-added", import.meta.url).pathname;
        const res2 = await migrate(db, directory2, table);
        expect(res2.success).toBe(true);
        expect(res2.count).toBe(1);
        expect(res2.lastRun).toBe("0003_create-table-cinemas.sql");

        const tableNames = await fetchTables();
        expect(tableNames).toEqual(["cinemas", "distributors", "films", "migrations"]);
    });

    test("responds with error code DB01", async () => {
        const directory = new URL("./test/migrations", import.meta.url).pathname;
        const table = "migrations";
        const res = await migrate(dbNoCreate, directory, table);
        expect(res.success).toBe(false);
        expect(res.count).toBe(0);
        expect(res.lastRun).toBe(null);
        expect(res.code).toBe("DB01");

        const tableNames = await fetchTables();
        expect(tableNames).toEqual([]);
    });

    test("responds with error code DB02", async () => {
        const directory = new URL("./test/migrations", import.meta.url).pathname;
        const table = "migrations";
        await createMigrationsTable(db, table); // create the migrations table with a different DB user
        const res = await migrate(dbNoSelect, directory, table);
        expect(res.success).toBe(false);
        expect(res.count).toBe(0);
        expect(res.lastRun).toBe(null);
        expect(res.code).toBe("DB02");

        const tableNames = await fetchTables();
        expect(tableNames).toEqual(["migrations"]);
    });

    test("responds with error code DB03", async () => {
        const directory = new URL("./test/migrations-db03", import.meta.url).pathname;
        const table = "migrations";
        const res = await migrate(db, directory, table);
        expect(res.success).toBe(false);
        expect(res.count).toBe(0);
        expect(res.lastRun).toBe(null);
        expect(res.code).toBe("DB03");

        const tableNames = await fetchTables();
        expect(tableNames).toEqual(["migrations"]);
    });

    test("responds with error code FS01", async () => {
        const directory = new URL("./test/migrations-fs01", import.meta.url).pathname; // non-existent directory
        const table = "migrations";
        const res = await migrate(db, directory, table);
        expect(res.success).toBe(false);
        expect(res.count).toBe(0);
        expect(res.lastRun).toBe(null);
        expect(res.code).toBe("FS01");

        const tableNames = await fetchTables();
        expect(tableNames).toEqual(["migrations"]);
    });

    test("responds with error code FS02", async () => {
        const directory1 = new URL("./test/migrations", import.meta.url).pathname;
        const table = "migrations";
        const res1 = await migrate(db, directory1, table);
        expect(res1.success).toBe(true);
        expect(res1.count).toBe(2);
        expect(res1.lastRun).toBe("0002_create-table-distributors.sql");

        const directory2 = new URL("./test/migrations-fs02", import.meta.url).pathname;
        const res2 = await migrate(db, directory2, table);
        expect(res2.success).toBe(false);
        expect(res2.count).toBe(0);
        expect(res2.lastRun).toBe(null);
        expect(res2.code).toBe("FS02");

        const tableNames = await fetchTables();
        expect(tableNames).toEqual(["distributors", "films", "migrations"]);
    });

    test("responds with error code FS03", async () => {
        const directory1 = new URL("./test/migrations", import.meta.url).pathname;
        const table = "migrations";
        const res1 = await migrate(db, directory1, table);
        expect(res1.success).toBe(true);
        expect(res1.count).toBe(2);
        expect(res1.lastRun).toBe("0002_create-table-distributors.sql");

        const directory2 = new URL("./test/migrations-fs03", import.meta.url).pathname;
        const res2 = await migrate(db, directory2, table);
        expect(res2.success).toBe(false);
        expect(res2.count).toBe(0);
        expect(res2.lastRun).toBe(null);
        expect(res2.code).toBe("FS03");

        const tableNames = await fetchTables();
        expect(tableNames).toEqual(["distributors", "films", "migrations"]);
    });


    test("responds with error code FS04", async () => {
        const directory1 = new URL("./test/migrations", import.meta.url).pathname;
        const table = "migrations";
        const res1 = await migrate(db, directory1, table);
        expect(res1.success).toBe(true);
        expect(res1.count).toBe(2);
        expect(res1.lastRun).toBe("0002_create-table-distributors.sql");

        const directory2 = new URL("./test/migrations-fs04", import.meta.url).pathname;
        const res2 = await migrate(db, directory2, table);
        expect(res2.success).toBe(false);
        expect(res2.count).toBe(0);
        expect(res2.lastRun).toBe(null);
        expect(res2.code).toBe("FS04");

        const tableNames = await fetchTables();
        expect(tableNames).toEqual(["distributors", "films", "migrations"]);
    });
});
