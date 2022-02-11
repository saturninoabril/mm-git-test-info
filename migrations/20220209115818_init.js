exports.up = function (knex) {
    return knex.schema.createTable('track_commits', function (table) {
        table.increments();
        table.string('repo').notNullable();
        table.string('branch').notNullable();
        table.string('hash').notNullable();
        table.string('author').notNullable();
        table.string('title', 500).notNullable();
        table.timestamp('committed_at').notNullable();
        table.timestamp('formatted_committed_at').notNullable();
        table.string('compared_to').notNullable();
        table.timestamp('created_at').defaultTo(knex.fn.now());
        table.timestamp('updated_at').defaultTo(knex.fn.now());
        table.integer('code_plus').notNullable();
        table.integer('code_minus').notNullable();
        table.integer('year').notNullable();
        table.integer('month').notNullable();
        table.integer('week').notNullable();
        table.string('per_year').notNullable();
        table.string('per_quarter').notNullable();
        table.string('per_month').notNullable();
        table.string('per_week').notNullable();
        table.integer('total').notNullable();
        table.integer('with_test');
        table.integer('with_e2e');
        table.integer('with_unit');
        table.integer('require_unit_test');
        table.integer('compliance');
        table.specificType('e2e_test_file', 'text ARRAY');
        table.specificType('unit_test_file', 'text ARRAY');
        table.specificType('require_unit_test_file', 'text ARRAY');
        table.specificType('not_require_unit_test_file', 'text ARRAY');
        table.unique(['hash', 'repo', 'branch']);
    });
};

exports.down = function (knex) {
    return knex.schema.dropTable('commits');
};
