const {loadEnvConfig} = require('@next/env');
const dev = process.env.NODE_ENV !== 'production';
const {WORK_DIR, REPO, BRANCH} = loadEnvConfig('./', dev).combinedEnv;

const argv = require('yargs').default('work_dir', WORK_DIR).default('repo', REPO).default('branch', BRANCH).argv;
const {work_dir, repo, branch} = argv;
const cwd = `${work_dir}/${repo}`;

const dayjs = require('dayjs');
const isoWeek = require('dayjs/plugin/isoWeek');
const quarterOfYear = require('dayjs/plugin/quarterOfYear');
dayjs.extend(quarterOfYear);
dayjs.extend(isoWeek);

const {writeJsonToFile} = require('./util');
const knexConnection = require('../knexfile');

function getKnexClient() {
    const client = process.env.PRODUCTION ? knexConnection.production : knexConnection.development;
    return require('knex')(client); // eslint-disable-line global-require
}

const childProcess = require('child_process');
const spawn = childProcess.spawn;

let git = spawn('git', ['log', '--pretty=format:%H|%ad|%s%d|%an'], {cwd});
// buffer for data
let buf = Buffer.alloc(0);

git.stdout.on('data', (data) => {
    buf = Buffer.concat([buf, data]);
});

git.stderr.on('data', (data) => {
    console.log(data.toString());
});

git.on('close', async (code) => {
    const tableName = 'track_commits';
    const knexClient = getKnexClient();

    const latestCommit = await knexClient(tableName)
        .where({
            repo,
            branch,
        })
        .orderBy('committed_at', 'desc')
        .first();

    // convert to string and split based on end of line
    let subjects = buf.toString().split('\n');
    // pop the last empty string element
    subjects.pop();

    const commits = [];
    let found = false;
    subjects.forEach((sub, i) => {
        if (!found && sub && subjects[i + 1]) {
            const info = getInfo(sub);
            console.log(i);

            if (latestCommit?.hash === info.hash && latestCommit?.branch === branch) {
                console.log('found', info.hash);
                found = true;
                return;
            }
            const nextInfo = getInfo(subjects[i + 1]);

            const changes = getChanges(info, nextInfo);

            const commit = {repo, branch, ...info, ...changes, total: 1};
            commits.push(commit);
        }
    });

    if (commits.length > 0) {
        try {
            const chunkSize = 30;
            await knexClient.transaction((trx) => {
                return knexClient.batchInsert(tableName, commits, chunkSize).transacting(trx);
            });

            writeJsonToFile(commits, `${repo}-${branch}.json`).then(() => {
                process.exit(1);
            });
        } catch (error) {
            console.error(error);
        }
    } else {
        process.exit(1);
    }
});

function getInfo(line) {
    const [hash, committed_at, title, author] = line.split('|');
    const weekPerYear = 52;
    const monthPerYear = 12;

    const committedAt = dayjs(committed_at);
    const year = committedAt.year();
    const month = (committedAt.month() + 1) % monthPerYear;
    const week = (committedAt.isoWeek() + 1) % weekPerYear;

    return {
        hash,
        title,
        author,
        committed_at,
        formatted_committed_at: committedAt.toISOString(),
        per_year: year.toString(),
        per_month: `${year}-${month < 10 ? '0' : ''}${month}`,
        per_quarter: `${year}-${committedAt.quarter()}`,
        per_week: `${year}-${week < 10 ? '0' : ''}${week}`,
        year,
        month,
        week,
    };
}

function getChanges(info, nextInfo) {
    const numStat = childProcess.spawnSync(
        'git',
        ['log', '--numstat', '--pretty="%H"', `${info.hash}...${nextInfo.hash}`],
        {cwd},
    );
    const codeChange = numStat.stdout.toString();
    const detail = getCodeChangeDetail(codeChange);

    const with_e2e = detail.e2e_test_file.length > 0 ? 1 : 0;
    const with_unit = detail.unit_test_file.length > 0 ? 1 : 0;
    const with_test = with_e2e || with_unit;
    const require_unit_test =
        Boolean(detail.require_unit_test_file.length) || Boolean(detail.unit_test_file.length) ? 1 : 0;

    return {
        compared_to: nextInfo.hash,
        with_e2e,
        with_unit,
        with_test,
        require_unit_test,
        compliance: Boolean(require_unit_test) && Boolean(detail.unit_test_file.length) ? 1 : 0,
        ...detail,
    };
}

function isE2ETest(file) {
    return (
        file.includes('_spec.') || // for webapp
        file.includes('.e2e.') || // for mobile
        (file.includes('e2e/specs') && file.includes('.test.')) // for desktop
    );
}

function isUnitTest(file) {
    return file.includes('.test.') || file.includes('_test') || file.includes('storetest');
}

function isMainLanguage(file) {
    const extRegex = /(.*?)\.(js|jsx|ts|tsx|go)([}]*)$/;
    return extRegex.test(file);
}

function isInRoot(file) {
    return file.split('/').length === 1;
}

function isTypes(file) {
    return file.endsWith('.d.ts') || file.startsWith('types/');
}

function isStorybook(file) {
    return file.startsWith('storybook/') || file.startsWith('.storybook/');
}

function isTestHelper(file) {
    return file.startsWith('tests/');
}

function isE2EUtil(file) {
    return file.startsWith('e2e/');
}

function isTestComplete(file) {
    return file.includes('store/sqlstore/upgrade.go') || file.includes('model/feature_flags.go');
}

function isNotRequired(file) {
    return file.includes('app/app_iface.go');
}

function isGoVendor(file) {
    return file.startsWith('vendor/');
}

function isGoImports(file) {
    return file.startsWith('imports/');
}

function isGoEInterfaces(file) {
    return file.startsWith('einterfaces/');
}

function isGoTestHelpers(file) {
    return (
        file.startsWith('testlib/') ||
        file.endsWith('testlib.go') ||
        file.startsWith('tests/') ||
        file.startsWith('manualtesting/') ||
        file.startsWith('plugintest/')
    );
}

function isGoMocks(file) {
    return file.includes('/mocks/');
}

function isGoDBMigration(file) {
    return file.startsWith('db/migrations/');
}

function getCodeChangeDetail(codeChange) {
    return codeChange
        .split('\n')
        .filter((line) => {
            const columns = line.split('\t');
            return columns.length === 3;
        })
        .reduce(
            (acc, line) => {
                const columns = line.split('\t');
                const codePlus = parseInt(columns[0], 10);
                const codeMinus = parseInt(columns[1], 10);
                const file = columns[2];

                acc.code_plus += codePlus > 0 ? codePlus : 0;
                acc.code_minus += codeMinus > 0 ? codeMinus : 0;

                if (isE2ETest(file)) {
                    acc.e2e_test_file.push(file);
                } else if (isUnitTest(file)) {
                    acc.unit_test_file.push(file);
                } else if (isMainLanguage(file)) {
                    if (
                        isInRoot(file) ||
                        isTypes(file) ||
                        isStorybook(file) ||
                        isTestHelper(file) ||
                        isE2EUtil(file) ||
                        isTestComplete(file) ||
                        isNotRequired(file) ||
                        isGoVendor(file) ||
                        isGoImports(file) ||
                        isGoEInterfaces(file) ||
                        isGoTestHelpers(file) ||
                        isGoMocks(file) ||
                        isGoDBMigration(file)
                    ) {
                        acc.not_require_unit_test_file.push(file);
                    } else {
                        acc.require_unit_test_file.push(file);
                    }
                } else {
                    acc.not_require_unit_test_file.push(file);
                }

                return acc;
            },
            {
                e2e_test_file: [],
                unit_test_file: [],
                require_unit_test_file: [],
                not_require_unit_test_file: [],
                code_plus: 0,
                code_minus: 0,
            },
        );
}
