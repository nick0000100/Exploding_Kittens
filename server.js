const express = require("express");
const path = require("path");
const app = express();

app.use(express.static(path.join(__dirname + "/static")));

app.set('views', path.join(__dirname + '/views'));
app.set('view engine', 'ejs');

app.get('/', function(req, res){
    res.render('index');
});

const server = app.listen(8000, function(){
    console.log("Listening on port 8000");
});

// Import Classes
const Player = require('./player');
const Card = require('./card');
const Deck = require('./deck');

// SOCKETS

const io = require('socket.io').listen(server);

var messages = [];
var chatters = [];
var lobby = [];
var player_turn = 0;
var deck = new Deck();

io.sockets.on('connection', (socket) => {
    
    //CHAT **************************************************************
    socket.on("new_user", function(data) {
        io.emit("user_joined", {name: data.name});
        chatters.push(data.name);
        socket.emit("just_joined", messages);
        io.emit("show_users", chatters);
    });

    socket.on("new_message", function(data) {
        io.emit("add_message", `${data.name} Posted: ${data.message}`);
        messages.push(`${data.name} posted: ${data.message}`)
    });

    socket.on("disconnected", function(data) {
        chatters.splice(chatters.indexOf(socket), 1);
        io.emit("user_left", data.name)
    });
    //CHAT **************************************************************




    //Game **************************************************************

    socket.on("new_player", (data) => {
        if(lobby.length < 5) {
            lobby.push(new Player(data.name, socket.id));
            // inGame[socket.id] = true; //@@@@@
            io.emit("joined", {num: lobby.length, player: data});
        }else {
            socket.emit("full", "The lobby is currently full.")
        }
    });

    // Starts the game
    socket.on("start", data => {
        if(lobby.length >= 2) {
            deal();
            whoTurn(false);
        }else {
            io.emit("more_players", {error: "Please get more people to play!"})
        }

    });

    // Player draws a card
    socket.on("draw", data => {
        let player = lobby[player_turn % lobby.length];
        let card = deck.draw();
        if(card.type == "Explode") {
            if(player.hand.findIndex(x => x.type=="Defuse") == -1) {
                // Tell everyone that this player has died
                // Remove them from the lobby
                io.emit("lose", {message: `${player.name} has drawn an exploding kitten, did not have a defuse card, and is out of the game.`});
                lobby.splice(player_turn % lobby.length, 1);
                // Puts all of the player's hand into the discard pile
                for(let i = 0; i < player.hand.length; i++) {
                    deck.discard.push(player.hand.pop);
                }
                player_turn--;
                if(lobby.length == 1) {
                    //Game over
                    io.emit("winner", {message: `The winner of the game is ${lobby[0].name}!`});
                    lobby = [];
                    player_turn = 0;
                    deck = new Deck();
                }
            }else {
                // Player defused the kitten.
                player.hand.splice(player.hand.findIndex(x => x.type == "Defuse"), 1);
                io.emit("defused", {message: `${player.name} has drawn an exploding kitten and defused it`});
                io.to(player.id).emit("you_defused", {message: `What position would you like to reinsert the exploding kitten?  There are currently ${deck.cards.length} cards left in play.`, cards: deck.cards.length});
                player_turn++;
            }
        }else {
            if(!data.attack) {
                player_turn++;
            }
            player.hand.push(card);
        }
        if(lobby.length >= 2) {
            // io.to(player.id).emit("show_cards", {cards: player.hand});
            showCards()
            io.emit("ended_turn", {message: `${player.name} has ended their turn.`});
            whoTurn(false);
        }
    });

    // Reinserts an exploding kitten after it was defused.
    socket.on("reinsert", data => {
        deck.cards.splice(deck.cards.length - data.index + 1, 0, new Card("Explode", "Lose the game and discard all cards, unless you have a defuse card."));
    });

    // Prompts a user to give another player one of their cards.
    socket.on("select_steal", data => {
        let message = `${lobby[player_turn % lobby.length].name} wants one of your cards select one to give to them.`
        io.to(lobby[data.index].id).emit("stolen_from", {message: message, index: data.index});
    });

    // Plays an action card from the user and removes the card from their hand.
    socket.on("action_card", data => {
        let type = data.type;
        let player = lobby[player_turn % lobby.length];
        let message;
        if(type != "Defuse") {
            // Removes the card from their hand.
            deck.discard.push(player.hand.splice(player.hand.findIndex(x => x.type == type), 1)[0]);

            // Executes the card's action.
            if(type == "Shuffle") {
                message = `${player.name} has shuffled the deck.`;
                io.to(player.id).emit("show_action", {message: "You shuffled the deck."});         
                deck.shuffle();
            }else if(type == "See_the_future") {
                message = `${player.name} looked into the future.`
                let first = deck.cards.pop();
                let second = deck.cards.pop();
                let third = deck.cards.pop();
                io.to(player.id).emit("future", {first: first.type, second: second.type, third: third.type});
                deck.cards.push(third);
                deck.cards.push(second);
                deck.cards.push(first);
            }else if(type == "Skip") {
                message = `${player.name} has skipped their turn.`
                io.to(player.id).emit("show_action", {message: "You skipped your turn."}); 
                io.to(player.id).emit("skipped");
                io.emit("ended_turn", {message: `${player.name} has ended their turn.`});
                player_turn++;
                whoTurn(false);
            }else if(type == "Attack") {
                message = `${player.name} used an attack card on ${lobby[(player_turn + 1) % lobby.length].name} so they must make two turns in a row.`;
                io.emit("ended_turn", {message: `${player.name} has ended their turn.`});
                io.to(player.id).emit("skipped");
                player_turn++;
                whoTurn(true);
            }else if(type == "Favor") {
                // Prompt the current player to ask who they want to take a card from "tell them # of players - lobby.length && cards in each hand - lobby[i].hand.length except for current i"
                // Show in the chat that current player attacked someone and make attacked person select and confirm button
                // splice that card out and push into current player hand
                // Go through all of the players in lobby 
                let playersAndHands = "";
                for(let i = 0; i < lobby.length; i++) {
                    if(i != player_turn % lobby.length) {
                        playersAndHands += `${lobby[i].name} (${i + 1}) currently has ${lobby[i].hand.length} cards in their hand.`;
                    }
                }
                message = `${player.name} has stolen a card from another player.`;
                io.to(player.id).emit("steal", {message: `Who would you like to steal a card from? There are currently ${lobby.length - 1} other players left in the game. ${playersAndHands}. Do not enter yourself!`, lobby: lobby.length - 1, currentPlayer: player_turn % lobby.length});
            }else if(type == "Nope") {
                // Give all of the other options an interval for like 5-10 seconds before the actions occur
                // During that interval make a button show up for other users - click = do not execute stuff and alter users
                // Splice out a nope card from them --- if they click without nope button do nothing
                // After the nope occurs start another interval with the button appearing for everyone
                // If someone nopes again (Turn to YUP) and original action takes place
            }
        }else {
            io.to(player.id).emit("not_valid", {message: "You can't play defuse by itself."});
        }
        // io.to(player.id).emit("show_cards", {cards: player.hand});
        showCards()
        socket.broadcast.emit("show_action", {message: message});
    });

    // Gives the selected card to the player that played a favor.
    socket.on("give_card", data => {
        let type = data.type;
        let taker = lobby[player_turn % lobby.length];
        let taken = lobby[data.index];
        let message;
        taker.hand.push(taken.hand.splice(taken.hand.findIndex(x => x.type == type), 1)[0]);
        // io.to(taken.id).emit("show_cards", {cards: taken.hand});
        // io.to(taker.id).emit("show_cards", {cards: taker.hand});
        showCards()
    });

    //Game **************************************************************

});


//Helpers **************************************************************

// Gives everyone their starting cards and creates the rest of the deck.
function deal() {
    // Everyone gets a defuse card.
    for(let i = 0; i < lobby.length; i++) {
        lobby[i].hand.push(new Card("Defuse", "Play to survive drawing an exploding kitten."));
    }
    //Making the rest of the players' hand.
    for(let i = 0; i < 4; i++) {
        for(let j = 0; j < lobby.length; j++) {
            lobby[j].hand.push(deck.draw());
        }
    }
    // Add the exploding kittens to the deck.
    for(let i = 0; i < lobby.length - 1; i++) {
        deck.cards.push((new Card("Explode", "Lose the game and discard all cards, unless you have a defuse card.")));
    }
    showCards();
    deck.shuffle();
}

// Shows each player their cards.
function showCards() {
    for(let i = 0; i < lobby.length; i++) {
        io.to(lobby[i].id).emit("show_cards", {cards: lobby[i].hand});
    }
}

// Does stuff for whoever's turn it is.
function whoTurn(attack) {
    let player = lobby[player_turn % lobby.length];
    io.to(player.id).emit("your_turn", {deck: deck, attack: attack});
}

//Helpers **************************************************************
