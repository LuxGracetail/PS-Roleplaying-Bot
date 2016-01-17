'use strict';

const url = require('url');
const http = require('http');

if (process.argv.length < 2) {
	throw new Error('Failed to find data for server: no server URL was given!');
}

let args = process.argv.slice(2);
let serverUrl = args.join(' ');
if (serverUrl.indexOf('://') >= 0) serverUrl = url.parse(serverUrl).host;
if (serverUrl.endsWith('/')) serverUrl = serverUrl.slice(0, -1);

let received = false;
let reqOpts = {
	hostname: 'play.pokemonshowdown.com',
	port: 80,
	path: '/crossdomain.php?host=' + serverUrl + '&path=',
	method: 'GET'
}

let req = http.request(reqOpts, (res) => {
	res.setEncoding('utf8');

	res.on('data', (chunk) => {
		if (received) return false;
		received = true;

		let search = 'var config = ';
		let idx = chunk.indexOf(search);
		if (idx < 0) {
			throw new Error('Failed to get data for server ' + serverUrl + ': invalid data received: ' + data);
		}

		let data = chunk.substr(idx);
		let serverInfo = data.substr(search.length, data.indexOf(';') - search.length);

		try {
			// No, that's not a typo, we really do need to parse this twice.
			serverInfo = JSON.parse(JSON.parse(serverInfo));
		} catch (e) {}

		if (!(serverInfo instanceof Object)) {
			throw new Error('Failed to get data for server ' + serverUrl + ': invalid data received: ' + serverInfo);
		}

		console.log(
			'Server: ' + serverInfo.host + '\n' +
			'Port: ' + serverInfo.port + '\n' +
			'Serverid: ' + serverInfo.id + '\n' +
			'Registered: ' + serverInfo.registered
		);
	});
});

req.on('error', (err) => {
	throw new Error('Failed to get data for server ' + serverUrl + ': ' + err.message);
});

req.end();
