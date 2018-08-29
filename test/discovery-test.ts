import * as chai from 'chai';
import { RSPClient, Protocol } from 'rsp-client';
import * as server from '../resources/server-util';
import 'mocha';
import * as path from 'path';

const expect = chai.expect;
const wildFlyRoot = path.resolve('./wildfly');

describe('Discovery', () => {

    let client: RSPClient;
    let port: number;

    before(function(done) {
        this.timeout(300000);
        server.clearData();
        server.download()
        .then(() => { return server.getWildfly(); })
        .then(() => { return server.start(); })
        .then(async (result) => {
            port = result;
            client = new RSPClient('localhost', port);
            await client.connect();
            done();
        });
    });

    after(() => {
        client.disconnect();
        server.stop();
        server.clearData();
    });

    it('findServerBeans should find wildfly', async () => {
        const beans = await client.findServerBeans(wildFlyRoot);

        expect(beans[0].serverAdapterTypeId).equals('org.jboss.ide.eclipse.as.wildfly.130');
        expect(beans[0].specificType).equals('WildFly');
        expect(beans[0].typeCategory).equals('WildFly');
        expect(beans[0].fullVersion).equals('13.0.0.Final');
    });

    it('findServerBeans should not find anything in a non-server folder', async () => {
        const beans = await client.findServerBeans(`${wildFlyRoot}/foo`);

        expect(beans[0].typeCategory).equals('UNKNOWN');
        expect(beans[0].version).empty;
        expect(beans[0].serverAdapterTypeId).undefined;
        expect(beans[0].specificType).undefined;
        expect(beans[0].fullVersion).undefined;
    });

    it('findServerBeans handles null path', async () => {
        const beans = await client.findServerBeans(null);

        expect(beans).empty;
    });

    it('findServerBeans refuses relative paths', async () => {
        const beans = await client.findServerBeans('../foo');

        expect(beans).empty;
    });

    it('addDiscoveryPath should add a path to server', async () => {
        const path = await client.addDiscoveryPathSync(wildFlyRoot);
        const filled = await client.getDiscoveryPaths();
        await client.removeDiscoveryPathSync(path);

        expect(filled).deep.include(path);
    });
    
    it('addDiscoveryPath should handle the same path being added twice', async () => {
        const path = await client.addDiscoveryPathSync(wildFlyRoot);

        const status = await client.addDiscoveryPathAsync(path.filepath);
        await client.removeDiscoveryPathSync(path);
        
        expect(status.message).not.equal('ok');
        expect(status.severity).greaterThan(0);
    });

    it('addDiscoveryPath should handle null paths', async () => {
        const status = await client.addDiscoveryPathAsync(null);
   
        expect(status.message).not.equal('ok');
        expect(status.severity).greaterThan(0);
    });

    it('addDiscoveryPath should handle invalid paths', async () => {
        const status = await client.addDiscoveryPathAsync('foo');

        expect(status.message).not.equal('ok');
        expect(status.severity).greaterThan(0);
    });

    it('addDiscoveryPath should respond with a notification', (done) => {
        const apath = path.resolve('.');
        const listener = (path: Protocol.DiscoveryPath) => {
            if (path.filepath === apath) {
                client.removeListener('discoveryPathAdded', listener);
                client.removeDiscoveryPathSync(path);
                done();
            }
        }
        client.onDiscoveryPathAdded(listener);
        client.addDiscoveryPathAsync(apath);
    });

    it('removeDiscoveryPath should remove an existing path', async () => {
        const path = await client.addDiscoveryPathSync(wildFlyRoot);

        const filled = await client.getDiscoveryPaths();
        expect(filled).deep.include(path);

        await client.removeDiscoveryPathSync(path);
        expect(await client.getDiscoveryPaths()).not.deep.include(path);
    });

    it('removeDiscoveryPath should handle a non existing path', async () => {
        const status = await client.removeDiscoveryPathAsync('path');

        expect(status.message).not.equal('ok');
        expect(status.severity).greaterThan(0);
    });

    it('removeDiscoveryPath should handle null paths', async () => {
        const status = await client.removeDiscoveryPathAsync(null);

        expect(status.message).not.equal('ok');
        expect(status.severity).greaterThan(0);
    });

    it('removeDiscoveryPath should handle invalid paths', async () => {
        const status = await client.removeDiscoveryPathAsync('null');

        expect(status.message).not.equal('ok');
        expect(status.severity).greaterThan(0);
    });

    it('removeDiscoveryPath should respond with a notification', (done) => {
        const rpath = path.resolve('./server');
        const listener = (path: Protocol.DiscoveryPath) => {
            if (path.filepath === rpath) {
                client.removeListener('discoveryPathRemoved', listener);
                done();
            }
        }
        client.onDiscoveryPathAdded(listener);
        client.addDiscoveryPathAsync(rpath).then(() => { 
            client.removeDiscoveryPathSync(rpath);
        });
    });

    it('getDiscoveryPaths should return all paths', async () => {
        const path1 = await client.addDiscoveryPathSync(path.resolve('.'));
        const path2 = await client.addDiscoveryPathSync(path.resolve('./test'));

        const filled = await client.getDiscoveryPaths();
        expect(filled).deep.include.members([path1, path2]);
    });
});