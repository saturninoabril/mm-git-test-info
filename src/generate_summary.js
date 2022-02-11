const {loadEnvConfig} = require('@next/env');

const dev = process.env.NODE_ENV !== 'production';
const {REPO, BRANCH, PERIOD} = loadEnvConfig('./', dev).combinedEnv;

const dayjs = require('dayjs');
const isoWeek = require('dayjs/plugin/isoWeek');
const quarterOfYear = require('dayjs/plugin/quarterOfYear');
dayjs.extend(quarterOfYear);
dayjs.extend(isoWeek);

const {readJsonFromFile, writeJsonToFile} = require('./util');

const argv = require('yargs')
    .default('file', `${REPO}-${BRANCH}.json`)
    .default('period', PERIOD || 'week').argv;
const {file, period} = argv;
const data = readJsonFromFile(file);

const groups = data.reduce((acc, d) => {
    const committedAt = dayjs(d.committed_at);
    const defaultPeriodByWeek = `-${committedAt.isoWeek() + 1}`;
    const groupByPeriod =
        period === 'week'
            ? defaultPeriodByWeek
            : period === 'month'
            ? `-${committedAt.month() + 1}`
            : period === 'year'
            ? '-0'
            : defaultPeriodByWeek;
    const byPeriod = committedAt.year() + groupByPeriod;

    // add this key as a property to the result object
    if (!acc[byPeriod]) {
        acc[byPeriod] = [];
    }

    // push the current date that belongs to the year-period calculated before
    acc[byPeriod].push(d);

    return acc;
}, {});

const newData = Object.entries(groups).map(([key, value]) => {
    let total_count = 0;
    let require_unit_test = 0;
    let e2e = 0;
    let unit = 0;

    value.forEach((v) => {
        total_count += v.count;
        require_unit_test += v.require_unit_test ? 1 : 0;
        e2e += v.with_e2e ? 1 : 0;
        unit += v.with_unit ? 1 : 0;
    });

    return {
        key,
        total_count,
        require_unit_test,
        e2e,
        unit,
        rate: require_unit_test ? round(unit / require_unit_test, 2) : 0,
    };
});

function round(value, decimals) {
    return Number(Math.round(value + 'e' + decimals) + 'e-' + decimals);
}

writeJsonToFile(newData, `${period}-${file}`);
