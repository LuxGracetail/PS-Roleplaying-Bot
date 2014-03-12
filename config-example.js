// The WEBSOCKET server and port the bot should connect to.
// Most of the time this isn't the same as the URL, check the `Request URL` of
// the websocket.
// If you really don't know how to do this... Run `node getserver.js URL`.
// Fill in the URL of the client where `URL` is.
// For example: `node getserver.js http://example-server.psim.us/`
exports.server = 'sim.psim.us';
exports.port = 8000;

// This is the server id.
// To know this one, you should check where the AJAX call 'goes' to when you
// log in.
// For example, on the Smogon server, it will say somewhere in the URL
// ~~showdown, meaning that the server id is 'showdown'.
// If you really don't know how to check this... run the said script above.
exports.serverid = 'showdown';

// The nick and password to log in with
// If no password is required, leave pass empty
exports.nick = 'Example bot nick';
exports.pass = '';

// The rooms that should be joined.
// Joining Smogon's Showdown's Lobby is not allowed.
exports.rooms = ['example room name', 'another example'];

// The character text should start with to be seen as a command.
// Note that using / and ! might be 'dangerous' since these are used in
// Showdown itself.
// Using only alphanumeric characters and spaces is not allowed.
exports.commandcharacter = '.';

// Whether this file should be watched for changes or not.
// If you change this option, the server has to be restarted in order for it to
// take effect.
exports.watchconfig = false;

// Secondary websocket protocols should be defined here, however, Showdown
// doesn't support that yet, so it's best to leave this empty.
exports.secprotocols = [];

// What should be logged?
// 0 = error, ok, info, debug, recv, send
// 1 = error, ok, info, debug (recommended for development)
// 2 = error, ok, info (recommended for production)
// 3 = error, ok
// 4 = error
exports.debuglevel = 2;

// Users who can use all commands regardless of their rank. Be very cautious
// with this, especially on servers other than main.
exports.excepts = [];

// This controls which rooms the buzzer is enabled or disabled in by default.
// Set rooms to true to allow the buzzer by default or false to disallow.
exports.buzz = {};

// This allows the bot to act as an automated moderator. If enabled, the bot will
// mute users who send 6 lines or more in 6 or fewer seconds for 7 minutes. NOTE: THIS IS
// BY NO MEANS A PERFECT MODERATOR OR SCRIPT. It is a bot and so cannot think for itself or
// exercise moderator descretion. In addition, it currently uses a very simple method of 
// determining who to mute and so may miss people who should be muted, or mute those who 
// shouldn't. Use with caution.
exports.allowmute = false;
