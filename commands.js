/**
 * This is the file where the bot commands are located
 *
 * @license MIT license
 */

var http = require('http');
var sys = require('sys');

exports.commands = {
	/**
	 * It is recommended that you keep the following functions
	 */
	about: function(arg, by, room, con) {
		var text = '**Pokémon Showdown Bot** by: Quinella';
		this.say(con, room, text);
	},
	reload: function(arg, by) {
		if (!this.hasRank(by, '#~')) return false;
		try {
			this.uncacheTree('./commands.js');
			Commands = require('./commands.js').commands;
		} catch (e) {
			error('failed to reload: ' + sys.inspect(e));
		}
	},

	/**
	 * Example commands below.
	 * Feel free to remove them and add your own.
	 */
	tell: 'say',
	say: function(arg, by, room, con) {
		if (!this.hasRank(by, '+%@&#~')) return false;
		this.say(con, room, arg + ' (' + by + ' said this)');
	},

	joke: function(arg, by, room, con) {
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
	}
};