const {loadEnvConfig} = require('@next/env');

const dev = process.env.NODE_ENV !== 'production';
const {PG_DB_CONNECTION} = loadEnvConfig('./', dev).combinedEnv;

module.exports = {
    development: {
        client: 'postgresql',
        connection: PG_DB_CONNECTION,
        pool: {
            min: 2,
            max: 10,
        },
        migrations: {
            directory: './migrations',
        },
    },
    production: {
        client: 'postgresql',
        connection: PG_DB_CONNECTION,
        migrations: {
            directory: './migrations',
        },
        pool: {
            min: 0,
            max: 7,
            afterCreate: function (conn, done) {
                conn.query('SELECT 1 + 1;', function (err) {
                    if (err) {
                        console.log('Error: on newly created pool');
                    } else {
                        console.log('Success: New pool created');
                    }

                    done(err, conn);
                });
            },
        },
    },
};
