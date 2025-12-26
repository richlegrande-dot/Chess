import SwiftUI

struct GameView: View {
    @EnvironmentObject var gameManager: ChessGameManager
    @State private var selectedSquare: Position?
    @State private var showingGameOverAlert = false
    
    var body: some View {
        VStack(spacing: 20) {
            // Status Bar
            HStack {
                HStack(spacing: 8) {
                    Circle()
                        .fill(gameManager.isPlayerTurn ? Color.green : Color.orange)
                        .frame(width: 12, height: 12)
                    
                    Text(gameManager.isPlayerTurn ? "Your Turn" : "AI Thinking...")
                        .font(.title2)
                        .fontWeight(.semibold)
                }
                
                Spacer()
                
                if gameManager.isThinking {
                    HStack(spacing: 6) {
                        ProgressView()
                            .scaleEffect(0.8)
                        Text("Thinking...")
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }
                }
            }
            .padding(.horizontal)
            .padding(.top)
            
            // Error Message
            if let error = gameManager.errorMessage {
                Text(error)
                    .foregroundColor(.red)
                    .padding(.horizontal)
                    .multilineTextAlignment(.center)
            }
            
            // Chess Board
            ChessBoardView(
                board: gameManager.board,
                selectedSquare: $selectedSquare,
                onSquareTapped: handleSquareTap
            )
            .padding()
            
            // Game Controls
            VStack(spacing: 12) {
                HStack(spacing: 12) {
                    Button("New Game") {
                        gameManager.startNewGame()
                        selectedSquare = nil
                    }
                    .buttonStyle(PrimaryButtonStyle())
                    
                    if gameManager.gameState == .playing && !gameManager.isThinking {
                        Button("Resign") {
                            gameManager.resign()
                            selectedSquare = nil
                        }
                        .buttonStyle(ResignButtonStyle())
                    }
                }
                
                if case .gameOver = gameManager.gameState {
                    Button("Analyze Game") {
                        gameManager.goToPostGameChat()
                    }
                    .buttonStyle(SecondaryButtonStyle())
                }
            }
            .padding(.horizontal)
            .padding(.bottom)
        }
        .alert("Game Over", isPresented: $showingGameOverAlert) {
            Button("New Game", action: gameManager.startNewGame)
            Button("Analyze Game", action: gameManager.goToPostGameChat)
            Button("Cancel", role: .cancel) { }
        } message: {
            if case .gameOver(let result) = gameManager.gameState {
                Text(result.description)
            }
        }
        .onChange(of: gameManager.gameState) { state in
            if case .gameOver = state {
                showingGameOverAlert = true
            }
        }
    }
    
    private func handleSquareTap(_ position: Position) {
        guard gameManager.isPlayerTurn && gameManager.gameState == .playing else { return }
        
        if let selected = selectedSquare {
            // Second tap - attempt move
            if selected == position {
                // Deselect
                selectedSquare = nil
            } else {
                // Try to make move
                if gameManager.makePlayerMove(from: selected, to: position) {
                    selectedSquare = nil
                } else {
                    // Check if tapped square has player's piece
                    if let piece = gameManager.board.piece(at: position),
                       piece.color == .white {
                        selectedSquare = position
                    } else {
                        selectedSquare = nil
                    }
                }
            }
        } else {
            // First tap - select piece
            if let piece = gameManager.board.piece(at: position),
               piece.color == .white {
                selectedSquare = position
            }
        }
    }
}

struct ChessBoardView: View {
    let board: ChessBoard
    @Binding var selectedSquare: Position?
    let onSquareTapped: (Position) -> Void
    
    var body: some View {
        VStack(spacing: 2) {
            ForEach((0..<8).reversed(), id: \.self) { rank in
                HStack(spacing: 2) {
                    ForEach(0..<8, id: \.self) { file in
                        ChessSquareView(
                            position: Position(file: file, rank: rank),
                            piece: board.piece(at: Position(file: file, rank: rank)),
                            isSelected: selectedSquare == Position(file: file, rank: rank),
                            isLightSquare: (file + rank) % 2 == 0,
                            onTapped: onSquareTapped
                        )
                    }
                }
            }
        }
        .background(Color.brown.opacity(0.3))
        .cornerRadius(8)
    }
}

struct ChessSquareView: View {
    let position: Position
    let piece: ChessPiece?
    let isSelected: Bool
    let isLightSquare: Bool
    let onTapped: (Position) -> Void
    
    var body: some View {
        Button(action: { onTapped(position) }) {
            ZStack {
                Rectangle()
                    .fill(squareColor)
                    .frame(width: 45, height: 45)
                
                if let piece = piece {
                    Text(piece.symbol)
                        .font(.system(size: 32, weight: .medium))
                        .foregroundColor(.primary)
                        .shadow(color: .black.opacity(0.3), radius: 1, x: 1, y: 1)
                }
            }
        }
        .buttonStyle(PlainButtonStyle())
    }
    
    private var squareColor: Color {
        if isSelected {
            return .blue.opacity(0.6)
        } else if isLightSquare {
            return .white.opacity(0.9)
        } else {
            return .brown.opacity(0.7)
        }
    }
}

// MARK: - Button Styles
struct PrimaryButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.title2)
            .fontWeight(.semibold)
            .foregroundColor(.white)
            .frame(maxWidth: .infinity)
            .padding()
            .background(Color.blue)
            .cornerRadius(12)
            .opacity(configuration.isPressed ? 0.8 : 1.0)
    }
}

struct SecondaryButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.title2)
            .fontWeight(.semibold)
            .foregroundColor(.blue)
            .frame(maxWidth: .infinity)
            .padding()
            .background(Color.blue.opacity(0.1))
            .cornerRadius(12)
            .overlay(
                RoundedRectangle(cornerRadius: 12)
                    .stroke(Color.blue, lineWidth: 2)
            )
            .opacity(configuration.isPressed ? 0.8 : 1.0)
    }
}

struct ResignButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.title3)
            .fontWeight(.semibold)
            .foregroundColor(.white)
            .frame(maxWidth: .infinity)
            .padding()
            .background(Color.red)
            .cornerRadius(12)
            .opacity(configuration.isPressed ? 0.8 : 1.0)
    }
}