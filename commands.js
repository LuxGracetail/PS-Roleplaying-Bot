/**
 * This is the file where the bot commands are located
 *
 * @license MIT license
 */

var http = require('http');
var sys = require('sys');

var pollON = false;
var pollRoom = '';
var pollTimer = {};
var pollNoms = [];
var RPOpts = ['freeroam', 'goodvsevil', 'conquest', 'trainer', 'pokehigh', 'cruise', 'murdermystery', 'pokemonmysterydungeon', 'dungeonsndragonites', 'kingdom'];
var rpcaps = ['Freeroam', 'Good vs Evil', 'Conquest', 'Trainer', 'PokeHigh', 'Cruise', 'Murder Mystery', 'Pokemon Mystery Dungeon', 'Dungeons \'n Dragonites', 'Kingdom'];

var goodvsevilNom = [];
var conquestNom = [];
var trainerNom = [];
var pokehighNom = [];
var cruiseNom = [];
var murdermysteryNom = [];
var pokemonmysterydungeonNom = [];
var dungeonsndragonitesNom = [];
var kingdomNom = [];
var customPriorityFlag = false;

function splitDoc(voided) {
	if (!/docs\./.test(voided)) return voided;
	voided = voided.replace(/(doc.*)?(https?:\/\/)?docs.*/i, '').replace(/[^a-z0-9]*$/i, '');
	return voided;
};

function progressTime(model) {
	var start = new Date(model.setAt);
	var now = (model.pause) ? new Date(model.pause) : new Date();
	var diff = (now.getTime() - start.getTime()) / 1000;
	var seconds = Math.floor(diff % 60);
	diff /= 60;
	var minutes = Math.floor(diff % 60);
	diff /= 60;
	var hours = Math.floor(diff % 24);
	return hours + ':' + ((minutes < 10) ? '0' + minutes : minutes) + ':' + ((seconds < 10) ? '0' + seconds : seconds);
}

exports.commands = {
	/**
	 * Help commands
	 *
	 * These commands are here to provide information about the bot.
	 */

	credits: 'about',
	about: function(arg, by, room) {
		if (this.hasRank(by, '#~') || room.charAt(0) === ',') {
			var text = '';
		} else {
			var text = '/pm ' + by + ', ';
		}
		text += '**Roleplaying Bot**: fork of **Pokemon Showdown Bot** by Quinella and TalkTakesTime, with custom roleplaying commands by Morfent, Starbloom and Lux.';
		this.say(room, text);
	},
	git: function(arg, by, room) {
		if (this.hasRank(by, '#~') || room.charAt(0) === ',') {
			var text = '';
		} else {
			var text = '/pm ' + by + ', ';
		}
		
//		var text = config.excepts.indexOf(toId(by)) < 0 ? '/pm ' + by + ', ' : '';
		text += '**Pokemon Showdown Bot** source code: ' + config.fork;
		this.say(room, text);
	},
	help: 'guide',
	guide: function(arg, by, room) {
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
		this.say(room, text);
	},
	usage: 'usagestats',
	usagestats: function (arg, by, room) {
		if (this.hasRank(by, '#~') || room.charAt(0) === ',') {
			var text = '';
		} else {
			var text = '/pm ' + by + ', ';
		}
		text += 'http://www.smogon.com/stats/';
		this.say(room, text);
	},

	/**
	 * Dev commands
	 *
	 * These commands are here for highly ranked users (or the creator) to use
	 * to perform arbitrary actions that can't be done through any other commands
	 * or to help with upkeep of the bot.
	 */

	reload: function(arg, by, room) {
		if (!this.hasRank(by, '#~')) return false;
		try {
			this.uncacheTree('./commands.js');
			global.Commands = require('./commands.js').commands;
			this.say(room, 'Commands reloaded.');
		} catch (e) {
			error('failed to reload: ' + sys.inspect(e));
		}
	},
	custom: function(arg, by, room) {
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
		this.say(tarRoom || room, arg);
	},
	js: function(arg, by, room) {
		if (config.excepts.indexOf(toId(by)) === -1) return false;
		try {
			var result = eval(arg.trim());
			this.say(room, JSON.stringify(result));
		} catch (e) {
			this.say(room, e.name + ": " + e.message);
		}
	},
	uptime: function (arg, by, room) {
		if (!room.charAt(0) === ',') {
			var text = '**Uptime:** ';
		} else {
			var text = config.excepts.indexOf(toId(by)) < 0 ? '/pm ' + by + ', **Uptime:** ' : '**Uptime:** ';
		}
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
	set: function(arg, by, room) {
		if (!this.hasRank(by, '%@&#~') || room.charAt(0) === ',') return false;

		var settable = {
			joke: 1,
			'8ball': 1,
			autoban: 1,
			regexautoban: 1,
			banword: 1,
			setrp: 1,
			vab: 1,
			vbw: 1,
		};
		var modOpts = {
			flooding: 1,
			caps: 1,
			stretching: 1,
			bannedwords: 1
		};

		var opts = arg.split(',');
		var cmd = toId(opts[0]);
		if (cmd === 'mod' || cmd === 'm' || cmd === 'modding') {
			if (!opts[1] || !toId(opts[1]) || !(toId(opts[1]) in modOpts)) return this.say(room, 'Incorrect command: correct syntax is ' + config.commandcharacter + 'set mod, [' +
				Object.keys(modOpts).join('/') + '](, [on/off])');

			if (!this.settings['modding']) this.settings['modding'] = {};
			if (!this.settings['modding'][room]) this.settings['modding'][room] = {};
			if (opts[2] && toId(opts[2])) {
				if (!this.hasRank(by, '#~')) return false;
				if (!(toId(opts[2]) in {on: 1, off: 1}))  return this.say(room, 'Incorrect command: correct syntax is ' + config.commandcharacter + 'set mod, [' +
					Object.keys(modOpts).join('/') + '](, [on/off])');
				if (toId(opts[2]) === 'off') {
					this.settings['modding'][room][toId(opts[1])] = 0;
				} else {
					delete this.settings['modding'][room][toId(opts[1])];
				}
				this.writeSettings();
				this.say(room, 'Moderation for ' + toId(opts[1]) + ' in this room is now ' + toId(opts[2]).toUpperCase() + '.');
				return;
			} else {
				this.say(room, 'Moderation for ' + toId(opts[1]) + ' in this room is currently ' +
					(this.settings['modding'][room][toId(opts[1])] === 0 ? 'OFF' : 'ON') + '.');
				return;
			}
		} else {
			if (!Commands[cmd]) return this.say(room, config.commandcharacter + '' + opts[0] + ' is not a valid command.');
			var failsafe = 0;
			while (!(cmd in settable)) {
				if (typeof Commands[cmd] === 'string') {
					cmd = Commands[cmd];
				} else if (typeof Commands[cmd] === 'function') {
					if (cmd in settable) {
						break;
					} else {
						this.say(room, 'The settings for ' + config.commandcharacter + '' + opts[0] + ' cannot be changed.');
						return;
					}
				} else {
					this.say(room, 'Something went wrong. PM Lux (Lucario) or Starbloom here or on Smogon with the command you tried.');
					return;
				}
				failsafe++;
				if (failsafe > 5) {
					this.say(room, 'The command "' + config.commandcharacter + '' + opts[0] + '" could not be found.');
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
					msg = '' + config.commandcharacter + '' + cmd + ' is available for users of rank ' + ((cmd === 'autoban' || cmd === 'banword') ? '#' : config.defaultrank) + ' and above.';
				} else if (this.settings[cmd][room] in settingsLevels) {
					msg = '' + config.commandcharacter + '' + cmd + ' is available for users of rank ' + this.settings[cmd][room] + ' and above.';
				} else if (this.settings[cmd][room] === true) {
					msg = '' + config.commandcharacter + '' + cmd + ' is available for all users in this room.';
				} else if (this.settings[cmd][room] === false) {
					msg = '' + config.commandcharacter + '' + cmd + ' is not available for use in this room.';
				}
				this.say(room, msg);
				return;
			} else {
				if (!this.hasRank(by, '#~')) return false;
				var newRank = opts[1].trim();
				if (!(newRank in settingsLevels)) return this.say(room, 'Unknown option: "' + newRank + '". Valid settings are: off/disable, +, %, @, &, #, ~, on/enable.');
				if (!this.settings[cmd]) this.settings[cmd] = {};
				this.settings[cmd][room] = settingsLevels[newRank];
				this.writeSettings();
				this.say(room, 'The command ' + config.commandcharacter + '' + cmd + ' is now ' +
					(settingsLevels[newRank] === newRank ? ' available for users of rank ' + newRank + ' and above.' :
					(this.settings[cmd][room] ? 'available for all users in this room.' : 'unavailable for use in this room.')));
			}
		}
	},
	blacklist: 'autoban',
	ban: 'autoban',
	ab: 'autoban',
	autoban: function(arg, by, room) {
		if (!this.canUse('autoban', room, by) || room.charAt(0) === ',') return false;
		if (!this.hasRank(this.ranks[room] || ' ', '@*&#~')) return this.say(room, config.nick + ' requires rank of @ or higher to (un)blacklist.');

		arg = arg.split(',');
		var added = [];
		var illegalNick = [];
		var alreadyAdded = [];
		if (!arg.length || (arg.length === 1 && !arg[0].trim().length)) return this.say(room, 'You must specify at least one user to blacklist.');
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
			this.say(room, '/roomban ' + tarUser + ', Blacklisted user');
			this.say(room, '/modnote ' + tarUser + ' was added to the blacklist by ' + by + '.');
			added.push(tarUser);
		}

		var text = '';
		if (added.length) {
			text += 'User(s) "' + added.join('", "') + '" added to blacklist successfully. ';
			this.writeSettings();
		}
		if (alreadyAdded.length) text += 'User(s) "' + alreadyAdded.join('", "') + '" already present in blacklist. ';
		if (illegalNick.length) text += 'All ' + (text.length ? 'other ' : '') + 'users had illegal nicks and were not blacklisted.';
		this.say(room, text);
	},
	unblacklist: 'unautoban',
	unban: 'unautoban',
	unab: 'unautoban',
	unautoban: function(arg, by, room) {
		if (!this.canUse('autoban', room, by) || room.charAt(0) === ',') return false;
		if (!this.hasRank(this.ranks[room] || ' ', '@*&#~')) return this.say(room, config.nick + ' requires rank of @ or higher to (un)blacklist.');

		arg = arg.split(',');
		var removed = [];
		var notRemoved = [];
		if (!arg.length || (arg.length === 1 && !arg[0].trim().length)) return this.say(room, 'You must specify at least one user to unblacklist.');
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
			this.say(room, '/roomunban ' + tarUser);
			this.say(room, '/modnote ' + tarUser + ' was removed from the blacklist by ' + by + '.');
			removed.push(tarUser);
		}

		var text = '';
		if (removed.length) {
			text += 'User(s) "' + removed.join('", "') + '" removed from blacklist successfully. ';
			this.writeSettings();
		}
		if (notRemoved.length) text += (text.length ? 'No other ' : 'No ') + 'specified users were present in the blacklist.';
		this.say(room, text);
	},
	rab: 'regexautoban',
	regexautoban: function(arg, by, room) {
		if (config.regexautobanwhitelist.indexOf(toId(by)) < 0 || !this.canUse('autoban', room, by) || room.charAt(0) === ',') return false;
		if (!this.hasRank(this.ranks[room] || ' ', '@*&#~')) return this.say(room, config.nick + ' requires rank of @ or higher to (un)blacklist.');
		if (!arg) return this.say(room, 'You must specify a regular expression to (un)blacklist.');

		try {
			new RegExp(arg, 'i');
		} catch (e) {
			return this.say(room, e.message);
		}

		arg = '/' + arg + '/i';
		if (!this.blacklistUser(arg, room)) return this.say(room, '/' + arg + ' is already present in the blacklist.');

		this.writeSettings();
		this.say(room, '/' + arg + ' was added to the blacklist successfully.');
	},
	unrab: 'unregexautoban',
	unregexautoban: function(arg, by, room) {
		if (config.regexautobanwhitelist.indexOf(toId(by)) < 0 || !this.canUse('autoban', room, by) || room.charAt(0) === ',') return false;
		if (!this.hasRank(this.ranks[room] || ' ', '@*&#~')) return this.say(room, config.nick + ' requires rank of @ or higher to (un)blacklist.');
		if (!arg) return this.say(room, 'You must specify a regular expression to (un)blacklist.');

		arg = '/' + arg.replace(/\\\\/g, '\\') + '/i';
		if (!this.unblacklistUser(arg, room)) return this.say(room,'/' + arg + ' is not present in the blacklist.');

		this.writeSettings();
		this.say(room, '/' + arg + ' was removed from the blacklist successfully.');
	},
	viewbans: 'viewblacklist',
	vab: 'viewblacklist',
	viewautobans: 'viewblacklist',
	viewblacklist: function(arg, by, room) {
		if (!this.canUse('autoban', room, by) &&  !(config.staffList.indexOf(toId(by)) > -1)) return false;
		
		if (room.charAt(0) === ',') {
			if (toId(arg) == 'roleplaying' || toId(arg) == 'amphyrp' || toId(arg) == 'rustyrp') {
				if (toId(arg) == 'roleplaying') {
					if (!(config.modList.indexOf(toId(by)) > -1)){
						return this.say(room, "No, it doesn't work for main if you're not mod or above there.");
					}
				}
				room = toId(arg);
				arg = '';
			} else {
				return this.say(room, "Please specify a room.");
			}
			
		}
		
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
				if (!nickList.length) return this.say(room, '/pm ' + by + ', No users are blacklisted in this room.');
				this.uploadToHastebin('The following users are banned in ' + room + ':\n\n' + nickList.join('\n'), function (link) {
					this.say(room, "/pm " + by + ", Blacklist for room " + room + ": " + link);
				}.bind(this));
				return;
			}
		}
		this.say(room, '/pm ' + by + ', ' + text);
	},
	bw: 'banword',
	banphrase: 'banword',
	banword: function(arg, by, room) {
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
		if (arg in this.settings.bannedphrases[tarRoom]) return this.say(room, "Phrase \"" + arg + "\" is already banned.");
		this.settings.bannedphrases[tarRoom][arg] = 1;
		this.writeSettings();
		this.say(room, "Phrase \"" + arg + "\" is now banned.");
	},
	ubw: 'unbanword',
	unbanphrase: 'unbanword',
	unbanword: function(arg, by, room) {
		if (!this.canUse('banword', room, by)) return false;
		arg = arg.trim().toLowerCase();
		if (!arg) return false;
		var tarRoom = room;

		if (room.charAt(0) === ',') {
			if (!this.hasRank(by, '~')) return false;
			tarRoom = 'global';
		}

		if (!this.settings.bannedphrases || !this.settings.bannedphrases[tarRoom] || !(arg in this.settings.bannedphrases[tarRoom])) 
			return this.say(room, "Phrase \"" + arg + "\" is not currently banned.");
		delete this.settings.bannedphrases[tarRoom][arg];
		if (!Object.size(this.settings.bannedphrases[tarRoom])) delete this.settings.bannedphrases[tarRoom];
		if (!Object.size(this.settings.bannedphrases)) delete this.settings.bannedphrases;
		this.writeSettings();
		this.say(room, "Phrase \"" + arg + "\" is no longer banned.");
	},
	viewbannedphrases: 'viewbannedwords',
	vbw: 'viewbannedwords',
	viewbannedwords: function(arg, by, room) {
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
				if (!banList.length) return this.say(room, "No phrases are banned in this room.");
				this.uploadToHastebin("The following phrases are banned " + (room.charAt(0) === ',' ? "globally" : "in " + room) + ":\n\n" + banList.join('\n'), function (link) {
					this.say(room, (room.charAt(0) === ',' ? "" : "/pm " + by + ", ") + "Banned Phrases " + (room.charAt(0) === ',' ? "globally" : "in " + room) + ": " + link);
				}.bind(this));
				return;
			}
		}
		this.say(room, text);
	},

	/**
	 * General commands
	 *
	 * Add custom commands here.
	 */

	joke: function(arg, by, room) {
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
					self.say(room, data.value.joke.replace(/&quot;/g, "\""));
				} catch (e) {
					self.say(room, 'Sorry, couldn\'t fetch a random joke... :(');
				}
			});
		});
		req.end();
	},
	seen: function(arg, by, room) { // this command is still a bit buggy //I think it's fixed now
		var text = (room.charAt(0) === ',' ? '' : '/pm ' + by + ', ');
		arg = toId(arg);
		if (!arg || arg.length > 18) return this.say(room, text + 'Invalid username.');
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
		this.say(room, text);
	},
	'8ball': function(arg, by, room) {
		if (this.canUse('8ball', room, by) || room.charAt(0) === ',') {
			var text = '';
		} else {
			var text = '/pm ' + by + ', ';
		}

		var rand = ~~(20 * Math.random()) + 1;

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
		this.say(room, text);
	},

	// Roleplaying commands
	sr: "setrp",
	rpset: "setrp",
	setrp: function(arg, by, room) {
		if (!(room in this.RP)) return false;
		if (typeof this.RP[room].host != 'undefined') {
			if (config.voiceList.indexOf(toId(by)) == -1 && !this.canUse('setrp', room, by) && !(toId(by) == toId(this.RP[room].host))) return false;
		} else {
			if (config.voiceList.indexOf(toId(by)) == -1 && !this.canUse('setrp', room, by)) return false;
		}
		if (!arg) return this.say(room, 'Please enter an RP.');

		if(!this.RP[room]) this.RP[room] = {};
		this.RP[room].plot = arg;
		this.writeSettings();
		console.log(new Date().toString() + " "+ room.cyan + ': '.cyan + 'The RP was set to ' + splitDoc(arg) + '.');
		if (this.RP[room].setAt) return this.say(room, 'The RP was set to ' + arg + '.');
		this.say(room, 'The RP was set to ' + arg + '. Use .start to start the RP.');
	},
	sd: 'setdoc',
	docset: 'setdoc',
	setdoc: function(arg, by, room) {
		if (!(room in this.RP) || !this.RP[room].plot) return false;
		if (typeof this.RP[room].host != 'undefined') {
			if (config.voiceList.indexOf(toId(by)) == -1 && !this.canUse('setrp', room, by) && !(toId(by) == toId(this.RP[room].host))) return false;
		} else {
			if (config.voiceList.indexOf(toId(by)) == -1 && !this.canUse('setrp', room, by)) return false;
		}
		if (!arg) return this.say(room, 'Please enter a doc.');
		this.splitMessage('>' + room + '\n|c|' + by + '|' + config.commandcharacter + 'setrp ' + splitDoc(this.RP[room].plot) + ' || Doc: ' + arg);
	},
	startrp: 'start',
	rpstart: 'start',
	start: function(arg, by, room) {
		if (!(room in this.RP)) return false;
		if (!!this.RP[room].host) {
			if (config.voiceList.indexOf(toId(by)) == -1 && !this.canUse('setrp', room, by) && !(toId(by) == toId(this.RP[room].host)) || this.RP[room].setAt) return false;
		} else {
			if (config.voiceList.indexOf(toId(by)) == -1 && !this.canUse('setrp', room, by) || this.RP[room].setAt) return false;
		}
		if (!this.RP[room].plot) {
			if (!arg) return this.say(room, 'Please set an RP before using .start, or specify an RP with .start to start one immediately.');
			this.RP[room].plot = arg;
		}
		
		if (toId(this.RP[room].plot) === 'freeroam'){
			if (this.freeroamTimeouts) {
				this.freeroamTimeouts[room] = setTimeout(function() {
					this.splitMessage('>' + room + '\n|c|' + by + '|' + config.commandcharacter + 'endrp');
					delete this.freeroamTimeouts[room];
				}.bind(this), 2 * 60 * 60 * 1000);
			}
		} else {
			if (this.staffAnnounceEndTimeouts) {
				this.staffAnnounceEndTimeouts[room] = setTimeout(function() {
					this.say(room, "/wall The RP has been in progress for **Three Hours**. Any Moderator or Driver may now end the RP. The RP will auto-end in **One Hour**");
					delete this.staffAnnounceEndTimeouts[room];
				}.bind(this), 3 * 60 * 60 * 1000);
			}
			if (this.autoTimeOut) {
				this.autoTimeOut[room] = setTimeout(function() {
					this.splitMessage('>' + room + '\n|c|' + by + '|' + config.commandcharacter + 'endrp');
					this.say(room, "/wall The RP has reached its time limit of 4 hours. Consider scheduling a time in Rusty to continue the RP with the same players.");
					this.splitMessage('>' + room + '\n|c|' + by + '|' + config.commandcharacter + 'rustyrp');
					delete this.autoTimeOut[room];
				}.bind(this), 4 * 60 * 60 * 1000);
			}
		}
		if (/conquest/i.test(toId(this.RP[room].plot))) {
			if (this.conquestTimeouts){
				var gracePeriodDurationMinutes = 15;
				if (/battleless/i.test(toId(this.RP[room].plot))){
					gracePeriodDurationMinutes = 30;
				}
				this.conquestTimeouts[room] = setTimeout(function() {
					this.say(room, '**Grace Period has ended.**');
					delete this.conquestTimeouts[room];
				}.bind(this), gracePeriodDurationMinutes * 60 * 1000);
			}
			
			if (this.conquestLockouts){
				this.conquestLockouts[room] = setTimeout(function() {
						this.say(room, '**Types are now locked.**');
						delete this.conquestLockouts[room];
				}.bind(this), 2 * 60 * 60 * 1000);
			}
		}
		
		if (this.RP[room].endpollCalled) {
			delete this.RP[room].endpollCalled;
		}
		
		if (this.RP[room].endpollProgress) {
			delete this.RP[room].endpollProgress;
		}
		
		if (/conquest/i.test(toId(this.RP[room].plot))) {
				this.splitMessage('>' + room + '\n|c|~luxlucario|' + config.commandcharacter + 'timer');
				this.say(room, '**A reminder that, if you do not RP properly, you are liable to be ignored by the person you are challenging.**');
				this.say(room, '**Please familiarise yourself with Conquest rules here:** https://docs.google.com/document/d/1CqLuTfbgxKYplQfZOX1ImEUSlIVY4PP7ix5BteUiQO0/edit');
		}
		
		if (/conquest/i.test(toId(this.RP[room].plot)) || /murdermystery/i.test(toId(this.RP[room].plot))) {
			this.say(room, "**Due to the nature of this RP, character death is common and expected. This is not an excuse to post graphic violence or gore in this chat. Please keep your violence PG.**");
		}
		
		if (config.serverid == 'showdown'){
			if (/conquest/i.test(toId(this.RP[room].plot)) || /goodvsevil/i.test(toId(this.RP[room].plot))){
				if (room === 'amphyrp' || room === 'rustyrp') {
					this.say(room, '/modchat ac');
				} else {
					this.say(room, '/modchat off');
				}
			}
			if (pollRoom == room) this.splitMessage('>' + room + '\n|c|' + by + '|' + config.commandcharacter + 'voidpoll');
			if (customPriorityFlag && room == 'amphyrp') {
				this.say(room, '/modnote ' + this.RP[room].host + ' has started the custom RP ' + splitDoc(this.RP[room].plot));
				customPriorityFlag = false;
			}
			var now = new Date();
			this.RP[room].setAt = now;
			this.writeSettings();
			if (this.hasRank(this.ranks[room] || ' ', '%@*#&~')) {
				this.say(room, '/wall The RP (' +  splitDoc(this.RP[room].plot) + ') has started.');
			} else {
				this.say(room, '**The RP (' +  splitDoc(this.RP[room].plot) + ') has started.**');
			}
		console.log(new Date().toString() + " "+ room.cyan + ': '.cyan + splitDoc(this.RP[room].plot) + " has started.");
		}
	},
	pause: 'rppause',
	pauserp: 'rppause',
	rppause: function(arg, by, room) {
		if (!(room in this.RP)) return false;
		if (typeof this.RP[room].host != 'undefined') {
			if (config.voiceList.indexOf(toId(by)) == -1 && !this.canUse('setrp', room, by) && !(toId(by) == toId(this.RP[room].host)) || !this.RP[room].setAt || this.RP[room].pause) return false;
		} else {
			if (config.voiceList.indexOf(toId(by)) == -1 && !this.canUse('setrp', room, by) || !this.RP[room].setAt || this.RP[room].pause) return false;
		}

		this.RP[room].pause = new Date();
		if (this.freeroamTimeouts[room] && (toId(this.RP[room].plot) === 'freeroam')) {
			clearTimeout(this.freeroamTimeouts[room]);
			delete this.freeroamTimeouts[room];
		}
		
		if (toId(this.RP[room].plot) === 'freeroam'){
			if (this.freeroamTimeouts[room]) {
				clearTimeout(this.freeroamTimeouts[room]);
				delete this.freeroamTimeouts[room];
			}
		} else {
			if (this.staffAnnounceEndTimeouts[room]) {
				clearTimeout(this.staffAnnounceEndTimeouts[room]);
				delete this.staffAnnounceEndTimeouts[room];
			}
			if (this.autoTimeOut[room]) {
				clearTimeout(this.autoTimeOut[room]);
				delete this.autoTimeOut[room];
			}
		}
		
		if (/conquest/i.test(toId(this.RP[room].plot))) {
			if (this.conquestTimeouts[room]){
				clearTimeout(this.conquestTimeouts[room]);
				delete this.conquestTimeouts[room];
			}
			if (this.conquestLockouts[room]){
				clearTimeout(this.conquestLockouts[room]);
				delete this.conquestLockouts[room];
			}
		}
		
		if (this.RP[room].endpollCalled) {
			delete this.RP[room].endpollCalled;
		}
		
		if (this.RP[room].endpollProgress) {
			delete this.RP[room].endpollProgress;
		}
		
		this.writeSettings();

		if (this.hasRank(this.ranks[room] || ' ', '%@*#&~')) {
			this.say(room, '/wall RP pause');
		} else {
			this.say(room, '**RP pause**');
		}
		console.log(new Date().toString() + " "+ room.cyan + ': '.cyan + splitDoc(this.RP[room].plot) + " has been paused by " + by + ".");
	},
	'continue': 'rpcontinue',
	'resume': 'rpcontinue',
	'rpresume': 'rpcontinue',
	continuerp: 'rpcontinue',
	rpcontinue: function(arg, by, room) {
		if (!(room in this.RP)) return false;
		if (typeof this.RP[room].host != 'undefined') {
			if (config.voiceList.indexOf(toId(by)) == -1 && !this.canUse('setrp', room, by) && !(toId(by) == toId(this.RP[room].host)) || !this.RP[room].setAt || !this.RP[room].pause) return false;
		} else {
			if (config.voiceList.indexOf(toId(by)) == -1 && !this.canUse('setrp', room, by) || !this.RP[room].setAt || !this.RP[room].pause) return false;
		}
		
		var paused = new Date(this.RP[room].pause); //Time it was paused at.
		var setAt = new Date(this.RP[room].setAt); //Time it was originally set at.
		var diff = new Date(); //Now
		diff.setTime(diff.getTime() - paused.getTime()); //Time elapsed since it was paused
		setAt.setTime(setAt.getTime() + diff.getTime()); //Time it was originally set at + paused time elapsed.
		this.RP[room].setAt = setAt;
		var timeLeft =  2 * 60 * 60 * 1000 - ((new Date()).getTime() - setAt.getTime());
		var conquestTimeLeft = 15 * 60 * 1000 - ((new Date()).getTime() - setAt.getTime());
		if (/battleless/i.test(toId(this.RP[room].plot))) {
			conquestTimeLeft += 15 * 60 * 1000;
		}
		var announceTimeLeft  = 3 * 60 * 60 * 1000 - ((new Date()).getTime() - setAt.getTime());
		var autoEndTimeLeft  = 4 * 60 * 60 * 1000 - ((new Date()).getTime() - setAt.getTime());
		
		if (!this.conquestTimeouts[room] && /conquest/i.test(toId(this.RP[room].plot))){
			if (conquestTimeLeft > 0) {
				this.conquestTimeouts[room] = setTimeout(function() {
					this.say(room, '**Grace Period has ended.**');
					delete this.conquestTimeouts[room];
				}.bind(this), conquestTimeLeft);
			}
			if (timeLeft > 0){
				this.conquestLockouts[room] = setTimeout(function() {
					this.say(room, '**Types are now locked.**');
					delete this.conquestLockouts[room];
				}.bind(this), timeLeft);
			}
		}

		if (toId(this.RP[room].plot) === 'freeroam') {
			if (!this.freeroamTimeouts[room]) {
				this.freeroamTimeouts[room] = setTimeout(function() {
					this.splitMessage('>' + room + '\n|c|' + by + '|' + config.commandcharacter + 'endrp');
					delete this.freeroamTimeouts[room];
				}.bind(this), timeLeft);
			}
		} else {
			if (this.staffAnnounceEndTimeouts && announceTimeLeft > 0) {
				this.staffAnnounceEndTimeouts[room] = setTimeout(function() {
					this.say(room, "/wall The RP has been in progress for **Three Hours**. Any Moderator or Driver may now end the RP. The RP will auto-end in **One Hour**");
					delete this.staffAnnounceEndTimeouts[room];
				}.bind(this), announceTimeLeft);
			}
			if (this.autoTimeOut && autoEndTimeLeft > 0) {
				this.autoTimeOut[room] = setTimeout(function() {
					this.splitMessage('>' + room + '\n|c|' + by + '|' + config.commandcharacter + 'endrp');
					this.say(room, "/wall The RP has reached its time limit of 4 hours. Consider scheduling a time in Rusty to continue the RP with the same players.");
					this.splitMessage('>' + room + '\n|c|' + by + '|' + config.commandcharacter + 'rustyrp');
					delete this.autoTimeOut[room];
				}.bind(this), autoEndTimeLeft);
			}
		}

		delete this.RP[room].pause;
		this.writeSettings();
		if (this.hasRank(this.ranks[room] || ' ', '%@*#&~')) {
			this.say(room, '/wall RP continue');
		} else {
			this.say(room, '**RP continue**');
		}
		console.log(new Date().toString() + " "+ room.cyan + ': '.cyan + splitDoc(this.RP[room].plot) + " has been resumed by " + by + ".");
	},
	sh: 'sethost',
	sethost: function(arg, by, room) {
		if (!(room in this.RP)) return false;
		if (typeof this.RP[room].host != 'undefined') {
			if (config.voiceList.indexOf(toId(by)) == -1 && !this.canUse('setrp', room, by) && !(toId(by) == toId(this.RP[room].host)) || !this.RP[room].plot) return false;
		} else {
			if (config.voiceList.indexOf(toId(by)) == -1 && !this.canUse('setrp', room, by) || !this.RP[room].plot) return false;
		}
		if (!arg) return this.say(room, 'Please enter a host.');

		if (config.serverid == 'showdown'){
			if (this.RP[room].host){
				if ((config.staffList.indexOf(toId(this.RP[room].host)) == -1) && ((config.voiceList.indexOf(toId(this.RP[room].host)) == -1) || room !== 'roleplaying')) {
					this.say(room, '/roomdevoice '+ this.RP[room].host);
				}
			}
			if (!(this.RP[room].setAt)) {
				if ((/conquest/i.test(toId(this.RP[room].plot)) || /goodvsevil/i.test(toId(this.RP[room].plot))) && !this.RP[room].host){
					this.say(room, '/modchat +');
					this.say(room, '/wall A reminder for newcomers that Modchat + is only up temporarily. After the RP is set up modchat will come down and everyone can talk again.');
				}
			}
		}

		this.RP[room].host = arg;
		this.writeSettings();
		if (config.staffList.indexOf(toId(this.RP[room].host)) == -1) {
			this.say(room, '/roomvoice '+ arg);
		}
		this.say(room, 'The host was set to ' + arg + '.');
		console.log(new Date().toString() + " "+ room.cyan + ': '.cyan + "The host was set to " + arg + ".");
		this.RP[room].setUpAt = new Date;
	},
	sch: 'setcohost',
	setcohost: function(arg, by, room) {
		if (!(room in this.RP)) return false;
		if (typeof this.RP[room].host != 'undefined') {
			if (config.voiceList.indexOf(toId(by)) == -1 && !this.canUse('setrp', room, by) && !(toId(by) == toId(this.RP[room].host)) || !this.RP[room].plot) return false;
		} else {
			if (config.voiceList.indexOf(toId(by)) == -1 && !this.canUse('setrp', room, by) || !this.RP[room].plot) return false;
		}
		if (!arg) return this.say(room, 'Please enter a cohost.');
				
		this.RP[room].cohost = arg;
		this.writeSettings();
		this.say(room, 'The cohost(s) was/were set to ' + arg + '.');
		console.log(new Date().toString() + " "+ room.cyan + ': '.cyan + "The cohost(s) was/were set to " + arg + ".");
	},
	rh: 'rmhost',
	rmhost: function(arg, by, room) {
		if (!(room in this.RP)) return false;
		if (typeof this.RP[room].host != 'undefined') {
			if (config.voiceList.indexOf(toId(by)) == -1 && !this.canUse('setrp', room, by) && !(toId(by) == toId(this.RP[room].host)) || !this.RP[room].plot) return false;
		} else {
			if (config.voiceList.indexOf(toId(by)) == -1 && !this.canUse('setrp', room, by) || !this.RP[room].plot) return false;
		}
		if (!this.RP[room].host) return this.say(room, 'There is no host to remove.');
		if (config.serverid == 'showdown'){
			if ((config.staffList.indexOf(toId(this.RP[room].host)) == -1) && ((config.voiceList.indexOf(toId(this.RP[room].host)) == -1) || room !== 'roleplaying')) {
				this.say(room, '/roomdevoice '+ this.RP[room].host);
			}
			if (!(this.RP[room].setAt)){
				if (/conquest/i.test(toId(this.RP[room].plot)) || /goodvsevil/i.test(toId(this.RP[room].plot))){
					this.say(room, '/modchat off');
				}
			}
		}

		delete this.RP[room].host;
		this.writeSettings();
		this.say(room, 'The host has been removed.');
		console.log(new Date().toString() + " "+ room.cyan + ': '.cyan + "The host has been removed.");
	},
	rch: 'rmcohost',
	rmcohost: function(arg, by, room) {
		if (!(room in this.RP)) return false;
		if (typeof this.RP[room].host != 'undefined') {
			if (config.voiceList.indexOf(toId(by)) == -1 && !this.canUse('setrp', room, by) && !(toId(by) == toId(this.RP[room].host)) || !this.RP[room].plot) return false;
		} else {
			if (config.voiceList.indexOf(toId(by)) == -1 && !this.canUse('setrp', room, by) || !this.RP[room].plot) return false;
		}
		if (!this.RP[room].cohost) return this.say(room, 'There are no cohosts to remove.');

		delete this.RP[room].cohost;
		this.writeSettings();
		this.say(room, 'The cohost(s) has/have been removed.');
		console.log(new Date().toString() + " "+ room.cyan + ': '.cyan + "The cohost(s) has/have been removed.");
	},
	rpend: 'endrp',
	endrp: function(arg, by, room) {
		if (!(room in this.RP)) return false;
		if (typeof this.RP[room].host != 'undefined') {
			if (config.voiceList.indexOf(toId(by)) == -1 && !this.canUse('setrp', room, by) && !(toId(by) == toId(this.RP[room].host)) || !this.RP[room].plot) return false;
		} else {
			if (config.voiceList.indexOf(toId(by)) == -1 && !this.canUse('setrp', room, by) || !this.RP[room].plot) return false;
		}
		if (this.RP[room].setAt) {
			var setAt = new Date(this.RP[room].setAt);
			var timeThreshold =  10 * 60 * 1000 - ((new Date()).getTime() - setAt.getTime());

				if (timeThreshold < 0) {
					nextVoid = splitDoc(this.RP[room].plot);
					if (room == 'roleplaying') {
						if (this.RP.void[room].length === 3) this.RP.void[room].shift();
					} else {
						if (this.RP.void[room].length === 2) this.RP.void[room].shift();
					}
					this.RP.void[room].push(nextVoid);
				}

			if (toId(this.RP[room].plot) === 'freeroam') {
				clearTimeout(this.freeroamTimeouts[room]);
				delete this.freeroamTimeouts[room];
			} else {
				clearTimeout(this.staffAnnounceEndTimeouts[room]);
				delete this.staffAnnounceEndTimeouts[room];
				clearTimeout(this.autoTimeOut[room]);
				delete this.autoTimeOut[room];
			}

			if (/conquest/i.test(toId(this.RP[room].plot))){
				clearTimeout(this.conquestTimeouts[room]);
				delete this.conquestTimeouts[room];
				clearTimeout(this.conquestLockouts[room]);
				delete this.conquestLockouts[room];
			}
		}

		if (this.RP[room].setAt) {
			console.log(new Date().toString() + " "+ room.cyan + ': '.cyan + splitDoc(this.RP[room].plot) + " has ended after "+ progressTime(this.RP[room]) + ".");
		} else {
			console.log(new Date().toString() + " "+ room.cyan + ': '.cyan + splitDoc(this.RP[room].plot) + " has ended.");
		}
		if (this.RP[room].host){
			if ((config.staffList.indexOf(toId(this.RP[room].host)) == -1) && ((config.voiceList.indexOf(toId(this.RP[room].host)) == -1) || room !== 'roleplaying')) {
				this.say(room, '/roomdevoice '+ this.RP[room].host);
			}
			if (!(this.RP[room].setAt)){
				if (/conquest/i.test(toId(this.RP[room].plot)) || /goodvsevil/i.test(toId(this.RP[room].plot))){
					this.say(room, '/modchat off');
				}
			}
		}

		if (customPriorityFlag && room == 'amphyrp' && !this.RP[room].setAt) {
			this.say(room, '/modnote ' + this.RP[room].host + ' failed to run the CPed custom RP ' + splitDoc(this.RP[room].plot) + '.');
			customPriorityFlag = false;
		}
		if (this.RP[room].setAt) {
			if (this.hasRank(this.ranks[room] || ' ', '%@*#&~')) {
				this.say(room, '/wall The RP has ended after ' + progressTime(this.RP[room]) + '.');
			} else {
				this.say(room, '**The RP has ended after ' + progressTime(this.RP[room]) + '.**');
			}
		} else {
			if (this.hasRank(this.ranks[room] || ' ', '%@*#&~')) {
				this.say(room, '/wall The RP has ended.');
			} else {
				this.say(room, '**The RP has ended.**');
			}
		}
		
		for (var i in this.RP[room]) {
			delete this.RP[room][i];
		}
		this.writeSettings();
		this.splitMessage('>' + room + '\n|c|~luxlucario|' + config.commandcharacter + 'void');
		if (this.RP[room].endpollProgress)
			this.splitMessage('>' + room + '\n|c|~' + by + '|' + config.commandcharacter + voidendpoll);
		this.splitMessage('>' + room + '\n|c|~luxlucario|' + config.commandcharacter + 'rppoll');
		this.splitMessage('>' + room + '\n|c|~luxlucario|' + config.commandcharacter + 'motd');
	},
	vr: 'voidreset',
	voidreset: function(arg, by, room) {
		if (room == "roleplaying") {
			this.splitMessage('>' + room + '\n|c|' + by + '|' + config.commandcharacter + 'setvoid Void, Reset, Thing');
		} else {
			this.splitMessage('>' + room + '\n|c|' + by + '|' + config.commandcharacter + 'setvoid Void, Reset');
		}
	},
	sv: 'setvoid',
	setvoid: function(arg, by, room) {
		if (!(room in this.RP) || this.RP[room].plot || !arg || !this.hasRank(by, '%@*#&~')) return false;
		var spl = arg.split(', ');
		console.log(spl);
		if (room == 'roleplaying') {
			if (spl.length !== 3) return this.say(room, 'Void only accepts 3 arguments for main.');
			this.RP.void[room] = [spl[0],spl[1],spl[2]];
		} else {
			if(spl.length !== 2) return this.say(room, 'Void only accepts 2 arguments.');
			this.RP.void[room] = [spl[0],spl[1]];
		}
		this.writeSettings();
		this.splitMessage('>' + room + '\n|c|' + by + '|' + config.commandcharacter + 'void');
	},
	void: function(arg, by, room) {
		if (room in this.RP) {
			arg = room;
		} else {
			arg = toId(arg);
		switch (arg) {
			case 'rp':
			case 'main':
				arg = 'roleplaying';
				break;
			case 'arp':
			case 'amphy':
				arg = 'amphyrp';
				break;
			case 'rrp':
			case 'rusty':
				arg = 'rustyrp';
				break;
			default:
				break;
		}
			
			if (!(arg in this.RP)) {
				return this.say(room, "Please specify a room to check the void of.");
			}
		}
		var text = '';
		var voided = this.RP.void[arg];


		if (this.RP[arg].plot) {
			switch (voided.length) {
				case 3:
					text +=  voided[1] + ', ' + voided[2] + ' and ' + splitDoc(this.RP[arg].plot) + ' will be void after this RP';
					break;
				case 2:
					text += voided[1] + ' and ' + splitDoc(this.RP[arg].plot) + ' will be void after this RP';
					break;
				case 1:
					text += voided[0] + ' and ' + splitDoc(this.RP[arg].plot) + ' will be void after this RP';
					break;
				case 0:
					text += splitDoc(this.RP[arg].plot) + ' will be void after this RP. The second-last RP in this room is unknown';
					break;
				default:
					return this.say(room, 'Something went wrong with how void RPs are stored');
			}
		} else {
			switch (voided.length) {
				case 3:
					text += voided[0] + ', ' + voided[1] + ' and ' + voided[2] + ' are void';
					break;
				case 2:
					text += voided[0] + ' and ' + voided[1] + ' are void';
					break;
				case 1:
					text += voided[0] + ' is void. The second-last RP in this room is unknown';
					break;
				case 0:
					text += 'The last 2 RPs in this room are unknown.';
					break;
				default:
					return this.say(room, 'Something went wrong with how void RPs are stored');
			}
		}
		
		if (arg === 'rustyrp' && config.serverid === 'showdown'){
			if (this.RP['roleplaying'].plot) {
				text += ". The RP in Roleplaying is " + splitDoc(this.RP['roleplaying'].plot) + ".";
			}
			if (this.RP['amphyrp'].plot) {
				if (this.RP['roleplaying'].plot) {
					text += ' ';
				} else {
					text += '. ';
				}
				text += "The RP in AmphyRP is " + splitDoc(this.RP['amphyrp'].plot) + ".";
			}
			if (!this.RP['roleplaying'].plot && !this.RP['amphyrp'].plot) {
				text += ". No RPs are void.";
			}
		} else {
			if (config.serverid === 'showdown') {
				var concurrent = (arg === 'roleplaying') ? splitDoc(this.RP['amphyrp'].plot) : splitDoc(this.RP['roleplaying'].plot);
				var currentRust = (this.RP['rustyrp']) ? splitDoc(this.RP['rustyrp'].plot) : '';
				if (concurrent) text += '. The RP in ' + ((arg === 'roleplaying') ? 'AmphyRP' : 'Roleplaying') + ' is ' + concurrent;
				if (currentRust) text+= ', and the RP in RustyRP is ' + currentRust;
				if(text.charAt(text.length - 1) !== '.') text += '.';
			}
		}
		
		if (room in this.RP) {
			if (config.voiceList.indexOf(toId(by)) == -1 && !this.canUse('setrp', room, by) || this.RP[room].setAt) {
				if (this.RP[arg].voidCalled) {
					this.say(room, '/pm ' + by + ', ' + text + " (" + room + ")");	
				}
				return this.say(room, '/pm ' + by + ', Please use ".void [room]" in PMs if you wish to check .void during an RP.');
			} else {
				this.say(room, '**' + text + '**');
				this.RP[room].voidCalled = true;
				setTimeout(function() {
					delete this.RP[room].voidCalled;
				}.bind(this), 60 * 1000);
			}
		} else {
			this.say(room, text);
		}
	},
	roleplay: 'rp',
	arpee: 'rp',
	rp: function(arg, by, room) {
		if (room.charAt(0) === ','){
			var text = '';
			var roomArray = (config.serverid === 'showdown') ? ['Roleplaying','AmphyRP','RustyRP'] : config.rprooms;
			for (i = 0; i < roomArray.length; i ++) {
				if (this.RP[toId(roomArray[i])].plot) {
					text += " The RP in " + roomArray[i] + " is " + splitDoc(this.RP[toId(roomArray[i])].plot);
					if (this.RP[toId(roomArray[i])].setAt) {
						text += ', in progress for ' + progressTime(this.RP[toId(roomArray[i])]) + '.';
					} else {
						text += '.';
					}
				}
			}
			for (i = 0; i < roomArray.length; i ++) {
				if (this.RP[toId(roomArray[i])].plot) {
					if (toId(this.RP[toId(roomArray[i])].plot) == 'freeroam') {
						this.say(room, text);
						return this.say(room, 'Check out the RP Map: http://psroleplaying.forumotion.com/t1555-the-new-real-world-map');
					}
				}
			}
			if (text == '') text += 'There are no RPs in progress.';
			return this.say(room, text);
		}
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

		if (this.RP[room].pause) return this.say(room, text + 'The RP is ' + this.RP[room].plot + ', but it is paused. Paused at: ' + progressTime(this.RP[room]));
		this.say(room, text + 'The RP is ' + this.RP[room].plot + ', in progress for ' + progressTime(this.RP[room]) + '.');
		if (toId(this.RP[room].plot) === 'freeroam') this.splitMessage('>' + room + '\n|c|~' + by + '|' + config.commandcharacter + 'mapassist');
	},
	host: function(arg, by, room) {
		if (room.charAt(0) === ','){
			var text = '';
			var roomArray = (config.serverid === 'showdown') ? ['Roleplaying','AmphyRP','RustyRP'] : config.rprooms;
			for (i = 0; i < roomArray.length; i ++) {
				if (this.RP[toId(roomArray[i])].plot && this.RP[toId(roomArray[i])].host) {
					text += " " + this.RP[toId(roomArray[i])].host + " is hosting in " + roomArray[i];
					if (this.RP[toId(roomArray[i])].cohost) {
						text += ', with ' + this.RP[toId(roomArray[i])].cohost + ' as cohost(s).';
					} else {
						text += '.';
					}
				}
			}
			return this.say(room, text);
		}
		if (!(room in this.RP)) return false;
		if (!this.RP[room].host) return false;
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
		if (this.RP[room].host && this.RP[room].cohost) return this.say(room, text + 'The host is ' + this.RP[room].host + ', with ' + this.RP[room].cohost + ' as cohost(s).');
		this.say(room, text + 'The host is ' + this.RP[room].host + '.');
	},
    rppoll: function(arg, by, room) {
        if (config.voiceList.indexOf(toId(by)) == -1 && !this.canUse('setrp', room, by) || this.RP[room].plot || !(room in this.RP)) return false; //setrp perms? is this RP room?
		if (pollON) { //if there's a poll already
			return this.say(room, 'A RP poll cannot be started, as one is in progress already in ' + pollRoom);
		}
		pollRoom = room;
		//No poll on
		pollON = true; //There's a poll on now.
		var now = new Date(); //Good to know what time it is now
		console.log(new Date().toString() + " "+ room.cyan + ': '.cyan + "RP poll has been has been created by " + by + ".");
		this.say(room, '/wall **PM Roleplaying Bot** with .nom [RP] to nominate the RP you want to be next. **Remember to only PM RPs you can host** and PM staff your customs. Ends at xx:' + ((((now.getMinutes()+3)%60) < 10) ? '0' + (((now.getMinutes()+3)%60).toString()) : ((now.getMinutes()+3)%60).toString()) + ':' + (((now.getSeconds() < 10)) ? '0' + now.getSeconds().toString() : now.getSeconds().toString()));
		pollTimer[room] = setTimeout(function() {
		    console.log(new Date().toString() + " Suggestion period has ended.");
		    if(pollNoms.length == 1) {
		    	if (RPOpts.indexOf(toId(pollNoms[0])) > -1){
		    		this.splitMessage('>' + room + '\n|c|~luxlucario|' + config.commandcharacter + 'setrp ' + rpcaps[RPOpts.indexOf(toId(pollNoms[0]))]);
		    	} else {
		    		this.splitMessage('>' + room + '\n|c|~luxlucario|' + config.commandcharacter + 'setrp ' + pollNoms[0]);
		    	}
		       	this.splitMessage('>' + room + '\n|c|~luxlucario|' + config.commandcharacter + 'defaultDoc ' + pollNoms[0]);
				if (toId(pollNoms[0]) !== 'conquest') this.splitMessage('>' + room + '\n|c|~luxlucario|' + config.commandcharacter + 'nominators ' + pollNoms[0]);
		    	pollON = false;
		    	if (toId(pollNoms[0]) == 'freeroam') this.splitMessage('>' + room + '\n|c|~luxlucario|' + config.commandcharacter + 'start');
		    	if (toId(pollNoms[0]) == 'conquest') {
					this.RP[room].rppollProgress = true;
					setTimeout(function(){
						now = new Date();
						Parse.say(room, '/wall **A Variant Poll will be automatically started at xx:' + ((((now.getMinutes()+1)%60) < 10) ? '0' + (((now.getMinutes()+1)%60).toString()) : ((now.getMinutes()+1)%60).toString()) + ':' + (((now.getSeconds() < 10)) ? '0' + now.getSeconds().toString() : now.getSeconds().toString()) + '. If you have a variant to host please bold your document once in chat.**');
					}, 1000);
					setTimeout(function(){
						now = new Date();
						Parse.say(room, '/poll create Conquest Variant RP Poll. Ends at xx:' + ((((now.getMinutes()+3)%60) < 10) ? '0' + (((now.getMinutes()+3)%60).toString()) : ((now.getMinutes()+3)%60).toString()) + ':' + (((now.getSeconds() < 10)) ? '0' + now.getSeconds().toString() : now.getSeconds().toString()) + ', Regular Conquest, Battleless Conquest, Variant Conquest');
						Parse.say(room, '/poll timer 3');
					}, 60 * 1000 + 1000);
					setTimeout(function(){
						Parse.say(room, '!poll display');
					}, 2 * 60 * 1000 + 1000);
					setTimeout(function(){
						Parse.say(room, '!poll display');
					}, 3 * 60 * 1000 + 1000);
					setTimeout(function() {
						delete this.RP[room].rppollProgress;
					}.bind(this), 4 * 60 * 1000);
				pollNoms = [];
		    	pollroom = ''
		    	return false;
		    }
		    if(pollNoms.length > 1) { //If there are enough options to make a poll?
		    	pollON = true; //There's still a poll in progress marker from earlier on? I'm not sure why you're restating this.
		    	for(var y = 0; y < pollNoms.length; y++) { // y is which poll option you are at.
		    		if(RPOpts.indexOf(toId(pollNoms[y])) > -1) { //If it's in the offical RP list
		    			pollNoms[y] = rpcaps[RPOpts.indexOf(toId(pollNoms[y]))]; //Translate it to the properly capitalised version.
		    		}
		    		pollNoms[y].capitalize(true);
		    	}
		    	var now = new Date();
		        if(pollNoms.length > 8) {
		            pollNoms = pollNoms.slice(0, 8);
                    this.say(room, '/poll create Next RP? Ends at xx:' + ((((now.getMinutes()+3)%60) < 10) ? '0' + (((now.getMinutes()+3)%60).toString()) : ((now.getMinutes()+3)%60).toString()) + ':' + (((now.getSeconds() < 10)) ? '0' + now.getSeconds().toString() : now.getSeconds().toString()) + ", " + pollNoms.join(', '));
		            this.say(room, '/poll timer 3');
		        } else {
		            this.say(room, '/poll create Next RP? Ends at xx:' + ((((now.getMinutes()+3)%60) < 10) ? '0' + (((now.getMinutes()+3)%60).toString()) : ((now.getMinutes()+3)%60).toString()) + ':' + (((now.getSeconds() < 10)) ? '0' + now.getSeconds().toString() : now.getSeconds().toString()) + ', ' + pollNoms.join(', '));
		            this.say(room, '/poll timer 3');
		        }
		        this.RP[room].rppollProgress = true;
			    setTimeout(function() {
			    	this.say(room, '!poll display');
			    }.bind(this), 60 * 1000);
		    	setTimeout(function() {
			    	this.say(room, '!poll display');
		    	}.bind(this), 2 * 60 * 1000);
		    	setTimeout(function() {
		    		pollON = false;
	 				pollNoms = [];  // Maybe?  I dunno.  Clear poll noms after a poll has failed.
	 				delete this.RP[room].rppollProgress;
		    	}.bind(this), 3 * 60 * 1000);
		    } else {
		        this.say(room, '/wall There were not enough nominations.');
		        console.log(new Date().toString() + " "+ room.cyan + ': '.cyan + "The RP poll failed due to lack of suggestions.");
		        pollON = false;
		       	pollNoms = [];  // Maybe?  I dunno.  Clear poll noms after a poll has failed.
		       	pollroom = '';
		       	this.splitMessage('>' + room + '\n|c|~luxlucario|' + config.commandcharacter + 'motd');
		    }
		}.bind(this), 3 * 60 * 1000);
    },
    nom: "nominate",
    nominate: function(arg, by, room) {
    	if(room.charAt(0) !== ',') return false; //Making it PM only to prevent changes.  Making these edits at 2 AM, feel free to like...  fix them if I screwed up.
        if (!pollON) {
            return this.say(room, 'There is no RP poll in progress.');
        } //  Why not an if else?
        switch (toId(arg)) {
        	case 'fr':
        		arg = 'Freeroam';
        		break;
        	case 'cq':
        		arg = "Conquest";
        		break;
        	case 'mm':
        		arg = 'Murder Mystery';
        		break;
        	case 'gve':
        		arg = 'Good vs Evil';
        		break;
        	case 'uni': case 'pokeUni':
        		arg = 'PokeHigh';
        		break;
        	case 'ph':
        		arg = 'PokeHigh';
        		break;
        	case 'dungeonsanddragonites':
        	case 'dungeonsanddragons':
        	case 'dungeonsanddruddigons':
        	case 'dnd':
        	case 'dungeonsndragons':
        	case 'dungeonsndruddigons':
        		arg = 'Dungeons \'n Dragonites';
        		break;
        	case 'pmd':
        	case 'pokmonmysterydungeon':
        		arg = 'Pokemon Mystery Dungeon';
        		break;
        	case 'hg':
        		arg = 'Hunger Games';
        		break;
        	case 'za':
        		arg = 'zombie apocalypse';
        		break;
        	default:
        		break;
        }
        for (i = 0; i < config.rprooms.length; i++) {
			if (this.RP[config.rprooms[i]].plot) {
				if(toId(arg) == toId(splitDoc(this.RP[config.rprooms[i]].plot))) {
					return this.say(room, 'That RP is currently ongoing in ' + config.rprooms[i])
				}
			}
		}
    	if (pollRoom == 'amphyrp' && toId(arg) == 'freeroam'){
    	    return this.say(room, "Freeroam and its variants cannot be run in AmphyRP.");
    	}
        if(RPOpts.indexOf(toId(arg)) == -1 && !((this.hasRank(by, '+%@#&~')) || (config.voiceList.indexOf(toId(by)) > -1) || (config.staffList.indexOf(toId(by)) > -1))) {
            return this.say(room, 'Check your spelling, or if it\'s a custom, please suggest them to a voice or above.');
        }
       	if(toId(arg) == 'pokemonmysterydungeon') {
       		if(toId(this.RP.void[pollRoom].toString()).indexOf('pokmonmysterydungeon') > -1) return this.say(room, 'That RP is void.');
        	
		    for (i = 0; i < config.rprooms.length; i++) {
				if (this.RP[config.rprooms[i]].plot) {
					if(toId((this.RP[config.rprooms[i]].plot).toString()).indexOf('pokmonmysterydungeon') > -1) {
						if(toId(arg) == toId(splitDoc(this.RP[config.rprooms[i]].plot))) {
							return this.say(room, 'That RP is currently ongoing in ' + config.rprooms[i])
						}
					}
				}
			}
        }
       	if(toId(arg) == 'conquest') {
       		if(toId(this.RP.void[pollRoom].toString()).indexOf('conquest') > -1) return this.say(room, 'That RP is void.');

		    for (i = 0; i < config.rprooms.length; i++) {
				if (this.RP[config.rprooms[i]].plot) {
					if(toId((this.RP[config.rprooms[i]].plot).toString()).indexOf('conquest') > -1) {
						if('regularconquest' == toId(splitDoc(this.RP[config.rprooms[i]].plot)) || 'variantconquest' == toId(splitDoc(this.RP[config.rprooms[i]].plot)) || 'battlelessconquest' == toId(splitDoc(this.RP[config.rprooms[i]].plot)) || toId(arg) == toId(splitDoc(this.RP[config.rprooms[i]].plot))) {
							return this.say(room, 'That RP is currently ongoing in ' + config.rprooms[i])
						}
					}
				}
			}
        }
        if(toId(arg) == 'pokehigh') {
       		if(toId(this.RP.void[pollRoom].toString()).indexOf('pokhigh') > -1) return this.say(room, 'That RP is void.');
        	
		    for (i = 0; i < config.rprooms.length; i++) {
				if (this.RP[config.rprooms[i]].plot) {
					if(toId((this.RP[config.rprooms[i]].plot).toString()).indexOf('pokhigh') > -1) {
						if(toId(arg) == toId(splitDoc(this.RP[config.rprooms[i]].plot))) {
							return this.say(room, 'That RP is currently ongoing in ' + config.rprooms[i]);
						}
					}
				}
			}
        }
    	if(toId(arg) == 'dungeonsndragonites' || toId(arg) == 'dungeonsndragons' || toId(arg) == 'dungeonsndruddigons') {
        	if((toId(this.RP.void[pollRoom].toString()).indexOf('dungeonsnd') > -1 || (toId(this.RP.void[pollRoom].toString()).indexOf('dungeonsd') > -1) || toId(this.RP.void[pollRoom].toString()).indexOf('dungeonsandd') > -1) && room != 'rustyrp') return this.say(room, 'That RP is void.');
        	
		    for (i = 0; i < config.rprooms.length; i++) {
				if (this.RP[config.rprooms[i]].plot) {
					if(toId((this.RP[config.rprooms[i]].plot).toString()).indexOf('dungeonsnd') > -1 || toId((this.RP[config.rprooms[i]].plot).toString()).indexOf('dungeonsd') > -1 || toId((this.RP[config.rprooms[i]].plot).toString()).indexOf('dungeonsandd') > -1) {
						if(toId(arg) == toId(splitDoc(this.RP[config.rprooms[i]].plot))) {
							return this.say(room, 'That RP is currently ongoing in ' + config.rprooms[i]);
						}
					}
				}
			}
        }
        if (toId(this.RP.void[pollRoom].toString()).indexOf(toId(arg)) > -1) {
        	return this.say(room, 'That RP is void.');
        }
        switch (toId(arg)) {
		    case 'goodvsevil':
		    	if (goodvsevilNom.indexOf(by) == -1) goodvsevilNom.push(by);
		        break;
		    case 'conquest':
		    	if (conquestNom.indexOf(by) == -1) conquestNom.push(by);
		        break;
		    case 'trainer':
		    	if (trainerNom.indexOf(by) == -1) trainerNom.push(by);
		        break;
		    case 'pokehigh':
		    	if (pokehighNom.indexOf(by) == -1) pokehighNom.push(by);
		        break;
		    case 'cruise':
		    	if (cruiseNom.indexOf(by) == -1) cruiseNom.push(by);
		        break;
		    case 'murdermystery':
		    	if (murdermysteryNom.indexOf(by) == -1) murdermysteryNom.push(by);
		        break;
		    case 'pokemonmysterydungeon':
		    	if (pokemonmysterydungeonNom.indexOf(by) == -1) pokemonmysterydungeonNom.push(by);
		        break;
		    case 'dungeonsndragonites':
		    	if (dungeonsndragonitesNom.indexOf(by) == -1) dungeonsndragonitesNom.push(by);
		        break;
		    case 'kingdom':
		    	if (kingdomNom.indexOf(by) == -1) kingdomNom.push(by);
		        break;
		    default:
		    break;
		}
        if (toId(pollNoms.toString()).indexOf(toId(arg)) > -1) {
        	return this.say(room, 'That RP has already been suggested.');
        } else {
    	    pollNoms.push(arg);
    	    if (RPOpts.indexOf(toId(arg)) == -1) this.say(pollRoom, 'Custom: ' + arg + ' has been added to the poll.');
    	    this.say(room, 'Thank you for your suggestion! Please note that not all RPs may be added to poll.');
        }
    },
    nominators: function (arg, by, room) {
		if (config.serverid !== 'showdown' || !this.hasRank(by, '~') || !(room in this.RP)) return false;
		if (/conquest/i.test(toId(arg))) arg = "conquest";
		if (RPOpts.indexOf(toId(arg)) > -1) {
			switch (toId(arg)) {
				case 'goodvsevil':
				    this.say(room, 'Nominators for ' + arg + ' were ' + goodvsevilNom.join(', '));
				    break;
				case 'conquest':
				    this.say(room, 'Nominators for ' + arg + ' were ' + conquestNom.join(', '));
				    break;
				case 'trainer':
				    this.say(room, 'Nominators for ' + arg + ' were ' + trainerNom.join(', '));
				    break;
				case 'pokehigh':
				    this.say(room, 'Nominators for ' + arg + ' were ' + pokehighNom.join(', '));
				    break;
				case 'cruise':
				    this.say(room, 'Nominators for ' + arg + ' were ' + cruiseNom.join(', '));
				    break;
				case 'murdermystery':
				    this.say(room, 'Nominators for ' + arg + ' were ' + murdermysteryNom.join(', '));
				    break;
				case 'pokemonmysterydungeon':
				    this.say(room, 'Nominators for ' + arg + ' were ' + pokemonmysterydungeonNom.join(', '));
				    break;
				case 'dungeonsndragonites':
				    this.say(room, 'Nominators for ' + arg + ' were ' + dungeonsndragonitesNom.join(', '));
				    break;
				case 'kingdom':
				    this.say(room, 'Nominators for ' + arg + ' were ' + kingdomNom.join(', '));
				    break;
				default:
				break;
				}
		}
		goodvsevilNom = [];
		conquestNom = [];
		trainerNom = [];
		pokehighNom = [];
		cruiseNom = [];
		murdermysteryNom = [];
		pokemonmysterydungeonNom = [];
		dungeonsndragonitesNom = [];
		kingdomNom = [];
	},
	ep: "endpoll",
	endpoll: function(arg, by, room) {
		if (!this.canUse('endpoll', room, by) || !(room in this.RP) || !this.RP[room].setAt) return false;
//		if (!arg) return this.say(room, 'Please specify the requester of the poll.');
		if (!this.RP[room].endpollCalled) {
			var now = new Date();
			if (arg && toId(arg) !== 'requested' && toId(arg).length < 19) {
				this.say(room, '/poll create End Poll: ends at xx:' + ((((now.getMinutes()+3)%60) < 10) ? '0' + (((now.getMinutes()+3)%60).toString()) : ((now.getMinutes()+3)%60).toString()) + ':' + (((now.getSeconds() < 10)) ? '0' + now.getSeconds().toString() : now.getSeconds().toString()) + ". Requested by " + arg + " , Continue, End");
				console.log(new Date().toString() + " "+ room.cyan + ': '.cyan + "End poll has been has been created by " + by + " upon request by " + arg + ".");
				this.say(room, '/modnote ' + by + ' created an end poll upon request by ' + arg + "");
			} else {
				this.say(room, '/poll create End Poll: ends at xx:' + ((((now.getMinutes()+3)%60) < 10) ? '0' + (((now.getMinutes()+3)%60).toString()) : ((now.getMinutes()+3)%60).toString()) + ':' + (((now.getSeconds() < 10)) ? '0' + now.getSeconds().toString() : now.getSeconds().toString()) + ", Continue, End");
				console.log(new Date().toString() + " "+ room.cyan + ': '.cyan + "End poll has been has been created by " + by + ".");
				this.say(room, '/modnote ' + by + ' created an end poll.');
			}
				this.say(room, '/poll timer 3');
				this.RP[room].endpollCalled = true;
				this.RP[room].endpollProgress = true;
				setTimeout(function() {
					this.say(room, '!poll display');
				}.bind(this), 60 * 1000);
				setTimeout(function() {
					this.say(room, '!poll display');
				}.bind(this), 2 * 60 * 1000);
				this.endpollTimerSet[room] = setTimeout(function() {
					delete this.RP[room].endpollProgress;
					this.RP[room].lastEndPoll = new Date();
					delete this.endpollTimerSet[room];
				}.bind(this), 3 * 60 * 1000);
				setTimeout(function() {
					delete this.RP[room].endpollCalled;
					delete this.RP[room].endpollProgress;
				}.bind(this), 18 * 60 * 1000);
		} else {
			this.splitMessage('>' + room + '\n|c|' + by + '|' + config.commandcharacter + 'lastendpoll');
		}
	},
	lep: 'lastendpoll',
	lastendpoll: function(arg, by, room) {
		if (room.charAt(0) === ','){
			var text = '';
			var roomArray = (config.serverid === 'showdown') ? ['Roleplaying','AmphyRP','RustyRP'] : config.rprooms;
			for (i = 0; i < roomArray.length; i ++) {
				if (this.RP[toId(roomArray[i])].setAt) { // If an RP is set
					if (this.RP[toId(roomArray[i])].lastEndPoll) { // Check if an endpoll has been done
						var start = new Date(this.RP[toId(roomArray[i])].lastEndPoll);
						var now = new Date();
						var diff = (now.getTime() - start.getTime()) / 1000;
						var seconds = Math.floor(diff % 60);
						diff /= 60;
						var minutes = Math.floor(diff % 60);
						diff /= 60;
						var hours = Math.floor(diff % 24);
						if (hours == 0) {
							var timeleft = ((minutes < 10) ? '0' + minutes : minutes) + ' minutes and ' + ((seconds < 10) ? '0' + seconds : seconds);
						} else {
							var timeleft = (hours == 1) ?  hours + ' hour, ' +  (((minutes < 10) ? '0' + minutes : minutes) + ' minutes and ' + ((seconds < 10) ? '0' + seconds : seconds)) :( hours + ' hours, ' + ((minutes < 10) ? '0' + minutes : minutes) + ' minutes and ' + ((seconds < 10) ? '0' + seconds : seconds));
						}
						text += 'The last endpoll was made ' + timeleft + ' seconds ago, in ' + roomArray[i] + '. ';
					} else {
						text += 'No endpoll has run since the RP was started in ' + roomArray[i] + '. ';
					}
				}
			}
			return this.say(room, text);
		}
		if (!this.canUse('endpoll', room, by) || !(room in this.RP) || !this.RP[room].setAt) return false; 
		if (this.RP[room].lastEndPoll) {
			var text = '';
			var start = new Date(this.RP[room].lastEndPoll);
			var now = new Date();
			var diff = (now.getTime() - start.getTime()) / 1000;
			var seconds = Math.floor(diff % 60);
			diff /= 60;
			var minutes = Math.floor(diff % 60);
			diff /= 60;
			var hours = Math.floor(diff % 24);
			if (hours == 0) {
				var timeleft = ((minutes < 10) ? '0' + minutes : minutes) + ' minutes and ' + ((seconds < 10) ? '0' + seconds : seconds);
			} else {
				var timeleft = (hours == 1) ?  hours + ' hour, ' +  (((minutes < 10) ? '0' + minutes : minutes) + ' minutes and ' + ((seconds < 10) ? '0' + seconds : seconds)) :( hours + ' hours, ' + ((minutes < 10) ? '0' + minutes : minutes) + ' minutes and ' + ((seconds < 10) ? '0' + seconds : seconds));
			}
			text += 'The last endpoll was made ' + timeleft + ' seconds ago';
			if (this.RP[room].lastPollVoided) text += ', but was voided';
				this.say(room, '/w ' + by + ', ' + text + '.');
			} else {
				this.say(room, '/w ' + by +', No endpoll has run since the RP was started.');
		}
	},
	cp: 'customPriority',
	customPriority: function (arg, by, room) {
		if (!this.hasRank(by, '%@#&~') || room != 'amphyrp' || typeof this.RP[room].setAt != 'undefined' || config.serverid != 'showdown') return false;
		if (!arg || toId(arg).length > 19 || toId(arg) == 'requested') return this.say(room, 'Please specify the person claiming custom priority.');
		if (pollRoom == 'amphyrp') this.splitMessage('>' + room + '\n|c|~luxlucario|' + config.commandcharacter + 'voidpoll');
		this.splitMessage('>' + room + '\n|c|~luxlucario|' + config.commandcharacter + 'setrp CP');
		this.splitMessage('>' + room + '\n|c|~luxlucario|' + config.commandcharacter + 'sethost ' + arg);
		customPriorityFlag = true;
		this.say(room, '/modnote ' + arg + ' has claimed custom priority.');
	},
	vp: 'voidpoll',
	voidpoll: function(arg, by, room) {
		if (room.charAt(0) === ',' && (config.staffList.indexOf(toId(by)) > -1)) room = pollRoom;
		if (!(room in this.RP) || !pollON || !this.hasRank(by, '%@#&~') || pollRoom != room) return false;
			pollON = false;
			this.splitMessage('>' + pollRoom + '\n|c|~luxlucario|' + config.commandcharacter + 'nominators boop');
			pollNoms = [];
			clearTimeout(pollTimer[pollRoom]);
			delete pollTimer[pollRoom];
			if (this.RP[room].rppollProgress) {
				this.voidpoll[room] = true;
				this.say(room, "/poll end");
				delete this.RP[room].rppollProgress;
			}
			console.log(new Date().toString() + " "+ room.cyan + ': '.cyan + "The RP poll has been voided.");
			return this.say(room, 'RP Poll voided.');
	},
	vep: 'voidendpoll',
	voidendpoll: function(arg, by, room) {
		if (!this.RP[room].endpollProgress || !this.hasRank(by, '%@#&~')) return false;
		delete this.RP[room].endpollCalled;
		delete this.RP[room].endpollProgress;
		clearTimeout(this.endpollTimerSet[room]);
		delete this.endpollTimerSet[room];
		this.voidpoll[room] = true;
		this.say(room, "/poll end");
		return this.say(room, 'Endpoll voided.');
	},
	timer: function(arg, by, room){
		if (!(room in this.RP)) return false;
		if (typeof this.RP[room].host != 'undefined') {
			if (config.voiceList.indexOf(toId(by)) == -1 && !this.canUse('setrp', room, by) && !(toId(by) == toId(this.RP[room].host))  || !this.RP[room].host || this.RP[room].setAt) return false;
		} else {
			if (config.voiceList.indexOf(toId(by)) == -1 && !this.canUse('setrp', room, by) || !this.RP[room].host || this.RP[room].setAt) return false;
		}

		var start = new Date(this.RP[room].setUpAt);
		var now = new Date();
		if (/conquest/i.test(toId(this.RP[room].plot))) {
			var diff = (15 * 60 * 1000 - (now.getTime() - start.getTime())) / 1000;
		} else {
			var diff = (30 * 60 * 1000 - (now.getTime() - start.getTime())) / 1000;
		}
		var seconds = Math.floor(diff % 60);
		diff /= 60;
		var minutes = Math.floor(diff % 60);
		diff /= 60;
		var timeleft = ((minutes < 10) ? '0' + minutes : minutes) + ' minutes and ' + ((seconds < 10) ? '0' + seconds : seconds);
		// If timeleft is less than 0, give a warning that there is no more time left.
		if (diff > 0) {
			this.say (room, "The host has " + timeleft + " seconds left to set up.");
		} else {
			this.say (room, "The host has exhausted the time allotted for set up.  Highlighting mods.");
		}
	},
	psa: 'publicserviceannouncement',
	publicserviceannouncement: function(arg, by, room) {
		if (config.serverid == 'showdown' && room.charAt(0) === ',') {
			return this.say(room, config.publicSeviceAnnouncement);
		}
		if (config.serverid !== 'showdown' || !this.hasRank(by, '%@#&~') || !(room in this.RP)) {
			var text = '/w '+ by + ',';
		} else {
			var text = '';
			if (this.RP[room].setAt && !this.RP[room].pause) {
				return this.say(room, text + ' ((' + config.publicSeviceAnnouncement + '))');
			}
		}
		this.say(room, text + config.publicSeviceAnnouncement);
	},
	botissue: 'botsuggestions',
	botissues: 'botsuggestions',
	botsuggest: 'botsuggestions',
	botsuggestions: function(arg, by, room) {
		if (config.serverid == 'showdown' && room.charAt(0) === ',') {
			return this.say(room, 'Any issues I have go here!  N-not that I have any! ' + config.fork + '/issues');
		}
		if (config.serverid !== 'showdown' || !this.hasRank(by, '%@#&~') || !(room in this.RP))
		{
			var text = '/w '+ by + ',';
		} else {
			var text = '';
			if (this.RP[room].setAt && !this.RP[room].pause) {
				return this.say(room, text + ' ((Any issues I have go here!  N-not that I have any! ' + config.fork + '/issues))');
			}
		}
		this.say(room, text + ' Any issues I have go here!  N-not that I have any! ' + config.fork + '/issues');
	},
	legend: 'legends',
	legends: function(arg, by, room) {
		if (config.serverid == 'showdown' && room.charAt(0) === ',') {
			if ((toId(arg) == 'arceus')) return this.say(room, 'Permissions are unavailable for Arceus.');
			if (toId(arg) == 'cosmoem') arg = 'cosmog';
			if (config.legendtoIdList.indexOf(toId(arg)) == -1) arg = null;
			if (arg) {
				if (config.legendtoIdList.indexOf(toId(arg)) > -1) {
					var legendNum = config.legendtoIdList.indexOf(toId(arg));
					return this.say(room, ' Legend: ' + config.legendList[legendNum] + ', Owner: ' + config.legendOwnerList[legendNum] + ', Name: ' + config.legendOCList[legendNum] + '.');
				}
			} else {
				return this.say(room, 'Legend Permission List: http://psroleplaying.forumotion.com/t1210-legendary-permissions');
			}
		}
		if (config.serverid !== 'showdown' || !this.hasRank(by, '%@#&~') || !(room in this.RP)) {
			var text = '/w '+ by + ',';
		} else {
			var text = '';
		}
		if ((toId(arg) == 'arceus')) return this.say(room, 'Permissions are unavailable for Arceus.');
		if (toId(arg) == 'cosmoem') arg = 'cosmog';
		if (config.legendtoIdList.indexOf(toId(arg)) == -1) arg = null;
		if (arg) {
			if (config.legendtoIdList.indexOf(toId(arg)) > -1) {
				var legendNum = config.legendtoIdList.indexOf(toId(arg));
				return this.say(room, text + ' Legend: ' + config.legendList[legendNum] + ', Owner: ' + config.legendOwnerList[legendNum] + ', Name: ' + config.legendOCList[legendNum] + '.');
			}
		} else {
		this.say(room, text + ' Legend Permission List: http://psroleplaying.forumotion.com/t1210-legendary-permissions');
		}
	},
	site: function(arg, by, room) {
		if (config.serverid !== 'showdown') return false;
		if ((this.hasRank(by, '+%@#~') && config.rprooms.indexOf(room) !== -1) || room.charAt(0) === ',') {
			var text = '';
		} else {
			var text = '/pm ' + by + ', ';
		}
		this.say(room, text + 'Roleplaying\'s Website: http://psroleplaying.forumotion.com/t1165-rp-room-rules-and-guidelines');
	},
	forum: function(arg, by, room) {
		if (config.serverid !== 'showdown') return false;
		if ((this.hasRank(by, '+%@#~') && config.rprooms.indexOf(room) !== -1) || room.charAt(0) === ',') {
			var text = '';
		} else {
			var text = '/pm ' + by + ', ';
		}
		this.say(room, text + 'Roleplaying\'s Forum: http://psroleplaying.forumotion.com/');
	},
	rustyrp: function(arg, by, room) {		
	if (config.serverid !== 'showdown' || !(room in this.RP)) return false;
		if ((this.hasRank(by, '+%@#~') && config.rprooms.indexOf(room) !== -1) || room.charAt(0) === ',') {
			var text = '';
		} else {
			var text = '/pm ' + by + ', ';
		}
		this.say(room, text + 'http://psroleplaying.forumotion.com/t1599-rustyrp-rebirth#36632');
	},
	worldmap: 'map',
	map: function(arg, by, room) {
	if (config.serverid !== 'showdown') return false;
		if ((this.hasRank(by, '+%@#~') && config.rprooms.indexOf(room) !== -1) || room.charAt(0) === ',') {
			var text = '';
		} else {
			var text = '/pm ' + by + ', ';
		}
		this.say(room, text + 'Check out the RP Map: http://psroleplaying.forumotion.com/t1555-the-new-real-world-map');
	},
	orp: 'officialRPList',
	officialRPList: function(arg, by, room) {
	if (config.serverid !== 'showdown') return false;
		if ((this.hasRank(by, '+%@#~') && config.rprooms.indexOf(room) !== -1) || room.charAt(0) === ',') {
			var text = '';
		} else {
			var text = '/pm ' + by + ', ';
		}
		this.say(room, text + 'List of Official RPs: http://psroleplaying.forumotion.com/t1458-list-of-official-roleplays#33869');
	},
	rpq: 'RPQuickstart',
	RPQuickstart: function(arg, by, room) {
	if (config.serverid !== 'showdown') return false;
		if ((this.hasRank(by, '+%@#~') && config.rprooms.indexOf(room) !== -1) || room.charAt(0) === ',') {
			var text = '';
		} else {
			var text = '/pm ' + by + ', ';
		}
		this.say(room, text + 'RP Quickstart guide: https://docs.google.com/document/d/1JFMLzrbTHg7Q6qcMN9hEfY7aofZrEC5lC4lYpwV1pQY/edit');
	},
	mapassist: function(arg, by, room) {
		if (config.serverid !== 'showdown' || !this.hasRank(by, '~') || !(room in this.RP) || toId(this.RP[room].plot) !== 'freeroam') return false;
		if (this.RP[room].mapcalled) {
			var text = '/pm ' + by + ', ';
		} else {
			var text = '';
			this.RP[room].mapcalled = true;
			setTimeout(function() {
				delete this.RP[room].mapcalled;
			}.bind(this), 60 * 1000);
		}
		this.say(room, text + 'Check out the RP Map: http://psroleplaying.forumotion.com/t1555-the-new-real-world-map');
	},
	defaultDoc: function (arg, by, room) {
		if (config.serverid !== 'showdown' || !this.hasRank(by, '~') || !(room in this.RP)) return false;
		if (RPOpts.indexOf(toId(arg)) > -1 || /conquest/i.test(toId(arg))) {
			switch (toId(arg)) {
				case 'cruise':
				    this.splitMessage('>' + room + '\n|c|' + by + '|' + config.commandcharacter + 'setdoc https://docs.google.com/document/d/1nkksfCr1X1YgpAA9M56Ny2mYstjC7mAW937oKgN6aYs');
					break;
				case 'conquest':
				    this.splitMessage('>' + room + '\n|c|' + by + '|' + config.commandcharacter + 'setdoc Battleless: https://docs.google.com/document/d/1FgUErxguKLsulNXX71h_oehfwm20dp1f3WPJwtPjJVE/edit, Regular: https://docs.google.com/document/d/1CqLuTfbgxKYplQfZOX1ImEUSlIVY4PP7ix5BteUiQO0/edit');
				    break;
				case 'battlelessconquest':
				    this.splitMessage('>' + room + '\n|c|' + by + '|' + config.commandcharacter + 'setdoc https://docs.google.com/document/d/1kuMbrynSH7k_8nmsCxZxvqWzlpGjrYIHAH9oDedvtHE/edit');
					break;
				case 'regularconquest':
					this.splitMessage('>' + room + '\n|c|' + by + '|' + config.commandcharacter + 'setdoc https://docs.google.com/document/d/1LCocNrrmEUCurvQTqQ5NbIzWitFeDFvtHluKy4NpAwM/edit');
					break;
				case 'variantconquest': 
					this.splitMessage('>' + room + '\n|c|' + by + '|' + config.commandcharacter + 'setdoc "Your doc could be here!"');
					break;
				case 'goodvsevil':
				    this.splitMessage('>' + room + '\n|c|' + by + '|' + config.commandcharacter + 'setdoc https://docs.google.com/document/d/1qnfG7LNHzCrwyekf1iaire3Em5JjytmzwsmTcJ3DBI0');
					break;
				case 'pokehigh':
					this.splitMessage('>' + room + '\n|c|' + by + '|' + config.commandcharacter + 'setdoc https://docs.google.com/document/d/1L7p8cuDpWnit4pTW6jcwRuYeB8eEYiIvTHVa6UyCBB4');
				default:
					break;
			}
		}
	},
	report: function(arg, by, room) {		
		if (config.serverid !== 'showdown') return false;
		if ((this.hasRank(by, '%@#~') && config.rprooms.indexOf(room) !== -1) || room.charAt(0) === ',') {
			var text = '';
		} else {
			var text = '/pm ' + by + ', ';
		}
		this.say(room, text + 'Report bad behaviour here: https://docs.google.com/forms/d/1EXzyEuStwlhydYp_BK94JsLdnbJGBPYpPO85BKaHyIg/viewform');
	},
	close: function(arg, by, room) {
		if (config.serverid !== 'showdown') return false;
		if (!(this.hasRank(by, '@#~')) || !(room in this.RP)) return false;
		if (room == 'roleplaying') return this.say(room, "Main cannot be closed.");
		if (room == 'amphyrp' || room == 'rustyrp') {
			this.say(room, '/modchat +');
		}
		if (this.RP[room].plot) return "Please end the RP before closing " + room + ".";
		this.say(room, '/modnote ' + by + ' has closed ' + room + '.');
		console.log(new Date().toString() + " "+ room.cyan + ': '.cyan + room.cyan + ' was closed by ' + by + '.');
		if (pollRoom == room) {
			this.splitMessage('>' + room + '\n|c|~luxlucario|' + config.commandcharacter + 'vp');
		}
		this.splitMessage('>' + room + '\n|c|~luxlucario|' + config.commandcharacter + 'vr');
	},
	open: function(arg, by, room) {
		if (config.serverid !== 'showdown') return false;
		if (!(this.hasRank(by, '@#~')) || !(room in this.RP)) return false;
		if (room == 'roleplaying') return false;
		if (room == 'amphyrp' || room == 'rustyrp') {
			this.say(room, '/modchat ac');
		}
		this.say(room, 'Opening ' + room + '.');
		this.say(room, '/modnote ' + by + ' has opened ' + room + ".");
		console.log(new Date().toString() + " "+ room.cyan + ': '.cyan + room.cyan + ' was opened by ' + by + '.');
		this.splitMessage('>' + room + '\n|c|' + by + '|' + config.commandcharacter + 'voidreset');
		this.splitMessage('>' + room + '\n|c|' + by + '|' + config.commandcharacter + 'rppoll');
	},
	faq: 'defintion',
	define: 'defintion',
	defintion: function(arg, by, room) {
		if (config.serverid !== 'showdown') return false;
		if (this.hasRank(by, '%@#~') || config.voiceList.indexOf(toId(by)) != -1 || room.charAt(0) === ',') {
			var text = '';
			if (!(room.charAt(0) === ',')) {
				if (this.RP[room].setAt && !(this.RP[room].pause)) {
					text += '((';
					if (toId(arg) == "ooc" || toId(arg) == "outofcharacter") {
						text += "<-- ";
					}
				}
			}
			switch (toId(arg)) {
				case '':
					text += "Please enter a word for me to explain.";
					break;
				case 'bold':
					text += "Bold is a formatting reserved for pollmakers to make announcements related to their poll and the current roleplay's host(s) to narrate. Bold text can be entered by surrounding the text you want to bold with two asterisks";
					break;
				case "italic":
				case "italics":
					text += "Italics are a formatting used by surrounding your text with double underscores, ____like this____. It's not required to be used for when you roleplay, but many people do. It is usually used when typing out multiple paragraphs of describing scenery.";
					break;
				case 'connectionracing':
					text += 'Connection racing is attempting to "place" after a server restart or after modchat is taken down. For example: Saying "first" or "third". Connection racing is mutable.';
					break;
				case 'custom':
					text += 'A custom is a usermade, staff approved RP, that does not fall under any of the offical RP categories.';
					break;
				case 'custompriority':
				case 'cp':
				text += 'Custom Priority is the system for exclusively AmphyRP that prioritizes custom-made RPs ahead of that of mainstream RPs. A custom RP must be approved by a moderator, in order to be CP\'d. For more information: http://psroleplaying.forumotion.com/t1419-amphy-s-custom-priority'
					break;
				case "godmod":
				case 'godmodding':
					text += "Godmodding is performing god-like or overpowered actions that may or may not disrupt the flow or enjoyment of a certain roleplay.";
					break;
				case 'hooting':
					text += "Hooting is when a roleplayer uses the name of the Pokémon they are RPing as the only thing they say.";
					break;
				case 'lennyclause':
					text += "The Lenny Clause is a rule that prohibits the usage of lenny faces or any similar ASCII faces.";
					break;
				case 'minimod':
				case 'minimodding':
					text += "Minimodding is when a non-staff user who makes a statement in chat calling for a moderator action to be taken upon other users, despite not being able to use it themselves, e.g 'That guy needs to be banned.'";
					break;
				case 'powerplay':
				case 'powerplaying':
					text += "Powerplaying is taking control of another person's actions, either directly or indirectly, without given permission or in a disruptive manner.";
					break;
				case 'ooc':
				case 'outofcharacter':
					text += "Out of Character, or OOC, refers to the double parentheses around text used to distinguish such speech from the RPing.";
					break;
				// RPs:
				// FR and Variants
				case 'fr':
				case 'freeroam':
					text += "Freeroam is an RP in which you have the capacity to craft your own stories. In this RP, there is no host, which gives the users free reign over the world as long as it stays within the rules (No godmodding, religious imagery, outside fandoms, gore, etc.) to create their own adventures and plots.";
					break;
				case 'cruise':
					text += "Cruise is a freeform RP in which the action takes place entirely on a cruise of some description. Let your imagination run wild within the limits of a boat. Go swimming! Play shuffleboard! Explore the stores and cafeterias! The possibilities are endless.";
					break;
				case 'kingdom':
					text += "Kingdom is a structured freeform RP with a host and a document displaying information on a world and the kinds of abilities any given OC may choose. This RP is almost always hosted in a medieval setting, however this is not always the case, nor does it have to be.";
					break;
				// Non FR RPs.
				case 'gve':
				case 'goodvsevil':
					text += "Good vs Evil consists of two sides, Good and Evil. There is one leader for each side, and they are the only Pokemon in the roleplay who may be of Uber tier, legendaries (no uber legendaries), or mega-evolve. \n Each side will contain warriors who will attempt to overtake the opposing side by killing off the other team's warriors. Whoever can kill the leader twice and all of their warriors first, wins.";
					break;
				case 'pu':
				case 'pokehigh':
				case 'pokhigh':
					text +="Pokehigh is a roleplay where participants are sent to a school based on a normal high school. Of course, there can be many variations to this high school. It may look different, have different classes and teachers.";
					break;
				case 'pmd':
				case 'pokmonmysterydungeon':
				case 'pokemonmysterydungeon':
					text += "Pokemon Mystery Dungeon is essentially like the game franchise, you are thrown into a new world inhabited by Pokemon on a scale never seen before. Difficult dungeons and bosses await you and your newly acquired teammates. \n You usually start out as either a LC (Little Cup) Pokemon, or a Pokemon that can not evolve (such as Volbeat), and evolve when the host says you may.";
					break;
				case 'trainer':
					text += "Trainer is a roleplay that is centered around user-created regions that can create vast new worlds and experiences. You'll be taken on a journey throughout the region by fighting criminal orginizations, gym leaders, and even special user-made events. \n Usually hosts will decide which Pokemon will appear on a certain route, and you may only catch one Pokemon per route, unless stated otherwise!";
					break;

					
				default:
					text += "I do not have a definition of that word at the moment, if it is a reasonable RP term, please PM Lux to add the word and its definition.";
				break;
			}
			if (!(room.charAt(0) === ',')) {
				if (this.RP[room].setAt && !(this.RP[room].pause)) {
					if (toId(arg) == "ooc" || toId(arg) == "outofcharacter") {
						text += " -->";
					}
					text += '))';
				}
			}
			this.say(room, text);
		}
	},
	addmotd: function(arg, by, room) {
		if (config.serverid !== 'showdown') return false;
		if ((!this.hasRank(by, '#~') || config.rprooms.indexOf(room) == -1) &&  !((room.charAt(0) === ',') && config.excepts.indexOf(toId(by)) > -1)) return false;
		if (!arg) return this.say(room, 'Please enter a motd announcement to add.');
		this.RP.motd.push(arg);
		this.writeSettings();
		return this.say (room, 'MoTD added. There are currently ' + this.RP.motd.length + ' MotD announcements in circulation.');
	},
	editmotd: function(arg, by, room) {
		if (config.serverid !== 'showdown') return false;
		if ((!this.hasRank(by, '#~') || config.rprooms.indexOf(room) == -1) &&  !((room.charAt(0) === ',') && config.excepts.indexOf(toId(by)) > -1)) return false;
		if (!arg) return this.say(room, 'Please enter the number of the MotD you wish to edit, followed by the message you wish to overwrite it with.');
		var spl = arg.split(',').map(function (str) {
			// It's simply safer to check for the comma and trim each string rather than
			// looking for ', ' - some users might be lazy and use `.editmotd 0,Testing`,
			// or `.editmotd 0,Testing, testing`, which splits into ['0,Testing', 'testing'].
			return str.trim();
		});
		if (spl.length < 2) return this.say(room, 'Please enter the number of the MotD you wish to edit, followed by the message you wish to overwrite it with.');
		// We need to coerce spl[0] into a number. If isNaN, then report so.
		spl[0] = Number(spl[0]) - 1;
		if (isNaN(spl[0])) return this.say(room, 'The provided number should be a valid digit number.');
		if (spl[0] >= this.RP.motd.length || spl[0] < 0) return this.say(room, 'There are only ' + this.RP.motd.length + ' MotD announcements in circulation, please target a valid MotD.');
		// By using `spl.slice(1).join(', ')`, we're allowing users to use commas in the edited motd.
		this.RP.motd[spl[0]] = spl.slice(1).join(', ');
		this.writeSettings();
		return this.say (room, 'MoTD edited. There are currently ' + this.RP.motd.length + ' MotD announcements in circulation.');
	},
	rmmotd: 'removemotd',
	removemotd: function(arg, by, room) {
		if (config.serverid !== 'showdown') return false;
		if ((!this.hasRank(by, '#~') || config.rprooms.indexOf(room) == -1) &&  !((room.charAt(0) === ',') && config.excepts.indexOf(toId(by)) > -1)) return false;
		if (!this.RP.motd.length) return this.say(room, 'There are currently no MotDs.');
		if (!arg) {
			this.RP.motd.pop();
			this.writeSettings();
			return this.say(room, 'The most recently added MotD was removed.');
		} else {
			arg = Number(arg) - 1;
			if (isNaN(arg)) return this.say(room, 'The provided number should be a valid digit number.');
			if (arg >= this.RP.motd.length || arg < 0) return this.say(room, 'There are only ' + this.RP.motd.length + ' MotD announcements in circulation, please target a valid MotD.');
			this.RP.motd.splice(arg, 1);
			this.writeSettings();
			return this.say (room, 'MoTD #' + (arg+1) + ' was removed.');
		}
	},
	motd: function(arg, by, room) {
		if (config.serverid !== 'showdown') return false;
		if ((!this.hasRank(by, '+%@#~') && config.voiceList.indexOf(toId(by)) == -1) || config.rprooms.indexOf(room) == -1) return false;
		if (!this.RP.motd.length) return this.say(room, 'There are currently no MotDs.');
		if (isNaN(Number(arg))) return this.say(room, 'The provided number should be a valid digit number.');
		arg = Number(arg) - 1;
		var num;
		if (arg < this.RP.motd.length && arg >= 0) {
			num = arg;
		} else {
			num = Math.floor(Math.random() * this.RP.motd.length);
		}
		this.say(room, this.RP.motd[num]);
	},
};