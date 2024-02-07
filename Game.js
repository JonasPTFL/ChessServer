class Game {
    static GAME_ID_LENGTH = 10;

    constructor(hostPlayer) {
        this.id = this.generateGameId(8);
        if (this.getRandomBoolean()) {
            this.whitePlayer = hostPlayer.username;
            this.blackPlayer = null;
        } else {
            this.blackPlayer = hostPlayer.username;
            this.whitePlayer = null;
        }
    }

    addPlayer(player){
        if(this.whitePlayer == null) {
            this.whitePlayer = player.username;
        } else if (this.blackPlayer == null){
            this.blackPlayer = player.username;
        }
    }

    isGameFull(){
        return this.whitePlayer != null && this.blackPlayer != null;
    }

    // Function to generate a random string of characters
    generateGameId(length=GAME_ID_LENGTH) {
        const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        let gameId = '';
        for (let i = 0; i < length; i++) {
            gameId += characters.charAt(Math.floor(Math.random() * characters.length));
        }
        return gameId;
    }

    getRandomBoolean() {
        return Math.random() < 0.5;
    }
}

module.exports = Game;