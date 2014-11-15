/**
 * This is the file where the bot commands are located
 *
 * @license MIT license
 */

var http = require('http');
var sys = require('sys');

exports.commands = {
	/**
	 * Help commands
	 *
	 * These commands are here to provide information about the bot.
	 */

	about: function(arg, by, room, con) {
		if (this.hasRank(by, '#~') || room.charAt(0) === ',') {
			var text = '';
		} else {
			var text = '/pm ' + by + ', ';
		}
		text += '**Roleplaying Bot**: fork of **Pokemon Showdown Bot** by Quinella and TalkTakesTime, with custom roleplaying commands by Morfent.';
		this.say(con, room, text);
	},
	help: 'guide',
	guide: function(arg, by, room, con) {
		if (this.hasRank(by, '#~') || room.charAt(0) === ',') {
			var text = '';
		} else {
			var text = '/pm ' + by + ', ';
		}
		if (config.botguide) {
			text += 'A guide on how to use this bot can be found here: ' + config.botguide;
		} else {
			text += 'There is no guide for this bot. PM the owner with any questions.';
		}
		this.say(con, room, text);
	},

	/**
	 * Dev commands
	 *
	 * These commands are here for highly ranked users (or the creator) to use
	 * to perform arbitrary actions that can't be done through any other commands
	 * or to help with upkeep of the bot.
	 */

	reload: function(arg, by, room, con) {
		if (!this.hasRank(by, '#~')) return false;
		try {
			this.uncacheTree('./commands.js');
			Commands = require('./commands.js').commands;
			this.say(con, room, 'Commands reloaded.');
		} catch (e) {
			error('failed to reload: ' + sys.inspect(e));
		}
	},
	custom: function(arg, by, room, con) {
		if (!this.hasRank(by, '~')) return false;
		// Custom commands can be executed in an arbitrary room using the syntax
		// ".custom [room] command", e.g., to do !data pikachu in the room lobby,
		// the command would be ".custom [lobby] !data pikachu". However, using
		// "[" and "]" in the custom command to be executed can mess this up, so
		// be careful with them.
		if (arg.indexOf('[') === 0 && arg.indexOf(']') > -1) {
			var tarRoom = arg.slice(1, arg.indexOf(']'));
			arg = arg.substr(arg.indexOf(']') + 1).trim();
		}
		this.say(con, tarRoom || room, arg);
	},
	js: function(arg, by, room, con) {
		if (config.excepts.indexOf(toId(by)) === -1) return false;
		try {
			var result = eval(arg.trim());
			this.say(con, room, JSON.stringify(result));
		} catch (e) {
			this.say(con, room, e.name + ": " + e.message);
		}
	},

	/**
	 * Room Owner commands
	 *
	 * These commands allow room owners to personalise settings for moderation and command use.
	 */

	settings: 'set',
	set: function(arg, by, room, con) {
		if (!this.hasRank(by, '%@&#~') || room.charAt(0) === ',') return false;

		var settable = {
			joke: 1,
			'8ball': 1,
			autoban: 1,
			regexautoban: 1,
			banword: 1,
			setrp: 1
		};
		var modOpts = {
			flooding: 1,
			caps: 1,
			stretching: 1,
			bannedwords: 1,
			snen: 1
		};

		var opts = arg.split(',');
		var cmd = toId(opts[0]);
		if (cmd === 'mod' || cmd === 'm' || cmd === 'modding') {
			if (!opts[1] || !toId(opts[1]) || !(toId(opts[1]) in modOpts)) return this.say(con, room, 'Incorrect command: correct syntax is .set mod, [' +
				Object.keys(modOpts).join('/') + '](, [on/off])');

			if (!this.settings['modding']) this.settings['modding'] = {};
			if (!this.settings['modding'][room]) this.settings['modding'][room] = {};
			if (opts[2] && toId(opts[2])) {
				if (!this.hasRank(by, '#~')) return false;
				if (!(toId(opts[2]) in {on: 1, off: 1}))  return this.say(con, room, 'Incorrect command: correct syntax is .set mod, [' +
					Object.keys(modOpts).join('/') + '](, [on/off])');
				if (toId(opts[2]) === 'off') {
					this.settings['modding'][room][toId(opts[1])] = 0;
				} else {
					delete this.settings['modding'][room][toId(opts[1])];
				}
				this.writeSettings();
				this.say(con, room, 'Moderation for ' + toId(opts[1]) + ' in this room is now ' + toId(opts[2]).toUpperCase() + '.');
				return;
			} else {
				this.say(con, room, 'Moderation for ' + toId(opts[1]) + ' in this room is currently ' +
					(this.settings['modding'][room][toId(opts[1])] === 0 ? 'OFF' : 'ON') + '.');
				return;
			}
		} else {
			if (!Commands[cmd]) return this.say(con, room, '.' + opts[0] + ' is not a valid command.');
			var failsafe = 0;
			while (!(cmd in settable)) {
				if (typeof Commands[cmd] === 'string') {
					cmd = Commands[cmd];
				} else if (typeof Commands[cmd] === 'function') {
					if (cmd in settable) {
						break;
					} else {
						this.say(con, room, 'The settings for .' + opts[0] + ' cannot be changed.');
						return;
					}
				} else {
					this.say(con, room, 'Something went wrong. PM TalkTakesTime here or on Smogon with the command you tried.');
					return;
				}
				failsafe++;
				if (failsafe > 5) {
					this.say(con, room, 'The command ".' + opts[0] + '" could not be found.');
					return;
				}
			}

			var settingsLevels = {
				off: false,
				disable: false,
				'+': '+',
				'%': '%',
				'@': '@',
				'&': '&',
				'#': '#',
				'~': '~',
				on: true,
				enable: true
			};
			if (!opts[1] || !opts[1].trim()) {
				var msg = '';
				if (!this.settings[cmd] || (!this.settings[cmd][room] && this.settings[cmd][room] !== false)) {
					msg = '.' + cmd + ' is available for users of rank ' + ((cmd === 'autoban' || cmd === 'banword') ? '#' : config.defaultrank) + ' and above.';
				} else if (this.settings[cmd][room] in settingsLevels) {
					msg = '.' + cmd + ' is available for users of rank ' + this.settings[cmd][room] + ' and above.';
				} else if (this.settings[cmd][room] === true) {
					msg = '.' + cmd + ' is available for all users in this room.';
				} else if (this.settings[cmd][room] === false) {
					msg = '.' + cmd + ' is not available for use in this room.';
				}
				this.say(con, room, msg);
				return;
			} else {
				if (!this.hasRank(by, '#~')) return false;
				var newRank = opts[1].trim();
				if (!(newRank in settingsLevels)) return this.say(con, room, 'Unknown option: "' + newRank + '". Valid settings are: off/disable, +, %, @, &, #, ~, on/enable.');
				if (!this.settings[cmd]) this.settings[cmd] = {};
				this.settings[cmd][room] = settingsLevels[newRank];
				this.writeSettings();
				this.say(con, room, 'The command .' + cmd + ' is now ' +
					(settingsLevels[newRank] === newRank ? ' available for users of rank ' + newRank + ' and above.' :
					(this.settings[cmd][room] ? 'available for all users in this room.' : 'unavailable for use in this room.')))
			}
		}
	},
	blacklist: 'autoban',
	ban: 'autoban',
	ab: 'autoban',
	autoban: function(arg, by, room, con) {
		if (!this.canUse('autoban', room, by) || room.charAt(0) === ',') return false;
		if (!this.hasRank(this.ranks[room] || ' ', '@#&~')) return this.say(con, room, config.nick + ' requires rank of @ or higher to (un)blacklist.');

		arg = arg.split(',');
		var added = [];
		var illegalNick = [];
		var alreadyAdded = [];
		if (!arg.length || (arg.length === 1 && !arg[0].trim().length)) return this.say(con, room, 'You must specify at least one user to blacklist.');
		for (var i = 0; i < arg.length; i++) {
			var tarUser = toId(arg[i]);
			if (tarUser.length < 1 || tarUser.length > 18) {
				illegalNick.push(tarUser);
				continue;
			}
			if (!this.blacklistUser(tarUser, room)) {
				alreadyAdded.push(tarUser);
				continue;
			}
			this.say(con, room, '/roomban ' + tarUser + ', Blacklisted user');
			this.say(con,room, '/modnote ' + tarUser + ' was added to the blacklist by ' + by + '.');
			added.push(tarUser);
		}

		var text = '';
		if (added.length) {
			text += 'User(s) "' + added.join('", "') + '" added to blacklist successfully. ';
			this.writeSettings();
		}
		if (alreadyAdded.length) text += 'User(s) "' + alreadyAdded.join('", "') + '" already present in blacklist. ';
		if (illegalNick.length) text += 'All ' + (text.length ? 'other ' : '') + 'users had illegal nicks and were not blacklisted.';
		this.say(con, room, text);
	},
	unblacklist: 'unautoban',
	unban: 'unautoban',
	unab: 'unautoban',
	unautoban: function(arg, by, room, con) {
		if (!this.canUse('autoban', room, by) || room.charAt(0) === ',') return false;
		if (!this.hasRank(this.ranks[room] || ' ', '@#&~')) return this.say(con, room, config.nick + ' requires rank of @ or higher to (un)blacklist.');

		arg = arg.split(',');
		var removed = [];
		var notRemoved = [];
		if (!arg.length || (arg.length === 1 && !arg[0].trim().length)) return this.say(con, room, 'You must specify at least one user to unblacklist.');
		for (var i = 0; i < arg.length; i++) {
			var tarUser = toId(arg[i]);
			if (tarUser.length < 1 || tarUser.length > 18) {
				notRemoved.push(tarUser);
				continue;
			}
			if (!this.unblacklistUser(tarUser, room)) {
				notRemoved.push(tarUser);
				continue;
			}
			this.say(con, room, '/roomunban ' + tarUser);
			removed.push(tarUser);
		}

		var text = '';
		if (removed.length) {
			text += 'User(s) "' + removed.join('", "') + '" removed from blacklist successfully. ';
			this.writeSettings();
		}
		if (notRemoved.length) text += (text.length ? 'No other ' : 'No ') + 'specified users were present in the blacklist.';
		this.say(con, room, text);
	},
	rab: 'regexautoban',
	regexab: 'regexautoban',
	regexautoban: function(arg, by, room, con) {
		if (!this.canUse('regexautoban', room, by) || room.charAt(0) === ',') return false;
		if (!this.hasRank(this.ranks[room] || ' ', '@#&~')) return this.say(con, room, config.nick + ' requires rank of @ or higher to (un)blacklist.');
		if (!arg) return this.say(con, room, 'No pattern was specified.');
		if (!/[^\\\{,]\w/.test(arg)) return false;
		arg = '/' + arg + '/i';
		if (!this.blacklistUser(arg, room)) return this.say(con, room, 'Pattern ' + arg + ' is already present in the blacklist.');	

		this.say(con, room, 'Pattern ' + arg + ' added to the blacklist successfully.');
		this.writeSettings();
	},
	unrab: 'unregexautoban',
	unregexab: 'unregexautoban',
	unregexautoban: function(arg, by, room, con) {
		if (!this.canUse('regexautoban', room, by) || room.charAt(0) === ',') return false;
		if (!this.hasRank(this.ranks[room] || ' ', '@#&~')) return this.say(con, room, config.nick + ' requires rank of @ or higher to (un)blacklist.');
		if (!arg) return this.say(con, room, 'No pattern was specified.');
		arg = '/' + arg + '/i';
		if (!this.unblacklistUser(arg, room)) return this.say(con, room, 'Pattern ' + arg + ' isn\'t present in the blacklist.');

		this.say(con, room, 'Pattern ' + arg + ' removed from the blacklist successfully.');
		this.writeSettings();
	},
	viewbans: 'viewblacklist',
	vab: 'viewblacklist',
	viewautobans: 'viewblacklist',
	viewblacklist: function(arg, by, room, con) {
		if (!this.canUse('autoban', room, by) || room.charAt(0) === ',') return false;

		var text = '';
		if (!this.settings.blacklist || !this.settings.blacklist[room]) {
			text = 'No users are blacklisted in this room.';
		} else {
			if (arg.length) {
				var nick = toId(arg);
				if (nick.length < 1 || nick.length > 18) {
					text = 'Invalid nickname: "' + nick + '".';
				} else {
					text = 'User "' + nick + '" is currently ' + (nick in this.settings.blacklist[room] ? '' : 'not ') + 'blacklisted in ' + room + '.';
				}
			} else {
				var nickList = Object.keys(this.settings.blacklist[room]);
				if (!nickList.length) return this.say(con, room, '/pm ' + by + ', No users are blacklisted in this room.');
				this.uploadToHastebin(con, room, by, 'The following users are banned in ' + room + ':\n\n' + nickList.join('\n'))
				return;
			}
		}
		this.say(con, room, '/pm ' + by + ', ' + text);
	},
	banphrase: 'banword',
	banword: function(arg, by, room, con) {
		if (!this.canUse('banword', room, by)) return false;
		if (!this.settings.bannedphrases) this.settings.bannedphrases = {};
		arg = arg.trim().toLowerCase();
		if (!arg) return false;
		var tarRoom = room;

		if (room.charAt(0) === ',') {
			if (!this.hasRank(by, '~')) return false;
			tarRoom = 'global';
		}

		if (!this.settings.bannedphrases[tarRoom]) this.settings.bannedphrases[tarRoom] = {};
		if (arg in this.settings.bannedphrases[tarRoom]) return this.say(con, room, "Phrase \"" + arg + "\" is already banned.");
		this.settings.bannedphrases[tarRoom][arg] = 1;
		this.writeSettings();
		this.say(con, room, "Phrase \"" + arg + "\" is now banned.");
	},
	unbanphrase: 'unbanword',
	unbanword: function(arg, by, room, con) {
		if (!this.canUse('banword', room, by)) return false;
		arg = arg.trim().toLowerCase();
		if (!arg) return false;
		var tarRoom = room;

		if (room.charAt(0) === ',') {
			if (!this.hasRank(by, '~')) return false;
			tarRoom = 'global';
		}

		if (!this.settings.bannedphrases || !this.settings.bannedphrases[tarRoom] || !(arg in this.settings.bannedphrases[tarRoom])) 
			return this.say(con, room, "Phrase \"" + arg + "\" is not currently banned.");
		delete this.settings.bannedphrases[tarRoom][arg];
		if (!Object.size(this.settings.bannedphrases[tarRoom])) delete this.settings.bannedphrases[tarRoom];
		if (!Object.size(this.settings.bannedphrases)) delete this.settings.bannedphrases;
		this.writeSettings();
		this.say(con, room, "Phrase \"" + arg + "\" is no longer banned.");
	},
	viewbannedphrases: 'viewbannedwords',
	vbw: 'viewbannedwords',
	viewbannedwords: function(arg, by, room, con) {
		if (!this.canUse('banword', room, by)) return false;
		arg = arg.trim().toLowerCase();
		var tarRoom = room;

		if (room.charAt(0) === ',') {
			if (!this.hasRank(by, '~')) return false;
			tarRoom = 'global';
		}

		var text = "";
		if (!this.settings.bannedphrases || !this.settings.bannedphrases[tarRoom]) {
			text = "No phrases are banned in this room.";
		} else {
			if (arg.length) {
				text = "The phrase \"" + arg + "\" is currently " + (arg in this.settings.bannedphrases[tarRoom] ? "" : "not ") + "banned " +
					(room.charAt(0) === ',' ? "globally" : "in " + room) + ".";
			} else {
				var banList = Object.keys(this.settings.bannedphrases[tarRoom]);
				if (!banList.length) return this.say(con, room, "No phrases are banned in this room.");
				this.uploadToHastebin(con, room, by, "The following phrases are banned " + (room.charAt(0) === ',' ? "globally" : "in " + room) + ":\n\n" + banList.join('\n'))
				return;
			}
		}
		this.say(con, room, text);
	},

	/**
	 * General commands
	 *
	 * Add custom commands here.
	 */

	joke: function(arg, by, room, con) {
		if (!this.canUse('joke', room, by) || room.charAt(0) === ',') return false;
		var self = this;

		var reqOpt = {
			hostname: 'api.icndb.com',
			path: '/jokes/random',
			method: 'GET'
		};
		var req = http.request(reqOpt, function(res) {
			res.on('data', function(chunk) {
				try {
					var data = JSON.parse(chunk);
					self.say(con, room, data.value.joke.replace(/&quot;/g, "\""));
				} catch (e) {
					self.say(con, room, 'Sorry, couldn\'t fetch a random joke... :(');
				}
			})
		});
		req.end();
	},
	seen: function(arg, by, room, con) { // this command is still a bit buggy
		var text = (room.charAt(0) === ',' ? '' : '/pm ' + by + ', ');
		arg = toId(arg);
		if (!arg || arg.length > 18) return this.say(con, room, text + 'Invalid username.');
		if (arg === toId(by)) {
			text += 'Have you looked in the mirror lately?';
		} else if (arg === toId(config.nick)) {
			text += 'You might be either blind or illiterate. Might want to get that checked out.';
		} else if (!this.chatData[arg] || !this.chatData[arg].seenAt) {
			text += 'The user ' + arg + ' has never been seen.';
		} else {
			text += arg + ' was last seen ' + this.getTimeAgo(this.chatData[arg].seenAt) + ' ago' + (
				this.chatData[arg].lastSeen ? ', ' + this.chatData[arg].lastSeen : '.');
		}
		this.say(con, room, text);
	},
	'8ball': function(arg, by, room, con) {
		if (this.canUse('8ball', room, by) || room.charAt(0) === ',') {
			var text = '';
		} else {
			var text = '/pm ' + by + ', ';
		}

		var rand = Math.floor(20 * Math.random()) + 1;

		switch (rand) {
	 		case 1: text += "Signs point to yes."; break;
	  		case 2: text += "Yes."; break;
			case 3: text += "Reply hazy, try again."; break;
			case 4: text += "Without a doubt."; break;
			case 5: text += "My sources say no."; break;
			case 6: text += "As I see it, yes."; break;
			case 7: text += "You may rely on it."; break;
			case 8: text += "Concentrate and ask again."; break;
			case 9: text += "Outlook not so good."; break;
			case 10: text += "It is decidedly so."; break;
			case 11: text += "Better not tell you now."; break;
			case 12: text += "Very doubtful."; break;
			case 13: text += "Yes - definitely."; break;
			case 14: text += "It is certain."; break;
			case 15: text += "Cannot predict now."; break;
			case 16: text += "Most likely."; break;
			case 17: text += "Ask again later."; break;
			case 18: text += "My reply is no."; break;
			case 19: text += "Outlook good."; break;
			case 20: text += "Don't count on it."; break;
		}
		this.say(con, room, text);
	},

	// Roleplaying commands
	setrp: function(arg, by, room, con) {
		if (!this.canUse('setrp', room, by) || room.charAt(0) === ',') return false;
		if (!(room in this.RP) && room !== 'art') return this.say(con, room, 'I seriously hope you\'re not trying to do this.');
		if (!arg) return this.say(con, room, 'Please enter an RP.');

		this.RP[room].plot = arg;
		if (this.RP[room].setAt) return this.say(con, room, 'The RP was set to ' + arg + '.');
		this.say(con, room, 'The RP was set to ' + arg + '. Use .start to start the RP.');
	},
	rpstart: 'start',
	start: function(arg, by, room, con) {
		if (!this.canUse('setrp', room, by) || !(room in this.RP) || this.RP[room].setAt) return false;
		if (!this.RP[room].plot) {
			if (!arg) return this.say(con, room, 'Please set an RP before using .start, or specify an RP with .start to start one immediately.');
			this.RP[room].plot = arg;
		}

		var now = new Date();
		this.RP[room].setAt = now;
		if (this.hasRank(this.ranks[room] || ' ', '%@#&~')) {
			this.say(con, room, '/wall The RP has started.');
		} else {
			this.say(con, room, '**The RP has started.**');
		}
	},
	pauserp: 'rppause',
	rppause: function(arg, by, room, con) {
		if (!this.canUse('setrp', room, by) || !(room in this.RP) || !this.RP[room].setAt || this.RP[room].pause) return false;

		this.RP[room].pause = new Date();
		if (this.hasRank(this.ranks[room] || ' ', '%@#&~')) {
			this.say(con, room, '/wall RP pause');
		} else {
			this.say(con, room, '**RP pause**');
		}
	},
	continuerp: 'rpcontinue',
	rpcontinue: function(arg, by, room, con) {
		if (!this.canUse('setrp', room, by) || !(room in this.RP) || !this.RP[room].setAt || !this.RP[room].pause) return false;

		var paused = new Date(this.RP[room].pause);
		var setAt = new Date(this.RP[room].setAt);
		var diff = new Date();
		diff.setTime(diff.getTime() - paused.getTime());
		this.RP[room].setAt.setTime(setAt.getTime() + diff.getTime());

		delete this.RP[room].pause;
		if (this.hasRank(this.ranks[room] || ' ', '%@#&~')) {
			this.say(con, room, '/wall RP continue');
		} else {
			this.say(con, room, '**RP continue**');
		}
	},
	sethost: function(arg, by, room, con) {
		if (!this.canUse('setrp', room, by) || !(room in this.RP) || !this.RP[room].plot) return false;
		if (!arg) return this.say(con, room, 'Please enter a host.');

		this.RP[room].host = arg;
		this.say(con, room, 'The host was set to ' + arg + '.');
	},
	rmhost: function(arg, by, room, con) {
		if (!this.canUse('setrp', room, by) || !(room in this.RP) || !this.RP[room].plot) return false;
		if (!this.RP[room].host) return this.say(con, room, 'There is no host to remove.');

		delete this.RP[room].host;
		this.say(con, room, 'The host has been removed.');
	},
	rpend: 'endrp',
	endrp: function(arg, by, room, con) {
		if (!this.canUse('setrp', room, by) || !(room in this.RP) || !this.RP[room].plot) return false;
		if (config.serverid === 'showdown' && this.RP[room].setAt) {
			nextVoid = this.splitDoc(this.RP[room].plot);
			if (this.RP.void[room].length === 2) this.RP.void[room].shift();
			this.RP.void[room].push(nextVoid);
		}

		this.RP[room] = {};
		if (this.hasRank(this.ranks[room] || ' ', '%@#&~')) {
			this.say(con, room, '/wall The RP has ended.');
		} else {
			this.say(con, room, '**The RP has ended.**');
		}
	},
	void: function(arg, by, room, con) {
		if (config.serverid !== 'showdown' || !(room in this.RP) || this.RP[room].plot || !this.hasRank(by, '+%@#~') || room.charAt(0) === ',') return false;

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
				return this.say(con, room, 'Something went wrong with how void RPs are stored.');
		}
		var concurrent = (room === 'roleplaying') ? this.splitDoc(this.RP['amphyrp'].plot) : this.splitDoc(this.RP['roleplaying'].plot);
		if (concurrent) text += ' The current RP in ' + ((room === 'roleplaying') ? 'AmphyRP' : 'Roleplaying') + ' is ' + concurrent + '.';

		this.say(con, room, text);
	},
	rp: function(arg, by, room, con) {
		if (room.charAt(0) === ',') return false;
		if (!(room in this.RP) && room !== 'art') return this.say(con, room, 'I seriously hope you\'re not trying to do this.');
		if (this.RP[room].called) {
			var text = '/pm ' + by + ', ';
		} else {
			var text = '';
			var self = this;
			this.RP[room].called = true;
			setTimeout(function() { delete self.RP[room].called; }, 60 * 1000);
		}
		if (!this.RP[room].plot) return this.say(con, room, text + 'There is no RP.');
		if (!this.RP[room].setAt) return this.say(con, room, text + 'The RP is ' + this.RP[room].plot + ', but it has not started yet. (Use .start when it is ready)');

		var start = new Date(this.RP[room].setAt);
		var now = (this.RP[room].pause) ? new Date(this.RP[room].pause) : new Date();
		var diff = (now.getTime() - start.getTime()) / 1000;
		var seconds = Math.floor(diff % 60);
		diff /= 60;
		var minutes = Math.floor(diff % 60);
		diff /= 60;
		var hours = Math.floor(diff % 24);
		var progress = hours + ':' + ((minutes < 10) ? '0' + minutes : minutes) + ':' + ((seconds < 10) ? '0' + seconds : seconds);

		if (this.RP[room].pause) return this.say(con, room, text + 'The RP is ' + this.RP[room].plot + ', but it is paused. Paused at: ' + progress);
		this.say(con, room, text + 'The RP is ' + this.RP[room].plot + ', in progress for ' + progress + '.');
	},
	host: function(arg, by, room, con) {
		if (!(room in this.RP) || room.charAt(0) === ',') return false;
		if (this.RP[room].hostCalled) {
			var text = '/pm ' + by + ', ';
		} else {
			var text = '';
			var self = this;
			this.RP[room].hostCalled = true;
			setTimeout(function() { delete self.RP[room].hostCalled; }, 60 * 1000);
		}
		if (!this.RP[room].host) return this.say(con, room, text + 'There is no host.');
		this.say(con, room, text + 'The host is ' + this.RP[room].host + '.');
	},
	voice: function(arg, by, room, con) {
		if (config.serverid !== 'showdown' || !('amphyrp' in this.RP) || room.charAt(0) !== ',') return false;

		var freeDay = this.isFreeDay();
		if (!freeDay && !this.RP['amphyrp'].plot) return this.say(con, room, '.voice can only be used after an RP has been set. Wait until the RP has been set before asking for voice.');
		if (freeDay) return this.say(con, room, freeDay + ' is a free day, so voice can\'t be given out.');
		this.say(con, 'amphyrp', '/roomvoice ' + by);
	},
	ampclear: function(arg, by, room, con) {
		if (config.serverid !== 'showdown' || room !== 'amphyrp' || !this.hasRank(by, '@#~')) return false;
		if (!this.isFreeDay()) {
			if (this.RP['amphyrp'] && this.RP['amphyrp'].plot) return this.say(con, room, 'Please wait until the RP is over before clearing the voice list.');
		} else {
			this.say(con, room, '/modchat false');
		}
		this.say(con, room, '/roomauth');
		setTimeout(function(self) {
			if (self.amphyVoices.length === 0) return self.say(con, room, 'No roomvoices have been added yet.');

			var len = self.amphyVoices.length;
			for (var i = 0; i < len; i++) {
				setTimeout(function(self, nick) {
					self.say(con, room, '/deroomvoice ' + nick);
				}, 1500*i, self, self.amphyVoices[i]);
			}
			if (len === 1) {
				self.say(con, room, 'Deroomvoicing finished.');
			} else {
				self.say(con, room, 'Deroomvoicing will be finished in ' + ((len - 1) * 1.5) + ' seconds.');
			}
			self.amphyVoices = [];
		}, 1000, this);
	},
	plug: function(arg, by, room, con) {
		if (config.serverid !== 'showdown') return false;
		if ((this.hasRank(by, '+%@#~') && config.rprooms.indexOf(room) !== -1) || room.charAt(0) === ',') {
			var text = '';
		} else {
			var text = '/pm ' + by + ', ';
		}
		this.say(con, room, text + 'Come join our plug.dj! https://plug.dj/official-rp-room-plug-dj-2/');
	},
	site: function(arg, by, room, con) {
		if (config.serverid !== 'showdown') return false;
		if ((this.hasRank(by, '+%@#~') && config.rprooms.indexOf(room) !== -1) || room.charAt(0) === ',') {
			var text = '';
		} else {
			var text = '/pm ' + by + ', ';
		}
		this.say(con, room, text + 'Roleplaying\'s Website: http://bit.ly/1xdK24X');
	},
	legends: 'legend',
	legend: function(arg, by, room, con) {
		if (config.serverid !== 'showdown' || !(room in this.RP) || !this.hasRank(by, '%@#&~')) return false;
		this.say(con, room, '/w ' + by + ', Legend Permission List: http://bit.ly/1lKutAw');
	}
};
