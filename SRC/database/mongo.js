const mongoose = require('mongoose');
const logger = require('../utils/logger');
const { execFileSync } = require('child_process');

function buildWindowsDirectUri(srvUri) {
    const match = srvUri.match(/^mongodb\+srv:\/\/([^@]+)@([^/?]+)(\/[^?]*)?(?:\?(.*))?$/);
    if (!match) throw new Error('MONGO_URI is not a supported authenticated mongodb+srv URI.');

    const [, credentials, hostname, databasePath = '/', originalQuery = ''] = match;
    if (!/^[a-z0-9.-]+$/i.test(hostname)) throw new Error('Invalid MongoDB hostname.');

    const command = [
        `$srv = Resolve-DnsName -Type SRV -Name '${hostname}' -ErrorAction Stop |`,
        `Select-Object @{Name='host';Expression={$_.NameTarget.TrimEnd('.')}},Port;`,
        `$txt = Resolve-DnsName -Type TXT -Name '${hostname}' -ErrorAction SilentlyContinue |`,
        `ForEach-Object { $_.Strings };`,
        `@{srv=@($srv);txt=@($txt)} | ConvertTo-Json -Compress -Depth 3`
    ].join(' ');
    const output = execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', command], {
        encoding: 'utf8',
        timeout: 10000,
        windowsHide: true
    });
    const records = JSON.parse(output);
    if (!records.srv?.length) throw new Error(`No SRV records found for ${hostname}.`);

    const hosts = records.srv.map(record => `${record.host}:${record.Port}`).join(',');
    const params = new URLSearchParams(originalQuery);
    for (const txtEntry of records.txt || []) {
        for (const [key, value] of new URLSearchParams(txtEntry)) {
            if (!params.has(key)) params.set(key, value);
        }
    }
    params.set('tls', 'true');
    return `mongodb://${credentials}@${hosts}${databasePath}?${params}`;
}

async function connectDB() {
    try {
        const options = {
            maxPoolSize: 50, 
            minPoolSize: 10,
            serverSelectionTimeoutMS: 5000
        };
        try {
            await mongoose.connect(process.env.MONGO_URI, options);
        } catch (error) {
            const isWindowsSrvFailure = process.platform === 'win32'
                && process.env.MONGO_URI?.startsWith('mongodb+srv://')
                && /querySrv|ECONNREFUSED|ETIMEOUT/i.test(error.message);
            if (!isWindowsSrvFailure) throw error;

            logger.info('Node SRV lookup failed; retrying MongoDB through Windows DNS resolution.');
            await mongoose.connect(buildWindowsDirectUri(process.env.MONGO_URI), options);
        }
        logger.info('Database connection established successfully with pool scaling.');
    } catch (error) {
        logger.error('Database connection critical failure:', error);
        throw error;
    }
}

module.exports = { connectDB };
