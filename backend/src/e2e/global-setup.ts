import { execSync } from "child_process";

/**
 * Provisions a disposable MySQL container for the E2E run so tests never touch
 * a developer's local database. If a database is already supplied via
 * E2E_DATABASE_URL (as in CI, which runs MySQL as a service), it is used as-is.
 */

const CONTAINER = "wa-e2e-mysql";
const PORT = 3399;
const DB_URL = `mysql://root:e2eroot@127.0.0.1:${PORT}/whatsapp_e2e`;

const run = (command: string) =>
  execSync(command, { stdio: "pipe", encoding: "utf8" }).trim();

const isReady = (): boolean => {
  try {
    run(`docker exec ${CONTAINER} mysqladmin ping -h127.0.0.1 -uroot -pe2eroot`);
    return true;
  } catch {
    return false;
  }
};

export async function setup() {
  if (process.env.E2E_DATABASE_URL) {
    process.env.DATABASE_URL = process.env.E2E_DATABASE_URL;
  } else {
    const running = (() => {
      try {
        return run(`docker ps -q -f name=^${CONTAINER}$`).length > 0;
      } catch {
        return false;
      }
    })();

    if (!running) {
      try {
        run(`docker rm -f ${CONTAINER}`);
      } catch {
        // No stale container to remove.
      }
      run(
        `docker run -d --name ${CONTAINER} -e MYSQL_ROOT_PASSWORD=e2eroot ` +
          `-e MYSQL_DATABASE=whatsapp_e2e -p ${PORT}:3306 mysql:8.4`
      );
    }

    const deadline = Date.now() + 60000;
    while (!isReady()) {
      if (Date.now() > deadline) {
        throw new Error("E2E MySQL container did not become ready within 60s");
      }
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    process.env.DATABASE_URL = DB_URL;
  }

  execSync("npx prisma migrate deploy", {
    stdio: "pipe",
    env: { ...process.env, DATABASE_URL: process.env.DATABASE_URL },
  });
}

export async function teardown() {
  // The container is intentionally left running to keep repeat runs fast.
  // Remove it with: docker rm -f wa-e2e-mysql
}
