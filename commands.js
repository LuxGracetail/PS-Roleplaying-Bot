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
		text += '**Pokémon Showdown Bot** by: Quinella and TalkTakesTime';
		this.say(con, room, text);
	},
	help: 'guide',
	guide: function(arg, by, room, con) {
		if (this.hasRank(by, '+%@&#~') || room.charAt(0) === ',') {
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
	 * General commands
	 *
	 * Add custom commands here.
	 */

	settings: 'set',
	set: function(arg, by, room, con) {
		if (!this.hasRank(by, '%@&#~') || room.charAt(0) === ',') return false;

		var settable = {
			say: 1,
			joke: 1,
			choose: 1,
			usagestats: 1,
			buzz: 1,
			guia: 1
		};
		var opts = arg.split(',');
		var cmd = toId(opts[0]);
		if (!Commands[cmd]) return this.say(con, room, opts[0] + ' is not a valid command.');
		var failsafe = 0;
		while (!(cmd in settable)) {
			if (typeof Commands[cmd] === 'string') {
				cmd = Commands[cmd];
			} else if (typeof Commands[cmd] === 'function') {
				if (cmd in settable) {
					break;
				} else {
					this.say(con, room, 'The settings for ' + opts[0] + ' cannot be changed.');
					return;
				}
			} else {
				this.say(con, room, 'Something went wrong. PM TalkTakesTime here or on Smogon with the command you tried.');
				return;
			}
			failsafe++;
			if (failsafe > 5) {
				this.say(con, room, 'The command "' + opts[0] + '" could not be found.');
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
			if (!this.settings[cmd] || !this.settings[cmd][room]) {
				msg = '.' + cmd + ' is available for users of rank ' + config.defaultrank + ' and above.';
			} else if (this.settings[cmd][room] in settingsLevels) {
				msg = '.' + cmd + ' is available for users of rank ' + this.settings[cmd][room] + ' and above.';
			} else if (this.settings[cmd][room] === true) {
				msg = '.' + cmd + ' is available for all users in this room.';
			} else if (this.settings[cmd][room] === false) {
				msg = '.' + cmd + ' is not available for use in this room.';
			}
			this.say(con, room, msg);
			return;
		} else if (opts[1].trim() in settingsLevels) {
			if (!this.hasRank(by, '#~')) return false;
			if (!this.settings[cmd]) this.settings[cmd] = {};
			this.settings[cmd][room] = settingsLevels[opts[1].trim()];
			var self = this;
			this.writeSettings = (function() {
				var writing = false;
				var writePending = false; // whether or not a new write is pending
				var finishWriting = function() {
					writing = false;
					if (writePending) {
						writePending = false;
						self.writeSettings();
					}
				};
				return function() {
					if (writing) {
						writePending = true;
						return;
					}
					writing = true;
					var data = JSON.stringify(self.settings);
					console.log(data);
					fs.writeFile('settings.json', data, function() {
						// rename is atomic on POSIX, but will throw an error on Windows
						fs.rename('settings.json', 'settings.json', function(err) {
							if (err) {
								// This should only happen on Windows.
								fs.writeFile('settings.json', data, finishWriting);
								return;
							}
							finishWriting();
						});
					});
				};
			})();
			this.writeSettings();
			this.say(con, room, 'The command .'+cmd+' is now ' + 
				(settingsLevels[opts[1].trim()] === opts[1].trim() ? ' available for users of rank ' + opts[1].trim() + ' and above.' :
				(this.settings[cmd][room] ? 'available for all users in this room.' : 'unavailable for use in this room.')))
			return;
		} else {
			this.say(con, room, 'Unknown option: "' + opts[1].trim() + '". Valid settings are: off/disable, +, %, @, &, #, ~, on/enable.');
		}
	},
	tell: 'say',
	say: function(arg, by, room, con) {
		if (!this.canUse('say', room, by)) return false;
		this.say(con, room, stripCommands(arg) + ' (' + by + ' said this)');
	},
	joke: function(arg, by, room, con) {
		if (!this.canUse('joke', room, by)) return false;
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
					self.say(con, room, data.value.joke);
				} catch (e) {
					self.say(con, room, 'Sorry, couldn\'t fetch a random joke... :(');
				}
			});
		});
		req.end();
	},
	choose: function(arg, by, room, con) {
		if (arg.indexOf(',') === -1) {
			var choices = arg.split(' ');
		} else {
			var choices = arg.split(',');
		}
		choices = choices.filter(function(i) {return (toId(i) !== '')});
		if (choices.length < 2) return this.say(con, room, (room.charAt(0) === ',' ? '': '/pm ' + by + ', ') + '.choose: You must give at least 2 valid choices.');
		var choice = choices[Math.floor(Math.random()*choices.length)];
		this.say(con, room, ((this.canUse('choose', room, by) || room.charAt(0) === ',') ? '':'/pm ' + by + ', ') + stripCommands(choice));
	},
	usage: 'usagestats',
	usagestats: function(arg, by, room, con) {
		if (this.canUse('usagestats', room, by) || room.charAt(0) === ',') {
			var text = '';
		} else {
			var text = '/pm ' + by + ', ';
		}
		text += 'http://sim.smogon.com:8080/Stats/2014-03/';
		this.say(con, room, text);
	},
	guia: function(arg, by, room, con) {
		// this command is a guide for the Spanish room
		if (!(toId(room) === 'espaol' && config.serverid === 'showdown')) return false;
		var text = '';
		if (!this.canUse('guia', room, by)) {
			text += '/pm ' + by + ', ';
		}
		text += 'Si sos nuevo en el sitio, revisa nuestra **Guía Introductoria** (http://goo.gl/Db1wPf) compilada por ``1 + Tan²x = Sec²x``!';
		this.say(con, room, text);
	},

	/**
	 * Jeopardy commands
	 *
	 * The following commands are used for Jeopardy in the Academics room
	 * on the Smogon server.
	 */

	b: 'buzz',
	buzz: function(arg, by, room, con) {
		if (this.buzzed || !this.canUse('buzz', room, by) || room.charAt(0) === ',') return false;
		this.say(con, room, '**' + by.substr(1) + ' has buzzed in!**');
		this.buzzed = by;
		var self = this;
		this.buzzer = setTimeout(function(con, room, buzzMessage) {
			self.say(con, room, buzzMessage);
			self.buzzed = '';
		}, 7000, con, room, by + ', your time to answer is up!');
	},
	reset: function(arg, by, room, con) {
		if (!this.buzzed || !this.hasRank(by, '%@&#~') || room.charAt(0) === ',') return false;
		clearTimeout(this.buzzer);
		this.buzzed = '';
		this.say(con, room, 'The buzzer has been reset.');
	},
};
