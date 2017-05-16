var util = require('./lib/util');

var Dict = require('collections/dict');
var Deque = require('collections/deque');

var User = require('./lib/user');
var GameSession = require('./lib/gamesession');


var io = util.serverStart();

var users = Dict();
var gameQueue = Deque();

if(process.env.NODE_ENV === 'test'){
  const CONFIRMATION_WAIT_TIME = 500;
}else {
  const CONFIRMATION_WAIT_TIME = 60000;
}

const events = {
//registering
  setName:            'registerName', //ok
  setNameResp:        'setNameResp',
  getSuggestion:      'getSuggestion',
  getSuggestionResp:  'getSuggestionResp',
//finding oponent
  findPlayer2:        'findChallenge', //ok
  findPlayer2Resp:    'findChallengeResp', //ok
//accepting game invitation
  challengeRequest:   'challengeRequest', //ok
  challengeRequestResp:'challengeRequestResp',
//game session
  move:               'm',
  moveResp:           'mr',
  sessionStart:       'sessionStart', //ok
  sessionStop:        'sessionStop', //ok
//reset
  reset:              'reset'
};



io.on('connection', function (socket) {
  var user = new User(socket);
  var _acceptChallengeTimer = -1;


  socket.on(events.setName, (name) => {
    //check if we are in right state
    if(user.state !== User.STATES.unregistered){
      socket.emit(events.setNameResp, [false, 'SERVER_ERROR']);
      socket.emit(events.reset);
      user.reset();
      return;
    }
    //check if name is valid
    if(!util.validateName(name)){
      socket.emit(events.setNameResp, [false, 'NAME_INVALID']);
      return;
    }
    //check if name is taken
    if(users.has(name)) {
      socket.emit(events.setNameResp, [false, 'NAME_UNAVAILABLE']);
      return;
    }

    //add user to users list
    user.setName(name);
    users.add(user, name);
    socket.emit(events.setNameResp, [true]);
  });


  socket.on(events.findPlayer2, (name) => {

    //are we in right state?
    if(user.state !== User.STATES.idle){
      socket.emit(events.findPlayer2Resp, [false, 'SERVER_ERROR']);
      socket.emit(events.reset);
      user.reset();
      return;
    }


    //are we looking for specific player?
    if(typeof name !== 'undefined'){
      return; //TODO: implement
    }

    //if not find player in queue
    let user2 = undefined;
    while(gameQueue.length > 0){

      let maybeUser = gameQueue.pop();
      if(maybeUser.state === User.STATES.waitingForChallenge){
        user2 = maybeUser;
        break;
      }
    }

    //did we found player in queue?
    if(!user2){
      gameQueue.push(user);
      user.state = User.STATES.waitingForChallenge;
      return;
    }

    //if we did, then send confirmations
    user.state = User.STATES.waitingForAccept;
    user2.state = User.STATES.waitingForAccept;
    socket.to(user2.socket.id).emit(events.challengeRequest, user.name);
    socket.emit(events.challengeRequest, user2.name);

    //if there is no response to confirmation after
    //CONFIRMATION_WAIT_TIME seconds send PlayerUnresponsive
    _acceptChallengeTimer = setTimeout(() => {
      user2.state = User.STATES.idle;
      user.state = User.STATES.idle;
      socket.emit(events.findPlayer2Resp, [false, 'PlayerUnresponsive']);
      socket.to(user2.socket.id)
            .emit(events.findPlayer2Resp, [false, 'PlayerUnresponsive']);
    }, 3000);

  });


  socket.on(events.challengeRequestResp, (res) => {
    //check state
    if(user.state !== User.STATES.waitingForAccept){
      socket.emit(events.reset);
      user.reset();
      return;
    }
    //clear no response timeout
    clearTimeout(_acceptChallengeTimer);

    let oponent = res[1];
    //if player accepted request
    if(res[0] === true){
      user.state = User.STATES.inGame;
      //check if second user accepted
      user2 = users.get(oponent);
      //if second user did't accept jet do nothing
      if(user2.state !== User.STATES.inGame){
        return;
      }
      //if second user accepted then create game session
      var gameSession = new GameSession();
      gameSession.user1 = user;
      gameSession.user2 = user2;
      user2.gameSession = gameSession;
      user.gameSession = gameSession;
      gameSession.start();
    }else {
      //if player rejected request
      socket.to(users.get(oponent).socket.id)
            .emit(events.findPlayer2Resp, [false, 'Player2Rejects']);

      user.state = User.STATES.idle;
      users.get(oponent).state = User.STATES.idle;
    }

  });

  socket.on(events.sessionStop, () => {
      if(user.state !== User.STATES.inGame){
        socket.emit(events.reset);
        user.reset();
        return;
      }
      user.gameSession.leave(user);
  });

  socket.on('disconnect', () => {
      if(user.state !== User.STATES.unregistered){
        users.delete(user.name);
      }
      user.reset();
  });

  socket.on(events.move, (move) => {
    if(user.state !== User.STATES.inGame){
      socket.emit(events.reset);
      user.reset();
      return;
    }
    if(user.gameSession !== undefined){
      user.gameSession.move(user, move);
    }
  });

  socket.on(events.moveResp, (move) => {
    if(user.state !== User.STATES.inGame){
      socket.emit(events.reset);
      user.reset();
      return;
    }
    if(user.gameSession !== undefined){
      user.gameSession.moveResp(user, move);
    }
  });

  socket.on('reconnect', () => {
    socket.emit(events.reset);
    user.reset();
    user = new User(socket);
  });
});


module.exports.io = io;
module.exports.users = users;
module.exports.gameQueue = gameQueue;
module.exports.events = events;
