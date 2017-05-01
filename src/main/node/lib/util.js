var IO = require('socket.io');
var http = require('http');

let validateName = function(name, users) {
  return true;
}

var getPortnAddres = function() {
  if(process.env.NODE_ENV === 'test'){
    return ['127.0.0.1', 8080];
  }
  //  Set the environment variables we need.
  ipaddress = process.env.OPENSHIFT_NODEJS_IP;
  port      = process.env.OPENSHIFT_NODEJS_PORT || 8080;

  if (typeof ipaddress === 'undefined') {
      //  Log errors on OpenShift but continue w/ 127.0.0.1 - this
      //  allows us to run/test the app locally.
      console.warn('No OPENSHIFT_NODEJS_IP var, using 127.0.0.1');
      ipaddress = '127.0.0.1';
  };

  return [ipaddress, port];
};

var terminator = function(sig){
  if (typeof sig === 'string') {
     console.log('%s: Received %s - terminating sample app ...',
                 Date(Date.now()), sig);
     process.exit(1);
  }
  console.log('%s: Node server stopped.', Date(Date.now()) );
};


/**
 *  Setup termination handlers (for exit and a list of signals).
 */
var setupTerminationHandlers = function(){
  if(process.env.NODE_ENV === 'test'){
    return;
  }

  //  Process on exit and signals.
  process.on('exit', function() { terminator(); });

  // Removed 'SIGPIPE' from the list - bugz 852598.
  ['SIGHUP', 'SIGINT', 'SIGQUIT', 'SIGILL', 'SIGTRAP', 'SIGABRT',
   'SIGBUS', 'SIGFPE', 'SIGUSR1', 'SIGSEGV', 'SIGUSR2', 'SIGTERM'
  ].forEach(function(element, index, array) {
      process.on(element, function() { terminator(element); });
  });
};

var serverStart = function() {
  [addr, port] = getPortnAddres();
  setupTerminationHandlers();
  if(process.env.NODE_ENV === 'test'){
      var server = http.createServer().listen(port, addr)
  }else {
  var server = http.createServer().listen(port, addr, function() {
      console.log('%s: HTTP server started, listening on %s:%d ...',
                  Date(Date.now()),
                  server.address().address,
                  server.address().port);
  });
  }
  var io = new IO(server, {serveClient: false});

  return io;
}

module.exports.validateName = validateName;
module.exports.serverStart = serverStart;
