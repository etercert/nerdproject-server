var io = require('socket.io-client');
var expect = require('expect')
var createSpy = expect.createSpy
var spyOn = expect.spyOn
var isSpy = expect.isSpy
var srv, client1, client2, client3;

var ioOptions = {
      transports: ['websocket']
    , forceNew: true
    , reconnection: false
}


var prepareServer = function(next) {
  delete require.cache[require.resolve('./server')];
  srv = require('./server');
  client1 = io("http://localhost:8080", ioOptions);
  client1.on('connect', () => {
    client2 = io("http://localhost:8080", ioOptions);
    client2.on('connect', () => {
      client3 = io("http://localhost:8080", ioOptions);
      client3.on('connect', () => {
        next();
      });
    });
  });
}

var stopServer = function(next) {
  client1.on('disconnect', () => {
    client2.on('disconnect', () => {
      client3.on('disconnect', () => {
        srv.users.clear();
        srv.gameQueue.clear();
        srv.io.close();
        srv = undefined;
        next();
      });
      client3.close();
    });
    client2.close();
  });
  client1.close();
}

describe('loading server', function () {
  beforeEach(function(done) {
    prepareServer(done);
  });


  afterEach(function (done) {
    stopServer(done);
  });


  it('accepts client connections', function(done) {
    expect(client1.id).toExist();
    done();
  });
});

describe('registering name to server', function() {

  beforeEach(function(done) {
    prepareServer(done)
  });

  afterEach(function (done) {
    stopServer(done);
  });

  it('registers name if not taken', function(done) {
    client1.on(srv.events.setNameResp, (res) => {
      expect(srv.users.has("johnSmith")).toBe(true);
      expect(res[0]).toBe(true);
      done();
    });
    client1.emit(srv.events.setName, 'johnSmith');
  });

  it('prevents second registration', function(done) {

    client1.on(srv.events.setNameResp, () => {
      client1.on(srv.events.setNameResp, (res) => {
        expect(res[0]).toBe(false);
        expect(res[1]).toBe('SERVER_ERROR');
        done();
      });
      client1.emit(srv.events.setName, "johnSmith2");
    });
    client1.emit(srv.events.setName, "johnSmith");
  });

  it('prevents registration of already registered name', function(done) {
    client2.on(srv.events.setNameResp, () => {
      client1.emit(srv.events.setName, "johnSmith");
      client1.on(srv.events.setNameResp, (res) => {
        expect(res[0]).toBe(false);
        expect(res[1]).toBe('NAME_UNAVAILABLE');
        done();
      });
    });
    client2.emit(srv.events.setName, "johnSmith");
  });
});

describe('finding random oponent', () => {

  beforeEach(function(done) {
    prepareServer(() => {
      client1.emit(srv.events.setName, 'client1');
      client1.on(srv.events.setNameResp, () => {

        client2.emit(srv.events.setName, 'client2');
        client2.on(srv.events.setNameResp, () => {
            done();
        });
      });
    });
  });

  afterEach(function (done) {
    stopServer(done);
  });

  it('forbids if user is not idle', (done) => {
    client3.on(srv.events.findPlayer2Resp, (res) => {
      expect(res[0]).toBe(false);
      expect(res[1]).toBe('SERVER_ERROR');
      done();
    });
    client3.emit(srv.events.findPlayer2);

  });

  it('adds user to queue if there are no oponents', (done) => {
    client1.emit(srv.events.findPlayer2);
    setTimeout(() => {
      expect(srv.gameQueue.length).toNotBe(0);
      done();
    }, 1000);
  });

  it('asks for acceptence if challenge is found', (done) => {
      client1.on(srv.events.challengeRequest, (oponent) => {
        expect(oponent).toBe('client2');
        done();
      });

      client2.on(srv.events.challengeRequest, (oponent) => {
        expect(oponent).toBe('client1');
      });

      client1.emit(srv.events.findPlayer2);
      client2.emit(srv.events.findPlayer2);
  });


  it('starts game session if both users accepted', (done) => {
      client1.on(srv.events.challengeRequest, (oponent) => {
        client1.emit(srv.events.challengeRequestResp, [true, oponent]);
      });

      client2.on(srv.events.challengeRequest, (oponent) => {
        client2.emit(srv.events.challengeRequestResp, [true, oponent]);
      });

      client2.on(srv.events.sessionStart, (oponent) => {
        expect(oponent).toBe('client1');
        done();
      })
      client1.emit(srv.events.findPlayer2);
      client2.emit(srv.events.findPlayer2);
  });

  it('sends findPlayer2Resp([false]) if any of users rejects', (done) => {
      client1.on(srv.events.challengeRequest, (oponent) => {
        client1.emit(srv.events.challengeRequestResp, [false, oponent]);
      });

      client2.on(srv.events.challengeRequest, (oponent) => {
        client2.emit(srv.events.challengeRequestResp, [true, oponent]);
      });

      client2.on(srv.events.findPlayer2Resp, (res) => {
        expect(res[0]).toBe(false);
        expect(res[1]).toBe('Player2Rejects');
        done();
      });
      client1.emit(srv.events.findPlayer2);
      client2.emit(srv.events.findPlayer2);
  });

  it('sends findChallengeFail if any of users fails to accept in x seconds',
    (done) => {
    client1.emit(srv.events.findPlayer2);
    client2.emit(srv.events.findPlayer2);
    client1.on(srv.events.challengeRequest, (oponent) => {
      client1.emit(srv.events.challageRequestResp,[true, oponent]);
    });

    client1.on(srv.events.findPlayer2Resp, (res) => {
      expect(res[0]).toBe(false);
      expect(res[1]).toBe('PlayerUnresponsive');
    });

    client2.on(srv.events.findPlayer2Resp, (res) => {
      expect(res[0]).toBe(false);
      expect(res[1]).toBe('PlayerUnresponsive');
      done();
    });

  });
});

describe('game session', () => {
  beforeEach((done) => {
    prepareServer(() => {
      client1.emit(srv.events.setName, 'client1');
      client1.on(srv.events.setNameResp, () => {

        client2.emit(srv.events.setName, 'client2');
        client2.on(srv.events.setNameResp, () => {
          client1.on(srv.events.challengeRequest, (oponent) => {
            client1.emit(srv.events.challengeRequestResp, [true,oponent]);
          });

          client2.on(srv.events.challengeRequest, (oponent) => {
            client2.emit(srv.events.challengeRequestResp, [true,oponent]);
          });

          client2.on(srv.events.sessionStart, (oponent) => {
            done();
          })
          client1.emit(srv.events.findPlayer2);
          client2.emit(srv.events.findPlayer2);
        });
      });
    })
  });

  afterEach((done) => {
    stopServer(done);
  });

  it('closes session when user leaves', (done) => {
      client2.on(srv.events.sessionStop, () => {
        expect(srv.users.get('client1').gameSession).toBe(undefined);
        done();
      });
      client1.emit(srv.events.sessionStop);
  });

  it('makes second user win when user leaves', (done) => {
    client2.on('win', (name) => {
      expect(name).toBe('client2');
      done();
    });
    client1.emit(srv.events.sessionStop);
  });

});
