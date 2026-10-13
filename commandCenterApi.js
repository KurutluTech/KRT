export function createCommandCenterApi(client, session) {
    return {
        async snapshot() {
            return client.rpc('command_center', {}, session);
        },
    };
}
