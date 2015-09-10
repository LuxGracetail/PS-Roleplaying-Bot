/**
 * This is the file where the bot commands are located
 *
 * @license MIT license
 */

var http = require('http');
var https, csv;
if (config.serverid === 'showdown') {
	https = require('https');
	csv = require('csv-parse');
}

// .set constants
const CONFIGURABLE_COMMANDS = {
	autoban: true,
	banword: true,
	joke: true,
	usagestats: true,
	'8ball': true,
	regexautoban: true,
	setrp: true
};

const CONFIGURABLE_MODERATION_OPTIONS = {
	flooding: true,
	caps: true,
	stretching: true,
	bannedwords: true
};

const CONFIGURABLE_COMMAND_LEVELS = {
	off: false,
	disable: false,
	'false': false,
	on: true,
	enable: true,
	'true': true
};

for (var i in config.groups) {
	if (i !== ' ') CONFIGURABLE_COMMAND_LEVELS[i] = i;
}

exports.commands = {
	/**
	 * Help commands
	 *
	 * These commands are here to provide information about the bot.
	 */

	credits: 'about',
	about: function (arg, user, room) {
		var text = (room === user || user.hasRank(room.id, '#')) ? '' : '/pm ' + user.id + ', ';
		text += '**Roleplaying Bot**: fork of **Pokemon Showdown Bot** by Quinella and TalkTakesTime, with custom roleplaying commands by Morfent.';
		this.say(room, text);
	},
	git: function (arg, user, room) {
		var text = (room === user || user.isExcepted()) ? '' : '/pm ' + user.id + ', ';
		text += '**Pokemon Showdown Bot** source code: ' + config.fork;
		this.say(room, text);
	},
	help: 'guide',
	guide: function (arg, user, room) {
		var text = (room === user || user.hasRank(room.id, '#'))  ? '' : '/pm ' + user.id + ', ';
		if (config.botguide) {
			text += 'A guide on how to use this bot can be found here: ' + config.botguide;
		} else {
			text += 'There is no guide for this bot. PM the owner with any questions.';
		}
		this.say(room, text);
	},

	/**
	 * Dev commands
	 *
	 * These commands are here for highly ranked users (or the creator) to use
	 * to perform arbitrary actions that can't be done through any other commands
	 * or to help with upkeep of the bot.
	 */

	reload: function (arg, user, room) {
		if (!user.isExcepted()) return false;
		try {
			this.uncacheTree('./commands.js');
			global.Commands = require('./commands.js').commands;
			this.say(room, 'Commands reloaded.');
		} catch (e) {
			error('failed to reload: ' + e.stack);
		}
	},
	custom: function (arg, user, room) {
		if (!user.isExcepted()) return false;
		// Custom commands can be executed in an arbitrary room using the syntax
		// ".custom [room] command", e.g., to do !data pikachu in the room lobby,
		// the command would be ".custom [lobby] !data pikachu". However, using
		// "[" and "]" in the custom command to be executed can mess this up, so
		// be careful with them.
		if (arg.indexOf('[') !== 0 || arg.indexOf(']') < 0) {
			return this.say(room, arg);
		}
		var tarRoomid = arg.slice(1, arg.indexOf(']'));
		var tarRoom = Rooms.get(tarRoomid);
		if (!tarRoom) return this.say(room, Users.self.name + ' is not in room ' + tarRoomid + '!');
		arg = arg.substr(arg.indexOf(']') + 1).trim();
		this.say(tarRoom, arg);
	},
	js: function (arg, user, room) {
		if (!user.isExcepted()) return false;
		try {
			var result = eval(arg.trim());
			this.say(room, JSON.stringify(result));
		} catch (e) {
			this.say(room, e.name + ": " + e.message);
		}
	},
	uptime: function (arg, user, room) {
		var text = ((room === user || user.isExcepted()) ? '' : '/pm ' + user.id + ', ') + '**Uptime:** ';
		var divisors = [52, 7, 24, 60, 60];
		var units = ['week', 'day', 'hour', 'minute', 'second'];
		var buffer = [];
		var uptime = ~~(process.uptime());
		do {
			var divisor = divisors.pop();
			var unit = uptime % divisor;
			buffer.push(unit > 1 ? unit + ' ' + units.pop() + 's' : unit + ' ' + units.pop());
			uptime = ~~(uptime / divisor);
		} while (uptime);

		switch (buffer.length) {
		case 5:
			text += buffer[4] + ', ';
			/* falls through */
		case 4:
			text += buffer[3] + ', ';
			/* falls through */
		case 3:
			text += buffer[2] + ', ' + buffer[1] + ', and ' + buffer[0];
			break;
		case 2:
			text += buffer[1] + ' and ' + buffer[0];
			break;
		case 1:
			text += buffer[0];
			break;
		}

		this.say(room, text);
	},


	/**
	 * Room Owner commands
	 *
	 * These commands allow room owners to personalise settings for moderation and command use.
	 */

	settings: 'set',
	set: function (arg, user, room) {
		if (room === user || !user.hasRank(room.id, '#')) return false;

		var opts = arg.split(',');
		var cmd = toId(opts[0]);
		var roomid = room.id;
		if (cmd === 'm' || cmd === 'mod' || cmd === 'modding') {
			var modOpt;
			if (!opts[1] || !CONFIGURABLE_MODERATION_OPTIONS[(modOpt = toId(opts[1]))]) {
				return this.say(room, 'Incorrect command: correct syntax is ' + config.commandcharacter + 'set mod, [' +
					Object.keys(CONFIGURABLE_MODERATION_OPTIONS).join('/') + '](, [on/off])');
			}
			if (!opts[2]) return this.say(room, 'Moderation for ' + modOpt + ' in this room is currently ' +
				(this.settings.modding && this.settings.modding[roomid] && modOpt in this.settings.modding[roomid] ? 'OFF' : 'ON') + '.');

			if (!this.settings.modding) this.settings.modding = {};
			if (!this.settings.modding[roomid]) this.settings.modding[roomid] = {};

			var setting = toId(opts[2]);
			if (setting === 'on') {
				delete this.settings.modding[roomid][modOpt];
				if (Object.isEmpty(this.settings.modding[roomid])) delete this.settings.modding[roomid];
				if (Object.isEmpty(this.settings.modding)) delete this.settings.modding;
			} else if (setting === 'off') {
				this.settings.modding[roomid][modOpt] = 0;
			} else {
				return this.say(room, 'Incorrect command: correct syntax is ' + config.commandcharacter + 'set mod, [' +
					Object.keys(CONFIGURABLE_MODERATION_OPTIONS).join('/') + '](, [on/off])');
			}

			this.writeSettings();
			return this.say(room, 'Moderation for ' + modOpt + ' in this room is now ' + setting.toUpperCase() + '.');
		}

		if (!(cmd in Commands)) return this.say(room, config.commandcharacter + '' + opts[0] + ' is not a valid command.');

		var failsafe = 0;
		while (true) {
			if (typeof Commands[cmd] === 'string') {
				cmd = Commands[cmd];
			} else if (typeof Commands[cmd] === 'function') {
				if (cmd in CONFIGURABLE_COMMANDS) break;
				return this.say(room, 'The settings for ' + config.commandcharacter + '' + opts[0] + ' cannot be changed.');
			} else {
				return this.say(room, 'Something went wrong. PM Morfent or TalkTakesTime here or on Smogon with the command you tried.');
			}

			if (++failsafe > 5) return this.say(room, 'The command "' + config.commandcharacter + '' + opts[0] + '" could not be found.');
		}

		if (!opts[1]) {
			var msg = '' + config.commandcharacter + '' + cmd + ' is ';
			if (!this.settings[cmd] || (!(roomid in this.settings[cmd]))) {
				msg += 'available for users of rank ' + ((cmd === 'autoban' || cmd === 'banword') ? '#' : config.defaultrank) + ' and above.';
			} else if (this.settings[cmd][roomid] in CONFIGURABLE_COMMAND_LEVELS) {
				msg += 'available for users of rank ' + this.settings[cmd][roomid] + ' and above.';
			} else {
				msg += this.settings[cmd][roomid] ? 'available for all users in this room.' : 'not available for use in this room.';
			}

			return this.say(room, msg);
		}

		var setting = opts[1].trim();
		if (!(setting in CONFIGURABLE_COMMAND_LEVELS)) return this.say(room, 'Unknown option: "' + setting + '". Valid settings are: off/disable/false, +, %, @, #, &, ~, on/enable/true.');
		if (!this.settings[cmd]) this.settings[cmd] = {};
		this.settings[cmd][roomid] = CONFIGURABLE_COMMAND_LEVELS[setting];

		this.writeSettings();
		this.say(room, 'The command ' + config.commandcharacter + '' + cmd + ' is now ' +
			(CONFIGURABLE_COMMAND_LEVELS[setting] === setting ? ' available for users of rank ' + setting + ' and above.' :
			(this.settings[cmd][roomid] ? 'available for all users in this room.' : 'unavailable for use in this room.')));
	},
	blacklist: 'autoban',
	ban: 'autoban',
	ab: 'autoban',
	autoban: function (arg, user, room) {
		if (room === user || !user.canUse('autoban', room.id)) return false;
		if (!Users.self.hasRank(room.id, '@')) return this.say(room, Users.self.name + ' requires rank of @ or higher to (un)blacklist.');
		if (!toId(arg)) return this.say(room, 'You must specify at least one user to blacklist.');

		arg = arg.split(',');
		var added = [];
		var illegalNick = [];
		var alreadyAdded = [];
		var roomid = room.id;
		for (var i = 0; i < arg.length; i++) {
			var tarUser = toId(arg[i]);
			if (!tarUser || tarUser.length > 18) {
				illegalNick.push(tarUser);
			} else if (!this.blacklistUser(tarUser, roomid)) {
				alreadyAdded.push(tarUser);
			} else {
				added.push(tarUser);
				this.say(room, '/roomban ' + tarUser + ', Blacklisted user');
			}
		}

		var text = '';
		if (added.length) {
			text += 'User' + (added.length > 1 ? 's "' + added.join('", "') + '" were' : ' "' + added[0] + '" was') + ' added to the blacklist.';
			this.say(room, '/modnote ' + text + ' by ' + user.name + '.');
			this.writeSettings();
		}
		if (alreadyAdded.length) {
			text += ' User' + (alreadyAdded.length > 1 ? 's "' + alreadyAdded.join('", "') + '" are' : ' "' + alreadyAdded[0] + '" is') + ' already present in the blacklist.';
		}
		if (illegalNick.length) text += (text ? ' All other' : 'All') + ' users had illegal nicks and were not blacklisted.';
		this.say(room, text);
	},
	unblacklist: 'unautoban',
	unban: 'unautoban',
	unab: 'unautoban',
	unautoban: function (arg, user, room) {
		if (room === user || !user.canUse('autoban', room.id)) return false;
		if (!Users.self.hasRank(room.id, '@')) return this.say(room, Users.self.name + ' requires rank of @ or higher to (un)blacklist.');
		if (!toId(arg)) return this.say(room, 'You must specify at least one user to unblacklist.');

		arg = arg.split(',');
		var removed = [];
		var notRemoved = [];
		var roomid = room.id;
		for (var i = 0; i < arg.length; i++) {
			var tarUser = toId(arg[i]);
			if (!tarUser || tarUser.length > 18) {
				notRemoved.push(tarUser);
			} else if (!this.unblacklistUser(tarUser, roomid)) {
				notRemoved.push(tarUser);
			} else {
				removed.push(tarUser);
				this.say(room, '/roomunban ' + tarUser);
			}
		}

		var text = '';
		if (removed.length) {
			text += ' User' + (removed.length > 1 ? 's "' + removed.join('", "') + '" were' : ' "' + removed[0] + '" was') + ' removed from the blacklist';
			this.say(room, '/modnote ' + text + ' by user ' + user.name + '.');
			this.writeSettings();
		}
		if (notRemoved.length) text += (text.length ? ' No other' : 'No') + ' specified users were present in the blacklist.';
		this.say(room, text);
	},
	rab: 'regexautoban',
	regexautoban: function (arg, user, room) {
		if (room === user || !user.isRegexWhitelisted() || !user.canUse('autoban', room.id)) return false;
		if (!Users.self.hasRank(room.id, '@')) return this.say(room, Users.self.name + ' requires rank of @ or higher to (un)blacklist.');
		if (!arg) return this.say(room, 'You must specify a regular expression to (un)blacklist.');

		var regexObj;
		try {
			regexObj = new RegExp(arg, 'i');
		} catch (e) {
			return this.say(room, e.message);
		}

		if (/^(?:(?:\.+|[a-z0-9]|\\[a-z0-9SbB])(?![a-z0-9\.\\])(?:\*|\{\d+\,(?:\d+)?\}))+$/i.test(arg)) {
			return this.say(room, 'Regular expression /' + arg + '/i cannot be added to the blacklist. Don\'t be Machiavellian!');
		}

		var regex = '/' + arg + '/i';
		if (!this.blacklistUser(regex, room.id)) return this.say(room, '/' + regex + ' is already present in the blacklist.');

		var groups = config.groups;
		var selfid = Users.self.id;
		var selfidx = groups[room.users.get(selfid)];
		room.users.forEach(function (value, userid) {
			if (userid !== selfid && regexObj.test(userid) && groups[value] < selfidx) {
				this.say(room, '/roomban ' + userid + ', Blacklisted user');
			}
		});

		this.writeSettings();
		this.say(room, '/modnote Regular expression ' + regex + ' was added to the blacklist by user ' + user.name + '.');
		this.say(room, 'Regular expression ' + regex + ' was added to the blacklist.');
	},
	unrab: 'unregexautoban',
	unregexautoban: function (arg, user, room) {
		if (room === user || !user.isRegexWhitelisted() || !user.canUse('autoban', room.id)) return false;
		if (!Users.self.hasRank(room.id, '@')) return this.say(room, Users.self.name + ' requires rank of @ or higher to (un)blacklist.');
		if (!arg) return this.say(room, 'You must specify a regular expression to (un)blacklist.');

		arg = '/' + arg.replace(/\\\\/g, '\\') + '/i';
		if (!this.unblacklistUser(arg, room.id)) return this.say(room, '/' + arg + ' is not present in the blacklist.');

		this.writeSettings();
		this.say(room, '/modnote Regular expression ' + arg + ' was removed from the blacklist user by ' + user.name + '.');
		this.say(room, 'Regular expression ' + arg + ' was removed from the blacklist.');
	},
	viewbans: 'viewblacklist',
	vab: 'viewblacklist',
	viewautobans: 'viewblacklist',
	viewblacklist: function (arg, user, room) {
		if (room === user || !user.canUse('autoban', room.id)) return false;

		var text = '/pm ' + user.id + ', ';
		if (!this.settings.blacklist) return this.say(room, text + 'No users are blacklisted in this room.');

		var roomid = room.id;
		var blacklist = this.settings.blacklist[roomid];
		if (!blacklist) return this.say(room, text + 'No users are blacklisted in this room.');

		if (!arg.length) {
			var userlist = Object.keys(blacklist);
			if (!userlist.length) return this.say(room, text + 'No users are blacklisted in this room.');
			return this.uploadToHastebin('The following users are banned from ' + roomid + ':\n\n' + userlist.join('\n'), function (link) {
				if (link.startsWith('Error')) return this.say(room, text + link);
				this.say(room, text + 'Blacklist for room ' + roomid + ': ' + link);
			}.bind(this));
		}

		var nick = toId(arg);
		if (!nick || nick.length > 18) {
			text += 'Invalid username: "' + nick + '".';
		} else {
			text += 'User "' + nick + '" is currently ' + (blacklist[nick] || 'not ') + 'blacklisted in ' + roomid + '.';
		}
		this.say(room, text);
	},
	banphrase: 'banword',
	banword: function (arg, user, room) {
		arg = arg.trim().toLowerCase();
		if (!arg) return false;

		var tarRoom = room.id;
		if (room === user) {
			if (!user.isExcepted()) return false;
			tarRoom = 'global';
		} else if (user.canUse('banword', room.id)) {
			tarRoom = room.id;
		} else {
			return false;
		}

		var bannedPhrases = this.settings.bannedphrases ? this.settings.bannedphrases[tarRoom] : null;
		if (!bannedPhrases) {
			if (bannedPhrases === null) this.settings.bannedphrases = {};
			bannedPhrases = (this.settings.bannedphrases[tarRoom] = {});
		} else if (bannedPhrases[arg]) {
			return this.say(room, 'Phrase "' + arg + '" is already banned.');
		}
		bannedPhrases[arg] = 1;

		this.writeSettings();
		this.say(room, 'Phrase "' + arg + '" is now banned.');
	},
	unbanphrase: 'unbanword',
	unbanword: function (arg, user, room) {
		var tarRoom;
		if (room === user) {
			if (!user.isExcepted()) return false;
			tarRoom = 'global';
		} else if (user.canUse('banword', room.id)) {
			tarRoom = room.id;
		} else {
			return false;
		}

		arg = arg.trim().toLowerCase();
		if (!arg) return false;
		if (!this.settings.bannedphrases) return this.say(room, 'Phrase "' + arg + '" is not currently banned.');

		var bannedPhrases = this.settings.bannedphrases[tarRoom];
		if (!bannedPhrases || !bannedPhrases[arg]) return this.say(room, 'Phrase "' + arg + '" is not currently banned.');

		delete bannedPhrases[arg];
		if (Object.isEmpty(bannedPhrases)) {
			delete this.settings.bannedphrases[tarRoom];
			if (Object.isEmpty(this.settings.bannedphrases)) delete this.settings.bannedphrases;
		}

		this.writeSettings();
		this.say(room, 'Phrase "' + arg + '" is no longer banned.');
	},
	viewbannedphrases: 'viewbannedwords',
	vbw: 'viewbannedwords',
	viewbannedwords: function (arg, user, room) {
		var tarRoom = room.id;
		var text = '';
		var bannedFrom = '';
		if (room === user) {
			if (!user.isExcepted()) return false;
			tarRoom = 'global';
			bannedFrom += 'globally';
		} else if (user.canUse('banword', room.id)) {
			text += '/pm ' + user.id + ', ';
			bannedFrom += 'in ' + room.id;
		} else {
			return false;
		}

		if (!this.settings.bannedphrases) return this.say(room, text + 'No phrases are banned in this room.');
		var bannedPhrases = this.settings.bannedphrases[tarRoom];
		if (!bannedPhrases) return this.say(room, text + 'No phrases are banned in this room.');

		if (arg.length) {
			text += 'The phrase "' + arg + '" is currently ' + (bannedPhrases[arg] || 'not ') + 'banned ' + bannedFrom + '.';
			return this.say(room, text);
		}

		var banList = Object.keys(bannedPhrases);
		if (!banList.length) return this.say(room, text + 'No phrases are banned in this room.');

		this.uploadToHastebin('The following phrases are banned ' + bannedFrom + ':\n\n' + banList.join('\n'), function (link) {
			if (link.startsWith('Error')) return this.say(room, link);
			this.say(room, text + 'Banned phrases ' + bannedFrom + ': ' + link);
		}.bind(this));
	},

	/**
	 * General commands
	 *
	 * Add custom commands here.
	 */

	joke: function (arg, user, room) {
		if (room === user || !user.canUse('joke', room.id)) return false;
		var self = this;

		var reqOpt = {
			hostname: 'api.icndb.com',
			path: '/jokes/random',
			method: 'GET'
		};
		var req = http.request(reqOpt, function (res) {
			res.on('data', function (chunk) {
				try {
					var data = JSON.parse(chunk);
					self.say(room, data.value.joke.replace(/&quot;/g, "\""));
				} catch (e) {
					self.say(room, 'Sorry, couldn\'t fetch a random joke... :(');
				}
			});
		});
		req.end();
	},
	usage: 'usagestats',
	usagestats: function (arg, user, room) {
		if (arg) return false;
		var text = (room === user || user.canUse('usagestats', room.id)) ? '' : '/pm ' + user.id + ', ';
		text += 'http://www.smogon.com/stats/2015-07/';
		this.say(room, text);
	},
	seen: function (arg, user, room) { // this command is still a bit buggy
		var text = (room === user ? '' : '/pm ' + user.id + ', ');
		arg = toId(arg);
		if (!arg || arg.length > 18) return this.say(room, text + 'Invalid username.');
		if (arg === user.id) {
			text += 'Have you looked in the mirror lately?';
		} else if (arg === Users.self.id) {
			text += 'You might be either blind or illiterate. Might want to get that checked out.';
		} else if (!this.chatData[arg] || !this.chatData[arg].seenAt) {
			text += 'The user ' + arg + ' has never been seen.';
		} else {
			text += arg + ' was last seen ' + this.getTimeAgo(this.chatData[arg].seenAt) + ' ago' + (
				this.chatData[arg].lastSeen ? ', ' + this.chatData[arg].lastSeen : '.');
		}
		this.say(room, text);
	},
	'8ball': function (arg, user, room) {
		if (room === user) return false;
		var text = user.canUse('8ball', room.id) ? '' : '/pm ' + user.id + ', ';
		var rand = ~~(20 * Math.random());

		switch (rand) {
		case 0:
			text += "Signs point to yes.";
			break;
		case 1:
			text += "Yes.";
			break;
		case 2:
			text += "Reply hazy, try again.";
			break;
		case 3:
			text += "Without a doubt.";
			break;
		case 4:
			text += "My sources say no.";
			break;
		case 5:
			text += "As I see it, yes.";
			break;
		case 6:
			text += "You may rely on it.";
			break;
		case 7:
			text += "Concentrate and ask again.";
			break;
		case 8:
			text += "Outlook not so good.";
			break;
		case 9:
			text += "It is decidedly so.";
			break;
		case 10:
			text += "Better not tell you now.";
			break;
		case 11:
			text += "Very doubtful.";
			break;
		case 12:
			text += "Yes - definitely.";
			break;
		case 13:
			text += "It is certain.";
			break;
		case 14:
			text += "Cannot predict now.";
			break;
		case 15:
			text += "Most likely.";
			break;
		case 16:
			text += "Ask again later.";
			break;
		case 17:
			text += "My reply is no.";
			break;
		case 18:
			text += "Outlook good.";
			break;
		case 19:
			text += "Don't count on it.";
			break;
		}

		this.say(room, text);
	},

	// Roleplaying commands
	setrp: function(arg, by, room) {
		if (!user.canUse('setrp', room.id) || !(room in this.RP)) return false;
		if (!arg) return this.say(room, 'Please enter an RP.');

		this.RP[room].plot = arg;
		this.writeSettings();
		if (this.RP[room].setAt) return this.say(room, 'The RP was set to ' + arg + '.');
		this.say(room, 'The RP was set to ' + arg + '. Use .start to start the RP.');
	},

	rpstart: 'start',
	start: function(arg, by, room) {
		if (!user.canUse('setrp', room.id) || !(room in this.RP) || this.RP[room].setAt) return false;
		if (!this.RP[room].plot) {
			if (!arg) return this.say(room, 'Please set an RP before using .start, or specify an RP with .start to start one immediately.');
			this.RP[room].plot = arg;
		}

		if (this.freeroamTimeouts && toId(this.RP[room].plot) === 'freeroam') {
			this.freeroamTimeouts[room] = setTimeout(function() {
				this.splitMessage('>' + room + '\n|c|' + by + '|' + config.commandcharacter + 'endrp');
				delete this.freeroamTimeouts[room];
			}.bind(this), 2 * 60 * 60 * 1000);
		}
		
		if (/conquest/i.test(this.RP[room].plot)) {
			this.say(room, '/modchat off');
		}

		var now = new Date();
		this.RP[room].setAt = now;
		this.writeSettings();
		if (this.hasRank(this.ranks[room] || ' ', '%@#&~')) {
			this.say(room, '/wall The RP has started.');
		} else {
			this.say(room, '**The RP has started.**');
		}
	},
	'pause': 'rppause',
	pauserp: 'rppause',
	rppause: function(arg, by, room) {
		if (!user.canUse('setrp', room.id) || !(room in this.RP) || !this.RP[room].setAt || this.RP[room].pause) return false;

		this.RP[room].pause = new Date();
		this.writeSettings();
		if (this.hasRank(this.ranks[room] || ' ', '%@#&~')) {
			this.say(room, '/wall RP pause');
		} else {
			this.say(room, '**RP pause**');
		}
	},
	'continue': 'rpcontinue',
	'resume': 'rpcontinue',
	'rpresume': 'rpcontinue',
	continuerp: 'rpcontinue',
	rpcontinue: function(arg, by, room) {
		if (!user.canUse('setrp', room.id) || !(room in this.RP) || !this.RP[room].setAt || !this.RP[room].pause) return false;

		var paused = new Date(this.RP[room].pause);
		var setAt = new Date(this.RP[room].setAt);
		var diff = new Date();
		diff.setTime(diff.getTime() - paused.getTime());
		setAt.setTime(setAt.getTime() + diff.getTime());
		this.RP[room].setAt = setAt

		delete this.RP[room].pause;
		this.writeSettings();
		if (this.hasRank(this.ranks[room] || ' ', '%@#&~')) {
			this.say(room, '/wall RP continue');
		} else {
			this.say(room, '**RP continue**');
		}
	},
	sethost: function(arg, by, room) {
		if (!user.canUse('setrp', room.id) || !(room in this.RP) || !this.RP[room].plot) return false;
		if (!arg) return this.say(room, 'Please enter a host.');

		if (config.serverid == 'showdown' && (room.id !== "amphyrp")){
			if (this.RP[room].host){
				if (!(config.voiceList.indexOf(toId(this.RP[room].host)) >= 0)) {
						this.say(room, '/roomdevoice '+ this.RP[room].host);
				}
			}
			if (!(this.RP[room].setAt)) {
				if (/conquest/i.test(this.RP[room].plot)){
					this.say(room, '/modchat +');
				}
			}
		}

		this.RP[room].host = arg;
		this.writeSettings();
		if (room.id !== "amphyrp"){ 
			this.say(room, '/roomvoice '+ arg)
		}
		this.say(room, 'The host was set to ' + arg + '.');
	},
	
	setcohost: function(arg, by, room) {
		if (!user.canUse('setrp', room.id) || !(room in this.RP) || !this.RP[room].plot) return false;
		if (!arg) return this.say(room, 'Please enter a cohost.');
				
		this.RP[room].cohost = arg;
		this.writeSettings();
		this.say(room, 'The cohost(s) was/were set to ' + arg + '.');
	},	
	rmhost: function(arg, by, room) {
		if (!user.canUse('setrp', room.id) || !(room in this.RP) || !this.RP[room].plot) return false;
		if (!this.RP[room].host) return this.say(room, 'There is no host to remove.');
		if (config.serverid == 'showdown' && (room.id !== "amphyrp")){
			if (!(config.voiceList.indexOf(toId(this.RP[room].host)) >= 0)) {
				this.say(room, '/roomdevoice '+ this.RP[room].host);
				}
			if (!(this.RP[room].setAt)){
				if (/conquest/i.test(this.RP[room].plot)){
					this.say(room, '/modchat off');
				}
			}
		}

		delete this.RP[room].host;
		this.writeSettings();
		this.say(room, 'The host has been removed.');
	},
	rmcohost: function(arg, by, room) {
		if (!user.canUse('setrp', room.id) || !(room in this.RP) || !this.RP[room].plot) return false;
		if (!this.RP[room].cohost) return this.say(room, 'There are no cohosts to remove.');

		delete this.RP[room].cohost;
		this.writeSettings();
		this.say(room, 'The cohost(s) has/have been removed.');
	},
	rpend: 'endrp',
	endrp: function(arg, by, room) {
		if (!user.canUse('setrp', room.id) || !(room in this.RP) || !this.RP[room].plot) return false;
		if (config.serverid === 'showdown' && this.RP[room].setAt) {
			nextVoid = this.splitDoc(this.RP[room].plot);
			if (this.RP.void[room].length === 2) this.RP.void[room].shift();
			this.RP.void[room].push(nextVoid);

			if (toId(this.RP[room].plot) === 'freeroam') {
				clearTimeout(this.freeroamTimeouts[room]);
				delete this.freeroamTimeouts[room];
			}
		}
		
		if (room.id !== "amphyrp"){
			if (this.RP[room].host){
				if (!(config.voiceList.indexOf(toId(this.RP[room].host)) >= 0)) {
					this.say(room, '/roomdevoice '+ this.RP[room].host);
					}
				if (!(this.RP[room].setAt)){
					if (/conquest/i.test(this.RP[room].plot)){
						this.say(room, '/modchat off');
					}
				}
			}
		}

		for (var i in this.RP[room]) {
			delete this.RP[room][i];
		}
		this.writeSettings();
		if (this.hasRank(this.ranks[room] || ' ', '%@#&~')) {
			this.say(room, '/wall The RP has ended.');
		} else {
			this.say(room, '**The RP has ended.**');
		}
	},
	void: function(arg, by, room) {
		if (config.serverid !== 'showdown' || !user.canUse('setrp', room.id) || !(room in this.RP) || this.RP[room].plot) return false;

		var text = '';
		var voided = this.RP.void[room];
		switch (voided.length) {
			case 2:
				text += voided[0] + ' and ' + voided[1] + ' are void.';
				break;
			case 1:
				text += voided[0] + ' is void. The second-last RP in this room is unknown.';
				break;
			case 0:
				text += 'The last 2 RPs in this room are unknown.';
				break;
			default:
				return this.say(room, 'Something went wrong with how void RPs are stored.');
		}
		var concurrent = (room.id === 'roleplaying') ? this.splitDoc(this.RP['amphyrp'].plot) : this.splitDoc(this.RP['roleplaying'].plot);
		if (concurrent) text += ' The current RP in ' + ((room.id === 'roleplaying') ? 'AmphyRP' : 'Roleplaying') + ' is ' + concurrent + '.';

		this.say(room, '**' + text + '**');
	},
	rp: function(arg, by, room) {
		if (!(room in this.RP)) return false;
		if (this.RP[room].called) {
			var text = '/pm ' + by + ', ';
		} else {
			var text = '';
			this.RP[room].called = true;
			setTimeout(function() {
				delete this.RP[room].called;
			}.bind(this), 60 * 1000);
		}
		if (!this.RP[room].plot) return this.say(room, text + 'There is no RP.');
		if (!this.RP[room].setAt) return this.say(room, text + 'The RP is ' + this.RP[room].plot + ', but it has not started yet. (Use .start when it is ready)');

		var start = new Date(this.RP[room].setAt);
		var now = (this.RP[room].pause) ? new Date(this.RP[room].pause) : new Date();
		var diff = (now.getTime() - start.getTime()) / 1000;
		var seconds = Math.floor(diff % 60);
		diff /= 60;
		var minutes = Math.floor(diff % 60);
		diff /= 60;
		var hours = Math.floor(diff % 24);
		var progress = hours + ':' + ((minutes < 10) ? '0' + minutes : minutes) + ':' + ((seconds < 10) ? '0' + seconds : seconds);

		if (this.RP[room].pause) return this.say(room, text + 'The RP is ' + this.RP[room].plot + ', but it is paused. Paused at: ' + progress);
		this.say(room, text + 'The RP is ' + this.RP[room].plot + ', in progress for ' + progress + '.');
	},
	host: function(arg, by, room) {
		if (!(room in this.RP)) return false;
		if (this.RP[room].hostCalled) {
			var text = '/pm ' + by + ', ';
		} else {
			var text = '';
			this.RP[room].hostCalled = true;
			setTimeout(function() {
				delete this.RP[room].hostCalled;
			}.bind(this), 60 * 1000);
		}
		if (!this.RP[room].host) return this.say(room, text + 'There is no host.');
		if (this.RP[room].host && this.RP[room].cohost) return this.say(room,text + 'the host is ' + this.RP[room].host + ', with ' + this.RP[room].cohost + ' as cohost(s).');
		this.say(room, text + 'The host is ' + this.RP[room].host + '.');
	},
	voice: function(arg, by, room) {
		if (config.serverid !== 'showdown' || !('amphyrp' in this.RP) || room.charAt(0) !== ',') return false;

		if (this.canUse('voice', room, by) || room === user) {
			var text = '';
		} else {
			var text = '/pm ' + by + ', ';
		}
		return this.say(room, text + 'The command ".voice" has been deprecated, please PM a mod for voice.');
	},
	plug: function(arg, by, room) {
		if (config.serverid !== 'showdown') return false;
		if ((this.hasRank(by, '+%@#~') && config.rprooms.indexOf(room) !== -1) || room === user) {
			var text = '';
		} else {
			var text = '/pm ' + by + ', ';
		}
		this.say(room, text + 'Come join our plug.dj! https://plug.dj/official-rp-room-plug-dj-2/');
	},
	site: function(arg, by, room) {
		if (config.serverid !== 'showdown') return false;
		if ((this.hasRank(by, '+%@#~') && config.rprooms.indexOf(room) !== -1) || room === user) {
			var text = '';
		} else {
			var text = '/pm ' + by + ', ';
		}
		this.say(room, text + 'Roleplaying\'s Website: http://psroleplaying.wix.com/roleplay');
	},
	forum: function(arg, by, room) {
		if (config.serverid !== 'showdown') return false;
		if ((this.hasRank(by, '+%@#~') && config.rprooms.indexOf(room) !== -1) || room === user) {
			var text = '';
		} else {
			var text = '/pm ' + by + ', ';
		}
		this.say(room, text + 'Roleplaying\'s Forum: http://psroleplaying.forumotion.com/');
	}
};
