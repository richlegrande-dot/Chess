import Foundation
import Combine

// MARK: - Game Manager
class ChessGameManager: ObservableObject {
    @Published var board = ChessBoard()
    @Published var gameState: GameState = .playing
    @Published var isPlayerTurn = true
    @Published var isThinking = false
    @Published var errorMessage: String?
    
    private let chessEngineService = ChessEngineService()
    private var cancellables = Set<AnyCancellable>()
    
    // Reference to app settings to get selected model
    weak var appSettings: AppSettings?
    
    init(appSettings: AppSettings? = nil) {
        self.appSettings = appSettings
        
        // Listen to board changes
        board.objectWillChange.sink { [weak self] in
            self?.objectWillChange.send()
        }.store(in: &cancellables)
    }
    
    func makePlayerMove(from: Position, to: Position) -> Bool {
        // Prevent rapid tapping and ensure proper state
        guard isPlayerTurn && gameState == .playing && !isThinking else { return false }
        
        guard let piece = board.piece(at: from),
              piece.color == .white else { return false }
        
        let move = ChessMove(from: from, to: to, piece: piece)
        
        if board.makeMove(move) {
            isPlayerTurn = false
            errorMessage = nil // Clear any previous errors
            
            // Save game state for crash recovery
            let settings = AppSettings()
            settings.saveGameState(board.generateFEN(), board.generatePGN())
            
            // Check if game ended
            checkForGameEnd()
            if case .gameOver = gameState {
                return true
            }
            
            // Make AI move
            makeAIMove()
            return true
        }
        
        return false
    }
    
    private func makeAIMove(retryCount: Int = 0) {
        guard !isPlayerTurn && gameState == .playing else { return }
        
        isThinking = true
        errorMessage = nil
        
        Task {
            do {
                let fen = board.generateFEN()
                let pgn = board.generatePGN()
                
                // Get selected model from settings
                guard let selectedModel = appSettings?.selectedModel else {
                    await MainActor.run {
                        self.errorMessage = "No AI model selected. Please configure in Settings."
                        self.isThinking = false
                        self.isPlayerTurn = true
                    }
                    return
                }
                
                // Get the appropriate service for the selected model
                let llmService = LLMServiceFactory.shared.service(for: selectedModel)
                
                // Check if service is configured
                guard llmService.isConfigured() else {
                    await MainActor.run {
                        self.errorMessage = "\(selectedModel.provider.rawValue) API key not set. Please add your API key in Settings."
                        self.isThinking = false
                        self.isPlayerTurn = true
                    }
                    return
                }
                
                let aiMove = try await llmService.getChessMove(fen: fen, pgn: pgn, model: selectedModel)
                
                await MainActor.run {
                    if !self.processAIMove(aiMove) && retryCount < 2 {
                        // Retry if move was invalid
                        self.makeAIMove(retryCount: retryCount + 1)
                    }
                }
            } catch {
                await MainActor.run {
                    if retryCount < 2 {
                        // Wait before retry to prevent rapid failures
                        DispatchQueue.main.asyncAfter(deadline: .now() + 1.0) {
                            self.makeAIMove(retryCount: retryCount + 1)
                        }
                    } else {
                        // Final failure - provide helpful error message
                        if error.localizedDescription.contains("network") || error.localizedDescription.contains("internet") {
                            self.errorMessage = "No internet connection. Please check your network and try again."
                        } else if error.localizedDescription.contains("401") || error.localizedDescription.contains("API key") {
                            self.errorMessage = "Invalid API key. Please check your OpenAI API key in Settings."
                        } else {
                            self.errorMessage = "AI opponent unavailable. Please try again later."
                        }
                        self.isThinking = false
                        self.isPlayerTurn = true
                    }
                }
            }
        }
    }
    
    @discardableResult
    private func processAIMove(_ moveUCI: String) -> Bool {
        guard let move = ChessMove.fromUCI(moveUCI) else {
            errorMessage = "Invalid AI move format: \(moveUCI)"
            return false
        }
        
        // Get the actual piece from the board
        guard let piece = board.piece(at: move.from),
              piece.color == board.currentPlayer else {
            errorMessage = "AI tried to move wrong piece"
            return false
        }
        
        let actualMove = ChessMove(
            from: move.from,
            to: move.to,
            piece: piece,
            capturedPiece: board.piece(at: move.to),
            isPromotion: move.isPromotion,
            promotionPiece: move.promotionPiece
        )
        
        if board.makeMove(actualMove) {
            isThinking = false
            isPlayerTurn = true
            
            // Check if game ended with proper detection
            checkForGameEnd()
            return true
        } else {
            errorMessage = "AI attempted illegal move: \(moveUCI)"
            return false
        }
    }
    
    func startNewGame() {
        board.reset()
        gameState = .playing
        isPlayerTurn = true
        isThinking = false
        errorMessage = nil
    }
    
    func goToPostGameChat() {
        gameState = .postGame
    }
    
    func returnToGame() {
        gameState = .playing
    }
    
    func resign() {
        gameState = .gameOver(.blackWins)
    }
    
    private func checkForGameEnd() {
        let engineResult = chessEngineService.analyzeGameState(on: board)
        if let result = engineResult {
            board.gameResult = result
            gameState = .gameOver(result)
        }
    }
}

// MARK: - App Settings
class AppSettings: ObservableObject {
    @Published var openAIAPIKey: String = ""
    @Published var selectedModel: AIModel = AIModelRegistry.defaultModel
    
    private let keychain = "ChessChat.OpenAI.APIKey"
    private let gameStateKey = "ChessChat.GameState"
    private let selectedModelKey = "ChessChat.SelectedModel"
    
    init() {
        loadAPIKey()
        loadSelectedModel()
    }
    
    func saveAPIKey(_ key: String) {
        openAIAPIKey = key
        // In a real app, you'd save this to keychain for security
        UserDefaults.standard.set(key, forKey: keychain)
    }
    
    private func loadAPIKey() {
        openAIAPIKey = UserDefaults.standard.string(forKey: keychain) ?? ""
    }
    
    func saveSelectedModel(_ model: AIModel) {
        selectedModel = model
        if let encoded = try? JSONEncoder().encode(model) {
            UserDefaults.standard.set(encoded, forKey: selectedModelKey)
        }
    }
    
    private func loadSelectedModel() {
        if let data = UserDefaults.standard.data(forKey: selectedModelKey),
           let decoded = try? JSONDecoder().decode(AIModel.self, from: data) {
            selectedModel = decoded
        } else {
            selectedModel = AIModelRegistry.defaultModel
        }
    }
    
    func saveGameState(_ fen: String, _ pgn: String) {
        let gameData = ["fen": fen, "pgn": pgn]
        UserDefaults.standard.set(gameData, forKey: gameStateKey)
    }
    
    func loadGameState() -> (fen: String?, pgn: String?) {
        guard let gameData = UserDefaults.standard.dictionary(forKey: gameStateKey) as? [String: String] else {
            return (nil, nil)
        }
        return (gameData["fen"], gameData["pgn"])
    }
    
    func clearGameState() {
        UserDefaults.standard.removeObject(forKey: gameStateKey)
    }
}