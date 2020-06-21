const express = require("express"),
	socketio = require("socket.io"),
	http = require("http"),
	cors = require("cors");

const PORT = process.env.PORT || 4000;

const app = express();
const server = http.createServer(app);
const io = socketio(server);

app.use(cors());
// lodash
var lodash = require("lodash");

app.disable("x-powered-by");

// turn on strict routing
app.enable("strict routing");

// use the X-Forwarded headers
app.enable("trust proxy");

//////////////////////////////////////////////////////////////////////////
// State                                                                //
//////////////////////////////////////////////////////////////////////////

var sessions = {};
var users = {};

// generate a random ID - 64 bits
function makeId() {
	var result = "";
	var hexChars = "0123456789abcdef";
	for (var i = 0; i < 6; i += 1) {
		result += hexChars[Math.floor(Math.random() * 16)];
	}
	return result;
}

//////////////////////////////////////////////////////////////////////////
// Web endpoints                                                        //
//////////////////////////////////////////////////////////////////////////

// health check
app.get("/", function (req, res) {
	res.setHeader("Content-Type", "text/plain");
	res.send("OK");
});

// number of sessions
app.get("/number-of-sessions", function (req, res) {
	res.setHeader("Content-Type", "text/plain");
	res.send(String(Object.keys(sessions).length));
});

// number of users
app.get("/number-of-users", function (req, res) {
	res.setHeader("Content-Type", "text/plain");
	res.send(String(Object.keys(users).length));
});

//////////////////////////////////////////////////////////////////////////
// Websockets API                                                       //
//////////////////////////////////////////////////////////////////////////

function validateId(id) {
	return true;
}

function validateLastKnownTime(lastKnownTime) {
	return true;
}

function validateTimestamp(timestamp) {
	return true;
}

function validateBoolean(boolean) {
	return true;
}

function validateMessages(messages) {
	return true;
}

function validateState(state) {
	return true;
}

function validateVideoId(videoId) {
	return true;
}

function validateMessageBody(body) {
	return true;
}

function padIntegerWithZeros(x, minWidth) {
	var numStr = String(x);
	while (numStr.length < minWidth) {
		numStr = "0" + numStr;
	}
	return numStr;
}

//a user connected, a user with userId is made
io.on("connection", function (socket) {
	var userId = makeId();
	while (users.hasOwnProperty(userId)) {
		userId = makeId();
	}
	users[userId] = {
		id: userId,
		sessionId: null,
		socket: socket,
		typing: false,
	};
	socket.emit("userId", userId);
	console.log("User " + userId + " connected.");

	// precondition: sessionId is the id of a session
	// precondition: notToThisUserId is the id of a user, or null
	var broadcastPresence = function (sessionId, notToThisUserId) {
		var anyoneTyping = false;
		for (var i = 0; i < sessions[sessionId].userIds.length; i += 1) {
			if (users[sessions[sessionId].userIds[i]].typing) {
				anyoneTyping = true;
				break;
			}
		}

		lodash.forEach(sessions[sessionId].userIds, function (id) {
			if (id !== notToThisUserId) {
				console.log("Sending presence to user " + id + ".");
				users[id].socket.emit("setPresence", {
					anyoneTyping: anyoneTyping,
				});
			}
		});
	};

	// precondition: user userId is in a session
	// precondition: body is a string
	// precondition: isSystemMessage is a boolean
	var sendMessage = function (body, isSystemMessage) {
		var message = {
			body: body,
			isSystemMessage: isSystemMessage,
			timestamp: new Date(),
			userId: userId,
		};
		sessions[users[userId].sessionId].messages.push(message);

		lodash.forEach(sessions[users[userId].sessionId].userIds, function (id) {
			console.log("Sending message to user " + id + ".");
			users[id].socket.emit("sendMessage", {
				body: message.body,
				isSystemMessage: isSystemMessage,
				timestamp: message.timestamp.getTime(),
				userId: message.userId,
			});
		});
	};

	// precondition: user userId is in a session
	var leaveSession = function (broadcast) {
		sendMessage("left", true);

		var sessionId = users[userId].sessionId;
		lodash.pull(sessions[sessionId].userIds, userId);
		users[userId].sessionId = null;

		if (sessions[sessionId].userIds.length === 0) {
			delete sessions[sessionId];
			console.log(
				"Session " + sessionId + " was deleted because there were no more users in it."
			);
		} else {
			if (broadcast) {
				broadcastPresence(sessionId, null);
			}
		}
	};

	socket.on("reboot", function (data, fn) {
		if (!users.hasOwnProperty(userId)) {
			fn({ errorMessage: "Disconnected." });
			console.log("The socket received a message after it was disconnected.");
			return;
		}

		if (users[userId].sessionId !== null) {
			leaveSession(false);
		}
		if (userId !== data.userId) {
			users[data.userId] = users[userId];
			delete users[userId];
			userId = data.userId;
		}

		if (sessions.hasOwnProperty(data.sessionId)) {
			sessions[data.sessionId].userIds.push(userId);
			users[userId].sessionId = data.sessionId;
			console.log(
				"User " +
					userId +
					" reconnected and rejoined session " +
					users[userId].sessionId +
					"."
			);
		} else {
			var session = {
				id: data.sessionId,
				lastKnownTime: data.lastKnownTime,
				lastKnownTimeUpdatedAt: new Date(data.lastKnownTimeUpdatedAt),
				messages: lodash.map(data.messages, function (message) {
					return {
						userId: message.userId,
						body: message.body,
						isSystemMessage: message.isSystemMessage,
						timestamp: new Date(message.timestamp),
					};
				}),
				ownerId: data.ownerId,
				state: data.state,
				videoId: data.videoId,
				userIds: [userId],
			};
			sessions[session.id] = session;
			users[userId].sessionId = data.sessionId;
			console.log(
				"User " +
					userId +
					" rebooted session " +
					users[userId].sessionId +
					" with video " +
					JSON.stringify(data.videoId) +
					", time " +
					JSON.stringify(data.lastKnownTime) +
					", and state " +
					data.state +
					" for epoch " +
					JSON.stringify(data.lastKnownTimeUpdatedAt) +
					"."
			);
		}

		broadcastPresence(data.sessionId, null);

		fn({
			lastKnownTime: sessions[data.sessionId].lastKnownTime,
			lastKnownTimeUpdatedAt: sessions[data.sessionId].lastKnownTimeUpdatedAt.getTime(),
			state: sessions[data.sessionId].state,
		});
	});

	socket.on("createSession", function (data, fn) {
		if (!users.hasOwnProperty(userId)) {
			fn({ errorMessage: "Disconnected." });
			console.log("The socket received a message after it was disconnected.");
			return;
		}

		var sessionId = makeId();
		while (sessions.hasOwnProperty(sessionId)) {
			sessionId = makeId();
		}
		var now = new Date();
		var session = {
			id: sessionId,
			lastKnownTime: 0,
			lastKnownTimeUpdatedAt: now,
			messages: [],
			ownerId: data.controlLock ? userId : null,
			state: "paused",
			userIds: [userId],
			videoId: data.videoId,
			currentTime: data.currentTime || 0,
		};
		users[userId].sessionId = sessionId;
		sessions[session.id] = session;

		fn({
			lastKnownTime: sessions[users[userId].sessionId].lastKnownTime,
			lastKnownTimeUpdatedAt: sessions[
				users[userId].sessionId
			].lastKnownTimeUpdatedAt.getTime(),
			messages: lodash.map(sessions[users[userId].sessionId].messages, function (
				message
			) {
				return {
					body: message.body,
					isSystemMessage: message.isSystemMessage,
					timestamp: message.timestamp.getTime(),
					userId: message.userId,
				};
			}),
			sessionId: users[userId].sessionId,
			state: sessions[users[userId].sessionId].state,
			currentTime: sessions[users[userId].sessionId].currentTime,
		});
		if (data.controlLock) {
			sendMessage("created the session with exclusive control", true);
		} else {
			sendMessage("created the session", true);
		}
		console.log(
			"User " +
				userId +
				" created session " +
				users[userId].sessionId +
				" with video " +
				JSON.stringify(data.videoId) +
				" and controlLock " +
				JSON.stringify(data.controlLock) +
				"."
		);
	});

	socket.on("joinSession", function (sessionId, fn) {
		if (!users.hasOwnProperty(userId)) {
			fn({ errorMessage: "Disconnected." });
			console.log("The socket received a message after it was disconnected.");
			return;
		}

		if (users[userId].sessionId !== null) {
			fn({ errorMessage: "Already in a session." });
			console.log(
				"User " +
					userId +
					" attempted to join session " +
					sessionId +
					", but the user is already in session " +
					users[userId].sessionId +
					"."
			);
			return;
		}

		users[userId].sessionId = sessionId;
		sessions[sessionId].userIds.push(userId);
		sendMessage("joined", true);

		fn({
			videoId: sessions[sessionId].videoId,
			lastKnownTime: sessions[sessionId].lastKnownTime,
			lastKnownTimeUpdatedAt: sessions[sessionId].lastKnownTimeUpdatedAt.getTime(),
			messages: lodash.map(sessions[sessionId].messages, function (message) {
				return {
					body: message.body,
					isSystemMessage: message.isSystemMessage,
					timestamp: message.timestamp.getTime(),
					userId: message.userId,
				};
			}),
			ownerId: sessions[sessionId].ownerId,
			state: sessions[sessionId].state,
			currentTime: sessions[sessionId].currentTime,
		});
		console.log("User " + userId + " joined session " + sessionId + ".");
	});

	socket.on("leaveSession", function (_, fn) {
		if (!users.hasOwnProperty(userId)) {
			fn({ errorMessage: "Disconnected." });
			console.log("The socket received a message after it was disconnected.");
			return;
		}

		if (users[userId].sessionId === null) {
			fn({ errorMessage: "Not in a session." });
			console.log(
				"User " + userId + " attempted to leave a session, but the user was not in one."
			);
			return;
		}

		var sessionId = users[userId].sessionId;
		leaveSession(true);

		fn(null);
		console.log("User " + userId + " left session " + sessionId + ".");
	});

	socket.on("updateSession", function (data, fn) {
		if (!users.hasOwnProperty(userId)) {
			fn({ errorMessage: "Disconnected." });
			console.log("The socket received a message after it was disconnected.");
			return;
		}

		if (users[userId].sessionId === null) {
			fn({ errorMessage: "Not in a session." });
			console.log(
				"User " + userId + " attempted to update a session, but the user was not in one."
			);
			return;
		}

		if (
			sessions[users[userId].sessionId].ownerId !== null &&
			sessions[users[userId].sessionId].ownerId !== userId
		) {
			fn({ errorMessage: "Session locked." });
			console.log(
				"User " +
					userId +
					" attempted to update session " +
					users[userId].sessionId +
					" but the session is locked by " +
					sessions[users[userId].sessionId].ownerId +
					"."
			);
			return;
		}

		var now = new Date().getTime();
		var oldPredictedTime =
			sessions[users[userId].sessionId].lastKnownTime +
			(sessions[users[userId].sessionId].state === "paused"
				? 0
				: now - sessions[users[userId].sessionId].lastKnownTimeUpdatedAt.getTime());
		var newPredictedTime =
			data.lastKnownTime +
			(data.state === "paused" ? 0 : now - data.lastKnownTimeUpdatedAt);

		var stateUpdated = sessions[users[userId].sessionId].state !== data.state;
		var timeUpdated = Math.abs(newPredictedTime - oldPredictedTime) > 2500;

		var hours = Math.floor(newPredictedTime / (1000 * 60 * 60));
		newPredictedTime -= hours * 1000 * 60 * 60;
		var minutes = Math.floor(newPredictedTime / (1000 * 60));
		newPredictedTime -= minutes * 1000 * 60;
		var seconds = Math.floor(newPredictedTime / 1000);
		newPredictedTime -= seconds * 1000;

		var timeStr;
		if (hours > 0) {
			timeStr =
				String(hours) + ":" + String(minutes) + ":" + padIntegerWithZeros(seconds, 2);
		} else {
			timeStr = String(minutes) + ":" + padIntegerWithZeros(seconds, 2);
		}

		sessions[users[userId].sessionId].lastKnownTime = data.lastKnownTime;
		sessions[users[userId].sessionId].lastKnownTimeUpdatedAt = new Date(
			data.lastKnownTimeUpdatedAt
		);
		sessions[users[userId].sessionId].state = data.state;
		sessions[users[userId].sessionId].currentTime = data.currentTime;

		if (stateUpdated && timeUpdated) {
			if (data.state === "playing") {
				sendMessage("started playing the video at " + timeStr, true);
			} else {
				sendMessage("paused the video at " + timeStr, true);
			}
		} else if (stateUpdated) {
			if (data.state === "playing") {
				sendMessage("started playing the video", true);
			} else {
				sendMessage("paused the video", true);
			}
		} else if (timeUpdated) {
			sendMessage("jumped to " + timeStr, true);
		}

		fn();
		console.log(
			"User " +
				userId +
				" updated session " +
				users[userId].sessionId +
				" with time " +
				JSON.stringify(data.lastKnownTime) +
				" and state " +
				data.state +
				" for epoch " +
				JSON.stringify(data.lastKnownTimeUpdatedAt) +
				"."
		);

		lodash.forEach(sessions[users[userId].sessionId].userIds, function (id) {
			if (id !== userId) {
				console.log("Sending update to user " + id + ".");
				users[id].socket.emit("update", {
					lastKnownTime: sessions[users[userId].sessionId].lastKnownTime,
					lastKnownTimeUpdatedAt: sessions[
						users[userId].sessionId
					].lastKnownTimeUpdatedAt.getTime(),
					state: sessions[users[userId].sessionId].state,
					currentTime: sessions[users[userId].sessionId].currentTime,
				});
			}
		});
	});

	socket.on("disconnect", function () {
		if (!users.hasOwnProperty(userId)) {
			console.log("The socket received a message after it was disconnected.");
			return;
		}

		if (users[userId].sessionId !== null) {
			leaveSession(true);
		}
		delete users[userId];
		console.log("User " + userId + " disconnected.");
	});
});

server.listen(PORT, () => {
	console.log(`Server has start on port ${PORT}`);
});
