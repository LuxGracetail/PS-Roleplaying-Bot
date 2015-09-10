/**
 * This is the file where commands get parsed
 *
 * Some parts of this code are taken from the Pokémon Showdown server code, so
 * credits also go to Guangcong Luo and other Pokémon Showdown contributors.
 * https://github.com/Zarel/Pokemon-Showdown
 *
 * @license MIT license
 */

var fs = require('fs');
var http = require('http');
var https = require('https');
var url = require('url');

const ACTION_COOLDOWN = 3 * 1000;
const FLOOD_MESSAGE_NUM = 5;
const FLOOD_PER_MSG_MIN = 500; // this is the minimum time between messages for legitimate spam. It's used to determine what "flooding" is caused by lag
const FLOOD_MESSAGE_TIME = 6 * 1000;
const MIN_CAPS_LENGTH = 12;
const MIN_CAPS_PROPORTION = 0.8;

// TODO: move to rooms.js
// TODO: store settings by room, not command/blacklists
var settings;
try {
	settings = JSON.parse(fs.readFileSync('settings.json'));
} catch (e) {} // file doesn't exist [yet]
if (!Object.isObject(settings)) settings = {};

exports.parse = {
	actionUrl: url.parse('https://play.pokemonshowdown.com/~~' + config.serverid + '/action.php'),
	'settings': settings,
	// TODO: handle chatdata in users.js
	chatData: {},
	// TODO: handle blacklists in rooms.js
	blacklistRegexes: {},

	data: function (data) {
		if (data.charAt(0) !== 'a') return false;
		data = JSON.parse(data.substr(1));
		if (Array.isArray(data)) {
			for (var i = 0, len = data.length; i < len; i++) {
				this.splitMessage(data[i]);
			}
		} else {
			this.splitMessage(data);
		}
	},
	splitMessage: function (message) {
		if (!message) return;

		var room = null;
		if (message.indexOf('\n') < 0) return this.message(message, room);

		var spl = message.split('\n');
		if (spl[0].charAt(0) === '>') {
			if (spl[1].substr(1, 10) === 'tournament') return false;
			var roomid = spl.shift().substr(1);
			room = Rooms.get(roomid);
			if (spl[0].substr(1, 4) === 'init') {
				var users = spl[2].substr(7);
				room = Rooms.add(roomid, config.rooms.indexOf(roomid) === 1);
				room.onUserlist(users);
				return ok('joined ' + room.id);
			}
		}

		for (var i = 0, len = spl.length; i < len; i++) {
			this.message(spl[i], room);
		}
	},
	message: function (message, room) {
		var spl = message.split('|');
		switch (spl[1]) {
		case 'challstr':
			info('received challstr, logging in...');
			var id = spl[2];
			var str = spl[3];

			var requestOptions = {
				hostname: this.actionUrl.hostname,
				port: this.actionUrl.port,
				path: this.actionUrl.pathname,
				agent: false
			};

			var data;
			if (!config.pass) {
				requestOptions.method = 'GET';
				requestOptions.path += '?act=getassertion&userid=' + toId(config.nick) + '&challengekeyid=' + id + '&challenge=' + str;
			} else {
				requestOptions.method = 'POST';
				data = 'act=login&name=' + config.nick + '&pass=' + config.pass + '&challengekeyid=' + id + '&challenge=' + str;
				requestOptions.headers = {
					'Content-Type': 'application/x-www-form-urlencoded',
					'Content-Length': data.length
				};
			}

			var req = https.request(requestOptions, function (res) {
				res.setEncoding('utf8');
				data = '';
				res.on('data', function (chunk) {
					data += chunk;
				});
				res.on('end', function () {
					if (data === ';') {
						error('failed to log in; nick is registered - invalid or no password given');
						process.exit(-1);
					}
					if (data.length < 50) {
						error('failed to log in: ' + data);
						process.exit(-1);
					}

					if (data.indexOf('heavy load') !== -1) {
						error('the login server is under heavy load; trying again in one minute');
						setTimeout(function () {
							this.message(message);
						}.bind(this), 60 * 1000);
						return;
					}

					if (data.substr(0, 16) === '<!DOCTYPE html>') {
						error('Connection error 522; trying again in one minute');
						setTimeout(function () {
							this.message(message);
						}.bind(this), 60 * 1000);
						return;
					}

					try {
						data = JSON.parse(data.substr(1));
						if (data.actionsuccess) {
							data = data.assertion;
						} else {
							error('could not log in; action was not successful: ' + JSON.stringify(data));
							process.exit(-1);
						}
					} catch (e) {}
					send('|/trn ' + config.nick + ',0,' + data);
				}.bind(this));
			}.bind(this));

			req.on('error', function (err) {
				error('login error: ' + err.stack);
			});

			if (data) req.write(data);
			req.end();
			break;
		case 'updateuser':
			if (spl[2] !== config.nick) return;

			if (spl[3] !== '1') {
				error('failed to log in, still guest');
				process.exit(-1);
			}

			ok('logged in as ' + spl[2]);
			send('|/blockchallenges');

			// Now join the rooms
			Rooms.join();
				// Now join the rooms
				for (var i = 0, len = config.rooms.length; i < len; i++) {
					var room = toId(config.rooms[i]);
					if (room === 'lobby' && config.serverid === 'showdown') continue;
					send('|/join ' + room);
				}
				for (var i = 0, len = config.privaterooms.length; i < len; i++) {
					var room = toId(config.privaterooms[i]);
					if (room === 'lobby' && config.serverid === 'showdown') continue;
					send('|/join ' + room);
				}
				if (config.avatarNumber) send('|/avatar ' + config.avatarNumber);
				if (this.settings.blacklist) {
					var blacklist = this.settings.blacklist;
					for (var roomid in blacklist) {
						this.updateBlacklistRegex(roomid);
					}
				}
				if (config.serverid === 'showdown') {
					this.amphyVoices = [];
					this.freeroamTimeouts = {};
					if (this.settings && this.settings.RP) {
						this.RP.void = {};

						for (var i = config.rprooms.length; i--;) {
							var roomid = toId(config.rprooms[i]);
							var roleplay = this.settings.RP[roomid];
							if (roleplay) {
								if (roleplay.called) delete roleplay.called;
								if (roleplay.hostCalled) delete roleplay.hostCalled;
								this.RP[roomid] = roleplay;
								this.RP.void[roomid] = this.settings.RP.void[roomid];
							} else {
								this.RP[roomid] = this.settings.RP[roomid] = {};
								this.RP.void[roomid] = this.settings.RP.void[roomid] = [];
							}

							if (roleplay && roleplay.setAt && toId(roleplay.plot) === 'freeroam') {
								var timeout = Date.now() - new Date(roleplay.setAt).getTime();
								if (timeout < 0) {
									this.splitMessage('>' + roomid + '\n|c|~Morfent|' + config.commandcharacter + 'endrp');
									continue;
								}
								this.freeroamTimeouts[roomid] = setTimeout(function() {
									this.splitMessage('>' + roomid + '\n|c|~Morfent|' + config.commandcharacter + 'endrp');
									delete this.freeroamTimeouts[roomid];
								}.bind(this), timeout);
							}
						}
					} else {
						this.RP = this.settings.RP = {void: {}};
						for (var i = config.rprooms.length; i--;) {
							var roomid = toId(config.rprooms[i]);
							this.RP[roomid] = {};
							this.RP.void[roomid] = [];
						}
					}
				} else {
					if (this.settings.RP) {
						for (var i = config.rprooms.length; i--;) {
							var roomid = toId(config.rprooms[i]);
							var roleplay = this.settings.RP[roomid];
							if (roleplay) {
								if (roleplay.called) delete roleplay.called;
								if (roleplay.hostCalled) delete roleplay.hostCalled;
								this.RP[roomid] = roleplay;
							} else {
								this.RP[roomid] = this.settings.RP[roomid] = {};
							}
						}
					} else {
						this.settings.RP = this.RP = {};
						for (var i = config.rprooms.length; i--;) {
							this.RP[toId(config.rprooms[i])] = {};
						}
					}
				}
				if (this.settings.blacklist) {
					var blacklist = this.settings.blacklist;
					for (var room in blacklist) {
						this.updateBlacklistRegex(room);
					}
			setInterval(this.cleanChatData.bind(this), 30 * 60 * 1000);
			break;
		case 'c':
			var username = spl[2];
			var user = Users.get(username);
			if (!user) return false; // various "chat" responses contain other data
			if (user === Users.self) return false;
			if (this.isBlacklisted(user.id, room.id)) this.say(room, '/roomban ' + user.id + ', Blacklisted user');

			spl = spl.slice(3).join('|');
			if (!user.hasRank(room.id, '%')) this.processChatData(user.id, room.id, spl);
			this.chatMessage(spl, user, room);
			break;
		case 'c:':
			var username = spl[3];
			var user = Users.get(username);
			if (!user) return false; // various "chat" responses contain other data
			if (user === Users.self) return false;
			if (this.isBlacklisted(user.id, room.id)) this.say(room, '/roomban ' + user.id + ', Blacklisted user');

			spl = spl.slice(4).join('|');
			if (!user.hasRank(room.id, '%')) this.processChatData(user.id, room.id, spl);
			this.chatMessage(spl, user, room);
			break;
		case 'pm':
			var username = spl[2];
			var user = Users.get(username);
			var group = username.charAt(0);
			if (!user) user = Users.add(username);
			if (user === Users.self) return false;

			spl = spl.slice(4).join('|');
			if (spl.startsWith('/invite ') && user.hasRank(group, '%') &&
					!(toId(spl.substr(8)) === 'lobby' && config.serverid === 'showdown')) {
				return send('|/join ' + spl.substr(8));
			}
			this.chatMessage(spl, user, user);
			break;
		case 'N':
			var username = spl[2];
			var oldid = spl[3];
			var user = room.onRename(username, oldid);
			if (this.isBlacklisted(user.id, room.id)) this.say(room, '/roomban ' + user.id + ', Blacklisted user');
			this.updateSeen(oldid, spl[1], user.id);
			break;
		case 'J': case 'j':
			var username = spl[2];
			var user = room.onJoin(username, username.charAt(0));
			if (user === Users.self) return false;
			if (this.isBlacklisted(user.id, room.id)) this.say(room, '/roomban ' + user.id + ', Blacklisted user');
			this.updateSeen(user.id, spl[1], room.id);
			break;
		case 'l': case 'L':
			var username = spl[2];
			var user = room.onLeave(username);
			if (user) {
				if (user === Users.self) return false;
				this.updateSeen(user.id, spl[1], room.id);
			} else {
				this.updateSeen(toId(username), spl[1], room.id);
			}
			break;
		}
	},
	chatMessage: function (message, user, room) {
		var cmdrMessage = '["' + room.id + '|' + user.name + '|' + message + '"]';
		message = message.trim();		if (room.charAt(0) === ',') {
			// auto accept invitations to rooms
			if (message.substr(0, 8) === '/invite ' && this.hasRank(by, '%@&~') && !(config.serverid === 'showdown' && toId(message.substr(8)) === 'lobby')) {
				this.say('', '/join ' + message.substr(8));
			}
			if (config.logpms) console.log("Private Message from ".red + by.cyan + ": ".cyan + message);
		} else if (config.logmain) {
			var sender;
			if (!this.hasRank(by, '+%@#~')) {
				sender = by;
			} else if (this.hasRank(by, '+')) {
				sender = by.yellow;
			} else if (this.hasRank(by, '%')) {
				sender = by.cyan;
			} else if (this.hasRank(by, '@')) {
				sender = by.blue;
			} else if (this.hasRank(by, '#')) {
				sender = by.red;
			} else if (this.hasRank(by, '~')) {
				sender = by.green;
			}
			console.log(room.cyan + ': '.cyan + sender + ': '.cyan + message);
		}
		if (config.reply) {
			var spl = toId(message);
			for (var i = 0, len = config.replies.length; i < len; i++) {
				if (spl === toId(config.replies[i][0])) {
					this.say(room, config.replies[i][1]);
					break;
				}
			}
		}
		if (room.charAt(0) === ',') {
			// auto accept invitations to rooms
			if (message.substr(0, 8) === '/invite ' && this.hasRank(by, '%@&~') && !(config.serverid === 'showdown' && toId(message.substr(8)) === 'lobby')) {
				this.say('', '/join ' + message.substr(8));
			}
			if (config.logpms) console.log("Private Message from ".red + by.cyan + ": ".cyan + message);
		} else if (config.logmain) {
			var sender;
			if (!this.hasRank(by, '+%@#~')) {
				sender = by;
			} else if (this.hasRank(by, '+')) {
				sender = by.yellow;
			} else if (this.hasRank(by, '%')) {
				sender = by.cyan;
			} else if (this.hasRank(by, '@')) {
				sender = by.blue;
			} else if (this.hasRank(by, '#')) {
				sender = by.red;
			} else if (this.hasRank(by, '~')) {
				sender = by.green;
			}
			console.log(room.cyan + ': '.cyan + sender + ': '.cyan + message);
		}
		if (config.reply) {
			var spl = toId(message);
			for (var i = 0, len = config.replies.length; i < len; i++) {
				if (spl === toId(config.replies[i][0])) {
					this.say(room, config.replies[i][1]);
					break;
				}
			}
		}
		if (message.substr(0, config.commandcharacter.length) !== config.commandcharacter) return false;

		message = message.substr(config.commandcharacter.length);
		var index = message.indexOf(' ');
		var arg = '';
		var cmd = message;
		if (index > -1) {
			cmd = cmd.substr(0, index);
			arg = message.substr(index + 1).trim();
		}

		if (!!Commands[cmd]) {
			var failsafe = 0;
			while (typeof Commands[cmd] !== "function" && failsafe++ < 10) {
				cmd = Commands[cmd];
			}
			if (typeof Commands[cmd] === "function") {
				cmdr(cmdrMessage);
				Commands[cmd].call(this, arg, user, room);
			} else {
				error("invalid command type for " + cmd + ": " + (typeof Commands[cmd]));
			}
		}
	},
	say: function (target, text) {
		var targetId = target.id;
		if (Rooms.get(targetId)) {
			send((targetId !== 'lobby' ? targetId : '') + '|' + text);
		} else {
			send('|/pm ' + targetId + ', ' + text);
		}
	},
	isBlacklisted: function (userid, roomid) {
		var blacklistRegex = this.blacklistRegexes[roomid];
		return blacklistRegex && blacklistRegex.test(userid);
	},
	blacklistUser: function (userid, roomid) {
		var blacklist = this.settings.blacklist || (this.settings.blacklist = {});
		if (blacklist[roomid]) {
			if (blacklist[roomid][userid]) return false;
		} else {
			blacklist[roomid] = {};
		}

		blacklist[roomid][userid] = 1;
		this.updateBlacklistRegex(roomid);
		return true;
	},
	unblacklistUser: function (userid, roomid) {
		var blacklist = this.settings.blacklist;
		if (!blacklist || !blacklist[roomid] || !blacklist[roomid][userid]) return false;

		delete blacklist[roomid][userid];
		if (Object.isEmpty(blacklist[roomid])) {
			delete blacklist[roomid];
			delete this.blacklistRegexes[roomid];
		} else {
			this.updateBlacklistRegex(roomid);
		}
		return true;
	},
	updateBlacklistRegex: function (roomid) {
		var blacklist = this.settings.blacklist[roomid];
		var buffer = [];
		for (var entry in blacklist) {
			if (entry.startsWith('/') && entry.endsWith('/i')) {
				buffer.push(entry.slice(1, -2));
			} else {
				buffer.push('^' + entry + '$');
			}
		}
		this.blacklistRegexes[roomid] = new RegExp(buffer.join('|'), 'i');
	},
	uploadToHastebin: function (toUpload, callback) {
		if (typeof callback !== 'function') return false;
		var reqOpts = {
			hostname: 'hastebin.com',
			method: 'POST',
			path: '/documents'
		};

		var req = http.request(reqOpts, function (res) {
			res.on('data', function (chunk) {
				// CloudFlare can go to hell for sending the body in a header request like this
				if (typeof chunk === 'string' && chunk.substr(0, 15) === '<!DOCTYPE html>') return callback('Error uploading to Hastebin.');
				var filename = JSON.parse(chunk.toString()).key;
				callback('http://hastebin.com/raw/' + filename);
			});
		});
		req.on('error', function (e) {
			callback('Error uploading to Hastebin: ' + e.message);
		});

		req.write(toUpload);
		req.end();
	},
	processChatData: function (userid, roomid, msg) {
		// NOTE: this is still in early stages
		msg = msg.trim().replace(/[ \u0000\u200B-\u200F]+/g, ' '); // removes extra spaces and null characters so messages that should trigger stretching do so
		this.updateSeen(userid, 'c', roomid);
		var now = Date.now();
		if (!this.chatData[userid]) this.chatData[userid] = {
			zeroTol: 0,
			lastSeen: '',
			seenAt: now
		};
		var userData = this.chatData[userid];
		if (!userData[roomid]) userData[roomid] = {
			times: [],
			points: 0,
			lastAction: 0
		};
		var roomData = userData[roomid];

		roomData.times.push(now);

		// this deals with punishing rulebreakers, but note that the bot can't think, so it might make mistakes
		if (config.allowmute && Users.self.hasRank(roomid, '%') && config.whitelist.indexOf(userid) < 0) {
			var useDefault = !(this.settings.modding && this.settings.modding[roomid]);
			var pointVal = 0;
			var muteMessage = '';
			var modSettings = useDefault ? null : this.settings.modding[roomid];

			// moderation for banned words
			if ((useDefault || !this.settings.banword[roomid]) && pointVal < 2) {
				var bannedPhraseSettings = this.settings.bannedphrases;
				var bannedPhrases = !!bannedPhraseSettings ? (Object.keys(bannedPhraseSettings[roomid] || {})).concat(Object.keys(bannedPhraseSettings.global || {})) : [];
				for (var i = 0; i < bannedPhrases.length; i++) {
					if (msg.toLowerCase().indexOf(bannedPhrases[i]) > -1) {
						pointVal = 2;
						muteMessage = ', Automated response: your message contained a banned phrase';
						break;
					}
				}
			}
			// moderation for flooding (more than x lines in y seconds)
			var times = roomData.times;
			var timesLen = times.length;
			var isFlooding = (timesLen >= FLOOD_MESSAGE_NUM && (now - times[timesLen - FLOOD_MESSAGE_NUM]) < FLOOD_MESSAGE_TIME &&
				(now - times[timesLen - FLOOD_MESSAGE_NUM]) > (FLOOD_PER_MSG_MIN * FLOOD_MESSAGE_NUM));
			if ((useDefault || !('flooding' in modSettings)) && isFlooding) {
				if (pointVal < 2) {
					pointVal = 2;
					muteMessage = ', Automated response: flooding';
				}
			}
			// moderation for caps (over x% of the letters in a line of y characters are capital)
			var capsMatch = msg.replace(/[^A-Za-z]/g, '').match(/[A-Z]/g);
			if ((useDefault || !('caps' in modSettings)) && capsMatch && toId(msg).length > MIN_CAPS_LENGTH && (capsMatch.length >= ~~(toId(msg).length * MIN_CAPS_PROPORTION))) {
				if (pointVal < 1) {
					pointVal = 1;
					muteMessage = ', Automated response: caps';
				}
			}
			// moderation for stretching (over x consecutive characters in the message are the same)
			var stretchMatch = /(.)\1{7,}/gi.test(msg) || /(..+)\1{4,}/gi.test(msg); // matches the same character (or group of characters) 8 (or 5) or more times in a row
			if ((useDefault || !('stretching' in modSettings)) && stretchMatch) {
				if (pointVal < 1) {
					pointVal = 1;
					muteMessage = ', Automated response: stretching';
				}
			}

			if (pointVal > 0 && now - roomData.lastAction >= ACTION_COOLDOWN) {
				var cmd = 'mute';
				// defaults to the next punishment in config.punishVals instead of repeating the same action (so a second warn-worthy
				// offence would result in a mute instead of a warn, and the third an hourmute, etc)
				if (roomData.points >= pointVal && pointVal < 4) {
					roomData.points++;
					cmd = config.punishvals[roomData.points] || cmd;
				} else { // if the action hasn't been done before (is worth more points) it will be the one picked
					cmd = config.punishvals[pointVal] || cmd;
					roomData.points = pointVal; // next action will be one level higher than this one (in most cases)
				}
				if (config.privaterooms.indexOf(roomid) > -1 && cmd === 'warn') cmd = 'mute'; // can't warn in private rooms
				// if the bot has % and not @, it will default to hourmuting as its highest level of punishment instead of roombanning
				if (roomData.points >= 4 && !Users.self.hasRank(roomid, '@')) cmd = 'hourmute';
				if (userData.zeroTol > 4) { // if zero tolerance users break a rule they get an instant roomban or hourmute
					muteMessage = ', Automated response: zero tolerance user';
					cmd = Users.self.hasRank(roomid, '@') ? 'roomban' : 'hourmute';
				}
				if (roomData.points > 1) userData.zeroTol++; // getting muted or higher increases your zero tolerance level (warns do not)
				roomData.lastAction = now;
				this.say(Rooms.get(roomid), '/' + cmd + ' ' + userid + muteMessage);
			}
		}
	},
	cleanChatData: function () {
		var chatData = this.chatData;
		for (var user in chatData) {
			for (var room in chatData[user]) {
				var roomData = chatData[user][room];
				if (!Object.isObject(roomData)) continue;

				if (!roomData.times || !roomData.times.length) {
					delete chatData[user][room];
					continue;
				}
				var newTimes = [];
				var now = Date.now();
				var times = roomData.times;
				for (var i = 0, len = times.length; i < len; i++) {
					if (now - times[i] < 5 * 1000) newTimes.push(times[i]);
				}
				newTimes.sort(function (a, b) {
					return a - b;
				});
				roomData.times = newTimes;
				if (roomData.points > 0 && roomData.points < 4) roomData.points--;
			}
		}
	},

	updateSeen: function (user, type, detail) {
		if (type !== 'n' && config.rooms.indexOf(detail) < 0 || config.privaterooms.indexOf(detail) > -1) return;
		var now = Date.now();
		if (!this.chatData[user]) this.chatData[user] = {
			zeroTol: 0,
			lastSeen: '',
			seenAt: now
		};
		if (!detail) return;
		var userData = this.chatData[user];
		var msg = '';
		switch (type) {
		case 'j':
		case 'J':
			msg += 'joining ';
			break;
		case 'l':
		case 'L':
			msg += 'leaving ';
			break;
		case 'c':
		case 'c:':
			msg += 'chatting in ';
			break;
		case 'N':
			msg += 'changing nick to ';
			if (detail.charAt(0) !== ' ') detail = detail.substr(1);
			break;
		}
		msg += detail.trim() + '.';
		userData.lastSeen = msg;
		userData.seenAt = now;
	},
	getTimeAgo: function (time) {
		time = ~~((Date.now() - time) / 1000);

		var seconds = time % 60;
		var times = [];
		if (seconds) times.push(seconds + (seconds === 1 ? ' second' : ' seconds'));
		if (time >= 60) {
			time = ~~((time - seconds) / 60);
			var minutes = time % 60;
			if (minutes) times.unshift(minutes + (minutes === 1 ? ' minute' : ' minutes'));
			if (time >= 60) {
				time = ~~((time - minutes) / 60);
				var hours = time % 24;
				if (hours) times.unshift(hours + (hours === 1 ? ' hour' : ' hours'));
				if (time >= 24) {
					var days = ~~((time - hours) / 24);
					if (days) times.unshift(days + (days === 1 ? ' day' : ' days'));
				}
			}
		}
		if (!times.length) return '0 seconds';
		return times.join(', ');
	},
	splitDoc: function(voided) {
		if (!/docs\./.test(voided)) return voided;
		voided = voided.replace(/doc.*(?=docs\.)/i, '');
		var docIndex = voided.indexOf('doc');
		voided = voided.substr(0, docIndex).replace(/[^a-z0-9]*$/i, '');
		return voided;
	},
	writeSettings: (function () {
		var writing = false;
		var writePending = false; // whether or not a new write is pending
		var finishWriting = function () {
			writing = false;
			if (writePending) {
				writePending = false;
				this.writeSettings();
			}
		};
		return function () {
			if (writing) {
				writePending = true;
				return;
			}
			writing = true;
			var data = JSON.stringify(this.settings);
			fs.writeFile('settings.json.0', data, function () {
				// rename is atomic on POSIX, but will throw an error on Windows
				fs.rename('settings.json.0', 'settings.json', function (err) {
					if (err) {
						// This should only happen on Windows.
						fs.writeFile('settings.json', data, finishWriting);
						return;
					}
					finishWriting();
				});
			});
		};
	})(),
	uncacheTree: function (root) {
		var uncache = [require.resolve(root)];
		do {
			var newuncache = [];
			for (var i = 0; i < uncache.length; ++i) {
				if (require.cache[uncache[i]]) {
					newuncache.push.apply(newuncache,
						require.cache[uncache[i]].children.map(function (module) {
							return module.filename;
						})
					);
					delete require.cache[uncache[i]];
				}
			}
			uncache = newuncache;
		} while (uncache.length > 0);
	},
	getDocMeta: function (id, callback) {
		https.get('https://www.googleapis.com/drive/v2/files/' + id + '?key=' + config.googleapikey, function (res) {
			var data = '';
			res.on('data', function (part) {
				data += part;
			});
			res.on('end', function (end) {
				var json = JSON.parse(data);
				if (json) {
					callback(null, json);
				} else {
					callback('Invalid response', data);
				}
			});
		}).on('error', function (e) {
			callback('Error connecting to Google Docs: ' + e.message);
		});
	},
	getDocCsv: function (meta, callback) {
		https.get('https://docs.google.com/spreadsheet/pub?key=' + meta.id + '&output=csv', function (res) {
			var data = '';
			res.on('data', function (part) {
				data += part;
			});
			res.on('end', function (end) {
				callback(data);
			});
		}).on('error', function (e) {
			callback('Error connecting to Google Docs: ' + e.message);
		});
	}
};
