import Foundation
import Combine

// MARK: - Chess Engine Service
class ChessEngineService: ObservableObject {
    
    // MARK: - Move Validation
    func validateMove(_ move: ChessMove, on board: ChessBoard) -> Bool {
        return board.isValidMove(move)
    }
    
    // MARK: - Move Generation
    func generateLegalMoves(for board: ChessBoard) -> [ChessMove] {
        return board.generateLegalMoves()
    }
    
    // MARK: - Position Analysis
    func isCheck(for color: PieceColor, on board: ChessBoard) -> Bool {
        // Find the king
        var kingPosition: Position?
        for rank in 0..<8 {
            for file in 0..<8 {
                let position = Position(file: file, rank: rank)
                if let piece = board.piece(at: position),
                   piece.type == .king && piece.color == color {
                    kingPosition = position
                    break
                }
            }
            if kingPosition != nil { break }
        }
        
        guard let kingPos = kingPosition else { return false }
        
        // Check if any opponent piece can attack the king
        for rank in 0..<8 {
            for file in 0..<8 {
                let position = Position(file: file, rank: rank)
                if let piece = board.piece(at: position),
                   piece.color != color {
                    let move = ChessMove(from: position, to: kingPos, piece: piece)
                    if board.isValidMove(move) {
                        return true
                    }
                }
            }
        }
        
        return false
    }
    
    func isCheckmate(for color: PieceColor, on board: ChessBoard) -> Bool {
        // If not in check, it's not checkmate
        guard isCheck(for: color, on: board) else { return false }
        
        // If there are legal moves, it's not checkmate
        let originalPlayer = board.currentPlayer
        // Temporarily set the current player to check for legal moves
        board.currentPlayer = color
        let legalMoves = generateLegalMoves(for: board)
        board.currentPlayer = originalPlayer
        
        return legalMoves.isEmpty
    }
    
    func isStalemate(for color: PieceColor, on board: ChessBoard) -> Bool {
        // If in check, it's not stalemate
        guard !isCheck(for: color, on: board) else { return false }
        
        // If there are no legal moves, it's stalemate
        let originalPlayer = board.currentPlayer
        board.currentPlayer = color
        let legalMoves = generateLegalMoves(for: board)
        board.currentPlayer = originalPlayer
        
        return legalMoves.isEmpty
    }
    
    // MARK: - Game State Analysis
    func analyzeGameState(on board: ChessBoard) -> GameResult? {
        let currentPlayer = board.currentPlayer
        let legalMoves = generateLegalMoves(for: board)
        
        // No legal moves available
        if legalMoves.isEmpty {
            if isCheck(for: currentPlayer, on: board) {
                // Checkmate
                return currentPlayer == .white ? .blackWins : .whiteWins
            } else {
                // Stalemate
                return .stalemate
            }
        }
        
        // Check for insufficient material
        if hasInsufficientMaterial(on: board) {
            return .draw
        }
        
        // Game continues
        return nil
    }
    
    private func hasInsufficientMaterial(on board: ChessBoard) -> Bool {
        var whitePieces: [PieceType] = []
        var blackPieces: [PieceType] = []
        
        for rank in 0..<8 {
            for file in 0..<8 {
                let position = Position(file: file, rank: rank)
                if let piece = board.piece(at: position) {
                    if piece.color == .white {
                        whitePieces.append(piece.type)
                    } else {
                        blackPieces.append(piece.type)
                    }
                }
            }
        }
        
        // Remove kings for material calculation
        whitePieces = whitePieces.filter { $0 != .king }
        blackPieces = blackPieces.filter { $0 != .king }
        
        // King vs King
        if whitePieces.isEmpty && blackPieces.isEmpty {
            return true
        }
        
        // King and minor piece vs King
        if (whitePieces.count == 1 && blackPieces.isEmpty && 
            (whitePieces.contains(.bishop) || whitePieces.contains(.knight))) ||
           (blackPieces.count == 1 && whitePieces.isEmpty && 
            (blackPieces.contains(.bishop) || blackPieces.contains(.knight))) {
            return true
        }
        
        return false
    }
    
    // MARK: - FEN Parsing
    func parseFEN(_ fen: String) -> ChessBoard? {
        let components = fen.components(separatedBy: " ")
        guard components.count >= 4 else { return nil }
        
        let board = ChessBoard()
        
        // Parse board position
        let position = components[0]
        let ranks = position.components(separatedBy: "/")
        guard ranks.count == 8 else { return nil }
        
        for (rankIndex, rankString) in ranks.enumerated() {
            let rank = 7 - rankIndex // FEN starts from rank 8
            var file = 0
            
            for char in rankString {
                if char.isNumber {
                    // Empty squares
                    if let count = Int(String(char)) {
                        file += count
                    }
                } else {
                    // Piece
                    let color: PieceColor = char.isUppercase ? .white : .black
                    let pieceChar = char.lowercased()
                    
                    if let pieceType = PieceType(rawValue: pieceChar) {
                        let piece = ChessPiece(type: pieceType, color: color)
                        board.setPiece(piece, at: Position(file: file, rank: rank))
                    }
                    
                    file += 1
                }
            }
        }
        
        // Parse active color
        if components.count > 1 {
            board.currentPlayer = components[1] == "w" ? .white : .black
        }
        
        // TODO: Parse castling rights, en passant, move counters
        
        return board
    }
    
    // MARK: - PGN Parsing
    func parsePGN(_ pgn: String) -> [ChessMove] {
        // This is a simplified PGN parser
        // In a full implementation, you'd handle all PGN notation
        var moves: [ChessMove] = []
        
        let cleanPGN = pgn.replacingOccurrences(of: #"\d+\."#, with: "", options: .regularExpression)
        let moveStrings = cleanPGN.components(separatedBy: " ").filter { !$0.isEmpty }
        
        for moveString in moveStrings {
            // This is very simplified - real PGN parsing is complex
            // For now, we'll just handle basic move notation
            if let move = parseAlgebraicNotation(moveString) {
                moves.append(move)
            }
        }
        
        return moves
    }
    
    private func parseAlgebraicNotation(_ notation: String) -> ChessMove? {
        // Simplified algebraic notation parsing
        // This would need to be much more sophisticated in a real implementation
        return nil
    }
}