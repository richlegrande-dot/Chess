import Foundation

// MARK: - Chat Message Model

/// Represents a single message in a chat conversation
struct ChatMessage: Identifiable, Equatable {
    let id = UUID()
    let content: String
    let isUser: Bool
    let timestamp: Date
    
    init(content: String, isUser: Bool) {
        self.content = content
        self.isUser = isUser
        self.timestamp = Date()
    }
}

// MARK: - Game Context for Chat Analysis

/// Context information about a completed chess game
struct GameContext {
    let finalFEN: String
    let pgn: String
    let result: String
}
