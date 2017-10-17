const Card = require('./card');

class Deck {
    constructor() {
        this.cards = [];
        this.discard = [];
        this.makeDeck();
        this.shuffle();
    }

    makeDeck() {
        // Shuffle - 4 Cards
        for(let i = 0; i < 4; i++) {
            this.cards.push(new Card("Shuffle", "Shuffle the deck."))
        }
        // See the future - 5 Cards
        for(let i = 0; i < 5; i++) {
            this.cards.push(new Card("See the future", "Look at the top three cards of the deck."))
        }
        // Skip - 5 Cards
        for(let i = 0; i < 5; i++) {
            this.cards.push(new Card("Skip", "End your turn without drawing a card."))
        }
        // Attack - 4 Cards
        for(let i = 0; i < 4; i++) {
            this.cards.push(new Card("Attack", "End your turn without drawing a card and force the next player to mkae two turns in a row."))
        }
        //Favor - 4 Cards
        for(let i = 0; i < 5; i++) {
            this.cards.push(new Card("Favor", "Make another player give you one of their cards; they get to choose."));
        }
        // Nope - 5 Cards
        // for(let i = 0; i < 5; i++) {
        //     this.cards.push(new Card("Nope", "Stop any action besides exploding and defusing."));
        // }
    }

    // Shuffles the remaining deck
    shuffle() {
        let n = this.cards.length;
        let index, temp;
        while(n) {
            index = Math.floor(Math.random() * n--);
            temp = this.cards[n];
            this.cards[n] = this.cards[index];
            this.cards[index] = temp;
        }
    }

    // Gives a card to a player
    draw() {
        return this.cards.pop();
    }
}
module.exports = Deck