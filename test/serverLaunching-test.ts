import * as chai from 'chai';
import { SSPClient, Protocol, ServerState } from 'ssp-client';
import * as server from '../resources/server-util';
import 'mocha';
import * as path from 'path';


const expect = chai.expect;

describe('Server Launcher', () => {

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

    it('getLaunchModes returns a list of launch modes for a server type', async () => {
        const type: Protocol.ServerType = {
            description: 'servertype',
            id: 'org.jboss.ide.eclipse.as.wildfly.130',
            visibleName: 'type'
        };

        const modes = await client.getServerLaunchModes(type);
        expect(modes).deep.include({ mode: 'run', desc: 'A launch mode indicating a simple run.' });
        expect(modes).deep.include({ mode: 'debug',
        desc: 'A launch mode indicating a debug launch, which can add the appropriate debugging flags or system properties as required.' });
    });

    // fails with https://issues.jboss.org/browse/JBIDE-26254
    it('getLaunchModes handles an invalid server type', async () => {
        const type: Protocol.ServerType = {
            description: 'servertype',
            id: 'unknown',
            visibleName: 'type'
        };

        const modes = await client.getServerLaunchModes(type, 500);
    });

    // fails with https://issues.jboss.org/browse/JBIDE-26281
    it('getRequiredLaunchAttributes returns attributes object for a valid input', async () => {
        const handle = await client.createServerSync('../wildfly', 'wildfly1');
        const launchAttr: Protocol.LaunchAttributesRequest = {
            id: handle.id,
            mode: 'run'
        };
        const attrs = await client.getServerRequiredLaunchAttributes(launchAttr);
        await client.deleteServerSync(handle);

        expect(attrs).not.null;
    });

    // passes probably because the method is broken and returns null anyway
    it('getRequiredLaunchAttributes handles invalid values', async () => {
        const launchAttr: Protocol.LaunchAttributesRequest = {
            id: 'foo',
            mode: 'run'
        };
        const attrs = await client.getServerRequiredLaunchAttributes(launchAttr);
        expect(attrs).null;
    });

    // fails with https://issues.jboss.org/browse/JBIDE-26281
    it('getOptionalLaunchAttributes returns attributes object for a valid input', async () => {
        const handle = await client.createServerSync('../wildfly', 'wildfly2');
        const launchAttr: Protocol.LaunchAttributesRequest = {
            id: handle.id,
            mode: 'run'
        };
        const attrs = await client.getServerOptionalLaunchAttributes(launchAttr);
        await client.deleteServerSync(handle);

        expect(attrs).not.null;
    });

    // passes probably because the method is broken and returns null anyway
    it('getOptionalLaunchAttributes handles invalid values', async () => {
        const launchAttr: Protocol.LaunchAttributesRequest = {
            id: 'foo',
            mode: 'run'
        };
        const attrs = await client.getServerOptionalLaunchAttributes(launchAttr);
        expect(attrs).null;
    });

    it('getLaunchCommand returns a cli command with valid parameters', async () => {
        const handle = await client.createServerSync('../wildfly', 'wildfly3');
        const params: Protocol.LaunchParameters = {
            mode: 'run',
            params: {
                id: handle.id,
                serverType: handle.type.id,
                attributes: {}
            }
        };

        const command = await client.getServerLaunchCommand(params);
        await client.deleteServerSync(handle);

        expect(command.cmdLine).not.empty;
        expect(command.workingDir).not.empty;
    });

    it('getLaunchCommand should handle invalid values', async () => {
        const params: Protocol.LaunchParameters = {
            mode: 'run',
            params: {
                id: 'foo',
                serverType: 'bar',
                attributes: {}
            }
        };

        const command = await client.getServerLaunchCommand(params);
        expect(command).null;
    });

    // fails with https://issues.jboss.org/browse/JBIDE-26254
    it('getLaunchCommand should handle null values', async () => {
        const command = await client.getServerLaunchCommand(null, 500);
        expect(command).null;
    });

    it('serverStartingByClient passes with valid parameters', async () => {
        const handle = await client.createServerSync('../wildfly', 'wildfly4');
        const params: Protocol.ServerStartingAttributes = {
            initiatePolling: false,
            request: {
                mode: 'run',
                params: {
                    id: handle.id,
                    serverType: handle.type.id,
                    attributes: {}
                }
            }
        };

        const status = await client.serverStartingByClient(params);
        await client.deleteServerSync(handle);

        expect(status.severity).equals(0);
        expect(status.message).equals('ok');
    });

    it('serverStartingByClient handles invalid parameters', async () => {
        const params: Protocol.ServerStartingAttributes = {
            initiatePolling: false,
            request: {
                mode: 'run',
                params: {
                    id: 'foo',
                    serverType: 'bar',
                    attributes: {}
                }
            }
        };

        const status = await client.serverStartingByClient(params);

        expect(status.severity).greaterThan(0);
        expect(status.message).equals('Server foo does not exist');
    });

    // fails with https://issues.jboss.org/browse/JBIDE-26254
    it('serverStartingByClient handles null parameters', async () => {
        const status = await client.serverStartingByClient(null, 500);
    });

    it('serverStartedByClient passes with valid parameters', async () => {
        const handle = await client.createServerSync('../wildfly', 'wildfly5');
        const params: Protocol.LaunchParameters = {
            mode: 'run',
            params: {
                id: handle.id,
                serverType: handle.type.id,
                attributes: {}
            }
        };

        const status = await client.serverStartedByClient(params);

        expect(status.severity).equals(0);
        expect(status.message).equals('ok');
    });

    it('serverStartedByClient handles invalid parameters', async () => {
        const params: Protocol.LaunchParameters = {
            mode: 'run',
            params: {
                id: 'foo',
                serverType: 'bar',
                attributes: {}
            }
        };

        const status = await client.serverStartedByClient(params);

        expect(status.severity).greaterThan(0);
        expect(status.message).equals('Server foo does not exist');
    });

    // fails with https://issues.jboss.org/browse/JBIDE-26254
    it('serverStartedByClient handles null parameters', async () => {
        const status = await client.serverStartedByClient(null, 500);
    });

    describe('Starting Servers', () => {
        let handle: Protocol.ServerHandle;
        let params: Protocol.LaunchParameters;
        let stop = false;

        beforeEach(async () => {
            handle = await client.createServerSync(path.resolve('./wildfly'), 'wildfly6');
            params = {
                mode: 'run',
                params: {
                    id: handle.id,
                    serverType: handle.type.id,
                    attributes: {
                        'server.home.dir': path.resolve('./wildfly')
                    }
                }
            };
            stop = false;
        });

        afterEach(async function () {
            this.timeout(5000);
            if (stop) {
                await client.stopServerSync({ id: handle.id, force: true });
            }
            await client.deleteServerSync(handle);
        });

        it('startServerAsync should start a valid server', function(done) {
            this.timeout(6000);
            stop = true;
            async function testit() {
                const listener = (param: Protocol.ServerStateChange) => {
                    if (param.server.id != handle.id) {
                        return;
                    }
                    if (param.state === ServerState.STARTED) {
                        client.removeListener('serverStateChange', listener);
                        done();
                    }
                };
                client.onServerStateChange(listener);
        
                const result = await client.startServerAsync(params);
                expect(result.status.severity).equals(0);
                expect(result.status.message).equals('ok');
            }
            testit();
        });

        it('startServerAsync should handle an invalid server', async () => {
            const result = await client.startServerAsync({
                mode: 'run',
                params: { id: 'foo', serverType: 'bar', attributes: {} }
            });

            expect(result.status.severity).greaterThan(0);
            expect(result.status.message).equals('Server foo does not exist');
        });

        // fails with https://issues.jboss.org/browse/JBIDE-26254
        it('startServerAsync should handle null params', async () => {
            const result = await client.startServerAsync(null, 500);

            expect(result.status.severity).greaterThan(0);
            expect(result.status.message).equals('Server foo does not exist');
        });
    });

    describe('Stopping Servers', () => {
        let handle: Protocol.ServerHandle;

        beforeEach(async function() {
            handle = await client.createServerSync(path.resolve('./wildfly'), 'wildfly7');
        });

        afterEach(async () => {
            await client.deleteServerSync(handle);
        });

        it('stopServerAsync should stop a running server', function(done) {
            this.timeout(8000);
            let stopped = false;
            async function testit() {
                const params: Protocol.LaunchParameters = {
                    mode: 'run',
                    params: {
                        id: handle.id,
                        serverType: handle.type.id,
                        attributes: {
                            'server.home.dir': path.resolve('./wildfly')
                        }
                    }
                };
                await client.startServerSync(params);

                const listener = (param: Protocol.ServerStateChange) => {
                    if (param.server.id != handle.id) {
                        return;
                    }
                    if (param.state === ServerState.STOPPED) {
                        if (!stopped) {
                            stopped = true;
                            client.removeListener('serverStateChange', listener);
                            done();
                        }
                    }
                };
                client.onServerStateChange(listener);
        
                const result = await client.stopServerAsync({ id: handle.id, force: true });
                expect(result.severity).equals(0);
                expect(result.message).equals('ok');
            }
            testit();
        });

        // fails with https://issues.jboss.org/browse/JBIDE-26285
        it('stopServerAsync should handle stopping a stopped server', async () => {
            const result = await client.stopServerAsync({ id: handle.id, force: true });

            expect(result.severity).greaterThan(0);
            expect(result.message).not.equals('ok');
        });

        it('stopServerAsync should handle stopping a non-existing server', async () => {
            const result = await client.stopServerAsync({ id: 'foo', force: true });
            
            expect(result.severity).greaterThan(0);
            expect(result.message).equals('Server foo does not exist');
        });

        // fails with https://issues.jboss.org/browse/JBIDE-26254
        it('stopServerAsync should handle stopping a null parameter', async () => {
            const result = await client.stopServerAsync(null, 500);
            
            expect(result.severity).greaterThan(0);
            expect(result.message).equals('Server foo does not exist');
        });
    });
});