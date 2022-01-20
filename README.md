# Migrate

A simple Node.js database migration utility that works with ES Module syntax.

## Installation

```shell
yarn add @sscovil/migrate
# OR
npm install @sscovil/migrate
```

## Usage

Suppose your application directory structure looks like this:

```
app/
├─ node_modules/
├─ src/
│  ├─ db/
│  │  └─ migrations/
│  │     ├─ 0001_create-table-films.sql
│  │     └─ 0002_create-table-distributors.sql
│  └─ app.js
├─ package.json
└─ README.md
```

...and you want to be able to run your SQL database migrations, located in the `src/db/migrations/` directory.

In this case, you might add a file called `src/db/migrate.js` like this:

```javascript
// ES Module syntax
import migrate from "@sscovil/migrate";
import pg from "pg";

// CommonJS syntax
// const migrate = require("@sscovil/migrate");
// const pg = require("pg");
// const path = require("path");

// This example uses node-postgres, but any SQL client with a similar query() method should work
const db = new pg.Client();

// ES Module syntax
const directory = new URL("./migrations", import.meta.url).pathname;

// CommonJS syntax
// const directory = path.join(__dirname, "migrations");

// If you use a PostgreSQL schema, you can include that in the table name (ex: "foobar.migrations")
const table = "migrations";

// Immediately Invoked Function Expression (IIFE)
(async () => {
    try {
        await db.connect();
        const result = await migrate(db, directory, table);
        await db.end();
        console.log(result);
    } catch (err) {
        console.error(err);
    }
})();
```

...and then run it like this:

```shell
node src/db/migrate.js
```

## Return Value

The `migrate` function returns a
[Promise](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise) that resolves with
an object like this:

```
{
    success: boolean,
    message: string,
    count: integer,
    lastRun: string|null,
    error: Error|null,
    code: string|null
}
```

### success

The `success` field will be `true` if the function ran without error, even if there were no new migrations to run.

### message

The `message` field is a human-readable description of the results.

### count

The `count` field will indicate the number of migrations run.

### lastRun

The `lastRun` field will be the filename of the last migration run, or `null` if no migrations were run.

### error

The `error` field will contain the actual `Error` object that was thrown, or `null` if no error was thrown. 

### code

The `code` field will contain an error code that can be referenced below when troubleshooting.

### Error Codes

Error codes are prefixed with `DB` or `FS`, indicating whether the error occurred at the database or filesystem.

Code | Description | Troubleshooting
-----|-------------|----------------
DB01 | Error creating migrations database table | Ensure database user can `CREATE TABLE` in the current db/schema
DB02 | Error querying migrations database table | Ensure database user can `SELECT` records in the migrations table
DB03 | Error executing SQL contained in a migration file | Check for SQL errors in your migration file
FS01 | Error reading files from the migrations directory | Ensure migrations directory exists and user has read access
FS02 | One or more previously run migration files not found | Replace any missing files for previously run migrations
FS03 | Order of previously run migration files has changed | Ensure migration filenames are sequential
FS04 | Contents of a previously run migration file have changed | Revert changes to any previously run migration files

## Running Tests

The test suite for this library requires you to have [Docker](https://docs.docker.com/get-docker/) and
[Docker Compose](https://docs.docker.com/compose/) installed. This ensures that the test database is a clean
PostgreSQL installation, and the server running the tests is using Node.js v16 (LTS) with the experimental-vm-modules
flag for [Jest ES Module support](https://jestjs.io/docs/ecmascript-modules).

To run tests, use:

```shell
yarn run test
# OR
npm test
```
