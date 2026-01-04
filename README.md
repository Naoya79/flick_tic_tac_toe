# Flick T^3 (Flick Tic-Tac-Toe)

Tactical, physics-based tic-tac-toe with chain reactions.

## Game Rules

### Goal
Line up **3** of your colored pieces (Red or Yellow) vertically, horizontally, or diagonally.

### How to Play
On your turn, choose one of two actions:

1. **Place**:
   - Place a piece from your hand onto the board.
   - **Constraint**: You CANNOT place a piece in any space adjacent (including diagonals) to your *own* pieces already on the board.

2. **Flick**:
   - Select one of your pieces on the board and "flick" it in one of 8 directions.
   - The piece slides until it hits the edge of the board or another piece.
   - **Chain Reaction**: If it hits another piece, that piece is pushed in the same direction. This can chain indefinitely until a piece hits a wall.

### Special Rules
- **Winning Condition**: 3 in a row.
- **Draw/Loss**: If a move causes *both* players to win simultaneously, the active player (the one who flicked) **LOSES**.
- **Ko Rule**: You cannot make a move that repeats the board state from 2 turns prior.

## Tech Stack
- HTML5
- CSS3 (Glassmorphism, CSS Variables, Animations)
- Vanilla JavaScript (ECMAScript 2020+)

## Deployment
This project is designed to be deployed on GitHub Pages.

1. Push to `main` branch.
2. Go to Repository Settings -> Pages.
3. Select `Source` as `Deploy from a branch` and choose `main` / `root`.

## Credits
This game is inspired by and based on the board game **VIDRO**.
