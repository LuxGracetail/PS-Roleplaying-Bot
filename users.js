/**
 * This is where users are stored.
 *
 * New users are processed when joining new rooms and on receiving join
 * messages from the server. User chat data is processed here for use
 * in command permissions and automatic moderation.
 */

/* global Users: true */
var Users = Object.create(null);
var users = Users.users = Object.create(null);

var User = function (username, roomid) {
	this.name = username.substr(1);
	this.id = toId(this.name);
	this.rooms = new Map();
	if (roomid) this.rooms.set(roomid, username.charAt(0));
};

User.prototype.isExcepted = function () {
	return Config.excepts.indexOf(this.id) !== -1;
};

User.prototype.isWhitelisted = function () {
	return Config.whitelist.indexOf(this.id) !== -1;
};

User.prototype.isRegexWhitelisted = function () {
	return Config.regexautobanwhitelist.indexOf(this.id) !== -1;
};

User.prototype.hasRank = function (roomid, tarGroup) {
	if (this.isExcepted()) return true;
	var group = this.rooms.get(roomid) || roomid; // PM messages use the roomid parameter as the user's group
	return Config.groups[group] >= Config.groups[tarGroup];
};

User.prototype.canUse = function (cmd, roomid) {
	if (this.isExcepted()) return true;
	var settings = Parse.settings[cmd];
	if (!settings || !settings[roomid]) {
		return this.hasRank(roomid, (cmd === 'autoban' || cmd === 'blacklist') ? '#' : Config.defaultrank);
	}

	var setting = settings[roomid];
	if (setting === true) return true;
	return this.hasRank(roomid, setting);
};

User.prototype.rename = function (username) {
	var oldid = this.id;
	delete users[oldid];
	this.id = toId(username);
	this.name = username.substr(1);
	users[this.id] = this;
	return this;
};

User.prototype.destroy = function () {
	this.rooms.forEach(function (group, roomid) {
		var room = Rooms.get(roomid);
		room.users.delete(this.id);
	});
	this.rooms.clear();
	delete users[this.id];
};

var getUser = Users.get = function (username) {
	var userid = toId(username);
	return users[userid];
};

var addUser = Users.add = function (username, room) {
	var user = getUser(username);
	if (!user) {
		user = new User(username, room);
		users[user.id] = user;
	}
	return user;
};

var botId = ' ' + toId(Config.nick);
Users.self = getUser(botId) || addUser(botId);

module.exports = Users;
