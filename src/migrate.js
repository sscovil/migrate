import crypto from "crypto";
import { readdir, readFile } from "fs/promises";

const errors = {
  DB01: "DB01", // Error creating migrations database table
  DB02: "DB02", // Error querying migrations database table
  DB03: "DB03", // Error executing SQL contained in a migration file
  FS01: "FS01", // Error reading files from the migrations directory
  FS02: "FS02", // One or more previously run migration files not found
  FS03: "FS03", // Order of previously run migration files has changed
  FS04: "FS04", // Contents of a previously run migration file have changed
};

export default async function migrate(db, directory, table = "migrations") {
  let allMigrations;
  let previouslyRun;

  const res = {
    success: false,
    message: "",
    count: 0,
    lastRun: null,
    error: null,
    code: null,
  }

  try {
    await createMigrationsTable(db, table);
  } catch (err) {
    res.message = `Error creating '${table}' database table`;
    res.error = err;
    res.code = errors.DB01;
    return res;
  }

  try {
    allMigrations = await getAllMigrations(directory);
  } catch (err) {
    res.message = `Error reading migrations from directory: ${directory}`;
    res.error = err;
    res.code = errors.FS01;
    return res;
  }

  try {
    previouslyRun = await getPreviouslyRunMigrations(db, table);
  } catch (err) {
    res.message = `Error querying previously run migrations from '${table}' database table`;
    res.error = err;
    res.code = errors.DB02;
    return res;
  }

  const missing = previouslyRun
      .map(({ filename }) => filename)
      .filter((filename) => !allMigrations.includes(filename));

  if (missing.length) {
    res.message = `Missing previously run migration files: ${missing}`;
    res.code = errors.FS02;
    return res;
  }

  for (let i = 0; i < allMigrations.length; i++) {
    const filename = allMigrations[i];
    const migration = await readFile(`${directory}/${filename}`, "utf8");
    const checksum = getChecksum(migration);

    if (i < previouslyRun.length) {
      const previous = previouslyRun[i];

      if (filename !== previous.filename) {
        res.message = `Expected migration ${previous.filename} but found ${filename} at index ${i}`;
        res.code = errors.FS03;
        return res;
      }

      if (checksum !== previous.checksum) {
        res.message = `Contents of ${filename} changed after migration was run; revert changes and try again`;
        res.code = errors.FS04;
        return res;
      }

      continue; // do not re-run a previously run migration
    }

    try {
      await db.query("BEGIN");
      await runMigration(db, table, migration, filename, checksum);
      await db.query("COMMIT");
    } catch (err) {
      await db.query("ROLLBACK");
      res.message = `Error running database migration: ${filename}`;
      res.error = err;
      res.code = errors.DB03;
      return res;
    }

    res.lastRun = filename;
    res.count++;
  } // end for i loop

  res.success = true;
  res.message = res.count
      ? `Ran ${res.count} new database migrations, ending with ${res.lastRun}`
      : `No new database migrations found in directory: ${directory}`;

  return res;
}

export function createMigrationsTable(db, table) {
  return db.query(
      `CREATE TABLE IF NOT EXISTS ${table} (
        id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
        filename    TEXT         UNIQUE NOT NULL,
        checksum    TEXT         NOT NULL,
        created_at  TIMESTAMPTZ  NOT NULL DEFAULT timezone('utc', now())
     );`
  );
}

export function getChecksum(data) {
  return crypto.createHash("sha1").update(data).digest("hex");
}

export async function getAllMigrations(directory) {
  const allFilesInDirectory = await readdir(directory, {
    encoding: "utf8",
  });
  const allSQLFiles = allFilesInDirectory.filter((filename) =>
    filename.match(/\.sql$/i)
  );
  return allSQLFiles.sort();
}

export async function getPreviouslyRunMigrations(db, table) {
  const result = await db.query(
    `SELECT filename, checksum FROM ${table} ORDER BY created_at`
  );
  return result.rows;
}

export async function runMigration(db, table, migration, filename, checksum) {
  await db.query(migration);
  await db.query(
      `INSERT INTO ${table} (filename, checksum) VALUES ($1, $2);`,
      [filename, checksum]
  );
}
