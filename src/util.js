const fse = require('fs-extra');
const {loadEnvConfig} = require('@next/env');
const dev = process.env.NODE_ENV !== 'production';
const {TMP_DIR} = loadEnvConfig('./', dev).combinedEnv;

const argv = require('yargs').default('tmp_dir', 'tmp' || TMP_DIR).argv;
const {tmp_dir} = argv;

function writeJsonToFile(data, filename) {
    fse.ensureDirSync(tmp_dir);

    return fse
        .writeJson(`${tmp_dir}/${filename}`, data)
        .then(() => console.log('Successfully written:', filename))
        .catch((err) => console.error(err));
}

function readJsonFromFile(file) {
    try {
        fse.ensureDirSync(tmp_dir);
        return fse.readJsonSync(`${tmp_dir}/${file}`);
    } catch (err) {
        return {err};
    }
}

module.exports = {
    readJsonFromFile,
    writeJsonToFile,
};
