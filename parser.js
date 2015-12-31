/**
 * This is the file where commands get parsed
 *
 * Some parts of this code are taken from the Pokémon Showdown server code, so
 * credits also go to Guangcong Luo and other Pokémon Showdown contributors.
 * https://github.com/Zarel/Pokemon-Showdown
 *
 * @license MIT license
 */

var sys = require('sys');
var https = require('https');
var url = require('url');

const ACTION_COOLDOWN = 3*1000;
const FLOOD_MESSAGE_NUM = 5;
const FLOOD_PER_MSG_MIN = 200; // this is the minimum time between messages for legitimate spam. It's used to determine what "flooding" is caused by lag
const FLOOD_MESSAGE_TIME = 6*1000;
const MIN_CAPS_LENGTH = 18;
const MIN_CAPS_PROPORTION = 0.8;

var settings;
try {
	settings = JSON.parse(fs.readFileSync('settings.json'));
} catch (e) {} // file doesn't exist [yet]
if (!Object.isObject(settings)) settings = {};

exports.parse = {
	actionUrl: url.parse('https://play.pokemonshowdown.com/~~' + config.serverid + '/action.php'),
	room: 'lobby',
	'settings': settings,
	chatData: {},
	ranks: {},
	RP: {},
	blacklistRegexes: {},

	data: function(data) {
		if (data.substr(0, 1) === 'a') {
			data = JSON.parse(data.substr(1));
			if (data instanceof Array) {
				for (var i = 0, len = data.length; i < len; i++) {
					this.splitMessage(data[i]);
				}
			} else {
				this.splitMessage(data);
			}
		}
	},
	splitMessage: function(message) {
		if (!message) return;

		var room = 'lobby';
		if (message.indexOf('\n') < 0) return this.message(message, room);

		var spl = message.split('\n');
		if (spl[0].charAt(0) === '>') {
			if (spl[1].substr(1, 10) === 'tournament') return;
			room = spl.shift().substr(1);
			if (spl[0].substr(1, 4) === 'init') {
				var users = spl[2].substr(7).split(',');
				var nickId = toId(config.nick);
				for (var i = users.length; i--;) {
					if (toId(users[i]) === nickId) this.ranks[room] = users[i].trim().charAt(0);
					break;
				}
				return ok('joined ' + room);
			}
		}

		for (var i = 0, len = spl.length; i < len; i++) {
			this.message(spl[i], room);
		}
	},
	splitDoc: function(voided) {
		if (!/docs\./.test(voided)) return voided;
		voided = voided.replace(/(doc.*)?(https?:\/\/)?docs\.*/i, '');
		return voided;
	},
	message: function(message, room) {
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

				if (!config.pass) {
					requestOptions.method = 'GET';
					requestOptions.path += '?act=getassertion&userid=' + toId(config.nick) + '&challengekeyid=' + id + '&challenge=' + str;
				} else {
					requestOptions.method = 'POST';
					var data = 'act=login&name=' + config.nick + '&pass=' + config.pass + '&challengekeyid=' + id + '&challenge=' + str;
					requestOptions.headers = {
						'Content-Type': 'application/x-www-form-urlencoded',
						'Content-Length': data.length
					};
				}

				var req = https.request(requestOptions, function(res) {
					res.setEncoding('utf8');
					var data = '';
					res.on('data', function(chunk) {
						data += chunk;
					});
					res.on('end', function() {
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
							setTimeout(function() {
								this.message(message);
							}.bind(this), 60 * 1000);
							return;
						}

						if (data.substr(0, 16) === '<!DOCTYPE html>') {
							error('Connection error 522; trying agian in one minute');
							setTimeout(function() {
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

				req.on('error', function(err) {
					error('login error: ' + sys.inspect(err));
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
					this.conquestTimeouts = {};
					this.conquestLockouts = {};
					this.voidpoll = {};
					this.endpollTimerSet = {};
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
				}
				setInterval(this.cleanChatData.bind(this), 30 * 60 * 1000);
				break;
			case 'c':
				var by = spl[2];
				if (this.isBlacklisted(toId(by), room)) return this.say(room, '/roomban ' + by + ', Blacklisted user');

				spl = spl.slice(3).join('|');
				if ('%@#&~'.indexOf(by.charAt(0)) < 0){
					this.processChatData(toId(by), room, spl);
				} else {
					this.updateSeen(toId(by), 'c', room);
				}
				this.chatMessage(spl, by, room);
				break;
			case 'c:':
				var by = spl[3];
				if (this.isBlacklisted(toId(by), room)) return this.say(room, '/roomban ' + by + ', Blacklisted user');

				spl = spl.slice(4).join('|');
				if ('%@#&~'.indexOf(by.charAt(0)) < 0){
					this.processChatData(toId(by), room, spl);
				} else {
					this.updateSeen(toId(by), 'c', room);
				}
				this.chatMessage(spl, by, room);
				break;
			case 'pm':
				var by = spl[2];
				this.chatMessage(spl.slice(4).join('|'), by, ',' + by);
				break;
			case 'N':
				var by = spl[2];
				this.updateSeen(spl[3], spl[1], toId(by)); // (original name, 'N', new nickname)
				//Log Namechanges
				if (config.logmain) console.log(new Date().toString() + " " + spl[3].cyan + " has changed their nickname to " + by.cyan);
				if (this.isBlacklisted(toId(by), room)) return this.say(room, '/roomban ' + by + ', Blacklisted user');
				break;
			case 'J': case 'j':
				var by = spl[2];
				this.updateSeen(toId(by), spl[1], room);
				//Log showjoins
				if (config.logmain) console.log(new Date().toString() + " " + by.cyan + " has " + "joined".green + " the room " + room);
				if (this.isBlacklisted(toId(by), room)) return this.say(room, '/roomban ' + by + ', Blacklisted user');
				break;
			case 'l': case 'L':
				this.updateSeen(toId(spl[2]), spl[1], room);
				//Log showjoins
				if (config.logmain) console.log(new Date().toString() + " " + spl[2].cyan + " has " + "left".red + " the room " + room);
				break;
/*			case 'popup':
				if (spl[2] === 'Room Owners (#):') this.amphyVoices = spl[spl.length - 1].split(', ');
				break;*/
			case "html":
				if (this.voidpoll[room]){
					delete this.voidpoll[room];
					this.RP[room].lastPollVoided = true;
					console.log(new Date().toString() + " "+ room.cyan + ': '.cyan + 'Poll has been voided.');
					return this.say(room, "Poll's results have been voided.");
				} else {
					if (this.RP[room].lastPollVoided) delete this.RP[room].lastPollVoided;
					var cheerio = require('cheerio'),
	    				$ = cheerio.load(spl[2]);
	    			var third = $('div div strong');
	    			var opts = [];
	    			var perRaw = [];
	    			var per = [];
	    			var winpercent = -1;
	    			var winopt = '';
	    			var title = '';
	    			var istie = false;
	    			var tieopts = [];
	    			third.each(function(i, elem) {
	  					opts.push($(this).text());
					});
					console.log(new Date().toString() + " "+ room.cyan + ': '.cyan + 'Poll opts: ' + opts.join(', '));
					var percentage = $('div div small');
					percentage.each(function(y, elem) {
						perRaw[y] = $(this).text();
					});
					$('div p strong').each(function(i, elem) {
						title = $(this).text();
					});
					for (var i = 0; i < perRaw.length; i++) {
						if (perRaw[i].indexOf('%') > -1) {
							per.push(Number(toId(perRaw[i])));
						}
					}
					for (var x = 0; x < per.length; x++) {
						if (!tieopts[0]) tieopts[0] = opts[x];
						if (per[x] > winpercent) {
							winpercent = per[x];
							winopt = opts[x];
							tieopts = [];
							tieopts[0] = opts[x];
							istie = false;
						}
						if (per[x] == winpercent) {
							istie = true;
							if(tieopts[0] == opts[x]) continue;
							else tieopts.push(opts[x]);
						}
					}
					if(toId(title).indexOf('endpoll') > -1) {
						var endvote = per[opts.indexOf('End')] ? per[opts.indexOf('End')] : per[opts.indexOf('end')];
						var contvote = per[opts.indexOf('Continue')] ? per[opts.indexOf('Continue')] : per[opts.indexOf('continue')];
						if (!contvote && per[opts.indexOf('cont')]) contvote = per[opts.indexOf('cont')];
						if (endvote > 54) {
							Parse.say(room, '**RP Ends with '+ endvote + '% end.**');
							console.log(new Date().toString() + " "+ room.cyan + ': '.cyan + /*splitDoc(*/this.RP[room].plot/*)*/ + ' ends with ' + endvote + '% end.');
							this.splitMessage('>' + room + '\n|c|~starbloom|' + config.commandcharacter + 'endrp');
						} else {
							Parse.say(room, '**RP Continues with '+ contvote + '% continue.**');
							console.log(new Date().toString() + " "+ room.cyan + ': '.cyan + /*splitDoc(*/this.RP[room].plot/*)*/ + ' continues with ' + contvote + '% continue.');
						}
					} else if (toId(title).indexOf('host') > -1){
						if (istie == true && tieopts.length > 1) {
							setTimeout(function(){
								Parse.say(room, '/poll create Tiebreaker Host Poll, ' + tieopts.join(', '));
								Parse.say(room, '/poll timer 3');
								console.log('/poll create Tiebreaker Host Poll, ' + tieopts.join(', '));
							}, 1000);
							setTimeout(function(){
								Parse.say(room, '!poll display');
							}, 60 * 1000 + 1000);
							setTimeout(function(){
								Parse.say(room, '!poll display');
							}, 2 * 60 * 1000 + 1000);
						} else {
							this.say(room, '**' + winopt + ' won with ' + winpercent + '%.**');
							console.log(new Date().toString() + " "+ room.cyan + ': '.cyan + winopt + ' won with ' + winpercent + '%.');
							this.splitMessage('>' + room + '\n|c|~starbloom|' + config.commandcharacter + 'sethost ' + winopt);
						}
					} else if (toId(title).indexOf('nextrp') > -1) {
						if (istie == true && tieopts.length > 1) {
							setTimeout(function(){
								Parse.say(room, '/poll create Tiebreaker Next RP Poll, ' + tieopts.join(', '));
								Parse.say(room, '/poll timer 3');
							}, 1000);
							setTimeout(function(){
								Parse.say(room, '!poll display');
							}, 60 * 1000 + 1000);
							setTimeout(function(){
								Parse.say(room, '!poll display');
							}, 2 * 60 * 1000 + 1000);
						} else {
							Parse.say(room, '**' + winopt + ' wins with ' + winpercent + '%.**');
							this.splitMessage('>' + room + '\n|c|~starbloom|' + config.commandcharacter + 'setrp ' + winopt);
							if (toId(winopt) == 'freeroam' || toId(winopt) == 'cruise' || toId(winopt) == 'prom') {
								this.splitMessage('>' + room + '\n|c|~starbloom|' + config.commandcharacter + 'start ' + winopt);
							} else {
								this.splitMessage('>' + room + '\n|c|~luxlucario|' + config.commandcharacter + 'nominators ' + winopt);
							}
						}
					}
				}
				break;
			default:
				if (config.readElse) {
					var oS = spl.toString();
					if (oS.substr(0, 9) === ",formats," || oS === ",queryresponse,rooms,null" || oS === "You are already blocking challenges!" || oS.substr(0, 4) === ",raw" || oS.substr(0, 18) === ",updatechallenges,") return false;
					console.log(oS);
			}
		}
	},
	chatMessage: function (message, by, room) {
		if (toId(by) === toId(config.nick)) return;
		var cmdrMessage = '["' + room + '|' + by + '|' + message + '"]';
		message = message.trim();
		if (room.charAt(0) === ',') {
			// auto accept invitations to rooms
			if (message.substr(0, 8) === '/invite ' && this.hasRank(by, '%@&~') && !(config.serverid === 'showdown' && toId(message.substr(8)) === 'lobby')) {
				this.say('', '/join ' + message.substr(8));
			}
			if (config.logpms) console.log(new Date().toString() + " Private Message from ".red + by.cyan + ": ".cyan + message);
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
			console.log(new Date().toString() + " " + room.cyan + ': '.cyan + sender + ': '.cyan + message);
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
		if (message.substr(0, config.commandcharacter.length) !== config.commandcharacter) return;

		message = message.substr(config.commandcharacter.length);
		var index = message.indexOf(' ');
		var arg = '';
		var cmd;
		if (index > -1) {
			cmd = message.substr(0, index);
			arg = message.substr(index + 1).trim();
		} else {
			cmd = message;
		}

		if (!!Commands[cmd]) {
			var failsafe = 0;
			while (typeof Commands[cmd] !== "function" && failsafe++ < 10) {
				cmd = Commands[cmd];
			}
			if (typeof Commands[cmd] === "function") {
				cmdr(cmdrMessage);
				Commands[cmd].call(this, arg, by, room);
			} else {
				error("invalid command type for " + cmd + ": " + (typeof Commands[cmd]));
			}
		}
	},
	say: function(room, text) {
		if (room.charAt(0) !== ',') {
			var str = (room !== 'lobby' ? room : '') + '|' + text;
		} else {
			room = room.substr(1);
			var str = '|/pm ' + room + ', ' + text;
		}
		send(str);
	},
	hasRank: function(user, rank) {
		var hasRank = (rank.split('').indexOf(user.charAt(0)) !== -1) || (config.excepts.indexOf(toId(user)) !== -1);
		return hasRank;
	},
	canUse: function(cmd, room, user) {
		var canUse = false;
		var ranks = ' +%@&#~';
		if (!this.settings[cmd] || !this.settings[cmd][room]) {
			canUse = this.hasRank(user, ranks.substr(ranks.indexOf((cmd === 'autoban' || cmd === 'banword') ? '#' : config.defaultrank)));
		} else if (this.settings[cmd][room] === true) {
			canUse = true;
		} else if (ranks.indexOf(this.settings[cmd][room]) > -1) {
			canUse = this.hasRank(user, ranks.substr(ranks.indexOf(this.settings[cmd][room])));
		}
		return canUse;
	},
	isBlacklisted: function(user, room) {
		var blacklistRegex = this.blacklistRegexes[room];
		return blacklistRegex && blacklistRegex.test(user);
	},
	blacklistUser: function(user, room) {
		var blacklist = this.settings.blacklist || (this.settings.blacklist = {});
		if (blacklist[room]) {
			if (blacklist[room][user]) return false;
		} else {
			blacklist[room] = {};
		}

		blacklist[room][user] = 1;
		this.updateBlacklistRegex(room);
		return true;
	},
	unblacklistUser: function(user, room) {
		var blacklist = this.settings.blacklist;
		if (!blacklist || !blacklist[room] || !blacklist[room][user]) return false;

		delete blacklist[room][user];
		if (Object.isEmpty(blacklist[room])) {
			delete blacklist[room];
			delete this.blacklistRegexes[room];
		} else {
			this.updateBlacklistRegex(room);
		}
		return true;
	},
	updateBlacklistRegex: function(room) {
		var blacklist = this.settings.blacklist[room];
		var buffer = [];
		for (var entry in blacklist) {
			if (entry.charAt(0) === '/' && entry.substr(-2) === '/i') {
				buffer.push(entry.slice(1, -2));
			} else {
				buffer.push('^' + entry + '$');
			}
		}
		this.blacklistRegexes[room] = new RegExp(buffer.join('|'), 'i');
	},
	uploadToHastebin: function(toUpload, callback) {
		var reqOpts = {
			hostname: "hastebin.com",
			method: "POST",
			path: '/documents'
		};

		var req = require('http').request(reqOpts, function(res) {
			res.on('data', function(chunk) {
				if (callback && typeof callback === "function") callback("hastebin.com/raw/" + JSON.parse(chunk.toString())['key']);
			});
		});

		req.write(toUpload);
		req.end();
	},
	processChatData: function(user, room, msg) {
		// NOTE: this is still in early stages
		if (toId(user) === toId(config.nick)) {
			this.ranks[room] = user.charAt(0);
			return;
		}
		user = toId(user);
		if (!user || room.charAt(0) === ',') return;

		msg = msg.trim().replace(/[ \u0000\u200B-\u200F]+/g, " "); // removes extra spaces and null characters so messages that should trigger stretching do so
		user = toId(user);
		this.updateSeen(user, 'c', room);
		var now = Date.now();
		if (!this.chatData[user]) this.chatData[user] = {
			zeroTol: 0,
			lastSeen: '',
			seenAt: now
		};
		var userData = this.chatData[user];

		if (!this.chatData[user][room]) this.chatData[user][room] = {
			times: [],
			points: 0,
			lastAction: 0
		};
		var roomData = userData[room];

		roomData.times.push(now);

		// this deals with punishing rulebreakers, but note that the bot can't think, so it might make mistakes
		if (config.allowmute && this.hasRank(this.ranks[room] || ' ', '%@&#~') && config.whitelist.indexOf(user) === -1) {
			var useDefault = !(this.settings.modding && this.settings.modding[room]);
			var pointVal = 0;
			var muteMessage = '';
			var modSettings = useDefault ? null : this.settings.modding[room];

			// moderation for banned words
			if ((useDefault || !this.settings.banword[room]) && pointVal < 2) {
				var bannedPhraseSettings = this.settings.bannedphrases;
				var bannedPhrases = !!bannedPhraseSettings ? (Object.keys(bannedPhraseSettings[room] || {})).concat(Object.keys(bannedPhraseSettings.global || {})) : [];
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
			var isFlooding = (timesLen >= FLOOD_MESSAGE_NUM && (now - times[timesLen - FLOOD_MESSAGE_NUM]) < FLOOD_MESSAGE_TIME
				&& (now - times[timesLen - FLOOD_MESSAGE_NUM]) > (FLOOD_PER_MSG_MIN * FLOOD_MESSAGE_NUM));
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
				if (config.privaterooms.indexOf(room) > -1 && cmd === 'warn') cmd = 'mute'; // can't warn in private rooms
				// if the bot has % and not @, it will default to hourmuting as its highest level of punishment instead of roombanning
				if (roomData.points >= 4 && !this.hasRank(this.ranks[room] || ' ', '@&#~')) cmd = 'hourmute';
				if (userData.zeroTol > 4) { // if zero tolerance users break a rule they get an instant roomban or hourmute
					muteMessage = ', Automated response: zero tolerance user';
					cmd = this.hasRank(this.ranks[room] || ' ', '@&#~') ? 'roomban' : 'hourmute';
				}
				if (roomData.points > 1) userData.zeroTol++; // getting muted or higher increases your zero tolerance level (warns do not)
				roomData.lastAction = now;
				this.say(room, '/' + cmd + ' ' + user + muteMessage);
			}
		}
	},
	cleanChatData: function() {
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

	updateSeen: function(user, type, detail) {
		if (type !== 'N' && config.rooms.indexOf(detail) === -1 || config.privaterooms.indexOf(toId(detail)) > -1) return;
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
			break;
		}
		msg += detail.trim() + '.';
		userData.lastSeen = msg;
		userData.seenAt = now;
	},
	getTimeAgo: function(time) {
		time = ~~((Date.now() - time) / 1000);

		var seconds = time % 60;
		var times = [];
		if (seconds) times.push(seconds + (seconds === 1 ? ' second': ' seconds'));
		if (time >= 60) {
			time = ~~((time - seconds) / 60);
			var minutes = time % 60;
			if (minutes) times.unshift(minutes + (minutes === 1 ? ' minute' : ' minutes'));
			if (time >= 60) {
				time = ~~((time - minutes) / 60);
				hours = time % 24;
				if (hours) times.unshift(hours + (hours === 1 ? ' hour' : ' hours'));
				if (time >= 24) {
					days = ~~((time - hours) / 24);
					if (days) times.unshift(days + (days === 1 ? ' day' : ' days'));
				}
			}
		}
		if (!times.length) return '0 seconds';
		return times.join(', ');
	},
	writeSettings: (function() {
		var writing = false;
		var writePending = false; // whether or not a new write is pending
		var finishWriting = function() {
			writing = false;
			if (writePending) {
				writePending = false;
				Parse.writeSettings();
			}
		};
		return function() {
			if (writing) {
				writePending = true;
				return;
			}
			writing = true;
			var data = JSON.stringify(this.settings);
			fs.writeFile('settings.json.0', data, function() {
				// rename is atomic on POSIX, but will throw an error on Windows
				fs.rename('settings.json.0', 'settings.json', function(err) {
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
	uncacheTree: function(root) {
		var uncache = [require.resolve(root)];
		do {
			var newuncache = [];
			for (var i = 0; i < uncache.length; ++i) {
				if (require.cache[uncache[i]]) {
					newuncache.push.apply(newuncache,
						require.cache[uncache[i]].children.map(function(module) {
							return module.filename;
						})
					);
					delete require.cache[uncache[i]];
				}
			}
			uncache = newuncache;
		} while (uncache.length > 0);
	}
};
