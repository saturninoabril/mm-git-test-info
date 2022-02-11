# mm-git-test-info

Use to get commits data and test information from git

## 1. Run docker compose to spin up the services, especially the PostgreSQL

```
make run-dev
```

## 2. Setup environment variables

```
cp sampleenv.development.local env.development.local
```

The change the following required environment variables

-   `WORK_DIR`: a directory where to find local repo
-   `REPO`: name of a repo
-   `BRANCH`: branch to extract commits

## 3. Install packages

```
npm install
```

## 4. Verify database connection and update database schema

```
npm run migrate:latest
```

## 5. Extract commit information

```
node src/extract_commit.js
```

Verify that commits information are saved into the database and into a file at local `tmp/` directory.

## 6. Generate summary based from extracted information

Optional: only used for quick verification.
May set `PERIOD` environment variables to "week" (default), "month" or "year".

```
node src/generate_summary.js
```

## 6. Access Grafana

Access Grafana at `http://localhost:3000`

-   setup PostgreSQL as datasource
-   load dashboard setup from `grafana/grafana.json`
