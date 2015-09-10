/**
 * This is the main file of Pokémon Showdown Bot
 *
 * Some parts of this code are taken from the Pokémon Showdown server code, so
 * credits also go to Guangcong Luo and other Pokémon Showdown contributors.
 * https://github.com/Zarel/Pokemon-Showdown
 *
 * @license MIT license
 */

const MESSAGE_THROTTLE = 650;

function runNpm(command) {
	console.log('Running `npm ' + command + '`...');

	var child_process = require('child_process');
	var npm = child_process.spawn('npm', [command]);

	npm.stdout.on('data', function (data) {
		process.stdout.write(data);
	});

	npm.stderr.on('data', function (data) {
		process.stderr.write(data);
	});

	npm.on('close', function (code) {
		if (!code) {
			child_process.fork('main.js').disconnect();
		}
	});
}

// First dependencies and welcome message
try {
	require('sugar');
	global.colors = require('colors');
} catch (e) {
	console.log('Dependencies are not installed!');
	return runNpm('install');
}

global.info = function (text) {
	if (config.debuglevel > 3) return;
	console.log('info'.cyan + '  ' + text);
};

global.debug = function (text) {
	if (Config.debuglevel > 2) return;
	console.log('debug'.blue + ' ' + text);
};

global.recv = function (text) {
	if (config.debuglevel > 0) return;
	console.log('recv'.grey + '  ' + text);
};

global.cmdr = function (text) { // receiving commands
	if (Config.debuglevel !== 1) return;
	console.log('cmdr'.grey + '  ' + text);
};

global.dsend = function (text) {
	if (Config.debuglevel > 1) return;
	console.log('send'.grey + '  ' + text);
};

global.error = function (text) {
	console.log('error'.red + ' ' + text);
};

global.ok = function (text) {
	if (Config.debuglevel > 4) return;
	console.log('ok'.green + '    ' + text);
};

console.log('------------------------------------'.yellow);
console.log('| Welcome to Pokemon Showdown Bot! |'.yellow);
console.log('------------------------------------'.yellow);
console.log('');

global.toId = function (text) {
	return text.toLowerCase().replace(/[^a-z0-9]/g, '');
};

global.stripCommands = function (text) {
	text = text.trim();
	if (text.charAt(0) === '/') return '/' + text;
	if (text.charAt(0) === '!' || /^>>>? /.test(text)) return ' ' + text;
	return text;
};

// Config and config.js watching...
try {
	global.config = require('./config.js');
} catch (e) {
	error('config.js doesn\'t exist; are you sure you copied config-example.js to config.js?');
	process.exit(-1);
}

var checkCommandCharacter = function () {
	if (!/[^a-z0-9 ]/i.test(Config.commandcharacter)) {
		error('invalid command character; should at least contain one non-alphanumeric character');
		process.exit(-1);
	}
};

checkCommandCharacter();

var fs = require('fs');
if (config.watchconfig) {
	fs.watchFile('./config.js', function (curr, prev) {
		if (curr.mtime <= prev.mtime) return;
		try {
			delete require.cache[require.resolve('./config.js')];
			global.config = require('./config.js');
			info('reloaded config.js');
			checkCommandCharacter();
		} catch (e) {}
	});
}

// And now comes the real stuff...
info('starting server');

var WebSocketClient = require('websocket').client;
global.Commands = require('./commands.js').commands;
global.Users = require('./users.js');
global.Rooms = require('./rooms.js');
global.Parse = require('./parser.js').parse;
global.Connection = null;

var queue = [];
var dequeueTimeout = null;
var lastSentAt = 0;

global.send = function (data) {
	if (!data || !Connection.connected) return false;

	var now = Date.now();
	if (now < lastSentAt + MESSAGE_THROTTLE - 5) {
		queue.push(data);
		if (!dequeueTimeout) {
			dequeueTimeout = setTimeout(dequeue, now - lastSentAt + MESSAGE_THROTTLE);
		}
		return false;
	}

	if (!Array.isArray(data)) data = [data.toString()];
	data = JSON.stringify(data);
	dsend(data);
	Connection.send(data);

	lastSentAt = now;
	if (dequeueTimeout) {
		if (queue.length) {
			dequeueTimeout = setTimeout(dequeue, MESSAGE_THROTTLE);
		} else {
			dequeueTimeout = null;
		}
	}
};

function dequeue() {
	send(queue.shift());
}

var connect = function (retry) {
	if (retry) {
		info('retrying...');
	}

	var ws = new WebSocketClient();

	ws.on('connectFailed', function (err) {
		error('Could not connect to server ' + config.server + ': ' + err.stack);
		info('retrying in one minute');

		setTimeout(function () {
			connect(true);
		}, 60000);
	});

	ws.on('connect', function (con) {
		global.Connection = con;
		ok('connected to server ' + config.server);

		con.on('error', function (err) {
			error('connection error: ' + err.stack);
		});

		con.on('close', function (code, reason) {
			// Is this always error or can this be intended...?
			error('connection closed: ' + reason + ' (' + code + ')');
			info('retrying in one minute');

			for (var i in Users.users) {
				delete Users.users[i];
			}
			Rooms.rooms.clear();
			setTimeout(function () {
				connect(true);
			}, 60000);
		});

		con.on('message', function (response) {
			if (response.type !== 'utf8') return false;
			var message = response.utf8Data;
			recv(message);

			// SockJS messages sent from the server begin with 'a'
			// this filters out other SockJS response types (heartbeats in particular)
			if (message.charAt(0) !== 'a') return false;
			Parse.data(message);
		});
	});

	// The connection itself
	var id = ~~(Math.random() * 1000);
	var chars = 'abcdefghijklmnopqrstuvwxyz0123456789_';
	var str = '';
	for (var i = 0, l = chars.length; i < 8; i++) {
		str += chars.charAt(~~(Math.random() * l));
	}

	var conStr = 'ws://' + config.server + ':' + config.port + '/showdown/' + id + '/' + str + '/websocket';
	info('connecting to ' + conStr + ' - secondary protocols: ' + (config.secprotocols.join(', ') || 'none'));
	ws.connect(conStr, config.secprotocols);
};

connect();

//Bot able to speak in from from console.
var stdin = process.openStdin();
var currentRoom = '';
if (config.rooms.length) {
	currentRoom = config.rooms[0];
} else if (config.privaterooms.length) {
	currentRoom = config.privaterooms[0];
}
console.log("Now initiating direct control over chat input.");
console.log("Type '" + config.commandcharacter + "' without the quotation marks, followed by the room name to ");
console.log("speak to a certain room from that point onwards.");
console.log("I am currently speaking to room " + toTitleCase(currentRoom));
stdin.addListener("data", function (d) {
	var om = d.toString().substring(0, d.length - 1);
	if (om.substr(0, config.commandcharacter.length) === config.commandcharacter) {
		currentRoom = toId(om.substr(config.commandcharacter.length));
		return console.log("Understood. From this point forwards, I shall speak in room " + toTitleCase(currentRoom));
	} else if (currentRoom === "") {
		return console.log("Please select a room, first.");
	}
	Parse.say(currentRoom, om);
});
