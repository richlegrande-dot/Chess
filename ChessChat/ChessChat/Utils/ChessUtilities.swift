import Foundation

// MARK: - Chess Notation Utilities
struct ChessNotationUtils {
    
    // Convert position to algebraic notation
    static func positionToNotation(_ position: Position) -> String {
        let file = String("abcdefgh"[String.Index("abcdefgh".startIndex, offsetBy: position.file)])
        let rank = String(position.rank + 1)
        return file + rank
    }
    
    // Convert algebraic notation to position
    static func notationToPosition(_ notation: String) -> Position? {
        guard notation.count == 2 else { return nil }
        
        let chars = Array(notation.lowercased())
        guard let fileChar = chars.first,
              let rankChar = chars.last,
              let fileIndex = "abcdefgh".firstIndex(of: fileChar),
              let rankNumber = Int(String(rankChar)) else {
            return nil
        }
        
        let file = "abcdefgh".distance(from: "abcdefgh".startIndex, to: fileIndex)
        let rank = rankNumber - 1
        
        return Position(file: file, rank: rank)
    }
    
    // Format move for display
    static func formatMoveForDisplay(_ move: ChessMove) -> String {
        let from = positionToNotation(move.from)
        let to = positionToNotation(move.to)
        
        var notation = ""
        
        // Add piece symbol (except for pawns)
        if move.piece.type != .pawn {
            notation += move.piece.type.rawValue.uppercased()
        }
        
        // Add capture indicator
        if move.capturedPiece != nil {
            if move.piece.type == .pawn {
                notation += String(from.first!)
            }
            notation += "x"
        }
        
        // Add destination
        notation += to
        
        // Add promotion
        if let promotion = move.promotionPiece {
            notation += "=" + promotion.rawValue.uppercased()
        }
        
        // Add castling
        if move.isCastling {
            let kingside = move.to.file > move.from.file
            notation = kingside ? "O-O" : "O-O-O"
        }
        
        return notation
    }
    
    // Validate UCI format
    static func isValidUCI(_ uci: String) -> Bool {
        let pattern = #"^[a-h][1-8][a-h][1-8][qrbn]?$"#
        return uci.range(of: pattern, options: .regularExpression) != nil
    }
}

// MARK: - Game State Utilities
struct GameStateUtils {
    
    // Format game duration
    static func formatGameDuration(_ startTime: Date, endTime: Date) -> String {
        let duration = endTime.timeIntervalSince(startTime)
        let minutes = Int(duration) / 60
        let seconds = Int(duration) % 60
        
        if minutes > 0 {
            return "\(minutes)m \(seconds)s"
        } else {
            return "\(seconds)s"
        }
    }
    
    // Get game phase description
    static func getGamePhase(moveCount: Int) -> String {
        switch moveCount {
        case 0...10:
            return "Opening"
        case 11...25:
            return "Middle Game"
        default:
            return "Endgame"
        }
    }
    
    // Count material for each side
    static func getMaterialCount(board: ChessBoard) -> (white: Int, black: Int) {
        var whiteCount = 0
        var blackCount = 0
        
        let pieceValues: [PieceType: Int] = [
            .pawn: 1,
            .knight: 3,
            .bishop: 3,
            .rook: 5,
            .queen: 9,
            .king: 0
        ]
        
        for rank in 0..<8 {
            for file in 0..<8 {
                let position = Position(file: file, rank: rank)
                if let piece = board.piece(at: position),
                   let value = pieceValues[piece.type] {
                    if piece.color == .white {
                        whiteCount += value
                    } else {
                        blackCount += value
                    }
                }
            }
        }
        
        return (whiteCount, blackCount)
    }
}

// MARK: - Error Handling Utilities
struct ErrorUtils {
    
    // Format error messages for user display
    static func formatErrorMessage(_ error: Error) -> String {
        if let openAIError = error as? OpenAIError {
            return openAIError.localizedDescription
        }
        
        // Handle common errors
        let errorString = error.localizedDescription.lowercased()
        
        if errorString.contains("network") || errorString.contains("internet") {
            return "Network connection error. Please check your internet connection."
        }
        
        if errorString.contains("timeout") {
            return "Request timed out. Please try again."
        }
        
        if errorString.contains("unauthorized") || errorString.contains("401") {
            return "Invalid API key. Please check your OpenAI API key in Settings."
        }
        
        if errorString.contains("quota") || errorString.contains("429") {
            return "API quota exceeded. Please check your OpenAI account usage."
        }
        
        return "An error occurred: \(error.localizedDescription)"
    }
}

// MARK: - String Extensions
extension String {
    // Clean up text for display
    func cleanForDisplay() -> String {
        return self
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .replacingOccurrences(of: "\\n", with: "\n")
            .replacingOccurrences(of: "\\\"", with: "\"")
    }
    
    // Validate as chess move
    var isValidChessMove: Bool {
        return ChessNotationUtils.isValidUCI(self)
    }
}

// MARK: - Date Extensions
extension Date {
    // Format for chat timestamps
    func chatTimestamp() -> String {
        let formatter = DateFormatter()
        let calendar = Calendar.current
        
        if calendar.isDateInToday(self) {
            formatter.timeStyle = .short
            return formatter.string(from: self)
        } else if calendar.isDateInYesterday(self) {
            return "Yesterday"
        } else {
            formatter.dateStyle = .short
            return formatter.string(from: self)
        }
    }
}

// MARK: - Color Extensions
extension PieceColor {
    var displayName: String {
        switch self {
        case .white:
            return "White"
        case .black:
            return "Black"
        }
    }
}