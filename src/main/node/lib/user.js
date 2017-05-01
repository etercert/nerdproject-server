util = require('util');

const STATES = {
  unregistered:           0,
  idle:                   1,
  waitingForAccept:       3,
  waitingForChallenge:    4,
  inGame:                 5
}


class User {
  constructor(socketid) {
    this.name = undefined;
    this.socket = socketid;
    this.state = STATES.unregistered;
    this.gameSession = undefined;
  }

  setName(name) {
    this.name = name;
    this.state = STATES.idle;
  }

  static get STATES() {
    return STATES;
  }

  reset() {
    if(this.gameSession !== undefined){
      this.gameSession.leave(this);
    }
    this.name = undefined;
    this.state = STATES.unregistered;
  }

}


module.exports = User;
