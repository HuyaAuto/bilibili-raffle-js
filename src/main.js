(function() {

    'use strict';

    process.env.TZ = 'Asia/Shanghai';

    const http = require('http');

    const cprint = require('./util/printer.js');
    const colors = require('colors/safe');

    const settings = require('./settings.json');
    const HttpHost = require('./server/httphost.js');
    const Account = require('./client/account-runner.js');
    const RaffleReceiver = require('./client/receiver.js');

    const Notifier = require('./client/notifier.js');

    main();


    function main() {
        const wsHost = settings['wsServer']['ip'];
        const wsPort = settings['wsServer']['port'];

        const receiver = new RaffleReceiver(wsHost, wsPort);
        const notifier = new Notifier();


        const account = new Account('user.json');
        account.loadFromFile();

        setupSchedule({ receiver, notifier, account });

        const api = new HttpHost(account);

        const httpHost = settings['httpServer']['ip'];
        const httpPort = settings['httpServer']['port'];
        const server = http.createServer(api.app()).listen(httpPort, httpHost);

        server.on('error', error => {
            if (error.code === 'EADDRINUSE') {
                cprint(`未能建立http服务 - 端口${httpPort}已被占用`, colors.red);
                cprint('建议修改``settings.json``中的httpServer.port值', colors.red);
            } else {
                cprint(`Error(httpServer): ${error.message}`, colors.red);
            }
        });

        /** 读取/登录 */
        try {
            if (account.usable === false) {
                cprint('Account not usable', colors.yellow);
                cprint('-------------Account().login---------------', colors.brightBlue);
                account.login().then(() => {
                    cprint('Login successful', colors.green);

                    account.loadTasksFromFile();
                    executeInitial(account);
                }).catch(error => {
                    cprint(error, colors.red);
                });
            } else {
                cprint('Account usable', colors.green);

                account.loadTasksFromFile();
                executeInitial(account);
            }

        } catch (error) {
            console.log(error);
        }
        // */
    }


    function setupSchedule(info) {
        if (typeof info === 'undefined' || info === null) {
            throw new Error('Schedule failed to setup');
        }

        const { account, receiver, notifier } = info;

        (receiver
            .on('pk', (g) => account.execute('pk', g))
            .on('gift', (g) => account.execute('gift', g))
            .on('guard', (g) => account.execute('guard', g))
            .on('storm', (g) => {
                if (Math.random() > 0.4) {
                    account.execute('storm', g);
                }
            }));

        (notifier
            .on('liveHeart', () => account.execute('liveheart'))
            .on('midnight', () => {
                async () => {
                    await account.execute('livesign');
                    await account.execute('idolclubsign');
                    await account.execute('mainsharevideo');
                    await account.execute('mainwatchvideo');
                    await account.execute('doublewatch');
                }
                account.execute('silverbox');
            }));

        receiver.run();
        notifier.run();
    }


    function registerTasks(account) {
        const from = Clock.today();
        const to = Clock.today();
        from.setHours(8, 0);
        to.setHours(0, 45);
        const tp = new TimePeriod(from, to);

        account.register('pk', { 'timeperiod': tp });
        account.register('gift', { 'timeperiod': tp });
        account.register('guard', { 'timeperiod': tp });
        account.register('storm', { 'timeperiod': tp });
        account.register('liveheart', { 'timeperiod': tp });
        account.register('mainsharevideo');
        account.register('mainwatchvideo');
        account.register('livesign');
        account.register('idolclubsign');
        account.register('doublewatch');
        account.register('silverbox');
    }


    function executeInitial(account) {
        account.refreshToken();
        (async () => {
            await account.execute('livesign');
            await account.execute('idolclubsign');
            await account.execute('mainsharevideo');
            await account.execute('mainwatchvideo');
            await account.execute('doublewatch');
            await account.execute('liveheart');
            account.execute('silverbox');
        })();
    }

})();