import * as chai from 'chai';
import { SSPClient } from 'ssp-client';
import * as server from '../resources/server-util';
import 'mocha';

const expect = chai.expect;

describe('Discovery', () => {

    let client: SSPClient;
    let port: number;

    before(function(done) {
        this.timeout(300000);
        server.download()
        .then(() => { return server.getWildfly() })
        .then(() => { return server.start() })
        .then(async (result) => {
            port = result;
            client = new SSPClient('localhost', port);
            await client.connect();
            done();
        });
    });

    after(() => {
        client.disconnect();
        server.stop();
    });

    it('findServerBeans should find wildfly', async () => {
       const beans = await client.findServerBeans('../wildfly');

       expect(beans[0].serverAdapterTypeId).equals('org.jboss.ide.eclipse.as.wildfly.130');
       expect(beans[0].specificType).equals('WildFly');
       expect(beans[0].typeCategory).equals('WildFly');
       expect(beans[0].fullVersion).equals('13.0.0.Final');
    });

    it('findServerBeans should find EAP', async () => {
        // TODO
    });

    it('findServerBeans should not find anything in a non-server folder', async () => {
        const beans = await client.findServerBeans('.');

        expect(beans[0].typeCategory).equals('UNKNOWN');
        expect(beans[0].version).empty;
        expect(beans[0].serverAdapterTypeId).undefined;
        expect(beans[0].specificType).undefined;
        expect(beans[0].fullVersion).undefined;
    });

    it('addDiscoveryPath should add a path to server', async () => {
        const path = await client.addDiscoveryPathSync('foo');
        const filled = await client.getDiscoveryPaths();
        expect(filled).deep.include(path);

        await client.removeDiscoveryPathSync(path);
    });
    
    it('addDiscoveryPath should handle the same path being added twice', async function() {
        const path = await client.addDiscoveryPathSync('bar');

        const status = await client.addDiscoveryPathAsync(path.filepath);
        
        expect(status.message).not.equal('ok');
        expect(status.severity).greaterThan(0);

        await client.removeDiscoveryPathSync(path);
    });

    it('removeDiscoveryPath should remove an existing path', async () => {
        const path = await client.addDiscoveryPathSync('baz');

        const filled = await client.getDiscoveryPaths();
        expect(filled).deep.include(path);

        await client.removeDiscoveryPathSync(path);
        expect(await client.getDiscoveryPaths()).not.deep.include(path);
    });

    it('removeDiscoveryPath should handle a non existing path', async function() {
        const status = await client.removeDiscoveryPathAsync('path');

        expect(status.message).not.equal('ok');
        expect(status.severity).greaterThan(0);
    });

    it('getDiscoveryPaths should return all paths', async () => {
        const path1 = await client.addDiscoveryPathSync('path1');
        const path2 = await client.addDiscoveryPathSync('path2');

        const filled = await client.getDiscoveryPaths();
        expect(filled).deep.include.members([path1, path2]);
    });
});