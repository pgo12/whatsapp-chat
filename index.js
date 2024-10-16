const express = require("express");
const app = express();
const http = require("http");
const { Server } = require("socket.io");
const server = http.createServer(app);
const io = new Server(server);
const path = require("path");

app.use(express.static(path.resolve("./public")));

app.get("/", (req, res) => {
  res.sendFile(path.resolve("./public/index.html"));
});

const users = []; // Array to hold connected users

io.on("connection", (socket) => {
  console.log("A user connected");

  // Notify others when a new user joins
  socket.on("new-user", (username) => {
    socket.username = username;
    users.push({ username, socketId: socket.id, online: true }); // Store socket ID
    socket.broadcast.emit("message", {
      text: `${username} joined the chat`,
      type: "notification",
      timestamp: new Date().toLocaleTimeString(),
    });
    io.emit("user-list", users); // Emit updated user list
  });

  // Handle user messages (text and images)
  socket.on("user-message", (message) => {
    const msg = {
      username: socket.username,
      timestamp: new Date().toLocaleTimeString(),
    };

    // Handle image message
    if (message.type === "image") {
      msg.type = "image"; // Specify the type
      msg.image = message.image; // Attach the image data
    } else {
      // Handle text message
      msg.type = "text"; // Specify the type
      msg.text = message.text;
    }

    io.emit("message", msg);
    console.log(
      `[${msg.timestamp}] ${msg.username}: ${
        msg.type === "image" ? "Sent an image" : msg.text
      }`
    );
  });

  // Handle private messages
  socket.on("private-message", ({ text, to }) => {
    const msg = {
      text: text,
      username: socket.username,
      timestamp: new Date().toLocaleTimeString(),
    };
    io.to(to).emit("private-message", msg); // Emit to the specific user
  });

  socket.on("unsend-message", ({ timestamp }) => {
    // Broadcast to all clients to remove the message with the matching timestamp
    io.emit("remove-message", timestamp);
  });

  // Typing indicator
  socket.on("typing", (data) => {
    socket.broadcast.emit("typing", { username: socket.username });
  });

  socket.on("stop-typing", () => {
    socket.broadcast.emit("stop-typing");
  });

  // Notify when a user disconnects
  socket.on("disconnect", () => {
    if (socket.username) {
      users.forEach((user, index) => {
        if (user.username === socket.username) {
          users.splice(index, 1); // Remove user from the list
        }
      });
      io.emit("message", {
        text: `${socket.username} left the chat`,
        type: "notification",
        timestamp: new Date().toLocaleTimeString(),
      });
      io.emit("user-list", users); // Emit updated user list
    }
  });
});

server.listen(3000, () => {
  console.log("listening on *:3000");
});
