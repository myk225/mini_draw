const express = require('express');
const http = require("http");
const {Server} =require("socket.io");

const app = express();
const server = http.createServer(app);

app.use(express.static('public'));

const io = new Server(server,{
    cors: {origin: '*'}
})

const rooms = {};

io.on('connection',(socket)=>{
    console.log('socket connected', socket.id);
    //join a room
    socket.on("join-room",({roomId,name})=>{
        socket.join(roomId);
        socket.data.name = name || 'anon';
        if (!roomId) {
            socket.emit('error', { message: 'join-room requires a valid roomId' });
            return;
          }
        // if(!rooms[roomId]) rooms[roomId]={user:{},strokes:[]};
         // ensure room exists BEFORE using it
      if (!rooms[roomId]) {
        rooms[roomId] = { users: {}, strokes: [] };
        console.log(`[room] created ${roomId}`);
      }
        console.log(rooms[roomId].users[socket.id])
        console.log(socket.data)
        rooms[roomId].users[socket.id] = socket.data.name;

        //notify room of new presence
        io.in(roomId).emit('presence',{users: Object.values(rooms[roomId].users)});

        //send existing strokes to the new socket to they catch up
        socket.emit('init-strokes', rooms[roomId].strokes);

        console.log(`${socket.data.name} joined ${roomId}`)

    })

    socket.on('stroke',({roomId,stroke})=>{
        if(!rooms[roomId]) return;
        // save stroke
        rooms[roomId].strokes.push(stroke);
            // broadcast to others in the room
        socket.to(roomId).emit('stroke',stroke)
    })
    socket.on('clear',({roomId})=>{
        console.log("clear clicked")
        if(!rooms[roomId]) return;
        rooms[roomId].stroke=[];
        io.in(roomId).emit('clear')
    })
    socket.on('get-presence',({roomId})=>{
        if(!rooms[roomId]) return socket.emit('presence',{users:[]});
        socket.emit('presence',{users: Object.values(rooms[roomId].users)});
    })
    socket.on('disconnect',()=>{
        console.log("socket disconneted", socket.id);
        for(const roomId of Object.keys(rooms)){
            if(rooms[roomId].users[socket.id]){
                delete rooms[roomId].users[socket.id];

                io.in(roomId).emit('presence',{users: Object.values(rooms[roomId].users)});
                // optionally delete room if empty
                if(Object.keys(rooms[roomId].users.length === 0)){
                    delete rooms[roomId];
                }
            }
        }
    })
})

const PORT = process.env.PORT || 4000;


server.listen(PORT, () => console.log(`Server listening on http://localhost:${PORT}`));

