const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const socketioJwt = require('socketio-jwt');
const bodyParser = require('body-parser');
const jwt = require('jsonwebtoken');


const Player = require('./Player');
const Game = require('./Game');

const app = express();
app.use(bodyParser.json());
const server = http.createServer(app);
const io = socketIo(server);

const secretKey = 'SECRET_JP_CHESS';

const disconnectedPlayers = {};
const players = {};
const games = {};


io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  if(token !== undefined) {
    jwt.verify(token, secretKey, (err, decoded) => {
      if (err) {
        console.log("authenticated failed");
        next(new Error("failed to authenticate"));
      } else {
        const player = disconnectedPlayers[decoded.username];
        player.setSocketId(socket.id);
        players[decoded.username] = player;
        delete disconnectedPlayers[decoded.username];
        console.log("authenticated: "+player.username + ", "+ player.socketId + ", "+ player.token);
        next();
      }
    });
  } else {
    console.log("authenticated failed");
    next(new Error("invalid authentication"));
  }
});

// Event listener for when a client connects
io.on('connection', function(socket) {
  console.log('A client connected');

  // Event listener for when a client disconnects
  socket.on('disconnect', function() {
    console.log('A client disconnected');
  });
});

// POST endpoint to create a game
app.post('/create-game', authMiddleware, (req, res) => {
  const player = getPlayerFromRequest(req);
  const game = new Game(player);
  games[game.id] = { key: game };

  console.log("game created: "+game.id);
  // Respond with the created game ID
  res.status(201).json({ game });
});

// POST endpoint to create a game
app.post('/join-game', authMiddleware, (req, res) => {
  const game = games[req.body.gameID];
  const player = getPlayerFromRequest(req);
  game.addPlayer(player);
  
  console.log("game joined: "+game.id);
  // Respond with the created game ID
  res.status(200).json({ game });
});

// POST endpoint to create a game
app.post('/login', (req, res) => {
  const token = authenticate(req.body.username, req.body.password)
  disconnectedPlayers[req.body.username] = new Player(req.body.username, token);
  res.status(200).json({ token });
});

const port = process.env.PORT || 3000;
server.listen(port, () => {
    console.log(`Server running on port ${port}`);
});

function authenticate(username, password){
  const payload = {
      username: username,
      password: password
  };

  const options = {
      expiresIn: '1h'
  };

  return jwt.sign(payload, secretKey, options);
}

function getPlayerFromRequest(req){
  return players[req.user.username];
}

function getToken(req){
  return req.headers.authorization.split(' ')[1];
}

function authMiddleware(req, res, next) {
  const token = getToken(req);

  if (!token) {
      return res.status(401).json({ message: 'No token provided' });
  }

  // Verify the token
  jwt.verify(token, secretKey, (err, decoded) => {
      if (err) {
        console.log("auth middleware jwt verify error: "+err);
        return res.status(403).json({ message: 'Failed to authenticate token' });
      }
      // Store decoded token data in the request object
      req.user = decoded;
      next();
  });
}
