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

const disconnectedPlayers = new Map();
const players = new Map();
const games = new Map();

const event_game_state = "game_state";
const event_move = "move";
const event_opponent_move = "opponent_move";
const game_state_white_turn = "white_turn";
const game_state_black_turn = "black_turn";


io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  if(token !== undefined) {
    jwt.verify(token, secretKey, (err, decoded) => {
      if (err) {
        console.log("authenticated failed");
        next(new Error("failed to authenticate"));
      } else {
        const player = disconnectedPlayers.get(decoded.username);
        if (player == undefined) {
          console.log("user '"+decoded.username+"' is not logged in, please log in first");
          next(new Error("failed to authenticate"));
        } else {
          player.setSocketId(socket.id);
          players.set(decoded.username, player);
          disconnectedPlayers.delete(decoded.username);
          console.log("authenticated: "+player.username + ", "+ player.socketId + ", "+ player.token);
          next();
        }
      }
    });
  } else {
    console.log("authenticated failed");
    next(new Error("invalid authentication"));
  }
});

// Event listener for when a client connects
io.on('connection', function(socket) {
  console.log('a client connected');

  socket.on(event_move, (data) => {
    const player = getPlayerFromSocketId(socket.id);
    console.log('game action received: '+data);
    
    const game = Array.from(games.values()).find(game => game.containsPlayer(player.username));
    if(game == undefined) {
      console.log("game for move "+data+" by player "+player.username+" not found");
    } else {
      if(game.isWhitePlayer(player.username) && game.isWhiteTurn()){
        sendToUsername(game.blackPlayer, event_opponent_move, data);
        sendToGamePlayers(game, event_game_state, game_state_black_turn);
      } else if (game.isBlackPlayer(player.username) && !game.isWhiteTurn()) {
        sendToUsername(game.whitePlayer, event_opponent_move, data);
        sendToGamePlayers(game, event_game_state, game_state_white_turn);
      }
      game.changeTurn();
    }
  });

  // Event listener for when a client disconnects
  socket.on('disconnect', function() {
    console.log('a client disconnected');
    const player = getPlayerFromSocketId(socket.id);
    leavePreviousGames(player)
  });
});

// POST endpoint to create a game
app.post('/create-game', authMiddleware, (req, res) => {
  const player = getPlayerFromRequest(req);
  leavePreviousGames(player);

  const game = new Game(player);
  games.set(game.id, game);

  console.log("game created: "+game.id);
  // Respond with the created game ID
  res.status(201).json(game);
});


// POST endpoint to create a game
app.get('/games', authMiddleware, (req, res) => {
  const valuesArray = Array.from(games.values());
  res.json(valuesArray);
});

// POST endpoint to create a game
app.post('/join-game', authMiddleware, (req, res) => {
  const player = getPlayerFromRequest(req);
  leavePreviousGames(player);
  const game = games.get(req.body.gameId);
  if(game == undefined || game == null) {
    res.status(400).json("Game not found");
  } else {
    game.addPlayer(player);
    games.set(req.body.gameID, game);

    console.log("game joined: "+game.id);
    if(game.isFull()){
      game.start();
      console.log("Game started: "+game.id);
      
      sendToGamePlayers(game, event_game_state, game_state_white_turn);
      
    }
    // Respond with the created game ID
    res.status(200).json(game);
  }
});

// POST endpoint to create a game
app.post('/login', (req, res) => {
  const username = req.body.username;
  // check if username already exsists
  if(Array.from(players.values()).some(player => player.username == username)){
    res.status(400).json("Username already exsists")
  } else {
    const token = authenticate(username, req.body.password)
    disconnectedPlayers.set(username, new Player(username, token));
    res.status(200).json({ token });
  }
});

const port = process.env.PORT || 3000;
server.listen(port, () => {
    console.log(`Server running on port ${port}`);
});

function authenticate(username, password) {
  const payload = {
      username: username,
      password: password
  };

  const options = {
      expiresIn: '1h'
  };

  return jwt.sign(payload, secretKey, options);
}

// removes given player from current games and deletes games, that are empty after the player left
function leavePreviousGames(player) {
  const currentGames = Array.from(games.values()).filter(game => game.containsPlayer(player.username));
  
  currentGames.forEach(game => {
    game.removePlayer(player);
    if(game.isEmpty()){
      games.delete(game.id);
    } else {
      games.set(game.id, game);
    }
  });
}

function sendToGamePlayers(game, event, data){
  io.to(players.get(game.whitePlayer).socketId).emit(event, data);
  io.to(players.get(game.blackPlayer).socketId).emit(event, data);
}

function sendToUsername(username, event, data){
  io.to(players.get(username).socketId).emit(event, data);
}

function getPlayerFromRequest(req){
  return players.get(req.user.username);
}

function getPlayerFromSocketId(socketId){
  return Array.from(players.values()).find(player => player.socketId == socketId);
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
