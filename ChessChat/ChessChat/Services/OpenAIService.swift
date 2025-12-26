import Foundation
import Combine

// MARK: - OpenAI API Models (Internal to OpenAI Service)
struct OpenAIRequest: Codable {
    let model: String
    let messages: [OpenAIMessage]
    let maxTokens: Int
    let temperature: Double
    
    enum CodingKeys: String, CodingKey {
        case model
        case messages
        case maxTokens = "max_tokens"
        case temperature
    }
}

struct OpenAIMessage: Codable {
    let role: String
    let content: String
}

struct OpenAIResponse: Codable {
    let choices: [OpenAIChoice]
}

struct OpenAIChoice: Codable {
    let message: OpenAIMessage
}

// MARK: - OpenAI Service Implementation
class OpenAIService: ObservableObject, LLMService {
    private let baseURL = "https://api.openai.com/v1/chat/completions"
    
    @Published var isLoading = false
    
    // MARK: - LLMService Protocol Implementation
    
    func getAPIKey() -> String {
        return UserDefaults.standard.string(forKey: "ChessChat.OpenAI.APIKey") ?? ""
    }
    
    func isConfigured() -> Bool {
        return !getAPIKey().isEmpty
    }
    
    // MARK: - Chess Move Generation
    func getChessMove(fen: String, pgn: String, model: AIModel) async throws -> String {
        let apiKey = getAPIKey()
        guard !apiKey.isEmpty else {
            throw LLMError.noAPIKey
        }
        
        let prompt = """
        You are a chess engine. Given the current position in FEN notation and the game history in PGN format, provide ONLY a legal chess move in UCI format (e.g., "e2e4" or "e7e8q" for promotion).
        
        Current position (FEN): \(fen)
        Game history (PGN): \(pgn)
        
        Respond with ONLY the UCI move notation, nothing else. The move must be legal.
        """
        
        let messages = [
            OpenAIMessage(role: "system", content: "You are a chess engine that responds only with legal UCI move notation."),
            OpenAIMessage(role: "user", content: prompt)
        ]
        
        let request = OpenAIRequest(
            model: model.modelIdentifier,
            messages: messages,
            maxTokens: 10,
            temperature: 0.7
        )
        
        let response = try await makeAPICall(request: request, apiKey: apiKey)
        let move = response.choices.first?.message.content.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        
        // Validate UCI format
        guard isValidUCIFormat(move) else {
            throw LLMError.invalidMoveFormat
        }
        
        return move
    }
    
    // MARK: - Post-Game Chat
    func sendChatMessage(
        _ message: String,
        gameContext: GameContext,
        chatHistory: [ChatMessage],
        model: AIModel
    ) async throws -> String {
        let apiKey = getAPIKey()
        guard !apiKey.isEmpty else {
            throw LLMError.noAPIKey
        }
        
        let moveCount = gameContext.pgn.components(separatedBy: " ").filter { $0.contains(".") }.count
        
        let systemPrompt = """
        You are a helpful chess coach analyzing a completed game. Always refer to specific moves by their number (e.g., "On move 12...", "After 8.Nf3...").
        
        Game Information:
        - Final position (FEN): \(gameContext.finalFEN)
        - Complete game (PGN): \(gameContext.pgn)
        - Result: \(gameContext.result)
        - Total moves: \(moveCount)
        
        Guidelines:
        - Reference actual moves from the PGN when explaining
        - Use move numbers consistently (1.e4, 2.Nf3, etc.)
        - Never invent or hallucinate moves that didn't happen
        - Explain concepts at an appropriate level
        - Be encouraging while pointing out improvements
        - If asked to explain "like I'm 8 years old", use very simple language
        - For translations, maintain chess accuracy
        """
        
        var messages = [
            OpenAIMessage(role: "system", content: systemPrompt)
        ]
        
        // Add chat history
        for chatMessage in chatHistory {
            messages.append(OpenAIMessage(
                role: chatMessage.isUser ? "user" : "assistant",
                content: chatMessage.content
            ))
        }
        
        // Add current message
        messages.append(OpenAIMessage(role: "user", content: message))
        
        let request = OpenAIRequest(
            model: model.modelIdentifier,
            messages: messages,
            maxTokens: 500,
            temperature: 0.7
        )
        
        let response = try await makeAPICall(request: request, apiKey: apiKey)
        return response.choices.first?.message.content ?? ""
    }
    
    // MARK: - API Call
    private func makeAPICall(request: OpenAIRequest, apiKey: String) async throws -> OpenAIResponse {
        guard let url = URL(string: baseURL) else {
            throw OpenAIError.invalidURL
        }
        
        var urlRequest = URLRequest(url: url)
        urlRequest.httpMethod = "POST"
        urlRequest.setValue("Bearer \(apiKey)", forHTTPHeaderField: "Authorization")
        urlRequest.setValue("application/json", forHTTPHeaderField: "Content-Type")
        urlRequest.timeoutInterval = 30.0 // 30 second timeout
        
        let encoder = JSONEncoder()
        urlRequest.httpBody = try encoder.encode(request)
        
        do {
            let (data, response) = try await URLSession.shared.data(for: urlRequest)
            
            guard let httpResponse = response as? HTTPURLResponse else {
                throw OpenAIError.noResponse
            }
            
            guard httpResponse.statusCode == 200 else {
                // Handle specific error codes
                switch httpResponse.statusCode {
                case 401:
                    throw LLMError.invalidAPIKey
                case 429:
                    throw LLMError.rateLimited
                case 500...599:
                    throw LLMError.serverError
                default:
                    throw LLMError.httpError(httpResponse.statusCode)
                }
            }
            
            let decoder = JSONDecoder()
            return try decoder.decode(OpenAIResponse.self, from: data)
        } catch {
            if error is DecodingError {
                throw LLMError.invalidResponse
            }
            throw error
        }
    }
    
    // MARK: - Validation
    private func isValidUCIFormat(_ move: String) -> Bool {
        // Basic UCI format validation: 4-5 characters, like "e2e4" or "e7e8q"
        let pattern = #"^[a-h][1-8][a-h][1-8][qrbn]?$"#
        return move.range(of: pattern, options: .regularExpression) != nil
    }
}