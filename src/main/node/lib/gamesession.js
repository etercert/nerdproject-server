var User = require('./user');
var Dict = require('collections/dict');


class GameSession {
  constructor() {
    this.user1 = undefined;
    this.user2 = undefined;
    this.user1Score = 0;
    this.user2Score = 0;
    this.attacker = undefined;
  }

  start() {
    let user1 = this.user1;
    let user2 = this.user2;
    user1.socket.emit('sessionStart', user2.name);
    user2.socket.emit('sessionStart', user1.name);
    user1.socket.emit('turn', user1.name);
    user2.socket.emit('turn', user1.name);
    this.attacker = user1;
  }

  getDefender() {
    let user1 = this.user1;
    let user2 = this.user2;
    if(user1 === this.attacker){
      return user2;
    }else{
      return user1;
    }
  }

  getAttacker() {
    return this.attacker;
  }

  sendScoreUpdate() {
    this.user1.socket.emit('scoreUpdate', [this.user1Score, this.user2Score]);
    this.user2.socket.emit('scoreUpdate', [this.user2Score, this.user1Score]);
  }
  move(user, move) {
    if(user === this.attacker){
      this.getDefender().socket.emit('m', move);
    }else {
      this.user2Score++;
      this.user1Score++;
      this.sendScoreUpdate();
      let def = this.getDefender();
      def.socket.emit('turn', def.name);
      this.attacker.socket.emit('turn', def.name);
      this.attacker = def;
    }
  }

  leave(user) {
    let user2;
    if(user === this.user1){
        user2 = this.user2;
    }else {
      user2 = this.user1;
    }
    this.win(user2);
    this.stop();
  }

  win(user) {
    this.user1.socket.emit('win', user.name);
    this.user2.socket.emit('win', user.name);
  }

  reload() {

  }

  stop() {
    this.user1.state = User.STATES.idle;
    this.user2.state = User.STATES.idle;
    this.user1.gameSession = undefined;
    this.user2.gameSession = undefined;
    this.user1.socket.emit('sessionStop');
    this.user2.socket.emit('sessionStop');
  }
}

module.exports = GameSession;
