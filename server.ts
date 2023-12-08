import session from "express-session";
import express from "express";
import http from "http";
import { v4 as uuid } from "uuid";

import { WebSocketServer } from "ws";

function onSocketError(err) {
  console.error(err);
}

const app = express();
const map = new Map();

const sessionParser = session({
  saveUninitialized: false,
  secret: "$eCuRiTy",
  resave: false,
});

// make the session have a userId
declare module "express-session" {
  interface SessionData {
    userId: string;
  }
}

// make the http request have a userId
declare module "http" {
  interface IncomingMessage {
    session: {
      userId: string;
    };
  }
}

app.use(express.static("public"));
app.use(sessionParser);
app.get("/", function (req, res) {
  res.send({ result: req.session.userId });
});

app.post("/login", function (req, res) {
  const id = uuid();

  console.log(`Updating session for user ${id}`);
  req.session.userId = id;
  res.send({ result: "OK", userId: id, message: "Session updated" });
});

const server = http.createServer(app);

const wss = new WebSocketServer({ clientTracking: false, noServer: true });

server.on("upgrade", function (request, socket, head) {
  socket.on("error", onSocketError);

  sessionParser(request, {}, () => {
    console.log("Parsing session from request...", request.session);
    if (!request.session.userId) {
      socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
      socket.destroy();
      return;
    }

    console.log("Session is parsed!");

    socket.removeListener("error", onSocketError);

    wss.handleUpgrade(request, socket, head, function (ws) {
      wss.emit("connection", ws, request);
    });
  });
});

wss.on("connection", function (ws, request) {
  const userId = request.session.userId;
  console.log(`User ${userId} connected`);
  ws.send(JSON.stringify({ message: `Hello user ${userId}` }));

  map.set(userId, ws);

  ws.on("error", console.error);

  ws.on("message", function (message) {
    console.log(`Received message ${message} from user ${userId}`);
  });

  ws.on("close", function () {
    map.delete(userId);
  });
});

server.listen(8080, function () {
  console.log("Listening on http://localhost:8080");
});
