const download = require('download');
const decompress = require('decompress');
const findJava = require('find-java-home');
const path = require('path');
const cp = require('child_process');
const fs = require('fs');

const baseUrl = 'http://download.jboss.org/jbosstools/adapters/snapshots/';
const fileName = 'org.jboss.tools.ssp.distribution';
const serverRoot = './server';

let serverProcess;

function downloadServer(version) {
    const defaultVersion = version ? version : '0.0.9-SNAPSHOT';
    const finalFile = `${fileName}-${defaultVersion}.zip`;
    const url = `${baseUrl}${finalFile}`;

    if (fs.existsSync(path.join(serverRoot, 'bin', 'felix.jar'))) {
        return Promise.resolve();
    }

    return download(url, '.')
    .then(() => { return decompress(finalFile, serverRoot, { strip: 1 }); })
    .catch(err => { throw err; });
}

function startServer() {
    return new Promise((resolve, reject) => {
        findJava((err, home) => {
            if (err) {
                return reject(err);
            }
            const serverPath = path.join('bin', 'felix.jar');
            const javaPath = path.join(home, 'bin', 'java');
            if (!serverProcess) {
                serverProcess = cp.spawn(javaPath, ['-jar', serverPath], { cwd: serverRoot });
            }
            const portRegex = /.+port\s(\d+)/;
            
            serverProcess.stdout.on('data', data => {
                let port = data.toString().match(portRegex) ? data.toString().match(portRegex)[1] : null;
                if (port) {
                    resolve(port);
                }
            });
        });
    });
}

function stopServer() {
    serverProcess.kill();
}

function getWildfly() {
    const wildflyRoot = './wildfly'
    const fileName = 'wildfly-13.0.0.Final.zip';

    if(fs.existsSync(path.join(wildflyRoot, 'bin'))) {
        return Promise.resolve();
    }

    return download('http://download.jboss.org/wildfly/13.0.0.Final/wildfly-13.0.0.Final.zip', '.')
    .then(() => { return decompress(fileName, wildflyRoot, { strip: 1 })})
    .catch(err => { throw err; });
}

module.exports = {
    download: downloadServer,
    start: startServer,
    stop: stopServer,
    getWildfly: getWildfly
};