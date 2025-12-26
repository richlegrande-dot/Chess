import Foundation

// MARK: - Chess Piece Definitions
enum PieceType: String, CaseIterable {
    case pawn = "p"
    case rook = "r"
    case knight = "n"
    case bishop = "b"
    case queen = "q"
    case king = "k"
    
    var displayName: String {
        switch self {
        case .pawn: return "Pawn"
        case .rook: return "Rook"
        case .knight: return "Knight"
        case .bishop: return "Bishop"
        case .queen: return "Queen"
        case .king: return "King"
        }
    }
}

enum PieceColor: String, CaseIterable {
    case white = "w"
    case black = "b"
    
    var opposite: PieceColor {
        return self == .white ? .black : .white
    }
}

struct ChessPiece: Equatable, Hashable {
    let type: PieceType
    let color: PieceColor
    
    var symbol: String {
        switch (color, type) {
        case (.white, .king): return "♔"
        case (.white, .queen): return "♕"
        case (.white, .rook): return "♖"
        case (.white, .bishop): return "♗"
        case (.white, .knight): return "♘"
        case (.white, .pawn): return "♙"
        case (.black, .king): return "♚"
        case (.black, .queen): return "♛"
        case (.black, .rook): return "♜"
        case (.black, .bishop): return "♝"
        case (.black, .knight): return "♞"
        case (.black, .pawn): return "♟"
        }
    }
}

// MARK: - Board Position
struct Position: Equatable, Hashable {
    let file: Int // 0-7 (a-h)
    let rank: Int // 0-7 (1-8)
    
    init(file: Int, rank: Int) {
        self.file = file
        self.rank = rank
    }
    
    init?(from notation: String) {
        guard notation.count == 2 else { return nil }
        let chars = Array(notation.lowercased())
        guard let fileChar = chars.first,
              let rankChar = chars.last,
              let fileIndex = "abcdefgh".firstIndex(of: fileChar),
              let rankNumber = Int(String(rankChar)) else {
            return nil
        }
        
        self.file = "abcdefgh".distance(from: "abcdefgh".startIndex, to: fileIndex)
        self.rank = rankNumber - 1
    }
    
    var notation: String {
        let fileChar = String("abcdefgh"["abcdefgh".index("abcdefgh".startIndex, offsetBy: file)])
        return "\(fileChar)\(rank + 1)"
    }
    
    var isValid: Bool {
        return file >= 0 && file < 8 && rank >= 0 && rank < 8
    }
}

// MARK: - Chess Move
struct ChessMove: Equatable {
    let from: Position
    let to: Position
    let piece: ChessPiece
    let capturedPiece: ChessPiece?
    let isPromotion: Bool
    let promotionPiece: PieceType?
    let isCastling: Bool
    let isEnPassant: Bool
    
    init(from: Position, to: Position, piece: ChessPiece, capturedPiece: ChessPiece? = nil, 
         isPromotion: Bool = false, promotionPiece: PieceType? = nil,
         isCastling: Bool = false, isEnPassant: Bool = false) {
        self.from = from
        self.to = to
        self.piece = piece
        self.capturedPiece = capturedPiece
        self.isPromotion = isPromotion
        self.promotionPiece = promotionPiece
        self.isCastling = isCastling
        self.isEnPassant = isEnPassant
    }
    
    // Convert to UCI format (e.g., "e2e4")
    var uci: String {
        var uci = from.notation + to.notation
        if let promotion = promotionPiece {
            uci += promotion.rawValue
        }
        return uci
    }
    
    // Create move from UCI string
    static func fromUCI(_ uci: String) -> ChessMove? {
        guard uci.count >= 4 else { return nil }
        
        let fromStr = String(uci.prefix(2))
        let toStr = String(uci.dropFirst(2).prefix(2))
        
        guard let fromPos = Position(from: fromStr),
              let toPos = Position(from: toStr) else {
            return nil
        }
        
        // We'll need the actual piece from the board state
        // This is a simplified version - in practice, you'd get the piece from the board
        let piece = ChessPiece(type: .pawn, color: .white) // Placeholder
        
        var promotionPiece: PieceType?
        if uci.count == 5 {
            let promotionChar = String(uci.suffix(1))
            promotionPiece = PieceType(rawValue: promotionChar)
        }
        
        return ChessMove(from: fromPos, to: toPos, piece: piece, 
                        isPromotion: promotionPiece != nil, 
                        promotionPiece: promotionPiece)
    }
}

// MARK: - Game State
enum GameState {
    case setup
    case playing
    case gameOver(GameResult)
    case postGame
}

enum GameResult {
    case whiteWins
    case blackWins
    case draw
    case stalemate
    
    var description: String {
        switch self {
        case .whiteWins: return "White Wins"
        case .blackWins: return "Black Wins"
        case .draw: return "Draw"
        case .stalemate: return "Stalemate"
        }
    }
}