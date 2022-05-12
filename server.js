/*const express = require('express');
const app = express();
const http = require('http').Server(app);
const io = require('socket.io')(http); */

const express = require("express");
const app = express();
const server = require("http").Server(app);
const io = require("socket.io")(server);
const bodyParser = require("body-parser");
const path = require("path");
const nodemailer = require("nodemailer");
const ejs = require("ejs");
const $ = require("jquery");
const unsplash = require("unsplash-js").default;

const fetch = require("node-fetch");
global.fetch = fetch;

server.listen(process.env.PORT);

app.set("views", path.resolve(__dirname, "views"));
app.set("view engine", "ejs");
app.use(bodyParser.urlencoded({ extended: false }));

const users = {};
const userMsg = [];
let checkFunctionCall = 0;
let name_of_session;
let brief_session;
let time;
let emailList;
let fullUrl;

app.use(express.static("public"));
/*
app.get("/", function(request, response) {
  response.sendFile(__dirname + "/views/index.html");
}); */
app.get("/", function(req, res) {
  res.render("home");
});

app.get("/session", function(req, res) {
  res.render("session", {
    session_name: name_of_session,
    session_brief: brief_session
  });
});

app.post("/loading", function(req, res) {
  time = req.body.session_time;
  emailList = req.body.email_list.replace(/\r\n/g, "\n").split("\n");

  res.render("loading", {
    session_name: req.body.session_name,
    session_brief: req.body.session_brief
  });
});

app.post("/session", function(req, res) {
  fullUrl = req.protocol + "://" + req.get("host") + req.originalUrl;
  res.render("session", {
    session_name: req.body.session_name,
    session_brief: req.body.session_brief
  });

  sendMail(emailList);
  console.log("Email sendt");
});

app.get("/sd", function(req, res) {
  console.log("Shutter djoown");
  process.exit(1);
});

app.post("/end-page", function(req, res) {
  res.render("end-page", {
    name_of_session: name_of_session,
    arr: userMsg
  });
});

io.on("connection", socket => {
  socket.on("new-user", name => {
    users[socket.id] = name;
    socket.broadcast.emit("user-connected", name);
    let brukere = Object.values(users);
    io.emit("ny-bruker", brukere);
  });

  socket.on("start-session", message => {
    let a = parseInt(time);
    io.emit("start-the-clock", a);
  });

  socket.on("send-chat-message", message => {
    let temp = users[socket.id];
    let target = findTarget(temp);

    io.emit("sent_message", temp);
    console.log("Dette er nå target " + target);
    //console.log(target);

    let tempObj = {
      msg: "",
      usr: ""
    };
    //Explanation of function further down
    updateOrCreate(tempObj, target, message);

    console.log(userMsg);

    //Variable storing true or false based on check in function
    let check = checkNumOfUserandNumOfMsg();

    /* Checks if number og messages to be sent is equal to number 
        of users AND if checkFunctionCall is equal to number of users. 
        This creates the possibility to send synchronized messages 
        several times. */
    if (check && checkFunctionCall === userMsg.length) {
      console.log("detfunker");
      //Resets variable in order to restart the synchronized messages loop
      checkFunctionCall = 0;

      /* Loops through every object in UserMsg and send the 
        correct message to the correct target */
      for (let i = 0; i < userMsg.length; i++) {
        io.to(`${userMsg[i].usr}`).emit("chat-message", {
          message: userMsg[i].msg
        });
        console.log("Melding sendt");
        io.emit("Reset_table", temp);
      }
    } else {
      console.log("prøv igen");
    }
  });
});

function findTarget(tempTarget) {
  //Collect all user keys and values
  let keys = Object.keys(users);
  let values = Object.values(users);
  console.log(values);
  console.log(keys);
  //Define temp user object to store information in
  let thisUser = {
    key: "temp"
  };
  let target;
  //Sets users temporary Key to the senders value from users[socket.id]
  let temp = tempTarget;

  let index;
  /* Loops through all values of users
        and matches it with the value of the sender. 
        We can now easily find the index number of the sender 
        later. This is needed because we cant access the key of the user, 
        but we can access the value.  */
  for (let i = 0; i < values.length; i++) {
    if (values[i] === temp) {
      thisUser.key = values[i];
      index = i;
      console.log("Dette er nå target: " + thisUser.key);
      console.log(index);
    }
  }
  /* Loops through list of keys and replaces 
        indexes of values with the keys. This is 
        needed because we need the specific key 
        in order to target the right receiver */
  for (let i = 0; i < keys.length; i++) {
    values[i] = keys[i];
    console.log("Nye værdier " + keys[i]);
  }
  /* When all properties of values are replaced
        with the properties of keys. We can use the 
        variable of index to say which key belongs 
        to the sender. */
  thisUser.key = values[index];
  console.log("Dette er nå target sin key " + thisUser.key);

  /* Because we now know what exact key belongs 
        to the sender. We can loop through the list of 
        keys, match it with the current user, and 
        say that the message is to be sent to 
        the next client in the list */
  for (let i = 0; i < keys.length; i++) {
    if (keys[i] === thisUser.key) {
      target = keys[i + 1];
      /* Checks if the next client is last in the list. 
        If so, the message is to be sent to the list item, 
        creating a full circle. */
      if (keys[i] === keys[keys.length - 1]) {
        target = keys[0];
      }
    }
  }
  return target;
}
/* Checks if number of connected clients is
the same as number of active user messages. 
Also takes the global variable "checkFunctionCall"
and adds 1 counter. This is used for timing 
the synchronized sending of messages */

function checkNumOfUserandNumOfMsg() {
  let keys = Object.keys(users);
  checkFunctionCall++;
  if (userMsg.length === keys.length) {
    return true;
  } else {
    return false;
  }
}

/* Function receiving a empty object, identified target and 
    message to be sent. Checks if the identified target 
    is already in the list of UserMessages. Updates the current or creates 
     a new Usermessage object */

function updateOrCreate(obj, target, message) {
  var index = userMsg.findIndex(x => x.usr === target);
  console.log(index);
  if (index === -1) {
    obj.usr = target;
    obj.msg = message;
    userMsg.push(obj);
    console.log("Bruger oprettet");
  } else {
    userMsg[index].usr = target;
    userMsg[index].msg = message;
    console.log("Bruger opdateret");
  }
}

//transporter object
function sendMail(mailObject) {
  let transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: "brainwriting.boys@gmail.com",
      pass: "brainwriting123"
    }
  });
  //The email object by the length of emailList (appended from home-page)
  for (let i = 0; i < emailList.length; i++) {
    let mailOption = {
      from: "brainwriting.boys@gmail.com",
      to: emailList[i],
      subject: "Invitation to Brainwriting Session",
      text: fullUrl
    };
    //Calling sendMail on the transporter object containing emails
    transporter.sendMail(mailOption, function(err, data) {
      if (err) {
        console.log("error", err);
      } else {
        console.log("sendt");
      }
    });
  }
}
