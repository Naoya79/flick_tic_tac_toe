const CONFIG = {
    ROWS: 5,
    COLS: 5,
    HAND_SIZE: 5,
    PLAYERS: {
        RED: 'red',
        YELLOW: 'yellow'
    }
};

class Game {
    constructor() {
        this.board = Array(CONFIG.ROWS).fill(null).map(() => Array(CONFIG.COLS).fill(null));
        this.hand = {
            [CONFIG.PLAYERS.RED]: CONFIG.HAND_SIZE,
            [CONFIG.PLAYERS.YELLOW]: CONFIG.HAND_SIZE
        };
        this.turn = CONFIG.PLAYERS.RED; // Red starts (rule: touched glass recently, defaulting to Red)
        this.history = []; // Stack for undo
        this.boardHistoryHashes = new Set(); // For Ko rule
        this.isGameOver = false;

        // UI State
        this.selectedPiece = null; // {r, c}
    }

    // --- Core Logic ---

    // Create a deep copy of the current state
    serializeState() {
        return JSON.stringify({
            board: this.board,
            hand: this.hand,
            turn: this.turn
        });
    }

    // Restore state from string
    deserializeState(json) {
        const state = JSON.parse(json);
        this.board = state.board;
        this.hand = state.hand;
        this.turn = state.turn;
    }

    saveForUndo() {
        if (this.history.length >= 20) this.history.shift(); // Limit history size
        const state = this.serializeState();
        this.history.push(state);
    }

    undo() {
        if (this.history.length === 0) return false;
        const prev = this.history.pop();
        this.deserializeState(prev);
        this.isGameOver = false;
        this.selectedPiece = null;
        this.boardHistoryHashes.clear();
        return true;
    }

    checkKo(nextBoardState) {
        if (this.history.length < 2) return false;

        const nextBoardStr = JSON.stringify(nextBoardState);

        // Check against the board state from 2 turns ago (prevent immediate repetition loop)
        if (this.history.length > 0) {
            const prevBoard = JSON.parse(this.history[this.history.length - 1]).board;
            if (JSON.stringify(prevBoard) === nextBoardStr) return true;
        }
        return false;
    }

    // --- Actions ---

    canPlace(r, c) {
        if (this.board[r][c] !== null) return false;
        if (this.hand[this.turn] <= 0) return false;

        // Constraint: Cannot place adjacent to OWN pieces (V, H, D)
        const dirs = [
            [-1, -1], [-1, 0], [-1, 1],
            [0, -1], [0, 1],
            [1, -1], [1, 0], [1, 1]
        ];

        for (let [dr, dc] of dirs) {
            const nr = r + dr;
            const nc = c + dc;
            if (nr >= 0 && nr < CONFIG.ROWS && nc >= 0 && nc < CONFIG.COLS) {
                if (this.board[nr][nc] === this.turn) return false;
            }
        }
        return true;
    }

    placePiece(r, c) {
        if (!this.canPlace(r, c)) return false;

        this.saveForUndo();
        this.board[r][c] = this.turn;
        this.hand[this.turn]--;

        this.finalizeTurn();
        return true;
    }

    // Flick Logic
    // Returns { success: boolean, newBoard: [], winner: string|null }
    simulateFlick(startR, startC, dr, dc) {
        // Deep copy board
        let simBoard = this.board.map(row => [...row]);
        const MOVER = simBoard[startR][startC];

        // Remove mover from start
        simBoard[startR][startC] = null;

        // Recursive push function
        // piece: color of the piece moving
        // r, c: current position of the piece (it is "floating" now)
        // dr, dc: direction
        const movePiece = (piece, r, c, dr, dc, board) => {
            let currR = r;
            let currC = c;

            while (true) {
                const nextR = currR + dr;
                const nextC = currC + dc;

                // 1. Check Wall
                if (nextR < 0 || nextR >= CONFIG.ROWS || nextC < 0 || nextC >= CONFIG.COLS) {
                    // Hit wall, stop at currR, currC
                    board[currR][currC] = piece;
                    return;
                }

                // 2. Check Piece
                if (board[nextR][nextC] !== null) {
                    // Hit a piece!
                    const hitPiece = board[nextR][nextC];

                    // The moving piece takes the spot of the hit piece
                    board[nextR][nextC] = piece;

                    // The hit piece continues in the same direction from nextR, nextC
                    movePiece(hitPiece, nextR, nextC, dr, dc, board);
                    return; // Done
                }

                // 3. Empty Space
                // Continue moving
                currR = nextR;
                currC = nextC;
                // Loop again
            }
        };

        movePiece(MOVER, startR, startC, dr, dc, simBoard);

        return simBoard;
    }

    executeFlick(r, c, dr, dc) {
        // Validation: Must be own piece
        if (this.board[r][c] !== this.turn) return false;

        const nextBoard = this.simulateFlick(r, c, dr, dc);

        // Check Ko
        if (this.checkKo(nextBoard)) {
            alert("Ko Rule: Cannot repeat board state from 2 turns ago.");
            return false;
        }

        this.saveForUndo();
        this.board = nextBoard;
        this.flickedThisTurn = true; // Mark that flick happened (for win check)

        this.finalizeTurn();
        return true;
    }

    checkWin(board) {
        const winners = new Set();

        // Helper to check lines
        const checkLine = (cells) => {
            // cells is array of colors or null
            let count = 0;
            let current = null;

            // We need 3 consecutive. Simple scan.
            for (let cell of cells) {
                if (cell && cell === current) {
                    count++;
                } else {
                    current = cell;
                    count = 1;
                }
                if (count >= 3 && current) {
                    winners.add(current);
                }
            }
        };

        // Rows
        for (let r = 0; r < CONFIG.ROWS; r++) {
            checkLine(board[r]);
        }
        // Cols
        for (let c = 0; c < CONFIG.COLS; c++) {
            checkLine(board.map(row => row[c]));
        }
        // Diagonals

        // Generic diagonal scanner
        // Top-left to Bottom-right
        for (let k = 0; k < CONFIG.ROWS * 2; k++) {
            let diag = [];
            for (let j = 0; j <= k; j++) {
                let i = k - j;
                if (i < CONFIG.ROWS && j < CONFIG.COLS) {
                    diag.push(board[i][j]);
                }
            }
            if (diag.length >= 3) checkLine(diag);
        }

        // Top-right to Bottom-left
        for (let k = 0; k < CONFIG.ROWS * 2; k++) {
            let diag = [];
            for (let j = 0; j <= k; j++) {
                let i = k - j;
                let col = CONFIG.COLS - 1 - j;
                if (i < CONFIG.ROWS && col >= 0) {
                    diag.push(board[i][col]);
                }
            }
            if (diag.length >= 3) checkLine(diag);
        }

        return winners;
    }

    finalizeTurn() {
        const winners = this.checkWin(this.board);

        if (winners.size > 0) {
            this.isGameOver = true;
            if (winners.size === 1) {
                // Determine winner
                const winner = winners.values().next().value;
                this.endGame(winner);
            } else {
                // Determine simultaneous win loser
                const loser = this.turn;
                const winner = loser === CONFIG.PLAYERS.RED ? CONFIG.PLAYERS.YELLOW : CONFIG.PLAYERS.RED;
                this.endGame(winner);
            }
            return;
        }

        // Switch turn
        this.turn = this.turn === CONFIG.PLAYERS.RED ? CONFIG.PLAYERS.YELLOW : CONFIG.PLAYERS.RED;
        this.flickedThisTurn = false;

        // UI Update trigger
        ui.update();
    }

    endGame(winner) {
        setTimeout(() => {
            ui.showWin(winner);
        }, 300); // Delay for animation
    }
}

// --- UI Logic ---

class UI {
    constructor(game) {
        this.game = game;
        this.boardEl = document.getElementById('board');
        this.handRedEl = document.getElementById('hand-red');
        this.handYellowEl = document.getElementById('hand-yellow');
        this.turnIndicator = document.getElementById('turn-indicator');
        this.msgArea = document.getElementById('message-area');
        this.flickControls = document.getElementById('flick-controls');

        this.init();
    }

    init() {
        // Generate Board
        this.boardEl.innerHTML = '';
        for (let r = 0; r < CONFIG.ROWS; r++) {
            for (let c = 0; c < CONFIG.COLS; c++) {
                const cell = document.createElement('div');
                cell.className = 'cell';
                cell.dataset.r = r;
                cell.dataset.c = c;
                cell.onclick = () => this.handleCellClick(r, c);
                this.boardEl.appendChild(cell);
            }
        }

        document.getElementById('undo-btn').onclick = () => {
            if (this.game.undo()) this.update();
        };

        document.getElementById('rules-btn').onclick = () => {
            document.getElementById('rules-modal').classList.remove('hidden');
        };

        document.querySelector('.close-modal').onclick = () => {
            document.getElementById('rules-modal').classList.add('hidden');
        };

        document.getElementById('restart-btn').onclick = () => {
            window.location.reload();
        };

        this.update();
    }

    update() {
        // Update Board
        const cells = Array.from(this.boardEl.children);
        cells.forEach(cell => {
            const r = parseInt(cell.dataset.r);
            const c = parseInt(cell.dataset.c);
            const val = this.game.board[r][c];

            cell.innerHTML = '';
            cell.className = 'cell';

            if (val) {
                const piece = document.createElement('div');
                piece.className = `piece ${val}`;
                if (this.game.selectedPiece && this.game.selectedPiece.r === r && this.game.selectedPiece.c === c) {
                    piece.classList.add('selected');
                }
                cell.appendChild(piece);
            } else {
                if (this.game.canPlace(r, c) && !this.game.isGameOver) {
                    cell.classList.add('valid-move');
                }
            }
        });

        // Update Hands
        this.updateHand(this.handRedEl, this.game.hand.red, 'red');
        this.updateHand(this.handYellowEl, this.game.hand.yellow, 'yellow');

        document.getElementById('count-red').innerText = this.game.hand.red;
        document.getElementById('count-yellow').innerText = this.game.hand.yellow;

        // Update Info
        const turnText = this.game.turn === 'red' ? "Red's Turn" : "Yellow's Turn";
        this.turnIndicator.innerHTML = `<span class="p-dot ${this.game.turn}"></span> ${turnText}`;

        // Active Player Card
        document.getElementById('p-red').classList.toggle('active', this.game.turn === 'red');
        document.getElementById('p-yellow').classList.toggle('active', this.game.turn === 'yellow');

        // Reset overlays
        this.flickControls.classList.add('hidden');
        this.flickControls.innerHTML = '';
    }

    updateHand(el, count, color) {
        el.innerHTML = '';
        for (let i = 0; i < count; i++) {
            const p = document.createElement('div');
            p.className = `hand-piece ${color}`;
            el.appendChild(p);
        }
    }

    handleCellClick(r, c) {
        if (this.game.isGameOver) return;

        const cellVal = this.game.board[r][c];

        // If clicking own piece -> Select for Flick
        if (cellVal === this.game.turn) {
            this.game.selectedPiece = { r, c };
            this.update(); // Redraw selection
            this.showFlickOptions(r, c);
            return;
        }

        // If clicking empty -> Try Place
        if (cellVal === null) {
            // If we had a selection, maybe deselect?
            if (this.game.selectedPiece) {
                this.game.selectedPiece = null;
                this.update();
                return;
            }

            if (this.game.placePiece(r, c)) {
                // Success sound?
                this.update();
            } else {
                // Invalid move visual feedback?
                this.msgArea.innerText = "Invalid Move: Cannot place adjacent to own piece!";
                setTimeout(() => this.msgArea.innerText = "Select an action", 2000);
            }
        }
    }

    showFlickOptions(r, c) {
        this.flickControls.classList.remove('hidden');
        this.flickControls.innerHTML = '';

        const dirs = [
            [-1, -1], [-1, 0], [-1, 1],
            [0, -1], [0, 1],
            [1, -1], [1, 0], [1, 1]
        ];

        // 5x5 grid pixel positions
        const CELL_SIZE = 70;
        const GAP = 12;

        const left = GAP + c * (CELL_SIZE + GAP);
        const top = GAP + r * (CELL_SIZE + GAP);

        dirs.forEach(([dr, dc]) => {
            const btn = document.createElement('div');
            btn.className = 'arrow-btn';

            // Icon transformation
            let rotate = 0;
            if (dr === -1 && dc === 0) rotate = 0; // Up
            else if (dr === -1 && dc === 1) rotate = 45;
            else if (dr === 0 && dc === 1) rotate = 90;
            else if (dr === 1 && dc === 1) rotate = 135;
            else if (dr === 1 && dc === 0) rotate = 180;
            else if (dr === 1 && dc === -1) rotate = 225;
            else if (dr === 0 && dc === -1) rotate = 270;
            else if (dr === -1 && dc === -1) rotate = 315;

            btn.innerHTML = '➜';
            btn.style.transform = `rotate(${rotate - 90}deg)`; // arrow is right-pointing by default? unicode is right. -90 makes it up.

            // Position around the cell
            // Center of cell = left + 35, top + 35
            // Offset by distance
            const DIST = 60;
            const btnLeft = (left + 35) + (dc * DIST) - 20; // -20 for center of btn
            const btnTop = (top + 35) + (dr * DIST) - 20;

            btn.style.left = `${btnLeft}px`;
            btn.style.top = `${btnTop}px`;

            btn.onclick = (e) => {
                e.stopPropagation();
                if (this.game.executeFlick(r, c, dr, dc)) {
                    this.game.selectedPiece = null;
                    this.update();
                }
            };

            this.flickControls.appendChild(btn);
        });
    }

    showWin(winner) {
        document.getElementById('win-overlay').classList.remove('hidden');
        document.getElementById('winner-text').innerText = `${winner.toUpperCase()} WINS!`;
        document.getElementById('winner-text').style.color = winner === 'red' ? '#ff4757' : '#ffa502';
    }
}

// Start
const game = new Game();
const ui = new UI(game);
