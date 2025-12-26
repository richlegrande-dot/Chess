import Foundation
import Combine

// MARK: - Chess Board
class ChessBoard: ObservableObject {
    @Published var squares: [[ChessPiece?]] = Array(repeating: Array(repeating: nil, count: 8), count: 8)
    @Published var currentPlayer: PieceColor = .white
    @Published var gameResult: GameResult?
    
    // Castling rights
    private var whiteCanCastleKingside = true
    private var whiteCanCastleQueenside = true
    private var blackCanCastleKingside = true
    private var blackCanCastleQueenside = true
    
    // En passant target square
    private var enPassantTarget: Position?
    
    // Move history
    private var moveHistory: [ChessMove] = []
    private var positionHistory: [String] = []
    
    init() {
        setupInitialPosition()
    }
    
    private func setupInitialPosition() {
        // Clear board
        squares = Array(repeating: Array(repeating: nil, count: 8), count: 8)
        
        // White pieces
        squares[0][0] = ChessPiece(type: .rook, color: .white)
        squares[0][1] = ChessPiece(type: .knight, color: .white)
        squares[0][2] = ChessPiece(type: .bishop, color: .white)
        squares[0][3] = ChessPiece(type: .queen, color: .white)
        squares[0][4] = ChessPiece(type: .king, color: .white)
        squares[0][5] = ChessPiece(type: .bishop, color: .white)
        squares[0][6] = ChessPiece(type: .knight, color: .white)
        squares[0][7] = ChessPiece(type: .rook, color: .white)
        
        for file in 0..<8 {
            squares[1][file] = ChessPiece(type: .pawn, color: .white)
        }
        
        // Black pieces
        squares[7][0] = ChessPiece(type: .rook, color: .black)
        squares[7][1] = ChessPiece(type: .knight, color: .black)
        squares[7][2] = ChessPiece(type: .bishop, color: .black)
        squares[7][3] = ChessPiece(type: .queen, color: .black)
        squares[7][4] = ChessPiece(type: .king, color: .black)
        squares[7][5] = ChessPiece(type: .bishop, color: .black)
        squares[7][6] = ChessPiece(type: .knight, color: .black)
        squares[7][7] = ChessPiece(type: .rook, color: .black)
        
        for file in 0..<8 {
            squares[6][file] = ChessPiece(type: .pawn, color: .black)
        }
        
        currentPlayer = .white
        gameResult = nil
        positionHistory.append(generateFEN())
    }
    
    func piece(at position: Position) -> ChessPiece? {
        guard position.isValid else { return nil }
        return squares[position.rank][position.file]
    }
    
    func setPiece(_ piece: ChessPiece?, at position: Position) {
        guard position.isValid else { return }
        squares[position.rank][position.file] = piece
    }
    
    // MARK: - Move Validation
    func isValidMove(_ move: ChessMove) -> Bool {
        let fromPiece = piece(at: move.from)
        guard let piece = fromPiece,
              piece.color == currentPlayer else {
            return false
        }
        
        // Basic validation
        guard move.from.isValid && move.to.isValid,
              move.from != move.to else {
            return false
        }
        
        // Check if destination has own piece
        if let toPiece = piece(at: move.to),
           toPiece.color == currentPlayer {
            return false
        }
        
        // Piece-specific movement validation
        switch piece.type {
        case .pawn:
            return isValidPawnMove(move)
        case .rook:
            return isValidRookMove(move)
        case .knight:
            return isValidKnightMove(move)
        case .bishop:
            return isValidBishopMove(move)
        case .queen:
            return isValidQueenMove(move)
        case .king:
            return isValidKingMove(move)
        }
    }
    
    private func isValidPawnMove(_ move: ChessMove) -> Bool {
        let direction = move.piece.color == .white ? 1 : -1
        let startRank = move.piece.color == .white ? 1 : 6
        let fileDiff = move.to.file - move.from.file
        let rankDiff = move.to.rank - move.from.rank
        
        // Forward move
        if fileDiff == 0 {
            if rankDiff == direction && piece(at: move.to) == nil {
                return true
            }
            // Two squares from start
            if move.from.rank == startRank && rankDiff == 2 * direction && piece(at: move.to) == nil {
                return true
            }
        }
        // Capture
        else if abs(fileDiff) == 1 && rankDiff == direction {
            if piece(at: move.to) != nil {
                return true
            }
            // En passant
            if let enPassant = enPassantTarget, enPassant == move.to {
                return true
            }
        }
        
        return false
    }
    
    private func isValidRookMove(_ move: ChessMove) -> Bool {
        let fileDiff = move.to.file - move.from.file
        let rankDiff = move.to.rank - move.from.rank
        
        // Must move in straight line
        guard fileDiff == 0 || rankDiff == 0 else { return false }
        
        return isPathClear(from: move.from, to: move.to)
    }
    
    private func isValidKnightMove(_ move: ChessMove) -> Bool {
        let fileDiff = abs(move.to.file - move.from.file)
        let rankDiff = abs(move.to.rank - move.from.rank)
        
        return (fileDiff == 2 && rankDiff == 1) || (fileDiff == 1 && rankDiff == 2)
    }
    
    private func isValidBishopMove(_ move: ChessMove) -> Bool {
        let fileDiff = abs(move.to.file - move.from.file)
        let rankDiff = abs(move.to.rank - move.from.rank)
        
        // Must move diagonally
        guard fileDiff == rankDiff else { return false }
        
        return isPathClear(from: move.from, to: move.to)
    }
    
    private func isValidQueenMove(_ move: ChessMove) -> Bool {
        return isValidRookMove(move) || isValidBishopMove(move)
    }
    
    private func isValidKingMove(_ move: ChessMove) -> Bool {
        let fileDiff = abs(move.to.file - move.from.file)
        let rankDiff = abs(move.to.rank - move.from.rank)
        
        // Normal king move
        if fileDiff <= 1 && rankDiff <= 1 {
            return true
        }
        
        // Castling
        if rankDiff == 0 && fileDiff == 2 {
            return canCastle(kingside: move.to.file > move.from.file)
        }
        
        return false
    }
    
    private func isPathClear(from: Position, to: Position) -> Bool {
        let fileDiff = to.file - from.file
        let rankDiff = to.rank - from.rank
        
        let fileStep = fileDiff == 0 ? 0 : (fileDiff > 0 ? 1 : -1)
        let rankStep = rankDiff == 0 ? 0 : (rankDiff > 0 ? 1 : -1)
        
        var currentFile = from.file + fileStep
        var currentRank = from.rank + rankStep
        
        while currentFile != to.file || currentRank != to.rank {
            let position = Position(file: currentFile, rank: currentRank)
            if piece(at: position) != nil {
                return false
            }
            currentFile += fileStep
            currentRank += rankStep
        }
        
        return true
    }
    
    private func canCastle(kingside: Bool) -> Bool {
        let rank = currentPlayer == .white ? 0 : 7
        let kingFile = 4
        let rookFile = kingside ? 7 : 0
        
        // Check castling rights
        let canCastle: Bool
        switch (currentPlayer, kingside) {
        case (.white, true): canCastle = whiteCanCastleKingside
        case (.white, false): canCastle = whiteCanCastleQueenside
        case (.black, true): canCastle = blackCanCastleKingside
        case (.black, false): canCastle = blackCanCastleQueenside
        }
        
        guard canCastle else { return false }
        
        // Check if king and rook are in place
        guard let king = piece(at: Position(file: kingFile, rank: rank)),
              king.type == .king && king.color == currentPlayer,
              let rook = piece(at: Position(file: rookFile, rank: rank)),
              rook.type == .rook && rook.color == currentPlayer else {
            return false
        }
        
        // Check if path is clear
        let startFile = min(kingFile, rookFile) + 1
        let endFile = max(kingFile, rookFile) - 1
        
        for file in startFile...endFile {
            if piece(at: Position(file: file, rank: rank)) != nil {
                return false
            }
        }
        
        // TODO: Check if king is in check or passes through check
        
        return true
    }
    
    // MARK: - Make Move
    func makeMove(_ move: ChessMove) -> Bool {
        guard isValidMove(move) else { return false }
        
        // Store original state for undo if needed
        let capturedPiece = piece(at: move.to)
        
        // Handle special moves
        if move.isCastling {
            performCastling(move)
        } else if move.isEnPassant {
            performEnPassant(move)
        } else {
            // Normal move
            setPiece(nil, at: move.from)
            setPiece(move.piece, at: move.to)
        }
        
        // Handle promotion
        if move.isPromotion, let promotionPiece = move.promotionPiece {
            setPiece(ChessPiece(type: promotionPiece, color: move.piece.color), at: move.to)
        }
        
        // Update castling rights
        updateCastlingRights(move)
        
        // Update en passant target
        updateEnPassantTarget(move)
        
        // Add to history
        moveHistory.append(move)
        positionHistory.append(generateFEN())
        
        // Switch players
        currentPlayer = currentPlayer.opposite
        
        // Check for game end
        checkGameEnd()
        
        return true
    }
    
    private func performCastling(_ move: ChessMove) {
        let rank = move.from.rank
        let kingside = move.to.file > move.from.file
        
        // Move king
        setPiece(nil, at: move.from)
        setPiece(move.piece, at: move.to)
        
        // Move rook
        let rookFromFile = kingside ? 7 : 0
        let rookToFile = kingside ? 5 : 3
        
        let rook = piece(at: Position(file: rookFromFile, rank: rank))
        setPiece(nil, at: Position(file: rookFromFile, rank: rank))
        setPiece(rook, at: Position(file: rookToFile, rank: rank))
    }
    
    private func performEnPassant(_ move: ChessMove) {
        // Move pawn
        setPiece(nil, at: move.from)
        setPiece(move.piece, at: move.to)
        
        // Remove captured pawn
        let capturedPawnRank = move.from.rank
        setPiece(nil, at: Position(file: move.to.file, rank: capturedPawnRank))
    }
    
    private func updateCastlingRights(_ move: ChessMove) {
        // King moves
        if move.piece.type == .king {
            if move.piece.color == .white {
                whiteCanCastleKingside = false
                whiteCanCastleQueenside = false
            } else {
                blackCanCastleKingside = false
                blackCanCastleQueenside = false
            }
        }
        
        // Rook moves
        if move.piece.type == .rook {
            if move.piece.color == .white {
                if move.from.file == 0 { whiteCanCastleQueenside = false }
                if move.from.file == 7 { whiteCanCastleKingside = false }
            } else {
                if move.from.file == 0 { blackCanCastleQueenside = false }
                if move.from.file == 7 { blackCanCastleKingside = false }
            }
        }
    }
    
    private func updateEnPassantTarget(_ move: ChessMove) {
        // Reset en passant
        enPassantTarget = nil
        
        // Set new en passant target for pawn double moves
        if move.piece.type == .pawn && abs(move.to.rank - move.from.rank) == 2 {
            let targetRank = (move.from.rank + move.to.rank) / 2
            enPassantTarget = Position(file: move.from.file, rank: targetRank)
        }
    }
    
    private func checkGameEnd() {
        // Simplified game end detection
        // In a full implementation, you'd check for checkmate, stalemate, etc.
        let moves = generateLegalMoves()
        if moves.isEmpty {
            // This is a simplified check - you'd need to determine if it's checkmate or stalemate
            gameResult = .draw
        }
    }
    
    func generateLegalMoves() -> [ChessMove] {
        var moves: [ChessMove] = []
        
        for rank in 0..<8 {
            for file in 0..<8 {
                let from = Position(file: file, rank: rank)
                guard let piece = piece(at: from),
                      piece.color == currentPlayer else { continue }
                
                // Generate possible moves for this piece
                let possibleMoves = generateMovesForPiece(at: from)
                moves.append(contentsOf: possibleMoves)
            }
        }
        
        return moves
    }
    
    private func generateMovesForPiece(at position: Position) -> [ChessMove] {
        guard let piece = piece(at: position) else { return [] }
        var moves: [ChessMove] = []
        
        switch piece.type {
        case .pawn:
            moves.append(contentsOf: generatePawnMoves(from: position, piece: piece))
        case .rook:
            moves.append(contentsOf: generateStraightMoves(from: position, piece: piece))
        case .bishop:
            moves.append(contentsOf: generateDiagonalMoves(from: position, piece: piece))
        case .queen:
            moves.append(contentsOf: generateStraightMoves(from: position, piece: piece))
            moves.append(contentsOf: generateDiagonalMoves(from: position, piece: piece))
        case .knight:
            moves.append(contentsOf: generateKnightMoves(from: position, piece: piece))
        case .king:
            moves.append(contentsOf: generateKingMoves(from: position, piece: piece))
        }
        
        return moves.filter { isValidMove($0) }
    }
    
    private func generatePawnMoves(from position: Position, piece: ChessPiece) -> [ChessMove] {
        var moves: [ChessMove] = []
        let direction = piece.color == .white ? 1 : -1
        let startRank = piece.color == .white ? 1 : 6
        
        // Forward moves
        let oneStep = Position(file: position.file, rank: position.rank + direction)
        if oneStep.isValid && self.piece(at: oneStep) == nil {
            moves.append(ChessMove(from: position, to: oneStep, piece: piece))
            
            // Two steps from start
            if position.rank == startRank {
                let twoStep = Position(file: position.file, rank: position.rank + 2 * direction)
                if twoStep.isValid && self.piece(at: twoStep) == nil {
                    moves.append(ChessMove(from: position, to: twoStep, piece: piece))
                }
            }
        }
        
        // Captures
        for fileOffset in [-1, 1] {
            let capturePos = Position(file: position.file + fileOffset, rank: position.rank + direction)
            if capturePos.isValid {
                if let targetPiece = self.piece(at: capturePos), targetPiece.color != piece.color {
                    moves.append(ChessMove(from: position, to: capturePos, piece: piece, capturedPiece: targetPiece))
                }
            }
        }
        
        return moves
    }
    
    private func generateStraightMoves(from position: Position, piece: ChessPiece) -> [ChessMove] {
        var moves: [ChessMove] = []
        let directions = [(0, 1), (0, -1), (1, 0), (-1, 0)]
        
        for (fileDir, rankDir) in directions {
            for step in 1..<8 {
                let newPos = Position(file: position.file + step * fileDir, rank: position.rank + step * rankDir)
                if !newPos.isValid { break }
                
                if let targetPiece = self.piece(at: newPos) {
                    if targetPiece.color != piece.color {
                        moves.append(ChessMove(from: position, to: newPos, piece: piece, capturedPiece: targetPiece))
                    }
                    break
                } else {
                    moves.append(ChessMove(from: position, to: newPos, piece: piece))
                }
            }
        }
        
        return moves
    }
    
    private func generateDiagonalMoves(from position: Position, piece: ChessPiece) -> [ChessMove] {
        var moves: [ChessMove] = []
        let directions = [(1, 1), (1, -1), (-1, 1), (-1, -1)]
        
        for (fileDir, rankDir) in directions {
            for step in 1..<8 {
                let newPos = Position(file: position.file + step * fileDir, rank: position.rank + step * rankDir)
                if !newPos.isValid { break }
                
                if let targetPiece = self.piece(at: newPos) {
                    if targetPiece.color != piece.color {
                        moves.append(ChessMove(from: position, to: newPos, piece: piece, capturedPiece: targetPiece))
                    }
                    break
                } else {
                    moves.append(ChessMove(from: position, to: newPos, piece: piece))
                }
            }
        }
        
        return moves
    }
    
    private func generateKnightMoves(from position: Position, piece: ChessPiece) -> [ChessMove] {
        var moves: [ChessMove] = []
        let offsets = [(2, 1), (2, -1), (-2, 1), (-2, -1), (1, 2), (1, -2), (-1, 2), (-1, -2)]
        
        for (fileOffset, rankOffset) in offsets {
            let newPos = Position(file: position.file + fileOffset, rank: position.rank + rankOffset)
            if newPos.isValid {
                if let targetPiece = self.piece(at: newPos) {
                    if targetPiece.color != piece.color {
                        moves.append(ChessMove(from: position, to: newPos, piece: piece, capturedPiece: targetPiece))
                    }
                } else {
                    moves.append(ChessMove(from: position, to: newPos, piece: piece))
                }
            }
        }
        
        return moves
    }
    
    private func generateKingMoves(from position: Position, piece: ChessPiece) -> [ChessMove] {
        var moves: [ChessMove] = []
        
        for fileOffset in -1...1 {
            for rankOffset in -1...1 {
                if fileOffset == 0 && rankOffset == 0 { continue }
                
                let newPos = Position(file: position.file + fileOffset, rank: position.rank + rankOffset)
                if newPos.isValid {
                    if let targetPiece = self.piece(at: newPos) {
                        if targetPiece.color != piece.color {
                            moves.append(ChessMove(from: position, to: newPos, piece: piece, capturedPiece: targetPiece))
                        }
                    } else {
                        moves.append(ChessMove(from: position, to: newPos, piece: piece))
                    }
                }
            }
        }
        
        return moves
    }
    
    // MARK: - FEN Generation
    func generateFEN() -> String {
        var fen = ""
        
        // Board position
        for rank in (0..<8).reversed() {
            var emptyCount = 0
            for file in 0..<8 {
                if let piece = squares[rank][file] {
                    if emptyCount > 0 {
                        fen += String(emptyCount)
                        emptyCount = 0
                    }
                    let pieceChar = piece.type.rawValue
                    fen += piece.color == .white ? pieceChar.uppercased() : pieceChar
                } else {
                    emptyCount += 1
                }
            }
            if emptyCount > 0 {
                fen += String(emptyCount)
            }
            if rank > 0 {
                fen += "/"
            }
        }
        
        // Active color
        fen += " " + currentPlayer.rawValue
        
        // Castling rights
        fen += " "
        var castling = ""
        if whiteCanCastleKingside { castling += "K" }
        if whiteCanCastleQueenside { castling += "Q" }
        if blackCanCastleKingside { castling += "k" }
        if blackCanCastleQueenside { castling += "q" }
        fen += castling.isEmpty ? "-" : castling
        
        // En passant target
        fen += " "
        if let enPassant = enPassantTarget {
            fen += enPassant.notation
        } else {
            fen += "-"
        }
        
        // Halfmove and fullmove counters (simplified)
        fen += " 0 \(moveHistory.count / 2 + 1)"
        
        return fen
    }
    
    // MARK: - PGN Generation
    func generatePGN() -> String {
        var pgn = ""
        
        for (index, move) in moveHistory.enumerated() {
            if index % 2 == 0 {
                pgn += "\(index / 2 + 1). "
            }
            
            // Simplified algebraic notation
            pgn += move.uci
            
            if index % 2 == 1 {
                pgn += " "
            } else if index < moveHistory.count - 1 {
                pgn += " "
            }
        }
        
        if let result = gameResult {
            pgn += " " + result.description
        }
        
        return pgn
    }
    
    func reset() {
        setupInitialPosition()
        moveHistory.removeAll()
        positionHistory.removeAll()
        positionHistory.append(generateFEN())
        
        whiteCanCastleKingside = true
        whiteCanCastleQueenside = true
        blackCanCastleKingside = true
        blackCanCastleQueenside = true
        enPassantTarget = nil
    }
}