import Foundation

// MARK: - LLM Service Protocol

/// Protocol that all LLM service providers must implement
protocol LLMService {
    /// Get a chess move in UCI format given the current position
    /// - Parameters:
    ///   - fen: Current board position in FEN notation
    ///   - pgn: Complete game history in PGN format
    ///   - model: The specific AI model to use
    /// - Returns: UCI move notation (e.g., "e2e4" or "e7e8q")
    func getChessMove(fen: String, pgn: String, model: AIModel) async throws -> String
    
    /// Send a chat message for post-game analysis
    /// - Parameters:
    ///   - message: The user's chat message
    ///   - gameContext: Context about the completed game
    ///   - chatHistory: Previous messages in the conversation
    ///   - model: The specific AI model to use
    /// - Returns: AI's response message
    func sendChatMessage(
        _ message: String,
        gameContext: GameContext,
        chatHistory: [ChatMessage],
        model: AIModel
    ) async throws -> String
    
    /// Check if the service is properly configured (e.g., API key is set)
    func isConfigured() -> Bool
    
    /// Get the API key for this service
    func getAPIKey() -> String
}

// MARK: - LLM Service Factory

/// Factory for creating LLM service instances
class LLMServiceFactory {
    /// Shared singleton instance
    static let shared = LLMServiceFactory()
    
    private init() {}
    
    /// Get the appropriate service for a given provider
    /// - Parameter provider: The AI provider
    /// - Returns: Service instance implementing LLMService protocol
    func service(for provider: AIProvider) -> LLMService {
        switch provider {
        case .openai:
            return OpenAIService()
        case .anthropic:
            return PlaceholderLLMService(provider: .anthropic)
        case .xai:
            return PlaceholderLLMService(provider: .xai)
        case .google:
            return PlaceholderLLMService(provider: .google)
        case .mistral:
            return PlaceholderLLMService(provider: .mistral)
        }
    }
    
    /// Get service for a specific model
    /// - Parameter model: The AI model
    /// - Returns: Service instance for that model's provider
    func service(for model: AIModel) -> LLMService {
        return service(for: model.provider)
    }
}

// MARK: - Placeholder Service for Future Providers

/// Placeholder service for providers that aren't implemented yet
class PlaceholderLLMService: LLMService {
    let provider: AIProvider
    
    init(provider: AIProvider) {
        self.provider = provider
    }
    
    func getChessMove(fen: String, pgn: String, model: AIModel) async throws -> String {
        throw LLMError.providerNotImplemented(provider.rawValue)
    }
    
    func sendChatMessage(
        _ message: String,
        gameContext: GameContext,
        chatHistory: [ChatMessage],
        model: AIModel
    ) async throws -> String {
        throw LLMError.providerNotImplemented(provider.rawValue)
    }
    
    func isConfigured() -> Bool {
        return false
    }
    
    func getAPIKey() -> String {
        return ""
    }
}

// MARK: - Common LLM Errors

enum LLMError: LocalizedError {
    case noAPIKey
    case invalidAPIKey
    case invalidURL
    case noResponse
    case httpError(Int)
    case invalidMoveFormat
    case rateLimited
    case serverError
    case invalidResponse
    case networkTimeout
    case providerNotImplemented(String)
    case modelNotSupported(String)
    
    var errorDescription: String? {
        switch self {
        case .noAPIKey:
            return "API key not set. Please add your API key in Settings."
        case .invalidAPIKey:
            return "Invalid API key. Please check your API key in Settings."
        case .invalidURL:
            return "Invalid API URL"
        case .noResponse:
            return "No response from AI service"
        case .httpError(let code):
            return "API error (\(code)). Please try again."
        case .invalidMoveFormat:
            return "AI returned invalid move format"
        case .rateLimited:
            return "API rate limit exceeded. Please wait a moment and try again."
        case .serverError:
            return "Server error. Please try again later."
        case .invalidResponse:
            return "Invalid response from AI service"
        case .networkTimeout:
            return "Network timeout. Please check your connection and try again."
        case .providerNotImplemented(let provider):
            return "\(provider) support is coming soon! For now, please select an OpenAI model in Settings."
        case .modelNotSupported(let model):
            return "Model '\(model)' is not currently supported."
        }
    }
}
