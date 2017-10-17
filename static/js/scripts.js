"use strict"

const socket = io.connect();

$(document). ready(function (){
    //CHAT **************************************************************************************
    var name;
    while(!name) {
        var name = prompt("Please enter your name");
    }

    // When a new person loads the page and gives a name.
    socket.emit("new_user", {name:name});

    // Notify every user when a new user joins.
    socket.on("user_joined", function(data) {
        $("#chat").append(`<p>${data.name} has joined the chatroom!<p>`);
        scroll();
    });

    // Loads all of the comments for the new user.
    socket.on("just_joined", function(data) {
        //loop through the data array and append stuff to chat
        for(let i = 0; i <= data.length - 1; i++) {
            $("#chat").append(`<p>${data[i]}</p>`);
        }
        scroll();
    });

    // Sends a new message to the server.
    $("#submit").click(function() {
        var message = $("#message").val();
        socket.emit("new_message", {message:message, name:name});
        $("#chatForm")[0].reset();
        return false;
    });

    // Adds a new message to the chat.
    socket.on("add_message", function(data) {
        $("#chat").append(`<p>${data}</p>`);
        scroll();
    });

    // // Adds the names of the users.
    // socket.on("show_users", (data) => {
    //    $("#chatters").empty();
    //     for(let i = 0; i <= data.length - 1; i++) {
    //         $("#chatters").append(`<p>${data[i]}</p>`);
    //     }
    // });
    
    // Tells the other users that a user left.
    socket.on("user_left", function(data) {
        $("#chat").append(`<p>${data.name} has left the chatroom!<p>`);
        scroll();
    });
    
    // Disconnection
    socket.on('disconnect', function() {
        socket.emit("disconnected", {name:name})
    });

    //CHAT **************************************************************************************

    //Game **************************************************************************************

    // Allows user to join the lobby.
    $("#join").click(function() {
        socket.emit("new_player", {name: name});
    });

    // Notifies users that someone has joined the lobby.
    socket.on("joined", data => {
        $("#chat").append(`<p>${data.player.name} has joined a lobby of Exploding kittens, there are currently ${data.num} people in the lobby!<p>`);
        scroll();
    });

    // Notifies the user that the game is full.
    socket.on("full", data => {
        $("#chat").append(`<p>${data}<p>`);
        scroll();
    });

    // Starts the game.
    $("#start").click(function() {
        socket.emit("start", {});
    });

    socket.on("more_players", data => {
        $("#chat").append(`<p>${data.error}</p>`);
        scroll();
    });

    // Creates the cards and appends them to the page.
    socket.on("show_cards", data => {
        let cardArea = document.getElementById("cards");
        cardArea.innerHTML = "";
        for(let i = 0; i < data.cards.length; i++) {
            var card = document.createElement('div');
            if(data.cards[i].type == "See the future") {
                card.classList.add("card", "See_the_future");
            }else {
                card.classList.add("card", data.cards[i].type);
            }
            var text = document.createElement('p');
            text.innerHTML = `Type: ${data.cards[i].type} <br><br> Instruction: ${data.cards[i].instruction}`;
            card.onclick = select;
            card.appendChild(text);
            cardArea.appendChild(card);
        }
    });

    // Allows user to select a card.
    function select() {
        let prevSelect = document.getElementsByClassName("selected")
        if(prevSelect.length > 0) {
            prevSelect[0].classList.remove("selected");
        }
        this.classList.add("selected");
    }

    // Displays buttons for the user if it is their turn.
    socket.on("your_turn", data => {
        let actions = $("#actions");

        let drawBtn = document.createElement("button");
        drawBtn.textContent = "Draw";
        

        let actionBtn = document.createElement("button");
        actionBtn.textContent = "Play Selected Card";
        actionBtn.onclick = playSelected;

        actions.show();

        if(data.attack) {
            drawBtn.onclick = attackDraw;
        }else {
            drawBtn.onclick = draw;
        }

        actions.append(drawBtn);
        actions.append(actionBtn);
    });

    // Drawing a card but doesn't end turn
    function attackDraw() {
        let cardArea = document.getElementById("cards");
        cardArea.innerHTML = "";
        let actions = document.getElementById("actions");
        actions.innerHTML = "";
        socket.emit("draw", {attack: true});
    }

    // Drawing a card and ends turn
    function draw() {
        let cardArea = document.getElementById("cards");
        cardArea.innerHTML = "";
        let actions = document.getElementById("actions");
        actions.innerHTML = "";
        socket.emit("draw", {attack: false});
    }

    // Plays the selected card.
    function playSelected() {
        let type = document.getElementsByClassName("selected")[0].className.split(/\s+/)[1];
        let cardArea = document.getElementById("cards");
        cardArea.innerHTML = "";
        socket.emit("action_card", {type: type});
    }

    // Tells everyone someone blew up
    socket.on("lose", data => {
        let message = $("<p></p>").text(data.message).css("color", "red");
        $("#chat").append(message);
        scroll();
    });

    // Tells everyone who won.
    socket.on("winner", data => {
        let message = $("<p></p>").text(data.message).css("color", "green");
        $("#chat").append(message);
        scroll();
    });
    
    // Tells everyone that a player has used a defuse card.
    socket.on("defused", data => {
        let message = $("<p></p>").text(data.message).css("color", "orange");
        $("#chat").append(message);
        scroll();
    });

    // Asks the player that used a defuse card where to reinsert the kitten.
    socket.on("you_defused", data => {
        let index = prompt(`${data.message}`);;
        let cards = data.cards;
        while(!index || parseInt(index, 10) >= cards) {
            index = prompt(`${data.message}`);
        }
        socket.emit("reinsert", {index: index});
    });

    // Tells everyone an action card has been played.
    socket.on("show_action", data => {
        let message = $("<p></p>").text(data.message).css("color", "blue");
        $("#chat").append(message);
        scroll();
    });

    // Shows the user who played see the future card the next three cards.
    socket.on("future", data => {
        let message = $("<p></p>").text(`The next card is ${data.first}, then ${data.second}, then ${data.third}`).css("color", "blue");
        $("#chat").append(message);
        scroll();
    });

    // Notifies everyone that a player has ended their turn.
    socket.on("ended_turn", data => {
        let message = $("<p></p>").text(data.message).css("color", "purple");
        $("#chat").append(message);
        scroll();
    });

    // Notifies player that they can't play a defuse by itself.
    socket.on("not_valid", data => {
        let message = $("<p></p>").text(data.message).css("color", "darkred");
        $("#chat").append(message);
        scroll();
    });

    // Removes buttons for player who skipped their turn.
    socket.on("skipped", data => {
        let actions = document.getElementById("actions");
        actions.innerHTML = "";
    });

    // Gives a prompt to the player who played at a favor card.
    socket.on("steal", data => {
        let index = prompt(`${data.message}`) - 1;
        let cards = data.cards;
        while(index == null || index == data.currentPlayer || index > data.lobby || index < 0) {
            index = prompt(`${data.message}`) - 1;
        }
        socket.emit("select_steal", {index: index});
    });

    // Tells the user targeted by a favor card to select a card to give.
    socket.on("stolen_from", data => {
        let message = $("<p></p>").text(data.message).css("color", "brown");
        $("#chat").append(message);
        let actions = $("#actions");
        let actionBtn = document.createElement("button");
        actionBtn.textContent = "Give selected card.";
        actionBtn.onclick = () => {
            let type = document.getElementsByClassName("selected")[0].className.split(/\s+/)[1];
            socket.emit("give_card", {type: type, index: data.index});
            actions.empty();
        }
        actions.append(actionBtn);
    });

    // Scrolls the chat log.
    function scroll() {
        let chat = document.getElementById("chat");
        chat.scrollTop = chat.scrollHeight;
    }


    //Game **************************************************************************************
});
