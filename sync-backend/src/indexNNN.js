const express = require("express"),
  cors = require("cors");

const app = express();
var http = require("http").Server(app);
var io = require("socket.io")(http);
app.use(cors());

var lodash = require("lodash");
var sessions = {};
var users = {};

function makeId() {
  var result = "";
  var hexChars = "0123456789abcdef";
  for (var i = 0; i < 16; i += 1) {
    result += hexChars[Math.floor(Math.random() * 16)];
  }
  return result;
}

function padIntegerWithZeros(x, minWidth) {
  var numStr = String(x);
  while (numStr.length < minWidth) {
    numStr = "0" + numStr;
  }
  return numStr;
}

app.get("/", function(req, res) {
  res.setHeader("Content-Type", "text/plain");
  res.send("OK");
});

io.on("connection", function(socket) {
  var userId = makeId();
  while (users.hasOwnProperty(userId)) {
    userId = makeId();
  }
  users[userId] = {
    id: userId,
    sessionId: null,
    socket: socket
  };
  socket.emit("userId", userId);
  console.log("User " + userId + " connected.");

  var sendMessage = function(body, isSystemMessage) {
    var message = {
      body: body,
      isSystemMessage: isSystemMessage,
      timestamp: new Date(),
      userId: userId
    };
    sessions[users[userId].sessionId].messages.push(message);

    lodash.forEach(sessions[users[userId].sessionId].userIds, function(id) {
      console.log("Sending message to user " + id + ".");
      users[id].socket.emit("sendMessage", {
        body: message.body,
        isSystemMessage: isSystemMessage,
        timestamp: message.timestamp.getTime(),
        userId: message.userId
      });
    });
  };

  // precondition: user userId is in a session
  var leaveSession = function() {
    sendMessage("left", true);

    var sessionId = users[userId].sessionId;
    lodash.pull(sessions[sessionId].userIds, userId);
    users[userId].sessionId = null;

    if (sessions[sessionId].userIds.length === 0) {
      delete sessions[sessionId];
      console.log(
        "Session " +
          sessionId +
          " was deleted because there were no more users in it."
      );
      //   } else {
      //     if (broadcast) {
      //       broadcastPresence(sessionId, null);
      //     }
    }
  };
  //rerboot server
  socket.on("reboot", function(data, fn) {
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
        messages: lodash.map(data.messages, function(message) {
          return {
            userId: message.userId,
            body: message.body,
            isSystemMessage: message.isSystemMessage,
            timestamp: new Date(message.timestamp)
          };
        }),
        ownerId: data.ownerId,
        state: data.state,
        videoId: data.videoId,
        userIds: [userId]
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

    fn({
      lastKnownTime: sessions[data.sessionId].lastKnownTime,
      lastKnownTimeUpdatedAt: sessions[
        data.sessionId
      ].lastKnownTimeUpdatedAt.getTime(),
      state: sessions[data.sessionId].state
    });
  });

  socket.on("createSession", function(data, fn) {
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
      videoId: data.videoId
    };
    users[userId].sessionId = sessionId;
    sessions[session.id] = session;

    fn({
      lastKnownTime: sessions[users[userId].sessionId].lastKnownTime,
      lastKnownTimeUpdatedAt: sessions[
        users[userId].sessionId
      ].lastKnownTimeUpdatedAt.getTime(),
      messages: lodash.map(sessions[users[userId].sessionId].messages, function(
        message
      ) {
        return {
          body: message.body,
          isSystemMessage: message.isSystemMessage,
          timestamp: message.timestamp.getTime(),
          userId: message.userId
        };
      }),
      sessionId: users[userId].sessionId,
      state: sessions[users[userId].sessionId].state
    });
    console.log(
      "User " +
        userId +
        " created session " +
        users[userId].sessionId +
        " with video " +
        JSON.stringify(data.videoId)
    );
  });

  socket.on("joinSession", function(sessionId, fn) {
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
      lastKnownTimeUpdatedAt: sessions[
        sessionId
      ].lastKnownTimeUpdatedAt.getTime(),
      messages: lodash.map(sessions[sessionId].messages, function(message) {
        return {
          body: message.body,
          isSystemMessage: message.isSystemMessage,
          timestamp: message.timestamp.getTime(),
          userId: message.userId
        };
      }),
      ownerId: sessions[sessionId].ownerId,
      state: sessions[sessionId].state
    });
    console.log("User " + userId + " joined session " + sessionId + ".");
  });

  socket.on("leaveSession", function(_, fn) {
    if (!users.hasOwnProperty(userId)) {
      fn({ errorMessage: "Disconnected." });
      console.log("The socket received a message after it was disconnected.");
      return;
    }

    if (users[userId].sessionId === null) {
      fn({ errorMessage: "Not in a session." });
      console.log(
        "User " +
          userId +
          " attempted to leave a session, but the user was not in one."
      );
      return;
    }

    var sessionId = users[userId].sessionId;
    leaveSession(true);

    fn(null);
    console.log("User " + userId + " left session " + sessionId + ".");
  });

  socket.on("updateSession", function(data, fn) {
    if (!users.hasOwnProperty(userId)) {
      fn({ errorMessage: "Disconnected." });
      console.log("The socket received a message after it was disconnected.");
      return;
    }

    if (users[userId].sessionId === null) {
      fn({ errorMessage: "Not in a session." });
      console.log(
        "User " +
          userId +
          " attempted to update a session, but the user was not in one."
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
        : now -
          sessions[users[userId].sessionId].lastKnownTimeUpdatedAt.getTime());
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
        String(hours) +
        ":" +
        String(minutes) +
        ":" +
        padIntegerWithZeros(seconds, 2);
    } else {
      timeStr = String(minutes) + ":" + padIntegerWithZeros(seconds, 2);
    }

    sessions[users[userId].sessionId].lastKnownTime = data.lastKnownTime;
    sessions[users[userId].sessionId].lastKnownTimeUpdatedAt = new Date(
      data.lastKnownTimeUpdatedAt
    );
    sessions[users[userId].sessionId].state = data.state;

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

    lodash.forEach(sessions[users[userId].sessionId].userIds, function(id) {
      if (id !== userId) {
        console.log("Sending update to user " + id + ".");
        users[id].socket.emit("update", {
          lastKnownTime: sessions[users[userId].sessionId].lastKnownTime,
          lastKnownTimeUpdatedAt: sessions[
            users[userId].sessionId
          ].lastKnownTimeUpdatedAt.getTime(),
          state: sessions[users[userId].sessionId].state
        });
      }
    });
  });

  socket.on("sendMessage", function(data, fn) {
    if (!users.hasOwnProperty(userId)) {
      fn({ errorMessage: "Disconnected." });
      console.log("The socket received a message after it was disconnected.");
      return;
    }

    if (users[userId].sessionId === null) {
      fn({ errorMessage: "Not in a session." });
      console.log(
        "User " +
          userId +
          " attempted to send a message, but the user was not in a session."
      );
      return;
    }

    sendMessage(data.body, false);

    fn();
    console.log("User " + userId + " sent message " + data.body + ".");
  });

  socket.on("getServerTime", function(data, fn) {
    if (!users.hasOwnProperty(userId)) {
      fn({ errorMessage: "Disconnected." });
      console.log("The socket received a message after it was disconnected.");
      return;
    }

    fn(new Date().getTime());
    if (
      typeof data === "object" &&
      data !== null &&
      typeof data.version === "string"
    ) {
      console.log(
        "User " + userId + " pinged with version " + data.version + "."
      );
    } else {
      console.log("User " + userId + " pinged.");
    }
  });

  socket.on("disconnect", function() {
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

var server = http.listen(process.env.PORT || 3000, function() {
  console.log("Listening on port %d.", server.address().port);
});
