var app = require('http').createServer(handler)
var io = require('socket.io')(app);

app.listen(8080);

function handler (req, res) {

    res.writeHead(200);
    res.end();

}

io.on('connection', function (socket) {
  console.log("new connection!!");
  socket.emit('regSuccess');
  socket.emit('regFail', {reason: "nameTaken"});
  socket.emit('nameSuggestion', {suggestedName: "John Smith"});
  socket.emit('m', {x: 1, y:1, t:1.54});
  socket.emit('sessionStart', {player2Name: "Derp"});
  socket.emit('sessionStop', {reason: "playerDisconnectted"});
  socket.emit('player2Unavailable');
});