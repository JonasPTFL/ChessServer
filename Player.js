class Player{
    constructor(username, token){
        this.username = username;
        this.token = token;
    }

    setSocketId(socketId) {
        this.socketId = socketId;
    }
}

module.exports = Player;